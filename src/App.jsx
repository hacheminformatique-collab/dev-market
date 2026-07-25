import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './components/HomePage'
import AdminLogin from './components/AdminLogin'
import Dashboard from './components/Dashboard/Dashboard'
import WizardForm from './components/Wizard/WizardForm'
import EspaceClient from './components/EspaceClient/EspaceClient'
import EspaceStaff from './components/EspaceStaff/EspaceStaff'
import SyncIndicator from './components/SyncIndicator'
import { initStorage } from './utils/storage'

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route path="/devis" element={<WizardForm />} />
        <Route path="/espace-client/:devisId" element={<EspaceClient />} />
        <Route path="/espace-staff/:staffId" element={<EspaceStaff />} />
      </Routes>
      <SyncIndicator />
    </BrowserRouter>
  )
}

export default App
