import { NextRequest, NextResponse } from 'next/server'
import { getHandler, CrudConfig, ok, badRequest, notFound, serverError } from '@/lib/api'
import { requireUser, isResponse, hashPassword, audit } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const cfg: CrudConfig = {
  model: 'user',
  meta: false, // User ไม่มี meta fields กลาง
  module: 'admin',
  fields: ['email', 'name', 'role', 'status'],
}

const VALID_ROLES = ['admin', 'coordinator', 'officer', 'volunteer']
const VALID_STATUS = ['active', 'inactive']

/** ตัด passwordHash ออกก่อนส่ง user กลับผ่าน API ทุกครั้ง (ไม่เปิดเผยแฮชรหัสผ่าน) */
function sanitizeUser(u: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!u) return u
  const rest: Record<string, unknown> = { ...u }
  delete rest.passwordHash
  return rest
}

/** GET /api/users/[id] — ดูข้อมูลผู้ใช้รายคน — คง getHandler แต่ดักตัด passwordHash ออก */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getHandler(req, cfg, id)
  if (!res.ok) return res
  const user = (await res.json()) as Record<string, unknown>
  return ok(sanitizeUser(user))
}

/** PUT /api/users/[id] — แก้ไขข้อมูล / รีเซ็ตรหัสผ่าน (เฉพาะ admin) — เขียน custom แทน updateHandler */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return notFound()

    const data: { name?: string; role?: string; status?: string; passwordHash?: string } = {}

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return badRequest('กรุณาระบุชื่อ')
      data.name = name
    }
    if (body.role !== undefined) {
      if (typeof body.role !== 'string' || !VALID_ROLES.includes(body.role)) {
        return badRequest('บทบาทไม่ถูกต้อง')
      }
      data.role = body.role
    }
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !VALID_STATUS.includes(body.status)) {
        return badRequest('สถานะไม่ถูกต้อง')
      }
      data.status = body.status
    }
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return badRequest('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      }
      data.passwordHash = hashPassword(body.password)
    }

    if (Object.keys(data).length === 0) return badRequest('ไม่มีข้อมูลที่ต้องการแก้ไข')

    // ไม่ส่ง role/status มา → คงค่าเดิม (สร้าง data เฉพาะ field ที่ส่งมาแล้ว)
    const user = await db.user.update({ where: { id }, data })
    const resetPassword = data.passwordHash !== undefined
    await audit(
      'update',
      'admin',
      resetPassword
        ? `รีเซ็ตรหัสผ่านผู้ใช้: ${user.name} (${user.email})`
        : `แก้ไขข้อมูลผู้ใช้: ${user.name} (${user.email})`,
      auth.name,
    )
    return ok(sanitizeUser(user))
  } catch (e) {
    return serverError(e)
  }
}

/** DELETE /api/users/[id] — ลบบัญชีผู้ใช้จริง (เฉพาะ admin, ห้ามลบตัวเอง, User ไม่มี soft-delete) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  }
  try {
    if (id === auth.id) return badRequest('ไม่สามารถลบบัญชีตัวเองได้')
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return notFound()
    await db.user.delete({ where: { id } })
    await audit('delete', 'admin', `ลบผู้ใช้: ${existing.name} (${existing.email})`, auth.name)
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}
