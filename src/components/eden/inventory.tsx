'use client'
// EDEN DMS — โมดูลคลังสิ่งของและเวชภัณฑ์ (inventory) — รองรับเครื่องมือ/เวชภัณฑ์/อาหาร/เชื้อเพลิง/สิ่งของบรรเทาทุกข์
// ทุกคลังมีหน่วยงานเจ้าของ (Organization) เชื่อมโยงกันทั้งระบบ
import * as React from 'react'
import {
  Boxes, PackagePlus, PackageMinus, Minus, Plus, Pencil, Trash2, Warehouse,
  TriangleAlert, PackageSearch, PackageCheck, Building2, Phone, PlusCircle,
  ArrowLeftRight, ArrowRight, SlidersHorizontal, History,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { ITEM_CATEGORIES, fmtNum, fmtDate, fmtDateTime } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  apiSend, useFetch, ModuleHeader, StatCard, StatusBadge, SearchInput,
  EmptyState, TableSkeleton, ErrorState, FormDialog, Field, useConfirmDelete,
  RefreshButton,
} from './shared'

interface InvItem {
  id: string
  name: string
  category: string
  type?: string | null
  size?: string | null
  unit: string
  quantity: number
  minQuantity: number
  warehouseId?: string | null
  warehouse?: {
    id?: string
    name: string
    organization?: { id: string; name: string } | null
  } | null
  expiryDate?: string | null
  createdAt: string
}

interface Warehouse {
  id: string
  name: string
  purpose?: string | null
  address?: string | null
  manager?: string | null
  phone?: string | null
  capacity: number
  organizationId?: string | null
  organization?: { id: string; name: string; type: string | null } | null
  _count: { items: number }
}

const emptyItemForm = { name: '', category: 'food', type: '', size: '', unit: 'ชิ้น', quantity: '0', minQuantity: '0', warehouseId: '', expiryDate: '' }
const emptyWarehouseForm = { name: '', purpose: '', organizationId: '', manager: '', phone: '', capacity: '0', address: '' }

// ===== P1 (G4) — movement ledger: ประเภทรายการเคลื่อนไหวสต๊อก =====
type MovementType = 'receive' | 'issue' | 'transfer' | 'adjust'

