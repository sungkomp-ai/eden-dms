'use client'

// EDEN DMS — โมดูลผู้ช่วย AI: ผู้เชี่ยวชาญการจัดการภัยพิบัติ
// รับคำถาม → วิเคราะห์ → ตอบ + คำแนะนำ | ค้นข้อมูลในแพลตฟอร์ม + ข้อมูลภายนอก
// รับไฟล์ข้อมูลภายนอก (CSV/TSV/JSON/XLSX) หรือ URL ไฟล์ → ตรวจจับโมดูล → นำเข้าสู่ระบบ
import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Bot, Send, Trash2, Database, Globe, Sparkles, Lightbulb,
  ExternalLink, Loader2, Radio, ArrowUpRight, Phone,
  AlertTriangle, Users, Home, Boxes, ClipboardList, FileText, Bell,
  Paperclip, FileSpreadsheet, CheckCircle2, XCircle, Link2, Upload,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/constants'
import { useFetch } from './shared'
import { useToast } from '@/hooks/use-toast'

// ---------- types ----------
interface WebSourceItem { name: string; url: string; host: string; snippet: string }

interface ImportPreviewData {
  jobId: string
  module: string
  moduleLabel: string
  moduleDescription?: string
  fileName: string
  source: 'file' | 'url' | 'text'
  totalRows: number
  fields: { key: string; label: string }[]
  mapping: { column: string; field: string }[]
  records: Record<string, string>[]
  warnings: string[]
}

interface ImportDocData { fileName: string; summary: string }

interface ImportRowError { row: number; error: string }

interface ImportResultSummary {
  moduleLabel: string
  fileName: string
  totalRows: number
  created: number
  skipped: number
  failed: ImportRowError[]
  createdNames: string[]
}

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: WebSourceItem[]
  usedPlatform?: boolean
  usedWeb?: boolean
  error?: boolean
  importData?: ImportPreviewData
  importDoc?: ImportDocData
}

interface StatsTotals {
  activeIncidents: number
  affectedPeople: number
  missingPersons: number
  shelterCapacity: number
  shelterOccupancy: number
  pendingRequests: number
  lowStock: number
  inventoryItems: number
  draftAlerts: number
  reports: number
}

const uid = () => `m${Date.now()}${Math.random().toString(36).slice(2, 8)}`

// นามสกุลไฟล์ข้อมูลที่รองรับ (ฝั่ง client — ตรวจก่อนอัปโหลด)
const DATA_FILE_RE = /\.(csv|tsv|tab|json|geojson|xlsx|xls|xlsm)$/i
const MAX_FILE_MB = 5

const WELCOME: ChatMsg = {
  id: 'welcome',
  role: 'assistant',
  content: `สวัสดีครับ ผมคือ **EDEN AI** — ผู้ช่วยผู้เชี่ยวชาญด้านการจัดการภัยพิบัติของศูนย์ปฏิบัติการ

ผมช่วยคุณได้เรื่อง:
- **วิเคราะห์และตอบคำถาม** สถานการณ์ภัยพิบัติ ทั้งในและนอกระบบ
- **ให้คำแนะนำที่จำเป็น** การเตรียมพร้อม ตอบโต้ และฟื้นฟู ตามมาตรฐาน ปภ. / ICS / Sendai
- **ค้นข้อมูลภายนอก** ข่าวและแหล่งข้อมูลล่าสุด (เปิดสวิตช์ "ค้นหาข้อมูลภายนอก") และอ่านลิงก์ที่แนบในคำถามให้อัตโนมัติ
- **รับไฟล์ข้อมูลภายนอก** CSV / TSV / JSON / Excel — กดปุ่ม 📎 แนบไฟล์ หรือวางลิงก์ไฟล์ข้อมูล ผมจะตรวจจับโมดูลที่เกี่ยวข้องและช่วยนำเข้าสู่ระบบให้ (พรีวิวก่อนบันทึกทุกครั้ง)

พิมพ์คำถาม แนบไฟล์ หรือแตะตัวอย่างคำถามทางขวาเพื่อเริ่มได้เลยครับ`,
}

