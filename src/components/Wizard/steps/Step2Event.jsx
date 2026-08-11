import InlineCalendar from '../InlineCalendar'

export default function Step2Event({ data, onChange, onNext, onBack }) {
  const typeOptions = [
    'Anniversaire', 'Babyshower', 'Baptême', 'Fiançaille', 'Mariage', 'Autres'
  ]

  const nbAdultes = parseInt(data.nbAdultes) || 0
  const nbEnfants = parseInt(data.nbEnfants) || 0
  const totalPersonnes = nbAdultes + nbEnfants
  const overCapacity = totalPersonnes > 300

  function handleSubmit(e) {
    e.preventDefault()
    if (!data.typeEvenement || !data.dateEvenement || !nbAdultes) return
    if (overCapacity) return
    onChange('nbPersonnes', totalPersonnes)
    onNext()
  }

  function handleAdultesChange(e) {
    const val = parseInt(e.target.value) || ''
    onChange('nbAdultes', val)
    onChange('nbPersonnes', (parseInt(val) || 0) + nbEnfants)
  }

  function handleEnfantsChange(e) {
    const val = parseInt(e.target.value) || ''
    onChange('nbEnfants', val)
    onChange('nbPersonnes', nbAdultes + (parseInt(val) || 0))
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e', textAlign: 'center' }}>Personnaliser mon évènement</h2>
      <p className="text-muted mb-3" style={{ textAlign: 'center' }}>Renseignez les informations de votre événement</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type d&apos;évènement *</label>
          <select className="form-control" value={data.typeEvenement || ''} onChange={(e) => onChange('typeEvenement', e.target.value)} required>
            <option value="">-- Choisir --</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Date de l&apos;événement *</label>
          <InlineCalendar
            value={data.dateEvenement || ''}
            onChange={(dateStr) => onChange('dateEvenement', dateStr)}
            minDate={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label>Nombre d&apos;adultes *</label>
            <input
              type="number"
              className="form-control"
              value={data.nbAdultes || ''}
              onChange={(e) => handleAdultesChange(e)}
              min={1}
              max={300}
              required
            />
          </div>
          <div className="form-group">
            <label>Nombre d&apos;enfants</label>
            <input
              type="number"
              className="form-control"
              value={data.nbEnfants || ''}
              onChange={(e) => handleEnfantsChange(e)}
              min={0}
              max={300}
            />
          </div>
        </div>

        {overCapacity && (
          <div style={{ background: '#fff3f3', border: '1px solid #f5c6cb', borderRadius: '8px', padding: '10px 14px', color: '#721c24', fontSize: '13px', marginBottom: '12px' }}>
            ⚠️ La capacité maximum de la salle de réception est de 300 personnes
          </div>
        )}

        {totalPersonnes > 0 && !overCapacity && (
          <div style={{ background: '#f0f7ef', border: '1px solid #c3e6cb', borderRadius: '8px', padding: '10px 14px', color: '#155724', fontSize: '13px', marginBottom: '12px' }}>
            Total : {totalPersonnes} personne{totalPersonnes > 1 ? 's' : ''} ({nbAdultes} adulte{nbAdultes > 1 ? 's' : ''}{nbEnfants > 0 ? ` + ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}` : ''})
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label>Heure de début</label>
            <input type="time" className="form-control" value={data.heureDebut || ''} onChange={(e) => onChange('heureDebut', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Heure de fin</label>
            <input type="time" className="form-control" value={data.heureFin || ''} onChange={(e) => onChange('heureFin', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Informations complémentaires</label>
          <textarea
            className="form-control"
            rows={3}
            value={data.commentaire || ''}
            onChange={(e) => onChange('commentaire', e.target.value)}
            placeholder="Précisez vos besoins particuliers..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button type="button" className="btn btn-outline" onClick={onBack}>← Retour</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={overCapacity || !nbAdultes || !data.typeEvenement || !data.dateEvenement} style={{ opacity: (overCapacity || !nbAdultes || !data.typeEvenement || !data.dateEvenement) ? 0.5 : 1 }}>Suivant →</button>
        </div>
      </form>
    </div>
  )
}
