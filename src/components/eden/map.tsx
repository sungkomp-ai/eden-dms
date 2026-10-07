'use client'
// EDEN DMS — โมดูลแผนที่ปฏิบัติการ GIS (Leaflet + ชั้นข้อมูล KML/GeoJSON/API ซ้อนหลายชั้น)
import * as React from 'react'
import 'leaflet/dist/leaflet.css'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import {
  MapPin, Home, Map as MapIcon, Layers, Upload, Link2, FileUp, Loader2,
  Satellite, MountainSnow, Moon, TriangleAlert, Trash2, Route, Shapes,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SEVERITIES, INCIDENT_STATUS, fmtNum } from '@/lib/constants'
import {
  useFetch, apiSend, ModuleHeader, StatusBadge, EmptyState,
  ErrorState, FormDialog, Field, useConfirmDelete, RefreshButton,
} from './shared'
import { cn } from '@/lib/utils'

// ===== Types =====
interface StatsIncident {
  id: string
  code: string
  title: string
  severity: string
  status: string
  affectedPeople: number
  locationName?: string | null
  lat?: number | null
  lng?: number | null
}

interface StatsShelter {
  id: string
  name: string
  capacity: number
  currentOccupancy: number
  status: string
  lat?: number | null
  lng?: number | null
}

interface Stats { incidents: StatsIncident[]; shelters: StatsShelter[] }

interface MapLayerRec {
  id: string
  name: string
  sourceType: string
  sourceUrl?: string | null
  data: string
  color: string
  visible: boolean
  featureCount: number
}

interface GJGeometry { type: string; coordinates?: unknown }
interface GJFeature { type: string; geometry: GJGeometry | null; properties?: Record<string, unknown> | null }
interface GJCollection { type: 'FeatureCollection'; features: GJFeature[] }

type LeafletNS = typeof import('leaflet')
type LMap = import('leaflet').Map
type LTileLayer = import('leaflet').TileLayer
type LLayerGroup = import('leaflet').LayerGroup
type LMarker = import('leaflet').Marker

