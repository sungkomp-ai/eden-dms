import { NextRequest, NextResponse } from 'next/server'
import { getHandler, updateHandler, deleteHandler, audit, CrudConfig } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'alert',
  module: 'alerts',
  fields: ['title', 'message', 'channel', 'severity', 'audience', 'status', 'scheduledAt', 'sentAt', 'incidentId'],
  include: { incident: { select: { code: true, title: true } } },
  transform: (d) => {
    if (d.scheduledAt) d.scheduledAt = new Date(d.scheduledAt as string)
    else if ('scheduledAt' in d) delete d.scheduledAt
    if (d.status === 'sent' && !d.sentAt) d.sentAt = new Date()
    return d
  },
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return getHandler(req, cfg, id)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // อ่าน body ครั้งเดียวแล้วส่งต่อให้ updateHandler (กัน Body has already been read)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await updateHandler(req, cfg, id, body)
  if (body.status === 'sent' && !(res instanceof NextResponse && res.status >= 400)) {
    await audit('send', 'alerts', 'ส่งการแจ้งเตือน: ' + String(body.title ?? ''), getSessionUser(req)?.name ?? 'system')
  }
  return res
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return deleteHandler(req, cfg, id)
}
