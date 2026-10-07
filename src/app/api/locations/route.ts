import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const locations = await db.location.findMany({ where: { deleted: false }, include: { children: true }, orderBy: { name: 'asc' } })
    return NextResponse.json(locations)
  } catch (e) {
    console.error('[locations]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
