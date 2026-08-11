import { useState } from 'react'
import { getStaff, saveStaff } from '../../../utils/storage'
import { useIsMobile } from '../../../hooks/useIsMobile'

const POSTES = ['Serveur', 'Manager', 'Responsable', 'Cuisinier', 'Cuisine', 'Polyvalent', 'Agent de sécurité', 'DJ']

function StaffModal({ item, onSave, onClose }) {
  const [data, setData] = useState(item || {
    id: '', nom: '', prenom: '', dateNaissance: '', telephone: '',
    matricule: '', poste: POSTES[0], tarifEvenement: 0, photo: '', cniDoc: '', pin: '1234',
  })
  const isMobile = useIsMobile()

  function handleFile(field) {
    return (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => setData((prev) => ({ ...prev, [field]: ev.target.result }))
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '560px' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">{item ? 'Modifier l\'employé' : 'Nouvel employé'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Prénom</label>
            <input className="form-control" value={data.prenom} onChange={(e) => setData({ ...data, prenom: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Nom</label>
            <input className="form-control" value={data.nom} onChange={(e) => setData({ ...data, nom: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Date de naissance</label>
            <input type="date" className="form-control" value={data.dateNaissance} onChange={(e) => setData({ ...data, dateNaissance: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input className="form-control" value={data.telephone} onChange={(e) => setData({ ...data, telephone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Matricule</label>
            <input className="form-control" value={data.matricule} onChange={(e) => setData({ ...data, matricule: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Poste</label>
            <select className="form-control" value={data.poste} onChange={(e) => setData({ ...data, poste: e.target.value })}>
              {POSTES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Forfait par événement (€)</label>
            <input type="number" step="5" className="form-control" value={data.tarifEvenement} onChange={(e) => setData({ ...data, tarifEvenement: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label>Code PIN staff</label>
            <input type="password" className="form-control" value={data.pin || ''} maxLength={4} placeholder="4 chiffres" onChange={(e) => setData({ ...data, pin: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>

        {/* Photo */}
        <div className="form-group">
          <label>Photo</label>
          {data.photo ? (
            <div style={{ marginBottom: '8px' }}>
              <img src={data.photo} alt="photo" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #c9a84c' }} />
              <button type="button" style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }} onClick={() => setData({ ...data, photo: '' })}>Supprimer</button>
            </div>
          ) : null}
          <label style={{ cursor: 'pointer', display: 'inline-block', padding: '6px 12px', background: '#1a1a2e', color: 'white', borderRadius: '6px', fontSize: '12px' }}>
            📷 {data.photo ? 'Remplacer' : 'Ajouter photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile('photo')} />
          </label>
        </div>

        {/* CNI document */}
        <div className="form-group">
          <label>Pièce d&apos;identité</label>
          {data.cniDoc ? (
            <div style={{ marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: '#27ae60' }}>✅ Document chargé</span>
              <button type="button" style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '12px' }} onClick={() => setData({ ...data, cniDoc: '' })}>Supprimer</button>
            </div>
          ) : null}
          <label style={{ cursor: 'pointer', display: 'inline-block', padding: '6px 12px', background: '#1a1a2e', color: 'white', borderRadius: '6px', fontSize: '12px' }}>
            📎 {data.cniDoc ? 'Remplacer pièce d\'identité' : 'Charger pièce d\'identité'}
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile('cniDoc')} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => { if (data.nom.trim() || data.prenom.trim()) onSave(data) }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  )
}

export default function StaffTab() {
  const [staff, setStaff] = useState(getStaff())
  const [modal, setModal] = useState(null)
  const [filterPoste, setFilterPoste] = useState('Tous')
  const [revealedPins, setRevealedPins] = useState(new Set())

  function togglePinReveal(id) {
    setRevealedPins((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleSave(data) {
    let updated
    if (data.id) {
      updated = staff.map((s) => s.id === data.id ? data : s)
    } else {
      const id = Date.now().toString()
      const matricule = data.matricule || `EMP-${id.slice(-4)}`
      updated = [...staff, { ...data, id, matricule }]
    }
    saveStaff(updated)
    setStaff(updated)
    setModal(null)
  }

  function handleDelete(id) {
    if (!confirm('Supprimer cet employé ?')) return
    const updated = staff.filter((s) => s.id !== id)
    saveStaff(updated)
    setStaff(updated)
  }

  const filtered = filterPoste === 'Tous' ? staff : staff.filter((s) => s.poste === filterPoste)

  return (
    <div>
      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>👷 Staff ({staff.length} employés)</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Ajouter</button>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
        {['Tous', ...POSTES].map((p) => (
          <button
            key={p}
            onClick={() => setFilterPoste(p)}
            className="btn btn-sm"
            style={{ background: filterPoste === p ? '#1a1a2e' : '#eee', color: filterPoste === p ? 'white' : '#444' }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {filtered.map((s) => (
          <div key={s.id} className="card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              {s.photo ? (
                <img src={s.photo} alt={s.prenom} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #c9a84c' }} />
              ) : (
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', color: '#c9a84c' }}>
                  {(s.prenom || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: '700', fontSize: '16px' }}>{s.prenom} {s.nom}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{s.matricule}</div>
                <span style={{ background: '#fdf3d9', color: '#b8860b', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{s.poste}</span>
              </div>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#555' }}>
              {s.dateNaissance && <div>🎂 {new Date(s.dateNaissance + 'T00:00:00').toLocaleDateString('fr-FR')}</div>}
              {s.telephone && <div>📞 {s.telephone}</div>}
              <div style={{ color: '#c9a84c', fontWeight: '700', marginTop: '4px' }}>💰 {(s.tarifEvenement || 0).toLocaleString('fr-FR')} € / événement</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ color: '#555' }}>🔑 PIN :</span>
                <span style={{ fontFamily: 'monospace' }}>{revealedPins.has(s.id) ? (s.pin || '1234') : '••••'}</span>
                <button
                  type="button"
                  onClick={() => togglePinReveal(s.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#888', padding: '0 4px' }}
                >
                  {revealedPins.has(s.id) ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {s.cniDoc && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#27ae60' }}>✅ Pièce d&apos;identité chargée</div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-outline" onClick={() => setModal(s)}>✏️ Modifier</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>🗑️</button>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>Lien espace staff :</div>
              <input
                className="form-control"
                readOnly
                value={`${window.location.origin}/espace-staff/${s.id}`}
                style={{ fontSize: '10px', padding: '4px 8px' }}
                onClick={(e) => e.target.select()}
              />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: '#888', gridColumn: '1/-1', padding: '40px' }}>
            Aucun employé {filterPoste !== 'Tous' ? `pour le poste "${filterPoste}"` : 'enregistré'}
          </div>
        )}
      </div>

      {modal !== null && <StaffModal item={modal.id ? modal : null} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
