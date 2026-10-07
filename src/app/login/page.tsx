'use client'

// EDEN DMS — หน้าเข้าสู่ระบบ (P1: G1 accountability)
import * as React from 'react'
import { Radio, Mail, Lock, LogIn, AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const DEMO_ACCOUNTS = [
  { email: "admin@eden.go.th", password: "Admin@2568", role: "ผู้ดูแลระบบ" },
  { email: "coordinator@eden.go.th", password: "Coord@2568", role: "ผู้ประสานงาน" },
  { email: "officer.cm@eden.go.th", password: "Officer@2568", role: "เจ้าหน้าที่ (เชียงใหม่)" },
  { email: "volunteer1@eden.go.th", password: "Vol@2568", role: "อาสาสมัคร" },
]

export default function LoginPage() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
        return
      }
      window.location.href = '/'
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <Radio className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">EDEN DMS</h1>
            <p className="text-sm text-slate-400">ระบบจัดการภัยพิบัติ · ศูนย์ปฏิบัติการภาคเหนือ</p>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-800/60 backdrop-blur">
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">อีเมล</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@eden.dms"
                    className="border-slate-700 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">รหัสผ่าน</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-slate-700 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-500"
              >
                <LogIn className="mr-2 h-4 w-4" />
                {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo accounts */}
        <Card className="border-slate-800 bg-slate-800/40">
          <CardContent className="p-4 pt-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              บัญชีทดสอบ (คลิกเพื่อกรอกอัตโนมัติ)
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-left transition-colors hover:border-emerald-600 hover:bg-slate-900"
                >
                  <p className="text-xs font-medium text-slate-200">{acc.role}</p>
                  <p className="text-[11px] text-slate-500">{acc.email} · {acc.password}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] leading-relaxed text-slate-600">
          ทุกการเข้าถึงและแก้ไขข้อมูลจะถูกบันทึก Audit Trail<br />
          © 2568 EDEN DMS — ดัดแปลงจากสถาปัตยกรรม Sahana Eden
        </p>
      </div>
    </div>
  )
}