// ===== แหล่งพื้นที่ฐาน (basemap) — ไม่ต้องใช้ API key =====
const BASEMAPS = {
  standard: {
    label: 'แผนที่',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    label: 'ดาวเทียม',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
  },
  terrain: {
    label: 'ภูมิประเทศ',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  dark: {
    label: 'มืด',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
} as const
type BasemapKey = keyof typeof BASEMAPS
const BASEMAP_KEYS = Object.keys(BASEMAPS) as BasemapKey[]
const BASEMAP_ICON: Record<BasemapKey, React.ReactNode> = {
  standard: <MapIcon className="h-3.5 w-3.5" />,
  satellite: <Satellite className="h-3.5 w-3.5" />,
  terrain: <MountainSnow className="h-3.5 w-3.5" />,
  dark: <Moon className="h-3.5 w-3.5" />,
}

// สีสัญลักษณ์เหตุการณ์ตามความรุนแรง
const SEV_COLOR: Record<string, string> = {
  low: '#10b981',      // emerald-500
  medium: '#f59e0b',   // amber-500
  high: '#f97316',     // orange-500
  critical: '#ef4444', // red-500
}
const SHELTER_COLOR = '#8b5cf6' // violet-500

const PALETTE = ['#14b8a6', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6']

const SOURCE_LABEL: Record<string, string> = {
  kml_file: 'ไฟล์ KML',
  geojson_file: 'ไฟล์ GeoJSON',
  url_kml: 'KML จาก URL',
  url_geojson: 'GeoJSON จาก API',
}

// ===== SVG สัญลักษณ์ (inline — ใช้ใน DivIcon และ Legend) =====
function triangleSvg(color: string) {
  return `<svg width="26" height="26" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" fill="${color}" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round"/></svg>`
}
function houseSvg(color: string) {
  return `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 10.4 12 3l9 7.4V20a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z" fill="${color}" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.6 21.4v-5.6h4.8v5.6" fill="rgba(255,255,255,.85)"/></svg>`
}
function pinSvg(color: string) {
  return `<svg width="28" height="28" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="${color}" stroke="#ffffff" stroke-width="1.7"/><circle cx="12" cy="10" r="2.6" fill="#ffffff"/></svg>`
}
function makeIcon(L: LeafletNS, html: string, size: number, anchorY?: number) {
  const ay = anchorY ?? size / 2
  return L.divIcon({
    className: 'eden-marker-icon',
    html: `<div style="filter:drop-shadow(0 1px 2px rgba(15,23,42,.45));line-height:0">${html}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, ay],
    popupAnchor: [0, -ay],
  })
}

// ===== HTML helpers (popup) =====
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ))
}

function incidentPopupHtml(inc: StatsIncident): string {
  const sev = SEVERITIES.find((s) => s.value === inc.severity)
  return `<div style="min-width:190px">`
    + `<div style="font-family:ui-monospace,monospace;font-size:11px;font-weight:700;color:#475569">${esc(inc.code)}</div>`
    + `<div style="font-weight:700;font-size:14px;color:#0f172a;margin:2px 0 6px">${esc(inc.title)}</div>`
    + `<div style="font-size:12px;color:#475569">ระดับ${esc(sev?.label ?? inc.severity)} · ${esc(inc.locationName ?? 'ไม่ระบุพื้นที่')}</div>`
    + `<div style="font-size:12px;color:#c2410c;font-weight:600;margin-top:4px">ผู้ประสบภัย ${fmtNum(inc.affectedPeople)} คน</div>`
    + `</div>`
}

function shelterPopupHtml(sh: StatsShelter): string {
  const pct = sh.capacity > 0 ? Math.round((sh.currentOccupancy / sh.capacity) * 100) : 0
  return `<div style="min-width:180px">`
    + `<div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px">${esc(sh.name)}</div>`
    + `<div style="font-size:12px;color:#475569">ผู้พักพิง ${fmtNum(sh.currentOccupancy)} / ${fmtNum(sh.capacity)} คน (${pct}%)</div>`
    + `<div style="margin-top:6px;height:6px;border-radius:999px;background:#e2e8f0"><div style="width:${Math.min(100, pct)}%;height:6px;border-radius:999px;background:${SHELTER_COLOR}"></div></div>`
    + `</div>`
}

function featurePopupHtml(layerName: string, color: string, props: Record<string, unknown>, geomType: string): string {
  const labelMap: Record<string, string> = {
    name: 'ชื่อ', title: 'ชื่อ', detail: 'รายละเอียด', description: 'รายละเอียด',
    desc: 'รายละเอียด', updated: 'อัปเดต', type: 'ประเภท',
  }
  const rows = Object.entries(props)
    .filter(([, v]) => typeof v !== 'object')
    .slice(0, 8)
    .map(([k, v]) => `<tr>`
      + `<td style="padding:1px 8px 1px 0;color:#64748b;white-space:nowrap;vertical-align:top;font-size:12px">${esc(labelMap[k.toLowerCase()] ?? k)}</td>`
      + `<td style="padding:1px 0;color:#0f172a;font-size:12px;font-weight:500">${esc(v)}</td></tr>`)
    .join('')
  const typeLabel = geomType.includes('Point') ? 'จุด' : geomType.includes('Line') ? 'เส้น' : geomType.includes('Polygon') ? 'พื้นที่' : geomType
  return `<div style="min-width:180px">`
    + `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">`
    + `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color}"></span>`
    + `<span style="font-size:11px;color:#64748b">${esc(layerName)} · ${typeLabel}</span></div>`
    + (rows ? `<table>${rows}</table>` : `<div style="font-size:12px;color:#94a3b8">(ไม่มีข้อมูลรายละเอียด)</div>`)
    + `</div>`
}

// ===== แปลงข้อความ (KML / GeoJSON) → GeoJSON FeatureCollection (ฝั่ง browser) =====
function parseAnyToGeoJSON(text: string): GJCollection {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let obj: unknown
    try {
      obj = JSON.parse(trimmed)
    } catch {
      throw new Error('ไฟล์ JSON ไม่ถูกต้อง — parse ไม่ผ่าน')
    }
    if (Array.isArray(obj)) return { type: 'FeatureCollection', features: obj as GJFeature[] }
    const o = obj as { type?: string; features?: GJFeature[]; geometry?: GJGeometry; properties?: Record<string, unknown> }
    if (o.type === 'FeatureCollection' && Array.isArray(o.features)) return { type: 'FeatureCollection', features: o.features }
    if (o.type === 'Feature') return { type: 'FeatureCollection', features: [o as unknown as GJFeature] }
    if (typeof o.type === 'string' && o.geometry === undefined) {
      return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: o as GJGeometry }] }
    }
    throw new Error('โครงสร้าง GeoJSON ไม่เข้าใจ — ต้องเป็น FeatureCollection / Feature / Geometry')
  }
  // XML → KML
  const dom = new DOMParser().parseFromString(trimmed, 'text/xml')
  if (dom.querySelector('parsererror')) throw new Error('ไฟล์ XML ไม่ถูกต้อง')
  const gj = kmlToGeoJSON(dom as unknown as Document) as unknown as GJCollection | null
  if (!gj || !Array.isArray(gj.features) || gj.features.length === 0) {
    throw new Error('ไม่พบข้อมูล feature ในไฟล์ KML (ต้องมี Placemark อย่างน้อย 1 รายการ)')
  }
  return gj
}

function countGeom(fc: GJCollection) {
  let points = 0, lines = 0, areas = 0, other = 0
  for (const f of fc.features) {
    const t = f.geometry?.type ?? ''
    if (t.includes('Point')) points++
    else if (t.includes('Line')) lines++
    else if (t.includes('Polygon')) areas++
    else other++
  }
  return { points, lines, areas, other }
}

// ===== Main component =====
export default function MapModule() {
  const { data, loading, error, refetch } = useFetch<Stats>('/api/stats')
  const { data: layersData, loading: layersLoading, error: layersError, refetch: refetchLayers, setData: setLayersData } =
    useFetch<MapLayerRec[]>('/api/map-layers')

  const [basemap, setBasemap] = React.useState<BasemapKey>('standard')
  const [showIncidents, setShowIncidents] = React.useState(true)
  const [showShelters, setShowShelters] = React.useState(true)
  const [mapReady, setMapReady] = React.useState(false)

  // import dialog state
  const [importOpen, setImportOpen] = React.useState(false)
  const [importMode, setImportMode] = React.useState<'file' | 'url'>('file')
  const [urlInput, setUrlInput] = React.useState('')
  const [layerName, setLayerName] = React.useState('')
  const [layerColor, setLayerColor] = React.useState('#14b8a6')
  const [sourceType, setSourceType] = React.useState('kml_file')
  const [parsed, setParsed] = React.useState<GJCollection | null>(null)
  const [parsing, setParsing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)

  const confirm = useConfirmDelete()

  // refs สำหรับ Leaflet (โหลดแบบ dynamic เพื่อเลี่ยง SSR)
  const mapDivRef = React.useRef<HTMLDivElement | null>(null)
  const LRef = React.useRef<LeafletNS | null>(null)
  const mapRef = React.useRef<LMap | null>(null)
  const baseRef = React.useRef<LTileLayer | null>(null)
  const incGroupRef = React.useRef<LLayerGroup | null>(null)
  const shlGroupRef = React.useRef<LLayerGroup | null>(null)
  const userGroupRef = React.useRef<LLayerGroup | null>(null)
  const incMarkersRef = React.useRef<Map<string, LMarker>>(new Map())
  const basemapRef = React.useRef<BasemapKey>('standard')
  const fittedRef = React.useRef(false)
  basemapRef.current = basemap

  // ---- init map (ครั้งเดียว) ----
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import('leaflet')
      const L = ((mod as unknown as { default?: LeafletNS }).default ?? mod) as LeafletNS
      if (cancelled || !mapDivRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(mapDivRef.current, { zoomControl: true }).setView([18.55, 99.35], 7)
      const b = BASEMAPS[basemapRef.current]
      baseRef.current = L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom }).addTo(map)
      incGroupRef.current = L.layerGroup().addTo(map)
      shlGroupRef.current = L.layerGroup().addTo(map)
      userGroupRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      // เปิดให้เข้าถึง map instance จาก console เพื่อ debug/ทดสอบ (dev)
      ;(window as unknown as { __edenMap?: LMap }).__edenMap = map
      setMapReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      ;(window as unknown as { __edenMap?: LMap }).__edenMap = undefined
      mapRef.current = null
      incGroupRef.current = null
      shlGroupRef.current = null
      userGroupRef.current = null
      baseRef.current = null
      fittedRef.current = false
    }
  }, [])

  // ---- เปลี่ยนพื้นที่ฐาน (แผนที่/ดาวเทียม/ภูมิประเทศ/มืด) ----
  React.useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!mapReady || !L || !map) return
    if (baseRef.current) map.removeLayer(baseRef.current)
    const b = BASEMAPS[basemap]
    baseRef.current = L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom }).addTo(map)
    baseRef.current.bringToBack()
  }, [basemap, mapReady])

  // ---- สร้างสัญลักษณ์กิจกรรม (เหตุการณ์/ศูนย์พักพิง) ----
  React.useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    const incGroup = incGroupRef.current
    const shlGroup = shlGroupRef.current
    if (!mapReady || !L || !map || !incGroup || !shlGroup) return

    incGroup.clearLayers()
    shlGroup.clearLayers()
    incMarkersRef.current.clear()

    const incidents = data?.incidents ?? []
    incidents.forEach((inc, i) => {
      const hasCoords = typeof inc.lat === 'number' && typeof inc.lng === 'number'
      // ตำแหน่งสำรองแบบ deterministic เมื่อไม่มีพิกัด (กระจายรอบจุดกึ่งกลางภารกิจ)
      const lat = hasCoords ? (inc.lat as number) : 18.55 + (((i * 29) % 80) - 40) / 400
      const lng = hasCoords ? (inc.lng as number) : 99.4 + (((i * 53) % 100) - 50) / 400
      const color = SEV_COLOR[inc.severity] ?? '#64748b'
      const marker = L.marker([lat, lng], { icon: makeIcon(L, triangleSvg(color), 26) })
      marker.bindPopup(incidentPopupHtml(inc), { maxWidth: 280 })
      if (!hasCoords) marker.setOpacity(0.75)
      marker.addTo(incGroup)
      incMarkersRef.current.set(inc.id, marker)
    })

    const shelters = data?.shelters ?? []
    shelters.forEach((sh, i) => {
      const hasCoords = typeof sh.lat === 'number' && typeof sh.lng === 'number'
      const lat = hasCoords ? (sh.lat as number) : 18.45 + (((i * 31) % 70) - 35) / 400
      const lng = hasCoords ? (sh.lng as number) : 99.5 + (((i * 47) % 110) - 55) / 400
      const marker = L.marker([lat, lng], { icon: makeIcon(L, houseSvg(SHELTER_COLOR), 26) })
      marker.bindPopup(shelterPopupHtml(sh), { maxWidth: 260 })
      if (!hasCoords) marker.setOpacity(0.75)
      marker.addTo(shlGroup)
    })

    if (!fittedRef.current && (incidents.length > 0 || shelters.length > 0)) {
      map.fitBounds([[17.9, 97.8], [19.6, 101.3]], { padding: [24, 24] })
      fittedRef.current = true
    }
  }, [data, mapReady])

  // ---- เปิด/ปิดชั้นข้อมูลกิจกรรมของระบบ ----
  React.useEffect(() => {
    const map = mapRef.current
    const incGroup = incGroupRef.current
    const shlGroup = shlGroupRef.current
    if (!mapReady || !map || !incGroup || !shlGroup) return
    if (showIncidents) incGroup.addTo(map)
    else map.removeLayer(incGroup)
    if (showShelters) shlGroup.addTo(map)
    else map.removeLayer(shlGroup)
  }, [showIncidents, showShelters, mapReady])

  // ---- วาดชั้นข้อมูลที่นำเข้า (KML/GeoJSON) ซ้อนบนแผนที่ ----
  React.useEffect(() => {
    const L = LRef.current
    const holder = userGroupRef.current
    if (!mapReady || !L || !holder) return

    holder.clearLayers()
    for (const layer of layersData ?? []) {
      if (!layer.visible) continue
      try {
        const gj = JSON.parse(layer.data) as GJCollection
        if (!gj || !Array.isArray(gj.features)) continue
        const color = layer.color
        L.geoJSON(gj as unknown as GeoJSON.GeoJsonObject, {
          style: () => ({ color, weight: 3, opacity: 0.9, fillColor: color, fillOpacity: 0.16 }),
          pointToLayer: (f, latlng) =>
            L.marker(latlng, { icon: makeIcon(L, pinSvg(color), 28, 27) }),
          onEachFeature: (f, lyr) => {
            const props = (f.properties ?? {}) as Record<string, unknown>
            const gtype = f.geometry?.type ?? ''
            lyr.bindPopup(featurePopupHtml(layer.name, color, props, gtype), { maxWidth: 280 })
          },
        }).addTo(holder)
      } catch {
        // ข้อมูลชั้นนี้เสีย — ข้ามไปแสดงชั้นอื่น
      }
    }
  }, [layersData, mapReady])

  const incidents = data?.incidents ?? []
  const shelters = data?.shelters ?? []
  const layers = layersData ?? []
  const geomCounts = parsed ? countGeom(parsed) : null

  // ---- import handlers ----
  function resetImport() {
    setImportMode('file')
    setUrlInput('')
    setLayerName('')
    setLayerColor('#14b8a6')
    setSourceType('kml_file')
    setParsed(null)
    setParsing(false)
    setSaving(false)
    setImportError(null)
  }

  function applyParsed(fc: GJCollection, fallbackName: string, type: string) {
    setParsed(fc)
    setSourceType(type)
    if (!layerName.trim()) setLayerName(fallbackName)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setParsing(true)
    setImportError(null)
    setParsed(null)
    if (!layerName.trim()) setLayerName(f.name.replace(/\.(kml|geojson|json|xml)$/i, ''))
    try {
      const text = await f.text()
      const fc = parseAnyToGeoJSON(text)
      applyParsed(fc, f.name.replace(/\.(kml|geojson|json|xml)$/i, ''), /\.(geojson|json)$/i.test(f.name) ? 'geojson_file' : 'kml_file')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setParsing(false)
    }
  }

  async function handleUrlFetch() {
    if (!urlInput.trim()) return
    setParsing(true)
    setImportError(null)
    setParsed(null)
    try {
      const res = await apiSend('/api/map-layers/fetch-url', 'POST', { url: urlInput.trim() }) as { content: string; looksKml: boolean }
      const fc = parseAnyToGeoJSON(res.content)
      const fallback = urlInput.split('/').pop()?.split('?')[0]?.replace(/\.(kml|geojson|json|xml)$/i, '') || 'ชั้นข้อมูลจาก URL'
      applyParsed(fc, fallback, res.looksKml ? 'url_kml' : 'url_geojson')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'ดึงข้อมูลจาก URL ไม่สำเร็จ')
    } finally {
      setParsing(false)
    }
  }

  async function handleSaveLayer() {
    if (!parsed || !layerName.trim()) return
    setSaving(true)
    setImportError(null)
    try {
      const created = await apiSend('/api/map-layers', 'POST', {
        name: layerName.trim(),
        color: layerColor,
        sourceType,
        sourceUrl: importMode === 'url' ? urlInput.trim() : undefined,
        data: JSON.stringify(parsed),
      }) as MapLayerRec
      setLayersData((prev) => [created, ...(prev ?? [])])
      setImportOpen(false)
      resetImport()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'บันทึกชั้นข้อมูลไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function toggleLayerVisibility(layer: MapLayerRec, visible: boolean) {
    setLayersData((prev) => (prev ?? []).map((l) => (l.id === layer.id ? { ...l, visible } : l)))
    try {
      await apiSend(`/api/map-layers/${layer.id}`, 'PATCH', { visible })
    } catch {
      setLayersData((prev) => (prev ?? []).map((l) => (l.id === layer.id ? { ...l, visible: !visible } : l)))
    }
  }

  function askDeleteLayer(layer: MapLayerRec) {
    confirm.open(async () => {
      setLayersData((prev) => (prev ?? []).filter((l) => l.id !== layer.id))
      try {
        await apiSend(`/api/map-layers/${layer.id}`, 'DELETE')
      } catch {
        refetchLayers()
      }
    }, `ชั้นข้อมูล "${layer.name}"`)
  }

  function focusIncident(inc: StatsIncident) {
    const map = mapRef.current
    if (!map) return
    setShowIncidents(true)
    if (typeof inc.lat === 'number' && typeof inc.lng === 'number') {
      map.flyTo([inc.lat, inc.lng], 11, { duration: 0.8 })
    }
    window.setTimeout(() => incMarkersRef.current.get(inc.id)?.openPopup(), 900)
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="แผนที่ปฏิบัติการ GIS"
        description="สลับแผนที่/ภาพดาวเทียม · นำเข้าข้อมูล KML และจาก API เป็นชั้นข้อมูลซ้อนหลายชั้น · สัญลักษณ์แทนกิจกรรมปฏิบัติการ"
        actions={
          <>
            <Button onClick={() => { resetImport(); setImportOpen(true) }}>
              <Upload className="h-4 w-4" /> นำเข้า KML/GeoJSON
            </Button>
            <RefreshButton onClick={() => { refetch(); refetchLayers() }} loading={loading || layersLoading} />
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ===== แผนที่ ===== */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* แถบเปลี่ยนพื้นที่ฐาน */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <span className="pl-2 text-xs font-semibold text-slate-500">พื้นที่ฐาน:</span>
            {BASEMAP_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBasemap(k)}
                aria-pressed={basemap === k}
                className={cn(
                  'flex min-h-[32px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  basemap === k
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {BASEMAP_ICON[k]} {BASEMAPS[k].label}
              </button>
            ))}
            <Badge variant="outline" className="ml-auto mr-2 border-slate-200 bg-slate-50 text-[11px] text-slate-500">
              ซ้อนได้ {layers.filter((l) => l.visible).length + (showIncidents ? 1 : 0) + (showShelters ? 1 : 0)} ชั้นข้อมูล
            </Badge>
          </div>

          {/* แผนที่ Leaflet */}
          <div className="relative z-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <div
              ref={mapDivRef}
              className="h-[420px] w-full rounded-lg sm:h-[540px]"
              role="application"
              aria-label="แผนที่ปฏิบัติการแบบโต้ตอบ (ซูม/เลื่อนได้)"
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        </div>

        {/* ===== แผงชั้นข้อมูล (ขวา) ===== */}
        <div className="w-full shrink-0 space-y-3 lg:w-80">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <Layers className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">ชั้นข้อมูลบนแผนที่</h3>
              <Badge variant="outline" className="ml-auto border-slate-200 text-xs text-slate-500">{layers.length} ชั้น</Badge>
            </div>
            <div className="max-h-[430px] space-y-4 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [scrollbar-width:thin]">
              {/* กิจกรรมของระบบ */}
              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">กิจกรรมของระบบ</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <TriangleAlert className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">เหตุการณ์ภัยพิบัติ</span>
                    <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">{incidents.length}</Badge>
                    <Switch checked={showIncidents} onCheckedChange={setShowIncidents} aria-label="เปิด/ปิดชั้นเหตุการณ์ภัยพิบัติ" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <Home className="h-4 w-4 shrink-0 text-violet-500" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">ศูนย์พักพิง</span>
                    <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">{shelters.length}</Badge>
                    <Switch checked={showShelters} onCheckedChange={setShowShelters} aria-label="เปิด/ปิดชั้นศูนย์พักพิง" />
                  </div>
                </div>
              </section>

              {/* ชั้นข้อมูลนำเข้า */}
              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">นำเข้า (KML / GeoJSON / API)</p>
                {layersError ? (
                  <p className="text-xs text-red-600">โหลดชั้นข้อมูลไม่สำเร็จ: {layersError}</p>
                ) : layersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : layers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                    <p className="text-xs text-slate-400">ยังไม่มีชั้นข้อมูลนำเข้า</p>
                    <Button variant="outline" size="sm" className="mt-2 h-8" onClick={() => { resetImport(); setImportOpen(true) }}>
                      <Upload className="h-3.5 w-3.5" /> นำเข้าเลย
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {layers.map((layer) => (
                      <div key={layer.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm ring-1 ring-slate-200" style={{ background: layer.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-700" title={layer.name}>{layer.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {SOURCE_LABEL[layer.sourceType] ?? layer.sourceType} · {layer.featureCount} รายการ
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-slate-300 hover:text-red-600"
                          aria-label={`ลบชั้นข้อมูล ${layer.name}`}
                          onClick={() => askDeleteLayer(layer)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={layer.visible}
                          onCheckedChange={(v) => toggleLayerVisibility(layer, v)}
                          aria-label={`เปิด/ปิดชั้นข้อมูล ${layer.name}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Legend สัญลักษณ์กิจกรรม */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Shapes className="h-4 w-4 text-slate-400" /> สัญลักษณ์แทนกิจกรรม
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              {SEVERITIES.map((s) => (
                <div key={s.value} className="flex items-center gap-2">
                  <span
                    className="inline-block h-0 w-0 border-x-[7px] border-b-[12px] border-x-transparent"
                    style={{ borderBottomColor: SEV_COLOR[s.value] }}
                  />
                  เหตุการณ์{s.label}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: SHELTER_COLOR }} />
                ศูนย์พักพิง
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-600" />
                จุดกิจกรรมจากชั้นข้อมูลนำเข้า
              </div>
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-amber-600" />
                เส้นทาง / แนวปฏิบัติการ
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-[3px] border-2 border-teal-600 bg-teal-600/20" />
                พื้นที่ / ขอบเขตปฏิบัติการ
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="inline-block h-3 w-3 rounded-full border border-dashed border-slate-400" />
                = ตำแหน่งโดยประมาณ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ตารางสรุปเหตุการณ์ ===== */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700">สรุปเหตุการณ์ทั้งหมด ({incidents.length} เหตุการณ์)</h3>
          <p className="mt-0.5 text-xs text-slate-400">คลิกแถวเพื่อซูมไปยังตำแหน่งบนแผนที่</p>
        </div>
        {!error && !loading && incidents.length === 0 ? (
          <EmptyState message="ไม่พบข้อมูลเหตุการณ์" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>รหัส</TableHead>
                  <TableHead>เหตุการณ์</TableHead>
                  <TableHead>ระดับความรุนแรง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>พื้นที่</TableHead>
                  <TableHead className="text-right">ผู้ประสบภัย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow key={inc.id} onClick={() => focusIncident(inc)} className="cursor-pointer">
                    <TableCell className="font-mono text-xs font-semibold text-slate-700">{inc.code}</TableCell>
                    <TableCell className="font-medium text-slate-800">{inc.title}</TableCell>
                    <TableCell><StatusBadge options={SEVERITIES} value={inc.severity} /></TableCell>
                    <TableCell><StatusBadge options={INCIDENT_STATUS} value={inc.status} /></TableCell>
                    <TableCell className="max-w-52 truncate text-slate-600" title={inc.locationName ?? undefined}>
                      {inc.locationName ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-orange-600">{fmtNum(inc.affectedPeople)} คน</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="border-t border-slate-100 px-4 py-3">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-500">
            ทั้งหมด {shelters.length} ศูนย์พักพิงบนแผนที่ · ความจุรวม {fmtNum(shelters.reduce((s, x) => s + (x.capacity || 0), 0))} คน
          </Badge>
        </div>
      </div>

      {/* ===== Dialog นำเข้าชั้นข้อมูล ===== */}
      <FormDialog
        open={importOpen}
        onOpenChange={(o) => { setImportOpen(o); if (!o) resetImport() }}
        title="นำเข้าชั้นข้อมูลแผนที่"
        description="อัปโหลดไฟล์ KML / GeoJSON หรือดึงจาก URL/API — จัดเก็บเป็นชั้นข้อมูลแสดงผลซ้อนกันได้หลายชั้น"
        wide
      >
        <Tabs
          value={importMode}
          onValueChange={(v) => { setImportMode(v as 'file' | 'url'); setParsed(null); setImportError(null) }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-1.5"><FileUp className="h-4 w-4" /> อัปโหลดไฟล์</TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5"><Link2 className="h-4 w-4" /> จาก URL / API</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-2 pt-2">
            <Field label="ไฟล์ KML / GeoJSON" required>
              <Input type="file" accept=".kml,.geojson,.json,.xml" onChange={handleFile} disabled={parsing} />
            </Field>
            <p className="text-[11px] text-slate-400">
              รองรับ .kml (Google Earth / QGIS), .geojson, .json, .xml — ขนาดไม่เกิน 10MB (ไฟล์ KMZ ต้องแตก zip เอา .kml ก่อน)
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-2 pt-2">
            <Field label="URL ของไฟล์ KML หรือ GeoJSON API" required>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/flood-zone.kml"
                  inputMode="url"
                />
                <Button variant="outline" onClick={handleUrlFetch} disabled={parsing || !urlInput.trim()} className="shrink-0">
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} ดึงข้อมูล
                </Button>
              </div>
            </Field>
            <p className="text-[11px] text-slate-400">
              ระบบดึงข้อมูลผ่านเซิร์ฟเวอร์ของเราเอง (ไม่ติดปัญหา CORS) — รองรับทั้ง KML และ GeoJSON
            </p>
          </TabsContent>
        </Tabs>

        {parsing && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังอ่านและแปลงข้อมูล...
          </p>
        )}
        {importError && (
          <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{importError}</p>
        )}
        {parsed && geomCounts && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <p className="font-semibold">อ่านข้อมูลสำเร็จ — {parsed.features.length} features</p>
            <p className="mt-0.5">
              {geomCounts.points} จุด · {geomCounts.lines} เส้น · {geomCounts.areas} พื้นที่
              {geomCounts.other > 0 ? ` · อื่น ๆ ${geomCounts.other}` : ''}
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <Field label="ชื่อชั้นข้อมูล" required>
            <Input
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              placeholder="เช่น เขตพื้นที่ปฏิบัติการเชียงใหม่"
              maxLength={120}
            />
          </Field>
          <Field label="สีสัญลักษณ์">
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`เลือกสี ${c}`}
                  aria-pressed={layerColor === c}
                  onClick={() => setLayerColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    layerColor === c ? 'scale-110 border-slate-900' : 'border-transparent hover:scale-105',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setImportOpen(false); resetImport() }}>ยกเลิก</Button>
            <Button onClick={handleSaveLayer} disabled={!parsed || !layerName.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} บันทึกชั้นข้อมูล
            </Button>
          </div>
        </div>
      </FormDialog>

      {confirm.dialog}
    </div>
  )
}