const QUICK_PROMPTS: { text: string; web?: boolean }[] = [
  { text: 'สรุปสถานการณ์ภัยพิบัติที่กำลังดำเนินการอยู่ในระบบตอนนี้ พร้อมความเสี่ยงที่ควรเฝ้าระวัง' },
  { text: 'สินค้าในคลังที่ต่ำกว่าจุดต่ำมีอะไรบ้าง ควรเติมสต๊อกตามลำดับความสำคัญอย่างไร' },
  { text: 'ศูนย์พักพิงตอนนี้รองรับผู้ประสบภัยได้อีกกี่คน และมีแห่งไหนใกล้เต็มความจุ', web: true },
  { text: 'ข่าวสถานการณ์น้ำท่วมประเทศไทยล่าสุดมีอะไรบ้าง', web: true },
  { text: 'จะนำเข้าไฟล์ข้อมูลภายนอก (CSV/Excel) เข้าสู่โมดูลต่าง ๆ ในระบบได้อย่างไร รองรับโมดูลใดบ้าง' },
]

// คลาสจัดแต่ง markdown ภายในฟองคำตอบ
const MD_CLS = cn(
  'text-[13px] leading-relaxed space-y-2',
  '[&_h1]:hidden [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1',
  '[&_p]:leading-relaxed [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
  '[&_li]:ml-1 [&_strong]:font-semibold [&_hr]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600',
)

