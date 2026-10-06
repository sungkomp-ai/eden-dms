'use client'
// EDEN DMS — โมดูลทะเบียนบุคคล (Person Registry / pr)
// ผู้ประสบภัย บุคคลสูญหาย และการติดตาม
import * as React from 'react'
import {
  Users, UserX, HeartPulse, TentTree, CheckCircle, Plus, Pencil, Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { GENDERS, PERSON_STATUS, optLabel } from '@/lib/constants'
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

interface IncidentLite { id: string; code: string; title: string; status: string }
interface ShelterLite { id: string; name: string; status: string }

interface PersonForm {
  firstName: string
  lastName: string
  nationalId: string
  gender: string
  age: string
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
  firstName: '', lastName: '', nationalId: '', gender: 'unknown', age: '', phone: '',
  address: '', status: 'missing', lastSeenLocation: '', lastSeenAt: '',
  incidentId: 'none', shelterId: 'none', notes: '',
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

/** ISO → ค่าที่ datetime-local รับ (เวลาท้องถิ่น) */
function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  if (t(f.phone)) payload.phone = t(f.phone)
  if (t(f.address)) payload.address = t(f.address)
  if (t(f.lastSeenLocation)) payload.lastSeenLocation = t(f.lastSeenLocation)
  if (f.lastSeenAt) payload.lastSeenAt = new Date(f.lastSeenAt).toISOString()
  if (f.incidentId !== NONE) payload.incidentId = f.incidentId
  if (f.shelterId !== NONE) payload.shelterId = f.shelterId
  if (t(f.notes)) payload.notes = t(f.notes)
  return payload
}

export default function PersonsModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<Person[]>('/api/persons')
  const { data: incidents } = useFetch<IncidentLite[]>('/api/incidents')
  const { data: shelters } = useFetch<ShelterLite[]>('/api/shelters')
  const confirmDelete = useConfirmDelete()

  const persons = data ?? []
  const [tab, setTab] = React.useState('all')
  const [q, setQ] = React.useState('')

  // dialog state
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Person | null>(null)
  const [form, setForm] = React.useState<PersonForm>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)

  const set = (patch: Partial<PersonForm>) => setForm((f) => ({ ...f, ...patch }))

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

  // ===== ลบ =====
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

  const emptyMsg = q.trim()
    ? 'ไม่พบบุคคลที่ตรงกับการค้นหา'
    : tab === 'all'
      ? 'ยังไม่มีข้อมูลบุคคล — กดปุ่ม "ลงทะเบียนบุคคล" เพื่อเพิ่มรายการ'
      : 'ไม่พบบุคคลในสถานะนี้'

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="ทะเบียนบุคคล"
        description="ผู้ประสบภัย บุคคลสูญหาย และการติดตาม"
        actions={
          <Button onClick={openCreate} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4" /> ลงทะเบียนบุคคล
          </Button>
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
          <Field label="โทรศัพท์">
            <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="เช่น 0812345678" />
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

      {/* ยืนยันการลบ */}
      {confirmDelete.dialog}
    </div>
  )
}
