import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isResponse } from '@/lib/auth'
import {
  parseDelimited, parseJsonTable, parseExcel, inferKind,
  IMPORT_MODULES, moduleCatalogPrompt, MAX_FILE_BYTES, MAX_IMPORT_ROWS, PREVIEW_ROWS,
  saveJob,
} from '@/lib/data-import'
import { createAiTask, taskPhase, taskDone, taskFail, handleTaskStatus, withTimeout, type AiTask } from '@/lib/ai-tasks'
import ZAI from 'z-ai-web-dev-sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================================
// POST /api/ai-assistant/extract — ตรวจจับและแปลงข้อมูลภายนอกเพื่อนำเข้าระบบ
// รับ 3 แหล่ง: ไฟล์แนบ (multipart) | URL ไฟล์ข้อมูล | ข้อความตารางที่วางมา
// 1) parse เป็นตาราง  2) LLM เลือกโมดูล + จับคู่คอลัมน์→ฟิลด์
// 3) เก็บ record ลง staging job  4) ตอบพรีวิวให้ผู้ใช้ยืนยันก่อนนำเข้าจริง
//
// ทำงานแบบ async task: POST อ่าน/parse ส่วนที่เร็วแล้วคืน { taskId } ทันที
// งานที่ใช้เวลานาน (ดาวน์โหลด URL / LLM) รันเบื้องหลัง — client ติดตามด้วย GET ?taskId=
// (กัน proxy timeout ที่เคยคืน HTML error page จน client parse JSON พัง)
// ============================================================

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

interface LlmMapping {
  kind: 'data' | 'document'
  module?: string
  columnMapping?: Record<string, string>
  constants?: Record<string, unknown>
  warnings?: string[]
  summary?: string
}

const LLM_TIMEOUT_MS = 90_000

type ParseTable = ReturnType<typeof parseJsonTable>

// ---------- LLM helpers ----------

function extractJson(text: string): LlmMapping | null {
  try { return JSON.parse(text) as LlmMapping } catch { /* ลองตัด ``` ออก */ }
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) as LlmMapping } catch { return null }
}

