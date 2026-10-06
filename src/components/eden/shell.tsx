'use client'

// EDEN DMS — Application shell: sidebar + header + main content
import * as React from 'react'
import {
  LayoutDashboard, AlertTriangle, FileText, Users, Building2, HeartHandshake,
  Home, Boxes, ClipboardList, Bell, Map as MapIcon, Settings, Menu, X, Radio, Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { fmtNum } from '@/lib/constants'

export type ModuleKey =
  | 'dashboard' | 'assistant' | 'incidents' | 'sitreps' | 'persons' | 'organizations'
  | 'hr' | 'shelters' | 'inventory' | 'requests' | 'map' | 'alerts' | 'admin'

export interface ModuleDef {
  key: ModuleKey
  label: string
  icon: React.ReactNode
  group: string
  badgeKey?: 'pendingRequests' | 'missingPersons' | 'activeIncidents' | 'draftAlerts'
}

export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'ภาพรวม', icon: <LayoutDashboard />, group: 'ภาพรวม' },
  { key: 'assistant', label: 'ผู้ช่วย AI', icon: <Bot />, group: 'ผู้ช่วยอัจฉริยะ' },
  { key: 'incidents', label: 'เหตุการณ์ภัยพิบัติ', icon: <AlertTriangle />, group: 'ปฏิบัติการ', badgeKey: 'activeIncidents' },
  { key: 'sitreps', label: 'รายงานสถานการณ์', icon: <FileText />, group: 'ปฏิบัติการ' },
  { key: 'map', label: 'แผนที่ GIS', icon: <MapIcon />, group: 'ปฏิบัติการ' },
  { key: 'requests', label: 'คำขอความช่วยเหลือ', icon: <ClipboardList />, group: 'ปฏิบัติการ', badgeKey: 'pendingRequests' },
  { key: 'alerts', label: 'แจ้งเตือนภัย', icon: <Bell />, group: 'ปฏิบัติการ', badgeKey: 'draftAlerts' },
  { key: 'persons', label: 'ทะเบียนบุคคล', icon: <Users />, group: 'ทะเบียนข้อมูล', badgeKey: 'missingPersons' },
  { key: 'organizations', label: 'ทะเบียนองค์กร', icon: <Building2 />, group: 'ทะเบียนข้อมูล' },
  { key: 'hr', label: 'บุคลากร/อาสาสมัคร', icon: <HeartHandshake />, group: 'ทะเบียนข้อมูล' },
  { key: 'shelters', label: 'ศูนย์พักพิง', icon: <Home />, group: 'ทะเบียนข้อมูล' },
  { key: 'inventory', label: 'คลังสิ่งของ', icon: <Boxes />, group: 'ทรัพยากร' },
  { key: 'admin', label: 'ผู้ดูแลระบบ', icon: <Settings />, group: 'ระบบ' },
]

export function Shell({ active, onNavigate, headerTitle, children, kpis }: {
  active: ModuleKey
  onNavigate: (key: ModuleKey) => void
  headerTitle: string
  children: React.ReactNode
  kpis?: Partial<Record<'activeIncidents' | 'missingPersons' | 'pendingRequests' | 'draftAlerts', number>>
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const groups = React.useMemo(() => {
    const map = new Map<string, ModuleDef[]>()
    MODULES.forEach((m) => {
      if (!map.has(m.group)) map.set(m.group, [])
      map.get(m.group)!.push(m)
    })
    return Array.from(map.entries())
  }, [])

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-bold leading-tight tracking-tight">EDEN DMS</p>
          <p className="text-[11px] text-slate-400">ระบบจัดการภัยพิบัติ</p>
        </div>
        <button
          className="ml-auto lg:hidden text-slate-400 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="ปิดเมนู"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav — เลื่อนขึ้นลงได้ (min-h-0 จำกัดความสูงตาม flex container, ไม่งั้นเนื้อหาจะล้นแบบเลื่อนไม่ได้) */}
      <nav
        aria-label="เมนูหลัก"
        className={cn(
          'flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4',
          '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600',
          '[scrollbar-width:thin] [scrollbar-color:theme(colors.slate.700)_transparent]',
        )}
      >
        <div className="space-y-5">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{group}</p>
              <ul className="space-y-1">
                {items.map((m) => {
                  const isActive = active === m.key
                  const badge = m.badgeKey ? kpis?.[m.badgeKey] : undefined
                  return (
                    <li key={m.key}>
                      <button
                        onClick={() => { onNavigate(m.key); setMobileOpen(false) }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                        )}
                      >
                        <span className="[&_.lucide]:h-4 [&_.lucide]:w-4 shrink-0">{m.icon}</span>
                        <span className="truncate">{m.label}</span>
                        {!!badge && badge > 0 && (
                          <span className={cn(
                            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
                            isActive ? 'bg-white/20 text-white' : 'bg-red-500/90 text-white',
                          )}>
                            {fmtNum(badge)}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-800 px-5 py-3">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          EDEN DMS v1.0 · ดัดแปลงจาก Sahana Eden<br />ศูนย์ปฏิบัติการภัยพิบัติภาคเหนือ
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setMobileOpen(true)}
              aria-label="เปิดเมนู"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-sm font-semibold text-slate-800 truncate">{headerTitle}</h1>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-emerald-700">ระบบออนไลน์</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">ผ</div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-xs font-semibold text-slate-800">ผู้ดูแลระบบกลาง</p>
                  <p className="text-[10px] text-slate-500">ผู้ดูแลระบบ</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>

        {/* Footer — sticky bottom */}
        <footer className="mt-auto border-t border-slate-200 bg-white">
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-slate-500">
              © 2568 EDEN DMS — ระบบจัดการภัยพิบัติ · สร้างบนสถาปัตยกรรม Sahana Eden (eden-core) · Next.js 16 + Prisma
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
