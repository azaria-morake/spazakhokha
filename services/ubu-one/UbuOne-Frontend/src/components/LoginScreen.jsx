import React, { useState } from 'react'
import {
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Store,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { UbuOneLogo, UbuOneOrbitalMark } from './UbuOneBrand'
import { Badge, Button, Dialog, DialogHeader, Input } from './ui/primitives'
import { loginConsumer, loginUbuOne, registerConsumerAccount } from '../lib/api'
import { cn } from '../lib/utils'

const FAMILY_PRESETS = [
  {
    username: 'morake_ext_5',
    pin: '1234',
    name: '@morake_ext_5',
    roleLabel: 'Family Head · FAMILY_ADMIN',
    icon: ShieldCheck,
  },
  {
    username: 'mannimorake',
    pin: '1234',
    name: 'Manni Morake',
    roleLabel: 'Spouse · FAMILY_ADMIN',
    icon: Users,
  },
  {
    username: 'azariamorake',
    pin: '1234',
    name: 'Azaria Morake Jr',
    roleLabel: 'Adult Son · FAMILY_MEMBER',
    icon: UserCheck,
  },
  {
    username: 'lethabomorake',
    pin: '1234',
    name: 'Lethabo Morake',
    roleLabel: 'School Child · R10/day Cap',
    icon: UserCheck,
  },
]

const ADULT_PRESETS = [
  {
    username: 'mannini',
    pin: '1234',
    name: 'Mannini Morake',
    roleLabel: '@mannini · Has Invite + UBU',
    icon: Wallet,
  },
  {
    username: 'sipho',
    pin: '1234',
    name: 'Sipho Ndlovu',
    roleLabel: '@sipho · Sponsor Wallet',
    icon: UserCheck,
  },
  {
    username: 'azaria',
    pin: '1234',
    name: 'Azaria Morake',
    roleLabel: '@azaria · Beneficiaries Active',
    icon: Users,
  },
  {
    username: 'lerato',
    pin: '1234',
    name: 'Lerato Mokoena',
    roleLabel: '@lerato · Individual Wallet',
    icon: Wallet,
  },
]

const STAFF_PRESETS = [
  {
    username: 'thabo_cashier',
    pin: '1111',
    name: 'Thabo Maseko',
    roleLabel: 'Unit Cashier · unit-104',
    icon: UserCheck,
  },
  {
    username: 'khumalo_owner',
    pin: '1040',
    name: 'Baba Khumalo',
    roleLabel: 'Unit Owner · unit-104',
    icon: Store,
  },
  {
    username: 'thandi_owner',
    pin: '1020',
    name: 'Mama Thandi Zulu',
    roleLabel: 'Unit Owner · unit-102',
    icon: ShieldCheck,
  },
  {
    username: 'uniti_admin',
    pin: '9999',
    name: 'SpazaUniti HQ',
    roleLabel: 'Network Admin · All Units',
    icon: Users,
  },
]

export function LoginScreen({ onStaffLogin, onConsumerLogin }) {
  const [realm, setRealm] = useState('family') // 'family' | 'adult' | 'staff'
  const [username, setUsername] = useState('morake_ext_5')
  const [passcode, setPasscode] = useState('1234')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Register new Family Vault / Adult Account modal
  const [regOpen, setRegOpen] = useState(false)
  const [regName, setRegName] = useState('')
  const [regHandle, setRegHandle] = useState('')
  const [regCell, setRegCell] = useState('0721112233')
  const [regPin, setRegPin] = useState('1234')
  const [regType, setRegType] = useState('INDIVIDUAL')
  const [regError, setRegError] = useState('')
  const [registering, setRegistering] = useState(false)

  const presets =
    realm === 'family'
      ? FAMILY_PRESETS
      : realm === 'adult'
        ? ADULT_PRESETS
        : STAFF_PRESETS

  const handleRealmChange = (nextRealm) => {
    setRealm(nextRealm)
    setError('')
    if (nextRealm === 'family') {
      setUsername('morake_ext_5')
      setPasscode('1234')
    } else if (nextRealm === 'adult') {
      setUsername('mannini')
      setPasscode('1234')
    } else {
      setUsername('khumalo_owner')
      setPasscode('1040')
    }
  }

  const executeLogin = async (u, p, activeRealm = realm) => {
    setError('')
    setLoading(true)
    try {
      if (activeRealm === 'staff') {
        const res = await loginUbuOne(u, p)
        onStaffLogin?.(res.staff)
      } else {
        const res = await loginConsumer(u, p)
        onConsumerLogin?.(res.actor, res.profile)
      }
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    executeLogin(username, passcode, realm)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegError('')
    setRegistering(true)
    try {
      const cleanHandle = regHandle.trim().replace(/^@+/, '').toLowerCase()
      await registerConsumerAccount({
        full_name: regName.trim(),
        username: cleanHandle,
        cell_number: regCell.trim(),
        pin: regPin.trim(),
        account_type: regType,
      })
      const logged = await loginConsumer(cleanHandle, regPin.trim())
      setRegOpen(false)
      onConsumerLogin?.(logged.actor, logged.profile)
    } catch (err) {
      setRegError(err.message || 'Could not register account')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0F1735] flex items-center justify-center p-4 md:p-8 overflow-hidden">
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
        {/* Left Brand Pillar Summary */}
        <div className="lg:col-span-5 ubu-card-surface rounded-3xl p-7 md:p-8 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute -right-14 -bottom-14 opacity-15 pointer-events-none">
            <UbuOneOrbitalMark className="w-72 h-72" />
          </div>

          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <UbuOneLogo size="lg" />
              <Badge variant="cyber">Unified RBAC</Badge>
            </div>

            <div className="space-y-3 pt-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
                Built for R1 Moments.
                <br />
                <span className="text-[#00A2E8]">Powered by Open Payments.</span>
              </h1>
              <p className="text-sm text-[#D2D7DF]/85 leading-relaxed">
                One platform linking <strong className="text-white">Family Vaults</strong> (`@morake_ext_5`),{' '}
                <strong className="text-white">Adult Wallets</strong> (`@mannini`), and{' '}
                <strong className="text-white">Spaza Units</strong> (`unit-104`) with instant role-based access control.
              </p>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="p-3 rounded-2xl bg-[#0F1735]/85 border border-white/10">
                <div className="font-bold text-[#38C3FF]">Family RBAC</div>
                <div className="text-[#9AA7C4] mt-0.5">
                  Co-Admins manage child UBU caps, categories &amp; freeze cards; Members spend safely up to daily limits.
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#0F1735]/85 border border-white/10">
                <div className="font-bold text-[#38E4AE]">Adult Accounts &amp; Beneficiaries</div>
                <div className="text-[#9AA7C4] mt-0.5">
                  Fund once, pay R1 moments across any Unit, invite &amp; sponsor girlfriends, siblings or elders.
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#0F1735]/85 border border-white/10">
                <div className="font-bold text-white">Spaza Units &amp; Staff</div>
                <div className="text-[#9AA7C4] mt-0.5">
                  Cashier counter tills, digital Change-in-UBU &amp; R0 wholesaler settlements.
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-5 mt-5 border-t border-white/10 flex items-center justify-between text-[11px] text-[#9AA7C4]">
            <span>1 UBU = R1.00 ZAR</span>
            <span>Engine Port 8001</span>
          </div>
        </div>

        {/* Right Sign-In & Role Presets */}
        <div className="lg:col-span-7 ubu-card-surface rounded-3xl p-7 md:p-8 flex flex-col justify-between">
          <div>
            {/* Segmented 3-Pillar Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0B1128] border border-white/10 mb-6">
              {[
                { id: 'family', label: 'Family RBAC' },
                { id: 'adult', label: 'Adult Account' },
                { id: 'staff', label: 'Unit Staff' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRealmChange(tab.id)}
                  className={cn(
                    'py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                    realm === tab.id
                      ? 'bg-[#00A2E8] text-white shadow-[0_4px_14px_rgba(0,162,232,0.45)]'
                      : 'text-[#9AA7C4] hover:text-white'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00A2E8]/15 border border-[#00A2E8]/35 flex items-center justify-center text-[#00A2E8]">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {realm === 'family'
                      ? 'Sign In to Family Vault'
                      : realm === 'adult'
                        ? 'Sign In to Adult Wallet'
                        : 'Sign In to Unit Terminal'}
                  </h2>
                  <p className="text-[11px] text-[#9AA7C4]">
                    {realm === 'staff'
                      ? 'Authenticated via X-UbuOne-Token Unit Operator RBAC'
                      : 'Authenticated via @handle + 4-digit PIN'}
                  </p>
                </div>
              </div>

              {realm !== 'staff' && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setRegType(realm === 'family' ? 'FAMILY' : 'INDIVIDUAL')
                    setRegOpen(true)
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New Account
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#D2D7DF] mb-1.5">
                    {realm === 'staff' ? 'Staff Username' : '@Handle'}
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={realm === 'family' ? 'morake_ext_5' : realm === 'adult' ? 'mannini' : 'khumalo_owner'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D2D7DF] mb-1.5">
                    {realm === 'staff' ? 'RBAC Passcode' : '4-Digit PIN'}
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="1234"
                      className="font-mono-code tracking-widest pr-10"
                      required
                    />
                    <KeyRound className="w-4 h-4 text-[#7F8CAE] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
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
                  'Enter UbuOne'
                )}
              </Button>
            </form>
          </div>

          {/* 1-Click Role Switch Presets */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA7C4] mb-2.5">
              Quick Demo Access ({realm === 'family' ? 'Family Roles' : realm === 'adult' ? 'Adult Handles' : 'Unit Staff Roles'})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((d) => {
                const Icon = d.icon
                return (
                  <button
                    key={d.username}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setUsername(d.username)
                      setPasscode(d.pin)
                      executeLogin(d.username, d.pin, realm)
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
                      {d.roleLabel} · PIN {d.pin}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Register New Family Vault or Adult Account Dialog */}
      <Dialog open={regOpen} onOpenChange={setRegOpen} maxWidth="max-w-md">
        <DialogHeader
          title="Register UbuOne Consumer Account"
          subtitle="Create a new Family Vault (@family_name) or an independent Adult wallet."
          onClose={() => setRegOpen(false)}
        />
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'INDIVIDUAL', label: 'Adult Account' },
              { id: 'FAMILY', label: 'Family Vault' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRegType(opt.id)}
                className={cn(
                  'py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer',
                  regType === opt.id
                    ? 'bg-[#00A2E8]/20 border-[#00A2E8] text-white'
                    : 'bg-[#17234B] border-white/10 text-[#9AA7C4]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Full Name / Household Name</label>
            <Input
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder={regType === 'FAMILY' ? 'e.g. Dlamini Ext 2 Vault' : 'e.g. Kagiso Mokoena'}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Desired @handle</label>
              <Input
                value={regHandle}
                onChange={(e) => setRegHandle(e.target.value)}
                placeholder={regType === 'FAMILY' ? 'dlamini_ext_2' : 'kagiso99'}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">4-Digit PIN</label>
              <Input
                type="password"
                maxLength={4}
                value={regPin}
                onChange={(e) => setRegPin(e.target.value)}
                className="font-mono-code tracking-widest"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Mobile Number</label>
            <Input
              value={regCell}
              onChange={(e) => setRegCell(e.target.value)}
              required
            />
          </div>
          {regError && (
            <div className="text-xs text-[#F46B78] bg-rose-500/15 border border-rose-400/25 rounded-lg p-2.5">
              {regError}
            </div>
          )}
          <Button type="submit" disabled={registering} className="w-full">
            {registering ? 'Creating Account...' : 'Create & Enter UbuOne'}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}
