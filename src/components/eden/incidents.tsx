'use client'

// EDEN DMS — โมดูลเหตุการณ์ภัยพิบัติ (sit)
import * as React from 'react'
import {
  Plus, Pencil, Trash2, Eye, MapPin, Users, User, Activity, Skull,
  CalendarDays, FileText, HeartHandshake, HeartPulse, Loader2, ClipboardList, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  INCIDENT_TYPES, SEVERITIES, INCIDENT_STATUS, optLabel, fmtDate, fmtNum,
} from '@/lib/constants'
import {
  useFetch, apiSend, ModuleHeader, StatCard, StatusBadge, SearchInput, RefreshButton,
  EmptyState, TableSkeleton, ErrorState, FormDialog, Field, useConfirmDelete,
} from '@/components/eden/shared'

interface Incident {
  id: string
  code: string
  title: string
  type: string
  severity: string
  status: string
  description: string | null
  locationName: string | null
  lat: number | null
  lng: number | null
  affectedPeople: number
  injured: number
  deceased: number
  startDate: string | null
  endDate: string | null
  location?: { name: string } | null
  _count?: { persons: number; reports: number; aidRequests: number }
  createdAt: string
}

interface FormState {
  title: string
  type: string
  severity: string
  status: string
  locationName: string
  affectedPeople: string
  injured: string
  deceased: string
  startDate: string
  endDate: string
  description: string
}

const EMPTY_LIST: Incident[] = []

const EMPTY_FORM: FormState = {
  title: '',
  type: 'flood',
  severity: 'medium',
  status: 'active',
  locationName: '',
  affectedPeople: '0',
  injured: '0',
  deceased: '0',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  description: '',
}

const isoToDateInput = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : ''

function DetailItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="break-words text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function CountChip({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <Icon className={`mx-auto h-4 w-4 ${tone}`} />
      <p className="mt-1 text-lg font-bold text-slate-900">{fmtNum(value)}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

