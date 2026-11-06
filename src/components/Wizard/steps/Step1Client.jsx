import { useState } from 'react'

export default function Step1Client({ data, onChange, onNext, conditionsAccepted, onConditionsChange }) {
  const [conditionsError, setConditionsError] = useState('')
  const [validationError, setValidationError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!data.nom?.trim() || !data.prenom?.trim() || !data.telephone?.trim()) {
      setValidationError('Veuillez renseigner votre prénom, votre nom et votre téléphone.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email?.trim() || '')) {
      setValidationError('Veuillez renseigner une adresse e-mail valide.')
      return
    }
    setValidationError('')
    if (!conditionsAccepted) {
      setConditionsError('Veuillez accepter les conditions générales pour continuer.')
      return
    }
    setConditionsError('')
    onNext()
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Vos coordonnées</h2>
      <p className="text-muted mb-3">Veuillez renseigner vos informations personnelles</p>

      {validationError && <p role="alert" style={{ color: '#c0392b', fontSize: '13px' }}>{validationError}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label>Prénom *</label>
            <input className="form-control" value={data.prenom || ''} onChange={(e) => onChange('prenom', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Nom *</label>
            <input className="form-control" value={data.nom || ''} onChange={(e) => onChange('nom', e.target.value)} required />
          </div>
        </div>
        <div className="form-group">
          <label>Email *</label>
          <input type="email" className="form-control" value={data.email || ''} onChange={(e) => onChange('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Téléphone *</label>
          <input type="tel" className="form-control" value={data.telephone || ''} onChange={(e) => onChange('telephone', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Adresse</label>
          <input className="form-control" value={data.adresse || ''} onChange={(e) => onChange('adresse', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          <div className="form-group">
            <label>Code postal</label>
            <input className="form-control" value={data.codePostal || ''} onChange={(e) => onChange('codePostal', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Ville</label>
            <input className="form-control" value={data.ville || ''} onChange={(e) => onChange('ville', e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontWeight: '400', lineHeight: '1.5' }}>
            <input
              type="checkbox"
              checked={conditionsAccepted}
              onChange={(e) => {
                onConditionsChange(e.target.checked)
                if (e.target.checked) setConditionsError('')
              }}
              style={{ marginTop: '4px' }}
            />
            <span>
              J’accepte les <a href="/conditions-generales" style={{ color: '#b8860b' }}>conditions générales d’utilisation</a>.
            </span>
          </label>
          {conditionsError && <p role="alert" style={{ color: '#c0392b', fontSize: '13px', marginTop: '6px' }}>{conditionsError}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary btn-lg">
            Suivant →
          </button>
        </div>
      </form>
    </div>
  )
}
