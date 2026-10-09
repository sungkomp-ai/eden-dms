import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'
import {
  IMPORT_MODULES, moduleCatalogPrompt, MAX_IMPORT_ROWS, PREVIEW_ROWS,
  saveJob, parseFlexibleDate, normalizeRecord, type ModuleDef,
} from '@/lib/data-import'
import { createAiTask, taskPhase, taskDone, taskFail, handleTaskStatus, withTimeout, type AiTask } from '@/lib/ai-tasks'
import ZAI from 'z-ai-web-dev-sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================================
// POST /api/ai-assistant/search-import
// วงจร "ค้นหาภายนอกตามเงื่อนไข → วิเคราะห์ด้วย LLM → แยก record ตามโครงสร้าง
// แต่ละโมดูล (ได้หลายโมดูล) → ตรวจเงื่อนไข/ปรับรูปแบบฝั่งเซิร์ฟเวอร์ → พรีวิว → นำเข้า"
//
// ทำงานแบบ async task เหมือน /extract (Task 23):
// POST ตรวจ input แล้วคืน { taskId } ทันที — งานนาน (web_search / อ่านเว็บ / LLM)
// รันเบื้องหลังใน runSearchImport พร้อม taskPhase ภาษาไทยทุก stage
// client ติดตามด้วย GET ?taskId= (ทุก HTTP request สั้นเสมอ จึงไม่โดน proxy timeout)
// ============================================================

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

interface SearchImportInput {
  query: string
  province: string
  from: string
  to: string
  module: string
  readPages: boolean
}

interface SearchResultItem { name?: string; url?: string; snippet?: string; host_name?: string; date?: string }

interface LlmGroup { module?: string; records?: unknown }
interface LlmAnalysis {
  analysis?: string
  skippedCount?: number
  warnings?: unknown
  groups?: LlmGroup[]
}

const SEARCH_TIMEOUT_MS = 15_000
const LLM_TIMEOUT_MS = 100_000
const PAGE_TEXT_CHARS = 6000 // ตัดเนื้อหาต่อเพจ
const PAGES_TOTAL_CHARS = 12_000 // ตัดเนื้อหาเว็บรวม
const MAX_ROWS_PER_GROUP = 200
const MAX_GROUPS = 4
const DAY_MS = 86_400_000

// ---------- helpers ----------

function safeHost(url: string): string {
  try { return new URL(url).hostname } catch { return '-' }
}

function maybeDateMs(s: string): number | null {
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** อ่านเนื้อหาเว็บเพจ: page_reader ก่อน → fallback fetch ตรง + ตัด HTML */
async function readPageContext(url: string): Promise<{ title: string; text: string; publishedTime: string } | null> {
  try {
    const zai = await getZAI()
    const result = (await zai.functions.invoke('page_reader', { url })) as {
      data?: { title?: string; html?: string; publishedTime?: string }
    }
    const title = result?.data?.title ?? ''
    const text = htmlToText(result?.data?.html ?? '')
    if (text) return { title, text: text.slice(0, PAGE_TEXT_CHARS), publishedTime: result?.data?.publishedTime ?? '' }
  } catch (e) {
    console.error('[ai-assistant/search-import] page_reader fallback fetch', e)
  }
  // fallback: fetch ตรง + ตัด html
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15_000)
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'EDEN-DMS-Assistant/1.0' } })
    clearTimeout(timer)
    if (!res.ok) return null
    const text = htmlToText(await res.text())
    if (!text) return null
    return { title: '', text: text.slice(0, PAGE_TEXT_CHARS), publishedTime: '' }
  } catch {
    return null
  }
}

