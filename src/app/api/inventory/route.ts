import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'inventoryItem',
  module: 'inventory',
  fields: ['name', 'category', 'type', 'size', 'unit', 'quantity', 'minQuantity', 'warehouseId', 'expiryDate'],
  searchFields: ['name', 'type', 'size'],
  orderBy: 'createdAt',
  include: { warehouse: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } } },
  transform: (d) => {
    if (d.expiryDate) d.expiryDate = new Date(d.expiryDate as string)
    else delete d.expiryDate
    for (const k of ['quantity', 'minQuantity']) if (d[k] !== undefined) d[k] = Number(d[k])
    return d
  },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
