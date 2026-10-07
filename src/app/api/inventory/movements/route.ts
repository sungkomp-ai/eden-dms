import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, isResponse, audit } from '@/lib/auth'
import { toCsv } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * EDEN DMS — Stock movement ledger (P1: G4, เทียบ inv_recv/inv_send ของ Eden)
 * GET  /api/inventory/movements?itemId=&warehouseId=&type= — ประวัติล่าสุด 200 รายการ
 *      ?format=csv — ส่งออกไฟล์รายงาน CSV (คอลัมน์ภาษาไทย เปิดใน Excel ได้)
 * POST /api/inventory/movements — รับเข้า(receive)/เบิกจ่าย(issue)/โอนย้าย(transfer)/ปรับยอด(adjust)
 *   ทุกประเภทอัปเดต item.quantity + สร้าง movement ใน $transaction เดียวกัน
 *   และสร้าง Alert (ฉบับร่าง) อัตโนมัติเมื่อสต๊อกหลังรายการต่ำกว่า/เท่าจุดขั้นต่ำ
 */

const VALID_TYPES = ['receive', 'issue', 'transfer', 'adjust'] as const
type MovementType = (typeof VALID_TYPES)[number]

const TYPE_LABEL: Record<MovementType, string> = {
  receive: 'รับเข้า',
  issue: 'เบิกจ่าย',
  transfer: 'โอนย้าย',
  adjust: 'ปรับยอด',
}

