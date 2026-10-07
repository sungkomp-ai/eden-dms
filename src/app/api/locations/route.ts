import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const locations = await db.location.findMany({ include: { children: true }, orderBy: { name: 'asc' } })
    return NextResponse.json(locations)
  } catch (e) {
    console.error('[locations]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
