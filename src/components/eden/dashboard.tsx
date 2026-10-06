'use client'

// EDEN DMS — โมดูลแดชบอร์ด: ภาพรวมสถานการณ์จากทุกโมดูล (KPI, กราฟ, สถานะผู้ประสบภัย, เหตุการณ์ล่าสุด, ศูนย์พักพิง)
import * as React from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  Home,
  MapPin,
  Siren,
  UserX,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  EmptyState,
  ErrorState,
  ModuleHeader,
  RefreshButton,
  StatCard,
  StatusBadge,
  useFetch,
} from '@/components/eden/shared'
import {
  INCIDENT_STATUS,
  INCIDENT_TYPES,
  PERSON_STATUS,
  SEVERITIES,
  SHELTER_STATUS,
  fmtDate,
  fmtDateTime,
  fmtNum,
  optLabel,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

// ===== Types (/api/stats) =====
interface StatsIncident {
  id: number
  code: string
  title: string
  type: string
  severity: string
  status: string
  affectedPeople: number
  injured: number
  deceased: number
  startDate: string
  locationName: string | null
  lat: number | null
  lng: number | null
}

interface StatsShelter {
  id: number
  name: string
  capacity: number
  currentOccupancy: number
  status: string
  lat: number | null
  lng: number | null
  type: string
}

interface StatsTotals {
  activeIncidents: number
  affectedPeople: number
  missingPersons: number
  sheltersOpen: number
  shelterCapacity: number
  shelterOccupancy: number
  pendingRequests: number
  volunteers: number
  onMission: number
  lowStock: number
  inventoryItems: number
  draftAlerts: number
  reports: number
}

interface StatsTrendPoint {
  date: string
  affected: number
  requests: number
}

interface StatsData {
  totals: StatsTotals
  incidents: StatsIncident[]
  byType: Record<string, number>
  byStatus: Record<string, number>
  personsByStatus: Record<string, number>
  requestsByStatus: Record<string, number>
  hrByStatus: Record<string, number>
  invByCategory: Record<string, number>
  trend: StatsTrendPoint[]
  shelters: StatsShelter[]
}

// ===== Constants =====
const CHART_PALETTE = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#a3a3a3', '#d946ef']

const PERSON_BAR: Record<string, string> = {
  missing: '[&>div]:bg-red-500',
  found: '[&>div]:bg-teal-500',
  safe: '[&>div]:bg-emerald-500',
  injured: '[&>div]:bg-orange-500',
  deceased: '[&>div]:bg-slate-400',
  evacuated: '[&>div]:bg-violet-500',
}

const SCROLL_AREA =
  'max-h-96 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-track]:bg-transparent'

// ===== Helpers =====
function fmtTrendDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })
}

function occupancyBar(pct: number): string {
  if (pct >= 90) return '[&>div]:bg-red-500'
  if (pct >= 70) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-emerald-500'
}

function occupancyText(pct: number): string {
  if (pct >= 90) return 'text-red-600'
  if (pct >= 70) return 'text-amber-600'
  return 'text-emerald-600'
}

// ===== Chart: แนวโน้ม 7 วัน =====
function TrendChart({ trend }: { trend: StatsTrendPoint[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradAffected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => fmtTrendDate(String(d))}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtNum(Number(v))}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip formatter={(value) => fmtNum(Number(value))} />
          <Area
            type="monotone"
            dataKey="affected"
            name="ผู้ประสบภัย"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#gradAffected)"
          />
          <Area
            type="monotone"
            dataKey="requests"
            name="คำขอความช่วยเหลือ"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#gradRequests)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> ผู้ประสบภัย
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> คำขอความช่วยเหลือ
        </span>
      </div>
    </div>
  )
}

