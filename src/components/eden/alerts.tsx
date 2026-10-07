'use client'
// EDEN DMS — โมดูลระบบแจ้งเตือนภัย (alerts / msg)
import * as React from 'react'
import {
  Info, TriangleAlert, Siren, Bell, Send, Pencil, Trash2, FileEdit, CalendarClock, SendHorizonal, Loader2, RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  ALERT_CHANNELS, ALERT_SEVERITIES, ALERT_AUDIENCES, ALERT_STATUS,
  optLabel, fmtDateTime,
} from '@/lib/constants'
import {
  apiSend, useFetch, ModuleHeader, StatCard, StatusBadge, SearchInput,
  EmptyState, TableSkeleton, ErrorState, FormDialog, Field, useConfirmDelete,
} from './shared'
import { cn } from '@/lib/utils'

interface Alert {
  id: string
  title: string
  message: string
  channel: string
  severity: string
  audience: string
  status: string
  scheduledAt?: string | null
  sentAt?: string | null
  incidentId?: string | null
  incident?: { code: string; title: string } | null
  createdAt: string
}

interface IncidentLite { id: string; code: string; title: string }

// ===== Outbox รายผู้รับ (delivery pipeline — เทียบ msg_outbox ของ Eden) =====
interface OutboxRow {
  id: string
  channel: string
  target: string
  status: string // queued | sent | failed
  retries: number
  error?: string | null
  sentAt?: string | null
  createdAt: string
}

interface OutboxSummary { total: number; sent: number; failed: number; queued: number }

interface OutboxResp {
  alert: Alert
  outbox: OutboxRow[]
  summary: OutboxSummary
}

const channelTone: Record<string, string> = {
  app: 'border-teal-200 bg-teal-50 text-teal-700',
  email: 'border-violet-200 bg-violet-50 text-violet-700',
  sms: 'border-orange-200 bg-orange-50 text-orange-700',
  broadcast: 'border-slate-200 bg-slate-100 text-slate-700',
}

const outboxStatusTone: Record<string, string> = {
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  queued: 'border-amber-200 bg-amber-50 text-amber-700',
}

const outboxStatusLabel: Record<string, string> = {
  sent: 'ส่งแล้ว',
  failed: 'ล้มเหลว',
  queued: 'รอส่ง',
}

const emptyForm = {
  title: '', message: '', channel: 'broadcast', severity: 'info',
  audience: 'all', status: 'draft', scheduledAt: '', incidentId: '',
}

const severityIcon = (sev: string) =>
  sev === 'critical' ? Siren : sev === 'warning' ? TriangleAlert : Info

const severityTone: Record<string, string> = {
  info: 'bg-teal-50 text-teal-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
}

