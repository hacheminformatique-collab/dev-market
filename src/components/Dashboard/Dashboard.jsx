import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { startAutoRefresh, stopAutoRefresh, onDataRefresh, offDataRefresh, refreshFromServer } from '../../utils/storage'
import MesInfosTab from './tabs/MesInfosTab'
import MotDePasseTab from './tabs/MotDePasseTab'
import FormuleSalleTab from './tabs/FormuleSalleTab'
import MenuTab from './tabs/MenuTab'
import GateauTab from './tabs/GateauTab'
import PrestationTab from './tabs/PrestationTab'
import ClientsTab from './tabs/ClientsTab'
import CalendarTab from './tabs/CalendarTab'
import StaffTab from './tabs/StaffTab'
import StockTab from './tabs/StockTab'
import MatieresTab from './tabs/MatieresTab'
import ComptabiliteTab from './tabs/ComptabiliteTab'
import PagesClientTab from './tabs/PagesClientTab'
import BlogTab from './tabs/BlogTab'
import BackupTab from './tabs/BackupTab'
import { PAGE_TYPES } from '../../data/pageTypes'

const TABS = [
  { id: 'clients',    icon: '👥', label: 'Clients & Devis' },
  { id: 'calendar',   icon: '📅', label: 'Calendrier' },
  { id: 'compta',     icon: '📊', label: 'Comptabilité' },
  { id: 'staff',      icon: '👷', label: 'Staff' },
  { id: 'stock',      icon: '📦', label: 'Stock' },
  { id: 'matieres',   icon: '🥩', label: 'Matières premières' },
  { id: 'formules',   icon: '🏛️', label: 'Formules' },
  { id: 'menus',      icon: '🍽️', label: 'Menus' },
  { id: 'gateaux',    icon: '🎂', label: 'Gâteaux' },
  { id: 'prestations',icon: '🎵', label: 'Prestations' },
  // ── City page types (one tab per type) ────────────────────────────────────
  ...PAGE_TYPES.map((pt) => ({ id: pt.dashboardId, icon: pt.icon, label: pt.label })),
  { id: 'blog',       icon: '📝', label: 'Blog' },
  { id: 'backup',     icon: '💾', label: 'Back-up' },
  { id: 'infos',      icon: '⚙️', label: 'Mes Infos' },
  { id: 'motdepasse', icon: '🔑', label: 'Code PIN' },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('clients')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => {
    const handleRefresh = () => setRefreshKey((k) => k + 1)
    onDataRefresh(handleRefresh)
    // Refresh immediately on mount so the UI is up-to-date without waiting for the first polling tick
    refreshFromServer()
    startAutoRefresh(1500)
    // Also refresh when the browser window regains focus (e.g. user switches back from phone)
    const handleFocus = () => refreshFromServer()
    window.addEventListener('focus', handleFocus)
    return () => {
      stopAutoRefresh()
      offDataRefresh(handleRefresh)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  function renderTab() {
    switch (activeTab) {
      case 'clients':     return <ClientsTab key={refreshKey} />
      case 'calendar':    return <CalendarTab key={refreshKey} />
      case 'compta':      return <ComptabiliteTab key={refreshKey} />
      case 'staff':       return <StaffTab key={refreshKey} />
      case 'stock':       return <StockTab key={refreshKey} />
      case 'matieres':    return <MatieresTab key={refreshKey} />
      case 'formules':    return <FormuleSalleTab key={refreshKey} />
      case 'menus':       return <MenuTab key={refreshKey} />
      case 'gateaux':     return <GateauTab key={refreshKey} />
      case 'prestations': return <PrestationTab key={refreshKey} />
      case 'infos':       return <MesInfosTab key={refreshKey} />
      case 'motdepasse':  return <MotDePasseTab key={refreshKey} />
      case 'blog':        return <BlogTab key={refreshKey} />
      case 'backup':      return <BackupTab key={refreshKey} />
      default: {
        // City page type tabs
        const pt = PAGE_TYPES.find((p) => p.dashboardId === activeTab)
        if (pt) return <PagesClientTab key={pt.id} pageType={pt} />
        return null
      }
    }
  }

  const activeTabDef = TABS.find((t) => t.id === activeTab)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--dark)',
        color: 'white',
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 2px 12px rgba(28,28,46,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Hamburger button — mobile only */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none', border: 'none', color: 'white',
                fontSize: '22px', cursor: 'pointer', padding: '4px 8px',
                lineHeight: 1, flexShrink: 0,
              }}
              aria-label="Ouvrir le menu"
            >
              ☰
            </button>
          )}
          {/* Gold ornament */}
          <div style={{ width: '2px', height: '32px', background: 'var(--gold)' }} />
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: '600',
              fontSize: '20px',
              color: 'var(--gold)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1.1,
            }}>
              Le Paradise
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Administration
            </div>
          </div>
        </div>

        <button
          onClick={() => { sessionStorage.removeItem('adminAuth'); navigate('/') }}
          className="btn btn-sm btn-ghost"
          style={{ letterSpacing: '0.08em' }}
        >
          Déconnexion
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── Mobile sidebar backdrop ───────────────────────────────────── */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(28,28,46,0.55)',
              zIndex: 200,
            }}
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <nav style={{
          width: '230px',
          background: 'var(--white)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto',
          padding: '16px 0',
          ...(isMobile ? {
            position: 'fixed',
            top: 0,
            left: sidebarOpen ? 0 : '-240px',
            height: '100%',
            zIndex: 300,
            transition: 'left 0.25s ease',
            boxShadow: sidebarOpen ? '4px 0 16px rgba(28,28,46,0.2)' : 'none',
          } : {}),
        }}>
          {/* Mobile sidebar close button */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 4px' }}>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-light)' }}
                aria-label="Fermer le menu"
              >
                ✕
              </button>
            </div>
          )}
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (isMobile) setSidebarOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '11px 20px',
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? 'var(--gold-pale)' : 'transparent',
                  color: isActive ? 'var(--gold)' : 'var(--text-light)',
                  fontWeight: isActive ? '700' : '400',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  letterSpacing: isActive ? '0.02em' : '0',
                  borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                  transition: 'all 0.15s',
                  borderRadius: '0 6px 6px 0',
                  marginRight: '8px',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = '#faf8f2'; e.currentTarget.style.color = 'var(--text)' } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-light)' } }}
              >
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px) clamp(16px, 3vw, 36px)', overflowY: 'auto', minWidth: 0 }}>
          {/* Page title */}
          <div style={{ marginBottom: '28px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '600', letterSpacing: '0.02em', color: 'var(--dark)' }}>
              {activeTabDef?.icon} {activeTabDef?.label}
            </h2>
          </div>
          {renderTab()}
        </main>
      </div>
    </div>
  )
}
