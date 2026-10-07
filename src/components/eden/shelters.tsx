'use client'

// EDEN DMS — โมดูลศูนย์พักพิง
import * as React from 'react'
import {
  Tent, DoorOpen, Users, BedDouble, Plus, Pencil, Trash2, Phone, User, MapPin, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { SHELTER_TYPES, SHELTER_STATUS, SHELTER_FACILITIES, optLabel, fmtNum } from '@/lib/constants'
import {
  useFetch, apiSend, ModuleHeader, StatCard, StatusBadge, SearchInput,
  RefreshButton, EmptyState, TableSkeleton, ErrorState, FormDialog, Field,
  useConfirmDelete,
} from './shared'

interface Shelter {
  id: string
  name: string
  type: string
  address: string | null
  capacity: number
  currentOccupancy: number
  contactPerson: string | null
  phone: string | null
  status: string
  facilities: string | null
  lat: number | null
  lng: number | null
  _count: { persons: number }
  createdAt: string
}

interface ShelterForm {
  name: string
  type: string
  address: string
  capacity: string
  currentOccupancy: string
  contactPerson: string
  phone: string
  status: string
  facilities: string
  lat: string
  lng: string
}

const EMPTY_FORM: ShelterForm = {
  name: '', type: 'school', address: '', capacity: '', currentOccupancy: '',
  contactPerson: '', phone: '', status: 'open', facilities: '', lat: '', lng: '',
}

function occupancyTone(rate: number) {
  if (rate >= 90) {
    return { bar: '[&_[data-slot=progress-indicator]]:bg-red-500', text: 'text-red-700', label: 'ใกล้เต็มความจุ' }
  }
  if (rate >= 70) {
    return { bar: '[&_[data-slot=progress-indicator]]:bg-amber-500', text: 'text-amber-700', label: 'กำลังรับเพิ่ม' }
  }
  return { bar: '[&_[data-slot=progress-indicator]]:bg-emerald-500', text: 'text-emerald-700', label: 'รับได้อีกมาก' }
}

export default function SheltersModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<Shelter[]>('/api/shelters')
  const [q, setQ] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Shelter | null>(null)
  const [form, setForm] = React.useState<ShelterForm>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const confirmDelete = useConfirmDelete()

  const shelters = data ?? []

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase()
    return shelters.filter((s) => {
      const matchQ = !term
        || s.name.toLowerCase().includes(term)
        || (s.address ?? '').toLowerCase().includes(term)
        || (s.contactPerson ?? '').toLowerCase().includes(term)
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      return matchQ && matchStatus
    })
  }, [shelters, q, statusFilter])

  const stats = React.useMemo(() => {
    const totalCapacity = shelters.reduce((sum, s) => sum + (s.capacity || 0), 0)
    const totalOccupancy = shelters.reduce((sum, s) => sum + (s.currentOccupancy || 0), 0)
    const openCount = shelters.filter((s) => s.status === 'open').length
    const overallRate = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0
    return { openCount, totalCapacity, totalOccupancy, overallRate }
  }, [shelters])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (s: Shelter) => {
    setEditing(s)
    setForm({
      name: s.name,
      type: s.type,
      address: s.address ?? '',
      capacity: String(s.capacity ?? ''),
      currentOccupancy: String(s.currentOccupancy ?? ''),
      contactPerson: s.contactPerson ?? '',
      phone: s.phone ?? '',
      status: s.status,
      facilities: s.facilities ?? '',
      lat: s.lat !== null ? String(s.lat) : '',
      lng: s.lng !== null ? String(s.lng) : '',
    })
    setDialogOpen(true)
  }

  const set = (key: keyof ShelterForm) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const toggleFacility = (value: string) => {
    setForm((f) => {
      const arr = f.facilities ? f.facilities.split(',').filter(Boolean) : []
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
      return { ...f, facilities: next.join(',') }
    })
  }

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อศูนย์พักพิง', variant: 'destructive' })
      return
    }
    if (form.capacity.trim() === '' || isNaN(Number(form.capacity))) {
      toast({ title: 'กรุณากรอกความจุ (จำนวนตัวเลข)', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        address: form.address.trim() || null,
        capacity: Number(form.capacity),
        currentOccupancy: form.currentOccupancy.trim() === '' || isNaN(Number(form.currentOccupancy))
          ? 0
          : Number(form.currentOccupancy),
        contactPerson: form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        facilities: form.facilities || null,
        lat: form.lat.trim() === '' || isNaN(Number(form.lat)) ? null : Number(form.lat),
        lng: form.lng.trim() === '' || isNaN(Number(form.lng)) ? null : Number(form.lng),
      }
      if (editing) {
        await apiSend(`/api/shelters/${editing.id}`, 'PUT', payload)
        toast({ title: 'บันทึกสำเร็จ', description: `อัปเดตศูนย์พักพิง "${form.name}" แล้ว` })
      } else {
        await apiSend('/api/shelters', 'POST', payload)
        toast({ title: 'เพิ่มสำเร็จ', description: `เพิ่มศูนย์พักพิง "${form.name}" แล้ว` })
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

  const remove = (s: Shelter) => {
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/shelters/${s.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบศูนย์พักพิง "${s.name}" แล้ว` })
        refetch()
      } catch (e) {
        toast({
          title: 'ลบไม่สำเร็จ',
          description: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
          variant: 'destructive',
        })
      }
    }, `ศูนย์พักพิง "${s.name}"`)
  }

  const facilitiesOf = (s: Shelter): string[] =>
    (s.facilities ?? '').split(',').map((f) => f.trim()).filter(Boolean)

  const overallTone = occupancyTone(stats.overallRate)

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="ศูนย์พักพิง"
        description="ติดตามความจุและจำนวนผู้พักพิงในแต่ละศูนย์"
        actions={
          <>
            <RefreshButton onClick={refetch} loading={loading} />
            <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> เพิ่มศูนย์พักพิง
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="ศูนย์พักพิงทั้งหมด" value={shelters.length} icon={<Tent />} tone="slate" />
        <StatCard title="เปิดรับ" value={stats.openCount} icon={<DoorOpen />} tone="emerald" />
        <StatCard title="ความจุรวม" value={fmtNum(stats.totalCapacity)} sub="คน" icon={<BedDouble />} tone="teal" />
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">ผู้พักพิงรวม</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{fmtNum(stats.totalOccupancy)}</p>
              <p className={cn('mt-0.5 text-xs font-medium', overallTone.text)}>
                อัตราเข้าพัก {stats.overallRate}%
              </p>
              <Progress
                value={stats.overallRate}
                aria-label="อัตราเข้าพักรวม"
                className={cn('mt-2 h-1.5 bg-slate-100', overallTone.bar)}
              />
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700 [&_svg]:h-5 [&_svg]:w-5">
              <Users />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="ค้นหาชื่อ / ที่อยู่ / ผู้ติดต่อ..." />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52" aria-label="กรองตามสถานะศูนย์พักพิง">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {SHELTER_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState message="ไม่พบศูนย์พักพิงที่ตรงกับเงื่อนไข" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const rate = s.capacity > 0 ? Math.min(100, Math.round((s.currentOccupancy / s.capacity) * 100)) : 0
            const tone = occupancyTone(rate)
            return (
              <div
                key={s.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">{s.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{optLabel(SHELTER_TYPES, s.type)}</p>
                  </div>
                  <StatusBadge options={SHELTER_STATUS} value={s.status} />
                </div>

                {s.address && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="line-clamp-2">{s.address}</span>
                  </p>
                )}

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">ผู้พักพิง</span>
                    <span className={cn('font-semibold', tone.text)}>
                      {fmtNum(s.currentOccupancy)} / {fmtNum(s.capacity)} คน
                    </span>
                  </div>
                  <Progress
                    value={rate}
                    aria-label={`อัตราการใช้ความจุของ ${s.name}`}
                    className={cn('mt-1.5 h-2 bg-slate-100', tone.bar)}
                  />
                  <p className={cn('mt-1 text-[11px]', tone.text)}>
                    {rate}% ของความจุ · {tone.label}
                  </p>
                </div>

                {facilitiesOf(s).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {facilitiesOf(s).map((f) => (
                      <Badge key={f} variant="outline" className="bg-slate-50 text-[11px] font-normal text-slate-600 border-slate-200">
                        <Sparkles className="mr-1 h-3 w-3" />{optLabel(SHELTER_FACILITIES, f)}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  {s.contactPerson && (
                    <p className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{s.contactPerson}</span>
                    </p>
                  )}
                  {s.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{s.phone}</span>
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">
                    ทะเบียนผู้พักพิง {s._count.persons} รายการ
                  </span>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label={`แก้ไข ${s.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(s)} aria-label={`ลบ ${s.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'แก้ไขศูนย์พักพิง' : 'เพิ่มศูนย์พักพิง'}
        description={editing ? `แก้ไขข้อมูล "${editing.name}"` : 'กรอกข้อมูลศูนย์พักพิงใหม่'}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อศูนย์พักพิง" required>
            <Input value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="เช่น ศูนย์พักพิงชั่วคราว วัดหลวงพ่อ" />
          </Field>
          <Field label="ประเภท">
            <Select value={form.type} onValueChange={set('type')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHELTER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ที่อยู่" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => set('address')(e.target.value)} placeholder="ที่ตั้งศูนย์พักพิง" />
          </Field>
          <Field label="ความจุ (คน)" required>
            <Input type="number" min={0} value={form.capacity} onChange={(e) => set('capacity')(e.target.value)} placeholder="เช่น 200" />
          </Field>
          <Field label="ผู้พักพิงปัจจุบัน (คน)">
            <Input type="number" min={0} value={form.currentOccupancy} onChange={(e) => set('currentOccupancy')(e.target.value)} placeholder="เช่น 85" />
          </Field>
          <Field label="ผู้ติดต่อ">
            <Input value={form.contactPerson} onChange={(e) => set('contactPerson')(e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </Field>
          <Field label="โทรศัพท์">
            <Input value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="เช่น 081-234-5678" />
          </Field>
          <Field label="สถานะ">
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHELTER_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="สิ่งอำนวยความสะดวก" className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
              {SHELTER_FACILITIES.map((f) => {
                const checked = form.facilities.split(',').filter(Boolean).includes(f.value)
                return (
                  <label
                    key={f.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleFacility(f.value)}
                      aria-label={f.label}
                    />
                    {f.label}
                  </label>
                )
              })}
            </div>
          </Field>
          <Field label="ละติจูด (Lat)">
            <Input type="number" step="any" value={form.lat} onChange={(e) => set('lat')(e.target.value)} placeholder="เช่น 14.9750" />
          </Field>
          <Field label="ลองจิจูด (Lng)">
            <Input type="number" step="any" value={form.lng} onChange={(e) => set('lng')(e.target.value)} placeholder="เช่น 102.0830" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มศูนย์พักพิง'}
          </Button>
        </div>
      </FormDialog>

      {confirmDelete.dialog}
    </div>
  )
}
