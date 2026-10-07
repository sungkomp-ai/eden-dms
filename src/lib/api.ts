import { NextRequest, NextResponse } from 'next/server'
import { db as prismaDb } from '@/lib/db'
import { requireUser, isResponse, SessionUser, audit } from '@/lib/auth'

export { audit }

type Db = typeof prismaDb

/**
 * EDEN DMS — generic CRUD framework (P1 upgrade)
 * - ทุก handler บังคับ login (requireUser → 401 ถ้าไม่มี session)
 * - meta fields กลาง (P1: G2): uuid/createdBy/updatedBy อัตโนมัติตอน create,
 *   updatedBy ตอน update, DELETE = soft-delete (deleted=true)
 * - list/get กรอง deleted=false อัตโนมัติ
 * - audit บันทึก userName จาก session จริง (P1: G1)
 * - โมเดลที่ไม่มี meta fields (user, auditLog) ตั้ง cfg.meta = false
 */

export interface CrudConfig {
  /** Prisma model delegate name, e.g. db.incident */
  model: keyof Db
  /** fields allowed for create/update (whitelist) */
  fields: string[]
  /** search fields for ?q= */
  searchFields?: string[]
  /** relations to include */
  include?: Record<string, unknown>
  /** order by field, default createdAt desc */
  orderBy?: string
  /** called after create — write audit log */
  module: string
  /** transform body before writing (e.g. parse dates/numbers) */
  transform?: (data: Record<string, unknown>) => Record<string, unknown>
  /** model มี meta fields กลางหรือไม่ (default true; user/auditLog = false) */
  meta?: boolean
}

function numFields(cfg: CrudConfig, data: Record<string, unknown>) {
  if (cfg.transform) return cfg.transform(data)
  return data
}

export function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 })
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function notFound() {
  return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
}

export function serverError(e: unknown) {
  console.error('[API]', e)
  return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
}

/** บังคับ login ทุก mutation/list — คืน user หรือ 401 response */
function authOrResponse(req: NextRequest): SessionUser | NextResponse {
  return requireUser(req)
}

/** GET list with ?q= search */
export async function listHandler(req: NextRequest, cfg: CrudConfig) {
  const auth = authOrResponse(req)
  if (isResponse(auth)) return auth
  try {
    const model = prismaDb[cfg.model] as unknown as {
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>
    }
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim()
    const where: Record<string, unknown> = {}
    if (cfg.meta !== false) where.deleted = false
    if (q && cfg.searchFields?.length) {
      where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: q } }))
    }
    const items = await model.findMany({
      where,
      include: cfg.include,
      orderBy: { [cfg.orderBy ?? 'createdAt']: 'desc' },
    })
    return ok(items)
  } catch (e) {
    return serverError(e)
  }
}

/** POST create */
export async function createHandler(req: NextRequest, cfg: CrudConfig) {
  const auth = authOrResponse(req)
  if (isResponse(auth)) return auth
  try {
    const body = (await req.json()) as Record<string, unknown>
    const data: Record<string, unknown> = {}
    for (const f of cfg.fields) {
      if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
        data[f] = body[f]
      }
    }
    if (cfg.fields.some((f) => f === 'id') === false && Object.keys(data).length === 0) {
      return badRequest('กรุณากรอกข้อมูลให้ครบถ้วน')
    }
    if (cfg.meta !== false) {
      data.createdBy = auth.name
      data.updatedBy = auth.name
    }
    const model = prismaDb[cfg.model] as unknown as {
      create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const item = await model.create({ data: numFields(cfg, data), include: cfg.include })
    await audit('create', cfg.module, `สร้างข้อมูลใหม่ใน ${cfg.module}`, auth.name)
    return ok(item, 201)
  } catch (e) {
    return serverError(e)
  }
}

/** GET one by id */
export async function getHandler(req: NextRequest, cfg: CrudConfig, id: string) {
  const auth = authOrResponse(req)
  if (isResponse(auth)) return auth
  try {
    const model = prismaDb[cfg.model] as unknown as {
      findFirst: (args: Record<string, unknown>) => Promise<unknown>
    }
    const where: Record<string, unknown> = { id }
    if (cfg.meta !== false) where.deleted = false
    const item = await model.findFirst({ where, include: cfg.include })
    if (!item) return notFound()
    return ok(item)
  } catch (e) {
    return serverError(e)
  }
}

/** PUT update */
export async function updateHandler(req: NextRequest, cfg: CrudConfig, id: string) {
  const auth = authOrResponse(req)
  if (isResponse(auth)) return auth
  try {
    const body = (await req.json()) as Record<string, unknown>
    const data: Record<string, unknown> = {}
    for (const f of cfg.fields) {
      if (body[f] !== undefined) data[f] = body[f]
    }
    if (cfg.meta !== false) {
      data.updatedBy = auth.name
    }
    const model = prismaDb[cfg.model] as unknown as {
      findFirst: (args: Record<string, unknown>) => Promise<unknown>
      update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    // ไม่ให้แก้แถวที่ถูก soft-delete ไปแล้ว
    const where: Record<string, unknown> = { id }
    if (cfg.meta !== false) where.deleted = false
    const existing = await model.findFirst({ where })
    if (!existing) return notFound()
    const item = await model.update({ where: { id }, data: numFields(cfg, data), include: cfg.include })
    await audit('update', cfg.module, `อัปเดตข้อมูล ${cfg.module}`, auth.name)
    return ok(item)
  } catch (e) {
    return serverError(e)
  }
}

/** DELETE — soft-delete (meta models) เก็บร่องรอยตามหลัก Eden (P1: G2) */
export async function deleteHandler(req: NextRequest, cfg: CrudConfig, id: string) {
  const auth = authOrResponse(req)
  if (isResponse(auth)) return auth
  try {
    const model = prismaDb[cfg.model] as unknown as {
      findFirst: (args: Record<string, unknown>) => Promise<unknown>
      update: (args: Record<string, unknown>) => Promise<unknown>
      delete: (args: Record<string, unknown>) => Promise<unknown>
    }
    const where: Record<string, unknown> = { id }
    if (cfg.meta !== false) where.deleted = false
    const existing = await model.findFirst({ where })
    if (!existing) return notFound()
    if (cfg.meta !== false) {
      await model.update({ where: { id }, data: { deleted: true, updatedBy: auth.name } })
    } else {
      await model.delete({ where: { id } })
    }
    await audit('delete', cfg.module, `ลบข้อมูล ${cfg.module} (soft-delete)`, auth.name)
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}


