'use client'

// EDEN DMS — Shared UI components ใช้ร่วมกันทุกโมดูล
import * as React from 'react'
import { Search, RefreshCw, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Option, optBadge, optLabel } from '@/lib/constants'

// ===== Data fetching hook =====
export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(!!url)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(() => {
    if (!url) return
    let alive = true
    setLoading(true)
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (alive) { setData(json as T); setError(null) }
      })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
     
  }, [url])

  React.useEffect(() => {
    const cleanup = refetch()
    return cleanup
     
  }, [url, ...deps])

  return { data, loading, error, refetch, setData }
}

// ===== API helper (POST/PUT/DELETE) =====
export async function apiSend(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
  return json
}

// ===== Module header =====
export function ModuleHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ===== Status badge =====
export function StatusBadge({ options, value }: { options: Option[]; value: string | null | undefined }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', optBadge(options, value))}>
      {optLabel(options, value)}
    </Badge>
  )
}

// ===== Stat card =====
export function StatCard({ title, value, sub, icon, tone = 'slate' }: {
  title: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'violet' | 'teal' | 'orange'
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    violet: 'bg-violet-50 text-violet-700',
    teal: 'bg-teal-50 text-teal-700',
    orange: 'bg-orange-50 text-orange-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500 truncate">{sub}</p>}
        </div>
        {icon && <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5', tones[tone])}>{icon}</div>}
      </div>
    </div>
  )
}

// ===== Search input =====
export function SearchInput({ value, onChange, placeholder = 'ค้นหา...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  )
}

// ===== Refresh button =====
export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="outline" size="icon" onClick={onClick} aria-label="รีเฟรช" className="h-9 w-9">
      <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
    </Button>
  )
}

// ===== Empty state =====
export function EmptyState({ message = 'ไม่พบข้อมูล' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
      <Inbox className="h-10 w-10" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ===== Loading skeleton rows =====
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

// ===== Error state =====
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <p className="text-sm text-red-600">เกิดข้อผิดพลาด: {message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>ลองใหม่</Button>}
    </div>
  )
}

// ===== Form dialog wrapper =====
export function FormDialog({ open, onOpenChange, title, description, children, wide }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[85vh] overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

// ===== Field wrapper =====
export function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

// ===== Confirm delete =====
export function useConfirmDelete() {
  const [state, setState] = React.useState<{ open: boolean; onConfirm?: () => void; label?: string }>({ open: false })
  const open = (onConfirm: () => void, label?: string) => setState({ open: true, onConfirm, label })
  const close = () => setState({ open: false })
  const dialog = (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogDescription>
            คุณต้องการลบ{state.label ?? 'รายการนี้'}ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>ยกเลิก</Button>
          <Button
            variant="destructive"
            onClick={() => { state.onConfirm?.(); close() }}
          >
            ลบ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
  return { open, dialog }
}
