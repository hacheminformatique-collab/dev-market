import { useState } from 'react'
import { getSettings, saveSettings } from '../../../utils/storage'

export default function MotDePasseTab() {
  const [current, setCurrent] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    const settings = getSettings()
    if (current !== settings.pin) {
      setMsg({ type: 'error', text: 'Code PIN actuel incorrect.' })
      return
    }
    if (newPin.length < 4) {
      setMsg({ type: 'error', text: 'Le nouveau PIN doit contenir au moins 4 caractères.' })
      return
    }
    if (newPin !== confirm) {
      setMsg({ type: 'error', text: 'Les codes PIN ne correspondent pas.' })
      return
    }
    saveSettings({ ...settings, pin: newPin })
    setMsg({ type: 'success', text: 'Code PIN modifié avec succès !' })
    setCurrent(''); setNewPin(''); setConfirm('')
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', color: '#1a1a2e' }}>Changer le code PIN</h3>
      <div className="card" style={{ maxWidth: '400px' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Code PIN actuel</label>
            <input type="password" className="form-control" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Nouveau code PIN</label>
            <input type="password" className="form-control" value={newPin} onChange={(e) => setNewPin(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirmer le nouveau code PIN</label>
            <input type="password" className="form-control" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
              background: msg.type === 'success' ? '#d4edda' : '#f8d7da',
              color: msg.type === 'success' ? '#155724' : '#721c24',
            }}>
              {msg.type === 'success' ? '✅' : '⚠️'} {msg.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary">Modifier le PIN</button>
        </form>
      </div>
    </div>
  )
}
