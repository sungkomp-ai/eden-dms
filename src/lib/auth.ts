import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * EDEN DMS — ระบบยืนยันตัวตน (P1: G1 — accountability)
 * - password: scrypt (salt:hash) — ไม่พึ่ง dependency ภายนอก
 * - session: token แบบ HMAC-SHA256 ใน httpOnly cookie (12 ชม.)
 * - ใช้กับ route handler ผ่าน requireUser() / getSessionUser()
 */

const SECRET = process.env.SESSION_SECRET || 'eden-dms-dev-secret-change-in-production'
export const SESSION_COOKIE = 'eden_session'
export const SESSION_TTL_SEC = 12 * 60 * 60 // 12 ชั่วโมง

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

// ---------- password ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored?: string | null): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const candidate = scryptSync(password, salt, 64)
  let expected: Buffer
  try {
    expected = Buffer.from(hash, 'hex')
  } catch {
    return false
  }
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

// ---------- session token ----------

export function signSession(user: SessionUser): string {
  const payload = { ...user, exp: Date.now() + SESSION_TTL_SEC * 1000 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token?: string | null): SessionUser | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionUser & { exp?: number }
    if (!payload.exp || payload.exp < Date.now()) return null
    return { id: payload.id, email: payload.email, name: payload.name, role: payload.role }
  } catch {
    return null
  }
}

// ---------- request helpers ----------

export function getSessionUser(req: NextRequest): SessionUser | null {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value)
}

/** คืน SessionUser หรือ NextResponse(401) — ใช้ร่วมกับ isResponse():
 *  const auth = requireUser(req); if (isResponse(auth)) return auth; */
export function requireUser(req: NextRequest): SessionUser | NextResponse {
  const user = getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  return user
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse
}

/** บันทึก Audit Log (P1: G1) — ใช้จากทุก route; api.ts re-export ให้ด้วย */
export async function audit(action: string, module: string, detail: string, userName = 'system') {
  try {
    await db.auditLog.create({ data: { action, module, detail, userName } })
  } catch (e) {
    console.error('[audit]', e)
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SEC,
  secure: process.env.NODE_ENV === 'production',
}
