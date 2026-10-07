import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, serverError, audit } from '@/lib/api'

export const dynamic = 'force-dynamic'

// ==========================================
// GIS — จัดการชั้นข้อมูลรายชิ้น
// PATCH  /api/map-layers/[id] → อัปเดต (visible/name/color)
// DELETE /api/map-layers/[id] → ลบชั้นข้อมูล
// ==========================================

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as { visible?: boolean; name?: string; color?: string }

    const data: { visible?: boolean; name?: string; color?: string } = {}
    if (typeof body.visible === 'boolean') data.visible = body.visible
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 120)
    if (typeof body.color === 'string' && COLOR_RE.test(body.color)) data.color = body.color

    if (Object.keys(data).length === 0) return badRequest('ไม่มีข้อมูลที่ต้องการอัปเดต')

    const layer = await db.mapLayer.update({ where: { id }, data })
    await audit('update', 'map', `อัปเดตชั้นข้อมูลแผนที่ "${layer.name}"`)
    return ok(layer)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const layer = await db.mapLayer.delete({ where: { id } })
    await audit('delete', 'map', `ลบชั้นข้อมูลแผนที่ "${layer.name}"`)
    return ok({ success: true })
  } catch (e) {
    return serverError(e)
  }
}
