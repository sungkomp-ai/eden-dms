import { NextRequest } from 'next/server'
import { listHandler, createHandler, CrudConfig } from '@/lib/api'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'incidentReport',
  module: 'sitreps',
  fields: ['incidentId', 'title', 'content', 'status', 'author'],
  searchFields: ['title', 'author'],
  orderBy: 'createdAt',
  include: { incident: { select: { code: true, title: true, severity: true } } },
}

export async function GET(req: NextRequest) { return listHandler(req, cfg) }
export async function POST(req: NextRequest) { return createHandler(req, cfg) }
