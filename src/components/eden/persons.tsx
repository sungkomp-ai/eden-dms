'use client'
// EDEN DMS — โมดูลทะเบียนบุคคล (Person Registry / pr)
// ผู้ประสบภัย บุคคลสูญหาย และการติดตาม
// P1: G3 — วันเกิด/ผู้ติดต่อฉุกเฉิน + ช่องทางติดต่อ (PersonContact) + presence trail (PersonEvent)
import * as React from 'react'
import {
  Users, UserX, HeartPulse, TentTree, CheckCircle, Plus, Pencil, Trash2, Eye, MapPin, Phone, Download,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  GENDERS, PERSON_STATUS, optLabel, optBadge, fmtDate, fmtDateTime,
  type Option,
} from '@/lib/constants'
import {
  useFetch, apiSend, ModuleHeader, StatCard, StatusBadge, SearchInput,
  RefreshButton, EmptyState, TableSkeleton, ErrorState, FormDialog, Field,
  useConfirmDelete,
} from './shared'

// ===== Types =====
interface Person {
  id: string
  firstName: string
  lastName: string
  nationalId?: string | null
  gender: string
  age?: number | null
  dateOfBirth?: string | null
  emergencyContact?: string | null
  phone?: string | null
  address?: string | null
  status: string
  lastSeenLocation?: string | null
  lastSeenAt?: string | null
  incidentId?: string | null
  incident?: { code: string; title: string } | null
  shelterId?: string | null
  shelter?: { name: string } | null
  notes?: string | null
  createdAt: string
}

interface PersonContact {
  id: string
  personId: string
  type: string
  value: string
  priority: number
  isEmergency: boolean
  note?: string | null
  createdAt: string
}

interface PersonEvent {
  id: string
  personId: string
  status: string
  note?: string | null
  location?: string | null
  observer?: string | null
  occurredAt: string
  createdBy?: string | null
  createdAt: string
}

interface IncidentLite { id: string; code: string; title: string; status: string }
interface ShelterLite { id: string; name: string; status: string }

interface PersonForm {
  firstName: string
  lastName: string
  nationalId: string
  gender: string
  age: string
  dateOfBirth: string // yyyy-mm-dd จาก input type=date
  emergencyContact: string
  phone: string
  address: string
  status: string
  lastSeenLocation: string
  lastSeenAt: string // datetime-local
  incidentId: string // 'none' = ไม่ระบุ
  shelterId: string  // 'none' = ไม่ระบุ
  notes: string
}

const EMPTY_FORM: PersonForm = {
  firstName: '', lastName: '', nationalId: '', gender: 'unknown', age: '', dateOfBirth: '',
  emergencyContact: '', phone: '', address: '', status: 'missing', lastSeenLocation: '',
  lastSeenAt: '', incidentId: 'none', shelterId: 'none', notes: '',
}

const TABS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'missing', label: 'สูญหาย' },
  { value: 'found', label: 'พบตัวแล้ว' },
  { value: 'safe', label: 'ปลอดภัย' },
  { value: 'injured', label: 'บาดเจ็บ' },
  { value: 'evacuated', label: 'อพยพแล้ว' },
]

const NONE = 'none'

