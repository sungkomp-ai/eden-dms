import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse, audit } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// กติกากลุ่มผู้รับตาม audience ของการแจ้งเตือน (role whitelist)
const AUDIENCE_ROLES: Record<string, string[] | null> = {
  all: null, // ทุกคน = user active ทุก role
  officers: ['admin', 'coordinator', 'officer'],
  area: ['admin', 'coordinator', 'officer'],
  volunteers: ['volunteer'],
}

// จำลองการส่ง: app ส่งได้ทันทีเสมอ, email/broadcast สำเร็จ ~85%
function simulate(channel: string): { ok: boolean; error: string | null } {
  if (channel === 'app') return { ok: true, error: null }
  const ok = Math.random() < 0.85
  return {
    ok,
    error: ok ? null : 'จำลอง: relay ไม่ตอบสนอง (ผู้รับอาจไม่มีอยู่)',
  }
}

/**
 * POST /api/alerts/[id]/send — สร้างคิวส่งรายผู้รับ (outbox) แล้วจำลองการส่งทันที
 * ส่งซ้ำ = deleteMany คิวเดิมแล้วสร้างชุดใหม่ทั้งหมด
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  const { id } = await params

  const alert = await db.alert.findFirst({ where: { id, deleted: false } })
  if (!alert) return NextResponse.json({ error: 'ไม่พบการแจ้งเตือน' }, { status: 404 })

  // 1) resolve ผู้รับจาก audience
  const roles = AUDIENCE_ROLES[alert.audience] ?? null
  const users = await db.user.findMany({
    where: { status: 'active', ...(roles ? { role: { in: roles } } : {}) },
    select: { email: true },
    orderBy: { email: 'asc' },
  })

  // 2) สร้างรายการคิว: ผู้ใช้ละ 2 ช่องทาง (app + email) + broadcast เมื่อ audience = all
  const targets: { channel: string; target: string }[] = []
  for (const u of users) {
    targets.push({ channel: 'app', target: `แอปในระบบ: ${u.email}` })
    targets.push({ channel: 'email', target: u.email })
  }
  if (alert.audience === 'all') {
    targets.push({ channel: 'broadcast', target: 'ประกาศสาธารณะ (เว็บไซต์/สื่อ/แอป)' })
  }

  // 3) batch semantics: ลบคิวเดิม → regenerate ชุดใหม่ (ส่งซ้ำ = ชุดใหม่)
  await db.alertOutbox.deleteMany({ where: { alertId: id } })

  const now = new Date()
  const outbox: {
    id: string; channel: string; target: string; status: string
    retries: number; error: string | null; sentAt: Date | null; createdAt: Date
  }[] = []
  let sent = 0
  let failed = 0

  for (const t of targets) {
    const sim = simulate(t.channel)
    const row = await db.alertOutbox.create({
      data: {
        alertId: id,
        channel: t.channel,
        target: t.target,
        status: sim.ok ? 'sent' : 'failed',
        error: sim.error,
        sentAt: sim.ok ? now : null,
        createdBy: auth.name,
      },
    })
    if (sim.ok) sent++
    else failed++
    outbox.push({
      id: row.id, channel: row.channel, target: row.target, status: row.status,
      retries: row.retries, error: row.error, sentAt: row.sentAt, createdAt: row.createdAt,
    })
  }

  const total = outbox.length
  const summary = { total, sent, failed, queued: 0 }

  // 4) สำเร็จทุกรายการ → alert เป็น sent; ถ้ายังมี failed → คงสถานะเดิม (UI ชี้ให้ retry)
  if (total > 0 && failed === 0) {
    await db.alert.update({ where: { id }, data: { status: 'sent', sentAt: now, updatedBy: auth.name } })
  }

  await audit(
    'send', 'alerts',
    `ส่งการแจ้งเตือน "${alert.title}" ถึง ${total} ผู้รับ (สำเร็จ ${sent}, ล้มเหลว ${failed})`,
    auth.name,
  )

  const updated = await db.alert.findUnique({
    where: { id },
    include: { incident: { select: { code: true, title: true } } },
  })

  return NextResponse.json({ alert: updated, summary, outbox })
}
