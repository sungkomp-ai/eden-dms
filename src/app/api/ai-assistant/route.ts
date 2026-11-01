import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================================
// EDEN AI Assistant — ผู้เชี่ยวชาญการจัดการภัยพิบัติ
// วิเคราะห์คำถาม → รวบรวมบริบท (ข้อมูลในระบบ + ค้นหาภายนอก) → ตอบพร้อมคำแนะนำ
// ใช้ OpenAI-compatible Chat Completions สำหรับคำตอบ และ Z.AI เฉพาะค้นเว็บ
// ============================================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface WebSource {
  name: string
  url: string
  host: string
  snippet: string
  date?: string
}

interface ProviderMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ProviderResponse {
  choices?: { message?: { content?: string | { text?: string }[] | null } }[]
  error?: { message?: string }
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[]
    }
  }[]
  error?: { message?: string }
}

interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

class AIProviderError extends Error {
  constructor(readonly status = 0) { super() }
}

function getAIConfig(): AIConfig | null {
  const baseUrl = process.env.AI_BASE_URL?.trim().replace(/\/+$/, '')
  const model = process.env.AI_MODEL?.trim()
  if (!baseUrl || !model) return null
  return { baseUrl, model, apiKey: process.env.AI_API_KEY?.trim() ?? '' }
}

async function generateAnswer(config: AIConfig, messages: ProviderMessage[]): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: config.model, messages }),
    })
  } catch {
    throw new AIProviderError()
  }

  const result = await response.json().catch(() => null) as ProviderResponse | null
  if (!response.ok) {
    console.error('[ai-assistant] provider response', response.status, result?.error?.message)
    throw new AIProviderError(response.status)
  }

  const content = result?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('').trim()
  return ''
}

