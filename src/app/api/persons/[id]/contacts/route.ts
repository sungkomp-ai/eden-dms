import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, audit } from '@/lib/auth'
import { ok, badRequest, notFound, serverError } from '@/lib/api'

export const dynamic = 'force-dynamic'

// EDEN DMS — PersonContact API (P1: G3 — ช่องทางติดต่อรายบุคคล แทน phone ตัวเดียว)
// GET  /api/persons/{id}/contacts        — รายการช่องทางติดต่อของบุคคล (เรียง priority แล้ว createdAt ใหม่→เก่า)
// POST /api/persons/{id}/contacts        — เพิ่มช่องทางติดต่อ (meta fields + audit ครบ)

const CONTACT_TYPES = ['phone', 'mobile', 'email', 'line', 'facebook', 'other'] as const

/** ตรวจว่า person มีอยู่จริงและยังไม่ถูก soft-delete */
async function findPerson(id: string) {
  return db.person.findFirst({
    where: { id, deleted: false },
    select: { id: true, firstName: true, lastName: true },
  })
}

// GET — list ช่องทางติดต่อของ person
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id } = await params
    const person = await findPerson(id)
    if (!person) return notFound()
    const contacts = await db.personContact.findMany({
      where: { personId: id, deleted: false },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
    return ok(contacts)
  } catch (e) {
    return serverError(e)
  }
}

// POST — เพิ่มช่องทางติดต่อ { type, value, priority?, isEmergency?, note? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id } = await params
    const person = await findPerson(id)
    if (!person) return notFound()
    const body = (await req.json()) as Record<string, unknown>

    const type = String(body.type ?? 'phone')
    if (!CONTACT_TYPES.includes(type as (typeof CONTACT_TYPES)[number])) {
      return badRequest('ชนิดช่องทางติดต่อไม่ถูกต้อง')
    }
    const value = String(body.value ?? '').trim()
    if (!value) return badRequest('กรุณากรอกค่าช่องทางติดต่อ')

    let priority = Number(body.priority ?? 2)
    if (!Number.isFinite(priority)) priority = 2
    priority = Math.min(3, Math.max(1, Math.trunc(priority)))
    const isEmergency = body.isEmergency === true
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    const contact = await db.personContact.create({
      data: { personId: id, type, value, priority, isEmergency, note, createdBy: auth.name, updatedBy: auth.name },
    })
    await audit(
      'create', 'persons',
      `เพิ่มช่องทางติดต่อของ ${person.firstName} ${person.lastName}: ${type} ${value}${isEmergency ? ' (ฉุกเฉิน)' : ''}`,
      auth.name,
    )
    return ok(contact, 201)
  } catch (e) {
    return serverError(e)
  }
}
