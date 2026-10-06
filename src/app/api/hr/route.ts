import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'humanResource',
  module: 'hr',
  fields: ['name', 'type', 'jobTitle', 'organizationId', 'phone', 'email', 'skills', 'status', 'baseLocation'],
  searchFields: ['name', 'jobTitle', 'skills', 'baseLocation'],
  orderBy: 'createdAt',
  include: { organization: { select: { name: true } } },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