// ---------- หน้าหลักโมดูล ----------
export default function AIAssistantModule() {
  const [msgs, setMsgs] = React.useState<ChatMsg[]>([WELCOME])
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [extracting, setExtracting] = React.useState(false)
  const [usePlatform, setUsePlatform] = React.useState(true)
  const [useWeb, setUseWeb] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const { data: stats, loading: statsLoading } = useFetch<{ totals?: StatsTotals }>('/api/stats')

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, sending, extracting])

  // ---------- ตรวจจับ/แปลงข้อมูล (ไฟล์แนบ หรือ URL ไฟล์ข้อมูล) ----------
  async function runExtract(payload: { file?: File; url?: string; note: string; displayText: string }) {
    setMsgs((prev) => [...prev, { id: uid(), role: 'user', content: payload.displayText }])
    setExtracting(true)
    try {
      let res: Response
      if (payload.file) {
        const fd = new FormData()
        fd.append('file', payload.file)
        fd.append('note', payload.note)
        res = await fetch('/api/ai-assistant/extract', { method: 'POST', body: fd })
      } else if (payload.url) {
        res = await fetch('/api/ai-assistant/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload.url, note: payload.note }),
        })
      } else return

      const json = (await res.json()) as {
        kind?: 'data' | 'document'
        error?: string
        fileName?: string
        summary?: string
      } & Partial<ImportPreviewData>

      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)

      if (json.kind === 'data' && json.jobId) {
        setMsgs((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: `ตรวจพบข้อมูลสำหรับนำเข้าจาก **${json.fileName}** — ผมแมปคอลัมน์เข้าโมดูล **${json.moduleLabel}** ให้แล้ว ตรวจสอบพรีวิวด้านล่าง แล้วกด "นำเข้าสู่ระบบ" เพื่อบันทึกจริงครับ`,
            importData: json as ImportPreviewData,
          },
        ])
      } else {
        setMsgs((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: json.summary ?? 'ไม่สามารถวิเคราะห์เนื้อหาได้',
            importDoc: { fileName: json.fileName ?? 'ไฟล์', summary: json.summary ?? '' },
          },
        ])
      }
    } catch (e) {
      setMsgs((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: e instanceof Error ? e.message : 'วิเคราะห์ข้อมูลไม่สำเร็จ', error: true },
      ])
    } finally {
      setExtracting(false)
      taRef.current?.focus()
    }
  }

  function handleFileChosen(file: File) {
    if (sending || extracting) return
    if (!DATA_FILE_RE.test(file.name)) {
      toast({
        title: 'รูปแบบไฟล์ไม่รองรับ',
        description: 'รองรับเฉพาะไฟล์ .csv .tsv .json .xlsx .xls (สูงสุด 5MB)',
        variant: 'destructive',
      })
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: 'ไฟล์ใหญ่เกิน 5MB', description: 'กรุณาแบ่งไฟล์หรือแปลงเป็น CSV', variant: 'destructive' })
      return
    }
    const note = input.trim()
    setInput('')
    void runExtract({
      file,
      note,
      displayText: `📎 แนบไฟล์: ${file.name}${note ? `\n${note}` : ''}`,
    })
  }

  // ---------- ส่งคำถามแชท ----------
  async function send(text?: string, forceWeb?: boolean) {
    const q = (text ?? input).trim()
    if (!q || sending || extracting) return
    if (forceWeb) setUseWeb(true)

    // ลิงก์ไฟล์ข้อมูล (.csv/.json/.xlsx ฯลฯ) → flow นำเข้าแทนแชท
    const urlMatch = q.match(/https?:\/\/[^\s]+/)
    if (urlMatch && /\.(csv|tsv|tab|json|geojson|xlsx|xls)(\?|#|$)/i.test(urlMatch[0])) {
      setInput('')
      await runExtract({ url: urlMatch[0], note: q.replace(urlMatch[0], '').trim(), displayText: q })
      return
    }

    const history = msgs
      .filter((m) => !m.error && m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }))

    setMsgs((prev) => [...prev, { id: uid(), role: 'user', content: q }])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, usePlatform, useWeb: forceWeb ? true : useWeb }),
      })
      const json = (await res.json()) as { answer?: string; sources?: WebSourceItem[]; usedPlatform?: boolean; usedWeb?: boolean; error?: string }
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setMsgs((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: json.answer ?? '',
          sources: json.sources,
          usedPlatform: json.usedPlatform,
          usedWeb: json.usedWeb,
        },
      ])
    } catch (e) {
      setMsgs((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ', error: true },
      ])
    } finally {
      setSending(false)
      taRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const t = stats?.totals

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
            <Bot className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">ผู้ช่วย AI ด้านการจัดการภัยพิบัติ (EDEN AI)</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              วิเคราะห์คำถาม ค้นหาข้อมูลภายนอก อ่านลิงก์อัตโนมัติ และรับไฟล์ข้อมูล (CSV/Excel/JSON) เพื่อนำเข้าสู่โมดูลที่เกี่ยวข้องในระบบ
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700"><Sparkles className="mr-1 h-3 w-3" />วิเคราะห์ &amp; ตอบคำถาม</Badge>
              <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700"><Lightbulb className="mr-1 h-3 w-3" />คำแนะนำเชิงปฏิบัติการ</Badge>
              <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700"><Database className="mr-1 h-3 w-3" />ข้อมูลในแพลตฟอร์ม</Badge>
              <Badge variant="outline" className="border-sky-300 bg-white text-sky-700"><Globe className="mr-1 h-3 w-3" />ค้นหาภายนอก</Badge>
              <Badge variant="outline" className="border-violet-300 bg-white text-violet-700"><Upload className="mr-1 h-3 w-3" />รับไฟล์ &amp; นำเข้าข้อมูล</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ===== แชท ===== */}
        {/* self-start: ไม่ยืดตามความสูงของ column ขวา (กันช่องว่างใต้ปุ่มส่ง) */}
        <Card className="flex min-h-0 flex-col self-start">
          <CardHeader className="flex-row items-center gap-3 border-b border-slate-100 py-4">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm">EDEN AI</CardTitle>
              <CardDescription className="text-xs">ผู้เชี่ยวชาญการจัดการภัยพิบัติ · ออนไลน์</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-slate-500 hover:text-red-600"
              onClick={() => { if (!sending && !extracting) setMsgs([WELCOME]) }}
              disabled={sending || extracting}
              aria-label="ล้างการสนทนา"
            >
              <Trash2 className="h-3.5 w-3.5" /> ล้างแชท
            </Button>
          </CardHeader>

          {/* พื้นที่ข้อความ — เลื่อนขึ้นลงได้ภายใน (ความสูงแน่นอน 56dvh ห้ามใช้ flex-1 เพราะ flex container สูงแบบ auto จะทำให้ div ขยายตามเนื้อหาเลื่อนไม่ได้) */}
          <div
            ref={scrollRef}
            className="h-[56dvh] min-h-[420px] overflow-y-auto overscroll-contain bg-slate-50/60 p-4 space-y-4
              [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400
              [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]"
            aria-label="บทสนทนากับผู้ช่วย AI"
          >
            {msgs.map((m) => (
              <div key={m.id} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white',
                    m.role === 'assistant' ? 'bg-emerald-600' : 'bg-violet-600',
                  )}
                  aria-hidden
                >
                  {m.role === 'assistant' ? <Bot className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </div>
                <div className={cn('min-w-0 max-w-[85%] space-y-1.5', m.role === 'user' && 'flex flex-col items-end')}>
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 shadow-sm',
                      m.role === 'user'
                        ? 'rounded-tr-sm bg-emerald-600 text-white'
                        : m.error
                          ? 'rounded-tl-sm border border-red-200 bg-red-50 text-red-700'
                          : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800',
                    )}
                  >
                    {m.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                    ) : (
                      <>
                        {m.importDoc && (
                          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <FileText className="h-3 w-3" /> เอกสาร: {m.importDoc.fileName}
                          </p>
                        )}
                        <div className={MD_CLS}>
                          <ReactMarkdown
                            components={{ a: (p) => <a href={p.href} target="_blank" rel="noopener noreferrer">{p.children}</a> }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      </>
                    )}
                  </div>

                  {/* การ์ดพรีวิวนำเข้าข้อมูล */}
                  {m.role === 'assistant' && m.importData && (
                    <ImportPreviewCard
                      data={m.importData}
                      onImported={(r) => {
                        toast({
                          title: r.failed.length > 0
                            ? `นำเข้าสำเร็จ ${r.created} รายการ (ล้มเหลว ${r.failed.length})`
                            : `นำเข้าสู่ระบบสำเร็จ ${r.created} รายการ`,
                          description: `${r.moduleLabel} — ${r.fileName}`,
                          variant: r.created === 0 && r.failed.length > 0 ? 'destructive' : 'default',
                        })
                      }}
                    />
                  )}

                  {/* แหล่งข้อมูลภายนอกที่อ้างอิง */}
                  {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                    <div className="w-full rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <Globe className="h-3 w-3" /> แหล่งข้อมูลภายนอกที่อ้างอิง ({m.sources.length})
                      </p>
                      <ul className="space-y-1">
                        {m.sources.map((s, i) => (
                          <li key={`${m.id}-src-${i}`}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
                            >
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-700">[{i + 1}]</span>
                              <span className="min-w-0 flex-1 truncate">{s.name} — <span className="text-slate-400">{s.host}</span></span>
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-300 group-hover:text-emerald-600" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ป้ายบอกแหล่งข้อมูลที่ใช้ */}
                  {m.role === 'assistant' && !m.error && m.id !== 'welcome' && (m.usedPlatform || m.usedWeb) && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {m.usedPlatform && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <Database className="h-2.5 w-2.5" /> ใช้ข้อมูลในระบบ
                        </span>
                      )}
                      {m.usedWeb && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                          <Globe className="h-2.5 w-2.5" /> ค้นหาจากภายนอก
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* กำลังพิมพ์ */}
            {(sending || extracting) && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden>
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm" aria-label="กำลังประมวลผลคำตอบ">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
                    <span className="ml-2 text-[11px] text-slate-400">
                      {extracting ? 'กำลังอ่านไฟล์ ตรวจจับโมดูล และจับคู่คอลัมน์...' : 'กำลังวิเคราะห์และรวบรวมข้อมูล...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* แถบตั้งค่าแหล่งข้อมูล + ช่องพิมพ์ */}
          <div className="border-t border-slate-100 bg-white p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <Switch checked={usePlatform} onCheckedChange={setUsePlatform} aria-label="ใช้ข้อมูลในระบบ" />
                <span className={cn('flex items-center gap-1.5 text-xs font-medium', usePlatform ? 'text-emerald-700' : 'text-slate-400')}>
                  <Database className="h-3.5 w-3.5" /> ใช้ข้อมูลในระบบ
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Switch checked={useWeb} onCheckedChange={setUseWeb} aria-label="ค้นหาข้อมูลภายนอก" />
                <span className={cn('flex items-center gap-1.5 text-xs font-medium', useWeb ? 'text-sky-700' : 'text-slate-400')}>
                  <Globe className="h-3.5 w-3.5" /> ค้นหาข้อมูลภายนอก
                </span>
              </label>
              <span className="hidden text-[11px] text-slate-400 sm:inline">แนบไฟล์ .csv/.json/.xlsx เพื่อนำเข้าข้อมูลสู่ระบบ</span>
            </div>

            <div className="flex items-end gap-2">
              {/* แนบไฟล์ข้อมูล */}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.tab,.json,.geojson,.xlsx,.xls,.xlsm,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) handleFileChosen(f)
                }}
                aria-label="เลือกไฟล์ข้อมูลเพื่อนำเข้าระบบ"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-[44px] w-[44px] shrink-0 border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                onClick={() => fileRef.current?.click()}
                disabled={sending || extracting}
                aria-label="แนบไฟล์ข้อมูล (CSV/Excel/JSON) เพื่อนำเข้าสู่ระบบ"
                title="แนบไฟล์ข้อมูล (CSV/Excel/JSON) เพื่อนำเข้าสู่ระบบ"
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <Textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="พิมพ์คำถาม วางลิงก์เว็บ/ลิงก์ไฟล์ข้อมูล หรือกด 📎 แนบไฟล์เพื่อนำเข้าสู่ระบบ..."
                className="min-h-[44px] resize-none text-sm"
                rows={1}
                aria-label="ช่องพิมพ์คำถามถึงผู้ช่วย AI"
              />
              <Button
                onClick={() => send()}
                disabled={sending || extracting || !input.trim()}
                className="h-[44px] shrink-0 gap-1.5 bg-emerald-600 px-4 hover:bg-emerald-700"
                aria-label="ส่งคำถาม"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">ส่ง</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* ===== แถบด้านข้าง ===== */}
        <div className="space-y-6">
          {/* ข้อมูลบนแพลตฟอร์ม (live) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Radio className="h-4 w-4 text-emerald-600" /> ข้อมูลบนแพลตฟอร์ม (สด)</CardTitle>
              <CardDescription className="text-xs">ชุดข้อมูลนี้ถูกส่งให้ AI วิเคราะห์เมื่อเปิด &ldquo;ใช้ข้อมูลในระบบ&rdquo;</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {statsLoading && !t ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              ) : t ? (
                <>
                  <KpiRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="เหตุการณ์กำลังดำเนินการ" value={t.activeIncidents} tone="red" />
                  <KpiRow icon={<Users className="h-3.5 w-3.5" />} label="ผู้ประสบภัย (สะสม)" value={t.affectedPeople} tone="amber" />
                  <KpiRow icon={<Users className="h-3.5 w-3.5" />} label="บุคคลสูญหาย" value={t.missingPersons} tone="amber" />
                  <KpiRow
                    icon={<Home className="h-3.5 w-3.5" />}
                    label="อยู่ศูนย์พักพิง / ความจุ"
                    value={`${fmtNum(t.shelterOccupancy)}/${fmtNum(t.shelterCapacity)}`}
                    tone="emerald"
                  />
                  <KpiRow icon={<Boxes className="h-3.5 w-3.5" />} label="สินค้าต่ำกว่าจุดต่ำ" value={t.lowStock} tone="red" />
                  <KpiRow icon={<ClipboardList className="h-3.5 w-3.5" />} label="คำขอรอดำเนินการ" value={t.pendingRequests} tone="amber" />
                  <KpiRow icon={<FileText className="h-3.5 w-3.5" />} label="รายงาน SITREP" value={t.reports} tone="slate" />
                  <KpiRow icon={<Bell className="h-3.5 w-3.5" />} label="แจ้งเตือนฉบับร่าง" value={t.draftAlerts} tone="slate" />
                </>
              ) : (
                <p className="text-xs text-slate-400">โหลดข้อมูลไม่สำเร็จ — ลองรีเฟรชหน้า</p>
              )}
            </CardContent>
          </Card>

          {/* ตัวอย่างคำถาม */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-emerald-600" /> ตัวอย่างคำถาม</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p.text, p.web)}
                  disabled={sending || extracting}
                  className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
                >
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0">{p.text}</span>
                  {p.web && <Badge variant="outline" className="ml-auto shrink-0 border-sky-200 px-1.5 py-0 text-[9px] text-sky-600">เว็บ</Badge>}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* สายด่วนฉุกเฉิน */}
          <Card className="border-red-200 bg-red-50/60">
            <CardContent className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-700"><Phone className="h-3.5 w-3.5" /> สายด่วนฉุกเฉิน</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-red-600">
                การแพทย์ฉุกเฉิน <strong>1669</strong> · เหตุด่วน ปภ. <strong>1784</strong> · กู้ภัย/ดับเพลิง <strong>199</strong>
              </p>
              <p className="mt-1 text-[10px] text-red-500">ผู้ช่วย AI เสริมการตัดสินใจ — ไม่ทดแทนการประสานงานฉุกเฉินทางการ</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------- การ์ดพรีวิวนำเข้าข้อมูล (ตรวจสอบก่อนบันทึกจริง) ----------
function ImportPreviewCard({ data, onImported }: { data: ImportPreviewData; onImported: (r: ImportResultSummary) => void }) {
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<ImportResultSummary | null>(null)

  const labelFor = (key: string) => data.fields.find((f) => f.key === key)?.label ?? key

  async function doImport() {
    if (busy || result) return
    setBusy(true)
    try {
      const res = await fetch('/api/ai-assistant/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: data.jobId }),
      })
      const json = (await res.json()) as { error?: string } & ImportResultSummary
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setResult(json)
      onImported(json)
    } catch (e) {
      toast({
        title: 'นำเข้าข้อมูลไม่สำเร็จ',
        description: e instanceof Error ? e.message : 'กรุณาลองใหม่',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full rounded-xl border border-emerald-200 bg-white shadow-sm">
      {/* หัวการ์ด */}
      <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-3 py-2.5 rounded-t-xl">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-800">ตรวจพบข้อมูลนำเข้า: {data.moduleLabel}</p>
          <p className="flex items-center gap-1 truncate text-[10px] text-slate-500">
            {data.source === 'url' ? <Link2 className="h-2.5 w-2.5 shrink-0" /> : <Paperclip className="h-2.5 w-2.5 shrink-0" />}
            {data.fileName} · {fmtNum(data.totalRows)} แถว
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-emerald-300 bg-white text-[10px] text-emerald-700">พรีวิวก่อนบันทึก</Badge>
      </div>

      {/* จับคู่คอลัมน์ */}
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">การจับคู่คอลัมน์ → ฟิลด์ของโมดูล</p>
        <div className="flex flex-wrap gap-1.5">
          {data.fields.map((f) => {
            const col = data.mapping.find((m) => m.field === f.key)?.column
            return (
              <span key={f.key} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                <span className="max-w-[120px] truncate text-slate-400" title={col}>{col ?? '(กำหนดทุกแถว)'}</span>
                <ArrowUpRight className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                <span className="font-semibold text-emerald-700">{f.label}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* ตารางตัวอย่าง */}
      <div className="max-h-44 overflow-auto border-b border-slate-100
        [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300
        [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]">
        <table className="w-full min-w-[420px] text-left text-[11px]" aria-label="ตัวอย่างข้อมูลที่จะนำเข้า">
          <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              {data.fields.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-3 py-1.5 font-semibold">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.records.map((row, i) => (
              <tr key={i} className="border-t border-slate-50 hover:bg-emerald-50/40">
                {data.fields.map((f) => (
                  <td key={f.key} className="max-w-[160px] truncate px-3 py-1.5 text-slate-700" title={row[f.key] ?? ''}>
                    {row[f.key] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* เตือน/หมายเหตุ */}
      {data.warnings.length > 0 && (
        <div className="border-b border-slate-100 bg-amber-50/60 px-3 py-2">
          {data.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1 text-[10px] leading-relaxed text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {/* ผลลัพธ์หลังนำเข้า */}
      {result ? (
        <div className="space-y-1.5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            นำเข้าเสร็จสิ้น: สำเร็จ {fmtNum(result.created)} · ข้าม (ซ้ำ) {fmtNum(result.skipped)} · ล้มเหลว {fmtNum(result.failed.length)}
          </p>
          {result.createdNames.length > 0 && (
            <p className="truncate text-[10px] text-slate-500" title={result.createdNames.join(' · ')}>
              {result.createdNames.slice(0, 6).join(' · ')}{result.createdNames.length > 6 ? ' …' : ''}
            </p>
          )}
          {result.failed.length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded-lg border border-red-100 bg-red-50/70 p-2 space-y-1
              [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [scrollbar-width:thin]">
              {result.failed.map((f, i) => (
                <p key={i} className="flex items-start gap-1 text-[10px] leading-relaxed text-red-600">
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" /> แถวที่ {f.row}: {f.error}
                </p>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400">ดูข้อมูลที่นำเข้าได้ที่โมดูล “{data.moduleLabel}” ในเมนูด้านซ้าย</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-[10px] text-slate-400">ระบบจะบันทึก {fmtNum(data.totalRows)} รายการ พร้อม audit log</p>
          <Button
            onClick={doImport}
            disabled={busy}
            size="sm"
            className="h-8 shrink-0 gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700"
            aria-label={`ยืนยันนำเข้าข้อมูล ${data.totalRows} รายการ`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            นำเข้าสู่ระบบ ({fmtNum(data.totalRows)} รายการ)
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------- KPI row เล็ก ----------
function KpiRow({ icon, label, value, tone }: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone: 'red' | 'amber' | 'emerald' | 'slate'
}) {
  const tones = {
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-500',
  } as const
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', tones[tone])}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{label}</span>
      <span className="text-xs font-bold text-slate-800">
        {typeof value === 'number' ? fmtNum(value) : value}
      </span>
    </div>
  )
}
