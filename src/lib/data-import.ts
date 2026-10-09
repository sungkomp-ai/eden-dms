// ============================================================
// EDEN DMS — Data Import Engine (ผู้ช่วย AI นำข้อมูลภายนอกเข้าสู่ระบบ)
// - แยกไฟล์ CSV/TSV/JSON/XLSX/XLS เป็นตาราง (ParsedTable)
// - แคตตาล็อกโมดูล + ฟิลด์ (ใช้ทั้งให้ LLM mapping และ normalize ฝั่งเซิร์ฟเวอร์)
// - importRecords() — ตรวจสอบ/แปลงชนิดข้อมูล/แก้ relation/บันทึกลง Prisma + Audit
// - Staging job (in-memory, TTL 30 นาที, one-shot consume)
// ใช้ฝั่ง backend เท่านั้น (import Prisma)
// ============================================================
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { audit } from '@/lib/auth'

// ---------- ชนิดข้อมูล ----------
export interface ParsedTable {
  columns: string[]
  rows: Record<string, string>[]
  sheetName?: string
  truncated?: boolean // ถูกตัดจำนวนแถว (เกิน MAX_PARSE_ROWS)
}

export type FieldType = 'string' | 'int' | 'float' | 'date' | 'enum' | 'relation'
export type RelationKind = 'location' | 'shelter' | 'incident' | 'warehouse' | 'organization'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  enumValues?: string[]
  enumLabels?: Record<string, string> // ฉลากไทย/อังกฤษ (lowercase) → ค่า canonical
  relation?: RelationKind
  target?: string // ชื่อฟิลด์ FK ปลายทางใน Prisma เช่น locationId (สำหรับ relation)
  default?: string | number // ใส่แทนเมื่อว่าง (ไม่ error)
  createIfMissing?: boolean // สำหรับ relation: สร้างใหม่อัตโนมัติถ้าไม่พบ
  defaultLevel?: string // สำหรับ location
  hint?: string // คำอธิบายสั้นสำหรับ prompt LLM
}

export interface ModuleDef {
  key: string
  label: string
  model: 'incident' | 'location' | 'shelter' | 'person' | 'organization' | 'humanResource' | 'warehouse' | 'inventoryItem' | 'aidRequest' | 'alert' | 'incidentReport'
  codePrefix?: 'INC' | 'REQ' // สร้างรหัสเองเมื่อไม่ได้ระบุ
  fields: FieldDef[]
  description: string
}

export interface NormalizedRow {
  data: Record<string, unknown> // ค่า scalar พร้อมใส่ Prisma (ยกเว้น relation)
  relations: { kind: RelationKind; target: string; value: string; createIfMissing: boolean; defaultLevel?: string }[]
}

export interface ImportRowError { row: number; error: string }
export interface ImportResult {
  created: number
  skipped: number
  failed: ImportRowError[]
  createdNames: string[]
}

interface DelegateLike {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
  findFirst(args?: Record<string, unknown>): Promise<Record<string, unknown> | null>
}

// ---------- ขีดจำกัด ----------
export const MAX_PARSE_ROWS = 1000 // จำกัดแถวตอน parse (กันไฟล์ใหญ่)
export const MAX_IMPORT_ROWS = 500 // จำกัดแถวต่อการนำเข้า 1 ครั้ง
export const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
export const PREVIEW_ROWS = 5

// ============================================================
// 1) ตัวแยกไฟล์
// ============================================================

/** ตัด BOM และปรับ newline */
function cleanText(input: string): string {
  return input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** ตรวจจับตัวคั่น (, ; \t |) จากบรรทัดแรก ๆ ว่าแบบไหนให้จำนวนช่องสม่ำเสมอและมากที่สุด */
function detectDelimiter(text: string): string {
  const sample = text.split('\n').slice(0, 5).join('\n')
  let best = ','
  let bestScore = -1
  for (const d of [',', ';', '\t', '|']) {
    const counts = sample.split('\n').map((l) => splitCsvLine(l, d).length)
    if (counts.length === 0) continue
    const max = Math.max(...counts)
    if (max < 2) continue
    const consistent = counts.filter((c) => c === max).length / counts.length
    const score = max * consistent
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

/** แยก 1 บรรทัด CSV ตาม RFC 4180 (รองรับเครื่องหมายคำพูดซ้อน) */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** แยกข้อความ CSV/TSV เป็นตาราง */
export function parseDelimited(text: string): ParsedTable {
  const cleaned = cleanText(text).trim()
  if (!cleaned) throw new Error('ไฟล์ว่างเปล่า')
  const delim = detectDelimiter(cleaned)
  // รองรับค่าที่มี \n ในเครื่องหมายคำพูด — แยกบรรทัดอย่างระวัง
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (const ch of cleaned) {
    if (ch === '"') inQuotes = !inQuotes
    if (ch === '\n' && !inQuotes) { lines.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) lines.push(cur)

  const grid = lines.map((l) => splitCsvLine(l, delim).map((c) => c.trim()))
  if (grid.length < 2) throw new Error('ต้องมีอย่างน้อย 1 หัวคอลัมน์ + 1 แถวข้อมูล')

  const headers = grid[0].map((h, i) => (h || `คอลัมน์ที่ ${i + 1}`).trim())
  const rows: Record<string, string>[] = []
  for (const cells of grid.slice(1)) {
    if (cells.every((c) => !c)) continue // ข้ามแถวว่าง
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    rows.push(row)
  }
  if (rows.length === 0) throw new Error('ไม่พบแถวข้อมูลในไฟล์')
  const truncated = rows.length > MAX_PARSE_ROWS
  return {
    columns: headers,
    rows: truncated ? rows.slice(0, MAX_PARSE_ROWS) : rows,
    truncated,
  }
}

/** แยก JSON เป็นตาราง (array ของ object หรือ {data|rows|items: [...]}) */
export function parseJsonTable(text: string): ParsedTable {
  const parsed: unknown = JSON.parse(cleanText(text))
  let arr: unknown[] | null = null
  if (Array.isArray(parsed)) arr = parsed
  else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    for (const k of ['data', 'rows', 'items', 'records', 'results']) {
      if (Array.isArray(obj[k])) { arr = obj[k] as unknown[]; break }
    }
  }
  if (!arr || arr.length === 0) throw new Error('JSON ต้องเป็น array ของ object (หรือมีคีย์ data/rows/items)')

  const flat = arr.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[]
  if (flat.length === 0) throw new Error('JSON ต้องเป็น array ของ object (พบค่าที่ไม่ใช่ object)')

  const columns: string[] = []
  for (const r of flat.slice(0, 50)) {
    for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k)
  }
  const toString = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }
  const rows = flat.map((r) => {
    const row: Record<string, string> = {}
    for (const c of columns) row[c] = toString(r[c])
    return row
  })
  const truncated = rows.length > MAX_PARSE_ROWS
  return { columns, rows: truncated ? rows.slice(0, MAX_PARSE_ROWS) : rows, truncated }
}

/** แยกไฟล์ Excel (.xlsx/.xls) เป็นตาราง (ชีตแรกที่มีข้อมูล) */
export function parseExcel(buffer: Buffer): ParsedTable {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })
    if (!grid || grid.length < 2) continue
    const headers = (grid[0] as unknown[]).map((h, i) => String(h ?? '').trim() || `คอลัมน์ที่ ${i + 1}`)
    const rows: Record<string, string>[] = []
    for (const cells of (grid.slice(1) as unknown[][])) {
      if (cells.every((c) => String(c ?? '').trim() === '')) continue
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = String(cells[i] ?? '').trim() })
      rows.push(row)
    }
    if (rows.length > 0) {
      const truncated = rows.length > MAX_PARSE_ROWS
      return { columns: headers, rows: truncated ? rows.slice(0, MAX_PARSE_ROWS) : rows, sheetName, truncated }
    }
  }
  throw new Error('ไม่พบชีตที่มีข้อมูลตารางในไฟล์ Excel')
}

