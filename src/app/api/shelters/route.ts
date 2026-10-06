import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'shelter',
  module: 'shelters',
  fields: ['name', 'type', 'address', 'locationId', 'capacity', 'currentOccupancy', 'contactPerson', 'phone', 'status', 'facilities', 'lat', 'lng'],
  searchFields: ['name', 'address', 'contactPerson'],
  orderBy: 'createdAt',
  include: { location: true, _count: { select: { persons: true } } },
  transform: (d) => {
    for (const k of ['capacity', 'currentOccupancy', 'lat', 'lng']) if (d[k] !== undefined) d[k] = Number(d[k])
    return d
  },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
