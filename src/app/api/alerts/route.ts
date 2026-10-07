import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'alert',
  module: 'alerts',
  fields: ['title', 'message', 'channel', 'severity', 'audience', 'status', 'scheduledAt', 'sentAt', 'incidentId'],
  searchFields: ['title', 'message'],
  orderBy: 'createdAt',
  include: { incident: { select: { code: true, title: true } } },
  transform: (d) => {
    if (d.scheduledAt) d.scheduledAt = new Date(d.scheduledAt as string)
    else delete d.scheduledAt
    if (d.status === 'sent' && !d.sentAt) d.sentAt = new Date()
    return d
  },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
