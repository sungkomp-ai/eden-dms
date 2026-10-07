import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/auth/me — ข้อมูลผู้ใช้ปัจจุบัน (ดึงจาก DB เพื่อให้ role/status เป็นปัจจุบัน) */
export async function GET(req: NextRequest) {
  const session = getSessionUser(req)
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  }
  try {
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true },
    })
    if (!user || user.status !== 'active') {
      return NextResponse.json({ error: 'บัญชีไม่พร้อมใช้งาน' }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (e) {
    console.error('[auth/me]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}
