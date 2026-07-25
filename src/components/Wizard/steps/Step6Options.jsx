import { getPrestations } from '../../../utils/storage'

export default function Step6Options({ data, onChange, onNext, onBack }) {
  const prestations = getPrestations()
  const selected = data.prestations || []

  function isSelected(id) {
    return selected.some((p) => p.id === id)
  }

  function toggle(presta) {
    if (isSelected(presta.id)) {
      onChange('prestations', selected.filter((p) => p.id !== presta.id))
    } else {
      onChange('prestations', [...selected, presta])
    }
  }

  const optionsTotal = selected.reduce((sum, p) => sum + (p.tarif || 0), 0)

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Options & Prestations</h2>
      <p className="text-muted mb-3">Ajoutez des prestations pour compléter votre événement</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {prestations.map((p) => {
          const sel = isSelected(p.id)
          return (
            <div
              key={p.id}
              onClick={() => toggle(p)}
              style={{
                border: sel ? '2px solid #c9a84c' : '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                background: sel ? '#fdf3d9' : 'white',
                transition: 'all 0.2s',
              }}
            >
              {p.photo ? (
                <img src={p.photo} alt={p.nomPresta} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
              ) : (
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🎵</div>
              )}
              <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px' }}>{p.nomPresta}</div>
              {p.description && <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>{p.description}</div>}
              <div style={{ fontWeight: '800', color: '#c9a84c', fontSize: '20px' }}>{p.tarif.toLocaleString('fr-FR')} €</div>
              <div style={{ fontSize: '12px', color: '#888' }}>forfait</div>
              {sel && <div style={{ color: '#b8860b', fontWeight: '600', fontSize: '13px', marginTop: '10px' }}>✅ Sélectionné</div>}
            </div>
          )
        })}
      </div>

      {selected.length === 0 && (
        <div style={{ textAlign: 'center', color: '#888', marginBottom: '16px' }}>
          <p>Aucune prestation sélectionnée — vous pouvez continuer sans</p>
        </div>
      )}

      {optionsTotal > 0 && (
        <div style={{ background: '#fdf3d9', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Total prestations sélectionnées</span>
            <strong style={{ color: '#c9a84c', fontSize: '20px' }}>{optionsTotal.toLocaleString('fr-FR')} € TTC</strong>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-outline" onClick={onBack}>← Retour</button>
        <button className="btn btn-primary btn-lg" onClick={onNext}>Suivant →</button>
      </div>
    </div>
  )
}
