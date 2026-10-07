import { NextRequest } from 'next/server'
import { listHandler, createHandler, audit, CrudConfig } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function genCode() {
  const count = await db.incident.count()
  const year = new Date().getFullYear() + 543
  return `INC-${year}-${String(count + 1).padStart(3, '0')}`
}

const cfg: CrudConfig = {
  model: 'incident',
  module: 'incidents',
  fields: ['code', 'title', 'type', 'severity', 'status', 'description', 'locationId', 'locationName', 'lat', 'lng', 'affectedPeople', 'injured', 'deceased', 'startDate', 'endDate'],
  searchFields: ['title', 'code', 'locationName'],
  orderBy: 'createdAt',
  include: { location: true, _count: { select: { persons: true, reports: true, aidRequests: true } } },
  transform: (d) => {
    if (d.startDate) d.startDate = new Date(d.startDate as string)
    if (d.endDate) d.endDate = new Date(d.endDate as string)
    else delete d.endDate
    for (const k of ['affectedPeople', 'injured', 'deceased', 'lat', 'lng']) if (d[k] !== undefined) d[k] = Number(d[k])
    return d
  },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>
  if (!body.code || String(body.code).trim() === '') {
    body.code = await genCode()
  }
  const req2 = new NextRequest('http://local/', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const res = await createHandler(req2, cfg)
  if (res.status === 201) await audit('create', 'incidents', 'รายงานเหตุการณ์ใหม่ ' + body.code)
  return res
}
