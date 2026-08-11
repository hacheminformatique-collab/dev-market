import { useState } from 'react'
import { getMenus, saveMenus } from '../../../utils/storage'
import PhotoUpload from '../PhotoUpload'

const SECTIONS = ['Cocktail de bienvenu', 'Entrée', 'Plats', 'Desserts', 'Menu enfants', 'Boissons']

function MenuModal({ item, onSave, onClose }) {
  const [data, setData] = useState(item || { id: '', section: SECTIONS[0], nomMenu: '', tarif: 0, description: '', photo: '' })

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{item ? 'Modifier le menu' : 'Nouveau menu'}</h3>
        <div className="form-group">
          <label>Section</label>
          <select className="form-control" value={data.section} onChange={(e) => setData({ ...data, section: e.target.value })}>
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Nom du menu</label>
          <input className="form-control" value={data.nomMenu} onChange={(e) => setData({ ...data, nomMenu: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Tarif (€/pers.)</label>
          <input type="number" step="0.5" className="form-control" value={data.tarif} onChange={(e) => setData({ ...data, tarif: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input className="form-control" value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
        </div>
        <PhotoUpload value={data.photo || ''} onChange={(v) => setData({ ...data, photo: v })} label="Photo du menu" />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { if (data.nomMenu.trim()) onSave(data) }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

export default function MenuTab() {
  const [menus, setMenus] = useState(getMenus())
  const [modal, setModal] = useState(null)
  const [filterSection, setFilterSection] = useState('Tous')

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = menus.map((m) => (m.id === data.id ? data : m))
    } else {
      updated = [...menus, { ...data, id: Date.now().toString() }]
    }
    saveMenus(updated)
    setMenus(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer ce menu ?')) return
    const updated = menus.filter((m) => m.id !== id)
    saveMenus(updated)
    setMenus(updated)
  }

  const filtered = filterSection === 'Tous' ? menus : menus.filter((m) => m.section === filterSection)

  return (
    <div>
      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>Menus & Boissons</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Ajouter</button>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['Tous', ...SECTIONS].map((s) => (
          <button
            key={s}
            onClick={() => setFilterSection(s)}
            className="btn btn-sm"
            style={{ background: filterSection === s ? '#1a1a2e' : '#eee', color: filterSection === s ? 'white' : '#444' }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Nom</th>
              <th>Tarif</th>
              <th>Description</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td><span className="badge badge-gold">{m.section}</span></td>
                <td><strong>{m.nomMenu}</strong></td>
                <td>{m.tarif > 0 ? `${m.tarif} €` : <span className="text-muted">Inclus</span>}</td>
                <td className="text-muted">{m.description}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setModal(m)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(m.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted" style={{ padding: '32px' }}>Aucun menu</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal !== null && <MenuModal item={modal.id ? modal : null} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
