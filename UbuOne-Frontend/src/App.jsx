import React, { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { LoginScreen } from './components/LoginScreen'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { OverviewView } from './views/OverviewView'
import { CounterTillView } from './views/CounterTillView'
import { PactsPromosView } from './views/PactsPromosView'
import { SettlementsView } from './views/SettlementsView'
import { TeamRbacView } from './views/TeamRbacView'
import { NetworkHubView } from './views/NetworkHubView'
import { SettingsView } from './views/SettingsView'
import {
  fetchAdminOverview,
  fetchMe,
  fetchUnitOverview,
  getStoredToken,
  logoutUbuOne,
} from './lib/api'

export default function App() {
  const [staff, setStaff] = useState(null)
  const [booting, setBooting] = useState(true)
  const [unitId, setUnitId] = useState('unit-104')
  const [activeTab, setActiveTab] = useState('overview')

  const [overview, setOverview] = useState(null)
  const [adminOverview, setAdminOverview] = useState(null)
  const [prefillHandle, setPrefillHandle] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3800)
  }, [])

  // Restore RBAC token session on initial load
  useEffect(() => {
    async function restoreSession() {
      if (!getStoredToken()) {
        setBooting(false)
        return
      }
      try {
        const me = await fetchMe()
        setStaff(me)
        setUnitId(me.unit_id || 'unit-104')
      } catch {
        await logoutUbuOne()
        setStaff(null)
      } finally {
        setBooting(false)
      }
    }
    restoreSession()
  }, [])

  const syncWorkspace = useCallback(
    async (targetUnitId = unitId, activeStaff = staff) => {
      if (!activeStaff) return
      const effectiveUnit =
        activeStaff.role === 'NETWORK_ADMIN'
          ? targetUnitId
          : activeStaff.unit_id || 'unit-104'

      try {
        const ov = await fetchUnitOverview(effectiveUnit)
        setOverview(ov)
        if (activeStaff.role === 'NETWORK_ADMIN') {
          const adm = await fetchAdminOverview().catch(() => null)
          setAdminOverview(adm)
        }
      } catch (err) {
        if (err.status === 401) {
          await logoutUbuOne()
          setStaff(null)
        } else {
          showToast(err.message || 'Could not load unit metrics', 'error')
        }
      }
    },
    [unitId, staff, showToast]
  )

  useEffect(() => {
    if (staff) {
      syncWorkspace(unitId, staff)
    }
  }, [staff, unitId, syncWorkspace])

  const handleLoginSuccess = (loggedStaff) => {
    setStaff(loggedStaff)
    setUnitId(loggedStaff.unit_id || 'unit-104')
    setActiveTab('overview')
    showToast(`Signed in as ${loggedStaff.full_name}`, 'success')
  }

  const handleLogout = async () => {
    await logoutUbuOne()
    setStaff(null)
    setOverview(null)
    setAdminOverview(null)
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[#0F1735] flex items-center justify-center gap-3 text-sm text-[#D2D7DF]">
        <Loader2 className="w-5 h-5 animate-spin text-[#00A2E8]" />
        Restoring UbuOne RBAC Session...
      </div>
    )
  }

  if (!staff) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />
  }

  const isOwnerOrAdmin =
    staff.role === 'UNIT_OWNER' || staff.role === 'NETWORK_ADMIN'

  return (
    <div className="min-h-screen bg-[#0F1735] text-white flex">
      {/* Persistent Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-[#0C2636] border-[#38E4AE]/40 text-[#38E4AE]'
              : toast.type === 'error'
                ? 'bg-[#2B1222] border-[#F46B78]/40 text-[#F46B78]'
                : 'bg-[#121D42] border-[#00A2E8]/40 text-[#38C3FF]'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        staff={staff}
        unitName={overview?.unit_name || staff.unit_name}
        unitId={overview?.unit_id || unitId}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Right Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          unitName={overview?.unit_name || staff.unit_name}
          unitId={overview?.unit_id || unitId}
          staff={staff}
          broadcastEnabled={overview?.broadcast_enabled ?? true}
          ledger={overview?.ledger || []}
          availableUnits={adminOverview?.units || []}
          onSelectUnit={(nextUnitId) => setUnitId(nextUnitId)}
          onSelectConsumerHandle={(handle) => {
            setPrefillHandle(handle)
            showToast(`Loaded @${handle} into Counter Till`, 'info')
          }}
          onSelectTab={setActiveTab}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-5 md:p-7 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              overview={overview}
              unitId={overview?.unit_id || unitId}
              prefillHandle={prefillHandle}
              onRefresh={() => syncWorkspace(unitId, staff)}
              showToast={showToast}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'till' && (
            <CounterTillView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              prefillHandle={prefillHandle}
              onRefresh={() => syncWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {activeTab === 'pacts' && (
            <PactsPromosView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              staff={staff}
              onRefresh={() => syncWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {activeTab === 'settlements' && isOwnerOrAdmin && (
            <SettlementsView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              onRefresh={() => syncWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {activeTab === 'team' && isOwnerOrAdmin && (
            <TeamRbacView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              currentStaff={staff}
              onRefresh={() => syncWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {activeTab === 'network' && staff.role === 'NETWORK_ADMIN' && (
            <NetworkHubView
              adminOverview={adminOverview}
              currentUnitId={unitId}
              onSelectUnit={(nextId, jumpOverview) => {
                setUnitId(nextId)
                if (jumpOverview) setActiveTab('overview')
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              staff={staff}
              overview={overview}
              unitId={unitId}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  )
}

