import { useState } from 'react'
import { getFormules, saveFormules, getMenus, getGateaux, getPrestations } from '../../../utils/storage'
import PhotoUpload from '../PhotoUpload'

function FormuleModal({ formule, onSave, onClose }) {
  const [data, setData] = useState(formule || { id: '', nomFormule: '', contenuFormule: '', photo: '', forfait: true, inclusions: {} })
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const categories = [
    { key: 'menus', label: 'Menus', items: getMenus(), name: 'nomMenu' },
    { key: 'gateaux', label: 'Gâteaux', items: getGateaux(), name: 'nomGateau' },
    { key: 'prestations', label: 'Prestations', items: getPrestations(), name: 'nomPresta' },
  ]
  const enabled = categories.filter(({ key }) => Array.isArray(data.inclusions?.[key]))
  const current = enabled[step - 1]
  const foodIncluded = enabled.some(({ key }) => key === 'menus' || key === 'gateaux')

  function toggleCategory(key, checked) {
    const inclusions = { ...data.inclusions }
    if (checked) inclusions[key] = []
    else delete inclusions[key]
    setData({ ...data, forfait: true, inclusions })
    setError('')
  }

  function handleSave() {
    if (!data.nomFormule.trim()) {
      setError('Veuillez renseigner le nom de la formule.')
      return
    }
    if (data.forfait) {
      const invalid = enabled.find(({ key, items }) => !items.some((item) => data.inclusions[key].includes(item.id)))
      if (invalid) {
        setError(`Sélectionnez au moins un élément disponible dans la catégorie ${invalid.label}.`)
        return
      }
      const percent = Number(data.partTraiteurPourcent)
      if (foodIncluded && (data.partTraiteurPourcent === undefined || data.partTraiteurPourcent === '' || !Number.isFinite(percent) || percent < 0 || percent > 100)) {
        setError('Renseignez la part restauration soumise à TVA 10%, entre 0 et 100%.')
        setStep(0)
        return
      }
      const inclusions = Object.fromEntries(enabled.map(({ key, items }) => [key, items.filter((item) => data.inclusions[key].includes(item.id)).map((item) => item.id)]))
      onSave({ ...data, inclusions, partTraiteurPourcent: foodIncluded ? percent : 0 })
    } else {
      onSave(data)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{formule ? 'Modifier la formule' : 'Nouvelle formule'}</h3>
        <p className="text-muted">Étape {step + 1} / {enabled.length + 1} — {current?.label || 'Configuration du forfait'}</p>
        {error && <p role="alert" style={{ color: '#c0392b' }}>{error}</p>}
        {step === 0 && <>
        <div className="form-group">
          <label>Nom de la formule</label>
          <input className="form-control" value={data.nomFormule} onChange={(e) => setData({ ...data, nomFormule: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Contenu / description</label>
          <textarea className="form-control" rows={3} value={data.contenuFormule} onChange={(e) => setData({ ...data, contenuFormule: e.target.value })} />
        </div>
        <PhotoUpload value={data.photo || ''} onChange={(v) => setData({ ...data, photo: v })} label="Photo de la formule" />
        <label style={{ display: 'block', margin: '16px 0' }}>
          <input type="checkbox" checked={data.forfait === true} onChange={(event) => setData({ ...data, forfait: event.target.checked, inclusions: {} })} /> Forfait à prix global, sans supplément pour les éléments inclus
        </label>
        {data.forfait && <>
          <p className="text-muted">Le prix total TTC se règle dans Calendrier → Grille tarifaire. Sans tarif renseigné, le forfait ne peut pas être réservé.</p>
          {categories.map(({ key, label }) => (
            <label key={key} style={{ display: 'block', margin: '10px 0' }}>
              <input type="checkbox" checked={Array.isArray(data.inclusions?.[key])} onChange={(event) => toggleCategory(key, event.target.checked)} /> {label} inclus
            </label>
          ))}
          {foodIncluded && <div className="form-group">
            <label>Part du prix global soumise à TVA 10% (%)</label>
            <input className="form-control" type="number" min="0" max="100" step="0.01" value={data.partTraiteurPourcent ?? ''} onChange={(event) => setData({ ...data, partTraiteurPourcent: event.target.value })} />
            <small>Ventilation restauration à confirmer avec votre comptable ; le reste est soumis à TVA 20%. Les tarifs du catalogue ne servent pas à calculer cette part.</small>
          </div>}
        </>}
        </>}
        {current && <div>
          <h4>Choix {current.label.toLowerCase()} inclus dans le forfait</h4>
          <p className="text-muted">Le client choisira uniquement parmi ces éléments, sans supplément.</p>
          {!current.items.length && <p role="alert">Aucun élément disponible. Ajoutez-en dans le catalogue correspondant avant de sauvegarder.</p>}
          {current.items.map((item) => <label key={item.id} style={{ display: 'block', margin: '12px 0' }}>
            <input type="checkbox" checked={data.inclusions[current.key].includes(item.id)} onChange={(event) => {
              const ids = data.inclusions[current.key]
              setData({ ...data, inclusions: { ...data.inclusions, [current.key]: event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id) } })
              setError('')
            }} /> {item.section ? `${item.section} — ` : ''}{item[current.name]}
          </label>)}
        </div>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          {step > 0 && <button className="btn btn-outline" onClick={() => { setError(''); setStep(step - 1) }}>← Retour</button>}
          {step < enabled.length
            ? <button className="btn btn-primary" onClick={() => { setError(''); setStep(step + 1) }}>Configurer {enabled[step].label.toLowerCase()} →</button>
            : <button className="btn btn-primary" onClick={handleSave}>Sauvegarder</button>}
        </div>
      </div>
    </div>
  )
}

export default function FormuleSalleTab() {
  const [formules, setFormules] = useState(getFormules())
  const [modal, setModal] = useState(null)

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
                <td><strong>{f.nomFormule}</strong>{f.forfait && <div className="text-muted">Forfait tout compris</div>}</td>
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
