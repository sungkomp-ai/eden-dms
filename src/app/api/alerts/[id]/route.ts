import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, audit, CrudConfig } from '@/lib/api'

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return getHandler(cfg, id)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>
  const res = await updateHandler(req, cfg, id)
  if (body.status === 'sent') await audit('send', 'alerts', 'ส่งการแจ้งเตือน: ' + String(body.title ?? ''))
  return res
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return deleteHandler(cfg, id)
}
