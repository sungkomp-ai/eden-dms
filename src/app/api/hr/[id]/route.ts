import { NextRequest } from 'next/server'
import { getHandler, updateHandler, deleteHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'humanResource',
  module: 'hr',
  fields: ['name', 'type', 'jobTitle', 'organizationId', 'phone', 'email', 'skills', 'status', 'baseLocation'],
  include: { organization: { select: { name: true } } },
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
