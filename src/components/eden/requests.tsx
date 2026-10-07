'use client'
// EDEN DMS — โมดูลคำขอความช่วยเหลือ (requests) พร้อม workflow อนุมัติ→ดำเนินการ→สำเร็จ
import * as React from 'react'
import {
  ClipboardList, Check, X, Play, CheckCircle2, Pencil, Trash2,
  Hourglass, LoaderCircle, ListFilter, Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { REQUEST_TYPES, REQUEST_PRIORITIES, REQUEST_STATUS, fmtDate } from '@/lib/constants'
import {
  apiSend, useFetch, ModuleHeader, StatCard, StatusBadge, SearchInput,
  EmptyState, TableSkeleton, ErrorState, FormDialog, Field, useConfirmDelete,
} from './shared'

interface AidRequest {
  id: string
  requestCode: string
  requesterName: string
  requesterOrg?: string | null
  type: string
  priority: string
  status: string
  quantity?: string | null
  description?: string | null
  locationName?: string | null
  incidentId?: string | null
  incident?: { code: string; title: string } | null
  assignedTo?: string | null
  createdAt: string
}

interface IncidentLite { id: string; code: string; title: string }

const emptyForm = {
  requesterName: '', requesterOrg: '', type: 'food', priority: 'medium', status: 'pending',
  quantity: '', locationName: '', incidentId: '', assignedTo: '', description: '',
}

export default function RequestsModule() {
  const { toast } = useToast()
  const confirm = useConfirmDelete()
  const [q, setQ] = React.useState('')
  const [priority, setPriority] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AidRequest | null>(null)
  const [form, setForm] = React.useState(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [busyRow, setBusyRow] = React.useState<string | null>(null)

  const requests = useFetch<AidRequest[]>('/api/requests')
  const incidents = useFetch<IncidentLite[]>('/api/incidents')

  const filtered = React.useMemo(() => {
    const list = requests.data ?? []
    const kw = q.trim().toLowerCase()
    return list.filter((r) => {
      if (priority !== 'all' && r.priority !== priority) return false
      if (status !== 'all' && r.status !== status) return false
      if (kw) {
        const hay = [r.requestCode, r.requesterName, r.description].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [requests.data, q, priority, status])

  const stats = React.useMemo(() => {
    const list = requests.data ?? []
    return {
      total: list.length,
      pending: list.filter((r) => r.status === 'pending').length,
      inProgress: list.filter((r) => r.status === 'in_progress').length,
      fulfilled: list.filter((r) => r.status === 'fulfilled').length,
    }
  }, [requests.data])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (r: AidRequest) => {
    setEditing(r)
    setForm({
      requesterName: r.requesterName ?? '',
      requesterOrg: r.requesterOrg ?? '',
      type: r.type ?? 'food',
      priority: r.priority ?? 'medium',
      status: r.status ?? 'pending',
      quantity: r.quantity ?? '',
      locationName: r.locationName ?? '',
      incidentId: r.incidentId ?? '',
      assignedTo: r.assignedTo ?? '',
      description: r.description ?? '',
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.requesterName.trim()) {
      toast({ title: 'กรุณากรอกชื่อผู้ขอ', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        requesterName: form.requesterName.trim(),
        requesterOrg: form.requesterOrg.trim() || null,
        type: form.type,
        priority: form.priority,
        status: form.status,
        quantity: form.quantity.trim() || null,
        locationName: form.locationName.trim() || null,
        incidentId: form.incidentId || null,
        assignedTo: form.assignedTo.trim() || null,
        description: form.description.trim() || null,
      }
      if (editing) {
        await apiSend(`/api/requests/${editing.id}`, 'PUT', body)
        toast({ title: 'บันทึกสำเร็จ', description: `แก้ไขคำขอ ${editing.requestCode} เรียบร้อยแล้ว` })
      } else {
        await apiSend('/api/requests', 'POST', body)
        toast({ title: 'ยื่นคำขอสำเร็จ', description: 'ระบบได้สร้างรหัสคำขอให้อัตโนมัติแล้ว' })
      }
      setDialogOpen(false)
      requests.refetch()
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const setStatusOf = async (r: AidRequest, next: string, title: string) => {
    setBusyRow(r.id)
    try {
      await apiSend(`/api/requests/${r.id}`, 'PUT', { status: next })
      toast({ title, description: `คำขอ ${r.requestCode} — ${r.requesterName}` })
      requests.refetch()
    } catch (e) {
      toast({ title: 'ดำเนินการไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setBusyRow(null)
    }
  }

  const remove = (r: AidRequest) => {
    confirm.open(async () => {
      try {
        await apiSend(`/api/requests/${r.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบคำขอ ${r.requestCode} แล้ว` })
        requests.refetch()
      } catch (e) {
        toast({ title: 'ลบไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      }
    }, `คำขอ ${r.requestCode}`)
  }

  // ส่งออก CSV — ส่งคำค้นหาปัจจุบัน (?q=) ให้ API ด้วย (ตัวกรอง priority/status เป็นตัวกรองฝั่ง UI)
  const exportCsv = () => {
    toast({ title: 'กำลังส่งออกไฟล์ CSV...', description: 'ไฟล์รายงานคำขอความช่วยเหลือจะถูกดาวน์โหลด เปิดใน Excel ได้ทันที' })
    const params = new URLSearchParams({ format: 'csv' })
    if (q.trim()) params.set('q', q.trim())
    window.open(`/api/requests?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="คำขอความช่วยเหลือ"
        description="รับสมัคร พิจารณา และติดตามคำขอความช่วยเหลือจากพื้นที่ประสบภัย"
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="ค้นหารหัส/ผู้ขอ/รายละเอียด..." />
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> ส่งออก CSV
            </Button>
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <ClipboardList className="h-4 w-4" /> ยื่นคำขอใหม่
            </Button>
          </>
        }
      />

      {/* สถิติภาพรวม */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="คำขอทั้งหมด" value={stats.total} icon={<ListFilter />} tone="slate" />
        <StatCard title="รอพิจารณา" value={stats.pending} icon={<Hourglass />} tone="amber" />
        <StatCard title="กำลังดำเนินการ" value={stats.inProgress} icon={<LoaderCircle />} tone="violet" />
        <StatCard title="สำเร็จ" value={stats.fulfilled} icon={<CheckCircle2 />} tone="emerald" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ตัวกรอง */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            พบ <span className="font-semibold text-slate-700">{filtered.length}</span> คำขอ
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full sm:w-44" aria-label="กรองตามลำดับความสำคัญ">
                <SelectValue placeholder="ลำดับความสำคัญ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกลำดับความสำคัญ</SelectItem>
                {REQUEST_PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44" aria-label="กรองตามสถานะ">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                {REQUEST_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {requests.error ? (
          <ErrorState message={requests.error} onRetry={requests.refetch} />
        ) : requests.loading ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState message="ไม่พบคำขอความช่วยเหลือ" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>รหัส</TableHead>
                  <TableHead>ผู้ขอ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ลำดับความสำคัญ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>พื้นที่</TableHead>
                  <TableHead>ผู้รับผิดชอบ</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="text-right">ดำเนินการ / จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-700">{r.requestCode}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-800">{r.requesterName}</div>
                      {r.requesterOrg && <div className="text-xs text-slate-500">{r.requesterOrg}</div>}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {REQUEST_TYPES.find((t) => t.value === r.type)?.label ?? r.type}
                      {r.quantity && <div className="text-xs text-slate-400">{r.quantity}</div>}
                    </TableCell>
                    <TableCell><StatusBadge options={REQUEST_PRIORITIES} value={r.priority} /></TableCell>
                    <TableCell><StatusBadge options={REQUEST_STATUS} value={r.status} /></TableCell>
                    <TableCell className="max-w-40 truncate text-slate-600" title={r.locationName ?? undefined}>
                      {r.locationName ?? '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">{r.assignedTo ?? '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">{fmtDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* Workflow buttons ตามสถานะ */}
                        {r.status === 'pending' && (
                          <>
                            <Button
                              variant="outline" size="sm" disabled={busyRow === r.id}
                              onClick={() => setStatusOf(r, 'approved', 'อนุมัติคำขอแล้ว')}
                              className="h-8 border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              <Check className="h-3.5 w-3.5" /> อนุมัติ
                            </Button>
                            <Button
                              variant="outline" size="sm" disabled={busyRow === r.id}
                              onClick={() => setStatusOf(r, 'rejected', 'ปฏิเสธคำขอแล้ว')}
                              className="h-8 border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <X className="h-3.5 w-3.5" /> ปฏิเสธ
                            </Button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <Button
                            variant="outline" size="sm" disabled={busyRow === r.id}
                            onClick={() => setStatusOf(r, 'in_progress', 'เริ่มดำเนินการแล้ว')}
                            className="h-8 border-violet-300 px-2 text-xs text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                          >
                            <Play className="h-3.5 w-3.5" /> เริ่มดำเนินการ
                          </Button>
                        )}
                        {r.status === 'in_progress' && (
                          <Button
                            variant="outline" size="sm" disabled={busyRow === r.id}
                            onClick={() => setStatusOf(r, 'fulfilled', 'คำขอสำเร็จแล้ว')}
                            className="h-8 border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> สำเร็จ
                          </Button>
                        )}
                        {r.status === 'fulfilled' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">เสร็จสิ้น</Badge>
                        )}
                        {r.status === 'rejected' && (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200">ไม่อนุมัติ</Badge>
                        )}
                        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
                        <Button variant="ghost" size="icon" aria-label={`แก้ไข ${r.requestCode}`} onClick={() => openEdit(r)} className="h-7 w-7 text-slate-500 hover:text-slate-800">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`ลบ ${r.requestCode}`} onClick={() => remove(r)} className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ===== ฟอร์มยื่น/แก้ไขคำขอ ===== */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        wide
        title={editing ? `แก้ไขคำขอ ${editing.requestCode}` : 'ยื่นคำขอความช่วยเหลือใหม่'}
        description={editing ? 'ปรับปรุงข้อมูลคำขอความช่วยเหลือ' : 'กรอกข้อมูลผู้ขอและความต้องการความช่วยเหลือ'}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อผู้ขอ" required>
              <Input value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} placeholder="เช่น ผอ.สุเมธ วัฒนชัย" />
            </Field>
            <Field label="หน่วยงาน/องค์กร">
              <Input value={form.requesterOrg} onChange={(e) => setForm({ ...form, requesterOrg: e.target.value })} placeholder="เช่น เทศบาลนครเชียงใหม่" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ประเภทความช่วยเหลือ">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ลำดับความสำคัญ">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {editing && (
              <Field label="สถานะ">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="ปริมาณที่ขอ" className={editing ? '' : 'sm:col-span-1'}>
              <Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="เช่น 500 ลัง/วัน" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="พื้นที่/ที่ตั้ง">
              <Input value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} placeholder="เช่น อ.เมือง จ.เชียงใหม่" />
            </Field>
            <Field label="ผู้รับผิดชอบ">
              <Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="หน่วยงานที่รับดำเนินการ" />
            </Field>
          </div>
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
          <Field label="รายละเอียด">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="อธิบายความต้องการ จำนวนผู้ได้รับผลกระทบ ระยะเวลา ฯลฯ" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'ยื่นคำขอ'}
            </Button>
          </div>
        </div>
      </FormDialog>

      {confirm.dialog}
    </div>
  )
}
