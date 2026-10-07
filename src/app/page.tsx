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

export default function Page() {
  const [active, setActive] = React.useState<ModuleKey>('dashboard')
  const { data } = useFetch<StatsKpis>('/api/stats')

  const kpis = {
    activeIncidents: data?.totals?.activeIncidents ?? 0,
    missingPersons: data?.totals?.missingPersons ?? 0,
    pendingRequests: data?.totals?.pendingRequests ?? 0,
    draftAlerts: data?.totals?.draftAlerts ?? 0,
  }

  return (
    <Shell active={active} onNavigate={setActive} headerTitle={TITLES[active]} kpis={kpis}>
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
