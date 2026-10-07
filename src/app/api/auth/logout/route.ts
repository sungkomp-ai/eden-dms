import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, audit, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** POST /api/auth/logout — ออกจากระบบ */
export async function POST(req: NextRequest) {
  const user = getSessionUser(req)
  if (user) {
    await audit('logout', 'admin', `ออกจากระบบ: ${user.name}`, user.name)
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
