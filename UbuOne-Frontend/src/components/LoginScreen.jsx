import React, { useState } from 'react'
import { KeyRound, Loader2, Lock, ShieldCheck, Store, UserCheck, Users } from 'lucide-react'
import { UbuOneLogo, UbuOneOrbitalMark } from './UbuOneBrand'
import { Button, Input, Badge } from './ui/primitives'
import { loginUbuOne } from '../lib/api'

const DEMO_ROLES = [
  {
    username: 'thabo_cashier',
    passcode: '1111',
    name: 'Thabo Maseko',
    roleLabel: 'Unit Cashier',
    unit: 'Khumalo Spaza (unit-104)',
    scope: 'Counter UBU Till & Change-in-UBU',
    icon: UserCheck,
  },
  {
    username: 'khumalo_owner',
    passcode: '1040',
    name: 'Baba Khumalo',
    roleLabel: 'Unit Owner',
    unit: 'Khumalo Spaza (unit-104)',
    scope: 'Full Till, Settlements, Pacts & Staff RBAC',
    icon: Store,
  },
  {
    username: 'thandi_owner',
    passcode: '1020',
    name: 'Mama Thandi Zulu',
    roleLabel: 'Unit Owner',
    unit: 'Mama Thandi Corner Spaza (unit-102)',
    scope: 'Owner permissions on Unit 102',
    icon: ShieldCheck,
  },
  {
    username: 'uniti_admin',
    passcode: '9999',
    name: 'SpazaUniti HQ',
    roleLabel: 'Network Admin',
    unit: 'All SpazaUniti Nodes',
    scope: 'Cross-Unit Network Explorer & Ecosystem Float',
    icon: Users,
  },
]

export function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('khumalo_owner')
  const [passcode, setPasscode] = useState('1040')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const performLogin = async (u, p) => {
    setError('')
    setLoading(true)
    try {
      const res = await loginUbuOne(u, p)
      onLoginSuccess?.(res.staff)
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    performLogin(username, passcode)
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0F1735] flex items-center justify-center p-4 md:p-8 overflow-hidden">
      {/* Subtle branded wallpaper backdrop from user's UbuOne Brand Kit */}
      <img
        src="/brand/ubu-one-wallpaper2.jpeg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-20 scale-105 pointer-events-none select-none"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(0, 162, 232, 0.22), transparent 48%), linear-gradient(135deg, rgba(11, 17, 40, 0.92) 0%, rgba(15, 23, 53, 0.88) 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Brand Story & Ecosystem Summary */}
        <div className="lg:col-span-6 ubu-card-surface rounded-3xl p-7 md:p-9 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute -right-14 -bottom-14 opacity-15 pointer-events-none">
            <UbuOneOrbitalMark className="w-72 h-72" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <UbuOneLogo size="lg" />
              <Badge variant="cyber">Unit RBAC Portal</Badge>
            </div>

            <div className="space-y-3 pt-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
                Built for R1 Moments.
                <br />
                <span className="text-[#00A2E8]">Powered by Open Payments.</span>
              </h1>
              <p className="text-sm text-[#D2D7DF]/85 leading-relaxed max-w-md">
                Accept R1 snacks and household staples via customer handles like{' '}
                <code className="text-[#38C3FF] font-mono-code">@lethabomorake</code>, issue
                digital change straight into UBU wallets, and settle directly to wholesalers at{' '}
                <strong className="text-white">R0.00 transaction fees</strong>.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-2xl bg-[#0F1735]/80 border border-white/10 p-3.5">
                <div className="text-[11px] text-[#9AA7C4]">Unit Peg</div>
                <div className="text-base font-bold text-white mt-0.5">1 UBU = R1</div>
              </div>
              <div className="rounded-2xl bg-[#0F1735]/80 border border-white/10 p-3.5">
                <div className="text-[11px] text-[#9AA7C4]">Micro Fee</div>
                <div className="text-base font-bold text-[#38E4AE] mt-0.5">R0.00</div>
              </div>
              <div className="rounded-2xl bg-[#0F1735]/80 border border-white/10 p-3.5">
                <div className="text-[11px] text-[#9AA7C4]">Rail Spec</div>
                <div className="text-base font-bold text-[#38C3FF] mt-0.5">ILP v1.0</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9AA7C4]">
            <span>Deep Navy #0F1735 · Cyber Blue #00A2E8</span>
            <span>SpazaUniti Core Engine · Port 8001</span>
          </div>
        </div>

        {/* Right Sign-In & 1-Click RBAC Presets */}
        <div className="lg:col-span-6 ubu-card-surface rounded-3xl p-7 md:p-9 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-[#00A2E8]/15 border border-[#00A2E8]/35 flex items-center justify-center text-[#00A2E8]">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Staff &amp; Unit Sign In</h2>
              </div>
            </div>
            <p className="text-xs text-[#9AA7C4] mb-6">
              Sign in with your UbuOne personnel username &amp; passcode, or select a demo RBAC role below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#D2D7DF] mb-1.5">
                  Staff Username
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. khumalo_owner"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D2D7DF] mb-1.5">
                  RBAC Passcode
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="4-digit PIN"
                    className="font-mono-code tracking-widest pr-10"
                    required
                  />
                  <KeyRound className="w-4 h-4 text-[#7F8CAE] absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {error && (
                <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs text-[#F46B78] font-medium">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 text-sm">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying RBAC Session...
                  </>
                ) : (
                  'Enter UbuOne Console'
                )}
              </Button>
            </form>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA7C4] mb-2.5">
              Instant RBAC Role Access (Hackathon Demo)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ROLES.map((d) => {
                const Icon = d.icon
                return (
                  <button
                    key={d.username}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setUsername(d.username)
                      setPasscode(d.passcode)
                      performLogin(d.username, d.passcode)
                    }}
                    className="text-left p-2.5 rounded-xl bg-[#18244B]/80 hover:bg-[#1E2E5E] border border-white/8 hover:border-[#00A2E8]/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white group-hover:text-[#38C3FF] truncate">
                        {d.name}
                      </span>
                      <Icon className="w-3.5 h-3.5 text-[#00A2E8] shrink-0" />
                    </div>
                    <div className="text-[10px] text-[#9AA7C4] mt-0.5 truncate">
                      {d.roleLabel} · {d.passcode}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

