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
import { ConsumerOverviewView } from './views/ConsumerOverviewView'
import { FamilyRbacView } from './views/FamilyRbacView'
import { AdultBeneficiariesView } from './views/AdultBeneficiariesView'
import {
  ConsumerLoadPoolView,
  ConsumerPayUnitView,
} from './views/ConsumerPayAndLoadView'
import {
  fetchAdminOverview,
  fetchConsumerMe,
  fetchConsumerWorkspace,
  fetchFamilyOverview,
  fetchMe,
  fetchUnitOverview,
  getStoredSessionType,
  getStoredToken,
  logoutConsumer,
  logoutUbuOne,
} from './lib/api'

export default function App() {
  const [sessionType, setSessionType] = useState(null) // 'STAFF' | 'CONSUMER'
  const [staff, setStaff] = useState(null)
  const [consumerActor, setConsumerActor] = useState(null)
  const [consumerWorkspace, setConsumerWorkspace] = useState(null)
  const [familyOverview, setFamilyOverview] = useState(null)

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

  // Restore RBAC token session (Staff or Consumer/Family) on boot
  useEffect(() => {
    async function restoreSession() {
      if (!getStoredToken()) {
        setBooting(false)
        return
      }
      const sType = getStoredSessionType()
      try {
        if (sType === 'CONSUMER') {
          const data = await fetchConsumerMe()
          setSessionType('CONSUMER')
          setConsumerActor(data.actor)
        } else {
          const me = await fetchMe()
          setSessionType('STAFF')
          setStaff(me)
          setUnitId(me.unit_id || 'unit-104')
        }
      } catch {
        await logoutUbuOne()
        await logoutConsumer()
        setSessionType(null)
        setStaff(null)
        setConsumerActor(null)
      } finally {
        setBooting(false)
      }
    }
    restoreSession()
  }, [])

  const syncStaffWorkspace = useCallback(
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
          setSessionType(null)
        } else {
          showToast(err.message || 'Could not load unit metrics', 'error')
        }
      }
    },
    [unitId, staff, showToast]
  )

  const syncConsumerWorkspace = useCallback(
    async (activeActor = consumerActor) => {
      if (!activeActor) return
      try {
        // Re-fetch live role + workspace + family overview (if linked)
        const [meData, ws] = await Promise.all([
          fetchConsumerMe(),
          fetchConsumerWorkspace(activeActor.username),
        ])
        setConsumerActor(meData.actor)
        setConsumerWorkspace(ws)

        if (meData.actor.family_vault_username) {
          const famOv = await fetchFamilyOverview(meData.actor.family_vault_username)
          setFamilyOverview(famOv)
        } else {
          setFamilyOverview(null)
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          await logoutConsumer()
          setConsumerActor(null)
          setSessionType(null)
          showToast(err.message || 'Session ended', 'error')
        } else {
          showToast(err.message || 'Could not sync consumer workspace', 'error')
        }
      }
    },
    [consumerActor, showToast]
  )

  useEffect(() => {
    if (sessionType === 'STAFF' && staff) {
      syncStaffWorkspace(unitId, staff)
    } else if (sessionType === 'CONSUMER' && consumerActor) {
      syncConsumerWorkspace(consumerActor)
    }
  }, [sessionType, staff?.username, unitId, consumerActor?.username])

  const handleStaffLogin = (loggedStaff) => {
    setSessionType('STAFF')
    setStaff(loggedStaff)
    setConsumerActor(null)
    setUnitId(loggedStaff.unit_id || 'unit-104')
    setActiveTab('overview')
    showToast(`Signed in as ${loggedStaff.full_name}`, 'success')
  }

  const handleConsumerLogin = (actor, profile) => {
    setSessionType('CONSUMER')
    setConsumerActor(actor)
    setStaff(null)
    setConsumerWorkspace({ profile, ledger: [], transactions: [], units: [] })
    setActiveTab('overview')
    showToast(`Signed in as @${actor.username}`, 'success')
  }

  const handleLogout = async () => {
    if (sessionType === 'CONSUMER') {
      await logoutConsumer()
    } else {
      await logoutUbuOne()
    }
    setSessionType(null)
    setStaff(null)
    setConsumerActor(null)
    setOverview(null)
    setAdminOverview(null)
    setConsumerWorkspace(null)
    setFamilyOverview(null)
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[#0F1735] flex items-center justify-center gap-3 text-sm text-[#D2D7DF]">
        <Loader2 className="w-5 h-5 animate-spin text-[#00A2E8]" />
        Restoring UbuOne RBAC Session...
      </div>
    )
  }

  if (!sessionType || (!staff && !consumerActor)) {
    return (
      <LoginScreen
        onStaffLogin={handleStaffLogin}
        onConsumerLogin={handleConsumerLogin}
      />
    )
  }

  const activeActor = sessionType === 'STAFF' ? staff : consumerActor
  const isOwnerOrAdmin =
    sessionType === 'STAFF' &&
    (staff?.role === 'UNIT_OWNER' || staff?.role === 'NETWORK_ADMIN')

  const pendingInvitesCount =
    sessionType === 'CONSUMER'
      ? Number(consumerWorkspace?.profile?.pending_invitations_count || 0)
      : 0

  const topLedger =
    sessionType === 'STAFF'
      ? overview?.ledger || []
      : consumerActor?.consumer_role === 'FAMILY_ADMIN'
        ? familyOverview?.ledger || []
        : consumerWorkspace?.ledger || []

  const contextTitle =
    sessionType === 'STAFF'
      ? overview?.unit_name || staff?.unit_name || 'Spaza Unit'
      : consumerActor?.family_vault_username
        ? `@${consumerActor.family_vault_username} Vault`
        : consumerActor?.full_name || `@${consumerActor?.username}`

  const contextSub =
    sessionType === 'STAFF'
      ? `Node: ${overview?.unit_id || unitId}`
      : `Handle: @${consumerActor?.username}`

  return (
    <div className="min-h-screen bg-[#0F1735] text-white flex">
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

      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sessionType={sessionType}
        actor={activeActor}
        contextTitle={contextTitle}
        contextSub={contextSub}
        pendingInvitesCount={pendingInvitesCount}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          sessionType={sessionType}
          actor={activeActor}
          contextLabel={contextTitle}
          unitId={overview?.unit_id || unitId}
          broadcastEnabled={sessionType === 'STAFF' ? overview?.broadcast_enabled ?? true : true}
          ledger={topLedger}
          availableUnits={adminOverview?.units || []}
          pendingInvitesCount={pendingInvitesCount}
          onSelectUnit={(nextUnitId) => setUnitId(nextUnitId)}
          onSelectConsumerHandle={(handle) => {
            setPrefillHandle(handle)
            if (sessionType === 'STAFF') {
              showToast(`Loaded @${handle} into Counter Till`, 'info')
            } else {
              setActiveTab('beneficiaries')
              showToast(`Selected @${handle} under Beneficiaries`, 'info')
            }
          }}
          onSelectTab={setActiveTab}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-5 md:p-7 max-w-[1440px] w-full mx-auto">
          {/* STAFF PORTAL VIEWS */}
          {sessionType === 'STAFF' && activeTab === 'overview' && (
            <OverviewView
              overview={overview}
              unitId={overview?.unit_id || unitId}
              prefillHandle={prefillHandle}
              onRefresh={() => syncStaffWorkspace(unitId, staff)}
              showToast={showToast}
              onNavigateTab={setActiveTab}
            />
          )}

          {sessionType === 'STAFF' && activeTab === 'till' && (
            <CounterTillView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              prefillHandle={prefillHandle}
              onRefresh={() => syncStaffWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {sessionType === 'STAFF' && activeTab === 'pacts' && (
            <PactsPromosView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              staff={staff}
              onRefresh={() => syncStaffWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {sessionType === 'STAFF' && activeTab === 'settlements' && isOwnerOrAdmin && (
            <SettlementsView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              onRefresh={() => syncStaffWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {sessionType === 'STAFF' && activeTab === 'team' && isOwnerOrAdmin && (
            <TeamRbacView
              unitId={overview?.unit_id || unitId}
              overview={overview}
              currentStaff={staff}
              onRefresh={() => syncStaffWorkspace(unitId, staff)}
              showToast={showToast}
            />
          )}

          {sessionType === 'STAFF' && activeTab === 'network' && staff?.role === 'NETWORK_ADMIN' && (
            <NetworkHubView
              adminOverview={adminOverview}
              currentUnitId={unitId}
              onSelectUnit={(nextId, jumpOverview) => {
                setUnitId(nextId)
                if (jumpOverview) setActiveTab('overview')
              }}
            />
          )}

          {/* CONSUMER / FAMILY RBAC / ADULT VIEWS */}
          {sessionType === 'CONSUMER' && activeTab === 'overview' && (
            <ConsumerOverviewView
              actor={consumerActor}
              workspace={consumerWorkspace}
              familyOverview={familyOverview}
              onRefresh={() => syncConsumerWorkspace(consumerActor)}
              showToast={showToast}
              onNavigateTab={setActiveTab}
            />
          )}

          {sessionType === 'CONSUMER' && activeTab === 'pay' && (
            <ConsumerPayUnitView
              actor={consumerActor}
              workspace={consumerWorkspace}
              onRefresh={() => syncConsumerWorkspace(consumerActor)}
              showToast={showToast}
            />
          )}

          {sessionType === 'CONSUMER' && activeTab === 'family_rbac' && (
            <FamilyRbacView
              actor={consumerActor}
              familyOverview={familyOverview}
              workspace={consumerWorkspace}
              onRefresh={() => syncConsumerWorkspace(consumerActor)}
              showToast={showToast}
            />
          )}

          {sessionType === 'CONSUMER' && activeTab === 'beneficiaries' && (
            <AdultBeneficiariesView
              actor={consumerActor}
              workspace={consumerWorkspace}
              prefillHandle={prefillHandle}
              onRefresh={() => syncConsumerWorkspace(consumerActor)}
              showToast={showToast}
            />
          )}

          {sessionType === 'CONSUMER' && activeTab === 'load' && (
            <ConsumerLoadPoolView
              actor={consumerActor}
              familyOverview={familyOverview}
              workspace={consumerWorkspace}
              onRefresh={() => syncConsumerWorkspace(consumerActor)}
              showToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              sessionType={sessionType}
              actor={activeActor}
              overview={overview}
              workspace={consumerWorkspace}
              unitId={unitId}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  )
}