/** เดานามสกุลไฟล์จากชื่อ/ชนิดเนื้อหา */
export function inferKind(filename: string, contentType?: string | null): 'csv' | 'tsv' | 'json' | 'xlsx' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'csv') return 'csv'
  if (ext === 'tsv' || ext === 'tab') return 'tsv'
  if (ext === 'json' || ext === 'geojson') return 'json'
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') return 'xlsx'
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('json')) return 'json'
  if (ct.includes('excel') || ct.includes('spreadsheet') || ct.includes('ms-excel')) return 'xlsx'
  if (ct.includes('tab-separated')) return 'tsv'
  if (ct.includes('csv') || ct.includes('text/')) return 'csv'
  return 'unknown'
}

/** แยกไฟล์อะไรก็ได้ (ที่รองรับ) เป็นตาราง — โยน Error ข้อความไทยถ้ารูปแบบไม่ถูกต้อง */
export function parseAnyFile(filename: string, buffer: Buffer, contentType?: string | null): ParsedTable {
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('ไฟล์ใหญ่เกิน 5MB')
  const kind = inferKind(filename, contentType)
  const text = buffer.toString('utf-8')
  if (kind === 'xlsx') return parseExcel(buffer)
  if (kind === 'json') {
    try { return parseJsonTable(text) } catch (e) {
      // JSON แต่ไม่ใช่ตาราง — ถ้าเดิมเป็น .json จริงให้ error, ถ้าเดาเองลอง CSV ต่อ
      if (filename.toLowerCase().endsWith('.json')) throw e
      return parseDelimited(text)
    }
  }
  if (kind === 'csv' || kind === 'tsv' || kind === 'unknown') {
    // unknown: ลอง JSON ก่อน แล้วค่อย CSV
    if (kind === 'unknown') {
      try { return parseJsonTable(text) } catch { /* ลอง CSV ต่อ */ }
    }
    return parseDelimited(text)
  }
  throw new Error('รูปแบบไฟล์ไม่รองรับ — ใช้ .csv, .tsv, .json หรือ .xlsx')
}

