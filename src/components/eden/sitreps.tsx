'use client'

// EDEN DMS — โมดูลรายงานสถานการณ์ (SITREP) (cms+sit)
import * as React from 'react'
import {
  Plus, Pencil, Trash2, Eye, User, Clock, Siren, FileText, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { fmtDateTime, fmtNum } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  useFetch, apiSend, ModuleHeader, RefreshButton, SearchInput,
  EmptyState, TableSkeleton, ErrorState, FormDialog, Field, useConfirmDelete,
} from '@/components/eden/shared'

interface Report {
  id: string
  incidentId: string | null
  incident?: { code: string; title: string; severity: string } | null
  title: string
  content: string
  status: string // 'draft' | 'published'
  author: string | null
  createdAt: string
}

interface IncidentLite {
  id: string
  code: string
  title: string
  severity: string
}

interface FormState {
  title: string
  incidentId: string
  content: string
  status: string
  author: string
}

const EMPTY_LIST: Report[] = []

// สถานะรายงาน — ทำ inline (draft สี slate, published สี emerald)
const STATUS_META: Record<string, { label: string; badge: string }> = {
  draft: { label: 'ฉบับร่าง', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  published: { label: 'เผยแพร่แล้ว', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

const EMPTY_FORM: FormState = {
  title: '',
  incidentId: 'none',
  content: '',
  status: 'draft',
  author: 'ผู้ปฏิบัติงาน',
}

const truncate = (text: string, max = 160) => {
  const s = text ?? ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}

type StatusFilter = 'all' | 'published' | 'draft'

export default function SitrepsModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<Report[]>('/api/reports')
  const { data: incidentData, refetch: refetchIncidents } = useFetch<IncidentLite[]>('/api/incidents')
  const confirmDelete = useConfirmDelete()

  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Report | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [reading, setReading] = React.useState<Report | null>(null)

  const reports = data ?? EMPTY_LIST
  const incidents = incidentData ?? []

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return [r.title, r.author].some((v) => v?.toLowerCase().includes(q))
    })
  }, [reports, search, statusFilter])

  const counts = React.useMemo(() => ({
    all: reports.length,
    published: reports.filter((r) => r.status === 'published').length,
    draft: reports.filter((r) => r.status === 'draft').length,
  }), [reports])

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (r: Report) => {
    setEditing(r)
    setForm({
      title: r.title ?? '',
      incidentId: r.incidentId ?? 'none',
      content: r.content ?? '',
      status: r.status ?? 'draft',
      author: r.author ?? 'ผู้ปฏิบัติงาน',
    })
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'หัวข้อรายงานเป็นข้อมูลที่จำเป็น', variant: 'destructive' })
      return
    }
    if (!form.content.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'เนื้อหารายงานสถานการณ์เป็นข้อมูลที่จำเป็น', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        status: form.status,
        author: form.author.trim() || 'ผู้ปฏิบัติงาน',
        ...(form.incidentId !== 'none' ? { incidentId: form.incidentId } : {}),
      }
      if (editing) {
        await apiSend(`/api/reports/${editing.id}`, 'PUT', payload)
        toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดตรายงานสถานการณ์เรียบร้อยแล้ว' })
      } else {
        await apiSend('/api/reports', 'POST', payload)
        toast({ title: 'บันทึกสำเร็จ', description: 'รายงานสถานการณ์ฉบับใหม่ถูกเพิ่มเข้าระบบแล้ว' })
      }
      setFormOpen(false)
      refetch()
      if (form.incidentId !== 'none') refetchIncidents()
    } catch (err) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err instanceof Error ? err.message : 'ไม่สามารถบันทึกรายงานได้',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (r: Report) => {
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/reports/${r.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบรายงาน ${r.title} เรียบร้อยแล้ว` })
        refetch()
      } catch (err) {
        toast({
          title: 'ลบไม่สำเร็จ',
          description: err instanceof Error ? err.message : 'ไม่สามารถลบรายงานได้',
          variant: 'destructive',
        })
      }
    }, `รายงาน "${r.title}"`)
  }

  return (
    <div className="space-y-6">
      {confirmDelete.dialog}

      <ModuleHeader
        title="รายงานสถานการณ์ (SITREP)"
        description="รวบรวมรายงานสถานการณ์ภัยพิบัติทั้งฉบับร่างและฉบับเผยแพร่ ผูกเข้ากับเหตุการณ์ที่เกี่ยวข้อง"
        actions={
          <>
            <RefreshButton onClick={() => refetch()} loading={loading} />
            <Button onClick={openCreate} size="sm" className="h-9">
              <Plus className="h-4 w-4" /> เขียนรายงาน
            </Button>
          </>
        }
      />

      {/* ฟิลเตอร์สถานะ + ค้นหา */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด ({fmtNum(counts.all)})</TabsTrigger>
            <TabsTrigger value="published">เผยแพร่ ({fmtNum(counts.published)})</TabsTrigger>
            <TabsTrigger value="draft">ฉบับร่าง ({fmtNum(counts.draft)})</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาจากหัวข้อหรือผู้รายงาน..." />
      </div>

      {/* รายการรายงานแบบการ์ด */}
      {error ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <ErrorState message={error} onRetry={() => refetch()} />
        </div>
      ) : loading && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <TableSkeleton rows={6} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState message="ยังไม่มีรายงานสถานการณ์ที่ตรงกับเงื่อนไข" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status] ?? { label: r.status, badge: 'bg-slate-100 text-slate-600 border-slate-200' }
            return (
              <div
                key={r.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-semibold text-slate-900">{r.title}</h3>
                  <Badge variant="outline" className={cn('shrink-0 whitespace-nowrap', meta.badge)}>
                    {meta.label}
                  </Badge>
                </div>

                <div className="mt-2 min-w-0">
                  {r.incident ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                      <Siren className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.incident.code} — {r.incident.title}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">ไม่ผูกเหตุการณ์</span>
                  )}
                </div>

                <p className="mt-3 flex-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {truncate(r.content)}
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.author ?? 'ไม่ระบุ'}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDateTime(r.createdAt)}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setReading(r)}>
                    <Eye className="h-3.5 w-3.5" /> อ่านเพิ่ม
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)} aria-label={`แก้ไขรายงาน ${r.title}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">แก้ไข</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDelete(r)}
                    aria-label={`ลบรายงาน ${r.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">ลบ</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ฟอร์มเขียน/แก้ไขรายงาน */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        wide
        title={editing ? 'แก้ไขรายงานสถานการณ์' : 'เขียนรายงานสถานการณ์'}
        description="รายงาน SITREP ใช้สรุปสถานการณ์ปัจจุบันของเหตุการณ์ภัยพิบัติที่กำลังติดตาม"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="หัวข้อรายงาน" required>
            <Input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="เช่น SITREP ครั้งที่ 3 — สถานการณ์น้ำท่วมเช้าวันนี้"
            />
          </Field>
          <Field label="เหตุการณ์ที่เกี่ยวข้อง">
            <Select value={form.incidentId} onValueChange={(v) => setField('incidentId', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="เลือกเหตุการณ์" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่ผูกเหตุการณ์</SelectItem>
                {incidents.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.code} — {i.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="เนื้อหารายงาน" required>
            <Textarea
              rows={8}
              value={form.content}
              onChange={(e) => setField('content', e.target.value)}
              placeholder="สรุปสถานการณ์ ความเสียหาย การปฏิบัติงานที่ดำเนินการ และความต้องการที่สำคัญ..."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="สถานะรายงาน">
              <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">ฉบับร่าง</SelectItem>
                  <SelectItem value="published">เผยแพร่แล้ว</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="ผู้รายงาน">
              <Input
                value={form.author}
                onChange={(e) => setField('author', e.target.value)}
                placeholder="ผู้ปฏิบัติงาน"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'บันทึกการแก้ไข' : 'บันทึกรายงาน'}
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* อ่านรายงานเนื้อหาเต็ม */}
      <Dialog open={!!reading} onOpenChange={(o) => !o && setReading(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {reading && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('whitespace-nowrap', (STATUS_META[reading.status] ?? STATUS_META.draft).badge)}
                  >
                    <FileText className="h-3 w-3" />
                    {(STATUS_META[reading.status] ?? STATUS_META.draft).label}
                  </Badge>
                  {reading.incident && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                      <Siren className="h-3 w-3" /> {reading.incident.code} — {reading.incident.title}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-left text-lg">{reading.title}</DialogTitle>
                <DialogDescription className="text-left">
                  โดย {reading.author ?? 'ไม่ระบุ'} • {fmtDateTime(reading.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {reading.content}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="outline" onClick={() => setReading(null)}>ปิด</Button>
                <Button onClick={() => { openEdit(reading); setReading(null) }}>
                  <Pencil className="h-4 w-4" /> แก้ไขรายงาน
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
