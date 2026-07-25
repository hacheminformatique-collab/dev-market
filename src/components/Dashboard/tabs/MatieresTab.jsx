import { useState } from 'react'
import { getIngredients, saveIngredients, getMatieresPremieresRecettes, saveMatieresPremieresRecettes, getMenus, getClients, getStockBoisson, getStockMatiere, getStockSec } from '../../../utils/storage'

// ─── Ingredients Sub-tab ─────────────────────────────────────────────────────
function IngredientsTab() {
  const [ingredients, setIngredients] = useState(getIngredients())
  const [modal, setModal] = useState(null)

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = ingredients.map((i) => i.id === data.id ? data : i)
    } else {
      updated = [...ingredients, { ...data, id: Date.now().toString() }]
    }
    saveIngredients(updated)
    setIngredients(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer cet ingrédient ?')) return
    const updated = ingredients.filter((i) => i.id !== id)
    saveIngredients(updated)
    setIngredients(updated)
  }

  return (
    <div>
      <div className="flex-between mb-3">
        <h4 style={{ color: '#1a1a2e' }}>🧂 Ingrédients</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Ajouter</button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type de tarif</th>
              <th>Tarif</th>
              <th>Fournisseur</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => (
              <tr key={ing.id}>
                <td><strong>{ing.nom}</strong></td>
                <td><span className="badge badge-gold">{ing.typeTarif === 'poids' ? 'Au poids (€/kg)' : 'À l\'unité (€/u)'}</span></td>
                <td>{ing.tarif} €{ing.typeTarif === 'poids' ? '/kg' : '/u'}</td>
                <td style={{ color: '#888' }}>{ing.fournisseur || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setModal(ing)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(ing.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {ingredients.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '24px' }}>Aucun ingrédient</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <IngredientModal item={modal.id ? modal : null} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function IngredientModal({ item, onSave, onClose }) {
  const [data, setData] = useState(item || { id: '', nom: '', typeTarif: 'unite', tarif: 0, fournisseur: '' })
  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{item ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient'}</h3>
        <div className="form-group">
          <label>Nom de l&apos;ingrédient</label>
          <input className="form-control" value={data.nom} onChange={(e) => setData({ ...data, nom: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Type de tarif</label>
          <select className="form-control" value={data.typeTarif} onChange={(e) => setData({ ...data, typeTarif: e.target.value })}>
            <option value="unite">À l&apos;unité (€/u)</option>
            <option value="poids">Au poids (€/kg)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Tarif ({data.typeTarif === 'poids' ? '€/kg' : '€/unité'})</label>
          <input type="number" step="0.01" className="form-control" value={data.tarif} onChange={(e) => setData({ ...data, tarif: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="form-group">
          <label>Fournisseur</label>
          <input className="form-control" value={data.fournisseur} onChange={(e) => setData({ ...data, fournisseur: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { if (data.nom.trim()) onSave(data) }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

// ─── Recettes Sub-tab ─────────────────────────────────────────────────────────
function RecettesTab() {
  const menus = getMenus().filter((m) => m.section !== 'Boissons')
  const ingredients = getIngredients()
  const recettes = getMatieresPremieresRecettes()
  const clients = getClients()

  const [selected, setSelected] = useState(null)
  const [recette, setRecette] = useState(null) // ingredients list for selected menu
  const [saved, setSaved] = useState(false)

  function openRecette(menu) {
    setSelected(menu)
    const found = recettes.find((r) => r.menuId === menu.id)
    setRecette(found ? { ...found } : { menuId: menu.id, fournisseur: '', coutPersonne: 0, lignes: [] })
    setSaved(false)
  }

  function handleAddLigne() {
    setRecette((prev) => ({
      ...prev,
      lignes: [...(prev.lignes || []), { ingredientId: ingredients[0]?.id || '', quantite: 0 }],
    }))
  }

  function updateLigne(idx, field, val) {
    setRecette((prev) => {
      const lignes = prev.lignes.map((l, i) => i === idx ? { ...l, [field]: val } : l)
      return { ...prev, lignes }
    })
  }

  function removeLigne(idx) {
    setRecette((prev) => ({ ...prev, lignes: prev.lignes.filter((_, i) => i !== idx) }))
  }

  function calcCoutRecette(rec) {
    if (!rec) return 0
    return (rec.lignes || []).reduce((sum, l) => {
      const ing = ingredients.find((i) => i.id === l.ingredientId)
      if (!ing) return sum
      return sum + (ing.tarif || 0) * (l.quantite || 0)
    }, 0)
  }

  function saveRecette() {
    const updated = recettes.filter((r) => r.menuId !== recette.menuId)
    const coutAuto = calcCoutRecette(recette)
    const toSave = { ...recette, coutPersonneAuto: coutAuto }
    saveMatieresPremieresRecettes([...updated, toSave])
    setSaved(true)
  }

  // Shopping list: ingredients needed for all upcoming events minus current stock
  function generateShoppingList() {
    const upcoming = clients.filter((c) => c.status !== 'annulé' && c.dateEvenement >= new Date().toISOString().split('T')[0])
    const needs = {}

    upcoming.forEach((ev) => {
      const nbAdultes = parseInt(ev.nbAdultes) || ev.nbPersonnes || 0
      const nbEnfants = parseInt(ev.nbEnfants) || 0
      ;(ev.menus || []).forEach((m) => {
        const rec = recettes.find((r) => r.menuId === m.id)
        if (!rec) return
        const nb = m.section === 'Menu enfants' ? nbEnfants : nbAdultes
        ;(rec.lignes || []).forEach((l) => {
          needs[l.ingredientId] = (needs[l.ingredientId] || 0) + (l.quantite || 0) * nb
        })
      })
    })

    const allStock = [...getStockMatiere(), ...getStockSec(), ...getStockBoisson()]
    const list = Object.entries(needs).map(([ingId, qty]) => {
      const ing = ingredients.find((i) => i.id === ingId)
      if (!ing) return null
      const stockItem = allStock.find((s) => s.nom.toLowerCase() === ing.nom.toLowerCase())
      const inStock = stockItem?.quantite || 0
      const manquant = Math.max(0, qty - inStock)
      return { ing, qty, inStock, manquant }
    }).filter(Boolean)

    return list
  }

  const shoppingList = generateShoppingList()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: '24px' }}>
      <div>
        <div className="flex-between mb-3">
          <h4 style={{ color: '#1a1a2e' }}>🍽️ Recettes par produit menu</h4>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Menu</th>
                <th>Section</th>
                <th>Coût/pers. (calculé)</th>
                <th>Nb ingrédients</th>
                <th style={{ width: '80px' }}>Éditer</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => {
                const rec = recettes.find((r) => r.menuId === m.id)
                const cout = rec ? calcCoutRecette(rec) : null
                return (
                  <tr key={m.id} style={{ cursor: 'pointer', background: selected?.id === m.id ? '#fdf3d9' : '' }} onClick={() => openRecette(m)}>
                    <td><strong>{m.nomMenu}</strong></td>
                    <td><span className="badge badge-gold">{m.section}</span></td>
                    <td>{cout !== null ? `${cout.toFixed(2)} €` : <span style={{ color: '#888' }}>—</span>}</td>
                    <td>{rec ? rec.lignes?.length || 0 : <span style={{ color: '#888' }}>—</span>}</td>
                    <td><button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); openRecette(m) }}>✏️</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Shopping list */}
        <div className="card" style={{ marginTop: '24px' }}>
          <h4 style={{ color: '#1a1a2e', marginBottom: '12px' }}>🛒 Liste de courses (manque pour événements à venir)</h4>
          {shoppingList.filter((i) => i.manquant > 0).length === 0 ? (
            <p style={{ color: '#27ae60', fontSize: '14px' }}>✅ Stock suffisant pour tous les événements à venir</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ingrédient</th>
                  <th>Besoin total</th>
                  <th>En stock</th>
                  <th>À commander</th>
                  <th>Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {shoppingList.filter((i) => i.manquant > 0).map(({ ing, qty, inStock, manquant }) => (
                  <tr key={ing.id}>
                    <td><strong>{ing.nom}</strong></td>
                    <td>{qty} {ing.typeTarif === 'poids' ? 'kg' : 'u'}</td>
                    <td>{inStock} {ing.typeTarif === 'poids' ? 'kg' : 'u'}</td>
                    <td><strong style={{ color: '#e74c3c' }}>{manquant} {ing.typeTarif === 'poids' ? 'kg' : 'u'}</strong></td>
                    <td style={{ color: '#888' }}>{ing.fournisseur || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && recette && (
        <div className="card" style={{ position: 'sticky', top: 0, alignSelf: 'start', maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="flex-between mb-2">
            <h4 style={{ color: '#1a1a2e' }}>{selected.nomMenu}</h4>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }} onClick={() => setSelected(null)}>✕</button>
          </div>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>Section : {selected.section}</p>

          <div className="form-group">
            <label style={{ fontSize: '13px' }}>Fournisseur principal</label>
            <input className="form-control" value={recette.fournisseur || ''} onChange={(e) => setRecette({ ...recette, fournisseur: e.target.value })} style={{ fontSize: '13px' }} />
          </div>

          <h5 style={{ marginBottom: '8px', fontSize: '14px' }}>Ingrédients (par personne)</h5>
          {(recette.lignes || []).map((ligne, idx) => {
            const ing = ingredients.find((i) => i.id === ligne.ingredientId)
            return (
              <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                <select
                  className="form-control"
                  value={ligne.ingredientId}
                  onChange={(e) => updateLigne(idx, 'ingredientId', e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 8px', flex: 2 }}
                >
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
                <input
                  type="number" step="0.01"
                  className="form-control"
                  value={ligne.quantite}
                  onChange={(e) => updateLigne(idx, 'quantite', parseFloat(e.target.value) || 0)}
                  style={{ fontSize: '12px', padding: '6px 8px', width: '70px' }}
                  placeholder="Qté"
                />
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>{ing?.typeTarif === 'poids' ? 'kg' : 'u'}</span>
                <button style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }} onClick={() => removeLigne(idx)}>✕</button>
              </div>
            )
          })}
          <button className="btn btn-sm btn-outline" onClick={handleAddLigne} style={{ marginBottom: '12px' }}>+ Ingrédient</button>

          <div style={{ background: '#fdf3d9', borderRadius: '8px', padding: '10px', fontSize: '13px', marginBottom: '12px' }}>
            <strong>Coût calculé / personne :</strong> {calcCoutRecette(recette).toFixed(2)} €
          </div>

          <button className="btn btn-primary w-100" style={{ justifyContent: 'center' }} onClick={saveRecette}>
            {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder la recette'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MatieresTab() {
  const [subTab, setSubTab] = useState('recettes')

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>🥩 Matières premières</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
        {[{ id: 'recettes', label: '🍽️ Recettes & coûts' }, { id: 'ingredients', label: '🧂 Ingrédients' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className="btn btn-sm"
            style={{ background: subTab === t.id ? '#1a1a2e' : '#eee', color: subTab === t.id ? 'white' : '#444' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'recettes' && <RecettesTab />}
      {subTab === 'ingredients' && <IngredientsTab />}
    </div>
  )
}
