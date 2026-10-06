import { listHandler, CrudConfig } from '@/lib/api'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'auditLog',
  module: 'admin',
  fields: [],
  searchFields: ['userName', 'detail'],
  orderBy: 'createdAt',
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