const MOVEMENT_TYPES: { value: MovementType; label: string; badge: string }[] = [
  { value: 'receive', label: 'รับเข้า', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'issue', label: 'เบิกจ่าย', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'transfer', label: 'โอนย้าย', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'adjust', label: 'ปรับยอด', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
]

interface StockMovementRow {
  id: string
  type: string
  quantity: number
  reference: string | null
  note: string | null
  createdBy: string | null
  createdAt: string
  item: { name: string; unit: string }
  fromWarehouse: { name: string } | null
  toWarehouse: { name: string } | null
}

export default function InventoryModule() {
  const { toast } = useToast()
  const confirm = useConfirmDelete()
  const [q, setQ] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<InvItem | null>(null)
  const [form, setForm] = React.useState(emptyItemForm)
  const [saving, setSaving] = React.useState(false)
  const [adjusting, setAdjusting] = React.useState<string | null>(null)

  // ===== P1 (G4): เคลื่อนไหวสต๊อก (movement ledger) =====
  const [mvItem, setMvItem] = React.useState<InvItem | null>(null)
  const [mvType, setMvType] = React.useState<MovementType>('receive')
  const [mvQty, setMvQty] = React.useState('')
  const [mvWarehouseId, setMvWarehouseId] = React.useState('')
  const [mvRef, setMvRef] = React.useState('')
  const [mvNote, setMvNote] = React.useState('')
  const [mvSaving, setMvSaving] = React.useState(false)

  // ===== คลัง: ฟอร์มเพิ่ม/แก้ไขคลัง + หน่วยงานเจ้าของ =====
  const [whDialogOpen, setWhDialogOpen] = React.useState(false)
  const [editingWh, setEditingWh] = React.useState<Warehouse | null>(null)
  const [whForm, setWhForm] = React.useState(emptyWarehouseForm)
  const [savingWh, setSavingWh] = React.useState(false)

  const items = useFetch<InvItem[]>('/api/inventory')
  const warehouses = useFetch<Warehouse[]>('/api/warehouses')
  const orgs = useFetch<{ id: string; name: string; type: string }[]>('/api/organizations')
  const movements = useFetch<StockMovementRow[]>('/api/inventory/movements')

  const recentMovements = React.useMemo(
    () => (movements.data ?? []).slice(0, 50),
    [movements.data],
  )

  const filtered = React.useMemo(() => {
    const list = items.data ?? []
    const kw = q.trim().toLowerCase()
    return list.filter((it) => {
      if (category !== 'all' && it.category !== category) return false
      if (kw) {
        // ค้นหาจาก ชื่อ + ประเภท + ขนาด + คลัง + หน่วยงานเจ้าของ + หมวดสินค้า
        const catLabel = ITEM_CATEGORIES.find((c) => c.value === it.category)?.label ?? ''
        const hay = [
          it.name, it.type, it.size, it.warehouse?.name, it.warehouse?.organization?.name, catLabel,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [items.data, q, category])

  const stats = React.useMemo(() => {
    const list = items.data ?? []
    const lowStock = list.filter((it) => it.quantity <= it.minQuantity)
    return {
      total: list.length,
      quantity: list.reduce((s, it) => s + (it.quantity || 0), 0),
      low: lowStock.length,
      warehouses: warehouses.data?.length ?? 0,
    }
  }, [items.data, warehouses.data])

  // ===== สินค้า: เพิ่ม/แก้ไข =====
  const openCreate = () => {
    setEditing(null)
    setForm(emptyItemForm)
    setDialogOpen(true)
  }

  const openEdit = (it: InvItem) => {
    setEditing(it)
    setForm({
      name: it.name,
      category: it.category,
      type: it.type ?? '',
      size: it.size ?? '',
      unit: it.unit || 'ชิ้น',
      quantity: String(it.quantity ?? 0),
      minQuantity: String(it.minQuantity ?? 0),
      warehouseId: it.warehouseId ?? '',
      expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString().slice(0, 10) : '',
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อสินค้า', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        type: form.type.trim() || null,
        size: form.size.trim() || null,
        unit: form.unit.trim() || 'ชิ้น',
        quantity: Number(form.quantity) || 0,
        minQuantity: Number(form.minQuantity) || 0,
        warehouseId: form.warehouseId || null,
        expiryDate: form.expiryDate ? new Date(`${form.expiryDate}T00:00:00`).toISOString() : null,
      }
      if (editing) {
        await apiSend(`/api/inventory/${editing.id}`, 'PUT', body)
        toast({ title: 'บันทึกสำเร็จ', description: `แก้ไขรายการ "${body.name}" เรียบร้อยแล้ว` })
      } else {
        await apiSend('/api/inventory', 'POST', body)
        toast({ title: 'เพิ่มรายการสำเร็จ', description: `เพิ่ม "${body.name}" เข้าคลังเรียบร้อยแล้ว` })
      }
      setDialogOpen(false)
      items.refetch()
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const adjustQty = async (it: InvItem, delta: number) => {
    const next = Math.max(0, (it.quantity || 0) + delta)
    setAdjusting(it.id)
    try {
      await apiSend(`/api/inventory/${it.id}`, 'PUT', { quantity: next })
      toast({ title: 'ปรับปริมาณแล้ว', description: `${it.name}: ${fmtNum(it.quantity)} → ${fmtNum(next)} ${it.unit}` })
      items.refetch()
    } catch (e) {
      toast({ title: 'ปรับปริมาณไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setAdjusting(null)
    }
  }

  const remove = (it: InvItem) => {
    confirm.open(async () => {
      try {
        await apiSend(`/api/inventory/${it.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบ "${it.name}" ออกจากคลังแล้ว` })
        items.refetch()
      } catch (e) {
        toast({ title: 'ลบไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      }
    }, `สินค้า "${it.name}"`)
  }

  // ===== คลัง: เพิ่ม/แก้ไข/ลบ =====
  const openCreateWh = () => {
    setEditingWh(null)
    setWhForm(emptyWarehouseForm)
    setWhDialogOpen(true)
  }

  const openEditWh = (w: Warehouse) => {
    setEditingWh(w)
    setWhForm({
      name: w.name,
      purpose: w.purpose ?? '',
      organizationId: w.organizationId ?? w.organization?.id ?? '',
      manager: w.manager ?? '',
      phone: w.phone ?? '',
      capacity: String(w.capacity ?? 0),
      address: w.address ?? '',
    })
    setWhDialogOpen(true)
  }

  const submitWh = async () => {
    if (!whForm.name.trim()) {
      toast({ title: 'กรุณากรอกชื่อคลัง', variant: 'destructive' })
      return
    }
    setSavingWh(true)
    try {
      const body: Record<string, unknown> = {
        name: whForm.name.trim(),
        purpose: whForm.purpose.trim() || null,
        organizationId: whForm.organizationId || null,
        manager: whForm.manager.trim() || null,
        phone: whForm.phone.trim() || null,
        capacity: Number(whForm.capacity) || 0,
        address: whForm.address.trim() || null,
      }
      if (editingWh) {
        await apiSend(`/api/warehouses/${editingWh.id}`, 'PUT', body)
        toast({ title: 'บันทึกสำเร็จ', description: `แก้ไขคลัง "${body.name}" เรียบร้อยแล้ว` })
      } else {
        await apiSend('/api/warehouses', 'POST', body)
        toast({ title: 'เพิ่มคลังสำเร็จ', description: `เพิ่ม "${body.name}" เรียบร้อยแล้ว` })
      }
      setWhDialogOpen(false)
      warehouses.refetch()
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSavingWh(false)
    }
  }

  const removeWh = (w: Warehouse) => {
    confirm.open(async () => {
      try {
        await apiSend(`/api/warehouses/${w.id}`, 'DELETE')
        toast({ title: 'ลบคลังสำเร็จ', description: `ลบ "${w.name}" แล้ว (สินค้าในคลังจะกลายเป็นไม่ระบุคลัง)`, })
        warehouses.refetch()
        items.refetch()
      } catch (e) {
        toast({ title: 'ลบไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      }
    }, `คลัง "${w.name}"`)
  }

  // ===== P1 (G4): handlers เคลื่อนไหวสต๊อก =====
  const openMovement = (it: InvItem, type: MovementType) => {
    setMvItem(it)
    setMvType(type)
    setMvQty('')
    setMvWarehouseId('')
    setMvRef('')
    setMvNote('')
  }

  const mvTypeMeta = MOVEMENT_TYPES.find((t) => t.value === mvType)
  const mvQtyNum = Number(mvQty)
  const mvQtyValid =
    mvQty.trim() !== '' && Number.isFinite(mvQtyNum) && Number.isInteger(mvQtyNum)
    && (mvType === 'adjust' ? mvQtyNum !== 0 : mvQtyNum > 0)

  const mvPreview = React.useMemo(() => {
    if (!mvItem || !mvQtyValid) return null
    if (mvType === 'issue') return mvItem.quantity - mvQtyNum
    if (mvType === 'transfer') return mvItem.quantity
    return mvItem.quantity + mvQtyNum // receive / adjust
  }, [mvItem, mvType, mvQtyNum, mvQtyValid])

  const submitMovement = async () => {
    if (!mvItem) return
    const item = mvItem
    if (!mvQtyValid) {
      toast({
        title: mvType === 'adjust'
          ? 'กรุณากรอกจำนวนปรับยอด (จำนวนเต็ม ไม่ใช่ 0 — ติดลบเพื่อลดยอด)'
          : 'กรุณากรอกจำนวน (จำนวนเต็มมากกว่า 0)',
        variant: 'destructive',
      })
      return
    }
    if (mvType === 'transfer' && !mvWarehouseId) {
      toast({ title: 'กรุณาเลือกคลังปลายทาง', variant: 'destructive' })
      return
    }
    setMvSaving(true)
    try {
      const res = await apiSend('/api/inventory/movements', 'POST', {
        itemId: item.id,
        type: mvType,
        quantity: mvQtyNum,
        ...(mvType === 'transfer' ? { toWarehouseId: mvWarehouseId } : {}),
        ...(mvRef.trim() ? { reference: mvRef.trim() } : {}),
        ...(mvNote.trim() ? { note: mvNote.trim() } : {}),
      }) as { movement: StockMovementRow; quantity: number; lowStockAlert?: boolean }
      toast({
        title: `บันทึก${mvTypeMeta?.label ?? 'เคลื่อนไหวสต๊อก'}สำเร็จ`,
        description: `${item.name}: คงเหลือ ${fmtNum(res.quantity)} ${item.unit} หลังรายการ`,
      })
      if (res.lowStockAlert) {
        toast({
          title: '⚠️ สต๊อกต่ำกว่า/เท่าจุดขั้นต่ำ',
          description: 'สร้างฉบับร่างแจ้งเตือนแล้ว — ตรวจสอบและส่งได้ในโมดูลแจ้งเตือน',
        })
      }
      setMvItem(null)
      items.refetch()
      movements.refetch()
    } catch (e) {
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด',
        variant: 'destructive',
      })
    } finally {
      setMvSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="คลังสิ่งของและเวชภัณฑ์"
        description="จัดการเครื่องมือ เวชภัณฑ์ อาหาร เชื้อเพลิง และสิ่งของบรรเทาทุกข์ — แยกตามหมวดหมู่ ประเภท ขนาด วันหมดอายุ และหน่วยงานเจ้าของคลัง"
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="ค้นหาสินค้า หมวด คลัง หรือหน่วยงาน..." />
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PackagePlus className="h-4 w-4" /> เพิ่มรายการสิ่งของ
            </Button>
          </>
        }
      />

      {/* สถิติภาพรวม */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="รายการทั้งหมด" value={fmtNum(stats.total)} icon={<PackageSearch />} tone="slate" />
        <StatCard title="ปริมาณรวมในคลัง" value={fmtNum(stats.quantity)} sub="หน่วยรวมทุกรายการ" icon={<PackageCheck />} tone="emerald" />
        <StatCard title="สต๊อกต่ำ" value={fmtNum(stats.low)} sub="ต้องการเติมสต๊อก" icon={<TriangleAlert />} tone="red" />
        <StatCard title="คลังทั้งหมด" value={fmtNum(stats.warehouses)} sub="มีหน่วยงานเจ้าของทุกคลัง" icon={<Warehouse />} tone="teal" />
      </div>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items" className="gap-1.5"><Boxes className="h-4 w-4" /> รายการสิ่งของ</TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1.5"><Warehouse className="h-4 w-4" /> คลังทั้งหมด</TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5"><History className="h-4 w-4" /> ประวัติการเคลื่อนไหว</TabsTrigger>
        </TabsList>

        {/* ===== Tab: สินค้า ===== */}
        <TabsContent value="items">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                พบ <span className="font-semibold text-slate-700">{filtered.length}</span> รายการ
              </p>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full sm:w-52" aria-label="กรองตามหมวดสินค้า">
                  <SelectValue placeholder="ทุกหมวด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดสินค้า</SelectItem>
                  {ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {items.error ? (
              <ErrorState message={items.error} onRetry={items.refetch} />
            ) : items.loading ? (
              <TableSkeleton rows={6} />
            ) : filtered.length === 0 ? (
              <EmptyState message="ไม่พบรายการสินค้า" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>ชื่อสิ่งของ</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead>ประเภท / ขนาด</TableHead>
                      <TableHead>ปริมาณ</TableHead>
                      <TableHead>จุดต่ำ</TableHead>
                      <TableHead>คลัง / หน่วยงานเจ้าของ</TableHead>
                      <TableHead>หมดอายุ</TableHead>
                      <TableHead className="text-right">ปรับสต๊อก / จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((it) => {
                      const low = it.quantity <= it.minQuantity
                      return (
                        <TableRow key={it.id} className={low ? 'bg-red-50/40' : undefined}>
                          <TableCell className="font-medium text-slate-800">{it.name}</TableCell>
                          <TableCell><StatusBadge options={ITEM_CATEGORIES} value={it.category} /></TableCell>
                          <TableCell>
                            {it.type || it.size ? (
                              <div className="leading-tight">
                                <p className="text-slate-700">{it.type ?? '-'}</p>
                                <p className="text-xs text-slate-400">{it.size ?? '-'}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={low ? 'font-bold text-red-600' : 'font-semibold text-slate-800'}>
                              {fmtNum(it.quantity)}
                            </span>{' '}
                            <span className="text-xs text-slate-500">{it.unit}</span>
                            {low && <Badge className="ml-2 bg-red-100 text-red-800 border-red-200">ต้องเติม</Badge>}
                          </TableCell>
                          <TableCell className="text-slate-500">{fmtNum(it.minQuantity)}</TableCell>
                          <TableCell>
                            {it.warehouse ? (
                              <div className="leading-tight">
                                <p className="text-slate-700">{it.warehouse.name}</p>
                                {it.warehouse.organization ? (
                                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    {it.warehouse.organization.name}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-300">ไม่ระบุหน่วยงาน</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500">{fmtDate(it.expiryDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline" size="icon" aria-label={`ลดปริมาณ ${it.name}`}
                                disabled={adjusting === it.id || it.quantity <= 0}
                                onClick={() => adjustQty(it, -10)}
                                className="h-7 w-7"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline" size="icon" aria-label={`เพิ่มปริมาณ ${it.name}`}
                                disabled={adjusting === it.id}
                                onClick={() => adjustQty(it, 10)}
                                className="h-7 w-7"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-7 gap-1 px-2 text-xs"
                                    aria-label={`เคลื่อนไหวสต๊อกของ ${it.name}`}
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5" /> เคลื่อนไหว
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  {MOVEMENT_TYPES.map((t) => (
                                    <DropdownMenuItem key={t.value} onClick={() => openMovement(it, t.value)} className="gap-2">
                                      {t.value === 'receive' && <PackagePlus className="h-4 w-4 text-emerald-600" />}
                                      {t.value === 'issue' && <PackageMinus className="h-4 w-4 text-orange-600" />}
                                      {t.value === 'transfer' && <ArrowLeftRight className="h-4 w-4 text-slate-500" />}
                                      {t.value === 'adjust' && <SlidersHorizontal className="h-4 w-4 text-amber-600" />}
                                      {t.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button variant="ghost" size="icon" aria-label={`แก้ไข ${it.name}`} onClick={() => openEdit(it)} className="h-7 w-7 text-slate-500 hover:text-slate-800">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label={`ลบ ${it.name}`} onClick={() => remove(it)} className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== Tab: คลังทั้งหมด (พร้อมหน่วยงานเจ้าของ) ===== */}
        <TabsContent value="warehouses">
          {warehouses.error ? (
            <ErrorState message={warehouses.error} onRetry={warehouses.refetch} />
          ) : warehouses.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <TableSkeleton key={i} rows={2} />)}
            </div>
          ) : !warehouses.data?.length ? (
            <EmptyState message="ยังไม่มีข้อมูลคลัง" />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={openCreateWh} variant="outline" className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50">
                  <PlusCircle className="h-4 w-4" /> เพิ่มคลังใหม่
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {warehouses.data.map((w) => (
                  <Card key={w.id} className="flex flex-col border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                          <Warehouse className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base leading-snug text-slate-800">{w.name}</CardTitle>
                          {w.purpose && (
                            <Badge className="mt-1 bg-teal-50 text-teal-700 border-teal-200 font-medium">
                              {w.purpose}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-2 p-4 pt-2">
                      {/* หน่วยงานเจ้าของคลัง */}
                      <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">หน่วยงานเจ้าของ</p>
                          {w.organization ? (
                            <p className="truncate text-sm font-medium text-slate-700">{w.organization.name}</p>
                          ) : (
                            <p className="text-sm text-slate-400">ไม่ระบุ</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <p>ผู้ดูแล: {w.manager ?? 'ไม่ระบุ'}</p>
                        {w.phone && (
                          <p className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone className="h-3 w-3" /> {w.phone}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">ความจุคลัง: {fmtNum(w.capacity)} หน่วย</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2">
                        <span className="text-sm text-teal-800">รายการสิ่งของในคลัง</span>
                        <span className="text-lg font-bold text-teal-700">{fmtNum(w._count.items)}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEditWh(w)} className="h-8 gap-1.5">
                          <Pencil className="h-3.5 w-3.5" /> แก้ไข
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeWh(w)} className="h-8 gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" /> ลบ
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: ประวัติการเคลื่อนไหวสต๊อก (P1: G4 movement ledger) ===== */}
        <TabsContent value="movements">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                รายการล่าสุด <span className="font-semibold text-slate-700">{recentMovements.length}</span> รายการ
                (จากทั้งหมด {fmtNum(movements.data?.length ?? 0)} รายการ)
              </p>
              <RefreshButton onClick={movements.refetch} loading={movements.loading} />
            </div>
            {movements.error ? (
              <ErrorState message={movements.error} onRetry={movements.refetch} />
            ) : movements.loading && !movements.data ? (
              <TableSkeleton rows={5} />
            ) : recentMovements.length === 0 ? (
              <EmptyState message="ยังไม่มีประวัติการเคลื่อนไหวสต๊อก" />
            ) : (
              <div className="max-h-72 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>เวลา</TableHead>
                      <TableHead>ชนิด</TableHead>
                      <TableHead>สินค้า</TableHead>
                      <TableHead>จำนวน</TableHead>
                      <TableHead>จาก → ถึง</TableHead>
                      <TableHead>อ้างอิง</TableHead>
                      <TableHead>โดย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMovements.map((m) => {
                      const meta = MOVEMENT_TYPES.find((t) => t.value === m.type)
                      const sign = m.type === 'receive'
                        ? '+'
                        : m.type === 'issue'
                          ? '-'
                          : m.type === 'adjust' && m.quantity > 0 ? '+' : ''
                      const qtyColor = m.type === 'receive'
                        ? 'text-emerald-700'
                        : m.type === 'issue'
                          ? 'text-orange-700'
                          : m.type === 'adjust'
                            ? (m.quantity > 0 ? 'text-emerald-700' : 'text-red-700')
                            : 'text-slate-700'
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(m.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('whitespace-nowrap', meta?.badge ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                              {meta?.label ?? m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{m.item?.name ?? '-'}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className={cn('font-semibold', qtyColor)}>
                              {sign}{fmtNum(m.quantity)}
                            </span>{' '}
                            <span className="text-xs text-slate-500">{m.item?.unit ?? ''}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-slate-600">
                            {m.fromWarehouse?.name ?? '—'} <ArrowRight className="inline h-3 w-3 text-slate-400" /> {m.toWarehouse?.name ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-40 truncate text-slate-500" title={m.reference ?? undefined}>
                            {m.reference ?? '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-slate-500">{m.createdBy ?? '-'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== ฟอร์มเพิ่ม/แก้ไขสินค้า ===== */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'แก้ไขรายการสิ่งของ' : 'เพิ่มรายการสิ่งของ'}
        description={editing ? `แก้ไขข้อมูล "${editing.name}"` : 'กรอกข้อมูลสิ่งของเข้าคลัง (หมวดหมู่ ประเภท ขนาด จำนวน และวันหมดอายุ)'}
      >
        <div className="grid gap-4">
          <Field label="ชื่อสิ่งของ" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น แก๊ส LPG บรรจุกระบอก" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="หมวดสินค้า">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="หน่วยนับ">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ชิ้น" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ปริมาณ" required>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label="จุดสั่งซื้อขั้นต่ำ">
              <Input type="number" min={0} value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ประเภท">
              <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="เช่น ขวด / แก๊ส" />
            </Field>
            <Field label="ขนาด">
              <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="เช่น 600ml / 15 กก." />
            </Field>
          </div>
          <Field label="คลังที่เก็บ">
            <Select value={form.warehouseId || 'none'} onValueChange={(v) => setForm({ ...form, warehouseId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                {(warehouses.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}{w.organization ? ` — ${w.organization.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="วันหมดอายุ">
            <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
            </Button>
          </div>
        </div>
      </FormDialog>

      {/* ===== ฟอร์มเพิ่ม/แก้ไขคลัง (พร้อมหน่วยงานเจ้าของ) ===== */}
      <FormDialog
        open={whDialogOpen}
        onOpenChange={setWhDialogOpen}
        title={editingWh ? 'แก้ไขคลัง' : 'เพิ่มคลังใหม่'}
        description={editingWh ? `แก้ไขข้อมูล "${editingWh.name}"` : 'ระบุข้อมูลคลังและหน่วยงานเจ้าของคลัง'}
      >
        <div className="grid gap-4">
          <Field label="ชื่อคลัง" required>
            <Input value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} placeholder="เช่น คลังสิ่งของกลางจังหวัด" />
          </Field>
          <Field label="หน่วยงานเจ้าของคลัง">
            <Select
              value={whForm.organizationId || 'none'}
              onValueChange={(v) => setWhForm({ ...whForm, organizationId: v === 'none' ? '' : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                {(orgs.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ประเภทคลัง">
              <Input value={whForm.purpose} onChange={(e) => setWhForm({ ...whForm, purpose: e.target.value })} placeholder="เช่น อาหารและน้ำดื่ม / เวชภัณฑ์" />
            </Field>
            <Field label="ความจุคลัง">
              <Input type="number" min={0} value={whForm.capacity} onChange={(e) => setWhForm({ ...whForm, capacity: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ผู้ดูแลคลัง">
              <Input value={whForm.manager} onChange={(e) => setWhForm({ ...whForm, manager: e.target.value })} placeholder="ชื่อ-นามสกุล" />
            </Field>
            <Field label="โทรศัพท์">
              <Input value={whForm.phone} onChange={(e) => setWhForm({ ...whForm, phone: e.target.value })} placeholder="เช่น 053-000-000" />
            </Field>
          </div>
          <Field label="ที่อยู่">
            <Input value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} placeholder="ที่ตั้งคลัง" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setWhDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={submitWh} disabled={savingWh} className="bg-teal-600 hover:bg-teal-700 text-white">
              {savingWh ? 'กำลังบันทึก...' : editingWh ? 'บันทึกการแก้ไข' : 'เพิ่มคลัง'}
            </Button>
          </div>
        </div>
      </FormDialog>

      {/* ===== P1 (G4): ฟอร์มเคลื่อนไหวสต๊อก (รับเข้า/เบิกจ่าย/โอนย้าย/ปรับยอด) ===== */}
      <FormDialog
        open={!!mvItem}
        onOpenChange={(o) => { if (!o) setMvItem(null) }}
        title={`เคลื่อนไหวสต๊อก — ${mvTypeMeta?.label ?? ''}`}
        description={
          mvItem
            ? `${mvItem.name} · คงเหลือ ${fmtNum(mvItem.quantity)} ${mvItem.unit}${mvItem.warehouse ? ` · คลัง ${mvItem.warehouse.name}` : ''}`
            : undefined
        }
      >
        <div className="grid gap-4">
          <Field label="ประเภทรายการ" required>
            <Select value={mvType} onValueChange={(v) => setMvType(v as MovementType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={mvType === 'adjust' ? 'จำนวนปรับยอด (บวก = เพิ่ม / ลบ = ลด)' : 'จำนวน'} required>
            <Input
              type="number"
              step={1}
              min={mvType === 'adjust' ? undefined : 1}
              value={mvQty}
              onChange={(e) => setMvQty(e.target.value)}
              placeholder={mvType === 'adjust' ? 'เช่น -5 หรือ 20' : 'เช่น 100'}
              aria-label="จำนวน"
            />
          </Field>
          {mvType === 'transfer' && (
            <Field label="คลังปลายทาง" required>
              <Select value={mvWarehouseId || 'none'} onValueChange={(v) => setMvWarehouseId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="เลือกคลังปลายทาง" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>เลือกคลังปลายทาง</SelectItem>
                  {(warehouses.data ?? []).filter((w) => w.id !== mvItem?.warehouseId).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}{w.organization ? ` — ${w.organization.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(warehouses.data ?? []).filter((w) => w.id !== mvItem?.warehouseId).length === 0 && (
                <p className="text-xs text-red-600">ไม่มีคลังอื่นให้โอนย้าย — เพิ่มคลังในแท็บ "คลังทั้งหมด" ก่อน</p>
              )}
            </Field>
          )}
          <Field label="เอกสารอ้างอิง / ผู้เบิก">
            <Input value={mvRef} onChange={(e) => setMvRef(e.target.value)} placeholder="เลขที่เอกสาร / ผู้เบิก / ผู้บริจาค" />
          </Field>
          <Field label="หมายเหตุ">
            <Textarea value={mvNote} onChange={(e) => setMvNote(e.target.value)} rows={2} placeholder="โน้ตเพิ่มเติม (ถ้ามี)" />
          </Field>
          {mvPreview !== null && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              คงเหลือ {fmtNum(mvItem?.quantity ?? 0)} {mvItem?.unit} → หลังรายการ{' '}
              <span className={cn('font-semibold', mvPreview < 0 ? 'text-red-600' : 'text-slate-900')}>
                {fmtNum(mvPreview)} {mvItem?.unit}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setMvItem(null)}>ยกเลิก</Button>
            <Button onClick={submitMovement} disabled={mvSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {mvSaving ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
            </Button>
          </div>
        </div>
      </FormDialog>

      {confirm.dialog}
    </div>
  )
}