// ============================================================
// 2) คลังฉลาก enum ไทย → ค่า canonical
// ============================================================
const SEV_LABELS: Record<string, string> = {
  'low': 'low', 'ต่ำ': 'low', 'เล็กน้อย': 'low', 'น้อย': 'low',
  'medium': 'medium', 'กลาง': 'medium', 'ปานกลาง': 'medium',
  'high': 'high', 'สูง': 'high', 'รุนแรง': 'high',
  'critical': 'critical', 'วิกฤต': 'critical', 'ฉุกเฉิน': 'critical', 'วิกฤติ': 'critical',
}
const INCIDENT_TYPE_LABELS: Record<string, string> = {
  'flood': 'flood', 'น้ำท่วม': 'flood', 'อุทกภัย': 'flood', 'น้ำหลาก': 'flood',
  'earthquake': 'earthquake', 'แผ่นดินไหว': 'earthquake',
  'fire': 'fire', 'ไฟป่า': 'fire', 'ไฟไหม้': 'fire', 'เพลิงไหม้': 'fire',
  'landslide': 'landslide', 'ดินโคลนถล่ม': 'landslide', 'ดินถล่ม': 'landslide', 'โคลนถล่ม': 'landslide',
  'storm': 'storm', 'พายุ': 'storm', 'พายุฝนฟ้าคะนอง': 'storm',
  'drought': 'drought', 'ภัยแล้ง': 'drought', 'ขาดแคลนน้ำ': 'drought',
  'epidemic': 'epidemic', 'โรคระบาด': 'epidemic', 'ระบาด': 'epidemic',
  'other': 'other', 'อื่นๆ': 'other', 'อื่น ๆ': 'other', 'อื่น ๆ ': 'other',
}
const INCIDENT_STAT_LABELS: Record<string, string> = {
  'active': 'active', 'ดำเนินการ': 'active', 'กำลังดำเนินการ': 'active', 'เกิดเหตุ': 'active',
  'monitoring': 'monitoring', 'เฝ้าระวัง': 'monitoring', 'ติดตามสถานการณ์': 'monitoring',
  'resolved': 'resolved', 'คลี่คลาย': 'resolved', 'บรรเทาแล้ว': 'resolved', 'สิ้นสุด': 'resolved',
  'closed': 'closed', 'ปิดเหตุการณ์': 'closed', 'ปิด': 'closed',
}
const SHELTER_TYPE_LABELS: Record<string, string> = {
  'school': 'school', 'โรงเรียน': 'school',
  'temple': 'temple', 'วัด': 'temple', 'ศาสนสถาน': 'temple',
  'community_center': 'community_center', 'ศูนย์ชุมชน': 'community_center', 'ศูนย์ราชการ': 'community_center', 'ชุมชน': 'community_center', 'มหาวิทยาลัย': 'community_center', 'อาคาร': 'community_center',
  'stadium': 'stadium', 'สนามกีฬา': 'stadium', 'โรงยิม': 'stadium', 'ลานกีฬา': 'stadium',
  'tent': 'tent', 'เต็นท์': 'tent', 'เต็นท์พัก': 'tent', 'เต็นท์ชั่วคราว': 'tent',
  'hotel': 'hotel', 'โรงแรม': 'hotel', 'ที่พัก': 'hotel',
}
const SHELTER_STAT_LABELS: Record<string, string> = {
  'open': 'open', 'เปิด': 'open', 'เปิดรับ': 'open', 'เปิดรับผู้อพยพ': 'open',
  'full': 'full', 'เต็ม': 'full', 'เต็มความจุ': 'full',
  'closed': 'closed', 'ปิด': 'closed',
  'preparing': 'preparing', 'เตรียมพร้อม': 'preparing', 'เตรียมการ': 'preparing',
}
const GENDER_LABELS: Record<string, string> = {
  'male': 'male', 'ชาย': 'male', 'ช': 'male',
  'female': 'female', 'หญิง': 'female', 'ญ': 'female',
  'other': 'other', 'อื่นๆ': 'other',
  'unknown': 'unknown', 'ไม่ระบุ': 'unknown',
}
const PERSON_STAT_LABELS: Record<string, string> = {
  'missing': 'missing', 'สูญหาย': 'missing', 'หาย': 'missing', 'ติดต่อไม่ได้': 'missing',
  'found': 'found', 'พบตัว': 'found', 'พบตัวแล้ว': 'found', 'พบ': 'found',
  'safe': 'safe', 'ปลอดภัย': 'safe',
  'injured': 'injured', 'บาดเจ็บ': 'injured',
  'deceased': 'deceased', 'เสียชีวิต': 'deceased', 'เสียชีวิตแล้ว': 'deceased',
  'evacuated': 'evacuated', 'อพยพ': 'evacuated', 'อพยพแล้ว': 'evacuated',
}
const ORG_TYPE_LABELS: Record<string, string> = {
  'government': 'government', 'ราชการ': 'government', 'รัฐ': 'government', 'หน่วยงานรัฐ': 'government', 'รัฐวิสาหกิจ': 'government',
  'ngo': 'ngo', 'เอ็นจีโอ': 'ngo', 'องค์กรเพื่อสังคม': 'ngo', 'มูลนิธิ': 'ngo', 'สมาคม': 'ngo',
  'international': 'international', 'ระหว่างประเทศ': 'international', 'องค์กรระหว่างประเทศ': 'international',
  'private': 'private', 'เอกชน': 'private', 'บริษัท': 'private',
  'community': 'community', 'ชุมชน': 'community', 'อาสาสมัคร': 'community',
}
const HR_TYPE_LABELS: Record<string, string> = {
  'staff': 'staff', 'พนักงาน': 'staff', 'เจ้าหน้าที่': 'staff', 'ข้าราชการ': 'staff',
  'volunteer': 'volunteer', 'อาสาสมัคร': 'volunteer', 'จิตอาสา': 'volunteer',
  'trainee': 'trainee', 'ผู้ฝึกอบรม': 'trainee', 'นักศึกษาฝึกงาน': 'trainee',
}
const HR_STAT_LABELS: Record<string, string> = {
  'available': 'available', 'พร้อมปฏิบัติงาน': 'available', 'พร้อม': 'available', 'ว่าง': 'available',
  'assigned': 'assigned', 'ได้รับมอบหมาย': 'assigned', 'มอบหมายแล้ว': 'assigned',
  'on_mission': 'on_mission', 'ปฏิบัติภารกิจ': 'on_mission', 'ปฏิบัติงานภาคสนาม': 'on_mission',
  'unavailable': 'unavailable', 'ไม่พร้อม': 'unavailable', 'ลา': 'unavailable',
}
const INV_CAT_LABELS: Record<string, string> = {
  'food': 'food', 'อาหาร': 'food', 'อาหารแห้ง': 'food',
  'water': 'water', 'น้ำดื่ม': 'water', 'น้ำ': 'water', 'น้ำสะอาด': 'water',
  'medical': 'medical', 'เวชภัณฑ์': 'medical', 'การแพทย์': 'medical', 'ยา': 'medical',
  'clothing': 'clothing', 'เครื่องนุ่งห่ม': 'clothing', 'เสื้อผ้า': 'clothing',
  'shelter': 'shelter', 'ที่พักพิง': 'shelter', 'เต็นท์': 'shelter',
  'tools': 'tools', 'เครื่องมือ': 'tools',
  'fuel': 'fuel', 'เชื้อเพลิง': 'fuel', 'แก๊ส': 'fuel',
  'relief': 'relief', 'ชุดบรรเทาทุกข์': 'relief', 'บรรเทาทุกข์': 'relief', 'สิ่งของบรรเทาทุกข์': 'relief',
  'hygiene': 'hygiene', 'สุขอนามัย': 'hygiene', 'สุขภัณฑ์': 'hygiene',
  'other': 'other', 'อื่นๆ': 'other', 'อื่น ๆ': 'other',
}
const REQ_TYPE_LABELS: Record<string, string> = {
  'food': 'food', 'อาหาร': 'food',
  'water': 'water', 'น้ำดื่ม': 'water', 'น้ำ': 'water',
  'medical': 'medical', 'การแพทย์': 'medical', 'เวชภัณฑ์': 'medical',
  'shelter': 'shelter', 'ที่พักพิง': 'shelter', 'เต็นท์': 'shelter',
  'evacuation': 'evacuation', 'อพยพ': 'evacuation', 'การอพยพ': 'evacuation',
  'search_rescue': 'search_rescue', 'ค้นหา': 'search_rescue', 'กู้ภัย': 'search_rescue', 'ค้นหาและกู้ภัย': 'search_rescue',
  'other': 'other', 'อื่นๆ': 'other', 'อื่น ๆ': 'other',
}
const REQ_PRIORITY_LABELS: Record<string, string> = {
  'low': 'low', 'ต่ำ': 'low',
  'medium': 'medium', 'กลาง': 'medium', 'ปกติ': 'medium',
  'high': 'high', 'สูง': 'high', 'ด่วน': 'high',
  'urgent': 'urgent', 'เร่งด่วน': 'urgent', 'ด่วนมาก': 'urgent', 'ด่วนที่สุด': 'urgent',
}
const REQ_STAT_LABELS: Record<string, string> = {
  'pending': 'pending', 'รอดำเนินการ': 'pending', 'รอ': 'pending', 'รออนุมัติ': 'pending',
  'approved': 'approved', 'อนุมัติแล้ว': 'approved', 'อนุมัติ': 'approved',
  'in_progress': 'in_progress', 'กำลังดำเนินการ': 'in_progress', 'กำลังช่วยเหลือ': 'in_progress',
  'fulfilled': 'fulfilled', 'สำเร็จ': 'fulfilled', 'เสร็จสิ้น': 'fulfilled', 'ช่วยแล้ว': 'fulfilled',
  'rejected': 'rejected', 'ปฏิเสธ': 'rejected', 'ไม่อนุมัติ': 'rejected',
}
const ALERT_CHANNEL_LABELS: Record<string, string> = {
  'sms': 'sms', 'เอสเอ็มเอส': 'sms',
  'email': 'email', 'อีเมล': 'email', 'อีเมล์': 'email',
  'broadcast': 'broadcast', 'ประกาศ': 'broadcast', 'แบบเรียลไทม์': 'broadcast', 'ทั่วไป': 'broadcast',
  'app': 'app', 'แอป': 'app', 'แอพ': 'app', 'แอปพลิเคชัน': 'app',
}
const ALERT_SEV_LABELS: Record<string, string> = {
  'info': 'info', 'ข้อมูล': 'info', 'ทั่วไป': 'info', 'ปกติ': 'info',
  'warning': 'warning', 'เตือน': 'warning', 'เฝ้าระวัง': 'warning', 'เตือนภัย': 'warning',
  'critical': 'critical', 'วิกฤต': 'critical', 'ฉุกเฉิน': 'critical', 'วิกฤติ': 'critical',
}
const AUDIENCE_LABELS: Record<string, string> = {
  'all': 'all', 'ทุกคน': 'all', 'ทั้งหมด': 'all', 'ทุกฝ่าย': 'all',
  'area': 'area', 'พื้นที่': 'area', 'พื้นที่รับผิดชอบ': 'area',
  'volunteers': 'volunteers', 'อาสาสมัคร': 'volunteers',
  'officers': 'officers', 'เจ้าหน้าที่': 'officers', 'เจ้าหน้าที่/ผู้ปฏิบัติงาน': 'officers',
}
const REPORT_STAT_LABELS: Record<string, string> = {
  'draft': 'draft', 'ร่าง': 'draft', 'ฉบับร่าง': 'draft',
  'published': 'published', 'เผยแพร่': 'published', 'เผยแพร่แล้ว': 'published',
}
const LOCATION_LEVEL_LABELS: Record<string, string> = {
  'province': 'province', 'จังหวัด': 'province',
  'district': 'district', 'อำเภอ': 'district', 'เขต': 'district',
  'subdistrict': 'subdistrict', 'ตำบล': 'subdistrict', 'แขวง': 'subdistrict', 'หมู่บ้าน': 'subdistrict',
}
const ORG_SECTOR_LABELS: Record<string, string> = {
  'health': 'health', 'สาธารณสุข': 'health', 'การแพทย์': 'health',
  'water': 'water', 'น้ำ': 'water',
  'food': 'food', 'อาหาร': 'food',
  'education': 'education', 'การศึกษา': 'education',
  'logistics': 'logistics', 'โลจิสติกส์': 'logistics', 'ขนส่ง': 'logistics',
  'search_rescue': 'search_rescue', 'ค้นหาและกู้ภัย': 'search_rescue', 'กู้ภัย': 'search_rescue',
  'other': 'other', 'อื่นๆ': 'other', 'อื่น ๆ': 'other',
}

