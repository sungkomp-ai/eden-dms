'use client'

// EDEN DMS — โมดูลบุคลากรและอาสาสมัคร (hrm)
import * as React from 'react'
import {
  Users, UserCheck, HardHat, HandHeart, Plus, Pencil, Trash2, Phone, Mail, MapPin, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { HR_TYPES, HR_STATUS, optLabel, Option } from '@/lib/constants'
import {
  useFetch, apiSend, ModuleHeader, StatCard, StatusBadge, SearchInput,
  RefreshButton, EmptyState, TableSkeleton, ErrorState, FormDialog, Field,
  useConfirmDelete,
} from './shared'

interface HumanResource {
  id: string
  name: string
  type: string
  jobTitle: string | null
  organizationId: string | null
  organization?: { name: string } | null
  phone: string | null
  email: string | null
  skills: string | null
  status: string
  baseLocation: string | null
  createdAt: string
}

interface OrganizationLite {
  id: string
  name: string
}

interface HrForm {
  name: string
  type: string
  jobTitle: string
  organizationId: string
  phone: string
  email: string
  skills: string
  status: string
  baseLocation: string
}

const EMPTY_FORM: HrForm = {
  name: '', type: 'staff', jobTitle: '', organizationId: 'none', phone: '',
  email: '', skills: '', status: 'available', baseLocation: '',
}

// วนสถานะ: available → assigned → on_mission → available
const NEXT_STATUS: Record<string, string> = {
  available: 'assigned',
  assigned: 'on_mission',
  on_mission: 'available',
  unavailable: 'available',
}

export default function HrModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<HumanResource[]>('/api/hr')
  const { data: orgData } = useFetch<OrganizationLite[]>('/api/organizations')
  const [q, setQ] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<HumanResource | null>(null)
  const [form, setForm] = React.useState<HrForm>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const confirmDelete = useConfirmDelete()

  const people = data ?? []
  const orgs = orgData ?? []

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase()
    return people.filter((p) => {
      const matchQ = !term
        || p.name.toLowerCase().includes(term)
        || (p.jobTitle ?? '').toLowerCase().includes(term)
        || (p.skills ?? '').toLowerCase().includes(term)
      const matchType = typeFilter === 'all' || p.type === typeFilter
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchQ && matchType && matchStatus
    })
  }, [people, q, typeFilter, statusFilter])

  const stats = React.useMemo(() => ({
    total: people.length,
    available: people.filter((p) => p.status === 'available').length,
    onMission: people.filter((p) => p.status === 'on_mission').length,
    volunteers: people.filter((p) => p.type === 'volunteer').length,
  }), [people])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (p: HumanResource) => {
    setEditing(p)
    setForm({
      name: p.name,
      type: p.type,
      jobTitle: p.jobTitle ?? '',
      organizationId: p.organizationId ?? 'none',
      phone: p.phone ?? '',
      email: p.email ?? '',
      skills: p.skills ?? '',
      status: p.status,
      baseLocation: p.baseLocation ?? '',
    })
    setDialogOpen(true)
  }

  const set = (key: keyof HrForm) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อ-นามสกุล', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        jobTitle: form.jobTitle.trim() || null,
        organizationId: form.organizationId === 'none' ? null : form.organizationId,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        skills: form.skills.trim() || null,
        baseLocation: form.baseLocation.trim() || null,
      }
      if (editing) {
        await apiSend(`/api/hr/${editing.id}`, 'PUT', payload)
        toast({ title: 'บันทึกสำเร็จ', description: `อัปเดตข้อมูล "${form.name}" แล้ว` })
      } else {
        await apiSend('/api/hr', 'POST', payload)
        toast({ title: 'เพิ่มสำเร็จ', description: `เพิ่มบุคลากร "${form.name}" แล้ว` })
      }
      setDialogOpen(false)
      refetch()
    } catch (e) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const quickStatus = async (p: HumanResource) => {
    const next = NEXT_STATUS[p.status] ?? 'available'
    setBusyId(p.id)
    try {
      await apiSend(`/api/hr/${p.id}`, 'PUT', { status: next })
      toast({ title: 'เปลี่ยนสถานะแล้ว', description: `${p.name} → ${optLabel(HR_STATUS, next)}` })
      refetch()
    } catch (e) {
      toast({
        title: 'เปลี่ยนสถานะไม่สำเร็จ',
        description: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const remove = (p: HumanResource) => {
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/hr/${p.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบบุคลากร "${p.name}" แล้ว` })
        refetch()
      } catch (e) {
        toast({
          title: 'ลบไม่สำเร็จ',
          description: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
          variant: 'destructive',
        })
      }
    }, `บุคลากร "${p.name}"`)
  }

  const skillsOf = (p: HumanResource): string[] =>
    (p.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="บุคลากรและอาสาสมัคร"
        description="จัดการเจ้าหน้าที่ อาสาสมัคร และผู้ฝึกอบรมด้านการรับมือภัยพิบัติ"
        actions={
          <>
            <RefreshButton onClick={refetch} loading={loading} />
            <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> เพิ่มบุคลากร
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="บุคลากรทั้งหมด" value={stats.total} icon={<Users />} tone="slate" />
        <StatCard title="พร้อมปฏิบัติงาน" value={stats.available} icon={<UserCheck />} tone="emerald" />
        <StatCard title="ปฏิบัติภารกิจ" value={stats.onMission} icon={<HardHat />} tone="orange" />
        <StatCard title="อาสาสมัคร" value={stats.volunteers} icon={<HandHeart />} tone="violet" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="ค้นหาชื่อ / ตำแหน่ง / ทักษะ..." />
        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-44" aria-label="กรองตามประเภทบุคลากร">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {HR_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" aria-label="กรองตามสถานะ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              {HR_STATUS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState message="ไม่พบบุคลากรที่ตรงกับเงื่อนไข" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-slate-600">ชื่อ</TableHead>
                  <TableHead className="text-slate-600">ประเภท</TableHead>
                  <TableHead className="text-slate-600">ตำแหน่ง</TableHead>
                  <TableHead className="text-slate-600">องค์กร</TableHead>
                  <TableHead className="text-slate-600">ทักษะ</TableHead>
                  <TableHead className="text-slate-600">สถานะ</TableHead>
                  <TableHead className="text-slate-600">พื้นที่ปฏิบัติงาน</TableHead>
                  <TableHead className="text-right text-slate-600">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-slate-500">
                        {p.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>
                        )}
                        {p.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge options={HR_TYPES} value={p.type} /></TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">{p.jobTitle || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">{p.organization?.name ?? '-'}</TableCell>
                    <TableCell>
                      {skillsOf(p).length > 0 ? (
                        <div className="flex max-w-52 flex-wrap gap-1">
                          {skillsOf(p).map((s) => (
                            <Badge key={s} variant="outline" className="bg-slate-100 text-[11px] font-normal text-slate-600 border-slate-200">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => quickStatus(p)}
                        disabled={busyId === p.id}
                        title="คลิกเพื่อเปลี่ยนสถานะถัดไป"
                        aria-label={`เปลี่ยนสถานะของ ${p.name}`}
                        className="cursor-pointer rounded-md transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                      >
                        <StatusBadge options={HR_STATUS} value={p.status} />
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {p.baseLocation ? (
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{p.baseLocation}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} aria-label={`แก้ไข ${p.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(p)} aria-label={`ลบ ${p.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'แก้ไขบุคลากร' : 'เพิ่มบุคลากร'}
        description={editing ? `แก้ไขข้อมูล "${editing.name}"` : 'กรอกข้อมูลบุคลากร / อาสาสมัครใหม่'}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อ-นามสกุล" required>
            <Input value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="เช่น สมชาย ใจดี" />
          </Field>
          <Field label="ประเภท">
            <Select value={form.type} onValueChange={set('type')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HR_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ตำแหน่ง / หน้าที่">
            <Input value={form.jobTitle} onChange={(e) => set('jobTitle')(e.target.value)} placeholder="เช่น พยาบาลฉุกเฉิน" />
          </Field>
          <Field label="สังกัดองค์กร">
            <Select value={form.organizationId} onValueChange={set('organizationId')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่สังกัด —</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="โทรศัพท์">
            <Input value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="เช่น 081-234-5678" />
          </Field>
          <Field label="อีเมล">
            <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="ทักษะ" className="sm:col-span-2">
            <Input value={form.skills} onChange={(e) => set('skills')(e.target.value)} placeholder="คั่นด้วยจุลภาค เช่น แพทย์,ปฐมพยาบาล" />
            {form.skills.trim() && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <Wrench className="h-3 w-3 text-slate-400" />
                {form.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                  <Badge key={s} variant="outline" className="bg-slate-100 text-[11px] font-normal text-slate-600 border-slate-200">{s}</Badge>
                ))}
              </div>
            )}
          </Field>
          <Field label="สถานะ">
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HR_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="พื้นที่ปฏิบัติงาน">
            <Input value={form.baseLocation} onChange={(e) => set('baseLocation')(e.target.value)} placeholder="เช่น ศูนย์อำนวยการจังหวัดนครราชสีมา" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มบุคลากร'}
          </Button>
        </div>
      </FormDialog>

      {confirmDelete.dialog}
    </div>
  )
}
