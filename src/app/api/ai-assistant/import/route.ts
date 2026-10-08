import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'
import { takeJob, importRecords } from '@/lib/data-import'
import { createAiTask, taskPhase, taskDone, taskFail, handleTaskStatus, type AiTask } from '@/lib/ai-tasks'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================================
// POST /api/ai-assistant/import — ยืนยันนำข้อมูลเข้าสู่ระบบจริง
// รับ { jobId } ที่ได้จาก /extract (staging job แบบ one-shot)
// → ตรวจสอบ/แปลงข้อมูล/แก้ relation/บันทึกลง Prisma + Audit ทุกรายการ
//
// ทำงานแบบ async task: POST เริ่มงานและคืน { taskId } ทันที
// นำเข้าจำนวนมากอาจใช้เวลา 5-30s — client ติดตามด้วย GET ?taskId= (กัน proxy timeout)
// ============================================================

async function runImport(task: AiTask, jobId: string, userName: string): Promise<void> {
  try {
    taskPhase(task, 'กำลังบันทึกข้อมูลลงระบบ…')
    const job = takeJob(jobId)
    if (!job) {
      taskFail(task, 'งานนำเข้านี้หมดอายุหรือถูกนำเข้าไปแล้ว — กรุณาแนบไฟล์ขึ้นใหม่')
      return
    }
    const result = await importRecords(job.moduleKey, job.records, userName)
    taskDone(task, {
      module: job.moduleKey,
      moduleLabel: job.moduleLabel,
      fileName: job.fileName,
      totalRows: job.records.length,
      ...result,
      failedPreview: result.failed.slice(0, 20),
    })
  } catch (e) {
    console.error('[ai-assistant/import]', e)
    taskFail(task, e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล')
  }
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth

  try {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string }
    const jobId = (body.jobId ?? '').trim()
    if (!jobId) {
      return NextResponse.json({ error: 'ไม่พบรหัสงานนำเข้า (jobId) — กรุณาอัปโหลดไฟล์ใหม่' }, { status: 400 })
    }

    const task = createAiTask()
    void runImport(task, jobId, auth.name)
    return NextResponse.json({ taskId: task.id })
  } catch (e) {
    console.error('[ai-assistant/import]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return handleTaskStatus(req)
}
