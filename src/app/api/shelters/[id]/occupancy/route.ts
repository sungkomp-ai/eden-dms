import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, audit } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * EDEN DMS — Shelter occupancy ledger (P1: G4, เทียบ cr_shelter_occupancy ของ Eden)
 * GET  /api/shelters/{id}/occupancy — ประวัติเข้า-ออกล่าสุด 100 รายการ (ใหม่ → เก่า)
 * POST /api/shelters/{id}/occupancy — บันทึกเข้า(+)/ออก(-) แบบ transaction:
 *   log + อัปเดต currentOccupancy + ปรับสถานะอัตโนมัติ (เต็มความจุ → full / มีที่ว่าง → open)
 */

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// GET — รายการบันทึกผู้อพยพเข้า-ออกของศูนย์พักพิง
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id } = await params
    const logs = await db.shelterOccupancy.findMany({
      where: { shelterId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(logs)
  } catch (e) {
    console.error('[API shelter occupancy GET]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}

// POST — บันทึกการรับเข้า/ย้ายออกของผู้อพยพ
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { delta?: unknown; note?: unknown }

    const delta = Number(body.delta)
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      return NextResponse.json({ error: 'จำนวนไม่ถูกต้อง' }, { status: 400 })
    }
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    const result = await db.$transaction(async (tx) => {
      // (1) หา shelter (ไม่เอาตัวที่ถูก soft-delete)
      const shelter = await tx.shelter.findFirst({ where: { id, deleted: false } })
      if (!shelter) throw new HttpError(404, 'ไม่พบศูนย์พักพิง')

      // (2) คำนวณยอดรวมใหม่ — ห้ามติดลบ
      const newCount = shelter.currentOccupancy + delta
      if (newCount < 0) throw new HttpError(400, 'จำนวนไม่ถูกต้อง')

      // (3) สร้าง log (ledger) — เก็บยอดรวมหลังรายการ
      const log = await tx.shelterOccupancy.create({
        data: {
          shelterId: shelter.id,
          delta,
          count: newCount,
          note,
          createdBy: auth.name,
        },
      })

      // (4) อัปเดตยอดปัจจุบัน + ปรับสถานะอัตโนมัติ
      let status = shelter.status
      if (shelter.capacity > 0 && newCount >= shelter.capacity) status = 'full'
      else if (status === 'full' && newCount < shelter.capacity) status = 'open'

      const updated = await tx.shelter.update({
        where: { id: shelter.id },
        data: { currentOccupancy: newCount, status, updatedBy: auth.name },
      })

      return { log, shelter: updated }
    })

    // (5) audit
    await audit(
      'update',
      'shelters',
      `บันทึกเข้า-ออกพักพิง ${result.shelter.name}: ${delta > 0 ? '+' : ''}${delta} → ${result.shelter.currentOccupancy} คน`,
      auth.name,
    )

    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[API shelter occupancy POST]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}