function matchEnum(raw: string, def: FieldDef): string | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (def.enumValues?.includes(v)) return v
  if (def.enumLabels && def.enumLabels[v]) return def.enumLabels[v]
  // พยายาม match แบบมีคำมากกว่า เช่น "น้ำท่วมขัง" มีคำ "น้ำท่วม"
  if (def.enumLabels) {
    for (const [label, val] of Object.entries(def.enumLabels)) {
      if (label.length > 2 && v.includes(label)) return val
    }
  }
  return null
}

// ============================================================
// 3) ตัวแปลงวันที่ (รองรับ พ.ศ. / ISO / dd/mm/yyyy)
// ============================================================
export function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null
  // ISO-ish: YYYY-MM-DD [THH:mm[:ss]]
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    let [, y, mo, d, hh = '0', mi = '0', ss = '0'] = m
    let year = parseInt(y, 10)
    if (year > 2400) year -= 543 // พ.ศ. → ค.ศ.
    const dt = new Date(Date.UTC(year, parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mi, 10), parseInt(ss, 10)))
    return isNaN(dt.getTime()) ? null : dt
  }
  // dd/mm/yyyy หรือ dd-mm-yyyy (ไทย: วันก่อนเดือน)
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[T\s](\d{1,2}):(\d{2}))?$/)
  if (m) {
    const [, d, mo, yRaw, hh = '0', mi = '0'] = m
    let year = parseInt(yRaw, 10)
    if (year < 100) year += 2500
    if (year > 2400) year -= 543
    const dt = new Date(Date.UTC(year, parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mi, 10)))
    return isNaN(dt.getTime()) ? null : dt
  }
  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

function parseIntSafe(raw: string): number | null {
  const n = parseInt(raw.replace(/[,\s]/g, ''), 10)
  return isNaN(n) ? null : n
}
function parseFloatSafe(raw: string): number | null {
  const n = parseFloat(raw.replace(/[,\s]/g, ''))
  return isNaN(n) ? null : n
}

// ============================================================
// 4) แคตตาล็อกโมดูล (แหล่งความจริงเดียว — LLM และ import engine ใช้ร่วมกัน)
// ============================================================
const F = (key: string, label: string, type: FieldType, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type, ...extra })

