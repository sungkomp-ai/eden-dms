import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'

/**
 * EDEN DMS — ระบบงาน async ของผู้ช่วย AI (แก้ปัญหา proxy/gateway timeout)
 *
 * ปัญหา: การสนทนา/วิเคราะห์ไฟล์/นำเข้าข้อมูลบางงานใช้เวลานาน (LLM + web search ~22-90s)
 * proxy ระหว่างผู้ใช้กับเซิร์ฟเวอร์อาจตัดการเชื่อมต่อและตอบ HTML error page
 * ทำให้ฝั่ง client ที่เรียก res.json() พังด้วย "Unexpected token '<'"
 *
 * แนวทางแก้: แบ่งงานยาวเป็น 2 ขั้นแบบ async
 * 1) POST รับคำขอ → สร้าง task → ทำงานต่อในเบื้องหลัง → ตอบ { taskId } ทันที (เร็ว <1s)
 * 2) client ส่ง GET ?taskId=... สอบถามสถานะทุก ~2 วินาที (แต่ละ request สั้นเสมอ)
 *    → เจอ status 'done' จึงรับผลลัพธ์ / 'error' จึงแสดงข้อผิดพลาดที่อ่านเข้าใจง่าย
 */

export type AiTaskStatus = 'started' | 'done' | 'error'

export interface AiTask {
  id: string
  status: AiTaskStatus
  /** ข้อความภาษาไทยบอกขั้นตอนปัจจุบัน (แสดงให้ผู้ใช้เห็นระหว่างรอ) */
  phase: string
  result?: Record<string, unknown>
  error?: string
  createdAt: number
}

const tasks = new Map<string, AiTask>()
const TASK_TTL_MS = 15 * 60 * 1000 // ผลงานค้างไว้ให้ดึงได้ 15 นาที
const MAX_TASKS = 120

function cleanup() {
  const now = Date.now()
  for (const [id, t] of tasks) {
    if (now - t.createdAt > TASK_TTL_MS) tasks.delete(id)
  }
  if (tasks.size > MAX_TASKS) {
    const oldest = [...tasks.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, tasks.size - MAX_TASKS)
    for (const [id] of oldest) tasks.delete(id)
  }
}

export function createAiTask(): AiTask {
  cleanup()
  const t: AiTask = {
    id: `t${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
    status: 'started',
    phase: 'กำลังเริ่มงาน…',
    createdAt: Date.now(),
  }
  tasks.set(t.id, t)
  return t
}

export function getAiTask(id: string): AiTask | null {
  return tasks.get(id) ?? null
}

export function taskPhase(task: AiTask, phase: string): void {
  task.phase = phase
}

export function taskDone(task: AiTask, result: Record<string, unknown>): void {
  task.status = 'done'
  task.result = result
  task.phase = 'เสร็จสิ้น'
}

export function taskFail(task: AiTask, error: string): void {
  task.status = 'error'
  task.error = error
  task.phase = 'ล้มเหลว'
}

/** ครอบ promise ด้วยเวลาจำกัด — เกินกำหนดจะ throw Error(msg) (กันงานค้างไม่มีวันจบ) */
export function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

/** GET handler ร่วมของทุก route ที่ใช้ task: ตรวจ session + คืนสถานะ/ผลลัพธ์ */
export async function handleTaskStatus(req: NextRequest): Promise<NextResponse> {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth

  const id = req.nextUrl.searchParams.get('taskId') ?? ''
  if (!id) {
    return NextResponse.json({ error: 'ไม่พบรหัสงาน (taskId) — กรุณาเริ่มงานใหม่' }, { status: 400 })
  }
  const task = getAiTask(id)
  if (!task) {
    return NextResponse.json(
      { error: 'ไม่พบงานที่ระบุ (หมดอายุหรือไม่มีอยู่) — กรุณาลองอีกครั้ง' },
      { status: 404 },
    )
  }
  if (task.status === 'done') {
    return NextResponse.json({ status: 'done', ...task.result })
  }
  if (task.status === 'error') {
    return NextResponse.json({ status: 'error', error: task.error })
  }
  return NextResponse.json({ status: task.status, phase: task.phase })
}
