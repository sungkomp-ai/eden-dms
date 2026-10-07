import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, CrudConfig } from '@/lib/api'
import { warehouseCfg } from '../route'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = warehouseCfg

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