function extractJson(text: string): LlmAnalysis | null {
  // 1) parse ตรง ๆ
  try { return JSON.parse(text) as LlmAnalysis } catch { /* ลองวิธีอื่น */ }
  let s = text.replace(/```(?:json)?/gi, '').trim()
  // 2) ตัดส่วนเกินรอบนอก แล้วลอง match วงเล็บปีกกา
  const start = s.indexOf('{')
  if (start > 0) s = s.slice(start)
  const m = s.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) as LlmAnalysis } catch { /* output อาจถูกตัดกลางคัน */ }
  }
  // 3) กู้ JSON ที่ถูกตัดกลางคัน (LLM โดนจำกัด token) — ตัดส่วนท้ายที่ไม่สมบูรณ์แล้วปิดวงเล็บให้ครบ
  const repaired = repairTruncatedJson(s)
  if (repaired) {
    try { return JSON.parse(repaired) as LlmAnalysis } catch { /* ยอมแพ้ */ }
  }
  return null
}

/** สแกนแบบ string-aware เติม } ] ปิดท้ายให้ครบ (คืน null ถ้าโครงสร้างเพี้ยนกู้ไม่ได้) */
function closeBrackets(s: string): string | null {
  const stack: string[] = []
  let inStr = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']')
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) return null
    }
  }
  if (inStr || esc) return null
  let out = s.replace(/[:,\s]+$/, '')
  while (stack.length > 0) out += stack.pop()
  return out
}

/** กู้ JSON ที่ถูกตัด: ตัด chunk ท้ายที่ไม่สมบูรณ์ทีละชิ้น (จนกว่าจะปิดวงเล็บแล้ว parse ผ่าน) */
function repairTruncatedJson(s: string): string | null {
  let frag = s.trim()
  for (let attempt = 0; attempt < 60; attempt++) {
    const fixed = closeBrackets(frag)
    if (fixed) {
      try { JSON.parse(fixed); return fixed } catch { /* ยังไม่ valid — ตัดท้ายต่อ */ }
    }
    const cutAt = Math.max(
      frag.lastIndexOf(','), frag.lastIndexOf('{'), frag.lastIndexOf('['),
      frag.lastIndexOf(':'), frag.lastIndexOf('"'),
    )
    if (cutAt <= 0) return null
    frag = frag.slice(0, cutAt).replace(/[,:\s]+$/, '')
  }
  return null
}

function buildAnalysisPrompt(input: SearchImportInput, searchText: string, pagesText: string): string {
  return `คุณเป็นนักวิเคราะห์ข้อมูลภัยพิบัติของระบบ EDEN DMS
งาน: อ่าน "ผลค้นหาจากภายนอก" และ "เนื้อหาเว็บเพจ" ด้านล่าง แล้วดึงเฉพาะข้อเท็จจริงที่นำเข้าระบบได้จริง (เหตุการณ์ สถิติ ศูนย์พักพิง คำขอช่วยเหลือ ฯลฯ) ออกมาเป็น records ตามโครงสร้างฟิลด์ของโมดูลในแคตตาล็อก

### เงื่อนไขที่ผู้ใช้กำหนด (ต้องกรองตามนี้เคร่งครัด)
- คำค้นหา: ${input.query}
- พื้นที่: ${input.province || '(ไม่ระบุ)'}   ← ถ้าระบุ เอาเฉพาะข้อมูลของพื้นที่นี้เท่านั้น
- ช่วงวันที่: ${input.from || '(ไม่ระบุ)'} ถึง ${input.to || '(ไม่ระบุ)'}   ← ถ้าระบุ เอาเฉพาะเหตุการณ์ในช่วงนี้
- โมดูลเป้าหมาย: ${input.module || '(ให้ AI เลือกเองตามความเหมาะสม)'}

### แคตตาล็อกโมดูล (ฟิลด์ที่มี * = บังคับต้องมีค่า)
${moduleCatalogPrompt()}

### กติกา
1. ใช้เฉพาะข้อเท็จจริงที่ปรากฏในแหล่งข้อมูลด้านล่างเท่านั้น ห้ามเดาหรือแต่งตัวเลข — ไม่พบข้อมูลจริงให้ groups เป็น []
2. แบ่งเป็นกลุ่มตามโมดูล (groups) กลุ่มละ 1 โมดูล เรียงโมดูลสำคัญสุดก่อน (เช่น incidents ก่อน incidentReports) — ไม่เกิน 4 กลุ่ม และกลุ่มละไม่เกิน 50 records
3. ค่า enum เขียนภาษาไทยหรืออังกฤษก็ได้ (ระบบแปลงให้ เช่น น้ำท่วม→flood, สูง→high, สูญหาย→missing)
4. วันที่คงรูปเดิมจากแหล่งข้อมูลได้ (ระบบแปลง พ.ศ./ค.ศ. ให้ เช่น "7 ต.ค. 2569")
5. กรอกฟิลด์ให้ครบเท่าที่แหล่งข้อมูลมี โดยเฉพาะฟิลด์บังคับ* — ถ้าข้อมูลไม่พอสำหรับฟิลด์บังคับ ให้ข้าม record นั้นไป (นับใน skippedCount)
6. ที่มา: ปิดท้ายฟิลด์ข้อความเชิงพรรณนา (เช่น description, notes) ด้วย "(ที่มา: ชื่อแหล่งข้อมูล)" สั้น ๆ
7. ห้ามแต่งรหัสที่ไม่ปรากฏจริง — โดยเฉพาะ incidentCode (รหัสเหตุการณ์ของระบบรูปแบบ INC-xxxx-xxx): ถ้าแหล่งข้อมูลไม่ได้ระบุรหัสของระบบจริง ๆ ให้ปล่อยว่าง อย่าเดา อย่าใส่ INC_001 หรือรหัสลักษณะเดียวกัน
8. ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น และเขียนแบบกระชับ (บรรทัดเดียว ไม่ต้อง indent ห้ามครอบด้วย markdown code fence):
{"analysis":"สรุปภาษาไทย 2-4 ประโยค: พบอะไร ใช้เงื่อนไขใดกรอง ได้กี่ record","skippedCount":0,"warnings":["หมายเหตุสั้น ๆ ถ้ามี"],"groups":[{"module":"<module key>","records":[{"<ฟิลด์>":"<ค่า>"}]}]}

### ผลค้นหาจากภายนอก (web search)
${searchText}

### เนื้อหาเว็บเพจที่อ่านได้
${pagesText || '(ไม่มี — ใช้เฉพาะผลค้นหาด้านบน)'}`
}

/** ตรวจช่วงวันที่: มีวันที่ parse ได้อย่างน้อย 1 ค่าและ "ทุกค่าอยู่นอกช่วง" → ตัด
 * record ที่ไม่มีวันที่เลย หรือแปลงไม่ได้เลย = เก็บไว้ */
function isOutsideDateWindow(mod: ModuleDef, rec: Record<string, unknown>, winFrom: number | null, winTo: number | null): boolean {
  const dateFields = mod.fields.filter((f) => f.type === 'date')
  if (dateFields.length === 0) return false
  let sawDate = false
  for (const f of dateFields) {
    const v = rec[f.key]
    if (typeof v !== 'string' || !v) continue
    const d = parseFlexibleDate(v)
    if (!d) continue
    sawDate = true
    const t = d.getTime()
    if ((winFrom !== null && t < winFrom) || (winTo !== null && t > winTo)) continue // ค่านี้อยู่นอกช่วง — ดูค่าอื่นต่อ
    return false // มีอย่างน้อย 1 วันที่อยู่ในช่วง → ผ่านเงื่อนไข
  }
  return sawDate // มีวันที่แต่ทุกค่าอยู่นอกช่วง → ตัด
}

const AREA_KEY_RE = /location|address|area|base|Name/i
const AREA_LABEL_RE = /พื้นที่|จังหวัด|ที่อยู่/

/** ค่า placeholder ที่ LLM มักยัดใส่แทนค่าที่ไม่ทราบ — ถือเป็นค่าว่าง (ไม่งั้นฟิลด์ int/date จะพังทั้งแถว) */
const PLACEHOLDER_RE = /^(?:ไม่ระบุ|ไม่ทราบ|ไม่มีข้อมูล|ไม่ปรากฏ|ไม่พบ|-|–|—|\?|n\/?a\.?|unknown|null|none)$/i

function isPlaceholder(v: string): boolean {
  return PLACEHOLDER_RE.test(v.trim())
}

// เดือนไทย (ตัวย่อ/เต็ม) → เลขเดือน — ใช้แปลงวันที่แบบไทยให้ระบบ parse ได้
const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6, 'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
}

/** แปลงวันที่ไทย เช่น "7 ต.ค. 2569" → "2026-10-07" (พ.ศ. >2400 ตัด 543)
 * รองรับช่วงวัน เช่น "6-7 ต.ค. 2569" → ใช้วันแรก
 * รูปแบบอื่น (ISO / dd-mm-yyyy) ปล่อยให้ parseFlexibleDate ของ data-import จัดการต่อ */
function coerceThaiDate(s: string): string {
  return s.replace(
    /(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s+(ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d{4})/g,
    (m, d: string, monRaw: string, y: string) => {
      const mon = monRaw.replace(/\s+/g, '')
      const mo = THAI_MONTHS[mon] ?? THAI_MONTHS[mon.replace(/\.$/, '.')]
      if (!mo) return m
      let year = parseInt(y, 10)
      if (year > 2400) year -= 543 // พ.ศ. → ค.ศ.
      return `${year}-${String(mo).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`
    },
  )
}

/** ตรวจพื้นที่: รวมค่าของฟิลด์ที่เกี่ยวกับพื้นที่ ถ้ารวมแล้วไม่ว่างแต่ไม่มี province เป็นส่วนหนึ่ง → ตัด
 * (ถ้าไม่มีข้อมูลพื้นที่เลย = เก็บไว้) */
function isOutsideProvince(mod: ModuleDef, rec: Record<string, unknown>, province: string): boolean {
  const needle = province.trim().toLowerCase()
  if (!needle) return false
  const parts: string[] = []
  for (const f of mod.fields) {
    if (!AREA_KEY_RE.test(f.key) && !AREA_LABEL_RE.test(f.label)) continue
    const v = rec[f.key]
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
  }
  const joined = parts.join(' ').toLowerCase()
  if (!joined) return false
  return !joined.includes(needle)
}

// ---------- งานเบื้องหลัง ----------

async function runSearchImport(task: AiTask, input: SearchImportInput): Promise<void> {
  const warnings: string[] = []
  try {
    const zai = await getZAI()

    // ---------- 1) ค้นหาภายนอก (web search) ----------
    taskPhase(task, 'กำลังค้นหาข้อมูลจากภายนอก…')
    const fresh = !!(input.from || input.to) || /(ล่าสุด|ตอนนี้|วันนี้)/.test(input.query)
    const searchQuery = `${input.query}${input.province ? ` ${input.province}` : ''}`.slice(0, 400)
    let rawResults: unknown
    try {
      rawResults = await withTimeout(
        zai.functions.invoke('web_search', {
          query: searchQuery,
          num: 8,
          ...(fresh ? { recency_days: 45 } : {}),
        }),
        SEARCH_TIMEOUT_MS,
        'การค้นหาภายนอกใช้เวลานานเกินกำหนด',
      )
    } catch (e) {
      console.error('[ai-assistant/search-import] web_search', e)
      taskFail(task, e instanceof Error && e.message.includes('เกินกำหนด') ? e.message : 'การค้นหาภายนอกล้มเหลว — กรุณาลองอีกครั้งครับ')
      return
    }
    const results = (Array.isArray(rawResults) ? (rawResults as SearchResultItem[]) : [])
      .filter((r) => r && typeof r.url === 'string' && r.url.startsWith('http'))
    if (results.length === 0) {
      taskFail(task, 'ไม่พบผลการค้นหาจากแหล่งภายนอก — ลองปรับคำค้นใหม่')
      return
    }

    const sources = results.slice(0, 6).map((r, i) => ({
      name: r.name?.trim() || `แหล่งข้อมูลที่ ${i + 1}`,
      url: r.url!,
      host: r.host_name || safeHost(r.url!),
      snippet: (r.snippet ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
    }))

    const searchText = results
      .map((r, i) => `[${i + 1}] ${r.name?.trim() ?? ''}${r.date ? ` (${r.date})` : ''}\nURL: ${r.url}\nเว็บไซต์: ${r.host_name || safeHost(r.url!)}\n${(r.snippet ?? '').replace(/\s+/g, ' ').trim()}`)
      .join('\n\n')
      .slice(0, 6000)

    // ---------- 2) อ่านเนื้อหาแหล่งข้อมูลสำคัญ (top 3 links) ----------
    let pagesText = ''
    if (input.readPages) {
      taskPhase(task, 'กำลังอ่านเนื้อหาแหล่งข้อมูลสำคัญ…')
      const top = results.slice(0, 3)
      const settled = await Promise.allSettled(
        top.map((r) => withTimeout(readPageContext(r.url!), SEARCH_TIMEOUT_MS, 'อ่านเนื้อหาเว็บเพจใช้เวลานานเกินกำหนด')),
      )
      const pages: string[] = []
      settled.forEach((s, i) => {
        const r = top[i]
        const host = r.host_name || safeHost(r.url!)
        if (s.status === 'fulfilled' && s.value && s.value.text) {
          pages.push(`URL: ${r.url}${s.value.title ? `\nหัวข้อ: ${s.value.title}` : ''}${s.value.publishedTime ? `\nเผยแพร่: ${s.value.publishedTime}` : ''}\n---\n${s.value.text}`)
        } else {
          warnings.push(`อ่านเนื้อหาจาก ${host} ไม่สำเร็จ — วิเคราะห์จากผลค้นหาแทน`)
        }
      })
      pagesText = pages.join('\n\n===\n\n').slice(0, PAGES_TOTAL_CHARS)
    }

    // ---------- 3) LLM วิเคราะห์ตามเงื่อนไข ----------
    taskPhase(task, 'กำลังวิเคราะห์ตามเงื่อนไขด้วย AI…')
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: buildAnalysisPrompt(input, searchText, pagesText) },
          { role: 'user', content: 'วิเคราะห์ผลค้นหาและดึงข้อมูลตามเงื่อนไข (ตอบ JSON เท่านั้น)' },
        ],
        thinking: { type: 'disabled' },
      }),
      LLM_TIMEOUT_MS,
      'AI วิเคราะห์ข้อมูลนานเกินกำหนด — กรุณาลองอีกครั้งครับ',
    )
    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    const parsed = extractJson(raw)
    if (!parsed) {
      console.error('[ai-assistant/search-import] LLM parse failed, raw:', raw.slice(0, 800))
      taskFail(task, 'ผู้ช่วย AI วิเคราะห์ข้อมูลไม่สำเร็จ กรุณาลองใหม่')
      return
    }

    // ---------- 4) ตรวจ/กรองฝั่งเซิร์ฟเวอร์ ----------
    taskPhase(task, 'กำลังตรวจสอบเงื่อนไขและเตรียมพรีวิว…')
    const llmWarnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '').slice(0, 5)
      : []
    const skippedByLlm = typeof parsed.skippedCount === 'number' && Number.isFinite(parsed.skippedCount) && parsed.skippedCount > 0
      ? Math.round(parsed.skippedCount)
      : 0

    const fromMs = input.from ? maybeDateMs(input.from) : null
    const toMs = input.to ? maybeDateMs(input.to) : null
    const hasDateFilter = fromMs !== null || toMs !== null
    const winFrom = fromMs !== null ? fromMs - DAY_MS : null // from − 1 วัน
    const winTo = toMs !== null ? toMs + DAY_MS : null // to + 1 วัน

    let filteredByDate = 0
    let filteredByArea = 0
    let invalidRows = 0
    let totalFound = 0

    interface OutGroup { mod: ModuleDef; records: Record<string, unknown>[]; warnings: string[] }
    const outGroups: OutGroup[] = []

    const llmGroups = (Array.isArray(parsed.groups) ? parsed.groups : [])
      .filter((g): g is LlmGroup & { module: string } => !!g && typeof g.module === 'string' && !!IMPORT_MODULES[g.module])
      .slice(0, MAX_GROUPS)
    if (input.module && IMPORT_MODULES[input.module]) {
      const before = llmGroups.length
      const only = llmGroups.filter((g) => g.module === input.module)
      if (only.length < before) warnings.push(`ผู้ใช้ระบุโมดูลเป้าหมาย "${IMPORT_MODULES[input.module].label}" — ตัดกลุ่มโมดูลอื่นที่ AI เสนอเกินมาออก`)
      llmGroups.length = 0
      llmGroups.push(...only)
    }

    for (const g of llmGroups) {
      const mod = IMPORT_MODULES[g.module]
      const rows = Array.isArray(g.records) ? (g.records as unknown[]) : []
      totalFound += rows.length
      const kept: Record<string, unknown>[] = []
      for (const row of rows.slice(0, MAX_ROWS_PER_GROUP)) {
        if (kept.length >= MAX_ROWS_PER_GROUP) break
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue
        const src = row as Record<string, unknown>
        // เก็บเฉพาะค่าของฟิลด์ที่มีจริงในโมดูล (ตัด trim, ทิ้งค่าว่าง)
        const rec: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(src)) {
          const fdef = mod.fields.find((f) => f.key === k)
          if (!fdef) continue
          if (v === null || v === undefined) continue
          const s = String(v).trim()
          if (!s || isPlaceholder(s)) continue
          // วันที่แบบไทย (เช่น "7 ต.ค. 2569") → ISO เพื่อให้ตรวจช่วงวันที่/normalize/import ทำงานได้
          rec[k] = fdef.type === 'date' ? coerceThaiDate(s) : s
        }
        if (Object.keys(rec).length === 0) continue
        // (a) ตรวจช่วงวันที่ (ถ้ากำหนด from/to)
        if (hasDateFilter && isOutsideDateWindow(mod, rec, winFrom, winTo)) { filteredByDate++; continue }
        // (b) ตรวจพื้นที่ (ถ้ากำหนด province)
        if (input.province && isOutsideProvince(mod, rec, input.province)) { filteredByArea++; continue }
        // (c) ตรวจความถูกต้องแบบ dry-run (ให้พรีวิวสะอาด — ไม่ต้องรอ import ฟาลทีละแถว)
        const nr = normalizeRecord(mod, rec)
        if (nr.errors.length > 0) { invalidRows++; continue }
        kept.push(rec)
      }
      if (rows.length > MAX_ROWS_PER_GROUP) warnings.push(`โมดูล "${mod.label}" มีรายการเกิน ${MAX_ROWS_PER_GROUP} — ตัดเหลือ ${MAX_ROWS_PER_GROUP} แถวแรก`)
      if (kept.length > 0) outGroups.push({ mod, records: kept, warnings: [...llmWarnings] })
    }

    // cap รวมทุกกลุ่ม ≤ MAX_IMPORT_ROWS (เกินให้ตัด)
    let totalRows = outGroups.reduce((s, g) => s + g.records.length, 0)
    if (totalRows > MAX_IMPORT_ROWS) {
      let budget = MAX_IMPORT_ROWS
      for (const g of outGroups) {
        if (g.records.length > budget) {
          warnings.push(`รวมทุกกลุ่มเกิน ${MAX_IMPORT_ROWS} แถว (จำกัดต่อการนำเข้า 1 ครั้ง) — ตัดโมดูล "${g.mod.label}" เหลือ ${Math.max(0, budget)} แถว`)
          g.records = g.records.slice(0, Math.max(0, budget))
        }
        budget -= g.records.length
      }
      for (let i = outGroups.length - 1; i >= 0; i--) {
        if (outGroups[i].records.length === 0) outGroups.splice(i, 1)
      }
      totalRows = Math.min(totalRows, MAX_IMPORT_ROWS)
    }

    // ---------- 5) ไม่มีข้อมูลที่นำเข้าได้ → ส่งเป็นสรุปอ่านอย่างเดียว ----------
    if (outGroups.length === 0 || totalRows === 0) {
      taskDone(task, {
        kind: 'document',
        query: input.query,
        analysis: parsed.analysis?.trim() || 'ไม่พบข้อมูลที่นำเข้าระบบได้ตามเงื่อนไข',
        warnings,
        sources,
      })
      return
    }

    // ---------- 6) เก็บ staging job ต่อกลุ่ม ----------
    const fileName = `ผลค้นหา: ${input.query.slice(0, 60)}`
    const groups = outGroups.map((g) => {
      const job = saveJob({
        moduleKey: g.mod.key,
        moduleLabel: g.mod.label,
        source: 'search',
        fileName,
        records: g.records,
        warnings: g.warnings,
      })
      const usedKeys = new Set<string>()
      for (const rec of g.records) for (const k of Object.keys(rec)) usedKeys.add(k)
      const fields = g.mod.fields.filter((f) => usedKeys.has(f.key)).map((f) => ({ key: f.key, label: f.label }))
      return {
        jobId: job.id,
        module: g.mod.key,
        moduleLabel: g.mod.label,
        totalRows: g.records.length,
        fields,
        records: g.records.slice(0, PREVIEW_ROWS) as Record<string, string>[],
        warnings: g.warnings,
      }
    })

    // ---------- 7) ตอบผลพรีวิว ----------
    taskDone(task, {
      kind: 'data',
      query: input.query,
      analysis: parsed.analysis?.trim() ?? '',
      conditions: { province: input.province, from: input.from, to: input.to, module: input.module },
      sources,
      totalFound,
      filteredOut: { date: filteredByDate, area: filteredByArea, invalid: invalidRows, skippedByLlm },
      groups,
    })
  } catch (e) {
    console.error('[ai-assistant/search-import]', e)
    taskFail(task, e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการค้นหาและนำเข้าข้อมูล')
  }
}

// ---------- API handlers ----------

export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 300) : ''
    if (!query) {
      return NextResponse.json({ error: 'กรุณาระบุคำค้นหา — เช่น "น้ำท่วมนครสวรรค์ ห้วง 6-7 ต.ค. 2569 แล้วนำเข้าระบบ"' }, { status: 400 })
    }
    const input: SearchImportInput = {
      query,
      province: typeof body.province === 'string' ? body.province.trim().slice(0, 120) : '',
      from: typeof body.from === 'string' ? body.from.trim().slice(0, 30) : '',
      to: typeof body.to === 'string' ? body.to.trim().slice(0, 30) : '',
      module: typeof body.module === 'string' && IMPORT_MODULES[body.module.trim()] ? body.module.trim() : '',
      readPages: body.readPages !== false,
    }
    const task = createAiTask()
    void runSearchImport(task, input)
    return NextResponse.json({ taskId: task.id })
  } catch (e) {
    console.error('[ai-assistant/search-import]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเริ่มงานค้นหาและนำเข้าข้อมูล' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return handleTaskStatus(req)
}