export const IMPORT_MODULES: Record<string, ModuleDef> = {
  incidents: {
    key: 'incidents', label: 'เหตุการณ์ภัยพิบัติ', model: 'incident', codePrefix: 'INC',
    description: 'เหตุการณ์ภัยพิบัติ เช่น น้ำท่วมรายจังหวัด/รายพื้นที่ พร้อมตัวเลขผู้กระทบ',
    fields: [
      F('title', 'ชื่อเหตุการณ์', 'string', { required: true }),
      F('type', 'ประเภทภัย', 'enum', { enumValues: ['flood', 'earthquake', 'fire', 'landslide', 'storm', 'drought', 'epidemic', 'other'], enumLabels: INCIDENT_TYPE_LABELS, default: 'other' }),
      F('severity', 'ระดับความรุนแรง', 'enum', { enumValues: ['low', 'medium', 'high', 'critical'], enumLabels: SEV_LABELS, default: 'medium' }),
      F('status', 'สถานะ', 'enum', { enumValues: ['active', 'monitoring', 'resolved', 'closed'], enumLabels: INCIDENT_STAT_LABELS, default: 'active' }),
      F('description', 'รายละเอียด', 'string'),
      F('locationName', 'พื้นที่ (จังหวัด/อำเภอ)', 'relation', { relation: 'location', target: 'locationId', createIfMissing: true, defaultLevel: 'province', hint: 'ชื่อพื้นที่เป็นข้อความ เช่น นครสวรรค์' }),
      F('lat', 'ละติจูด', 'float'), F('lng', 'ลองจิจูด', 'float'),
      F('affectedPeople', 'ผู้ประสบภัย (คน)', 'int', { default: 0 }),
      F('injured', 'บาดเจ็บ (คน)', 'int', { default: 0 }),
      F('deceased', 'เสียชีวิต (คน)', 'int', { default: 0 }),
      F('startDate', 'วันที่เริ่ม', 'date', { hint: 'ISO หรือ พ.ศ. ก็ได้ ระบบแปลงให้' }),
      F('endDate', 'วันที่สิ้นสุด', 'date'),
    ],
  },
  locations: {
    key: 'locations', label: 'ตำแหน่งที่ตั้ง (GIS)', model: 'location',
    description: 'ทะเบียนตำแหน่งที่ตั้ง ระดับจังหวัด/อำเภอ/ตำบล พร้อมพิกัด',
    fields: [
      F('name', 'ชื่อสถานที่', 'string', { required: true }),
      F('level', 'ระดับ', 'enum', { enumValues: ['province', 'district', 'subdistrict'], enumLabels: LOCATION_LEVEL_LABELS, default: 'province' }),
      F('lat', 'ละติจูด', 'float'), F('lng', 'ลองจิจูด', 'float'),
      F('parentName', 'จังหวัดแม่', 'relation', { relation: 'location', target: 'parentId', hint: 'ชื่อจังหวัด/พื้นที่แม่ (ต้องมีอยู่ก่อน)' }),
    ],
  },
  shelters: {
    key: 'shelters', label: 'ศูนย์พักพิง', model: 'shelter',
    description: 'ศูนย์พักพิง/ศูนย์อพยพ พร้อมความจุและจำนวนผู้อยู่ปัจจุบัน',
    fields: [
      F('name', 'ชื่อศูนย์พักพิง', 'string', { required: true }),
      F('type', 'ประเภท', 'enum', { enumValues: ['school', 'temple', 'community_center', 'stadium', 'tent', 'hotel'], enumLabels: SHELTER_TYPE_LABELS, default: 'community_center' }),
      F('address', 'ที่อยู่', 'string'),
      F('locationName', 'จังหวัด/พื้นที่', 'relation', { relation: 'location', target: 'locationId', createIfMissing: true, defaultLevel: 'province' }),
      F('capacity', 'ความจุ (คน)', 'int', { default: 0 }),
      F('currentOccupancy', 'ผู้อยู่ปัจจุบัน (คน)', 'int', { default: 0 }),
      F('contactPerson', 'ผู้ประสานงาน', 'string'),
      F('phone', 'โทรศัพท์', 'string'),
      F('status', 'สถานะ', 'enum', { enumValues: ['open', 'full', 'closed', 'preparing'], enumLabels: SHELTER_STAT_LABELS, default: 'open' }),
      F('facilities', 'สิ่งอำนวยความสะดวก', 'string', { hint: 'คั่นจุลภาค เช่น water, electricity, medical' }),
      F('lat', 'ละติจูด', 'float'), F('lng', 'ลองจิจูด', 'float'),
    ],
  },
  persons: {
    key: 'persons', label: 'ทะเบียนบุคคล (ผู้ประสบภัย)', model: 'person',
    description: 'ผู้ประสบภัย/สูญหาย/ผู้อพยพ พร้อมสถานะการพบตัว',
    fields: [
      F('firstName', 'ชื่อ', 'string', { required: true }),
      F('lastName', 'นามสกุล', 'string', { required: true }),
      F('nationalId', 'เลขบัตรประชาชน', 'string'),
      F('gender', 'เพศ', 'enum', { enumValues: ['male', 'female', 'other', 'unknown'], enumLabels: GENDER_LABELS, default: 'unknown' }),
      F('age', 'อายุ', 'int'),
      F('phone', 'โทรศัพท์', 'string'),
      F('address', 'ที่อยู่', 'string'),
      F('status', 'สถานะ', 'enum', { enumValues: ['missing', 'found', 'safe', 'injured', 'deceased', 'evacuated'], enumLabels: PERSON_STAT_LABELS, default: 'safe' }),
      F('lastSeenLocation', 'พบล่าสุด (สถานที่)', 'string'),
      F('lastSeenAt', 'พบล่าสุด (วันที่)', 'date'),
      F('shelterName', 'ศูนย์พักพิง', 'relation', { relation: 'shelter', target: 'shelterId', hint: 'ชื่อศูนย์พักพิงที่มีในระบบ' }),
      F('incidentCode', 'รหัสเหตุการณ์', 'relation', { relation: 'incident', target: 'incidentId', hint: 'เช่น INC-2569-005 หรือชื่อเหตุการณ์' }),
      F('notes', 'หมายเหตุ', 'string'),
    ],
  },
  organizations: {
    key: 'organizations', label: 'องค์กรภาคี', model: 'organization',
    description: 'หน่วยงานราชการ/เอ็นจีโอ/เอกชนที่เข้าร่วมบรรเทาทุกข์',
    fields: [
      F('name', 'ชื่อองค์กร', 'string', { required: true }),
      F('type', 'ประเภท', 'enum', { enumValues: ['government', 'ngo', 'international', 'private', 'community'], enumLabels: ORG_TYPE_LABELS, default: 'ngo' }),
      F('sector', 'ภาคส่วน', 'enum', { enumValues: ['health', 'water', 'food', 'education', 'logistics', 'search_rescue', 'other'], enumLabels: ORG_SECTOR_LABELS }),
      F('contactPerson', 'ผู้ประสานงาน', 'string'),
      F('phone', 'โทรศัพท์', 'string'), F('email', 'อีเมล', 'string'),
      F('address', 'ที่อยู่', 'string'), F('website', 'เว็บไซต์', 'string'),
      F('description', 'รายละเอียด', 'string'),
    ],
  },
  humanResources: {
    key: 'humanResources', label: 'บุคลากร/อาสาสมัคร', model: 'humanResource',
    description: 'เจ้าหน้าที่/อาสาสมัคร/ทีมปฏิบัติการในสังกัดองค์กร',
    fields: [
      F('name', 'ชื่อ-นามสกุล', 'string', { required: true }),
      F('type', 'ประเภท', 'enum', { enumValues: ['staff', 'volunteer', 'trainee'], enumLabels: HR_TYPE_LABELS, default: 'volunteer' }),
      F('jobTitle', 'ตำแหน่ง', 'string'),
      F('organizationName', 'องค์กร', 'relation', { relation: 'organization', target: 'organizationId', createIfMissing: true }),
      F('phone', 'โทรศัพท์', 'string'), F('email', 'อีเมล', 'string'),
      F('skills', 'ทักษะ', 'string', { hint: 'คั่นจุลภาค เช่น แพทย์,ปฐมพยาบาล' }),
      F('status', 'สถานะ', 'enum', { enumValues: ['available', 'assigned', 'on_mission', 'unavailable'], enumLabels: HR_STAT_LABELS, default: 'available' }),
      F('baseLocation', 'ฐานปฏิบัติการ', 'string'),
    ],
  },
  warehouses: {
    key: 'warehouses', label: 'คลังสินค้า', model: 'warehouse',
    description: 'คลังสิ่งของ/เวชภัณฑ์ของหน่วยงาน',
    fields: [
      F('name', 'ชื่อคลัง', 'string', { required: true }),
      F('purpose', 'ประเภท/วัตถุประสงค์', 'string'),
      F('address', 'ที่อยู่', 'string'),
      F('manager', 'ผู้รับผิดชอบ', 'string'),
      F('phone', 'โทรศัพท์', 'string'),
      F('capacity', 'ความจุ (หน่วย)', 'int', { default: 0 }),
      F('organizationName', 'หน่วยงานเจ้าของ', 'relation', { relation: 'organization', target: 'organizationId', createIfMissing: true }),
    ],
  },
  inventoryItems: {
    key: 'inventoryItems', label: 'สินค้า/เวชภัณฑ์ (คลัง)', model: 'inventoryItem',
    description: 'รายการสินค้าในคลัง พร้อมปริมาณและจุดต่ำ',
    fields: [
      F('name', 'ชื่อสินค้า', 'string', { required: true }),
      F('category', 'หมวด', 'enum', { enumValues: ['food', 'water', 'medical', 'clothing', 'shelter', 'tools', 'fuel', 'relief', 'hygiene', 'other'], enumLabels: INV_CAT_LABELS, default: 'other' }),
      F('type', 'ประเภทบรรจุ', 'string', { hint: 'เช่น ขวด, ถุง, ชุด' }),
      F('size', 'ขนาด', 'string', { hint: 'เช่น 600ml, 5 กก.' }),
      F('unit', 'หน่วยนับ', 'string', { default: 'ชิ้น' }),
      F('quantity', 'จำนวน', 'int', { default: 0 }),
      F('minQuantity', 'จุดต่ำ', 'int', { default: 0 }),
      F('warehouseName', 'คลัง', 'relation', { relation: 'warehouse', target: 'warehouseId', createIfMissing: true }),
      F('expiryDate', 'วันหมดอายุ', 'date'),
    ],
  },
  aidRequests: {
    key: 'aidRequests', label: 'คำขอความช่วยเหลือ', model: 'aidRequest', codePrefix: 'REQ',
    description: 'คำขอความช่วยเหลือจากพื้นที่/หน่วยงาน พร้อมความด่วน',
    fields: [
      F('requesterName', 'ผู้ขอ', 'string', { required: true }),
      F('requesterOrg', 'หน่วยงานผู้ขอ', 'string'),
      F('type', 'ประเภทความช่วยเหลือ', 'enum', { enumValues: ['food', 'water', 'medical', 'shelter', 'evacuation', 'search_rescue', 'other'], enumLabels: REQ_TYPE_LABELS, default: 'other' }),
      F('priority', 'ความด่วน', 'enum', { enumValues: ['low', 'medium', 'high', 'urgent'], enumLabels: REQ_PRIORITY_LABELS, default: 'medium' }),
      F('status', 'สถานะ', 'enum', { enumValues: ['pending', 'approved', 'in_progress', 'fulfilled', 'rejected'], enumLabels: REQ_STAT_LABELS, default: 'pending' }),
      F('quantity', 'ปริมาณ', 'string', { hint: 'ข้อความ เช่น 500 ชุด' }),
      F('description', 'รายละเอียด', 'string'),
      F('locationName', 'พื้นที่', 'string', { hint: 'ชื่อพื้นที่เป็นข้อความ' }),
      F('incidentCode', 'รหัสเหตุการณ์', 'relation', { relation: 'incident', target: 'incidentId' }),
    ],
  },
  alerts: {
    key: 'alerts', label: 'การแจ้งเตือนภัย', model: 'alert',
    description: 'ข้อความแจ้งเตือน (บันทึกเป็นฉบับร่างเสมอ — ต้องกดส่งเองในโมดูลแจ้งเตือน)',
    fields: [
      F('title', 'หัวข้อ', 'string', { required: true }),
      F('message', 'ข้อความ', 'string', { required: true }),
      F('channel', 'ช่องทาง', 'enum', { enumValues: ['sms', 'email', 'broadcast', 'app'], enumLabels: ALERT_CHANNEL_LABELS, default: 'broadcast' }),
      F('severity', 'ระดับความรุนแรง', 'enum', { enumValues: ['info', 'warning', 'critical'], enumLabels: ALERT_SEV_LABELS, default: 'warning' }),
      F('audience', 'กลุ่มผู้รับ', 'enum', { enumValues: ['all', 'area', 'volunteers', 'officers'], enumLabels: AUDIENCE_LABELS, default: 'all' }),
      F('incidentCode', 'รหัสเหตุการณ์', 'relation', { relation: 'incident', target: 'incidentId' }),
    ],
  },
  incidentReports: {
    key: 'incidentReports', label: 'รายงานสถานการณ์ (SITREP)', model: 'incidentReport',
    description: 'รายงานสถานการณ์/สรุปเหตุการณ์เชิงพรรณนา',
    fields: [
      F('title', 'หัวข้อรายงาน', 'string', { required: true }),
      F('content', 'เนื้อหา', 'string', { required: true }),
      F('author', 'ผู้รายงาน', 'string', { default: 'ผู้ปฏิบัติงาน' }),
      F('status', 'สถานะ', 'enum', { enumValues: ['draft', 'published'], enumLabels: REPORT_STAT_LABELS, default: 'published' }),
      F('incidentCode', 'รหัสเหตุการณ์', 'relation', { relation: 'incident', target: 'incidentId' }),
    ],
  },
}

