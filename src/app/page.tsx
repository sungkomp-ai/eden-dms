'use client'

// EDEN DMS — หน้าหลัก (SPA navigation ทุกโมดูลอยู่ใน route เดียว)
import * as React from 'react'
import { Shell, ModuleKey } from '@/components/eden/shell'
import { useFetch } from '@/components/eden/shared'
import DashboardModule from '@/components/eden/dashboard'
import AIAssistantModule from '@/components/eden/ai-assistant'
import IncidentsModule from '@/components/eden/incidents'
import SitrepsModule from '@/components/eden/sitreps'
import PersonsModule from '@/components/eden/persons'
import OrganizationsModule from '@/components/eden/organizations'
import HrModule from '@/components/eden/hr'
import SheltersModule from '@/components/eden/shelters'
import InventoryModule from '@/components/eden/inventory'
import RequestsModule from '@/components/eden/requests'
import MapModule from '@/components/eden/map'
import AlertsModule from '@/components/eden/alerts'
import AdminModule from '@/components/eden/admin'

const TITLES: Record<ModuleKey, string> = {
  dashboard: 'ภาพรวมสถานการณ์',
  assistant: 'ผู้ช่วย AI ด้านการจัดการภัยพิบัติ',
  incidents: 'เหตุการณ์ภัยพิบัติ',
  sitreps: 'รายงานสถานการณ์ (SITREP)',
  persons: 'ทะเบียนบุคคล — ผู้ประสบภัยและบุคคลสูญหาย',
  organizations: 'ทะเบียนองค์กรและภาคีเครือข่าย',
  hr: 'บุคลากรและอาสาสมัคร',
  shelters: 'ศูนย์พักพิง',
  inventory: 'คลังสิ่งของและเวชภัณฑ์',
  requests: 'คำขอความช่วยเหลือ',
  map: 'แผนที่ปฏิบัติการ GIS',
  alerts: 'ระบบแจ้งเตือนภัย',
  admin: 'ผู้ดูแลระบบ',
}

interface StatsKpis {
  totals?: {
    activeIncidents: number
    missingPersons: number
    pendingRequests: number
    draftAlerts: number
  }
}

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  status: string
  lastLoginAt?: string | null
}

export default function Page() {
  const [active, setActive] = React.useState<ModuleKey>('dashboard')
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [authState, setAuthState] = React.useState<'checking' | 'ok'>('checking')
  const { data } = useFetch<StatsKpis>('/api/stats')

  // ตรวจ session จริงกับเซิร์ฟเวอร์ (P1: G1) — ไม่ผ่าน → ส่งไป /login
  React.useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('unauthorized')
        const json = (await res.json()) as { user: CurrentUser }
        if (!cancelled) {
          setUser(json.user)
          setAuthState('ok')
        }
      })
      .catch(() => {
        if (!cancelled) window.location.href = '/login'
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  const kpis = {
    activeIncidents: data?.totals?.activeIncidents ?? 0,
    missingPersons: data?.totals?.missingPersons ?? 0,
    pendingRequests: data?.totals?.pendingRequests ?? 0,
    draftAlerts: data?.totals?.draftAlerts ?? 0,
  }

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          <p className="text-sm">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
        </div>
      </div>
    )
  }

  return (
    <Shell active={active} onNavigate={setActive} headerTitle={TITLES[active]} kpis={kpis} user={user} onLogout={handleLogout}>
      {active === 'dashboard' && <DashboardModule onNavigate={(key) => setActive(key as ModuleKey)} />}
      {active === 'assistant' && <AIAssistantModule />}
      {active === 'incidents' && <IncidentsModule />}
      {active === 'sitreps' && <SitrepsModule />}
      {active === 'persons' && <PersonsModule />}
      {active === 'organizations' && <OrganizationsModule />}
      {active === 'hr' && <HrModule />}
      {active === 'shelters' && <SheltersModule />}
      {active === 'inventory' && <InventoryModule />}
      {active === 'requests' && <RequestsModule />}
      {active === 'map' && <MapModule />}
      {active === 'alerts' && <AlertsModule />}
      {active === 'admin' && <AdminModule />}
    </Shell>
  )
}
