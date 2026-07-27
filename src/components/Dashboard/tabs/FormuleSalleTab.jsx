import { useState } from 'react'
import { getFormules, saveFormules, getSettings, saveSettings } from '../../../utils/storage'
import PhotoUpload from '../PhotoUpload'

function FormuleModal({ formule, onSave, onClose }) {
  const [data, setData] = useState(formule || { id: '', nomFormule: '', contenuFormule: '', photo: '' })

  function handleSave() {
    if (!data.nomFormule.trim()) return
    onSave(data)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{formule ? 'Modifier la formule' : 'Nouvelle formule'}</h3>
        <div className="form-group">
          <label>Nom de la formule</label>
          <input className="form-control" value={data.nomFormule} onChange={(e) => setData({ ...data, nomFormule: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Contenu / description</label>
          <textarea className="form-control" rows={3} value={data.contenuFormule} onChange={(e) => setData({ ...data, contenuFormule: e.target.value })} />
        </div>
        <PhotoUpload value={data.photo || ''} onChange={(v) => setData({ ...data, photo: v })} label="Photo de la formule" />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

export default function FormuleSalleTab() {
  const [formules, setFormules] = useState(getFormules())
  const [modal, setModal] = useState(null)
  const [tarifPromo, setTarifPromo] = useState(() => (getSettings() || {}).tarifPromotionnel || 0)
  const [promoSaved, setPromoSaved] = useState(false)

  function handleSavePromo() {
    const settings = getSettings() || {}
    saveSettings({ ...settings, tarifPromotionnel: Number(tarifPromo) || 0 })
    setPromoSaved(true)
    setTimeout(() => setPromoSaved(false), 2000)
  }

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = formules.map((f) => (f.id === data.id ? data : f))
    } else {
      updated = [...formules, { ...data, id: Date.now().toString() }]
    }
    saveFormules(updated)
    setFormules(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer cette formule ?')) return
    const updated = formules.filter((f) => f.id !== id)
    saveFormules(updated)
    setFormules(updated)
  }

  return (
    <div>
      {/* Global promotional tariff */}
      <div className="card mb-3" style={{ borderLeft: '4px solid #c9a84c' }}>
        <h4 style={{ marginBottom: '4px', color: '#1a1a2e' }}>🏷️ Tarif promotionnel global</h4>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          Ce montant est déduit du tarif de base de <strong>toutes les formules</strong> disponibles lors de la réservation. Laissez à 0 pour désactiver.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="form-control"
              type="number"
              min="0"
              step="50"
              style={{ width: '140px' }}
              value={tarifPromo}
              onChange={(e) => setTarifPromo(e.target.value)}
            />
            <span style={{ color: '#555', fontWeight: '600' }}>€</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSavePromo}>
            {promoSaved ? '✅ Enregistré' : '💾 Enregistrer'}
          </button>
        </div>
      </div>

      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>Formules de location</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Ajouter</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Contenu</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {formules.map((f) => (
              <tr key={f.id}>
                <td><strong>{f.nomFormule}</strong></td>
                <td className="text-muted">{f.contenuFormule}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setModal(f)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(f.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {formules.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted" style={{ padding: '32px' }}>Aucune formule</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal !== null && <FormuleModal formule={modal.id ? modal : null} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
