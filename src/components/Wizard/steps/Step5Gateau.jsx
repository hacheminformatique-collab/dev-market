import { useState } from 'react'
import { getGateaux } from '../../../utils/storage'

const GOUT_OPTIONS = ['Chocolat', 'Fruit', 'Fraise', 'Caramel spéculoos']

function GateauPopup({ gateau, personalisation, onValidate, onClose }) {
  const [niv2, setNiv2] = useState(personalisation?.niv2 || GOUT_OPTIONS[0])
  const [niv3, setNiv3] = useState(personalisation?.niv3 || GOUT_OPTIONS[0])
  const [niv4, setNiv4] = useState(personalisation?.niv4 || GOUT_OPTIONS[0])
  const [initiales, setInitiales] = useState(personalisation?.initiales || '')

  function handleValidate() {
    onValidate({ niv2, niv3, niv4, initiales })
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '480px' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">🎂 {gateau.nomGateau}</h3>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Personnalisez votre gâteau en choisissant les goûts de chaque niveau.</p>

        <div className="form-group">
          <label>Niveau 1</label>
          <div style={{ padding: '10px 14px', background: '#f8f5f0', borderRadius: '8px', fontSize: '14px', color: '#555' }}>
            🍫 Chocolat (fixe)
          </div>
        </div>

        {[{ label: 'Niveau 2', val: niv2, set: setNiv2 }, { label: 'Niveau 3', val: niv3, set: setNiv3 }, { label: 'Niveau 4', val: niv4, set: setNiv4 }].map(({ label, val, set }) => (
          <div className="form-group" key={label}>
            <label>{label}</label>
            <select className="form-control" value={val} onChange={(e) => set(e.target.value)}>
              {GOUT_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        ))}

        <div className="form-group">
          <label>Initiales sur le gâteau</label>
          <input
            className="form-control"
            value={initiales}
            onChange={(e) => setInitiales(e.target.value)}
            placeholder="Ex : A & M"
            maxLength={20}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleValidate}>✅ Valider</button>
        </div>
      </div>
    </div>
  )
}

export default function Step5Gateau({ data, onChange, onNext, onBack }) {
  const gateaux = getGateaux()
  const nbPersonnes = data.nbPersonnes || 0
  const [popupGateau, setPopupGateau] = useState(null)

  function handleSelect(gateau) {
    onChange('gateau', gateau)
    // Show popup for real cakes (not "Continuer sans gâteau")
    if (gateau.tarif > 0) {
      setPopupGateau(gateau)
    } else {
      onChange('gateauPersonnalisation', null)
    }
  }

  function handlePopupValidate(perso) {
    onChange('gateauPersonnalisation', perso)
    setPopupGateau(null)
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Pièce montée / Gâteau</h2>
      <p className="text-muted mb-3">Choisissez votre gâteau pour {nbPersonnes} personnes</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {gateaux.map((g) => {
          const isSelected = data.gateau?.id === g.id
          const total = g.tarif * nbPersonnes
          return (
            <div
              key={g.id}
              onClick={() => handleSelect(g)}
              style={{
                border: isSelected ? '2px solid #c9a84c' : '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                background: isSelected ? '#fdf3d9' : 'white',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
            >
              {g.photo ? (
                <img src={g.photo} alt={g.nomGateau} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
              ) : (
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎂</div>
              )}
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>{g.nomGateau}</div>
              <div style={{ fontWeight: '800', color: g.tarif > 0 ? '#c9a84c' : '#27ae60', fontSize: '18px' }}>
                {g.tarif > 0 ? `${g.tarif} €/pers.` : 'Gratuit'}
              </div>
              {g.tarif > 0 && nbPersonnes > 0 && (
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  Total : {total.toLocaleString('fr-FR')} €
                </div>
              )}
              {isSelected && <div style={{ color: '#b8860b', fontWeight: '600', fontSize: '13px', marginTop: '10px' }}>✅ Sélectionné</div>}
            </div>
          )
        })}
      </div>

      {/* Personalization summary */}
      {data.gateau && data.gateau.tarif > 0 && data.gateauPersonnalisation && (
        <div style={{ background: '#fdf3d9', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: '#b8860b' }}>🎂 Personnalisation — {data.gateau.nomGateau}</div>
          <div style={{ fontSize: '13px', color: '#555' }}>
            <div>Niveau 1 : Chocolat (fixe)</div>
            <div>Niveau 2 : {data.gateauPersonnalisation.niv2}</div>
            <div>Niveau 3 : {data.gateauPersonnalisation.niv3}</div>
            <div>Niveau 4 : {data.gateauPersonnalisation.niv4}</div>
            {data.gateauPersonnalisation.initiales && <div>Initiales : {data.gateauPersonnalisation.initiales}</div>}
          </div>
          <button className="btn btn-sm btn-outline" style={{ marginTop: '8px' }} onClick={() => setPopupGateau(data.gateau)}>✏️ Modifier</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-outline" onClick={onBack}>← Retour</button>
        <button
          className="btn btn-primary btn-lg"
          onClick={onNext}
          disabled={!data.gateau}
          style={{ opacity: data.gateau ? 1 : 0.5 }}
        >
          Suivant →
        </button>
      </div>

      {popupGateau && (
        <GateauPopup
          gateau={popupGateau}
          personalisation={data.gateauPersonnalisation}
          onValidate={handlePopupValidate}
          onClose={() => setPopupGateau(null)}
        />
      )}
    </div>
  )
}
