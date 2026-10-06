import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await db.setting.findMany({ orderBy: { key: 'asc' } })
    return NextResponse.json(settings)
  } catch (e) {
    console.error('[settings]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
