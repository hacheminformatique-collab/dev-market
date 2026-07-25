import { useState } from 'react'
import { getStockSec, saveStockSec, getStockMatiere, saveStockMatiere, getStockBoisson, saveStockBoisson, getClients } from '../../../utils/storage'

const CATEGORIES = [
  { key: 'sec', label: '📦 Stock sec', getter: getStockSec, saver: saveStockSec },
  { key: 'matiere', label: '🥩 Matière première', getter: getStockMatiere, saver: saveStockMatiere },
  { key: 'boisson', label: '🍾 Boissons', getter: getStockBoisson, saver: saveStockBoisson },
]

function calcBoissonBesoin(nomBoisson, clients) {
  const upcoming = clients.filter((c) => c.status !== 'annulé' && c.dateEvenement >= new Date().toISOString().split('T')[0])
  let total = 0
  upcoming.forEach((ev) => {
    const hasBoisson = (ev.menus || []).some((m) => m.nomMenu === nomBoisson || m.section === 'Boissons')
    if (!hasBoisson) return
    const nb = (parseInt(ev.nbAdultes) || ev.nbPersonnes || 0) + (parseInt(ev.nbEnfants) || 0)
    if (nomBoisson === 'Eau de source') {
      total += Math.ceil((nb / 10) * 2)
    } else if (nomBoisson === 'Thé et Café') {
      // No quantity calculation for tea/coffee (machine)
    } else {
      total += Math.ceil((nb / 10) * 1.5)
    }
  })
  return total
}

