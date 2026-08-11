import { useState } from 'react'
import { getPrestations, savePrestations } from '../../../utils/storage'
import PhotoUpload from '../PhotoUpload'

function PrestaModal({ item, onSave, onClose }) {
  const [data, setData] = useState(item || { id: '', nomPresta: '', tarif: 0, description: '', photo: '' })

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{item ? 'Modifier la prestation' : 'Nouvelle prestation'}</h3>
        <div className="form-group">
          <label>Nom de la prestation</label>
          <input className="form-control" value={data.nomPresta} onChange={(e) => setData({ ...data, nomPresta: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Tarif (€ forfait)</label>
          <input type="number" step="10" className="form-control" value={data.tarif} onChange={(e) => setData({ ...data, tarif: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-control" rows={2} value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
        </div>
        <PhotoUpload value={data.photo || ''} onChange={(v) => setData({ ...data, photo: v })} label="Photo de la prestation" />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { if (data.nomPresta.trim()) onSave(data) }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

export default function PrestationTab() {
  const [prestations, setPrestations] = useState(getPrestations())
  const [modal, setModal] = useState(null)

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = prestations.map((p) => (p.id === data.id ? data : p))
    } else {
      updated = [...prestations, { ...data, id: Date.now().toString() }]
    }
    savePrestations(updated)
    setPrestations(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer cette prestation ?')) return
    const updated = prestations.filter((p) => p.id !== id)
    savePrestations(updated)
    setPrestations(updated)
  }

  return (
    <div>
      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>Prestations & Options</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Ajouter</button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Tarif</th>
              <th>Description</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {prestations.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.nomPresta}</strong></td>
                <td><strong className="text-gold">{p.tarif} €</strong></td>
                <td className="text-muted">{p.description}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setModal(p)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {prestations.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted" style={{ padding: '32px' }}>Aucune prestation</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal !== null && <PrestaModal item={modal.id ? modal : null} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
