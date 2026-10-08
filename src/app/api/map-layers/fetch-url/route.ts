import { NextRequest } from 'next/server'
import { ok, badRequest, serverError } from '@/lib/api'
import { requireUser, isResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ==========================================
// GIS — Proxy ดึงข้อมูล KML/GeoJSON จาก URL ภายนอก (เลี่ยง CORS)
// POST /api/map-layers/fetch-url  { url }
// ==========================================

export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth
  try {
    const body = (await req.json()) as { url?: string }
    const url = typeof body.url === 'string' ? body.url.trim() : ''

    if (!/^https?:\/\/.+/i.test(url)) {
      return badRequest('URL ไม่ถูกต้อง — ต้องขึ้นต้นด้วย http:// หรือ https://')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    let res: Response
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'EDEN-DMS/1.0 (GIS layer importer)' },
      })
    } catch (fetchErr) {
      clearTimeout(timer)
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return badRequest('หมดเวลาเชื่อมต่อ URL (เกิน 20 วินาที)')
      }
      return badRequest('ไม่สามารถเชื่อมต่อ URL นี้ได้ — กรุณาตรวจสอบว่า URL ถูกต้องและเข้าถึงได้')
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      return badRequest(`ดึงข้อมูลไม่สำเร็จ — ปลายทางตอบ HTTP ${res.status}`)
    }

    const text = await res.text()
    if (text.length > 10_000_000) {
      return badRequest('ข้อมูลจาก URL ใหญ่เกิน 10MB')
    }

    const contentType = res.headers.get('content-type') ?? ''
    const looksKml = /<kml/i.test(text.slice(0, 2000))
    return ok({ content: text, contentType, looksKml })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return badRequest('หมดเวลาเชื่อมต่อ URL (เกิน 20 วินาที)')
    }
    return serverError(e)
  }
}