// ===== Chart: เหตุการณ์ตามประเภท =====
function TypePieChart({ byType }: { byType: Record<string, number> }) {
  const pieData = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: optLabel(INCIDENT_TYPES, k), value: v }))
  const total = pieData.reduce((s, d) => s + d.value, 0)

  if (pieData.length === 0) return <EmptyState message="ยังไม่มีข้อมูลเหตุการณ์" />

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-[220px] w-full shrink-0 sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={2}
            >
              {pieData.map((entry, idx) => (
                <Cell key={entry.name} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${fmtNum(Number(value))} เหตุการณ์`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{fmtNum(total)}</span>
          <span className="text-xs text-slate-500">เหตุการณ์ทั้งหมด</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-1 gap-2.5 sm:w-1/2">
        {pieData.map((d, idx) => (
          <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
              />
              <span className="truncate text-slate-600">{d.name}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-900">
              {fmtNum(d.value)}{' '}
              <span className="font-normal text-slate-400">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ===== Skeleton ตอนโหลด =====
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[88px] w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}

// ===== เนื้อหาหลัก =====
function DashboardContent({ data, onNavigate }: { data: StatsData; onNavigate?: (key: string) => void }) {
  const t = data.totals
  const incidents = data.incidents ?? []
  const openIncidents = incidents.filter((i) => i.status !== 'closed')
  const injuredTotal = openIncidents.reduce((s, i) => s + i.injured, 0)
  const deceasedTotal = openIncidents.reduce((s, i) => s + i.deceased, 0)
  const totalRequests = Object.values(data.requestsByStatus ?? {}).reduce((s, v) => s + v, 0)

  const personByStatus = data.personsByStatus ?? {}
  const personTotal = Object.values(personByStatus).reduce((s, v) => s + v, 0)

  const recentIncidents = [...incidents]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5)

  const openShelters = (data.shelters ?? []).filter((s) => s.status !== 'closed')

  const kpis: { title: string; value: string; sub: string; icon: React.ReactNode; tone: 'slate' | 'emerald' | 'amber' | 'red' | 'violet' | 'teal' | 'orange' }[] = [
    {
      title: 'เหตุการณ์ที่แอคทีฟ',
      value: fmtNum(t.activeIncidents),
      sub: `รวมทุกสถานะ ${fmtNum(incidents.length)} เหตุการณ์`,
      icon: <AlertTriangle />,
      tone: 'red',
    },
    {
      title: 'ผู้ประสบภัย',
      value: t.affectedPeople >= 1000000 ? `${(t.affectedPeople / 1000000).toFixed(2)} ล้าน` : fmtNum(t.affectedPeople),
      sub: `รวม ${fmtNum(t.affectedPeople)} คน · บาดเจ็บ ${fmtNum(injuredTotal)} · เสียชีวิต ${fmtNum(deceasedTotal)}`,
      icon: <Users />,
      tone: 'amber',
    },
    {
      title: 'บุคคลสูญหาย',
      value: fmtNum(t.missingPersons),
      sub: 'กำลังค้นหาและติดตาม',
      icon: <UserX />,
      tone: 'red',
    },
    {
      title: 'ศูนย์พักพิง',
      value: fmtNum(t.sheltersOpen),
      sub: `ผู้พักพิง ${fmtNum(t.shelterOccupancy)}/${fmtNum(t.shelterCapacity)} ความจุ`,
      icon: <Home />,
      tone: 'teal',
    },
    {
      title: 'คำขอรอพิจารณา',
      value: fmtNum(t.pendingRequests),
      sub: `คำขอทั้งหมด ${fmtNum(totalRequests)} รายการ`,
      icon: <ClipboardList />,
      tone: 'violet',
    },
    {
      title: 'อาสาสมัครพร้อมปฏิบัติงาน',
      value: fmtNum(t.volunteers),
      sub: `ปฏิบัติภารกิจอยู่ ${fmtNum(t.onMission)} คน`,
      icon: <HeartHandshake />,
      tone: 'emerald',
    },
  ]

  return (
    <div className="space-y-6">
      {/* 1) แถบสถานการณ์วิกฤต */}
      {t.activeIncidents > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Siren className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-800">
                มีเหตุการณ์ภัยพิบัติกำลังดำเนินการ {fmtNum(t.activeIncidents)} เหตุการณ์ — ผู้ประสบภัย{' '}
                {fmtNum(t.affectedPeople)} คน
              </p>
              <p className="mt-0.5 text-sm text-red-600">
                ต้องการการติดตามและประสานงานอย่างใกล้ชิด ตรวจสอบเหตุการณ์และคำขอความช่วยเหลือล่าสุดทันที
              </p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate?.('incidents')}
            className="shrink-0 bg-red-600 text-white hover:bg-red-700"
          >
            ดูเหตุการณ์ <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 2) KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <StatCard key={k.title} title={k.title} value={k.value} sub={k.sub} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      {/* 3) กราฟ 2 ใบ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>แนวโน้ม 7 วันล่าสุด</CardTitle>
            <CardDescription>จำนวนผู้ประสบภัยและคำขอความช่วยเหลือรายวัน</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart trend={data.trend ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>เหตุการณ์ตามประเภท</CardTitle>
            <CardDescription>สัดส่วนเหตุการณ์ภัยพิบัติทั้งหมดในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            <TypePieChart byType={data.byType ?? {}} />
          </CardContent>
        </Card>
      </div>

      {/* 4) การกระจายผู้ประสบภัยตามสถานะ */}
      <Card>
        <CardHeader>
          <CardTitle>การกระจายผู้ประสบภัยตามสถานะ</CardTitle>
          <CardDescription>สรุปสถานะบุคคลในทะเบียนผู้ประสบภัย รวม {fmtNum(personTotal)} คน</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('persons')} className="text-slate-600">
              ทะเบียนบุคคล <ChevronRight className="ml-0.5 h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {personTotal === 0 ? (
            <EmptyState message="ยังไม่มีข้อมูลผู้ประสบภัย" />
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {PERSON_STATUS.filter((o) => (personByStatus[o.value] ?? 0) > 0).map((o) => {
                const count = personByStatus[o.value] ?? 0
                const pct = Math.round((count / personTotal) * 100)
                return (
                  <div key={o.value} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge options={PERSON_STATUS} value={o.value} />
                      <span className="text-xs text-slate-500">
                        <span className="text-sm font-semibold text-slate-900">{fmtNum(count)}</span> คน · {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className={cn('h-2', PERSON_BAR[o.value] ?? '[&>div]:bg-slate-400')} />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5) สองคอลัมน์ล่าง */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* เหตุการณ์ล่าสุด */}
        <Card>
          <CardHeader>
            <CardTitle>เหตุการณ์ล่าสุด</CardTitle>
            <CardDescription>เหตุการณ์ภัยพิบัติที่บันทึกล่าสุด 5 รายการ</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('incidents')} className="text-slate-600">
                ดูทั้งหมด <ChevronRight className="ml-0.5 h-4 w-4" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentIncidents.length === 0 ? (
              <EmptyState message="ยังไม่มีเหตุการณ์ในระบบ" />
            ) : (
              <div className={SCROLL_AREA}>
                <div className="space-y-2">
                  {recentIncidents.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onNavigate?.('incidents')}
                      className="w-full rounded-lg border border-slate-100 p-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      aria-label={`เปิดดูเหตุการณ์ ${i.title}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">{i.title}</span>
                            <StatusBadge options={SEVERITIES} value={i.severity} />
                            <StatusBadge options={INCIDENT_STATUS} value={i.status} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{i.locationName || 'ไม่ระบุพื้นที่'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3 shrink-0" />
                              ผู้ประสบภัย {fmtNum(i.affectedPeople)} คน
                            </span>
                            <span>{fmtDate(i.startDate)}</span>
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ศูนย์พักพิง — อัตราความจุ */}
        <Card>
          <CardHeader>
            <CardTitle>ศูนย์พักพิง — อัตราความจุ</CardTitle>
            <CardDescription>
              เปิดใช้งาน {fmtNum(openShelters.length)} แห่ง · ผู้พักพิง {fmtNum(t.shelterOccupancy)}/
              {fmtNum(t.shelterCapacity)} คน
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('shelters')} className="text-slate-600">
                จัดการ <ChevronRight className="ml-0.5 h-4 w-4" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {openShelters.length === 0 ? (
              <EmptyState message="ยังไม่มีศูนย์พักพิงที่เปิดใช้งาน" />
            ) : (
              <div className={SCROLL_AREA}>
                <div className="space-y-3">
                  {openShelters.map((s) => {
                    const pct = s.capacity > 0 ? Math.min(100, Math.round((s.currentOccupancy / s.capacity) * 100)) : 0
                    return (
                      <div key={s.id} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900">{s.name}</span>
                            <StatusBadge options={SHELTER_STATUS} value={s.status} />
                          </div>
                          <span className={cn('shrink-0 text-xs font-semibold', occupancyText(pct))}>
                            {fmtNum(s.currentOccupancy)}/{fmtNum(s.capacity)} คน ({pct}%)
                          </span>
                        </div>
                        <Progress value={pct} className={cn('h-2', occupancyBar(pct))} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===== Main =====
export default function DashboardModule({ onNavigate }: { onNavigate?: (key: string) => void } = {}) {
  const { data, loading, error, refetch } = useFetch<StatsData>('/api/stats')

  // ประทับเวลา "อัปเดตล่าสุด" — ต้องคำนวณหลัง mount เท่านั้น
  // (หากเรียก new Date() ระหว่าง render SSR เวลา server กับ client จะต่างกันทำให้ hydration mismatch)
  const [updatedAt, setUpdatedAt] = React.useState('')
  React.useEffect(() => {
    setUpdatedAt(fmtDateTime(new Date()))
  }, [data])

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="ภาพรวมสถานการณ์"
        description={`ข้อมูลสรุปจากทุกโมดูล${updatedAt ? ` · อัปเดตล่าสุด ${updatedAt}` : ''}`}
        actions={<RefreshButton onClick={() => refetch()} loading={loading} />}
      />

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <ErrorState message={error} onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardContent data={data} onNavigate={onNavigate} />
      )}
    </div>
  )
}