/** ข้อความแคตตาล็อกสำหรับ prompt LLM (กระชับ) */
export function moduleCatalogPrompt(): string {
  const lines: string[] = []
  for (const m of Object.values(IMPORT_MODULES)) {
    const fs = m.fields.map((f) => {
      const opts = f.enumValues ? `(${f.enumValues.join('|')})` : ''
      const req = f.required ? '*' : ''
      return `${f.key}${req}${opts}`
    })
    lines.push(`- ${m.key} (${m.label}): ${fs.join(', ')}`)
  }
  return lines.join('\n')
}

// ============================================================
// 5) normalize record (ฝั่งเซิร์ฟเวอร์ — ใช้กับ output ของ LLM mapping)
// ============================================================
export function normalizeRecord(mod: ModuleDef, raw: Record<string, unknown>): { data: Record<string, unknown>; relations: NormalizedRow['relations']; errors: string[] } {
  const data: Record<string, unknown> = {}
  const relations: NormalizedRow['relations'] = []
  const errors: string[] = []

  for (const f of mod.fields) {
    let v = raw[f.key]
    if (typeof v === 'number') v = String(v)
    if (typeof v !== 'string' || v.trim() === '') {
      // ว่าง → ใช้ default ถ้ามี (เฉพาะ scalar)
      if (f.default !== undefined && f.type !== 'relation') data[f.key] = f.default
      else if (f.required) errors.push(`ขาดช่องบังคับ "${f.label}"`)
      continue
    }
    const s = v.trim().slice(0, 4000)
    switch (f.type) {
      case 'int': {
        const n = parseIntSafe(s)
        if (n === null) errors.push(`"${f.label}" ต้องเป็นตัวเลข (ได้รับ "${s}")`)
        else data[f.key] = n
        break
      }
      case 'float': {
        const n = parseFloatSafe(s)
        if (n === null) errors.push(`"${f.label}" ต้องเป็นตัวเลข (ได้รับ "${s}")`)
        else data[f.key] = n
        break
      }
      case 'date': {
        const d = parseFlexibleDate(s)
        if (!d) errors.push(`"${f.label}" รูปแบบวันที่ไม่ถูกต้อง ("${s}")`)
        else data[f.key] = d
        break
      }
      case 'enum': {
        const ev = matchEnum(s, f)
        if (!ev) errors.push(`"${f.label}" ค่า "${s}" ไม่ตรงกับตัวเลือกที่รองรับ (${f.enumValues?.join(', ')})`)
        else data[f.key] = ev
        break
      }
      case 'relation': {
        if (!f.relation || !f.target) break
        relations.push({ kind: f.relation, target: f.target, value: s, createIfMissing: !!f.createIfMissing, defaultLevel: f.defaultLevel })
        break
      }
      default:
        data[f.key] = s
    }
  }
  return { data, relations, errors }
}

