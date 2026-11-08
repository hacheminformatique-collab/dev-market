import { getFormules } from '../../../utils/storage'
import { getFormuleTarif as getSaisonTarif } from '../../../utils/formulePricing'

export { getFormuleTarif } from '../../../utils/formulePricing'

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
    const tarif = getSaisonTarif(dateStr, formule)
    if (tarif === null) return
    if (formule.id !== data.formule?.id || JSON.stringify(formule.inclusions) !== JSON.stringify(data.formule?.inclusions)) {
      onChange('menus', [])
      onChange('gateau', null)
      onChange('gateauPersonnalisation', null)
      onChange('prestations', [])
    }
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
          const tarif = getSaisonTarif(dateStr, f)
          const isSelected = data.formule?.id === f.id
          const isSec = f.nomFormule?.toLowerCase().includes('sèche')
          const tarifSec = dateStr ? getBasePriceSec(dateStr) : 0
          const remise = (!f.forfait && !isSec && dateStr && tarif !== null) ? (tarifSec - tarif) : 0
          return (
            <div
              key={f.id}
              onClick={() => handleSelect(f)}
              style={{
                border: isSelected ? '2px solid #c9a84c' : '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '24px',
                cursor: tarif === null ? 'not-allowed' : 'pointer',
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
                {tarif === null ? 'Tarif indisponible' : `${tarif.toLocaleString('fr-FR')} €`}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>{f.forfait ? 'Prix global TTC — choix inclus, sans supplément' : 'TTC'}</div>
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
          onClick={() => {
            handleSelect(formules.find((formule) => formule.id === data.formule.id) || data.formule)
            onNext()
          }}
          disabled={!data.formule || getSaisonTarif(dateStr, data.formule) === null}
          style={{ opacity: data.formule ? 1 : 0.5 }}
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}
