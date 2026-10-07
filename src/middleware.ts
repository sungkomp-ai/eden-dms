import { NextRequest, NextResponse } from 'next/server'

/**
 * EDEN DMS — page-level auth gate
 * ไม่มี session cookie → หน้า page redirect ไป /login, API ตอบ 401 JSON
 * การยืนยันลายเซ็นจริงเกิดที่ API layer (src/lib/auth.ts verifySession) — middleware เป็น UX gate
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (req.cookies.get('eden_session')?.value) return NextResponse.next()

  const isLoginPage = pathname === '/login'
  const isAuthApi = pathname.startsWith('/api/auth/')
  const isStatic = pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname.startsWith('/images')

  if (isLoginPage || isAuthApi || isStatic) return NextResponse.next()

  // API ที่ไม่ใช่ auth → 401 JSON (ไม่ redirect เพราะ fetch จะตาม redirect แล้วได้ HTML กลับมา)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
