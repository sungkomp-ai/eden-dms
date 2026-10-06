import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const warehouseCfg: CrudConfig = {
  model: 'warehouse',
  module: 'inventory',
  fields: ['name', 'purpose', 'address', 'manager', 'phone', 'capacity', 'organizationId'],
  searchFields: ['name', 'purpose', 'manager'],
  orderBy: 'createdAt',
  include: {
    organization: { select: { id: true, name: true, type: true } },
    _count: { select: { items: true } },
  },
  transform: (d) => {
    for (const k of ['capacity']) if (d[k] !== undefined) d[k] = Number(d[k]) || 0
    return d
  },
}

export async function GET(req: NextRequest) { return listHandler(req, warehouseCfg) }
export async function POST(req: NextRequest) { return createHandler(req, warehouseCfg) }
