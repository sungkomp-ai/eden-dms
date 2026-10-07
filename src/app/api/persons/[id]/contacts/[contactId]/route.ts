import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, audit } from '@/lib/auth'
import { ok, badRequest, notFound, serverError } from '@/lib/api'

export const dynamic = 'force-dynamic'

// EDEN DMS — PersonContact API (รายการเดียว)
// PUT    /api/persons/{id}/contacts/{contactId} — แก้ไขช่องทางติดต่อ
// DELETE /api/persons/{id}/contacts/{contactId} — ลบแบบ soft-delete (deleted=true — ห้ามลบจริง ตามหลัก Eden)
// ทั้งสอง handler ตรวจก่อนว่า contact เป็นลูกของ person id นี้จริง ไม่ใช่ → 404

const CONTACT_TYPES = ['phone', 'mobile', 'email', 'line', 'facebook', 'other'] as const

/** หา contact ที่เป็นลูกของ person นี้จริงเท่านั้น (id + personId + ยังไม่ถูกลบ) */
function findContact(personId: string, contactId: string) {
  return db.personContact.findFirst({
    where: { id: contactId, personId, deleted: false },
  })
}

// PUT — แก้ไข { type?, value?, priority?, isEmergency?, note? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id, contactId } = await params
    const existing = await findContact(id, contactId)
    if (!existing) return notFound()
    const body = (await req.json()) as Record<string, unknown>

    const data: Record<string, unknown> = { updatedBy: auth.name }
    if (body.type !== undefined) {
      const type = String(body.type)
      if (!CONTACT_TYPES.includes(type as (typeof CONTACT_TYPES)[number])) {
        return badRequest('ชนิดช่องทางติดต่อไม่ถูกต้อง')
      }
      data.type = type
    }
    if (body.value !== undefined) {
      const value = String(body.value ?? '').trim()
      if (!value) return badRequest('กรุณากรอกค่าช่องทางติดต่อ')
      data.value = value
    }
    if (body.priority !== undefined) {
      let priority = Number(body.priority)
      if (!Number.isFinite(priority)) priority = 2
      data.priority = Math.min(3, Math.max(1, Math.trunc(priority)))
    }
    if (body.isEmergency !== undefined) data.isEmergency = body.isEmergency === true
    if (body.note !== undefined) {
      data.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null
    }

    const contact = await db.personContact.update({ where: { id: contactId }, data })
    await audit(
      'update', 'persons',
      `แก้ไขช่องทางติดต่อของบุคคล: ${contact.type} ${contact.value}`,
      auth.name,
    )
    return ok(contact)
  } catch (e) {
    return serverError(e)
  }
}

// DELETE — soft-delete เก็บร่องรอยตามหลัก Eden (meta fields: deleted + updatedBy)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id, contactId } = await params
    const existing = await findContact(id, contactId)
    if (!existing) return notFound()
    await db.personContact.update({
      where: { id: contactId },
      data: { deleted: true, updatedBy: auth.name },
    })
    await audit(
      'delete', 'persons',
      `ลบช่องทางติดต่อของบุคคล: ${existing.type} ${existing.value} (soft-delete)`,
      auth.name,
    )
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}