// ============================================================
// 6) relation resolver
// ============================================================
function delegate(model: ModuleDef['model']): DelegateLike {
  return db[model] as unknown as DelegateLike
}

async function resolveRelation(rel: NormalizedRow['relations'][number], userName: string): Promise<{ id: string | null; warning?: string }> {
  const val = rel.value.trim()
  if (!val) return { id: null }

  if (rel.kind === 'location') {
    const found = await db.location.findFirst({ where: { deleted: false, name: { equals: val } } })
    if (found) return { id: found.id }
    if (rel.createIfMissing) {
      const created = await db.location.create({
        data: { name: val.slice(0, 120), level: rel.defaultLevel ?? 'province', createdBy: userName, updatedBy: userName },
      })
      return { id: created.id, warning: `สร้างพื้นที่ใหม่อัตโนมัติ: ${val}` }
    }
    return { id: null, warning: `ไม่พบพื้นที่ "${val}" — ปล่อยว่าง` }
  }

  if (rel.kind === 'shelter') {
    const found = await db.shelter.findFirst({ where: { deleted: false, name: { equals: val } } })
    if (found) return { id: found.id }
    return { id: null, warning: `ไม่พบศูนย์พักพิง "${val}" — ปล่อยว่าง` }
  }

  if (rel.kind === 'incident') {
    const byCode = await db.incident.findFirst({ where: { deleted: false, code: { equals: val.toUpperCase() } } })
    if (byCode) return { id: byCode.id }
    const byTitle = await db.incident.findFirst({ where: { deleted: false, title: { contains: val } } })
    if (byTitle) return { id: byTitle.id }
    return { id: null, warning: `ไม่พบเหตุการณ์ "${val}" — ปล่อยว่าง` }
  }

  if (rel.kind === 'warehouse') {
    const found = await db.warehouse.findFirst({ where: { deleted: false, name: { equals: val } } })
    if (found) return { id: found.id }
    if (rel.createIfMissing) {
      const created = await db.warehouse.create({ data: { name: val.slice(0, 120), createdBy: userName, updatedBy: userName } })
      return { id: created.id, warning: `สร้างคลังใหม่อัตโนมัติ: ${val}` }
    }
    return { id: null, warning: `ไม่พบคลัง "${val}"` }
  }

  // organization
  const found = await db.organization.findFirst({ where: { deleted: false, name: { equals: val } } })
  if (found) return { id: found.id }
  if (rel.createIfMissing) {
    const created = await db.organization.create({ data: { name: val.slice(0, 120), type: 'ngo', createdBy: userName, updatedBy: userName } })
    return { id: created.id, warning: `สร้างองค์กรใหม่อัตโนมัติ: ${val}` }
  }
  return { id: null, warning: `ไม่พบองค์กร "${val}"` }
}