function buildMappingPrompt(columns: string[], sampleRows: Record<string, string>[], note: string): string {
  return `คุณเป็นผู้เชี่ยวชาญด้านข้อมูลของระบบจัดการภัยพิบัติ EDEN DMS
งาน: ตรวจจับว่าตารางข้อมูลต่อไปนี้เป็นข้อมูลของโมดูลใด แล้วจับคู่คอลัมน์ต้นทางไปยังฟิลด์ของโมดูล

### แคตตาล็อกโมดูลและฟิลด์ (ฟิลด์ที่มี * = บังคับ)
${moduleCatalogPrompt()}

### กติกา
1. เลือกโมดูล "เดียว" ที่ข้อมูลตรงที่สุด แล้ว map ทุกคอลัมน์ที่เกี่ยวข้องไปยังฟิลด์ (คอลัมน์ที่ไม่เกี่ยวให้ค่าเป็นสตริงว่าง "")
2. ใช้ "constants" เฉพาะค่าที่ "ไม่มีคอลัมน์ต้นทางอยู่ในตาราง" เท่านั้น (เช่น จากหมายเหตุผู้ใช้) และให้ใส่เป็นค่า enum ภาษาอังกฤษ เช่น {"type":"flood"} — ห้ามใส่ constants สำหรับฟิลด์ที่มีคอลัมน์ในตารางอยู่แล้ว
3. ค่า enum ที่มาจากคอลัมน์ในตาราง ให้แค่ map คอลัมน์→ฟิลด์ แล้วคงค่าต้นทางเดิมไว้ (แม้เป็นภาษาไทย) — ระบบจะแปลง "น้ำท่วม"→flood, "สูง"→high, "สูญหาย"→missing เองทีละแถว อย่าแปลงเองและอย่าใส่ลง constants
4. วันที่ส่งเป็นรูปเดิมได้ (ระบบแปลง พ.ศ./ค.ศ. เอง) เช่น "7/10/2569" หรือ "2026-10-07"
5. ชื่อฟิลด์ปลายทางต้องมีอยู่ในโมดูลที่เลือกเท่านั้น
6. ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:

{"kind":"data","module":"<module key>","columnMapping":{"<คอลัมน์ต้นทาง>":"<ฟิลด์ปลายทาง หรือ \"\" >"},"constants":{},"warnings":["หมายเหตุภาษาไทยสั้น ๆ ถ้ามี"]}

7. ถ้าตารางไม่ตรงกับโมดูลใดเลย หรือเนื้อหาเป็นเอกสาร/บทความ (ไม่ใช่ข้อมูลนำเข้า) ให้ตอบ:

{"kind":"document","summary":"สรุปสาระสำคัญเป็นภาษาไทย 3-6 bullet (Markdown)"}
${note ? `\n### หมายเหตุจากผู้ใช้\n${note.slice(0, 500)}\n` : ''}
### คอลัมน์ของตาราง
${columns.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### แถวตัวอย่าง (สูงสุด 3 แถว, JSON)
${JSON.stringify(sampleRows, null, 1).slice(0, 4000)}`
}

async function llmMap(columns: string[], rows: Record<string, string>[], note: string): Promise<LlmMapping> {
  const zai = await getZAI()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: buildMappingPrompt(columns, rows.slice(0, 3), note) },
      { role: 'user', content: 'ตรวจจับโมดูลและจับคู่คอลัมน์ของตารางนี้ (ตอบ JSON เท่านั้น)' },
    ],
    thinking: { type: 'disabled' },
  })
  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  const parsed = extractJson(raw)
  if (!parsed) {
    console.error('[ai-assistant/extract] llmMap parse failed, raw:', raw.slice(0, 800))
    throw new Error('ผู้ช่วย AI วิเคราะห์โครงสร้างข้อมูลไม่สำเร็จ กรุณาลองใหม่')
  }
  return parsed
}

async function llmSummarizeDocument(content: string, label: string, note: string): Promise<string> {
  const zai = await getZAI()
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `คุณเป็นผู้ช่วยวิเคราะห์เอกสารของระบบจัดการภัยพิบัติ EDEN DMS สรุปเนื้อหาต่อไปนี้เป็นภาษาไทย แบบ Markdown มี bullet 3-6 ข้อ ชี้ประเด็นที่เกี่ยวกับภัยพิบัติ/การช่วยเหลือ และระบุชัดว่าเนื้อหานี้เป็น "เอกสารอ่าน" ไม่สามารถแปลงเป็นข้อมูลนำเข้าโมดูลได้${note ? ` สนใจประเด็นที่ผู้ใช้ระบุ: ${note.slice(0, 300)}` : ''}`,
      },
      { role: 'user', content: `[${label}]\n${content.slice(0, 8000)}` },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices[0]?.message?.content?.trim() || 'ไม่สามารถสรุปเนื้อหาได้'
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

async function fetchExternal(url: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20_000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'EDEN-DMS-Importer/1.0 (+disaster management system)' },
    })
    if (!res.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ (HTTP ${res.status})`)
    const ct = res.headers.get('content-type') ?? ''
    const cd = res.headers.get('content-disposition') ?? ''
    let filename = ''
    const cdMatch = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
    if (cdMatch) filename = decodeURIComponent(cdMatch[1])
    if (!filename) {
      try { filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '') } catch { filename = '' }
    }
    if (!filename) filename = `download-${Date.now()}`
    const ab = await res.arrayBuffer()
    if (ab.byteLength > MAX_FILE_BYTES) throw new Error('ไฟล์จาก URL ใหญ่เกิน 5MB')
    return { buffer: Buffer.from(ab), filename, contentType: ct }
  } finally {
    clearTimeout(timer)
  }
}

// ---------- งานเบื้องหลัง ----------

interface ExtractWork {
  mode: 'table' | 'doc' | 'urlfetch'
  table?: ParseTable
  docText?: string
  docLabel?: string
  url?: string
  source: 'file' | 'url' | 'text'
  fileName: string
  note: string
}