export default function AlertsModule() {
  const { toast } = useToast()
  const confirm = useConfirmDelete()
  const [q, setQ] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Alert | null>(null)
  const [form, setForm] = React.useState(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [busyRow, setBusyRow] = React.useState<string | null>(null)

  // สถานะของ Dialog ส่งการแจ้งเตือน & สถานะรายผู้รับ (outbox)
  const [sendFor, setSendFor] = React.useState<Alert | null>(null)
  const [sendOpen, setSendOpen] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [retrying, setRetrying] = React.useState(false)
  const outbox = useFetch<OutboxResp>(sendFor ? `/api/alerts/${sendFor.id}/outbox` : null)
  const outboxSummary = outbox.data?.summary ?? null

  const alerts = useFetch<Alert[]>('/api/alerts')
  const incidents = useFetch<IncidentLite[]>('/api/incidents')

  const filtered = React.useMemo(() => {
    const list = alerts.data ?? []
    const kw = q.trim().toLowerCase()
    if (!kw) return list
    return list.filter((a) => [a.title, a.message].filter(Boolean).join(' ').toLowerCase().includes(kw))
  }, [alerts.data, q])

  const stats = React.useMemo(() => {
    const list = alerts.data ?? []
    return {
      total: list.length,
      draft: list.filter((a) => a.status === 'draft').length,
      scheduled: list.filter((a) => a.status === 'scheduled').length,
      sent: list.filter((a) => a.status === 'sent').length,
    }
  }, [alerts.data])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (a: Alert) => {
    setEditing(a)
    setForm({
      title: a.title ?? '',
      message: a.message ?? '',
      channel: a.channel ?? 'broadcast',
      severity: a.severity ?? 'info',
      audience: a.audience ?? 'all',
      status: a.status ?? 'draft',
      scheduledAt: a.scheduledAt ? toLocalInput(a.scheduledAt) : '',
      incidentId: a.incidentId ?? '',
    })
    setDialogOpen(true)
  }

  // ISO → ค่าที่ datetime-local รับได้ (YYYY-MM-DDTHH:mm) ตามเวลาท้องถิ่น
  function toLocalInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const submit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: 'กรุณากรอกหัวข้อและข้อความ', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        message: form.message.trim(),
        channel: form.channel,
        severity: form.severity,
        audience: form.audience,
        status: form.status,
        scheduledAt: form.status === 'scheduled' && form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : null,
        incidentId: form.incidentId || null,
      }
      if (editing) {
        await apiSend(`/api/alerts/${editing.id}`, 'PUT', body)
        toast({ title: 'บันทึกสำเร็จ', description: `แก้ไขการแจ้งเตือน "${body.title}" เรียบร้อยแล้ว` })
      } else {
        await apiSend('/api/alerts', 'POST', body)
        toast({ title: 'สร้างการแจ้งเตือนสำเร็จ', description: `"${body.title}" ถูกบันทึกเป็น${optLabel(ALERT_STATUS, form.status)}` })
      }
      setDialogOpen(false)
      alerts.refetch()
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const sendNow = async (a: Alert) => {
    setBusyRow(a.id)
    try {
      await apiSend(`/api/alerts/${a.id}`, 'PUT', { status: 'sent' })
      toast({ title: 'ส่งการแจ้งเตือนแล้ว', description: `"${a.title}" ถูกส่งผ่าน${optLabel(ALERT_CHANNELS, a.channel)}ไปยัง${optLabel(ALERT_AUDIENCES, a.audience)}` })
      alerts.refetch()
    } catch (e) {
      toast({ title: 'ส่งไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setBusyRow(null)
    }
  }

  const remove = (a: Alert) => {
    confirm.open(async () => {
      try {
        await apiSend(`/api/alerts/${a.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบการแจ้งเตือน "${a.title}" แล้ว` })
        alerts.refetch()
      } catch (e) {
        toast({ title: 'ลบไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      }
    }, `การแจ้งเตือน "${a.title}"`)
  }

  // ===== Delivery pipeline: ส่ง + ติดตามรายผู้รับ =====
  const openSend = (a: Alert) => {
    setSendFor(a)
    setSendOpen(true)
  }

  // หลัง send/retry สำเร็จ: อัปเดต outbox ใน dialog + refetch รายการ + toast สรุปผล
  const applyOutboxResult = (res: OutboxResp, beforeFailed?: number) => {
    outbox.setData(res)
    setSendFor(res.alert)
    alerts.refetch()
    const s = res.summary
    if (s.total > 0 && s.failed === 0) {
      toast({
        title: `ส่งถึงผู้รับครบ ${s.total} รายการ`,
        description: `"${res.alert.title}" ถูกส่งสำเร็จทุกช่องทาง`,
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      })
    } else if (beforeFailed !== undefined) {
      const recovered = Math.max(0, beforeFailed - s.failed)
      toast({
        title: `ลองใหม่สำเร็จเพิ่ม ${recovered} รายการ`,
        description: s.failed > 0 ? `ยังล้มเหลว ${s.failed} รายการ — กดลองส่งใหม่ได้อีกครั้ง` : undefined,
        variant: 'destructive',
      })
    } else {
      toast({
        title: `ส่งสำเร็จ ${s.sent} จาก ${s.total} รายการ`,
        description: `ล้มเหลว ${s.failed} รายการ — กด "ลองส่งใหม่" เพื่อส่งซ้ำเฉพาะรายการที่ล้มเหลว`,
        variant: 'destructive',
      })
    }
  }

  const doSend = async () => {
    if (!sendFor) return
    setSending(true)
    try {
      const res = await apiSend(`/api/alerts/${sendFor.id}/send`, 'POST') as unknown as OutboxResp
      applyOutboxResult(res)
    } catch (e) {
      toast({ title: 'ส่งไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const doRetry = async () => {
    if (!sendFor) return
    setRetrying(true)
    const beforeFailed = outboxSummary?.failed ?? 0
    try {
      const res = await apiSend(`/api/alerts/${sendFor.id}/outbox`, 'POST', {}) as unknown as OutboxResp
      applyOutboxResult(res, beforeFailed)
    } catch (e) {
      toast({ title: 'ลองส่งใหม่ไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="ระบบแจ้งเตือนภัย"
        description="สร้างและส่งการแจ้งเตือนภัยพิบัติผ่าน SMS อีเมล ประกาศ และแอปพลิเคชัน"
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="ค้นหาหัวข้อ/ข้อความ..." />
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Bell className="h-4 w-4" /> สร้างการแจ้งเตือน
            </Button>
          </>
        }
      />

      {/* สถิติภาพรวม */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="การแจ้งเตือนทั้งหมด" value={stats.total} icon={<Bell />} tone="slate" />
        <StatCard title="ฉบับร่าง" value={stats.draft} icon={<FileEdit />} tone="amber" />
        <StatCard title="กำหนดส่ง" value={stats.scheduled} icon={<CalendarClock />} tone="violet" />
        <StatCard title="ส่งแล้ว" value={stats.sent} icon={<SendHorizonal />} tone="emerald" />
      </div>

      {/* รายการแบบการ์ด */}
      {alerts.error ? (
        <ErrorState message={alerts.error} onRetry={alerts.refetch} />
      ) : alerts.loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TableSkeleton rows={3} />
          <TableSkeleton rows={3} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState message="ไม่พบการแจ้งเตือน" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((a) => {
            const Icon = severityIcon(a.severity)
            return (
              <div
                key={a.id}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
                  a.severity === 'critical' ? 'border-red-200' : a.severity === 'warning' ? 'border-amber-200' : 'border-slate-200',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5', severityTone[a.severity] ?? severityTone.info)}>
                    <Icon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-snug text-slate-800">{a.title}</h3>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-500">{a.message}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge options={ALERT_SEVERITIES} value={a.severity} />
                  <Badge variant="outline" className="whitespace-nowrap border-slate-200 bg-slate-50 text-slate-600">
                    {optLabel(ALERT_CHANNELS, a.channel)}
                  </Badge>
                  <Badge variant="outline" className="whitespace-nowrap border-slate-200 bg-slate-50 text-slate-600">
                    ถึง: {optLabel(ALERT_AUDIENCES, a.audience)}
                  </Badge>
                  <StatusBadge options={ALERT_STATUS} value={a.status} />
                </div>

                {a.incident && (
                  <p className="text-xs text-slate-500">
                    เหตุการณ์ที่โยง: <span className="font-mono text-xs font-semibold text-slate-700">{a.incident.code}</span> — {a.incident.title}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-400">
                    {a.status === 'sent' && a.sentAt
                      ? `ส่งเมื่อ ${fmtDateTime(a.sentAt)}`
                      : a.status === 'scheduled' && a.scheduledAt
                        ? `กำหนดส่ง ${fmtDateTime(a.scheduledAt)}`
                        : `สร้างเมื่อ ${fmtDateTime(a.createdAt)}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm" disabled={busyRow === a.id}
                      onClick={() => openSend(a)}
                      aria-label={`ส่งและดูสถานะการส่งรายผู้รับของ ${a.title}`}
                      className="h-8 gap-1.5 border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <Send className="h-3.5 w-3.5" /> ส่ง & สถานะ
                    </Button>
                    {a.status !== 'sent' && (
                      <Button
                        size="sm" disabled={busyRow === a.id}
                        onClick={() => sendNow(a)}
                        className="h-8 bg-teal-600 px-3 text-xs text-white hover:bg-teal-700"
                      >
                        <Send className="h-3.5 w-3.5" /> ส่งเดี๋ยวนี้
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" aria-label={`แก้ไข ${a.title}`} onClick={() => openEdit(a)} className="h-7 w-7 text-slate-500 hover:text-slate-800">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`ลบ ${a.title}`} onClick={() => remove(a)} className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== ฟอร์มสร้าง/แก้ไขการแจ้งเตือน ===== */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'แก้ไขการแจ้งเตือน' : 'สร้างการแจ้งเตือน'}
        description={editing ? `แก้ไข "${editing.title}"` : 'กำหนดข้อความ ช่องทาง และกลุ่มเป้าหมายของการแจ้งเตือน'}
      >
        <div className="grid gap-4">
          <Field label="หัวข้อ" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น ⚠️ เตือนภัยน้ำท่วมฉับพลัน" />
          </Field>
          <Field label="ข้อความแจ้งเตือน" required>
            <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="รายละเอียดที่ต้องการแจ้งประชาชน/เจ้าหน้าที่" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ช่องทางส่ง">
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ระดับความรุนแรง">
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="กลุ่มเป้าหมาย">
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="สถานะ">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {form.status === 'scheduled' && (
            <Field label="กำหนดเวลาส่ง">
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </Field>
          )}
          <Field label="เหตุการณ์ที่เกี่ยวข้อง">
            <Select value={form.incidentId || 'none'} onValueChange={(v) => setForm({ ...form, incidentId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                {(incidents.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.code} — {i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'สร้างการแจ้งเตือน'}
            </Button>
          </div>
        </div>
      </FormDialog>

      {/* ===== Dialog ส่งการแจ้งเตือน & สถานะการส่งรายผู้รับ (outbox) ===== */}
      <FormDialog
        open={sendOpen}
        onOpenChange={(o) => { setSendOpen(o); if (!o) setSendFor(null) }}
        wide
        title="ส่งการแจ้งเตือน & สถานะการส่งรายผู้รับ"
        description={sendFor ? `ติดตามการจัดส่ง "${sendFor.title}" แบบรายช่องทางรายผู้รับ` : undefined}
      >
        {sendFor && (
          <div className="grid gap-4">
            {/* ข้อมูลการแจ้งเตือน */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="whitespace-nowrap border-slate-200 bg-slate-50 text-slate-600">
                ช่องทาง: {optLabel(ALERT_CHANNELS, sendFor.channel)}
              </Badge>
              <Badge variant="outline" className="whitespace-nowrap border-slate-200 bg-slate-50 text-slate-600">
                ถึง: {optLabel(ALERT_AUDIENCES, sendFor.audience)}
              </Badge>
              <StatusBadge options={ALERT_SEVERITIES} value={sendFor.severity} />
              <StatusBadge options={ALERT_STATUS} value={sendFor.status} />
            </div>

            {/* สรุปผลการส่ง */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">ทั้งหมด {outboxSummary?.total ?? 0}</Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">สำเร็จ {outboxSummary?.sent ?? 0}</Badge>
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">ล้มเหลว {outboxSummary?.failed ?? 0}</Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">คิว {outboxSummary?.queued ?? 0}</Badge>
            </div>

            {/* ปุ่มดำเนินการ */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={doSend} disabled={sending || retrying}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> กำลังส่ง...</>
                ) : (
                  <><Send className="h-4 w-4" /> {sendFor.status === 'sent' ? 'ส่งซ้ำ' : 'ส่งการแจ้งเตือน'}</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={doRetry}
                disabled={sending || retrying || (outboxSummary?.failed ?? 0) === 0}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                {retrying ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> กำลังลองส่งใหม่...</>
                ) : (
                  <><RotateCcw className="h-4 w-4" /> ลองส่งใหม่ (เฉพาะที่ล้มเหลว)</>
                )}
              </Button>
            </div>

            {/* ตาราง outbox รายผู้รับ */}
            <div className="grid gap-1.5">
              <p className="text-sm font-medium text-slate-700">คิวส่งรายผู้รับ</p>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]">
                {outbox.loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                ) : (outbox.data?.outbox.length ?? 0) === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400">
                    ยังไม่มีคิวส่ง — กด &quot;ส่งการแจ้งเตือน&quot; เพื่อสร้างคิวรายผู้รับ
                  </p>
                ) : (
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-medium text-slate-500">
                      <tr>
                        <th className="w-24 px-3 py-2 font-medium">ช่องทาง</th>
                        <th className="px-3 py-2 font-medium">ผู้รับ</th>
                        <th className="w-28 px-3 py-2 font-medium">สถานะ</th>
                        <th className="w-32 px-3 py-2 font-medium">เวลาส่ง</th>
                        <th className="hidden w-40 px-3 py-2 font-medium sm:table-cell">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(outbox.data?.outbox ?? []).map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={cn('whitespace-nowrap', channelTone[r.channel] ?? channelTone.broadcast)}>
                              {optLabel(ALERT_CHANNELS, r.channel)}
                            </Badge>
                          </td>
                          <td className="truncate px-3 py-2 text-slate-700" title={r.target}>{r.target}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={cn('whitespace-nowrap', outboxStatusTone[r.status] ?? outboxStatusTone.queued)}>
                              {outboxStatusLabel[r.status] ?? r.status}
                            </Badge>
                            {r.retries > 0 && <span className="ml-1 whitespace-nowrap text-[11px] text-slate-400">ลองใหม่ {r.retries}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{r.sentAt ? fmtDateTime(r.sentAt) : '—'}</td>
                          <td className="hidden truncate px-3 py-2 text-xs text-red-600 sm:table-cell" title={r.error ?? undefined}>{r.error ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </FormDialog>

      {confirm.dialog}
    </div>
  )
}
