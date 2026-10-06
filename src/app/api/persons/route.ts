import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'person',
  module: 'persons',
  fields: ['firstName', 'lastName', 'nationalId', 'gender', 'age', 'phone', 'address', 'status', 'lastSeenLocation', 'lastSeenAt', 'incidentId', 'shelterId', 'notes'],
  searchFields: ['firstName', 'lastName', 'nationalId', 'phone', 'lastSeenLocation'],
  orderBy: 'createdAt',
  include: { incident: { select: { code: true, title: true } }, shelter: { select: { name: true } } },
  transform: (d) => {
    if (d.lastSeenAt) d.lastSeenAt = new Date(d.lastSeenAt as string)
    else delete d.lastSeenAt
    if (d.age !== undefined) d.age = Number(d.age)
    return d
  },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
