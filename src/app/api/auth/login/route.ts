import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, audit } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** POST /api/auth/login — เข้าสู่ระบบ (P1: G1) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ''
    if (!email || !password) {
      return NextResponse.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || user.status !== 'active' || !verifyPassword(password, user.passwordHash)) {
      await audit('login', 'admin', `พยายามเข้าสู่ระบบไม่สำเร็จ: ${email}`)
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await audit('login', 'admin', `เข้าสู่ระบบ: ${user.name} (${user.role})`, user.name)

    const token = signSession({ id: user.id, email: user.email, name: user.name, role: user.role })
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return res
  } catch (e) {
    console.error('[auth/login]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}
