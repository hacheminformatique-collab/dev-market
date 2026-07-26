import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import HomePage from './components/HomePage'
import SyncIndicator from './components/SyncIndicator'
import SeoManager from './components/SeoManager'
import { initStorage } from './utils/storage'
import { PAGE_TYPES_BY_ID } from './data/pageTypes'

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

// Redirect /villes/:citySlug → /locationsalledemariage/:citySlug (backward compat)
function LegacyVillesRedirect() {
  const { citySlug } = useParams()
  return <Navigate to={`/locationsalledemariage/${citySlug}`} replace />
}

function ProtectedDashboard() {
  if (!sessionStorage.getItem('adminAuth')) {
    return <Navigate to="/admin" replace />
  }
  return <Dashboard />
}

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initStorage().then(() => setReady(true))
  }, [])

  if (!ready) {
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
    <BrowserRouter>
      <SeoManager />
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
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/dashboard" element={<ProtectedDashboard />} />
          <Route path="/devis" element={<WizardForm />} />
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
    </BrowserRouter>
  )
}

export default App
