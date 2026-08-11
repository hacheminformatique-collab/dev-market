import { getFormules } from '../../../utils/storage'

function getSaisonTarif(dateStr, formuleNom) {
  if (!dateStr) return 0
  const date = new Date(dateStr)
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDay() // 0=dim, 1=lun, ..., 5=ven, 6=sam

  // Note: getMonth() returns 0-11, so December = 11, January = 0, etc.
  const isBasSaison = month === 12 || month <= 3
  const isSec = formuleNom && formuleNom.toLowerCase().includes('sèche')

  if (isBasSaison) {
    if (day === 5) return isSec ? 2500 : 1500  // vendredi
    if (day === 6) return isSec ? 3500 : 2500  // samedi
    return isSec ? 2000 : 1000                  // dim-jeudi
  } else {
    if (day === 5) return isSec ? 3500 : 2500  // vendredi
    if (day === 6) return isSec ? 4500 : 3000  // samedi
    return isSec ? 2500 : 1500                  // dim-jeudi
  }
}

export function getFormuleTarif(dateStr, formuleNom) {
  return getSaisonTarif(dateStr, formuleNom)
}

function getBasePriceSec(dateStr) {
  return getSaisonTarif(dateStr, 'Location sèche')
}

export default function Step3Formule({ data, onChange, onNext, onBack }) {
  const formules = getFormules()
  const dateStr = data.dateEvenement

  function getSaisonLabel() {
    if (!dateStr) return ''
    const month = new Date(dateStr).getMonth() + 1
    return (month >= 12 || month <= 3) ? '🌧️ Basse saison (déc–mars)' : '☀️ Haute saison (avr–nov)'
  }

  function getDayLabel() {
    if (!dateStr) return ''
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    return days[new Date(dateStr).getDay()]
  }

  function handleSelect(formule) {
    const tarif = getSaisonTarif(dateStr, formule.nomFormule)
    onChange('formule', formule)
    onChange('prixSalle', tarif)
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Choisir une formule</h2>
      {dateStr && (
        <p className="text-muted mb-3">
          {getSaisonLabel()} — {getDayLabel()} {new Date(dateStr).toLocaleDateString('fr-FR')}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {formules.map((f) => {
          const tarif = getSaisonTarif(dateStr, f.nomFormule)
          const isSelected = data.formule?.id === f.id
          const isSec = f.nomFormule?.toLowerCase().includes('sèche')
          const tarifSec = dateStr ? getBasePriceSec(dateStr) : 0
          const remise = (!isSec && dateStr) ? (tarifSec - tarif) : 0
          return (
            <div
              key={f.id}
              onClick={() => handleSelect(f)}
              style={{
                border: isSelected ? '2px solid #c9a84c' : '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '24px',
                cursor: 'pointer',
                background: isSelected ? '#fdf3d9' : 'white',
                transition: 'all 0.2s',
              }}
            >
              {f.photo ? (
                <img src={f.photo} alt={f.nomFormule} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />
              ) : (
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏛️</div>
              )}
              <h3 style={{ color: '#1a1a2e', marginBottom: '8px' }}>{f.nomFormule}</h3>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: '16px' }}>{f.contenuFormule}</p>
              {dateStr && remise > 0 ? (
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', color: '#888', textDecoration: 'line-through' }}>
                    Tarif de base : {tarifSec.toLocaleString('fr-FR')} €
                  </div>
                  <div style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600' }}>
                    🏷️ Remise prestation : -{remise.toLocaleString('fr-FR')} €
                  </div>
                </div>
              ) : null}
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#c9a84c' }}>
                {dateStr ? `${tarif.toLocaleString('fr-FR')} €` : '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>TTC</div>
              {isSelected && (
                <div style={{ marginTop: '12px', color: '#b8860b', fontWeight: '600', fontSize: '13px' }}>
                  ✅ Sélectionnée
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!dateStr && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '12px 16px', color: '#856404', marginBottom: '16px' }}>
          ⚠️ Veuillez d&apos;abord choisir une date pour voir les tarifs.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <button className="btn btn-outline" onClick={onBack}>← Retour</button>
        <button
          className="btn btn-primary btn-lg"
          onClick={onNext}
          disabled={!data.formule}
          style={{ opacity: data.formule ? 1 : 0.5 }}
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}
