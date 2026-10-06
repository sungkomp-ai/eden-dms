import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, badRequest, serverError, audit } from '@/lib/api'

export const dynamic = 'force-dynamic'

// ==========================================
// GIS — ชั้นข้อมูลแผนที่ (KML/GeoJSON นำเข้า)
// GET  /api/map-layers       → รายการทุกชั้นข้อมูล (พร้อม GeoJSON)
// POST /api/map-layers       → เพิ่มชั้นข้อมูลใหม่
// ==========================================

const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const SOURCE_TYPES = ['kml_file', 'geojson_file', 'url_kml', 'url_geojson']

interface RawFeature {
  type?: string
  geometry?: { type?: string; coordinates?: unknown } | null
  properties?: Record<string, unknown> | null
}

/** รับข้อมูล GeoJSON รูปแบบใดก็ได้ (FeatureCollection | Feature | Geometry | array) → คืน FeatureCollection ที่ถูกต้อง */
function normalizeToFeatureCollection(input: unknown): { features: RawFeature[] } {
  if (Array.isArray(input)) return { features: input as RawFeature[] }
  if (typeof input !== 'object' || input === null) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง')

  const obj = input as RawFeature
  if (obj.type === 'FeatureCollection' && Array.isArray((input as { features?: unknown }).features)) {
    return { features: obj.features as RawFeature[] }
  }
  if (obj.type === 'Feature') return { features: [obj] }
  if (typeof obj.type === 'string' && obj.geometry === undefined) {
    // Geometry object เช่น { type: "Point", coordinates: [...] }
    return { features: [{ type: 'Feature', properties: {}, geometry: obj as RawFeature['geometry'] }] }
  }
  throw new Error('รูปแบบ GeoJSON ไม่ถูกต้อง — ต้องเป็น FeatureCollection หรือ Feature')
}

export async function GET() {
  try {
    const layers = await db.mapLayer.findMany({ orderBy: { createdAt: 'desc' } })
    return ok(layers)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string
      color?: string
      sourceType?: string
      sourceUrl?: string
      data?: string | unknown
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return badRequest('กรุณาระบุชื่อชั้นข้อมูล')
    if (name.length > 120) return badRequest('ชื่อชั้นข้อมูลยาวเกิน 120 ตัวอักษร')

    const color = typeof body.color === 'string' && COLOR_RE.test(body.color) ? body.color : '#14b8a6'
    const sourceType = typeof body.sourceType === 'string' && SOURCE_TYPES.includes(body.sourceType)
      ? body.sourceType : 'kml_file'
    const sourceUrl = typeof body.sourceUrl === 'string' && body.sourceUrl.startsWith('http')
      ? body.sourceUrl : null

    // ตรวจสอบ + แปลงข้อมูล GeoJSON
    let parsed: unknown
    try {
      parsed = typeof body.data === 'string' ? JSON.parse(body.data) : body.data
    } catch {
      return badRequest('ข้อมูล GeoJSON ไม่ถูกต้อง (JSON parse ไม่ผ่าน)')
    }

    let fc: { features: RawFeature[] }
    try {
      fc = normalizeToFeatureCollection(parsed)
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : 'รูปแบบข้อมูลไม่ถูกต้อง')
    }

    const featureCount = fc.features.length
    if (featureCount === 0) return badRequest('ไม่พบข้อมูล feature ใด ๆ ในไฟล์')

    const dataStr = JSON.stringify(fc)
    if (dataStr.length > 12_000_000) return badRequest('ข้อมูลใหญ่เกิน 12MB')

    const layer = await db.mapLayer.create({
      data: { name, color, sourceType, sourceUrl, data: dataStr, featureCount, visible: true },
    })
    await audit('create', 'map', `นำเข้าชั้นข้อมูลแผนที่ "${name}" (${featureCount} features)`)
    return ok(layer, 201)
  } catch (e) {
    return serverError(e)
  }
}
