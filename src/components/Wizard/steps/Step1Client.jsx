export default function Step1Client({ data, onChange, onNext }) {
  function handleSubmit(e) {
    e.preventDefault()
    if (!data.nom || !data.prenom || !data.email || !data.telephone) return
    onNext()
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Vos coordonnées</h2>
      <p className="text-muted mb-3">Veuillez renseigner vos informations personnelles</p>

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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary btn-lg">
            Suivant →
          </button>
        </div>
      </form>
    </div>
  )
}
