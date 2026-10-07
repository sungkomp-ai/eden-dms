import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, audit } from '@/lib/auth'
import { ok, badRequest, notFound, serverError } from '@/lib/api'

export const dynamic = 'force-dynamic'

// EDEN DMS — PersonEvent API (P1: G3 — presence trail เทียบ pr_presence ของ Eden)
// GET  /api/persons/{id}/events — ประวัติการพบตัว เรียงเวลาเกิดเหตุใหม่→เก่า
// POST /api/persons/{id}/events — บันทึกเหตุการณ์ + อัปเดต Person.status ให้ตรงกัน
//                                (ทำใน $transaction เดียวกัน — event กับสถานะต้องสอดคล้องเสมอ)

const EVENT_STATUSES = [
  'missing', 'sighted', 'found', 'safe', 'injured', 'hospitalized', 'deceased', 'evacuated', 'transferred',
] as const

/** event status → Person.status (Person รองรับ 6 สถานะตาม PERSON_STATUS) */
const STATUS_TO_PERSON: Record<(typeof EVENT_STATUSES)[number], string> = {
  missing: 'missing',
  sighted: 'missing',
  found: 'found',
  safe: 'safe',
  injured: 'injured',
  hospitalized: 'injured',
  deceased: 'deceased',
  evacuated: 'evacuated',
  transferred: 'evacuated',
}

/** ตรวจว่า person มีอยู่จริงและยังไม่ถูก soft-delete */
async function findPerson(id: string) {
  return db.person.findFirst({
    where: { id, deleted: false },
    select: { id: true, firstName: true, lastName: true, status: true },
  })
}

// GET — list เหตุการณ์ของ person (occurredAt ใหม่→เก่า)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id } = await params
    const person = await findPerson(id)
    if (!person) return notFound()
    const events = await db.personEvent.findMany({
      where: { personId: id, deleted: false },
      orderBy: { occurredAt: 'desc' },
    })
    return ok(events)
  } catch (e) {
    return serverError(e)
  }
}

// POST — บันทึกเหตุการณ์ { status, note?, location?, observer?, occurredAt? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id } = await params
    const person = await findPerson(id)
    if (!person) return notFound()
    const body = (await req.json()) as Record<string, unknown>

    const status = String(body.status ?? '')
    if (!EVENT_STATUSES.includes(status as (typeof EVENT_STATUSES)[number])) {
      return badRequest('สถานะเหตุการณ์ไม่ถูกต้อง')
    }

    const opt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const note = opt(body.note)
    const location = opt(body.location)
    const observer = opt(body.observer)

    let occurredAt = new Date()
    if (body.occurredAt) {
      const d = new Date(String(body.occurredAt))
      if (isNaN(d.getTime())) return badRequest('รูปแบบวันเวลาไม่ถูกต้อง')
      occurredAt = d
    }

    const personStatus = STATUS_TO_PERSON[status as (typeof EVENT_STATUSES)[number]]

    // event + สถานะบุคคลต้องเขียนพร้อมกัน (transaction เดียว — กันเหตุการณ์ค้างไม่มีการอัปเดตสถานะ)
    const [event] = await db.$transaction([
      db.personEvent.create({
        data: { personId: id, status, note, location, observer, occurredAt, createdBy: auth.name },
      }),
      db.person.update({
        where: { id },
        data: { status: personStatus, updatedBy: auth.name },
      }),
    ])

    await audit(
      'create', 'persons',
      `บันทึกเหตุการณ์การพบตัวของ ${person.firstName} ${person.lastName}: ${status}${location ? ` ที่ ${location}` : ''}`,
      auth.name,
    )
    await audit(
      'update', 'persons',
      `อัปเดตสถานะจาก presence trail: ${person.firstName} ${person.lastName} ${person.status} → ${personStatus}`,
      auth.name,
    )
    return ok(event, 201)
  } catch (e) {
    return serverError(e)
  }
}