const MOVEMENT_INCLUDE = {
  item: { select: { name: true, unit: true } },
  fromWarehouse: { select: { name: true } },
  toWarehouse: { select: { name: true } },
} as const

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// GET — รายการเคลื่อนไหวสต๊อก (กรองตาม itemId / warehouseId / type ได้)
export async function GET(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const url = new URL(req.url)
    const itemId = url.searchParams.get('itemId')?.trim() || null
    const warehouseId = url.searchParams.get('warehouseId')?.trim() || null
    const type = url.searchParams.get('type')?.trim() || null

    if (type && !VALID_TYPES.includes(type as MovementType)) {
      return NextResponse.json({ error: 'ชนิดรายการไม่ถูกต้อง' }, { status: 400 })
    }

    const where: {
      itemId?: string
      type?: string
      OR?: Array<{ fromWarehouseId: string } | { toWarehouseId: string }>
    } = {}
    if (itemId) where.itemId = itemId
    if (type) where.type = type
    if (warehouseId) {
      where.OR = [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }]
    }

    const movements = await db.stockMovement.findMany({
      where,
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // CSV export — flatten ชื่อ relation (ไม่แสดง id เปล่า ๆ) คอลัมน์: เวลา/ชนิด/สินค้า/จำนวน/จาก/ถึง/อ้างอิง/โดย
    if (url.searchParams.get('format') === 'csv') {
      return toCsv(
        movements.map((m) => ({
          'เวลา': m.createdAt,
          'ชนิด': TYPE_LABEL[m.type as MovementType] ?? m.type,
          'สินค้า': m.item?.name ?? '',
          'จำนวน': m.quantity,
          'จาก': m.fromWarehouse?.name ?? '',
          'ถึง': m.toWarehouse?.name ?? '',
          'อ้างอิง': m.reference ?? '',
          'โดย': m.createdBy ?? '',
        })),
        'inventory-movements',
      )
    }

    return NextResponse.json(movements)
  } catch (e) {
    console.error('[API inventory movements GET]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}

// POST — บันทึกการเคลื่อนไหวสต๊อก
export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : ''
    const type = typeof body.type === 'string' ? body.type.trim() : ''
    const reference =
      typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null
    const toWarehouseId =
      typeof body.toWarehouseId === 'string' && body.toWarehouseId.trim()
        ? body.toWarehouseId.trim()
        : null

    if (!VALID_TYPES.includes(type as MovementType)) {
      return NextResponse.json({ error: 'ชนิดรายการไม่ถูกต้อง' }, { status: 400 })
    }
    const mvType = type as MovementType

    const quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity === 0) {
      return NextResponse.json({ error: 'จำนวนไม่ถูกต้อง' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      // ตรวจสินค้า (ไม่เอาตัวที่ถูก soft-delete)
      const item = await tx.inventoryItem.findFirst({ where: { id: itemId, deleted: false } })
      if (!item) throw new HttpError(404, 'ไม่พบสินค้า')

      let fromWarehouseId: string | null = null
      let toWarehouse: string | null = null
      let newQuantity = item.quantity
      let detailExtra = ''

      if (mvType === 'receive') {
        // รับเข้า — จำนวนต้องเป็นบวก; ปลายทาง = คลังที่ระบุ หรือคลังปัจจุบันของสินค้า
        if (quantity <= 0) throw new HttpError(400, 'จำนวนไม่ถูกต้อง')
        toWarehouse = toWarehouseId ?? item.warehouseId
        if (toWarehouse) {
          const wh = await tx.warehouse.findFirst({ where: { id: toWarehouse, deleted: false } })
          if (!wh) throw new HttpError(400, 'ไม่พบคลังปลายทาง')
        }
        newQuantity = item.quantity + quantity
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantity: newQuantity,
            ...(toWarehouse ? { warehouseId: toWarehouse } : {}),
            updatedBy: auth.name,
          },
        })
        detailExtra = toWarehouse ? ` (คลัง ${toWarehouse})` : ''
      } else if (mvType === 'issue') {
        // เบิกจ่าย — จำนวนต้องเป็นบวก; หักจากคลังปัจจุบัน ห้ามติดลบ
        if (quantity <= 0) throw new HttpError(400, 'จำนวนไม่ถูกต้อง')
        fromWarehouseId = item.warehouseId
        newQuantity = item.quantity - quantity
        if (newQuantity < 0) {
          throw new HttpError(400, `สต๊อกไม่พอ (คงเหลือ ${item.quantity})`)
        }
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: newQuantity, updatedBy: auth.name },
        })
        detailExtra = fromWarehouseId ? ` (คลัง ${fromWarehouseId})` : ''
      } else if (mvType === 'transfer') {
        // โอนย้าย — ต้องระบุคลังปลายทางที่ต่างจากคลังปัจจุบัน; จำนวนคงเดิม
        if (quantity <= 0) throw new HttpError(400, 'จำนวนไม่ถูกต้อง')
        if (!toWarehouseId) throw new HttpError(400, 'กรุณาเลือกคลังปลายทาง')
        if (toWarehouseId === item.warehouseId) {
          throw new HttpError(400, 'คลังปลายทางต้องไม่ใช่คลังปัจจุบันของสินค้า')
        }
        const wh = await tx.warehouse.findFirst({ where: { id: toWarehouseId, deleted: false } })
        if (!wh) throw new HttpError(400, 'ไม่พบคลังปลายทาง')
        fromWarehouseId = item.warehouseId
        toWarehouse = toWarehouseId
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { warehouseId: toWarehouseId, updatedBy: auth.name },
        })
        detailExtra = fromWarehouseId ? ` (จาก ${fromWarehouseId} → ${toWarehouseId})` : ` (→ ${toWarehouseId})`
      } else {
        // ปรับยอด — บวก/ลบได้ (signed delta); หลังปรับห้ามติดลบ
        newQuantity = item.quantity + quantity
        if (newQuantity < 0) throw new HttpError(400, 'จำนวนไม่ถูกต้อง')
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: newQuantity, updatedBy: auth.name },
        })
        detailExtra = ` (คงเหลือ ${newQuantity})`
      }

      // สร้าง movement — adjust เก็บค่า signed ตามจริง, ชนิดอื่นเก็บค่าสัมบูรณ์
      const movement = await tx.stockMovement.create({
        data: {
          itemId: item.id,
          type: mvType,
          quantity: mvType === 'adjust' ? quantity : Math.abs(quantity),
          fromWarehouseId,
          toWarehouseId: toWarehouse,
          reference,
          note,
          createdBy: auth.name,
        },
        include: MOVEMENT_INCLUDE,
      })

      // Low-stock alert — ก่อนรายการอยู่เหนือจุดขั้นต่ำ แต่หลังรายการต่ำกว่า/เท่ากับ
      let lowStockAlert = false
      if (item.quantity > item.minQuantity && newQuantity <= item.minQuantity) {
        const finalWarehouseId = mvType === 'receive' ? (toWarehouse ?? item.warehouseId) : item.warehouseId
        const wh = finalWarehouseId
          ? await tx.warehouse.findUnique({ where: { id: finalWarehouseId } })
          : null
        await tx.alert.create({
          data: {
            title: `⚠️ สต๊อกใกล้หมด: ${item.name}`,
            message: `คงเหลือ ${newQuantity} ${item.unit} (จุดขั้นต่ำ ${item.minQuantity} ${item.unit})${
              wh ? ` · คลัง ${wh.name}` : ''
            } — จากรายการ${TYPE_LABEL[mvType]}ล่าสุด${reference ? ` (อ้างอิง: ${reference})` : ''}`,
            channel: 'broadcast',
            severity: 'warning',
            audience: 'all',
            status: 'draft',
            createdBy: auth.name,
          },
        })
        lowStockAlert = true
      }

      return {
        movement,
        quantity: newQuantity,
        lowStockAlert,
        fromWarehouseId,
        toWarehouseId: toWarehouse,
        item,
      }
    })

    // audit — module inventory (รายละเอียดอ่านง่าย: ชื่อคลังไม่ใช่ id)
    const nameOf = async (wid: string | null) =>
      wid ? (await db.warehouse.findUnique({ where: { id: wid } }))?.name ?? wid : null
    let detail: string
    if (mvType === 'receive') {
      const toName = await nameOf(result.toWarehouseId)
      detail = `รับเข้า ${result.item.name} +${Math.abs(quantity)} ${result.item.unit}${toName ? ` (คลัง ${toName})` : ''}${reference ? ` [อ้างอิง: ${reference}]` : ''}`
    } else if (mvType === 'issue') {
      const fromName = await nameOf(result.fromWarehouseId)
      detail = `เบิกจ่าย ${result.item.name} -${Math.abs(quantity)} ${result.item.unit}${fromName ? ` (คลัง ${fromName})` : ''}${reference ? ` [อ้างอิง: ${reference}]` : ''}`
    } else if (mvType === 'transfer') {
      const fromName = await nameOf(result.fromWarehouseId)
      const toName = await nameOf(result.toWarehouseId)
      detail = `โอนย้าย ${result.item.name} ${Math.abs(quantity)} ${result.item.unit} จาก${fromName ? ` ${fromName}` : 'ไม่ระบุ'} → ${toName ?? 'ไม่ระบุ'}`
    } else {
      detail = `ปรับยอด ${result.item.name} ${quantity > 0 ? '+' : ''}${quantity} ${result.item.unit} (คงเหลือ ${result.quantity})`
    }
    await audit('create', 'inventory', detail, auth.name)
    if (result.lowStockAlert) {
      await audit('create', 'alerts', `สร้างฉบับร่างแจ้งเตือนสต๊อกใกล้หมด: ${result.item.name} (คงเหลือ ${result.quantity} ${result.item.unit})`, auth.name)
    }

    return NextResponse.json(
      { movement: result.movement, quantity: result.quantity, lowStockAlert: result.lowStockAlert },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[API inventory movements POST]', e)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์' }, { status: 500 })
  }
}
