import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'shelter',
  module: 'shelters',
  fields: ['name', 'type', 'address', 'locationId', 'capacity', 'currentOccupancy', 'contactPerson', 'phone', 'status', 'facilities', 'lat', 'lng'],
  include: { location: true, persons: { select: { id: true, firstName: true, lastName: true, status: true } } },
  transform: (d) => {
    for (const k of ['capacity', 'currentOccupancy', 'lat', 'lng']) if (d[k] !== undefined) d[k] = Number(d[k])
    return d
  },
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return getHandler(cfg, id)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return updateHandler(req, cfg, id)
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return deleteHandler(cfg, id)
}