async function runExtract(task: AiTask, work: ExtractWork): Promise<void> {
  try {
    let table = work.table ?? null
    const source = work.source
    let fileName = work.fileName
    let rawTextForDoc = work.docText ?? null
    let docLabel = work.docLabel ?? 'เอกสาร'

    // ดาวน์โหลดไฟล์จาก URL (งานนาน — ทำเบื้องหลัง)
    if (work.mode === 'urlfetch') {
      taskPhase(task, 'กำลังดาวน์โหลดไฟล์จากลิงก์…')
      let fetched: { buffer: Buffer; filename: string; contentType: string }
      try {
        fetched = await fetchExternal(work.url!)
      } catch (e) {
        taskFail(task, e instanceof Error ? e.message : 'ดาวน์โหลดไฟล์จาก URL ไม่สำเร็จ')
        return
      }
      fileName = fetched.filename || work.url!.split('/').pop() || 'ไฟล์จาก URL'
      const kind = inferKind(fileName, fetched.contentType)
      const text = fetched.buffer.toString('utf-8')
      try {
        table = kind === 'xlsx' ? parseExcel(fetched.buffer)
          : kind === 'json' ? parseJsonTable(text)
            : parseDelimited(text)
        rawTextForDoc = null
      } catch {
        // ไม่ใช่ไฟล์ตาราง → อาจเป็นเว็บเพจ/เอกสาร
        rawTextForDoc = text
        docLabel = fileName
      }
    }

    // ---------- 2a) เอกสาร (ไม่ใช่ตาราง) → สรุปให้อ่าน ----------
    if (!table) {
      const text = (rawTextForDoc ?? '').trim()
      if (!text) {
        taskFail(task, 'ไม่สามารถอ่านเนื้อหาของไฟล์ได้')
        return
      }
      taskPhase(task, 'กำลังสรุปเนื้อหาเอกสารด้วย AI…')
      const summary = await withTimeout(
        llmSummarizeDocument(htmlToText(text), docLabel, work.note),
        LLM_TIMEOUT_MS,
        'AI สรุปเอกสารนานเกินกำหนด — กรุณาลองอีกครั้งครับ',
      )
      taskDone(task, { kind: 'document', fileName, source, summary })
      return
    }

    if (table.rows.length === 0) {
      taskFail(task, 'ไม่พบแถวข้อมูลในไฟล์')
      return
    }

    // ---------- 2b) ตาราง → LLM จับคู่โมดูล/คอลัมน์ ----------
    taskPhase(task, 'กำลังตรวจจับโมดูลและจับคู่คอลัมน์ด้วย AI…')
    const mapping = await withTimeout(
      llmMap(table.columns, table.rows, work.note),
      LLM_TIMEOUT_MS,
      'AI วิเคราะห์โครงสร้างข้อมูลนานเกินกำหนด — กรุณาลองอีกครั้งครับ',
    )

    if (mapping.kind === 'document' && mapping.summary) {
      taskDone(task, { kind: 'document', fileName, source, summary: mapping.summary })
      return
    }

    const modKey = mapping.module ?? ''
    const mod = IMPORT_MODULES[modKey]
    if (!mod) {
      taskDone(task, {
        kind: 'document',
        fileName,
        source,
        summary: `ผู้ช่วย AI ตรวจไม่พบโมดูลที่ตรงกับข้อมูลนี้ (${modKey || 'ไม่ระบุ'}) — โมดูลที่รองรับการนำเข้า: ${Object.values(IMPORT_MODULES).map((m) => m.label).join(', ')}`,
      })
      return
    }

    // ใช้คอลัมน์ที่มีจริงเท่านั้น (กัน LLM อ้างคอลัมน์เพี้ยน)
    const colMap: Record<string, string> = {}
    for (const [col, field] of Object.entries(mapping.columnMapping ?? {})) {
      if (table.columns.includes(col) && typeof field === 'string' && field && mod.fields.some((f) => f.key === field)) {
        colMap[col] = field
      }
    }
    const constants: Record<string, unknown> = {}
    const mappedFields = new Set(Object.values(colMap))
    for (const [field, value] of Object.entries(mapping.constants ?? {})) {
      // เซฟตี้: ค่าจากคอลัมน์จริงต้องชนะ constants เสมอ (กัน LLM ใส่ค่าเดียวทั้งตาราง)
      if (mappedFields.has(field)) continue
      if (mod.fields.some((f) => f.key === field) && value !== null && value !== undefined && String(value).trim() !== '') {
        constants[field] = typeof value === 'string' ? value.trim() : value
      }
    }
    // self-heal: ถ้า LLM ใส่ค่าของ "คอลัมน์ในตาราง" ลง constants (เช่น แปลง enum เอง) → ดึงกลับเป็น column mapping
    for (const field of Object.keys(constants)) {
      const fdef = mod.fields.find((f) => f.key === field)
      if (!fdef) continue
      const usedCols = Object.keys(colMap)
      const col = table.columns.find(
        (c) => !usedCols.includes(c) && (c === field || c === fdef.label || c.includes(fdef.label) || fdef.label.includes(c)),
      )
      if (col) {
        colMap[col] = field
        delete constants[field]
      }
    }
    // self-heal 2: ฟิลด์บังคับที่ LLM ลืม map → ลองจับคู่กับคอลัมน์ที่ยังว่างด้วยชื่อ (กัน import แถวเป็นแถว fail ทั้งหมด)
    for (const fdef of mod.fields.filter((f) => f.required)) {
      if (Object.values(colMap).includes(fdef.key)) continue
      const usedCols = Object.keys(colMap)
      const col = table.columns.find(
        (c) => !usedCols.includes(c) && (c === fdef.key || c === fdef.label || c.includes(fdef.label) || fdef.label.includes(c)),
      )
      if (col) colMap[col] = fdef.key
    }
    if (Object.keys(colMap).length === 0 && Object.keys(constants).length === 0) {
      taskDone(task, {
        kind: 'document',
        fileName,
        source,
        summary: `ผู้ช่วย AI จับคู่คอลัมน์ของไฟล์ "${fileName}" กับโมดูล "${mod.label}" ไม่สำเร็จ — โปรดตรวจว่าไฟล์มีคอลัมน์สอดคล้องกับฟิลด์ของโมดูล เช่น ชื่อ/จำนวน/พื้นที่ ฯลฯ`,
      })
      return
    }

    // ประกอบ record ดิบ (ยังไม่ normalize — ให้ import engine ตรวจอีกชั้น)
    const allRecords: Record<string, unknown>[] = []
    for (const row of table.rows) {
      const rec: Record<string, unknown> = {}
      for (const [col, field] of Object.entries(colMap)) {
        const v = row[col]
        if (v !== undefined && String(v).trim() !== '') rec[field] = String(v).trim()
      }
      for (const [field, value] of Object.entries(constants)) rec[field] = value
      if (Object.keys(rec).length > 0) allRecords.push(rec)
    }

    const warnings: string[] = [...(mapping.warnings ?? []).filter((w) => typeof w === 'string' && w.trim()).slice(0, 5)]
    if (table.truncated) warnings.push('ไฟล์มีมากกว่า 1,000 แถว — อ่านเฉพาะ 1,000 แถวแรก')
    let truncatedForImport = false
    if (allRecords.length > MAX_IMPORT_ROWS) {
      warnings.push(`จำกัดการนำเข้าไม่เกิน ${MAX_IMPORT_ROWS} แถว — จะนำเข้าเพียง ${MAX_IMPORT_ROWS} แถวแรก (พบรวม ${allRecords.length} แถว)`)
      truncatedForImport = true
    }
    const jobRecords = truncatedForImport ? allRecords.slice(0, MAX_IMPORT_ROWS) : allRecords

    if (jobRecords.length === 0) {
      taskFail(task, 'ไม่มีแถวที่มีข้อมูลใช้ได้หลังจับคู่คอลัมน์')
      return
    }

    // ---------- 3) เก็บ staging job + ตอบพรีวิว ----------
    taskPhase(task, 'กำลังเตรียมพรีวิวข้อมูล…')
    const job = saveJob({
      moduleKey: mod.key,
      moduleLabel: mod.label,
      source,
      fileName,
      records: jobRecords,
      warnings,
    })

    const usedFields = [...new Set([...Object.values(colMap), ...Object.keys(constants)])]
      .map((key) => ({ key, label: mod.fields.find((f) => f.key === key)?.label ?? key }))

    taskDone(task, {
      kind: 'data',
      jobId: job.id,
      module: mod.key,
      moduleLabel: mod.label,
      moduleDescription: mod.description,
      fileName,
      source,
      totalRows: jobRecords.length,
      fields: usedFields,
      mapping: Object.entries(colMap).map(([column, field]) => ({ column, field })),
      records: jobRecords.slice(0, PREVIEW_ROWS),
      warnings,
    })
  } catch (e) {
    console.error('[ai-assistant/extract]', e)
    taskFail(task, e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล')
  }
}

// ---------- API handlers ----------

export async function POST(req: NextRequest) {
  const auth = requireUser(req)
  if (isResponse(auth)) return auth

  try {
    const contentType = req.headers.get('content-type') ?? ''
    let work: ExtractWork | null = null

    if (contentType.includes('multipart/form-data')) {
      // ไฟล์แนบ ≤5MB — อ่านและ parse ได้เร็ว ทำตรงนี้ (เหมือนเดิม)
      const form = await req.formData()
      const file = form.get('file')
      const note = String(form.get('note') ?? '')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'ไม่พบไฟล์แนบ — กรุณาเลือกไฟล์ .csv/.tsv/.json/.xlsx' }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5MB' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const kind = inferKind(file.name, file.type)
      let table: ParseTable | null = null
      let rawTextForDoc: string | null = null
      let docLabel = file.name
      if (kind === 'unknown') {
        // อาจเป็นเอกสารข้อความ (.txt) — ลอง JSON แล้ว CSV แล้วสรุปเป็นเอกสาร
        const text = buf.toString('utf-8')
        try { table = parseJsonTable(text) } catch {
          try { table = parseDelimited(text) } catch { rawTextForDoc = text }
        }
      } else if (kind === 'xlsx') {
        try { table = parseExcel(buf) } catch (e) {
          return NextResponse.json({ error: e instanceof Error ? e.message : 'อ่านไฟล์ Excel ไม่สำเร็จ' }, { status: 400 })
        }
      } else {
        const text = buf.toString('utf-8')
        try { table = kind === 'json' ? parseJsonTable(text) : parseDelimited(text) } catch (e) {
          rawTextForDoc = text
          if (!(e instanceof Error)) table = null
        }
      }
      work = {
        mode: table ? 'table' : 'doc',
        table: table ?? undefined,
        docText: rawTextForDoc ?? undefined,
        docLabel,
        source: 'file',
        fileName: file.name,
        note,
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as { url?: string; text?: string; note?: string }
      const note = (body.note ?? '').slice(0, 500)
      if (body.url) {
        const url = body.url.trim()
        if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'URL ต้องขึ้นต้นด้วย http:// หรือ https://' }, { status: 400 })
        work = { mode: 'urlfetch', url, source: 'url', fileName: '', note }
      } else if (body.text) {
        const text = body.text.trim()
        if (!text) return NextResponse.json({ error: 'ไม่มีข้อความให้วิเคราะห์' }, { status: 400 })
        let table: ParseTable | null = null
        let rawTextForDoc: string | null = null
        try { table = parseJsonTable(text) } catch {
          try { table = parseDelimited(text) } catch { rawTextForDoc = text }
        }
        work = {
          mode: table ? 'table' : 'doc',
          table: table ?? undefined,
          docText: rawTextForDoc ?? undefined,
          docLabel: 'ข้อความที่วาง',
          source: 'text',
          fileName: 'ข้อความที่วาง',
          note,
        }
      } else {
        return NextResponse.json({ error: 'ระบุข้อมูลที่ต้องการนำเข้า (ไฟล์แนบ / URL / ข้อความ)' }, { status: 400 })
      }
    }

    const task = createAiTask()
    void runExtract(task, work)
    return NextResponse.json({ taskId: task.id })
  } catch (e) {
    console.error('[ai-assistant/extract]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return handleTaskStatus(req)
}
