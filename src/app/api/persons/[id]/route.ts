import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'person',
  module: 'persons',
  fields: ['firstName', 'lastName', 'nationalId', 'gender', 'age', 'dateOfBirth', 'emergencyContact', 'phone', 'address', 'status', 'lastSeenLocation', 'lastSeenAt', 'incidentId', 'shelterId', 'notes'],
  include: { incident: { select: { code: true, title: true } }, shelter: { select: { name: true } } },
  transform: (d) => {
    if (d.lastSeenAt) d.lastSeenAt = new Date(d.lastSeenAt as string)
    else if ('lastSeenAt' in d) delete d.lastSeenAt
    if (d.dateOfBirth) d.dateOfBirth = new Date(d.dateOfBirth as string)
    else if ('dateOfBirth' in d) delete d.dateOfBirth
    if (d.age !== undefined) d.age = Number(d.age)
    return d
  },
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return getHandler(req, cfg, id)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return updateHandler(req, cfg, id)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return deleteHandler(req, cfg, id)
}
