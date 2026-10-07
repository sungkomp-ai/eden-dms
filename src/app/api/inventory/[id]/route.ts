import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'inventoryItem',
  module: 'inventory',
  fields: ['name', 'category', 'type', 'size', 'unit', 'quantity', 'minQuantity', 'warehouseId', 'expiryDate'],
  include: { warehouse: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } } },
  transform: (d) => {
    if (d.expiryDate) d.expiryDate = new Date(d.expiryDate as string)
    else if ('expiryDate' in d) delete d.expiryDate
    for (const k of ['quantity', 'minQuantity']) if (d[k] !== undefined) d[k] = Number(d[k])
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
