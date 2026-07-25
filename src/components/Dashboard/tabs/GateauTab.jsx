import { useState } from 'react'
import { getGateaux, saveGateaux } from '../../../utils/storage'
import PhotoUpload from '../PhotoUpload'

function GateauModal({ item, onSave, onClose }) {
  const [data, setData] = useState(item || { id: '', nomGateau: '', tarif: 0, photo: '' })

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{item ? 'Modifier le gâteau' : 'Nouveau gâteau'}</h3>
        <div className="form-group">
          <label>Nom du gâteau</label>
          <input className="form-control" value={data.nomGateau} onChange={(e) => setData({ ...data, nomGateau: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Tarif (€/pers.)</label>
          <input type="number" step="0.5" className="form-control" value={data.tarif} onChange={(e) => setData({ ...data, tarif: parseFloat(e.target.value) || 0 })} />
        </div>
        <PhotoUpload value={data.photo || ''} onChange={(v) => setData({ ...data, photo: v })} label="Photo du gâteau" />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { if (data.nomGateau.trim()) onSave(data) }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

export default function GateauTab() {
  const [gateaux, setGateaux] = useState(getGateaux())
  const [modal, setModal] = useState(null)

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = gateaux.map((g) => (g.id === data.id ? data : g))
    } else {
      updated = [...gateaux, { ...data, id: Date.now().toString() }]
    }
    saveGateaux(updated)
    setGateaux(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer ce gâteau ?')) return
    const updated = gateaux.filter((g) => g.id !== id)
    saveGateaux(updated)
    setGateaux(updated)
  }

  return (
    <div>
      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>Gâteaux</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Ajouter</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Tarif (€/pers.)</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {gateaux.map((g) => (
              <tr key={g.id}>
                <td><strong>{g.nomGateau}</strong></td>
                <td>{g.tarif > 0 ? `${g.tarif} €` : <span className="text-muted">Gratuit</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setModal(g)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {gateaux.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted" style={{ padding: '32px' }}>Aucun gâteau</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal !== null && <GateauModal item={modal.id ? modal : null} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
