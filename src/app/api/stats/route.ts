import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const [
      incidents,
      activeIncidents,
      persons,
      missingPersons,
      shelters,
      inventory,
      requests,
      pendingRequests,
      organizations,
      hr,
      alerts,
      reports,
    ] = await Promise.all([
      db.incident.findMany({ select: { id: true, code: true, title: true, type: true, severity: true, status: true, affectedPeople: true, injured: true, deceased: true, startDate: true, locationName: true, lat: true, lng: true } }),
      db.incident.count({ where: { status: { in: ['active', 'monitoring'] } } }),
      db.person.findMany({ select: { status: true, gender: true, age: true } }),
      db.person.count({ where: { status: 'missing' } }),
      db.shelter.findMany({ select: { id: true, name: true, capacity: true, currentOccupancy: true, status: true, lat: true, lng: true, type: true } }),
      db.inventoryItem.findMany({ select: { name: true, category: true, quantity: true, minQuantity: true, unit: true } }),
      db.aidRequest.findMany({ select: { id: true, type: true, priority: true, status: true, createdAt: true } }),
      db.aidRequest.count({ where: { status: 'pending' } }),
      db.organization.count(),
      db.humanResource.findMany({ select: { status: true, type: true } }),
      db.alert.count({ where: { status: { in: ['draft', 'scheduled'] } } }),
      db.incidentReport.count(),
    ])

    // สรุปตัวเลข KPI
    const totals = {
      activeIncidents,
      affectedPeople: incidents.filter((i) => i.status !== 'closed').reduce((s, i) => s + i.affectedPeople, 0),
      missingPersons,
      sheltersOpen: shelters.filter((s) => s.status === 'open' || s.status === 'full').length,
      shelterCapacity: shelters.reduce((s, x) => s + x.capacity, 0),
      shelterOccupancy: shelters.reduce((s, x) => s + x.currentOccupancy, 0),
      pendingRequests,
      volunteers: hr.filter((h) => h.type === 'volunteer' && h.status !== 'unavailable').length,
      onMission: hr.filter((h) => h.status === 'on_mission').length,
      lowStock: inventory.filter((i) => i.quantity <= i.minQuantity).length,
      inventoryItems: inventory.reduce((s, i) => s + i.quantity, 0),
      draftAlerts: alerts,
      reports,
    }

    // เหตุการณ์แยกตามประเภท
    const byType: Record<string, number> = {}
    incidents.forEach((i) => { byType[i.type] = (byType[i.type] ?? 0) + 1 })

    // เหตุการณ์แยกตามสถานะ
    const byStatus: Record<string, number> = {}
    incidents.forEach((i) => { byStatus[i.status] = (byStatus[i.status] ?? 0) + 1 })

    // ผู้ประสบภัยแยกตามสถานะ
    const personsByStatus: Record<string, number> = {}
    persons.forEach((p) => { personsByStatus[p.status] = (personsByStatus[p.status] ?? 0) + 1 })

    // คำขอแยกตามสถานะ
    const requestsByStatus: Record<string, number> = {}
    requests.forEach((r) => { requestsByStatus[r.status] = (requestsByStatus[r.status] ?? 0) + 1 })

    // บุคลากรแยกตามสถานะ
    const hrByStatus: Record<string, number> = {}
    hr.forEach((h) => { hrByStatus[h.status] = (hrByStatus[h.status] ?? 0) + 1 })

    // กราฟแนวโน้ม 7 วัน: จำนวนผู้ประสบภัยสะสมจากเหตุการณ์ที่เริ่มในแต่ละวัน + คำขอ
    const now = new Date()
    const trend: { date: string; affected: number; requests: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 86400000)
      const key = day.toISOString().slice(0, 10)
      const affected = incidents
        .filter((inc) => inc.startDate.toISOString().slice(0, 10) <= key && inc.startDate.toISOString().slice(0, 10) >= new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10))
        .reduce((s, inc) => s + Math.round(inc.affectedPeople / 8), 0)
      const dayRequests = requests.filter((r) => r.createdAt.toISOString().slice(0, 10) === key).length
      trend.push({ date: key, affected, requests: dayRequests })
    }

    // คลังสินค้าแยกตามหมวด
    const invByCategory: Record<string, number> = {}
    inventory.forEach((i) => { invByCategory[i.category] = (invByCategory[i.category] ?? 0) + i.quantity })

    return NextResponse.json({
      totals,
      incidents,
      byType,
      byStatus,
      personsByStatus,
      requestsByStatus,
      hrByStatus,
      invByCategory,
      trend,
      shelters,
    })
  } catch (e) {
    console.error('[stats]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}
