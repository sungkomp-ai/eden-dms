import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse, audit } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type OutboxRow = {
  id: string
  channel: string
  target: string
  status: string
  retries: number
  error: string | null
  sentAt: Date | null
  createdAt: Date
}

function summarize(rows: OutboxRow[]) {
  return {
    total: rows.length,
    sent: rows.filter((r) => r.status === 'sent').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    queued: rows.filter((r) => r.status === 'queued').length,
  }
}

/** GET /api/alerts/[id]/outbox — รายการคิวส่งรายผู้รับ + สรุป */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  const { id } = await params

  const alert = await db.alert.findFirst({
    where: { id, deleted: false },
    include: { incident: { select: { code: true, title: true } } },
  })
  if (!alert) return NextResponse.json({ error: 'ไม่พบการแจ้งเตือน' }, { status: 404 })

  const outbox = await db.alertOutbox.findMany({ where: { alertId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ alert, outbox, summary: summarize(outbox) })
}

/**
 * POST /api/alerts/[id]/outbox — ลองส่งซ้ำเฉพาะแถวที่ failed
 * body: { outboxId?: string } — ไม่ส่ง = ลองใหม่ทุกแถวที่ล้มเหลว
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  const { id } = await params

  const alert = await db.alert.findFirst({
    where: { id, deleted: false },
    include: { incident: { select: { code: true, title: true } } },
  })
  if (!alert) return NextResponse.json({ error: 'ไม่พบการแจ้งเตือน' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { outboxId?: string }

  // เลือกแถวที่จะ retry: failed เท่านั้น (หรือระบุ outboxId เดี่ยว)
  const failedRows = await db.alertOutbox.findMany({
    where: { alertId: id, status: 'failed', ...(body.outboxId ? { id: body.outboxId } : {}) },
  })
  if (failedRows.length === 0) {
    return NextResponse.json({ error: 'ไม่มีรายการที่ส่งล้มเหลวให้ลองใหม่' }, { status: 400 })
  }

  const now = new Date()
  let ok = 0
  let stillFailed = 0

  for (const row of failedRows) {
    const success = Math.random() < 0.85 // จำลอง: สำเร็จ ~85%
    if (success) ok++
    else stillFailed++
    await db.alertOutbox.update({
      where: { id: row.id },
      data: {
        retries: { increment: 1 },
        status: success ? 'sent' : 'failed',
        error: success ? null : 'จำลอง: relay ไม่ตอบสนอง (ผู้รับอาจไม่มีอยู่)',
        sentAt: success ? now : null,
      },
    })
  }

  // สำเร็จครบทุกแถวของ alert → สถานะ sent
  const all = await db.alertOutbox.findMany({ where: { alertId: id } })
  const anyFailed = all.some((r) => r.status !== 'sent')
  if (all.length > 0 && !anyFailed) {
    await db.alert.update({ where: { id }, data: { status: 'sent', sentAt: now, updatedBy: auth.name } })
  }

  await audit(
    'send', 'alerts',
    `ลองส่งซ้ำ ${failedRows.length} รายการ ของการแจ้งเตือน "${alert.title}" (สำเร็จเพิ่ม ${ok}, ยังล้มเหลว ${stillFailed})`,
    auth.name,
  )

  const outbox = await db.alertOutbox.findMany({ where: { alertId: id }, orderBy: { createdAt: 'asc' } })
  const updated = await db.alert.findUnique({
    where: { id },
    include: { incident: { select: { code: true, title: true } } },
  })

  return NextResponse.json({ alert: updated, outbox, summary: summarize(outbox) })
}
