import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import HomePage from './components/HomePage'
import SyncIndicator from './components/SyncIndicator'
import SeoManager from './components/SeoManager'
import { initStorage } from './utils/storage'
import { PAGE_TYPES_BY_ID } from './data/pageTypes'
import PublicWeddingDirectory from './components/PublicWeddingDirectory'
import { storageProfile } from './utils/storageProfiles'
import { adminPaths, siteAdminRequest } from './utils/siteAdministration'

const AdminLogin = lazy(() => import('./components/AdminLogin'))
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'))
const WizardForm = lazy(() => import('./components/Wizard/WizardForm'))
const EspaceClient = lazy(() => import('./components/EspaceClient/EspaceClient'))
const EspaceStaff = lazy(() => import('./components/EspaceStaff/EspaceStaff'))
const CityPage = lazy(() => import('./components/VillesPages/CityPage'))
const BlogListPage = lazy(() => import('./components/Blog/BlogListPage'))
const BlogArticlePage = lazy(() => import('./components/Blog/BlogArticlePage'))
const MentionsLegales = lazy(() => import('./components/Legal/MentionsLegales'))
const CGU = lazy(() => import('./components/Legal/CGU'))
const PolitiqueConfidentialite = lazy(() => import('./components/Legal/PolitiqueConfidentialite'))
const SpaceAccess = lazy(() => import('./components/SpaceAccess'))

// Redirect /villes/:citySlug → /locationsalledemariage/:citySlug (backward compat)
function LegacyVillesRedirect() {
  const { citySlug } = useParams()
  return <Navigate to={`/locationsalledemariage/${citySlug}`} replace />
}

function ProtectedDashboard() {
  const [verified, setVerified] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    siteAdminRequest().then(async () => {
      await initStorage({ names: ['settings'], reload: true, paced: false, persistDefaults: false })
      if (!cancelled) setVerified(true)
    }).catch(() => { if (!cancelled) { sessionStorage.removeItem('adminAuth'); setFailed(true) } })
    return () => { cancelled = true }
  }, [])
  if (failed) return <Navigate to={adminPaths().login} replace />
  if (!sessionStorage.getItem('adminAuth')) {
    return <Navigate to={adminPaths().login} replace />
  }
  if (!verified) return <p role="status">Vérification de l’accès…</p>
  return <Dashboard />
}

function AppContent() {
  const { pathname } = useLocation()
  const paths = adminPaths()
  const isAdmin = pathname === paths.login || pathname === paths.dashboard
  const [readyPath, setReadyPath] = useState('')
  const [error, setError] = useState('')
  const profile = storageProfile(pathname, paths)
  const waitsForStorage = pathname !== '/devis' && (!profile || profile.names.some((name) => name !== 'settings'))

  useEffect(() => {
    let cancelled = false
    initStorage(storageProfile(pathname, paths)).then(() => {
      if (!cancelled) { setError(''); setReadyPath(pathname) }
    }).catch((err) => {
      console.error('[Storage]', err)
      if (!cancelled) setError(err.message)
    })
    return () => { cancelled = true }
  }, [pathname])

  if (error) return <p role="alert">Chargement impossible : {error}</p>
  if (document.getElementById('site-maintenance') && pathname !== '/' && !isAdmin) {
    return <main><h1>Site en maintenance</h1><p>Seule la page d’accueil reste accessible.</p><a href="/">Retour à l’accueil</a></main>
  }
  if (readyPath !== pathname && waitsForStorage) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#c9a84c',
        fontSize: '18px',
        fontWeight: '600',
        gap: '12px',
      }}>
        <span style={{ fontSize: '28px' }}>⏳</span>
        Chargement…
      </div>
    )
  }

  return (
    <>
      <SeoManager settingsVersion={readyPath} />
      <PublicWeddingDirectory />
      <Suspense fallback={(
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#c9a84c',
          fontSize: '18px',
          fontWeight: '600',
          gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>⏳</span>
          Chargement…
        </div>
      )}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path={paths.login} element={<AdminLogin />} />
          <Route path={paths.dashboard} element={<ProtectedDashboard />} />
          <Route path="/devis" element={<WizardForm />} />
          <Route path="/espace-client" element={<SpaceAccess kind="client" />} />
          <Route path="/espace-staff" element={<SpaceAccess kind="staff" />} />
          <Route path="/espace-client/:devisId" element={<EspaceClient />} />
          <Route path="/espace-staff/:staffId" element={<EspaceStaff />} />
          {/* Legacy /villes/ redirect to mariage pages */}
          <Route path="/villes/:citySlug" element={<LegacyVillesRedirect />} />
          {/* City pages per type */}
          <Route path="/locationsalledemariage/:citySlug" element={<CityPage pageType={PAGE_TYPES_BY_ID['mariage']} />} />
          <Route path="/locationsalledereception/:citySlug" element={<CityPage pageType={PAGE_TYPES_BY_ID['reception']} />} />
          <Route path="/locationsalleanniversaire/:citySlug" element={<CityPage pageType={PAGE_TYPES_BY_ID['anniversaire']} />} />
          <Route path="/locationsallebapteme/:citySlug" element={<CityPage pageType={PAGE_TYPES_BY_ID['bapteme']} />} />
          <Route path="/locationsallefiancaille/:citySlug" element={<CityPage pageType={PAGE_TYPES_BY_ID['fiancaille']} />} />
          <Route path="/locationsalleseminaire/:citySlug" element={<CityPage pageType={PAGE_TYPES_BY_ID['seminaire']} />} />
          {/* Blog */}
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          {/* Legal */}
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/conditions-generales" element={<CGU />} />
          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
        </Routes>
      </Suspense>
      <SyncIndicator />
    </>
  )
}

function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

export default App
