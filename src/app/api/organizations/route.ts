import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'organization',
  module: 'organizations',
  fields: ['name', 'type', 'sector', 'contactPerson', 'phone', 'email', 'address', 'website', 'status', 'description'],
  searchFields: ['name', 'contactPerson', 'phone', 'email'],
  orderBy: 'createdAt',
  include: { _count: { select: { resources: true, warehouses: true } } },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
