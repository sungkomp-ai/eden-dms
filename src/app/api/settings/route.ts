import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const settings = await db.setting.findMany({ orderBy: { key: 'asc' } })
    return NextResponse.json(settings)
  } catch (e) {
    console.error('[settings]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
