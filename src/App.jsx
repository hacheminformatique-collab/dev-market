import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './components/HomePage'
import SyncIndicator from './components/SyncIndicator'
import SeoManager from './components/SeoManager'
import { initStorage } from './utils/storage'

const AdminLogin = lazy(() => import('./components/AdminLogin'))
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'))
const WizardForm = lazy(() => import('./components/Wizard/WizardForm'))
const EspaceClient = lazy(() => import('./components/EspaceClient/EspaceClient'))
const EspaceStaff = lazy(() => import('./components/EspaceStaff/EspaceStaff'))
const CityPage = lazy(() => import('./components/VillesPages/CityPage'))

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
          <Route path="/villes/:citySlug" element={<CityPage />} />
        </Routes>
      </Suspense>
      <SyncIndicator />
    </BrowserRouter>
  )
}

export default App
