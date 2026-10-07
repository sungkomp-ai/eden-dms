import { NextRequest } from 'next/server'
import { listHandler, createHandler, audit, CrudConfig } from '@/lib/api'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function genCode() {
  const count = await db.aidRequest.count()
  const year = new Date().getFullYear() + 543
  return `REQ-${year}-${String(count + 1).padStart(3, '0')}`
}

const cfg: CrudConfig = {
  model: 'aidRequest',
  module: 'requests',
  fields: ['requesterName', 'requesterOrg', 'type', 'priority', 'status', 'quantity', 'description', 'locationName', 'incidentId', 'assignedTo'],
  searchFields: ['requestCode', 'requesterName', 'description', 'locationName'],
  orderBy: 'createdAt',
  include: { incident: { select: { code: true, title: true } } },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>
  body.requestCode = await genCode()
  const req2 = new NextRequest('http://local/', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  const res = await createHandler(req2, cfg)
  if (res.status === 201) await audit('create', 'requests', 'สร้างคำขอความช่วยเหลือใหม่ ' + body.requestCode)
  return res
}
