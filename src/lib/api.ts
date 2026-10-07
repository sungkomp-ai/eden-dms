import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { db as prismaDb } from '@/lib/db'

type Db = typeof prismaDb

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

async function audit(action: string, module: string, detail: string, userName = 'ผู้ดูแลระบบกลาง') {
  try {
    await prismaDb.auditLog.create({ data: { action, module, detail, userName } })
  } catch (e) {
    console.error('[audit]', e)
  }
}

/** GET list with ?q= search */
export async function listHandler(req: NextRequest, cfg: CrudConfig) {
  try {
    const model = prismaDb[cfg.model] as unknown as {
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>
    }
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim()
    const where: Record<string, unknown> = {}
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
    const model = prismaDb[cfg.model] as unknown as {
      create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const item = await model.create({ data: numFields(cfg, data), include: cfg.include })
    await audit('create', cfg.module, `สร้างข้อมูลใหม่ใน ${cfg.module}`)
    return ok(item, 201)
  } catch (e) {
    return serverError(e)
  }
}

/** GET one by id */
export async function getHandler(cfg: CrudConfig, id: string) {
  try {
    const model = prismaDb[cfg.model] as unknown as {
      findUnique: (args: Record<string, unknown>) => Promise<unknown>
    }
    const item = await model.findUnique({ where: { id }, include: cfg.include })
    if (!item) return notFound()
    return ok(item)
  } catch (e) {
    return serverError(e)
  }
}

/** PUT update */
export async function updateHandler(req: NextRequest, cfg: CrudConfig, id: string) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const data: Record<string, unknown> = {}
    for (const f of cfg.fields) {
      if (body[f] !== undefined) data[f] = body[f]
    }
    const model = prismaDb[cfg.model] as unknown as {
      update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    }
    const item = await model.update({ where: { id }, data: numFields(cfg, data), include: cfg.include })
    await audit('update', cfg.module, `อัปเดตข้อมูล ${cfg.module}`)
    return ok(item)
  } catch (e) {
    return serverError(e)
  }
}

/** DELETE */
export async function deleteHandler(cfg: CrudConfig, id: string) {
  try {
    const model = prismaDb[cfg.model] as unknown as {
      delete: (args: Record<string, unknown>) => Promise<unknown>
    }
    await model.delete({ where: { id } })
    await audit('delete', cfg.module, `ลบข้อมูล ${cfg.module}`)
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}

export { audit }
export type { PrismaClient }
