'use client'

// EDEN DMS — โมดูลทะเบียนองค์กร (org)
// เปิดดูแต่ละหน่วยงานได้ว่ามี บุคลากร (คน) + คลัง + สิ่งของ ในความรับผิดชอบอะไรบ้าง
import * as React from 'react'
import {
  Building2, Landmark, HandHeart, Globe2, Plus, Pencil, Trash2,
  Phone, Mail, Globe, User, BookOpen, Eye, Users, Warehouse, Boxes,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  ORG_TYPES, SECTORS, HR_TYPES, HR_STATUS, ITEM_CATEGORIES,
  Option, optLabel, fmtDate, fmtNum,
} from '@/lib/constants'
import {
  useFetch, apiSend, ModuleHeader, StatCard, StatusBadge, SearchInput,
  RefreshButton, EmptyState, TableSkeleton, ErrorState, FormDialog, Field,
  useConfirmDelete,
} from './shared'

interface Organization {
  id: string
  name: string
  type: string
  sector: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  status: string
  description: string | null
  _count: { resources: number; warehouses: number }
  createdAt: string
}

interface HrPerson {
  id: string
  name: string
  type: string
  jobTitle: string | null
  phone: string | null
  status: string
}

interface WhWithItems {
  id: string
  name: string
  purpose: string | null
  manager: string | null
  address: string | null
  items: {
    id: string
    name: string
    category: string
    type: string | null
    size: string | null
    unit: string
    quantity: number
    expiryDate: string | null
  }[]
}

interface OrgDetail extends Organization {
  resources: HrPerson[]
  warehouses: WhWithItems[]
}

interface OrgForm {
  name: string
  type: string
  sector: string
  contactPerson: string
  phone: string
  email: string
  address: string
  website: string
  status: string
  description: string
}