async function generateGeminiAnswer(
  config: AIConfig,
  messages: ProviderMessage[],
  useWeb: boolean,
): Promise<{ answer: string; sources: WebSource[] }> {
  const apiRoot = config.baseUrl.replace(/\/openai\/?$/, '')
  let response: Response
  try {
    response = await fetch(
      `${apiRoot}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: messages.find((message) => message.role === 'system')?.content ?? '' }] },
          contents: messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
          ...(useWeb ? { tools: [{ googleSearch: {} }] } : {}),
        }),
      },
    )
  } catch {
    throw new AIProviderError()
  }

  const result = await response.json().catch(() => null) as GeminiResponse | null
  if (!response.ok) {
    console.error('[ai-assistant] Gemini response', response.status, result?.error?.message)
    throw new AIProviderError(response.status)
  }

  const candidate = result?.candidates?.[0]
  const answer = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? ''
  const seenUrls = new Set<string>()
  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .flatMap((chunk) => {
      const url = chunk.web?.uri
      if (!url || seenUrls.has(url)) return []
      seenUrls.add(url)
      let host = '-'
      try { host = new URL(url).hostname } catch { /* ignore malformed citation URL */ }
      return [{ name: chunk.web?.title || url, url, host, snippet: '' }]
    })

  return { answer, sources }
}

// ใช้ instance เดียวซ้ำทั้งโปรเซส (แนวปฏิบัติจาก skill: reuse SDK instance)
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}

const BKK = 'Asia/Bangkok'
function thDate(d: Date | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: BKK })
}

const SEV_TH: Record<string, string> = { low: 'ต่ำ', medium: 'กลาง', high: 'สูง', critical: 'วิกฤต' }
const STAT_TH: Record<string, string> = { active: 'ดำเนินการ', monitoring: 'เฝ้าระวัง', resolved: 'คลี่คลาย', closed: 'ปิดเหตุการณ์' }
const REQ_STAT_TH: Record<string, string> = { pending: 'รอดำเนินการ', approved: 'อนุมัติแล้ว', in_progress: 'กำลังดำเนินการ', fulfilled: 'สำเร็จ', rejected: 'ปฏิเสธ' }
const PERSON_STAT_TH: Record<string, string> = { missing: 'สูญหาย', found: 'พบตัวแล้ว', safe: 'ปลอดภัย', injured: 'บาดเจ็บ', deceased: 'เสียชีวิต', evacuated: 'อพยพแล้ว' }
const HR_STAT_TH: Record<string, string> = { available: 'พร้อมปฏิบัติงาน', assigned: 'ได้รับมอบหมาย', on_mission: 'ปฏิบัติภารกิจ', unavailable: 'ไม่พร้อม' }

// ---------- รวบรวมข้อมูลจากแพลตฟอร์ม (Prisma) เป็นบริบทข้อความ ----------
async function buildPlatformContext(): Promise<string> {
  const [incidents, reports, shelters, items, requests, alerts, persons, orgCount, hrs] = await Promise.all([
    db.incident.findMany({ orderBy: { startDate: 'desc' } }),
    db.incidentReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { incident: { select: { code: true, title: true } } },
    }),
    db.shelter.findMany({ orderBy: { currentOccupancy: 'desc' } }),
    db.inventoryItem.findMany({ include: { warehouse: { select: { name: true } } } }),
    db.aidRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    db.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    db.person.findMany({ orderBy: { updatedAt: 'desc' } }),
    db.organization.count(),
    db.humanResource.findMany({ select: { status: true, type: true } }),
  ])

  const L: string[] = []
  const now = new Date().toLocaleString('th-TH', { timeZone: BKK, dateStyle: 'medium', timeStyle: 'short' })
  L.push(`ข้อมูล ณ ${now} (เวลาประเทศไทย)`)

  // เหตุการณ์
  const ongoing = incidents.filter((i) => i.status === 'active' || i.status === 'monitoring')
  L.push(`\n### เหตุการณ์ภัยพิบัติ (รวม ${incidents.length} เหตุการณ์, กำลังดำเนินการ/เฝ้าระวัง ${ongoing.length})`)
  for (const i of ongoing.slice(0, 8)) {
    L.push(`- [${i.code}] ${i.title} | ประเภท: ${i.type} | รุนแรง: ${SEV_TH[i.severity] ?? i.severity} | สถานะ: ${STAT_TH[i.status] ?? i.status} | พื้นที่: ${i.locationName ?? '-'} | ผู้ประสบภัย ${i.affectedPeople.toLocaleString('th-TH')} คน บาดเจ็บ ${i.injured} เสียชีวิต ${i.deceased} | เริ่ม ${thDate(i.startDate)}`)
  }

  // SITREP
  L.push(`\n### รายงานสถานการณ์ (SITREP) ล่าสุด ${reports.length} ฉบับ`)
  for (const r of reports) {
    const content = r.content.replace(/\s+/g, ' ').slice(0, 220)
    L.push(`- ${r.title}${r.incident ? ` (โยงเหตุการณ์ ${r.incident.code})` : ''} | สถานะ: ${r.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'} | โดย ${r.author} | ${thDate(r.createdAt)} | สาระสำคัญ: ${content}...`)
  }

  // ศูนย์พักพิง
  const cap = shelters.reduce((s, x) => s + x.capacity, 0)
  const occ = shelters.reduce((s, x) => s + x.currentOccupancy, 0)
  L.push(`\n### ศูนย์พักพิง (รวม ${shelters.length} แห่ง — ความจุรวม ${cap.toLocaleString('th-TH')} คน, อยู่ปัจจุบัน ${occ.toLocaleString('th-TH')} คน = ${cap > 0 ? Math.round((occ / cap) * 100) : 0}%)`)
  for (const s of shelters.slice(0, 6)) {
    L.push(`- ${s.name} (${s.type}) | สถานะ: ${s.status === 'open' ? 'เปิดรับ' : s.status === 'full' ? 'เต็มความจุ' : s.status === 'preparing' ? 'เตรียมพร้อม' : 'ปิด'} | ${s.currentOccupancy}/${s.capacity} คน | ${s.address ?? '-'}`)
  }

  // คลังสิ่งของ
  const totalQty = items.reduce((s, x) => s + x.quantity, 0)
  const low = items.filter((x) => x.quantity <= x.minQuantity)
  L.push(`\n### คลังสิ่งของ (รายการ ${items.length} ชนิด, ปริมาณรวม ${totalQty.toLocaleString('th-TH')} หน่วย, ต่ำกว่าจุดต่ำ ${low.length} รายการ)`)
  for (const it of low.slice(0, 8)) {
    L.push(`- ⚠ ${it.name} (${it.category}) | คงเหลือ ${it.quantity} ${it.unit} / จุดต่ำ ${it.minQuantity} | คลัง: ${it.warehouse?.name ?? '-'}`)
  }
  const byCat: Record<string, number> = {}
  items.forEach((x) => { byCat[x.category] = (byCat[x.category] ?? 0) + x.quantity })
  L.push(`- สรุปตามหมวด: ${Object.entries(byCat).map(([k, v]) => `${k} ${v.toLocaleString('th-TH')}`).join(', ')}`)

  // คำขอความช่วยเหลือ
  const pending = requests.filter((r) => r.status === 'pending' || r.status === 'approved' || r.status === 'in_progress')
  L.push(`\n### คำขอความช่วยเหลือ (กำลังรอ/ดำเนินการ ${pending.length} รายการ)`)
  for (const r of pending.slice(0, 8)) {
    L.push(`- [${r.requestCode}] ${r.type} (${REQ_STAT_TH[r.status] ?? r.status}, ด่วน: ${r.priority}) | ผู้ขอ: ${r.requesterName}${r.requesterOrg ? ` (${r.requesterOrg})` : ''} | พื้นที่: ${r.locationName ?? '-'} | ${r.quantity ? `ปริมาณ ${r.quantity} | ` : ''}${(r.description ?? '').replace(/\s+/g, ' ').slice(0, 120)}`)
  }

  // แจ้งเตือน
  L.push(`\n### การแจ้งเตือนภัยล่าสุด ${alerts.length} รายการ`)
  for (const a of alerts) {
    L.push(`- ${a.title} | ระดับ: ${a.severity} | ช่องทาง: ${a.channel} | สถานะ: ${a.status === 'sent' ? 'ส่งแล้ว' : a.status === 'scheduled' ? 'กำหนดส่ง' : 'ฉบับร่าง'} | ${thDate(a.createdAt)}`)
  }

  // บุคคล
  const byStatus: Record<string, number> = {}
  persons.forEach((p) => { byStatus[p.status] = (byStatus[p.status] ?? 0) + 1 })
  const missing = persons.filter((p) => p.status === 'missing')
  L.push(`\n### ทะเบียนบุคคล (รวม ${persons.length} ราย: ${Object.entries(byStatus).map(([k, v]) => `${PERSON_STAT_TH[k] ?? k} ${v}`).join(', ')})`)
  for (const p of missing.slice(0, 5)) {
    L.push(`- สูญหาย: ${p.firstName} ${p.lastName} | อายุ ${p.age ?? '-'} | พบล่าสุด: ${p.lastSeenLocation ?? '-'} | ${thDate(p.lastSeenAt)}`)
  }

  // องค์กร/บุคลากร
  const hrBy: Record<string, number> = {}
  hrs.forEach((h) => { hrBy[h.status] = (hrBy[h.status] ?? 0) + 1 })
  L.push(`\n### องค์กรภาคี ${orgCount} แห่ง | บุคลากร/อาสาสมัคร ${hrs.length} คน (${Object.entries(hrBy).map(([k, v]) => `${HR_STAT_TH[k] ?? k} ${v}`).join(', ')})`)

  return L.join('\n')
}

// ---------- ค้นหาข้อมูลภายนอก (web search) ----------
async function webSearch(question: string): Promise<{ text: string; sources: WebSource[] }> {
  const zai = await getZAI()
  const wantsFresh = /(ล่าสุด|ตอนนี้|วันนี้|ปัจจุบัน|สถานการณ์|ข่าว|เมื่อไร|กี่|เท่าไหร่)/.test(question)
  const results = (await zai.functions.invoke('web_search', {
    query: question.slice(0, 400),
    num: 6,
    ...(wantsFresh ? { recency_days: 45 } : {}),
  })) as Array<{ name?: string; url?: string; snippet?: string; host_name?: string; date?: string }>

  const sources: WebSource[] = (Array.isArray(results) ? results : [])
    .filter((r) => r.url)
    .slice(0, 6)
    .map((r, idx) => ({
      name: r.name?.trim() || `แหล่งข้อมูลที่ ${idx + 1}`,
      url: r.url!,
      host: r.host_name || (() => { try { return new URL(r.url!).hostname } catch { return '-' } })(),
      snippet: (r.snippet ?? '').replace(/\s+/g, ' ').slice(0, 300),
      date: r.date,
    }))

  if (sources.length === 0) return { text: '', sources: [] }

  const text = sources
    .map((s, i) => `[${i + 1}] ${s.name} — ${s.host}${s.date ? ` (${s.date})` : ''}\n    ${s.snippet}\n    URL: ${s.url}`)
    .join('\n\n')

  return { text, sources }
}

// ---------- System prompt ----------
function systemPrompt(): string {
  return `คุณคือ "EDEN AI" — ผู้ช่วยอัจฉริยะผู้เชี่ยวชาญด้านการจัดการภัยพิบัติ (Disaster Management Expert) ของระบบ EDEN DMS ศูนย์ปฏิบัติการภัยพิบัติของไทย

บทบาทและความเชี่ยวชาญ:
- วิเคราะห์สถานการณ์ภัยพิบัติ (น้ำท่วม ดินโคลนถล่ม ไฟป่า แผ่นดินไหว พายุ ภัยแล้ง โรคระบาด ฯลฯ)
- วางแผนและให้คำแนะนำการเตรียมพร้อม การตอบโต้ (response) การฟื้นฟู (recovery) และการลดความเสี่ยง
- เข้าใจระบบบัญชาการเหตุการณ์ (ICS), แผนรับมือภัยพิบัติแห่งชาติ พ.ศ. 2563 ของ ปภ., กรอบเซนได (Sendai Framework), แนวปฏิบัติ UN OCHA/IFRC
- ความปลอดภัยของชีวิตเป็นสิ่งสำคัญที่สุดเสมอ

วิธีตอบ:
1. ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ใช้ Markdown มีหัวข้อและรายการแบบ bullet อ่านง่าย
2. ถ้าผู้ใช้ส่ง "[ข้อมูลจากระบบ EDEN DMS]" มาด้วย ให้ใช้ตัวเลขและข้อมูลชุดนั้นเป็นหลัก อ้างอิงรหัสเหตุการณ์/ชื่อคลัง/ตัวเลขจริงที่ปรากฏ และห้ามแต่งตัวเลขเอง หากข้อมูลไม่พอให้ระบุว่า "ต้องตรวจสอบเพิ่มในโมดูล..."
3. ถ้าผู้ใช้ส่ง "[ผลค้นหาจากภายนอก]" มาด้วย ให้สังเคราะห์ข้อมูลนั้นและอ้างอิงด้วยเลข [1], [2] ตามลำดับแหล่งที่มาที่ให้มา ห้ามคิดเลขอ้างอิงเกินจำนวนแหล่ง
4. ถ้าไม่มีข้อมูลทั้งสองชุด ให้ตอบจากความรู้ทั่วไปอย่างรอบคอบ และแนะนำให้ตรวจสอบกับหน่วยงานที่เกี่ยวข้อง (ปภ. 1784, กาชาดไทย ฯลฯ)
5. ปิดท้ายคำตอบด้วยหัวข้อ "### คำแนะนำที่จำเป็น" เป็น bullet ที่ทำได้จริง (เรียงตามลำดับความสำคัญ) เมื่อคำถามเกี่ยวข้องกับการปฏิบัติ
6. หากคำถามเกี่ยวกับสถานการณ์ฉุกเฉินเร่งด่วน (มีผู้เสียชีวิต/เสี่ยงชีวิต) ให้เริ่มด้วยข้อความแจ้งเตือน "⚠️ เหตุฉุกเฉิน — โทร 1669 (การแพทย์ฉุกเฉิน) / 1784 (ปภ.) ทันที" แล้วจึงให้รายละเอียด
7. อย่าตอบเรื่องที่ไม่เกี่ยวกับภัยพิบัติ/การบริหารจัดการภายในระบบนี้ ให้ชวนกลับมาที่หน้าที่ของผู้ช่วย`
}

// ---------- API handler ----------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      question?: string
      history?: ChatMessage[]
      usePlatform?: boolean
      useWeb?: boolean
    }

    const question = (body.question ?? '').trim().slice(0, 2000)
    if (!question) {
      return NextResponse.json({ error: 'กรุณาระบุคำถาม' }, { status: 400 })
    }

    const aiConfig = getAIConfig()
    if (!aiConfig) {
      return NextResponse.json(
        { error: 'ยังไม่ได้ตั้งค่า AI: กำหนด AI_BASE_URL และ AI_MODEL ในไฟล์ .env แล้วเริ่มเซิร์ฟเวอร์ใหม่' },
        { status: 503 },
      )
    }
    if (aiConfig.baseUrl.includes('generativelanguage.googleapis.com') && !aiConfig.apiKey) {
      return NextResponse.json(
        { error: 'ยังไม่ได้ตั้งค่า Gemini API key: ใส่ key ใน AI_API_KEY ในไฟล์ .env แล้วเริ่มเซิร์ฟเวอร์ใหม่' },
        { status: 503 },
      )
    }

    const usePlatform = body.usePlatform !== false
    const useWeb = body.useWeb === true
    const isGemini = aiConfig.baseUrl.includes('generativelanguage.googleapis.com')
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : []

    // รวบรวมบริบท (ทำคู่ขนานกัน)
    let platformText = ''
    let platformError: string | null = null
    let webText = ''
    let sources: WebSource[] = []
    let webError: string | null = null

    const tasks: Promise<void>[] = []
    let platformContextUsed = false
    if (usePlatform) {
      tasks.push(
        buildPlatformContext()
          .then((t) => { platformText = t; platformContextUsed = true })
          .catch((e) => { console.error('[ai-assistant] platform ctx', e); platformError = 'ดึงข้อมูลจากระบบไม่สำเร็จ' }),
      )
    }
    if (useWeb && !isGemini) {
      tasks.push(
        webSearch(question)
          .then((r) => { webText = r.text; sources = r.sources })
          .catch((e) => { console.error('[ai-assistant] web search', e); webError = 'ค้นหาข้อมูลภายนอกไม่สำเร็จ' }),
      )
    }
    if (useWeb && isGemini) {
      tasks.push(
        generateGeminiAnswer(aiConfig, [
          { role: 'system', content: 'ค้นหาข้อมูลบนเว็บด้วย Google Search grounding สำหรับคำถามนี้เท่านั้น สรุปข้อเท็จจริงจากแหล่งที่ค้นพบ ห้ามตอบจากความจำ และระบุเมื่อไม่พบข้อมูลที่ยืนยันได้' },
          { role: 'user', content: question },
        ], true)
          .then((result) => {
            webText = result.answer
            sources = result.sources
          })
          .catch((e) => { console.error('[ai-assistant] Gemini web search', e); webError = 'ค้นหาข้อมูลภายนอกไม่สำเร็จ' }),
      )
    }
    await Promise.all(tasks)

    // ประกอบข้อความผู้ใช้ + บริบท
    let userContent = question
    if (platformText) userContent += `\n\n[ข้อมูลจากระบบ EDEN DMS]\n${platformText}`
    if (platformError) userContent += `\n\n[ข้อมูลจากระบบ EDEN DMS]\n(${platformError})`
    if (webText) userContent += `\n\n[ผลค้นหาจากภายนอก]\n${webText}`
    if (webError) userContent += `\n\n[ผลค้นหาจากภายนอก]\n(${webError})`

    const messages: ProviderMessage[] = [
      { role: 'system', content: systemPrompt() },
      ...history,
      { role: 'user', content: userContent },
    ]
    const result = isGemini
      ? await generateGeminiAnswer(aiConfig, messages, false)
      : { answer: await generateAnswer(aiConfig, messages), sources }
    const answer = result.answer
    if (isGemini && !useWeb) sources = result.sources

    if (!answer) {
      return NextResponse.json({ error: 'ผู้ช่วย AI ไม่สามารถสร้างคำตอบได้ กรุณาลองใหม่อีกครั้ง' }, { status: 502 })
    }

    return NextResponse.json({
      answer,
      sources,
      usedPlatform: platformContextUsed,
      usedWeb: useWeb && sources.length > 0,
    })
  } catch (e) {
    console.error('[ai-assistant]', e)
    if (e instanceof AIProviderError) {
      const authError = e.status === 401 || e.status === 403
      return NextResponse.json(
        { error: authError
          ? 'API key ของผู้ให้บริการ AI ยังไม่ได้ตั้งค่าหรือไม่ถูกต้อง โปรดตรวจสอบ AI_API_KEY ในไฟล์ .env'
          : 'เชื่อมต่อผู้ให้บริการ AI ไม่สำเร็จ กรุณาตรวจสอบ URL และ model' },
        { status: authError ? 503 : 502 },
      )
    }
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    )
  }
}
