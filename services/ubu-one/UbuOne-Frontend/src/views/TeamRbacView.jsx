import React, { useEffect, useState } from 'react'
import { BarChart3, Lock, Plus, ShieldCheck, UserPlus, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogHeader,
  Input,
  Switch,
} from '../components/ui/primitives'
import { createUnitStaff, fetchUnitStaff, toggleUnitStaff } from '../lib/api'
import { formatZAR, roleDisplayLabel } from '../lib/utils'

export function TeamRbacView({ unitId, overview, currentStaff, onRefresh, showToast }) {
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const [newUser, setNewUser] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('UNIT_CASHIER')
  const [newPass, setNewPass] = useState('')

  const loadStaff = async () => {
    setLoading(true)
    try {
      const list = await fetchUnitStaff(unitId)
      setStaffList(Array.isArray(list) ? list : [])
    } catch (err) {
      showToast?.(err.message || 'Could not load staff directory', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
  }, [unitId])

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await createUnitStaff(unitId, {
        username: newUser.trim(),
        full_name: newName.trim(),
        role: newRole,
        passcode: newPass.trim(),
      })
      showToast?.(`Added ${newName.trim()} (${roleDisplayLabel(newRole)})`, 'success')
      setAddOpen(false)
      setNewUser('')
      setNewName('')
      setNewPass('')
      loadStaff()
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Failed to add staff member', 'error')
    }
  }

  const handleToggle = async (member) => {
    try {
      await toggleUnitStaff(unitId, member.id)
      showToast?.(
        `${member.full_name} is now ${member.active ? 'SUSPENDED' : 'ACTIVE'}`,
        'info'
      )
      loadStaff()
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Could not update staff access', 'error')
    }
  }

  const metrics = overview?.metrics || {}
  const microCount = Number(metrics.micro_under_10_count || 0)
  const estimatedCardSavings = microCount * 0.85

  return (
    <div className="space-y-6">
      {/* UbuOne Micro-Moment Fee Economics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Active Till Personnel</span>
              <Users className="w-4 h-4 text-[#00A2E8]" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 tabular-nums">
              {staffList.filter((s) => s.active).length} / {staffList.length}
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              Scoped via X-UbuOne-Token RBAC
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Sub-R10 Counter Sales</span>
              <BarChart3 className="w-4 h-4 text-[#38E4AE]" />
            </div>
            <div className="text-2xl font-bold text-[#38E4AE] mt-2 tabular-nums">
              {microCount} R1-Moments
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              Processed without per-swipe card overhead
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Merchant Fees Avoided</span>
              <ShieldCheck className="w-4 h-4 text-[#38C3FF]" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 tabular-nums">
              {formatZAR(estimatedCardSavings)}
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              Retained by Unit instead of legacy card rails
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff RBAC Directory */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#00A2E8]" />
            <CardTitle>Personnel &amp; Role-Based Access Control</CardTitle>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Staff
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-6 text-xs text-[#9AA7C4]">Loading staff members...</div>
          ) : (
            staffList.map((member) => {
              const isSelf = member.id === currentStaff?.id
              return (
                <div
                  key={member.id}
                  className="p-4 rounded-xl bg-[#0F1735] border border-white/10 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#1B2A5A] border border-[#00A2E8]/30 flex items-center justify-center text-sm font-bold text-white">
                      {member.full_name
                        .split(' ')
                        .map((x) => x[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{member.full_name}</span>
                        <Badge variant={member.role === 'UNIT_OWNER' ? 'cyber' : 'default'}>
                          {roleDisplayLabel(member.role)}
                        </Badge>
                        {isSelf && <Badge variant="mint">You</Badge>}
                      </div>
                      <div className="text-xs text-[#9AA7C4] font-mono-code mt-0.5">
                        @{member.username} · {member.role === 'UNIT_CASHIER' ? 'Counter Till & Pacts Read-Only' : 'Full Unit Owner Permissions'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#9AA7C4]">
                      {member.active ? 'Enabled' : 'Suspended'}
                    </span>
                    <Switch
                      checked={member.active}
                      disabled={isSelf}
                      onChange={() => handleToggle(member)}
                      label={`Toggle ${member.full_name}`}
                    />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogHeader
          title="Onboard Unit Staff Member"
          subtitle="Provision a dedicated RBAC login for a till cashier or co-owner."
          onClose={() => setAddOpen(false)}
        />
        <form onSubmit={handleAdd} className="space-y-3.5">
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Full Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Neo Mokoena"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Username</label>
              <Input
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                placeholder="e.g. neo_cashier"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Passcode (PIN)</label>
              <Input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="4+ digits"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">RBAC Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full h-10 px-3 rounded-xl ubu-input-surface text-xs text-white"
            >
              <option value="UNIT_CASHIER" className="bg-[#0F1735]">Unit Cashier (Till Operations)</option>
              <option value="UNIT_OWNER" className="bg-[#0F1735]">Unit Owner (Full Store &amp; Settlements)</option>
            </select>
          </div>
          <Button type="submit" className="w-full">
            <UserPlus className="w-4 h-4" />
            Create RBAC Account
          </Button>
        </form>
      </Dialog>
    </div>
  )
}

