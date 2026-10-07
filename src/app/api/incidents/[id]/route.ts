import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'incident',
  module: 'incidents',
  fields: ['code', 'title', 'type', 'severity', 'status', 'description', 'locationId', 'locationName', 'lat', 'lng', 'affectedPeople', 'injured', 'deceased', 'startDate', 'endDate'],
  include: { location: true, _count: { select: { persons: true, reports: true, aidRequests: true } } },
  transform: (d) => {
    if (d.startDate) d.startDate = new Date(d.startDate as string)
    if (d.endDate) d.endDate = new Date(d.endDate as string)
    else if ('endDate' in d) delete d.endDate
    for (const k of ['affectedPeople', 'injured', 'deceased', 'lat', 'lng']) if (d[k] !== undefined) d[k] = Number(d[k])
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