export default function IncidentsModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<Incident[]>('/api/incidents')
  const confirmDelete = useConfirmDelete()

  const [search, setSearch] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Incident | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [detail, setDetail] = React.useState<Incident | null>(null)

  const incidents = data ?? EMPTY_LIST

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return incidents
    return incidents.filter((i) =>
      [i.title, i.locationName, i.code].some((v) => v?.toLowerCase().includes(q))
    )
  }, [incidents, search])

  const stats = React.useMemo(() => ({
    total: incidents.length,
    active: incidents.filter((i) => i.status === 'active').length,
    affected: incidents.reduce((s, i) => s + (i.affectedPeople ?? 0), 0),
    deceased: incidents.reduce((s, i) => s + (i.deceased ?? 0), 0),
  }), [incidents])

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (inc: Incident) => {
    setEditing(inc)
    setForm({
      title: inc.title ?? '',
      type: inc.type ?? 'other',
      severity: inc.severity ?? 'medium',
      status: inc.status ?? 'active',
      locationName: inc.locationName ?? '',
      affectedPeople: String(inc.affectedPeople ?? 0),
      injured: String(inc.injured ?? 0),
      deceased: String(inc.deceased ?? 0),
      startDate: isoToDateInput(inc.startDate),
      endDate: isoToDateInput(inc.endDate),
      description: inc.description ?? '',
    })
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'ชื่อเหตุการณ์เป็นข้อมูลที่จำเป็น', variant: 'destructive' })
      return
    }
    if (!form.startDate) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบถ้วน', description: 'วันที่เริ่มเหตุการณ์เป็นข้อมูลที่จำเป็น', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        severity: form.severity,
        status: form.status,
        locationName: form.locationName.trim(),
        affectedPeople: Number(form.affectedPeople) || 0,
        injured: Number(form.injured) || 0,
        deceased: Number(form.deceased) || 0,
        startDate: new Date(form.startDate).toISOString(),
        ...(form.endDate ? { endDate: new Date(form.endDate).toISOString() } : {}),
        description: form.description.trim(),
      }
      if (editing) {
        await apiSend(`/api/incidents/${editing.id}`, 'PUT', payload)
        toast({ title: 'บันทึกสำเร็จ', description: `อัปเดตเหตุการณ์ ${editing.code} เรียบร้อยแล้ว` })
      } else {
        await apiSend('/api/incidents', 'POST', payload)
        toast({ title: 'บันทึกสำเร็จ', description: 'รายงานเหตุการณ์ภัยพิบัติใหม่ถูกเพิ่มเข้าระบบแล้ว' })
      }
      setFormOpen(false)
      refetch()
    } catch (err) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err instanceof Error ? err.message : 'ไม่สามารถบันทึกเหตุการณ์ได้',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (inc: Incident) => {
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/incidents/${inc.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบเหตุการณ์ ${inc.code} เรียบร้อยแล้ว` })
        refetch()
      } catch (err) {
        toast({
          title: 'ลบไม่สำเร็จ',
          description: err instanceof Error ? err.message : 'ไม่สามารถลบเหตุการณ์ได้',
          variant: 'destructive',
        })
      }
    }, `เหตุการณ์ "${inc.title}"`)
  }

  // ส่งออก CSV — ใช้ filter ค้นหาปัจจุบัน (?q=) ร่วมกับ API ด้วย
  const exportCsv = () => {
    toast({ title: 'กำลังส่งออกไฟล์ CSV...', description: 'ไฟล์รายงานเหตุการณ์จะถูกดาวน์โหลด เปิดใน Excel ได้ทันที' })
    const params = new URLSearchParams({ format: 'csv' })
    if (search.trim()) params.set('q', search.trim())
    window.open(`/api/incidents?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {confirmDelete.dialog}

      <ModuleHeader
        title="เหตุการณ์ภัยพิบัติ"
        description="บันทึกและติดตามเหตุการณ์ภัยพิบัติทั้งหมด พร้อมข้อมูลผู้ประสบภัยและพื้นที่ประสบภัย"
        actions={
          <>
            <RefreshButton onClick={() => refetch()} loading={loading} />
            <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
              <Download className="h-4 w-4" /> ส่งออก CSV
            </Button>
            <Button onClick={openCreate} size="sm" className="h-9">
              <Plus className="h-4 w-4" /> รายงานเหตุการณ์ใหม่
            </Button>
          </>
        }
      />

      {/* สรุปตัวเลขภาพรวม */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="เหตุการณ์ทั้งหมด" value={fmtNum(stats.total)} sub="รายการทั้งสิ้นในระบบ" icon={<ClipboardList />} tone="slate" />
        <StatCard title="กำลังดำเนินการ" value={fmtNum(stats.active)} sub="เหตุการณ์ที่ยังไม่ควบคุมสถานการณ์" icon={<Activity />} tone="red" />
        <StatCard title="ผู้ประสบภัยรวม" value={fmtNum(stats.affected)} sub="คน จากทุกเหตุการณ์" icon={<Users />} tone="amber" />
        <StatCard title="เสียชีวิตรวม" value={fmtNum(stats.deceased)} sub="ราย เนื่องจากภัยพิบัติ" icon={<Skull />} tone="violet" />
      </div>

      {/* ตารางเหตุการณ์ */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาชื่อเหตุการณ์ พื้นที่ หรือรหัส..." />
          <p className="shrink-0 text-xs text-slate-500">พบ {fmtNum(filtered.length)} รายการ</p>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => refetch()} />
        ) : loading && !data ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState message="ยังไม่มีเหตุการณ์ภัยพิบัติในระบบ หรือไม่พบผลการค้นหา" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อเหตุการณ์</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ความรุนแรง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>พื้นที่</TableHead>
                  <TableHead className="text-right">ผู้ประสบภัย</TableHead>
                  <TableHead>วันที่เริ่ม</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inc) => (
                  <TableRow
                    key={inc.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(inc)}
                  >
                    <TableCell className="font-mono text-xs text-slate-500">{inc.code}</TableCell>
                    <TableCell className="max-w-56 truncate font-medium text-slate-900">{inc.title}</TableCell>
                    <TableCell className="text-slate-600">{optLabel(INCIDENT_TYPES, inc.type)}</TableCell>
                    <TableCell><StatusBadge options={SEVERITIES} value={inc.severity} /></TableCell>
                    <TableCell><StatusBadge options={INCIDENT_STATUS} value={inc.status} /></TableCell>
                    <TableCell className="max-w-44 truncate text-slate-600">
                      {inc.location?.name ?? inc.locationName ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-900">{fmtNum(inc.affectedPeople)}</TableCell>
                    <TableCell className="text-slate-600">{fmtDate(inc.startDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline" size="icon" className="h-8 w-8"
                          aria-label={`ดูรายละเอียด ${inc.code}`}
                          onClick={(e) => { e.stopPropagation(); setDetail(inc) }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline" size="icon" className="h-8 w-8"
                          aria-label={`แก้ไข ${inc.code}`}
                          onClick={(e) => { e.stopPropagation(); openEdit(inc) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline" size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label={`ลบ ${inc.code}`}
                          onClick={(e) => { e.stopPropagation(); handleDelete(inc) }}
                        >
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

      {/* ฟอร์มสร้าง/แก้ไขเหตุการณ์ */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        wide
        title={editing ? 'แก้ไขเหตุการณ์ภัยพิบัติ' : 'รายงานเหตุการณ์ใหม่'}
        description={editing ? `แก้ไขข้อมูลเหตุการณ์รหัส ${editing.code}` : 'กรอกข้อมูลเหตุการณ์ภัยพิบัติเพื่อบันทึกเข้าสู่ระบบ'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {editing && (
              <Field label="รหัสเหตุการณ์">
                <Input value={editing.code} readOnly className="bg-slate-50 font-mono text-xs text-slate-500" />
              </Field>
            )}
            <Field label="ชื่อเหตุการณ์" required className={editing ? '' : 'sm:col-span-2'}>
              <Input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="เช่น น้ำท่วมฉับพลันบริเวณลุ่มน้ำปิง"
              />
            </Field>
            <Field label="ประเภทภัยพิบัติ">
              <Select value={form.type} onValueChange={(v) => setField('type', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ระดับความรุนแรง">
              <Select value={form.severity} onValueChange={(v) => setField('severity', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="เลือกระดับความรุนแรง" /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="สถานะ">
              <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_STATUS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="พื้นที่ประสบภัย">
              <Input
                value={form.locationName}
                onChange={(e) => setField('locationName', e.target.value)}
                placeholder="เช่น อ.แม่ริม จ.เชียงใหม่"
              />
            </Field>
            <Field label="ผู้ประสบภัย (คน)">
              <Input type="number" min={0} value={form.affectedPeople} onChange={(e) => setField('affectedPeople', e.target.value)} />
            </Field>
            <Field label="บาดเจ็บ (คน)">
              <Input type="number" min={0} value={form.injured} onChange={(e) => setField('injured', e.target.value)} />
            </Field>
            <Field label="เสียชีวิต (ราย)">
              <Input type="number" min={0} value={form.deceased} onChange={(e) => setField('deceased', e.target.value)} />
            </Field>
            <Field label="วันที่เริ่มเหตุการณ์" required>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </Field>
            <Field label="วันที่สิ้นสุด (ถ้ามี)">
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
              />
            </Field>
            <Field label="รายละเอียดเหตุการณ์" className="sm:col-span-2">
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="ระบุรายละเอียด ลักษณะภัยพิบัติ พื้นที่ได้รับผลกระทบ และสถานการณ์โดยสรุป..."
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'บันทึกการแก้ไข' : 'บันทึกเหตุการณ์'}
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* ดูรายละเอียดเต็ม */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs text-slate-600">{detail.code}</Badge>
                  <StatusBadge options={SEVERITIES} value={detail.severity} />
                  <StatusBadge options={INCIDENT_STATUS} value={detail.status} />
                </div>
                <DialogTitle className="text-left text-lg">{detail.title}</DialogTitle>
                <DialogDescription className="text-left">
                  {optLabel(INCIDENT_TYPES, detail.type)} • บันทึกเมื่อ {fmtDate(detail.createdAt)}
                </DialogDescription>
              </DialogHeader>

              {detail.description && (
                <div className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                  {detail.description}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem icon={MapPin} label="พื้นที่ประสบภัย" value={detail.location?.name ?? detail.locationName ?? '-'} />
                <DetailItem
                  icon={MapPin}
                  label="พิกัด (Lat, Lng)"
                  value={detail.lat != null && detail.lng != null ? `${detail.lat}, ${detail.lng}` : '-'}
                />
                <DetailItem icon={CalendarDays} label="วันที่เริ่มเหตุการณ์" value={fmtDate(detail.startDate)} />
                <DetailItem icon={CalendarDays} label="วันที่สิ้นสุด" value={detail.endDate ? fmtDate(detail.endDate) : 'ยังไม่ปิดเหตุการณ์'} />
                <DetailItem icon={Users} label="ผู้ประสบภัย" value={`${fmtNum(detail.affectedPeople)} คน`} />
                <DetailItem icon={HeartPulse} label="บาดเจ็บ / เสียชีวิต" value={`${fmtNum(detail.injured)} / ${fmtNum(detail.deceased)} ราย`} />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">ข้อมูลที่เชื่อมโยงกับเหตุการณ์นี้</p>
                <div className="grid grid-cols-3 gap-3">
                  <CountChip icon={User} tone="text-violet-600" label="บุคคลที่เกี่ยวข้อง" value={detail._count?.persons ?? 0} />
                  <CountChip icon={FileText} tone="text-teal-600" label="รายงานสถานการณ์" value={detail._count?.reports ?? 0} />
                  <CountChip icon={HeartHandshake} tone="text-amber-600" label="คำขอความช่วยเหลือ" value={detail._count?.aidRequests ?? 0} />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="outline" onClick={() => setDetail(null)}>ปิด</Button>
                <Button onClick={() => { openEdit(detail); setDetail(null) }}>
                  <Pencil className="h-4 w-4" /> แก้ไขเหตุการณ์
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