const ORG_STATUS: Option[] = [
  { value: 'active', label: 'ใช้งาน', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'inactive', label: 'ปิดใช้งาน', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

const EMPTY_FORM: OrgForm = {
  name: '', type: 'government', sector: 'none', contactPerson: '', phone: '',
  email: '', address: '', website: '', status: 'active', description: '',
}

export default function OrganizationsModule() {
  const { toast } = useToast()
  const { data, loading, error, refetch } = useFetch<Organization[]>('/api/organizations')
  const [q, setQ] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Organization | null>(null)
  const [form, setForm] = React.useState<OrgForm>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const confirmDelete = useConfirmDelete()

  // ===== มุมมองรายละเอียดองค์กร: คน + คลัง + สิ่งของ =====
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const detail = useFetch<OrgDetail>(detailId ? `/api/organizations/${detailId}` : null)
  // กันแสดงข้อมูลองค์กรเก่าขณะโหลดองค์กรใหม่
  const od = detail.data && detail.data.id === detailId ? detail.data : null
  const totalItems = od ? od.warehouses.reduce((s, w) => s + w.items.length, 0) : 0

  const orgs = data ?? []

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase()
    return orgs.filter((o) => {
      const matchQ = !term
        || o.name.toLowerCase().includes(term)
        || (o.contactPerson ?? '').toLowerCase().includes(term)
      const matchType = typeFilter === 'all' || o.type === typeFilter
      return matchQ && matchType
    })
  }, [orgs, q, typeFilter])

  const stats = React.useMemo(() => ({
    total: orgs.length,
    government: orgs.filter((o) => o.type === 'government').length,
    ngo: orgs.filter((o) => o.type === 'ngo').length,
    international: orgs.filter((o) => o.type === 'international').length,
  }), [orgs])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (o: Organization) => {
    setEditing(o)
    setForm({
      name: o.name,
      type: o.type,
      sector: o.sector ?? 'none',
      contactPerson: o.contactPerson ?? '',
      phone: o.phone ?? '',
      email: o.email ?? '',
      address: o.address ?? '',
      website: o.website ?? '',
      status: o.status,
      description: o.description ?? '',
    })
    setDialogOpen(true)
  }

  const set = (key: keyof OrgForm) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อองค์กร', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        sector: form.sector === 'none' ? null : form.sector,
        contactPerson: form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        website: form.website.trim() || null,
        description: form.description.trim() || null,
      }
      if (editing) {
        await apiSend(`/api/organizations/${editing.id}`, 'PUT', payload)
        toast({ title: 'บันทึกสำเร็จ', description: `อัปเดตข้อมูลองค์กร "${form.name}" แล้ว` })
      } else {
        await apiSend('/api/organizations', 'POST', payload)
        toast({ title: 'เพิ่มสำเร็จ', description: `เพิ่มองค์กร "${form.name}" แล้ว` })
      }
      setDialogOpen(false)
      refetch()
      if (detailId) detail.refetch()
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

  const remove = (o: Organization) => {
    confirmDelete.open(async () => {
      try {
        await apiSend(`/api/organizations/${o.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบองค์กร "${o.name}" แล้ว` })
        if (detailId === o.id) setDetailId(null)
        refetch()
      } catch (e) {
        toast({
          title: 'ลบไม่สำเร็จ',
          description: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
          variant: 'destructive',
        })
      }
    }, `องค์กร "${o.name}"`)
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="ทะเบียนองค์กร"
        description="ข้อมูลหน่วยงานราชการ องค์กรเอกชน และผู้ประสานงาน — เปิดดูบุคลากร คลัง และสิ่งของในความรับผิดชอบของแต่ละหน่วยงาน"
        actions={
          <>
            <RefreshButton onClick={refetch} loading={loading} />
            <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> เพิ่มองค์กร
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="องค์กรทั้งหมด" value={stats.total} icon={<Building2 />} tone="slate" />
        <StatCard title="หน่วยงานราชการ" value={stats.government} icon={<Landmark />} tone="teal" />
        <StatCard title="NGO / มูลนิธิ" value={stats.ngo} icon={<HandHeart />} tone="violet" />
        <StatCard title="องค์กรระหว่างประเทศ" value={stats.international} icon={<Globe2 />} tone="orange" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="ค้นหาชื่อองค์กร / ผู้ติดต่อ..." />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-56" aria-label="กรองตามประเภทองค์กร">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {ORG_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState message="ไม่พบองค์กรที่ตรงกับเงื่อนไข" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">{o.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge options={ORG_TYPES} value={o.type} />
                    {o.sector && (
                      <Badge variant="outline" className="whitespace-nowrap bg-slate-50 text-slate-600 border-slate-200">
                        <BookOpen className="mr-1 h-3 w-3" />{optLabel(SECTORS, o.sector)}
                      </Badge>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
                    o.status === 'active'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  )}
                >
                  {optLabel(ORG_STATUS, o.status)}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                {o.contactPerson && (
                  <p className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{o.contactPerson}</span>
                  </p>
                )}
                {o.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{o.phone}</span>
                  </p>
                )}
                {o.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{o.email}</span>
                  </p>
                )}
                {o.website && (
                  <p className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{o.website}</span>
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  บุคลากร {o._count.resources} คน · คลัง {o._count.warehouses} แห่ง
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setDetailId(o.id)}
                    aria-label={`ดูคนและสิ่งของของ ${o.name}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(o)} aria-label={`แก้ไข ${o.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(o)} aria-label={`ลบ ${o.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Dialog รายละเอียดองค์กร: คน + คลัง + สิ่งของ ===== */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
              <Building2 className="h-5 w-5 text-teal-700" />
              {od ? od.name : 'ข้อมูลหน่วยงาน'}
              {od && <StatusBadge options={ORG_TYPES} value={od.type} />}
            </DialogTitle>
            <DialogDescription className="text-left">
              {od
                ? <>ข้อมูลคน คลัง และสิ่งของทั้งหมดในความรับผิดชอบของหน่วยงาน{od.contactPerson ? ` · ผู้ติดต่อ: ${od.contactPerson}` : ''}{od.phone ? ` · ${od.phone}` : ''}</>
                : 'กำลังโหลดข้อมูลบุคลากร คลัง และสิ่งของของหน่วยงาน...'}
            </DialogDescription>
          </DialogHeader>

          {detail.loading ? (
            <div className="py-2">
              <TableSkeleton rows={4} />
            </div>
          ) : detail.error ? (
            <ErrorState message={detail.error} onRetry={detail.refetch} />
          ) : od ? (
            <>
              <div className="space-y-5">
                {/* ===== บุคลากรในสังกัด ===== */}
                <section aria-label="บุคลากรในสังกัด">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Users className="h-4 w-4 text-violet-600" />
                    บุคลากรในสังกัด ({od.resources.length} คน)
                  </h4>
                  {od.resources.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-400">ยังไม่มีบุคลากรในสังกัดหน่วยงานนี้</p>
                  ) : (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                      {od.resources.map((r) => (
                        <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {r.jobTitle ?? 'ไม่ระบุตำแหน่ง'}{r.phone ? ` · ${r.phone}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            <StatusBadge options={HR_TYPES} value={r.type} />
                            <StatusBadge options={HR_STATUS} value={r.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ===== คลังของหน่วยงาน ===== */}
                <section aria-label="คลังของหน่วยงาน">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Warehouse className="h-4 w-4 text-teal-600" />
                    คลังของหน่วยงาน ({od.warehouses.length} คลัง)
                  </h4>
                  {od.warehouses.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-400">หน่วยงานนี้ยังไม่มีคลังสิ่งของในความรับผิดชอบ</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {od.warehouses.map((w) => (
                        <div key={w.id} className="rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                          <p className="truncate text-sm font-semibold text-slate-800">{w.name}</p>
                          {w.purpose && <p className="mt-0.5 text-xs text-teal-700">{w.purpose}</p>}
                          <p className="mt-1 text-xs text-slate-500">
                            ผู้ดูแล: {w.manager ?? 'ไม่ระบุ'} · สิ่งของ {w.items.length} รายการ
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ===== สิ่งของในความรับผิดชอบ (รวมทุกคลัง) ===== */}
                <section aria-label="สิ่งของในความรับผิดชอบ">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Boxes className="h-4 w-4 text-amber-600" />
                    สิ่งของในความรับผิดชอบ ({totalItems} รายการ)
                  </h4>
                  {totalItems === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-400">ยังไม่มีสิ่งของในคลังของหน่วยงานนี้</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead>สิ่งของ</TableHead>
                              <TableHead>หมวด</TableHead>
                              <TableHead>ประเภท / ขนาด</TableHead>
                              <TableHead>ปริมาณ</TableHead>
                              <TableHead>คลัง</TableHead>
                              <TableHead>หมดอายุ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {od.warehouses.flatMap((w) =>
                              w.items.map((it) => (
                                <TableRow key={it.id}>
                                  <TableCell className="font-medium text-slate-800">{it.name}</TableCell>
                                  <TableCell><StatusBadge options={ITEM_CATEGORIES} value={it.category} /></TableCell>
                                  <TableCell className="text-xs text-slate-500">
                                    {it.type ?? '-'}{it.size ? ` · ${it.size}` : ''}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <span className="font-semibold text-slate-800">{fmtNum(it.quantity)}</span>{' '}
                                    <span className="text-xs text-slate-500">{it.unit}</span>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-600">{w.name}</TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{fmtDate(it.expiryDate)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className="flex justify-end pt-1">
                <Button variant="outline" onClick={() => setDetailId(null)}>ปิด</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'แก้ไของค์กร' : 'เพิ่มองค์กร'}
        description={editing ? `แก้ไขข้อมูลองค์กร "${editing.name}"` : 'กรอกข้อมูลองค์กรใหม่'}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อองค์กร" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="เช่น กรมป้องกันและบรรเทาสาธารณภัย" />
          </Field>
          <Field label="ประเภทองค์กร">
            <Select value={form.type} onValueChange={set('type')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ภาคส่วน">
            <Select value={form.sector} onValueChange={set('sector')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ผู้ติดต่อ">
            <Input value={form.contactPerson} onChange={(e) => set('contactPerson')(e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </Field>
          <Field label="โทรศัพท์">
            <Input value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="เช่น 02-123-4567" />
          </Field>
          <Field label="อีเมล">
            <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="name@org.go.th" />
          </Field>
          <Field label="เว็บไซต์">
            <Input value={form.website} onChange={(e) => set('website')(e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="ที่อยู่" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => set('address')(e.target.value)} placeholder="ที่ตั้งสำนักงาน" />
          </Field>
          <Field label="สถานะ">
            <Select value={form.status} onValueChange={set('status')}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORG_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="คำอธิบาย" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="บทบาทหน้าที่ขององค์กรในการรับมือภัยพิบัติ" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มองค์กร'}
          </Button>
        </div>
      </FormDialog>

      {confirmDelete.dialog}
    </div>
  )
}
