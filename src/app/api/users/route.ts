import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'user',
  module: 'admin',
  fields: ['email', 'name', 'role', 'status'],
  searchFields: ['name', 'email'],
  orderBy: 'createdAt',
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
