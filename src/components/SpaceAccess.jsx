import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, getStaff } from '../utils/storage'
import PublicHeader from './PublicHeader'

export default function SpaceAccess({ kind }) {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const staff = kind === 'staff'
  function submit(event) {
    event.preventDefault()
    const id = identifier.trim()
    if (!id) { setError(staff ? 'Veuillez saisir votre matricule.' : 'Veuillez saisir votre numéro de devis.'); return }
    if (!staff) { navigate(`/espace-client/${encodeURIComponent(id)}`); return }
    const member = getStaff().find((item) => item.matricule === id)
    if (!member || pin !== (member.pin || '1234')) { setError('Matricule ou code PIN incorrect.'); return }
    sessionStorage.setItem(`staffAuth_${member.id}`, '1')
    navigate(`/espace-staff/${encodeURIComponent(member.id)}`)
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <PublicHeader businessName={getSettings().nom} />
      <main style={{ maxWidth: 440, margin: '48px auto', padding: 24 }}>
        <h1>Espace {staff ? 'staff' : 'client'}</h1>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="space-identifier">{staff ? 'Matricule' : 'Numéro de devis'}</label>
            <input id="space-identifier" className="form-control" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" />
          </div>
          {staff && <div className="form-group">
            <label htmlFor="space-pin">Code PIN</label>
            <input id="space-pin" type="password" className="form-control" value={pin} onChange={(event) => setPin(event.target.value)} required autoComplete="current-password" />
          </div>}
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary">Accéder à mon espace</button>
        </form>
      </main>
    </div>
  )
}