function ProductModal({ item, onSave, onClose }) {
  const [data, setData] = useState(item || {
    id: '', nom: '', quantite: 0, unite: 'unité', coutUnitaire: 0, fournisseur: '', photo: '', alertSeuil: 0,
  })

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setData((prev) => ({ ...prev, photo: ev.target.result }))
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{item ? 'Modifier le produit' : 'Nouveau produit'}</h3>

        <div className="form-group">
          <label>Nom du produit</label>
          <input className="form-control" value={data.nom} onChange={(e) => setData({ ...data, nom: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Quantité en stock</label>
            <input type="number" step="0.01" className="form-control" value={data.quantite} onChange={(e) => setData({ ...data, quantite: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label>Unité</label>
            <select className="form-control" value={data.unite} onChange={(e) => setData({ ...data, unite: e.target.value })}>
              <option value="unité">Unité</option>
              <option value="kg">Kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="cl">cl</option>
              <option value="bouteille">Bouteille</option>
              <option value="paquet">Paquet</option>
            </select>
          </div>
          <div className="form-group">
            <label>Coût unitaire (€)</label>
            <input type="number" step="0.01" className="form-control" value={data.coutUnitaire} onChange={(e) => setData({ ...data, coutUnitaire: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label>Seuil d&apos;alerte</label>
            <input type="number" step="1" className="form-control" value={data.alertSeuil} onChange={(e) => setData({ ...data, alertSeuil: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="form-group">
          <label>Fournisseur</label>
          <input className="form-control" value={data.fournisseur} onChange={(e) => setData({ ...data, fournisseur: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Photo</label>
          {data.photo ? <img src={data.photo} alt="produit" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px', display: 'block' }} /> : null}
          <label style={{ cursor: 'pointer', display: 'inline-block', padding: '6px 12px', background: '#1a1a2e', color: 'white', borderRadius: '6px', fontSize: '12px' }}>
            📷 {data.photo ? 'Remplacer' : 'Ajouter photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { if (data.nom.trim()) onSave(data) }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

function StockTable({ categoryKey, label, getter, saver }) {
  const [items, setItems] = useState(getter())
  const [modal, setModal] = useState(null)
  const [editQty, setEditQty] = useState({})
  const clients = getClients()

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = items.map((i) => i.id === data.id ? data : i)
    } else {
      updated = [...items, { ...data, id: Date.now().toString() }]
    }
    saver(updated)
    setItems(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer ce produit ?')) return
    const updated = items.filter((i) => i.id !== id)
    saver(updated)
    setItems(updated)
  }

  function handleQtyChange(id, val) {
    setEditQty((prev) => ({ ...prev, [id]: val }))
  }

  function saveQty(id) {
    const newQ = parseFloat(editQty[id])
    if (isNaN(newQ)) return
    const updated = items.map((i) => i.id === id ? { ...i, quantite: newQ } : i)
    saver(updated)
    setItems(updated)
    setEditQty((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  function getBesoinActuel(item) {
    if (categoryKey === 'boisson') {
      return calcBoissonBesoin(item.nom, clients)
    }
    return 0
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="flex-between mb-2">
        <h4 style={{ color: '#1a1a2e' }}>{label}</h4>
        <button className="btn btn-sm btn-primary" onClick={() => setModal({})}>+ Ajouter</button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Stock</th>
              <th>Besoin actuel</th>
              <th>Manquant</th>
              <th>Coût unit.</th>
              <th>Fournisseur</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const besoin = getBesoinActuel(item)
              const manquant = Math.max(0, besoin - item.quantite)
              const isAlert = item.alertSeuil > 0 ? item.quantite <= item.alertSeuil : (besoin > 0 && item.quantite < besoin)
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.photo && <img src={item.photo} alt={item.nom} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />}
                      <div>
                        <div style={{ fontWeight: '600' }}>{item.nom}</div>
                        {item.fournisseur && <div style={{ fontSize: '11px', color: '#888' }}>{item.fournisseur}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {editQty[item.id] !== undefined ? (
                        <>
                          <input
                            type="number"
                            value={editQty[item.id]}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            style={{ width: '70px', padding: '4px 6px', border: '1px solid #c9a84c', borderRadius: '4px', fontSize: '13px' }}
                            onKeyDown={(e) => e.key === 'Enter' && saveQty(item.id)}
                          />
                          <button style={{ background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }} onClick={() => saveQty(item.id)}>✓</button>
                        </>
                      ) : (
                        <span
                          style={{ cursor: 'pointer', color: isAlert ? '#e74c3c' : '#222', fontWeight: isAlert ? '700' : '400' }}
                          onClick={() => handleQtyChange(item.id, item.quantite)}
                          title="Cliquer pour modifier"
                        >
                          {item.quantite} {item.unite}
                          {isAlert && <span style={{ marginLeft: '4px', fontSize: '12px' }}>⚠️</span>}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: besoin > 0 ? '#c9a84c' : '#888' }}>
                    {besoin > 0 ? `${besoin} ${item.unite}` : '—'}
                  </td>
                  <td>
                    {manquant > 0 ? (
                      <span style={{ color: '#e74c3c', fontWeight: '700' }}>-{manquant} {item.unite}</span>
                    ) : besoin > 0 ? (
                      <span style={{ color: '#27ae60' }}>✅ OK</span>
                    ) : '—'}
                  </td>
                  <td>{item.coutUnitaire > 0 ? `${item.coutUnitaire} €/${item.unite}` : '—'}</td>
                  <td style={{ color: '#888', fontSize: '13px' }}>{item.fournisseur || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => setModal(item)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: '24px' }}>Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal !== null && (
        <ProductModal
          item={modal.id ? modal : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default function StockTab() {
  return (
    <div>
      <h3 style={{ marginBottom: '8px', color: '#1a1a2e' }}>📦 Gestion des stocks</h3>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>
        Gérez vos stocks. Les besoins actuels sont calculés en fonction des événements à venir. Cliquez sur une quantité pour la modifier directement.
      </p>
      {CATEGORIES.map((cat) => (
        <StockTable key={cat.key} categoryKey={cat.key} label={cat.label} getter={cat.getter} saver={cat.saver} />
      ))}
    </div>
  )
}
