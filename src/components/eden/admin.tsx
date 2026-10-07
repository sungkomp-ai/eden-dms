'use client'
// EDEN DMS — โมดูลผู้ดูแลระบบ (admin): ผู้ใช้ / บันทึกกิจกรรม / ตั้งค่า / เกี่ยวกับระบบ
import * as React from 'react'
import {
  UserPlus, Pencil, Trash2, Users, History, Settings2, Info,
  ShieldCheck, CircleCheck, Database, Server, Code2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { USER_ROLES, USER_STATUS, AUDIT_ACTIONS, fmtDateTime } from '@/lib/constants'
import {
  apiSend, useFetch, ModuleHeader, StatusBadge, SearchInput,
  EmptyState, TableSkeleton, ErrorState, FormDialog, Field, useConfirmDelete,
} from './shared'

interface User {
  id: string
  email: string
  name: string
  role: string
  status: string
  lastLoginAt?: string | null
  createdAt: string
}

interface AuditLog {
  id: string
  userName: string
  action: string
  module: string
  detail?: string | null
  createdAt: string
}

interface Setting { id: string; key: string; value: string }

const emptyUserForm = { name: '', email: '', role: 'officer', status: 'active' }

// 12 โมดูลของระบบ (ดัดแปลงจาก Sahana Eden controllers)
const SYSTEM_MODULES: { key: string; label: string; origin: string }[] = [
  { key: 'dashboard', label: 'ภาพรวม (Dashboard)', origin: 'default' },
  { key: 'incidents', label: 'เหตุการณ์ภัยพิบัติ', origin: 'sit' },
  { key: 'sitreps', label: 'รายงานสถานการณ์', origin: 'cms/sit' },
  { key: 'map', label: 'แผนที่ GIS', origin: 'gis' },
  { key: 'requests', label: 'คำขอความช่วยเหลือ', origin: 'req' },
  { key: 'alerts', label: 'แจ้งเตือนภัย (MSG)', origin: 'msg' },
  { key: 'persons', label: 'ทะเบียนบุคคล (PR)', origin: 'pr' },
  { key: 'organizations', label: 'ทะเบียนองค์กร', origin: 'org' },
  { key: 'hr', label: 'บุคลากร/อาสาสมัคร', origin: 'hrm' },
  { key: 'shelters', label: 'ศูนย์พักพิง', origin: 'cr/shelter' },
  { key: 'inventory', label: 'คลังสิ่งของ', origin: 'inv' },
  { key: 'admin', label: 'ผู้ดูแลระบบ', origin: 'admin' },
]

export default function AdminModule() {
  const { toast } = useToast()
  const confirm = useConfirmDelete()

  // ===== Tab: ผู้ใช้ =====
  const [userQ, setUserQ] = React.useState('')
  const [logQ, setLogQ] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<User | null>(null)
  const [form, setForm] = React.useState(emptyUserForm)
  const [saving, setSaving] = React.useState(false)

  const users = useFetch<User[]>('/api/users')
  const logs = useFetch<AuditLog[]>('/api/audit-logs')
  const settings = useFetch<Setting[]>('/api/settings')

  const filteredUsers = React.useMemo(() => {
    const list = users.data ?? []
    const kw = userQ.trim().toLowerCase()
    if (!kw) return list
    return list.filter((u) => [u.name, u.email].filter(Boolean).join(' ').toLowerCase().includes(kw))
  }, [users.data, userQ])

  const filteredLogs = React.useMemo(() => {
    const list = logs.data ?? []
    const kw = logQ.trim().toLowerCase()
    if (!kw) return list
    return list.filter((l) => [l.userName, l.module, l.detail].filter(Boolean).join(' ').toLowerCase().includes(kw))
  }, [logs.data, logQ])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyUserForm)
    setDialogOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ name: u.name, email: u.email, role: u.role ?? 'officer', status: u.status ?? 'active' })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'กรุณากรอกชื่อและอีเมล', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), email: form.email.trim(), role: form.role, status: form.status }
      if (editing) {
        await apiSend(`/api/users/${editing.id}`, 'PUT', body)
        toast({ title: 'บันทึกสำเร็จ', description: `แก้ไขผู้ใช้ "${body.name}" เรียบร้อยแล้ว` })
      } else {
        await apiSend('/api/users', 'POST', body)
        toast({ title: 'เพิ่มผู้ใช้สำเร็จ', description: `สร้างบัญชี "${body.name}" เรียบร้อยแล้ว` })
      }
      setDialogOpen(false)
      users.refetch()
    } catch (e) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const removeUser = (u: User) => {
    confirm.open(async () => {
      try {
        await apiSend(`/api/users/${u.id}`, 'DELETE')
        toast({ title: 'ลบสำเร็จ', description: `ลบบัญชี "${u.name}" แล้ว` })
        users.refetch()
      } catch (e) {
        toast({ title: 'ลบไม่สำเร็จ', description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
      }
    }, `บัญชีผู้ใช้ "${u.name}"`)
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="ผู้ดูแลระบบ"
        description="จัดการบัญชีผู้ใช้ ตรวจสอบบันทึกกิจกรรม และตั้งค่าระบบ EDEN DMS"
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" /> ผู้ใช้</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-4 w-4" /> บันทึกกิจกรรม</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings2 className="h-4 w-4" /> ตั้งค่า</TabsTrigger>
          <TabsTrigger value="about" className="gap-1.5"><Info className="h-4 w-4" /> เกี่ยวกับระบบ</TabsTrigger>
        </TabsList>

        {/* ===== Tab: ผู้ใช้ ===== */}
        <TabsContent value="users">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                สมาชิก <span className="font-semibold text-slate-700">{filteredUsers.length}</span> บัญชี
              </p>
              <div className="flex items-center gap-2">
                <SearchInput value={userQ} onChange={setUserQ} placeholder="ค้นหาชื่อ/อีเมล..." />
                <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <UserPlus className="h-4 w-4" /> เพิ่มผู้ใช้
                </Button>
              </div>
            </div>

            {users.error ? (
              <ErrorState message={users.error} onRetry={users.refetch} />
            ) : users.loading ? (
              <TableSkeleton rows={5} />
            ) : filteredUsers.length === 0 ? (
              <EmptyState message="ไม่พบบัญชีผู้ใช้" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>ชื่อ</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>บทบาท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-slate-800">{u.name}</TableCell>
                        <TableCell className="text-slate-600">{u.email}</TableCell>
                        <TableCell><StatusBadge options={USER_ROLES} value={u.role} /></TableCell>
                        <TableCell><StatusBadge options={USER_STATUS} value={u.status} /></TableCell>
                        <TableCell className="whitespace-nowrap text-slate-500">{fmtDateTime(u.lastLoginAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label={`แก้ไข ${u.name}`} onClick={() => openEdit(u)} className="h-7 w-7 text-slate-500 hover:text-slate-800">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`ลบ ${u.name}`} onClick={() => removeUser(u)} className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600">
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
        </TabsContent>

        {/* ===== Tab: บันทึกกิจกรรม (timeline) ===== */}
        <TabsContent value="audit">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                บันทึก <span className="font-semibold text-slate-700">{filteredLogs.length}</span> รายการ
              </p>
              <SearchInput value={logQ} onChange={setLogQ} placeholder="ค้นหาผู้ใช้/โมดูล/รายละเอียด..." />
            </div>

            {logs.error ? (
              <ErrorState message={logs.error} onRetry={logs.refetch} />
            ) : logs.loading ? (
              <TableSkeleton rows={6} />
            ) : filteredLogs.length === 0 ? (
              <EmptyState message="ไม่พบบันทึกกิจกรรม" />
            ) : (
              <div className="max-h-96 overflow-y-auto p-4">
                <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
                  {filteredLogs.map((l) => (
                    <li key={l.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge options={AUDIT_ACTIONS} value={l.action} />
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-600">{l.module}</Badge>
                        <span className="text-xs text-slate-400">{fmtDateTime(l.createdAt)}</span>
                      </div>
                      {l.detail && <p className="mt-1 text-sm text-slate-700">{l.detail}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">โดย {l.userName}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== Tab: ตั้งค่า (อ่านอย่างเดียว) ===== */}
        <TabsContent value="settings">
          {settings.error ? (
            <ErrorState message={settings.error} onRetry={settings.refetch} />
          ) : settings.loading ? (
            <TableSkeleton rows={4} />
          ) : !settings.data?.length ? (
            <EmptyState message="ไม่พบการตั้งค่าระบบ" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {settings.data.map((s) => (
                <Card key={s.id} className="border-slate-200 shadow-sm">
                  <CardHeader className="p-4 pb-1">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium capitalize text-slate-600">
                      <Settings2 className="h-4 w-4 text-slate-400" />
                      {s.key.replace(/-/g, ' ')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="break-words rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">{s.value}</p>
                    <p className="mt-1.5 text-[11px] text-slate-400">อัปเดตล่าสุด {fmtDateTime((s as Setting & { updatedAt?: string }).updatedAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: เกี่ยวกับระบบ ===== */}
        <TabsContent value="about">
          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="p-6 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> เกี่ยวกับ EDEN DMS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6 pt-0">
                <p className="text-sm leading-relaxed text-slate-600">
                  <strong className="text-slate-800">EDEN DMS (Disaster Management System)</strong> — ระบบจัดการภัยพิบัติครบวงจร
                  พัฒนาใหม่โดยดัดแปลงแนวคิดและโครงสร้างโมดูลจาก <strong className="text-slate-800">Sahana Eden</strong>
                  {' '}เวอร์ชันต้นฉบับ eden-core (nursix-dev-5066) ซึ่งเขียนด้วย Python บนกรอบงาน web2py
                  มาเป็นสถาปัตยกรรมสมัยใหม่ ครอบคลุมงานทั้งหมด 12 โมดูล ตั้งแต่เหตุการณ์ภัยพิบัติ ทะเบียนบุคคล
                  ศูนย์พักพิง คลังสินค้า คำขอความช่วยเหลือ แผนที่ GIS การแจ้งเตือน ไปจนถึงระบบผู้ดูแล
                </p>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">โมดูลทั้ง 12 (ทั้งหมดใช้งานได้)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {SYSTEM_MODULES.map((m) => (
                      <div key={m.key} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-700">{m.label}</p>
                          <p className="text-[10px] text-slate-400">ต้นฉบับ: {m.origin}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <CircleCheck className="h-3.5 w-3.5" /> ใช้งานได้
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <Server className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Next.js 16 (App Router)</p>
                      <p className="text-xs text-slate-500">Frontend + REST API ในโปรเจกต์เดียว</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <Database className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Prisma ORM + SQLite</p>
                      <p className="text-xs text-slate-500">14 models พร้อมข้อมูลตัวอย่างภาษาไทย</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <Code2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">shadcn/ui + Tailwind CSS 4</p>
                      <p className="text-xs text-slate-500">คอมโพเนนต์ New York ตอบสนองทุกขนาดหน้าจอ</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  สิทธิ์การใช้งาน: Sahana Eden เผยแพร่ภายใต้ลิขสิทธิ์แบบโอเพนซอร์ส (MIT/GPL) — งานดัดแปลงนี้สร้างขึ้นใหม่ทั้งหมดด้วย TypeScript
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== ฟอร์มเพิ่ม/แก้ไขผู้ใช้ ===== */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `แก้ไขผู้ใช้ "${editing.name}"` : 'เพิ่มผู้ใช้ใหม่'}
        description={editing ? 'ปรับปรุงข้อมูลบัญชีผู้ใช้และบทบาท' : 'สร้างบัญชีผู้ใช้สำหรับเข้าใช้งานระบบ'}
      >
        <div className="grid gap-4">
          <Field label="ชื่อ-นามสกุล" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น นางสาวกมลวรรณ ทองสุข" />
          </Field>
          <Field label="อีเมล" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@eden.go.th" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="บทบาท">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="สถานะ">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USER_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
            </Button>
          </div>
        </div>
      </FormDialog>

      {confirm.dialog}
    </div>
  )
}
