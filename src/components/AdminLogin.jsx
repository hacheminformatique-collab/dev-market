import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initStorage } from '../utils/storage'
import { adminPaths, siteAdminRequest } from '../utils/siteAdministration'

export default function AdminLogin() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await siteAdminRequest({ action: 'login', pin })
      await initStorage({ names: ['settings'], reload: true, paced: false, persistDefaults: false })
      sessionStorage.setItem('adminAuth', '1')
      navigate(adminPaths().dashboard)
    } catch (err) {
      setError(err.message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #14142a 0%, #1c1c3a 55%, #10101e 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(24px, 5vw, 48px) clamp(20px, 5vw, 40px)',
        maxWidth: '380px',
        width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        border: '1px solid var(--border-light)',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '8px', fontWeight: '700' }}>
            Administration
          </p>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            fontWeight: '500',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--dark)',
            marginBottom: '12px',
          }}>
            Le Paradise
          </h1>
          {/* Gold rule */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '1px', background: 'var(--gold)' }} />
            <div style={{ color: 'var(--gold)', fontSize: '12px' }}>✦</div>
            <div style={{ width: '40px', height: '1px', background: 'var(--gold)' }} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Code PIN</label>
            <input
              type="password"
              className="form-control"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={10}
              style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', padding: '14px' }}
              autoFocus
            />
          </div>

          {error && (
            <div style={{
              background: '#fef0ef',
              border: '1px solid #fad5d3',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-100" style={{ justifyContent: 'center', padding: '13px', fontSize: '13px', marginTop: '4px' }}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          style={{
            display: 'block', margin: '20px auto 0', background: 'none', border: 'none',
            color: 'var(--text-light)', cursor: 'pointer', fontSize: '13px',
            fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
          }}
        >
          ← Retour à l&apos;accueil
        </button>
      </div>
    </div>
  )
}