/** สร้างรหัสลำดับถัดไป เช่น INC-2569-006 */
async function nextCode(prefix: 'INC' | 'REQ'): Promise<string> {
  const yearBE = new Date().getFullYear() + 543
  const prefixFull = `${prefix}-${yearBE}-`
  if (prefix === 'INC') {
    const rows = await db.incident.findMany({ where: { code: { startsWith: prefixFull } }, select: { code: true } })
    const max = rows.reduce((acc, r) => {
      const n = parseInt(r.code.slice(prefixFull.length), 10)
      return isNaN(n) ? acc : Math.max(acc, n)
    }, 0)
    return `${prefixFull}${String(max + 1).padStart(3, '0')}`
  }
  const rows = await db.aidRequest.findMany({ where: { requestCode: { startsWith: prefixFull } }, select: { requestCode: true } })
  const max = rows.reduce((acc, r) => {
    const n = parseInt(r.requestCode.slice(prefixFull.length), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `${prefixFull}${String(max + 1).padStart(3, '0')}`
}

// ============================================================
// 7) import engine
// ============================================================
export async function importRecords(moduleKey: string, rawRecords: Record<string, unknown>[], userName: string): Promise<ImportResult> {
  const mod = IMPORT_MODULES[moduleKey]
  if (!mod) throw new Error('ไม่พบโมดูลที่ระบุ')
  if (rawRecords.length === 0) throw new Error('ไม่มีข้อมูลให้นำเข้า')
  if (rawRecords.length > MAX_IMPORT_ROWS) throw new Error(`จำกัดไม่เกิน ${MAX_IMPORT_ROWS} แถวต่อการนำเข้า`)

  const result: ImportResult = { created: 0, skipped: 0, failed: [], createdNames: [] }
  const warnings = new Set<string>()

  for (let i = 0; i < rawRecords.length; i++) {
    const rowNo = i + 1
    try {
      const { data, relations, errors } = normalizeRecord(mod, rawRecords[i])

      // ข้ามแถวว่างเปล่า (ไม่มีทั้ง scalar และ relation)
      if (Object.keys(data).length === 0 && relations.length === 0) { result.skipped++; continue }

      if (errors.length > 0) {
        result.failed.push({ row: rowNo, error: errors.join(' · ') })
        continue
      }

      // กันซ้ำสำหรับ entity ที่ใช้ชื่อเป็นคีย์ธรรมชาติ
      if (mod.model === 'location' || mod.model === 'shelter' || mod.model === 'warehouse' || mod.model === 'organization') {
        const name = String(data.name ?? '').trim()
        if (name) {
          const existing = await (delegate(mod.model) as DelegateLike).findFirst({ where: { deleted: false, name } })
          if (existing) {
            result.skipped++
            result.createdNames.push(`(ข้าม — มีอยู่แล้ว) ${name}`)
            continue
          }
        }
      }

      // resolve relations
      for (const rel of relations) {
        const r = await resolveRelation(rel, userName)
        if (r.id) data[rel.target] = r.id
        if (r.warning) warnings.add(r.warning)
      }

      // เฉพาะโมดูล
      if (mod.model === 'incident') {
        data.code = await nextCode('INC')
      }
      if (mod.model === 'aidRequest') {
        data.requestCode = await nextCode('REQ')
      }
      if (mod.model === 'alert') {
        data.status = 'draft' // นโยบายความปลอดภัย: นำเข้าแล้วเป็นฉบับร่างเสมอ ต้องกดส่งเอง
        data.createdBy = userName
        data.updatedBy = userName
      }
      if (mod.model === 'inventoryItem') {
        if (typeof data.quantity !== 'number') data.quantity = 0
        if (typeof data.minQuantity !== 'number') data.minQuantity = 0
        if (!data.unit) data.unit = 'ชิ้น'
        if (!data.category) data.category = 'other'
      }
      if (mod.model === 'person' && !data.status) data.status = 'safe'

      data.createdBy = userName
      data.updatedBy = userName

      const occupancy = mod.model === 'shelter' ? (typeof data.currentOccupancy === 'number' ? data.currentOccupancy : 0) : 0
      if (mod.model === 'shelter' && typeof data.currentOccupancy !== 'number') data.currentOccupancy = 0
      if (mod.model === 'shelter' && typeof data.capacity !== 'number') data.capacity = 0
      if (mod.model === 'incident' && typeof data.affectedPeople !== 'number') data.affectedPeople = 0
      if (mod.model === 'incident' && typeof data.injured !== 'number') data.injured = 0
      if (mod.model === 'incident' && typeof data.deceased !== 'number') data.deceased = 0
      if (mod.model === 'incident' && !(data.startDate instanceof Date)) data.startDate = new Date()

      const created = await (delegate(mod.model) as DelegateLike).create({ data })

      // ledger สำหรับศูนย์พักพิง: ยอดเริ่มต้น > 0 → บันทึก movement ให้สอดคล้อง G4
      if (mod.model === 'shelter' && occupancy > 0) {
        await db.shelterOccupancy.create({
          data: {
            shelterId: String(created.id),
            delta: occupancy,
            count: occupancy,
            note: 'ยอดเริ่มต้นจากการนำเข้าข้อมูล (ผู้ช่วย AI)',
            createdBy: userName,
          },
        })
      }

      result.created++
      const displayName = String(data.name ?? data.title ?? (data.firstName ? `${data.firstName} ${String(data.lastName ?? '')}`.trim() : '') ?? '')
      result.createdNames.push(displayName || `แถวที่ ${rowNo}`)
    } catch (e) {
      result.failed.push({ row: rowNo, error: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' })
    }
  }

  await audit(
    'import',
    mod.key,
    `นำเข้าข้อมูล "${mod.label}" ผ่านผู้ช่วย AI — สำเร็จ ${result.created} · ข้าม ${result.skipped} · ล้มเหลว ${result.failed.length} (ผู้ใช้: ${userName})`,
    userName,
  )
  if (warnings.size > 0) result.createdNames.push(...[...warnings].slice(0, 10).map((w) => `(หมายเหตุ) ${w}`))
  return result
}

// ============================================================
// 8) Staging job (in-memory — one-shot, TTL 30 นาที)
// ============================================================
export interface ImportJob {
  id: string
  moduleKey: string
  moduleLabel: string
  source: 'file' | 'url' | 'text' | 'search'
  fileName: string
  records: Record<string, unknown>[]
  warnings: string[]
  createdAt: number
}

const JOBS_KEY = '__edenImportJobs'
interface JobStore { map: Map<string, ImportJob> }
function jobStore(): Map<string, ImportJob> {
  const g = globalThis as unknown as { [JOBS_KEY]?: Map<string, ImportJob> }
  if (!g[JOBS_KEY]) g[JOBS_KEY] = new Map()
  return g[JOBS_KEY]
}

export function saveJob(job: Omit<ImportJob, 'id' | 'createdAt'>): ImportJob {
  const store = jobStore()
  const now = Date.now()
  // ล้าง job เก่าเกิน 30 นาที
  for (const [k, v] of store) if (now - v.createdAt > 30 * 60 * 1000) store.delete(k)
  // เก็บสูงสุด 20 job
  if (store.size >= 20) {
    const oldest = [...store.values()].sort((a, b) => a.createdAt - b.createdAt)[0]
    if (oldest) store.delete(oldest.id)
  }
  const full: ImportJob = { ...job, id: `job_${now}_${Math.random().toString(36).slice(2, 10)}`, createdAt: now }
  store.set(full.id, full)
  return full
}

/** ดึง job (แบบ one-shot — ดึงแล้วลบทันที เพื่อไม่ให้นำเข้าซ้ำ) */
export function takeJob(id: string): ImportJob | null {
  const job = jobStore().get(id)
  if (!job) return null
  jobStore().delete(id)
  return job
}

/** ดึง job แบบอ่านอย่างเดียว (สำหรับแสดงผลซ้ำ) */
export function peekJob(id: string): ImportJob | null {
  return jobStore().get(id) ?? null
}