// ===== Options ของ contact / event (คงไว้ในไฟล์โมดูล — lib/constants ไม่มี) =====
const CONTACT_TYPES: Option[] = [
  { value: 'phone', label: 'โทรศัพท์บ้าน', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'mobile', label: 'โทรศัพท์มือถือ', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'email', label: 'อีเมล', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'line', label: 'LINE', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'facebook', label: 'Facebook', badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  { value: 'other', label: 'อื่น ๆ', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

const EVENT_STATUSES: Option[] = [
  { value: 'missing', label: 'สูญหาย', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'sighted', label: 'พบเห็น', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'found', label: 'พบตัวแล้ว', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'safe', label: 'ปลอดภัย', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'injured', label: 'บาดเจ็บ', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'hospitalized', label: 'รักษาในโรงพยาบาล', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'deceased', label: 'เสียชีวิต', badge: 'bg-slate-200 text-slate-700 border-slate-300' },
  { value: 'evacuated', label: 'อพยพแล้ว', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'transferred', label: 'ส่งต่อ/ย้ายพื้นที่', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
]

/** ISO → ค่าที่ datetime-local รับ (เวลาท้องถิ่น) */
function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO → ค่าที่ input type=date รับ (yyyy-mm-dd) */
function toDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** แปลงฟอร์ม → payload (ค่าว่าง optional ไม่ส่ง, number แปลงเป็น Number) */
function buildPayload(f: PersonForm): Record<string, unknown> {
  const t = (s: string) => s.trim()
  const payload: Record<string, unknown> = {
    firstName: t(f.firstName),
    lastName: t(f.lastName),
    gender: f.gender,
    status: f.status,
  }
  if (t(f.nationalId)) payload.nationalId = t(f.nationalId)
  if (f.age !== '') payload.age = Number(f.age)
  if (f.dateOfBirth) payload.dateOfBirth = new Date(f.dateOfBirth).toISOString()
  if (t(f.emergencyContact)) payload.emergencyContact = t(f.emergencyContact)
  if (t(f.phone)) payload.phone = t(f.phone)
  if (t(f.address)) payload.address = t(f.address)
  if (t(f.lastSeenLocation)) payload.lastSeenLocation = t(f.lastSeenLocation)
  if (f.lastSeenAt) payload.lastSeenAt = new Date(f.lastSeenAt).toISOString()
  if (f.incidentId !== NONE) payload.incidentId = f.incidentId
  if (f.shelterId !== NONE) payload.shelterId = f.shelterId
  if (t(f.notes)) payload.notes = t(f.notes)
  return payload
}

/** scrollbar styling ตาม pattern ใน shell.tsx (ธีมสว่าง) */
const SCROLL = [
  'max-h-72 overflow-y-auto overscroll-contain',
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400',
  '[scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]',
].join(' ')

export default function PersonsModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<Person[]>('/api/persons')
  const { data: incidents } = useFetch<IncidentLite[]>('/api/incidents')
  const { data: shelters } = useFetch<ShelterLite[]>('/api/shelters')
  const confirmDelete = useConfirmDelete()

  const persons = data ?? []
  const [tab, setTab] = React.useState('all')
  const [q, setQ] = React.useState('')

  // dialog state (ฟอร์มสร้าง/แก้ไข)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Person | null>(null)
  const [form, setForm] = React.useState<PersonForm>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)

  // dialog รายละเอียด (contacts + events)
  const [detail, setDetail] = React.useState<Person | null>(null)
  const {
    data: contacts, loading: contactsLoading, refetch: refetchContacts,
  } = useFetch<PersonContact[]>(detail ? `/api/persons/${detail.id}/contacts` : null, [detail?.id])
  const {
    data: events, loading: eventsLoading, refetch: refetchEvents,
  } = useFetch<PersonEvent[]>(detail ? `/api/persons/${detail.id}/events` : null, [detail?.id])
  const [cForm, setCForm] = React.useState({ type: 'mobile', value: '', isEmergency: false })
  const [eForm, setEForm] = React.useState({ status: 'sighted', location: '', observer: '', note: '' })
  const [savingContact, setSavingContact] = React.useState(false)
  const [savingEvent, setSavingEvent] = React.useState(false)

  const set = (patch: Partial<PersonForm>) => setForm((f) => ({ ...f, ...patch }))

  /** person ที่แสดงใน dialog รายละเอียด — ดึงตัวล่าสุดจาก list เพื่อให้สถานะอัปเดตตาม event */
  const detailPerson = detail ? persons.find((p) => p.id === detail.id) ?? detail : null
  const contactList = contacts ?? []
  const eventList = events ?? []

  // ===== กรอง (client-side) =====
  const filtered = React.useMemo(() => {
    const kw = q.trim().toLowerCase()
    return persons.filter((p) => {
      if (tab !== 'all' && p.status !== tab) return false
      if (!kw) return true
      return [p.firstName, p.lastName, p.phone, p.lastSeenLocation]
        .some((v) => (v ?? '').toLowerCase().includes(kw))
    })
  }, [persons, tab, q])

  // ===== สถิติ =====
  const countBy = (s: string) => persons.filter((p) => p.status === s).length

  // ===== เปิดฟอร์ม =====
  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(p: Person) {
    setEditing(p)
    setForm({
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      nationalId: p.nationalId ?? '',
      gender: p.gender || 'unknown',
      age: p.age != null ? String(p.age) : '',
      dateOfBirth: toDateInput(p.dateOfBirth),
      emergencyContact: p.emergencyContact ?? '',
      phone: p.phone ?? '',
      address: p.address ?? '',
      status: p.status ?? 'missing',
      lastSeenLocation: p.lastSeenLocation ?? '',
      lastSeenAt: toLocalInput(p.lastSeenAt),
      incidentId: p.incidentId ?? NONE,
      shelterId: p.shelterId ?? NONE,
      notes: p.notes ?? '',
    })
    setOpen(true)
  }

  // ===== เปิด dialog รายละเอียด =====
  function openDetail(p: Person) {
    setDetail(p)
    setCForm({ type: 'mobile', value: '', isEmergency: false })
    setEForm({ status: 'sighted', location: '', observer: '', note: '' })
  }

  // ===== บันทึกฟอร์ม =====
  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) return
    setSaving(true)
    try {
      const payload = buildPayload(form)
      if (editing) {
        await apiSend(`/api/persons/${editing.id}`, 'PUT', payload)
        toast({ title: 'บันทึกการแก้ไขสำเร็จ', description: `${form.firstName} ${form.lastName}` })
      } else {
        await apiSend('/api/persons', 'POST', payload)
        toast({ title: 'ลงทะเบียนบุคคลสำเร็จ', description: `${form.firstName} ${form.lastName}` })
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกข้อมูลได้',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // ===== Quick action: พบตัวแล้ว =====
  async function markFound(p: Person) {
    try {
      await apiSend(`/api/persons/${p.id}`, 'PUT', { status: 'found' })
      toast({ title: 'อัปเดตสถานะเป็นพบตัวแล้ว', description: `${p.firstName} ${p.lastName}` })
      refetch()
    } catch (e) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: e instanceof Error ? e.message : 'ไม่สามารถอัปเดตสถานะได้',
        variant: 'destructive',
      })
    }
  }

  // ===== ลบบุคคล =====
  function askDelete(p: Person) {
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/persons/${p.id}`, 'DELETE')
        toast({ title: 'ลบข้อมูลสำเร็จ', description: `${p.firstName} ${p.lastName}` })
        refetch()
      } catch (e) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: e instanceof Error ? e.message : 'ไม่สามารถลบข้อมูลได้',
          variant: 'destructive',
        })
      }
    }, `บุคคล: ${p.firstName} ${p.lastName}`)
  }

  // ===== ช่องทางติดต่อ: เพิ่ม / ลบ (soft-delete) =====
  async function submitContact() {
    if (!detail || !cForm.value.trim()) return
    setSavingContact(true)
    try {
      await apiSend(`/api/persons/${detail.id}/contacts`, 'POST', {
        type: cForm.type,
        value: cForm.value.trim(),
        isEmergency: cForm.isEmergency,
      })
      toast({ title: 'เพิ่มช่องทางติดต่อสำเร็จ', description: cForm.value.trim() })
      setCForm((f) => ({ ...f, value: '', isEmergency: false }))
      refetchContacts()
    } catch (e) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: e instanceof Error ? e.message : 'ไม่สามารถเพิ่มช่องทางติดต่อได้',
        variant: 'destructive',
      })
    } finally {
      setSavingContact(false)
    }
  }

  function askDeleteContact(c: PersonContact) {
    if (!detail) return
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/persons/${detail.id}/contacts/${c.id}`, 'DELETE')
        toast({ title: 'ลบช่องทางติดต่อสำเร็จ', description: c.value })
        refetchContacts()
      } catch (e) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: e instanceof Error ? e.message : 'ไม่สามารถลบช่องทางติดต่อได้',
          variant: 'destructive',
        })
      }
    }, `ช่องทางติดต่อ: ${c.value}`)
  }

  // ===== เหตุการณ์การพบตัว: บันทึก (สถานะบุคคลอัปเดตอัตโนมัติฝั่ง API) =====
  async function submitEvent() {
    if (!detail) return
    setSavingEvent(true)
    try {
      await apiSend(`/api/persons/${detail.id}/events`, 'POST', {
        status: eForm.status,
        location: eForm.location.trim() || undefined,
        observer: eForm.observer.trim() || undefined,
        note: eForm.note.trim() || undefined,
      })
      toast({
        title: 'บันทึกเหตุการณ์การพบตัวสำเร็จ',
        description: 'สถานะของบุคคลอัปเดตตามเหตุการณ์แล้ว',
      })
      setEForm((f) => ({ ...f, location: '', observer: '', note: '' }))
      refetchEvents()
      refetch() // สถานะ person เปลี่ยนตาม event — รีเฟรช list ด้วย
    } catch (e) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกเหตุการณ์ได้',
        variant: 'destructive',
      })
    } finally {
      setSavingEvent(false)
    }
  }

  const emptyMsg = q.trim()
    ? 'ไม่พบบุคคลที่ตรงกับการค้นหา'
    : tab === 'all'
      ? 'ยังไม่มีข้อมูลบุคคล — กดปุ่ม "ลงทะเบียนบุคคล" เพื่อเพิ่มรายการ'
      : 'ไม่พบบุคคลในสถานะนี้'

  // ส่งออก CSV — ส่งคำค้นหาปัจจุบัน (?q=) ให้ API ด้วย (สถานะแท็บเป็นตัวกรองฝั่ง UI)
  const exportCsv = () => {
    toast({ title: 'กำลังส่งออกไฟล์ CSV...', description: 'ไฟล์รายงานทะเบียนบุคคลจะถูกดาวน์โหลด เปิดใน Excel ได้ทันที' })
    const params = new URLSearchParams({ format: 'csv' })
    if (q.trim()) params.set('q', q.trim())
    window.open(`/api/persons?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="ทะเบียนบุคคล"
        description="ผู้ประสบภัย บุคคลสูญหาย และการติดตาม"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> ส่งออก CSV
            </Button>
            <Button onClick={openCreate} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4" /> ลงทะเบียนบุคคล
            </Button>
          </>
        }
      />

      {/* สถิติ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ทั้งหมด" value={persons.length} sub="ผู้ประสบภัยในระบบ" icon={<Users />} tone="slate" />
        <StatCard title="สูญหาย" value={countBy('missing')} sub="รอการค้นหา" icon={<UserX />} tone="red" />
        <StatCard title="อพยพแล้ว" value={countBy('evacuated')} sub="ย้ายเข้าพื้นที่ปลอดภัย" icon={<TentTree />} tone="violet" />
        <StatCard title="บาดเจ็บ" value={countBy('injured')} sub="ต้องการการรักษา" icon={<HeartPulse />} tone="orange" />
      </div>

      <Card className="p-0">
        {/* แถบเครื่องมือ: Tabs + ค้นหา + รีเฟรช */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-full overflow-x-auto pb-1">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
                    {t.label}
                    <span className="ml-1 text-xs text-slate-500">
                      ({t.value === 'all' ? persons.length : countBy(t.value)})
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="ค้นหาชื่อ / โทรศัพท์ / พบล่าสุด..."
            />
            <RefreshButton onClick={() => refetch()} loading={loading} />
          </div>
        </div>

        {/* ตาราง */}
        <div className="overflow-x-auto">
          {error ? (
            <ErrorState message={error} onRetry={() => refetch()} />
          ) : loading ? (
            <TableSkeleton rows={6} />
          ) : filtered.length === 0 ? (
            <EmptyState message={emptyMsg} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>เพศ</TableHead>
                  <TableHead>อายุ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>โทรศัพท์</TableHead>
                  <TableHead>พบล่าสุด</TableHead>
                  <TableHead>เหตุการณ์</TableHead>
                  <TableHead>ศูนย์พักพิง</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {p.firstName} {p.lastName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{optLabel(GENDERS, p.gender)}</TableCell>
                    <TableCell>{p.age != null ? p.age : '-'}</TableCell>
                    <TableCell><StatusBadge options={PERSON_STATUS} value={p.status} /></TableCell>
                    <TableCell className="whitespace-nowrap">{p.phone || '-'}</TableCell>
                    <TableCell>
                      {p.lastSeenLocation ? (
                        <div className="whitespace-nowrap">
                          <p>{p.lastSeenLocation}</p>
                          {p.lastSeenAt && (
                            <p className="text-xs text-slate-400">
                              {new Date(p.lastSeenAt).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                timeZone: 'Asia/Bangkok',
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{p.incident?.code || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.shelter?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'missing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markFound(p)}
                            className="h-8 gap-1 border-emerald-300 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            aria-label={`บันทึกพบตัว ${p.firstName} ${p.lastName}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">พบตัวแล้ว</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openDetail(p)}
                          aria-label={`ดูรายละเอียด ${p.firstName} ${p.lastName}`}
                          className="h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEdit(p)}
                          aria-label={`แก้ไข ${p.firstName} ${p.lastName}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => askDelete(p)}
                          aria-label={`ลบ ${p.firstName} ${p.lastName}`}
                          className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* ฟอร์มสร้าง/แก้ไข */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'แก้ไขข้อมูลบุคคล' : 'ลงทะเบียนบุคคล'}
        description={editing ? 'ปรับปรุงข้อมูลผู้ประสบภัยในทะเบียน' : 'กรอกข้อมูลผู้ประสบภัยเพื่อบันทึกลงทะเบียน'}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ชื่อ" required>
            <Input value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} placeholder="ชื่อจริง" />
          </Field>
          <Field label="นามสกุล" required>
            <Input value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} placeholder="นามสกุล" />
          </Field>
          <Field label="เลขบัตรประชาชน">
            <Input value={form.nationalId} onChange={(e) => set({ nationalId: e.target.value })} placeholder="เช่น 1100200012345" />
          </Field>
          <Field label="เพศ">
            <Select value={form.gender} onValueChange={(v) => set({ gender: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกเพศ" /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="อายุ">
            <Input
              type="number"
              min={0}
              max={150}
              value={form.age}
              onChange={(e) => set({ age: e.target.value })}
              placeholder="ปี"
            />
          </Field>
          <Field label="วันเกิด">
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set({ dateOfBirth: e.target.value })}
              aria-label="วันเกิด"
            />
          </Field>
          <Field label="โทรศัพท์">
            <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="เช่น 0812345678" />
          </Field>
          <Field label="ผู้ติดต่อฉุกเฉิน">
            <Input
              value={form.emergencyContact}
              onChange={(e) => set({ emergencyContact: e.target.value })}
              placeholder="ชื่อ + ความสัมพันธ์ + เบอร์ เช่น สมชาย (สามี) 0819998888"
            />
          </Field>
          <Field label="สถานะ" required>
            <Select value={form.status} onValueChange={(v) => set({ status: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
              <SelectContent>
                {PERSON_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ตำแหน่งพบล่าสุด">
            <Input
              value={form.lastSeenLocation}
              onChange={(e) => set({ lastSeenLocation: e.target.value })}
              placeholder="เช่น ต.ในเมือง อ.เมือง จ.เชียงใหม่"
            />
          </Field>
          <Field label="วันเวลาพบล่าสุด">
            <Input
              type="datetime-local"
              value={form.lastSeenAt}
              onChange={(e) => set({ lastSeenAt: e.target.value })}
            />
          </Field>
          <Field label="เหตุการณ์ที่เกี่ยวข้อง">
            <Select value={form.incidentId} onValueChange={(v) => set({ incidentId: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกเหตุการณ์" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
                {(incidents ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.code} — {i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ศูนย์พักพิง">
            <Select value={form.shelterId} onValueChange={(v) => set({ shelterId: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกศูนย์พักพิง" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
                {(shelters ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ที่อยู่" className="sm:col-span-2">
            <Textarea
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder="ที่อยู่ปัจจุบัน / ภูมิลำเนา"
              rows={2}
            />
          </Field>
          <Field label="บันทึกเพิ่มเติม" className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="รายละเอียดอื่น ๆ เช่น ลักษณะเด่น อาการบาดเจ็บ เป็นต้น"
              rows={2}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
          <Button
            onClick={submit}
            disabled={saving || !form.firstName.trim() || !form.lastName.trim()}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'ลงทะเบียน'}
          </Button>
        </div>
      </FormDialog>

      {/* Dialog รายละเอียดบุคคล: ข้อมูล + ช่องทางติดต่อ + presence trail */}
      <Dialog open={!!detailPerson} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detailPerson && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span>{detailPerson.firstName} {detailPerson.lastName}</span>
                  <StatusBadge options={PERSON_STATUS} value={detailPerson.status} />
                </DialogTitle>
                <DialogDescription>
                  ข้อมูลรายละเอียด ช่องทางติดต่อ และประวัติการพบตัว (presence trail)
                </DialogDescription>
              </DialogHeader>

              {/* ข้อมูลพื้นฐาน */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">วันเกิด</p>
                  <p className="text-sm font-medium text-slate-800">{fmtDate(detailPerson.dateOfBirth)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">อายุ / เพศ</p>
                  <p className="text-sm font-medium text-slate-800">
                    {detailPerson.age != null ? `${detailPerson.age} ปี` : '-'} · {optLabel(GENDERS, detailPerson.gender)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">โทรศัพท์</p>
                  <p className="text-sm font-medium text-slate-800">{detailPerson.phone || '-'}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-slate-500">ผู้ติดต่อฉุกเฉิน</p>
                  <p className="text-sm font-medium text-slate-800">{detailPerson.emergencyContact || '-'}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-slate-500">พบล่าสุด</p>
                  <p className="truncate text-sm font-medium text-slate-800">
                    {detailPerson.lastSeenLocation || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">เหตุการณ์</p>
                  <p className="text-sm font-medium text-slate-800">{detailPerson.incident?.code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">ศูนย์พักพิง</p>
                  <p className="truncate text-sm font-medium text-slate-800">{detailPerson.shelter?.name || '-'}</p>
                </div>
              </div>

              {/* ===== ช่องทางติดต่อ ===== */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Phone className="h-4 w-4 text-teal-600" />
                  ช่องทางติดต่อ
                  <span className="font-normal text-slate-400">({contactList.length})</span>
                </h3>
                <div className={SCROLL}>
                  {contactsLoading ? (
                    <p className="py-3 text-center text-sm text-slate-400">กำลังโหลดช่องทางติดต่อ...</p>
                  ) : contactList.length === 0 ? (
                    <p className="py-3 text-center text-sm text-slate-400">ยังไม่มีช่องทางติดต่อ — เพิ่มรายการด้านล่าง</p>
                  ) : (
                    <ul className="space-y-2">
                      {contactList.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={optBadge(CONTACT_TYPES, c.type)}>
                                {optLabel(CONTACT_TYPES, c.type)}
                              </Badge>
                              <span className="truncate text-sm font-medium text-slate-800">{c.value}</span>
                              {c.priority === 1 && (
                                <Badge className="border-teal-600 bg-teal-600 text-white hover:bg-teal-600">หลัก</Badge>
                              )}
                              {c.isEmergency && (
                                <Badge className="border-red-600 bg-red-600 text-white hover:bg-red-600">ฉุกเฉิน</Badge>
                              )}
                            </div>
                            {c.note && <p className="mt-0.5 truncate text-xs text-slate-500">{c.note}</p>}
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => askDeleteContact(c)}
                            aria-label={`ลบช่องทางติดต่อ ${c.value}`}
                            className="h-8 w-8 shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* ฟอร์มเพิ่มช่องทางติดต่อ */}
                <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr]">
                    <Select value={cForm.type} onValueChange={(v) => setCForm((f) => ({ ...f, type: v }))}>
                      <SelectTrigger aria-label="ชนิดช่องทางติดต่อ"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={cForm.value}
                      onChange={(e) => setCForm((f) => ({ ...f, value: e.target.value }))}
                      placeholder="ค่าช่องทาง เช่น 081-234-5678 / email@example.com"
                      aria-label="ค่าช่องทางติดต่อ"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="contact-emergency"
                        checked={cForm.isEmergency}
                        onCheckedChange={(v) => setCForm((f) => ({ ...f, isEmergency: v }))}
                      />
                      <Label htmlFor="contact-emergency" className="cursor-pointer text-sm font-normal text-slate-700">
                        ใช้เป็นช่องทางฉุกเฉิน
                      </Label>
                    </div>
                    <Button
                      size="sm"
                      onClick={submitContact}
                      disabled={savingContact || !cForm.value.trim()}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <Plus className="h-4 w-4" /> เพิ่มช่องทางติดต่อ
                    </Button>
                  </div>
                </div>
              </section>

              {/* ===== Timeline การพบตัว (presence trail) ===== */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MapPin className="h-4 w-4 text-teal-600" />
                  ประวัติการพบตัว (presence trail)
                  <span className="font-normal text-slate-400">({eventList.length})</span>
                </h3>
                <div className={SCROLL}>
                  {eventsLoading ? (
                    <p className="py-3 text-center text-sm text-slate-400">กำลังโหลดประวัติการพบตัว...</p>
                  ) : eventList.length === 0 ? (
                    <p className="py-3 text-center text-sm text-slate-400">ยังไม่มีเหตุการณ์ — บันทึกเหตุการณ์แรกด้านล่าง</p>
                  ) : (
                    <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                      {eventList.map((ev) => (
                        <li key={ev.id} className="relative rounded-lg border border-slate-200 p-2.5">
                          <span className="absolute -left-[1.42rem] top-4 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-500" />
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={optBadge(EVENT_STATUSES, ev.status)}>
                              {optLabel(EVENT_STATUSES, ev.status)}
                            </Badge>
                            <span className="text-xs text-slate-500">{fmtDateTime(ev.occurredAt)}</span>
                          </div>
                          {ev.location && (
                            <p className="mt-1 flex items-center gap-1 text-sm text-slate-700">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {ev.location}
                            </p>
                          )}
                          {ev.observer && (
                            <p className="mt-0.5 text-xs text-slate-500">ผู้พบ/ผู้รายงาน: {ev.observer}</p>
                          )}
                          {ev.note && <p className="mt-1 text-sm text-slate-600">{ev.note}</p>}
                          {ev.createdBy && (
                            <p className="mt-1 text-xs text-slate-400">บันทึกโดย {ev.createdBy}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {/* ฟอร์มเพิ่มเหตุการณ์ — สถานะบุคคลจะอัปเดตตามอัตโนมัติ */}
                <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="สถานะเหตุการณ์" required>
                      <Select value={eForm.status} onValueChange={(v) => setEForm((f) => ({ ...f, status: v }))}>
                        <SelectTrigger aria-label="สถานะเหตุการณ์"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EVENT_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="สถานที่ที่พบ / เกิดเหตุ">
                      <Input
                        value={eForm.location}
                        onChange={(e) => setEForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="เช่น ปากซอย ต.ช้างเผือก อ.เมือง"
                      />
                    </Field>
                    <Field label="ผู้สังเกต / ผู้รายงาน">
                      <Input
                        value={eForm.observer}
                        onChange={(e) => setEForm((f) => ({ ...f, observer: e.target.value }))}
                        placeholder="เช่น อาสาสมัคร วอล.เชียงใหม่"
                      />
                    </Field>
                  </div>
                  <Field label="หมายเหตุ">
                    <Textarea
                      value={eForm.note}
                      onChange={(e) => setEForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="รายละเอียด เช่น สภาพร่างกาย ผู้พบ สิ่งที่ต้องทำต่อ"
                      rows={2}
                    />
                  </Field>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={submitEvent}
                      disabled={savingEvent}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      <Plus className="h-4 w-4" /> บันทึกเหตุการณ์
                    </Button>
                  </div>
                </div>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ยืนยันการลบ */}
      {confirmDelete.dialog}
    </div>
  )
}
