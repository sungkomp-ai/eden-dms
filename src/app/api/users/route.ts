import { NextRequest, NextResponse } from 'next/server'
import { listHandler, CrudConfig, ok, badRequest, serverError } from '@/lib/api'
import { requireUser, isResponse, hashPassword, audit } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'user',
  meta: false, // User ไม่มี meta fields กลาง
  module: 'admin',
  fields: ['email', 'name', 'role', 'status'],
  searchFields: ['name', 'email'],
  orderBy: 'createdAt',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['admin', 'coordinator', 'officer', 'volunteer']

/** ตัด passwordHash ออกก่อนส่ง user กลับผ่าน API ทุกครั้ง (ไม่เปิดเผยแฮชรหัสผ่าน) */
function sanitizeUser(u: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!u) return u
  const rest: Record<string, unknown> = { ...u }
  delete rest.passwordHash
  return rest
}

/** GET /api/users — รายชื่อผู้ใช้ (login ทุก role ดูได้) — คง listHandler (มี requireUser/ค้นหา/เรียงในตัว)
 *  แต่ดักตัด passwordHash ออกจากผลลัพธ์ */
export async function GET(req: NextRequest) {
  const res = await listHandler(req, cfg)
  if (!res.ok) return res
  const items = (await res.json()) as Record<string, unknown>[]
  return ok(Array.isArray(items) ? items.map((u) => sanitizeUser(u)) : items)
}

/** POST /api/users — เพิ่มผู้ใช้ใหม่ (เฉพาะ admin) — เขียน custom แทน createHandler
 *  เพราะต้อง hash รหัสผ่าน + ตรวจ email ซ้ำ */
export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const role = typeof body.role === 'string' && body.role ? body.role : 'officer'
    const status = body.status === 'inactive' ? 'inactive' : 'active'
    const password = typeof body.password === 'string' ? body.password : ''

    if (!name || !email) return badRequest('กรุณากรอกชื่อและอีเมล')
    if (!EMAIL_RE.test(email)) return badRequest('รูปแบบอีเมลไม่ถูกต้อง')
    if (!VALID_ROLES.includes(role)) return badRequest('บทบาทไม่ถูกต้อง')
    if (password.length < 8) return badRequest('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')

    const exists = await db.user.findUnique({ where: { email } })
    if (exists) return badRequest('อีเมลนี้ถูกใช้งานแล้ว')

    const user = await db.user.create({
      data: { email, name, role, status, passwordHash: hashPassword(password), lastLoginAt: null },
    })
    await audit('create', 'admin', `เพิ่มผู้ใช้ใหม่: ${name} (${role})`, auth.name)
    return ok(sanitizeUser(user), 201)
  } catch (e) {
    return serverError(e)
  }
}
