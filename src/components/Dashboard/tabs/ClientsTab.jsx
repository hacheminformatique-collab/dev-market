import { useState, useEffect, useRef } from 'react'
import { getClients, saveClients, getSettings, getPrestations, getMenus, getGateaux, refreshFromServer } from '../../../utils/storage'
import { generatePDF } from '../../PDF/generatePDF'
import { useIsMobile } from '../../../hooks/useIsMobile'

function getDocsKey(devisId) { return `paradise_docs_${devisId}` }
function getDocs(devisId) {
  try { return JSON.parse(localStorage.getItem(getDocsKey(devisId))) || {} } catch { return {} }
}

async function fetchDocsFromServer(devisId) {
  try {
    const key = getDocsKey(devisId)
    const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`)
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') {
        try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
        return data
      }
    }
  } catch { /* server unreachable - fall back to localStorage */ }
  return null
}

/**
 * Fetch docs from the server trying `id` first, then `devisNumber` as fallback.
 * This handles the case where the client uploaded documents from the mobile espace-client
 * (which uses `/espace-client/DEV-...` so the key is `paradise_docs_${devisNumber}`)
 * while the dashboard opens the record by internal `id` (timestamp).
 */
async function fetchDocsFromServerByAnyId({ id, devisNumber }) {
  if (id) {
    const localById = getDocs(id)
    if (Object.keys(localById).length > 0) return localById
    const data = await fetchDocsFromServer(id)
    if (data && typeof data === 'object' && Object.keys(data).length > 0) return data
  }
  if (devisNumber && devisNumber !== id) {
    const localByNum = getDocs(devisNumber)
    if (Object.keys(localByNum).length > 0) {
      // Mirror to the id key so future lookups are faster
      if (id) { try { localStorage.setItem(getDocsKey(id), JSON.stringify(localByNum)) } catch { /* ignore */ } }
      return localByNum
    }
    const data = await fetchDocsFromServer(devisNumber)
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      if (id) { try { localStorage.setItem(getDocsKey(id), JSON.stringify(data)) } catch { /* ignore */ } }
      return data
    }
  }
  return null
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function Voyant({ ok }) {
  return (
    <span style={{
      display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
      background: ok ? '#27ae60' : '#e74c3c', marginRight: '6px', flexShrink: 0,
    }} title={ok ? 'Reçu' : 'Manquant'} />
  )
}

function calcTotal(devis) {
  const nbAdultes = parseInt(devis.nbAdultes) || devis.nbPersonnes || 0
  const nbEnfants = parseInt(devis.nbEnfants) || 0
  const nbP = nbAdultes + nbEnfants
  const prixSalle = devis.prixSalle || 0
  const menuTotal = (devis.menus || []).reduce((s, m) => {
    if (!m.tarif) return s
    if (m.section === 'Cocktail de bienvenu') return s + m.tarif * (nbAdultes + nbEnfants)
    if (m.section === 'Menu enfants') return s + m.tarif * nbEnfants
    if (m.section === 'Boissons') return s
    return s + m.tarif * nbAdultes
  }, 0)
  const gateauTotal = (devis.gateau?.tarif || 0) * nbP
  const prestationsTotal = (devis.prestations || []).reduce((s, p) => s + (p.tarif || 0), 0)
  return prixSalle + menuTotal + gateauTotal + prestationsTotal
}

function PaymentBar({ client }) {
  const total = calcTotal(client)
  const paid = (client.payments || []).reduce((s, p) => s + (p.montant || 0), 0)
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const color = pct >= 100 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c'
  return (
    <div style={{ minWidth: '90px' }}>
      <div style={{ background: '#eee', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '11px', color, marginTop: '2px', textAlign: 'right' }}>{pct}%</div>
    </div>
  )
}

function buildWhatsAppLink(phone, message) {
  const raw = (phone || '').replace(/\s/g, '')
  const intl = raw.startsWith('+') ? raw.replace('+', '') : raw.startsWith('0') ? `33${raw.slice(1)}` : raw
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

function buildMailtoLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Convert a base64 data URL to a Blob URL so it can be safely opened in a new tab.
 * Many browsers silently produce an about:blank tab when window.open() is called
 * with a long data URL.  Using a Blob URL avoids this browser limitation.
 *
 * The returned Blob URL is automatically revoked after 60 seconds to prevent
 * memory leaks (the tab will already have started loading by then).
 *
 * Returns null if the supplied string is not a valid data URL.
 */
function dataUrlToBlobUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null
  try {
    const [meta, base64] = dataUrl.split(',')
    if (!meta || base64 === undefined) return null
    const mimeMatch = meta.match(/data:([^;]+);base64/)
    if (!mimeMatch) return null
    const mimeType = mimeMatch[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mimeType })
    const blobUrl = URL.createObjectURL(blob)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    return blobUrl
  } catch {
    return null
  }
}

function openDoc(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    alert('Document invalide ou manquant.')
    return
  }
  const blobUrl = dataUrlToBlobUrl(dataUrl)
  if (!blobUrl) {
    alert('Impossible d\'ouvrir le document.')
    return
  }
  window.open(blobUrl, '_blank', 'noopener,noreferrer')
}

export default function ClientsTab() {
  const [clients, setClients] = useState(getClients())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [newPayment, setNewPayment] = useState({ date: new Date().toISOString().split('T')[0], montant: '', mode: 'Virement' })
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)
  const [fetchedDocs, setFetchedDocs] = useState({})
  const [fetchingDocKey, setFetchingDocKey] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const selectedRef = useRef(null)
  const isMobile = useIsMobile()

  const settings = getSettings()

  useEffect(() => { selectedRef.current = selected }, [selected]) // Keep ref in sync for interval callback to avoid stale closure

  // Clear fetched docs cache when selected client changes
  useEffect(() => { setFetchedDocs({}) }, [selected?.id])

  useEffect(() => {
    function reload() {
      const fresh = getClients()
      setClients(fresh)
      if (selectedRef.current) {
        const refreshed = fresh.find((c) => c.id === selectedRef.current.id)
        if (refreshed) setSelected(refreshed)
      }
    }
    const id = setInterval(reload, 5000)
    window.addEventListener('focus', reload)
    return () => { clearInterval(id); window.removeEventListener('focus', reload) }
  }, [])

  async function handleViewDoc(docKey) {
    setFetchingDocKey(docKey)
    const current = selectedRef.current
    try {
      const serverDocs = await fetchDocsFromServerByAnyId({ id: current?.id, devisNumber: current?.devisNumber })
      if (serverDocs && serverDocs[docKey]) {
        setFetchedDocs((prev) => ({ ...prev, ...serverDocs }))
        openDoc(serverDocs[docKey])
      } else {
        alert('Document introuvable sur le serveur.')
      }
    } finally {
      setFetchingDocKey(null)
    }
  }

  async function handleManualRefresh() {
    setRefreshing(true)
    try {
      await refreshFromServer()
      const fresh = getClients()
      setClients(fresh)
      if (selectedRef.current) {
        const refreshed = fresh.find((c) => c.id === selectedRef.current.id)
        if (refreshed) setSelected(refreshed)
      }
    } catch {
      alert('Impossible de contacter le serveur. Veuillez réessayer.')
    } finally {
      setRefreshing(false)
    }
  }

  function handleDelete(id) {
    if (!confirm('Supprimer ce devis ?')) return
    const updated = clients.filter((c) => c.id !== id)
    saveClients(updated)
    setClients(updated)
    if (selected?.id === id) setSelected(null)
  }

  function handleStatusChange(id, status) {
    const updated = clients.map((c) => c.id === id ? { ...c, status } : c)
    saveClients(updated)
    setClients(updated)
    if (selected?.id === id) setSelected((prev) => ({ ...prev, status }))
  }

  function handleAddPayment() {
    const montant = parseFloat(newPayment.montant)
    if (!montant || montant <= 0) return
    const payment = { ...newPayment, montant }
    const updated = clients.map((c) =>
      c.id === selected.id ? { ...c, payments: [...(c.payments || []), payment] } : c
    )
    saveClients(updated)
    setClients(updated)
    const updatedSelected = updated.find((c) => c.id === selected.id)
    setSelected(updatedSelected)
    setNewPayment({ date: new Date().toISOString().split('T')[0], montant: '', mode: 'Virement' })
  }

  function handleDeletePayment(idx) {
    const updated = clients.map((c) =>
      c.id === selected.id ? { ...c, payments: (c.payments || []).filter((_, i) => i !== idx) } : c
    )
    saveClients(updated)
    setClients(updated)
    const updatedSelected = updated.find((c) => c.id === selected.id)
    setSelected(updatedSelected)
  }

  function sendDocumentReminder(client) {
    const docs = getDocs(client.id)
    const missing = []
    if (!docs.cni_recto) missing.push('carte d\'identité recto')
    if (!docs.cni_verso) missing.push('carte d\'identité verso')
    if (!docs.assurance) missing.push('attestation d\'assurance')
    if (missing.length === 0) { alert('Tous les documents sont déjà reçus.'); return }

    const espaceUrl = `${window.location.origin}/espace-client/${client.devisNumber}`
    const missingList = missing.map((m) => `- ${m}`).join('\n')
    const message = `Bonjour ${client.prenom} ${client.nom},\n\nAfin de finaliser votre dossier pour votre événement du ${client.dateEvenement ? new Date(client.dateEvenement).toLocaleDateString('fr-FR') : '...'}, nous vous invitons à charger les documents manquants suivants :\n${missingList}\n\nVous pouvez les déposer directement sur votre espace client :\n${espaceUrl}\n\nCordialement,\nLe Paradise`

    const phone = client.telephone
    if (phone) {
      window.open(buildWhatsAppLink(phone, message), '_blank')
    } else if (client.email) {
      window.open(buildMailtoLink(client.email, 'Documents manquants — Le Paradise', message))
    } else {
      alert('Aucun moyen de contact disponible pour ce client.')
    }
  }

  function sendPaymentReminder(client) {
    const total = calcTotal(client)
    const paid = (client.payments || []).reduce((s, p) => s + (p.montant || 0), 0)
    const solde = total - paid
    if (solde <= 0) { alert('Ce client n\'a pas de solde restant.'); return }

    const bankInfo = settings.bankInfo || {}
    const message = `Bonjour ${client.prenom} ${client.nom},\n\nNous vous rappelons que votre versement mensuel est attendu.\n\nSolde restant : ${solde.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €\n\nCoordonnées bancaires :\nTitulaire : ${bankInfo.titulaire || 'SARL AFM'}\nIBAN : ${bankInfo.iban || '—'}\nBIC : ${bankInfo.bic || '—'}\n\nMerci de bien vouloir procéder à votre règlement.\n\nCordialement,\nLe Paradise`

    const phone = client.telephone
    if (phone) {
      window.open(buildWhatsAppLink(phone, message), '_blank')
    } else if (client.email) {
      window.open(buildMailtoLink(client.email, 'Rappel versement mensuel — Le Paradise', message))
    } else {
      alert('Aucun moyen de contact disponible pour ce client.')
    }
  }

  function startEditDevis() {
    setEditData({
      nbAdultes: String(parseInt(selected.nbAdultes) || selected.nbPersonnes || 0),
      nbEnfants: String(parseInt(selected.nbEnfants) || 0),
      prixSalle: String(selected.prixSalle || 0),
      prestations: [...(selected.prestations || [])],
      menus: [...(selected.menus || [])],
      gateau: selected.gateau || null,
    })
    setEditMode(true)
  }

  function handleSaveDevis() {
    const nbA = parseInt(editData.nbAdultes) || 0
    const nbE = parseInt(editData.nbEnfants) || 0
    const updated = clients.map((c) =>
      c.id === selected.id ? {
        ...c,
        nbAdultes: nbA,
        nbEnfants: nbE,
        nbPersonnes: nbA + nbE,
        prixSalle: parseFloat(editData.prixSalle) || 0,
        prestations: editData.prestations,
        menus: editData.menus,
        gateau: editData.gateau,
      } : c
    )
    saveClients(updated)
    setClients(updated)
    const refreshed = updated.find((c) => c.id === selected.id)
    setSelected(refreshed)
    setEditMode(false)
    setEditData(null)
  }

  function toggleEditPrestation(presta) {
    const exists = editData.prestations.some((p) => p.id === presta.id)
    setEditData((prev) => ({
      ...prev,
      prestations: exists
        ? prev.prestations.filter((p) => p.id !== presta.id)
        : [...prev.prestations, presta],
    }))
  }

  function toggleEditMenu(menu) {
    const exists = editData.menus.some((m) => m.id === menu.id)
    setEditData((prev) => ({
      ...prev,
      menus: exists
        ? prev.menus.filter((m) => m.id !== menu.id)
        : [...prev.menus, menu],
    }))
  }

  const filtered = clients.filter((c) =>
    (c.nom || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.prenom || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.devisNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const statusColor = (s) => {
    if (s === 'signé') return 'badge-green'
    if (s === 'annulé') return 'badge-red'
    return 'badge-gold'
  }

  return (
    <div>
      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>Clients & Devis ({clients.length})</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={handleManualRefresh}
            disabled={refreshing}
            style={{ whiteSpace: 'nowrap' }}
          >
            {refreshing ? '⏳ Actualisation…' : '🔄 Rafraîchir maintenant'}
          </button>
          <input
            className="form-control"
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: isMobile ? '100%' : '240px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected && !isMobile ? '1fr 420px' : '1fr', gap: '20px' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                <th>Date événement</th>
                <th>Total TTC</th>
                <th>Règlement</th>
                <th>Statut</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                  <td><strong style={{ color: '#c9a84c' }}>{c.devisNumber}</strong></td>
                  <td>{c.prenom} {c.nom}</td>
                  <td>{c.dateEvenement ? new Date(c.dateEvenement).toLocaleDateString('fr-FR') : '—'}</td>
                  <td><strong>{(calcTotal(c) || 0).toLocaleString('fr-FR')} €</strong></td>
                  <td><PaymentBar client={c} /></td>
                  <td>
                    <span className={`badge ${statusColor(c.status)}`}>{c.status || 'en cours'}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => generatePDF(c)} title="PDF">📄</button>
                      <button className="btn btn-sm" style={{ background: '#25D366', color: 'white' }} onClick={() => sendDocumentReminder(c)} title="Relance documents">📎</button>
                      <button className="btn btn-sm" style={{ background: '#3498db', color: 'white' }} onClick={() => sendPaymentReminder(c)} title="Relance paiement">💳</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)} title="Supprimer">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted" style={{ padding: '32px' }}>Aucun devis trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ position: 'sticky', top: '0', alignSelf: 'start', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between mb-2">
              <h4 style={{ color: '#1a1a2e' }}>{selected.devisNumber}</h4>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }} onClick={() => { setSelected(null); setEditMode(false); setEditData(null) }}>✕</button>
            </div>

            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <p><strong>Client :</strong> {selected.prenom} {selected.nom}</p>
              <p><strong>Email :</strong> {selected.email}</p>
              <p><strong>Téléphone :</strong> {selected.telephone}</p>
              <p><strong>Événement :</strong> {selected.typeEvenement}</p>
              <p><strong>Date :</strong> {selected.dateEvenement ? new Date(selected.dateEvenement).toLocaleDateString('fr-FR') : '—'}</p>
              <p><strong>Formule :</strong> {selected.formule?.nomFormule}</p>

              {editMode && editData ? (
                <div style={{ background: '#f8f5f0', borderRadius: '8px', padding: '12px', marginTop: '8px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '10px', color: '#1a1a2e' }}>✏️ Modifier le devis</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#888' }}>Adultes</label>
                      <input type="number" min="0" className="form-control" value={editData.nbAdultes}
                        onChange={(e) => setEditData((d) => ({ ...d, nbAdultes: e.target.value }))}
                        style={{ fontSize: '12px', padding: '6px 10px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#888' }}>Enfants</label>
                      <input type="number" min="0" className="form-control" value={editData.nbEnfants}
                        onChange={(e) => setEditData((d) => ({ ...d, nbEnfants: e.target.value }))}
                        style={{ fontSize: '12px', padding: '6px 10px' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', color: '#888' }}>Prix salle (€)</label>
                    <input type="number" min="0" className="form-control" value={editData.prixSalle}
                      onChange={(e) => setEditData((d) => ({ ...d, prixSalle: e.target.value }))}
                      style={{ fontSize: '12px', padding: '6px 10px' }} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>Menus</label>
                    {getMenus().map((m) => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={editData.menus.some((em) => em.id === m.id)}
                          onChange={() => toggleEditMenu(m)} />
                        {m.nomMenu}{m.tarif > 0 ? ` — ${m.tarif} €/pers.` : ' (Inclus)'}
                      </label>
                    ))}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>Gâteau</label>
                    <select className="form-control" style={{ fontSize: '12px', padding: '6px 10px' }}
                      value={editData.gateau?.id || ''}
                      onChange={(e) => {
                        const g = getGateaux().find((x) => x.id === e.target.value) || null
                        setEditData((d) => ({ ...d, gateau: g }))
                      }}>
                      <option value="">— Aucun —</option>
                      {getGateaux().map((g) => (
                        <option key={g.id} value={g.id}>{g.nomGateau} — {g.tarif} €/pers.</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>Prestations</label>
                    {getPrestations().map((p) => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={editData.prestations.some((ep) => ep.id === p.id)}
                          onChange={() => toggleEditPrestation(p)} />
                        {p.nomPresta} — {p.tarif} €
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveDevis}>💾 Sauvegarder</button>
                    <button className="btn btn-sm" style={{ background: '#eee', color: '#444' }} onClick={() => { setEditMode(false); setEditData(null) }}>Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  <p><strong>Invités :</strong> {selected.nbPersonnes} ({parseInt(selected.nbAdultes) || selected.nbPersonnes || 0} adultes + {parseInt(selected.nbEnfants) || 0} enfants)</p>
                  {selected.menus?.length > 0 && (
                    <div>
                      <strong>Menus :</strong>
                      <ul style={{ paddingLeft: '16px' }}>
                        {selected.menus.map((m) => (
                          <li key={m.id}>{m.nomMenu} — {m.tarif > 0 ? `${m.tarif} €/pers.` : 'Inclus'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.gateau && <p><strong>Gâteau :</strong> {selected.gateau.nomGateau}</p>}
                  {selected.prestations?.length > 0 && (
                    <div>
                      <strong>Prestations :</strong>
                      <ul style={{ paddingLeft: '16px' }}>
                        {selected.prestations.map((p) => (
                          <li key={p.id}>{p.nomPresta} — {p.tarif} €</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <hr style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0 }}><strong>Total TTC :</strong> <span style={{ color: '#c9a84c', fontWeight: '700', fontSize: '18px' }}>{formatMoney(calcTotal(selected))}</span></p>
                    <button className="btn btn-sm btn-outline" onClick={startEditDevis}>✏️ Modifier le devis</button>
                  </div>
                </>
              )}
            </div>

            {/* Payment progress */}
            {(() => {
              const total = calcTotal(selected)
              const paid = (selected.payments || []).reduce((s, p) => s + (p.montant || 0), 0)
              const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
              const color = pct >= 100 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c'
              return (
                <div style={{ marginTop: '12px', background: '#f8f5f0', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Progression règlements</span>
                    <span style={{ color, fontWeight: '700' }}>{formatMoney(paid)} / {formatMoney(total)}</span>
                  </div>
                  <div style={{ background: '#ddd', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '11px', color, textAlign: 'right', marginTop: '2px' }}>{pct}% réglé</div>
                </div>
              )
            })()}

            {/* Payments section */}
            <div style={{ marginTop: '16px' }}>
              <h5 style={{ color: '#1a1a2e', marginBottom: '10px' }}>💳 Règlements</h5>
              {(selected.payments || []).length === 0 && (
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>Aucun règlement enregistré</p>
              )}
              {(selected.payments || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                  <span>{new Date(p.date).toLocaleDateString('fr-FR')} — {p.mode}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#27ae60', fontWeight: '600' }}>{formatMoney(p.montant)}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: '14px' }} onClick={() => handleDeletePayment(i)}>✕</button>
                  </div>
                </div>
              ))}
              {/* Solde */}
              {(() => {
                const total = calcTotal(selected)
                const paid = (selected.payments || []).reduce((s, p) => s + p.montant, 0)
                const solde = total - paid
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontWeight: '700', fontSize: '14px' }}>
                    <span>Solde restant</span>
                    <span style={{ color: solde <= 0 ? '#27ae60' : '#e74c3c' }}>{formatMoney(Math.max(0, solde))}</span>
                  </div>
                )
              })()}
              {/* Add payment form */}
              <div style={{ marginTop: '12px', background: '#f8f5f0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Ajouter un règlement</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#888' }}>Date</label>
                    <input type="date" className="form-control" value={newPayment.date} onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })} style={{ fontSize: '12px', padding: '6px 10px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#888' }}>Montant (€)</label>
                    <input type="number" className="form-control" value={newPayment.montant} onChange={(e) => setNewPayment({ ...newPayment, montant: e.target.value })} placeholder="0" style={{ fontSize: '12px', padding: '6px 10px' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', color: '#888' }}>Mode de paiement</label>
                  <select className="form-control" value={newPayment.mode} onChange={(e) => setNewPayment({ ...newPayment, mode: e.target.value })} style={{ fontSize: '12px', padding: '6px 10px' }}>
                    <option>Virement</option>
                    <option>Chèque</option>
                    <option>Espèces</option>
                    <option>CB</option>
                  </select>
                </div>
                <button className="btn btn-primary btn-sm w-100" style={{ justifyContent: 'center' }} onClick={handleAddPayment}>+ Ajouter</button>
              </div>
            </div>

            {/* Reminders */}
            <div style={{ marginTop: '16px' }}>
              <h5 style={{ color: '#1a1a2e', marginBottom: '10px' }}>📲 Relances</h5>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-sm" style={{ background: '#25D366', color: 'white' }} onClick={() => sendDocumentReminder(selected)}>
                  📎 Relance documents
                </button>
                <button className="btn btn-sm" style={{ background: '#3498db', color: 'white' }} onClick={() => sendPaymentReminder(selected)}>
                  💳 Relance versement
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>S&apos;ouvre WhatsApp si un téléphone est renseigné, sinon email.</p>
            </div>

            {/* Documents status */}
            <div style={{ marginTop: '16px' }}>
              <h5 style={{ color: '#1a1a2e', marginBottom: '10px' }}>📎 Documents client</h5>
              {(() => {
                // Use documentsUploaded markers (lightweight booleans) for status indicators.
                // For legacy records that still have an embedded documents object, fall back
                // to detecting presence there, but never embed base64 data again.
                const markers = selected.documentsUploaded || {}
                const legacyDocs = selected.documents || {}
                const isUploaded = (key) => !!(markers[key] || legacyDocs[key] || fetchedDocs[key])
                return (
                  <div style={{ fontSize: '13px' }}>
                    {[['cni_recto', "CNI recto"], ['cni_verso', "CNI verso"], ['assurance', "Attestation assurance"]].map(([key, label]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                        <Voyant ok={isUploaded(key)} />
                        <span>{label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: isUploaded(key) ? '#27ae60' : '#e74c3c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isUploaded(key) ? '✅ Reçu' : '⏳ Manquant'}
                          {isUploaded(key) && (
                            <button
                              style={{ background: 'none', border: '1px solid #3498db', color: '#3498db', borderRadius: '4px', padding: '1px 6px', fontSize: '11px', cursor: 'pointer' }}
                              disabled={fetchingDocKey === key}
                              onClick={() => {
                                // If we already have the data URL (fetched or legacy), open directly
                                if (fetchedDocs[key]) {
                                  openDoc(fetchedDocs[key])
                                } else if (legacyDocs[key]) {
                                  openDoc(legacyDocs[key])
                                } else {
                                  handleViewDoc(key)
                                }
                              }}
                            >
                              {fetchingDocKey === key ? '⏳' : '👁️ Voir'}
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Signature */}
            <div style={{ marginTop: '16px' }}>
              <h5 style={{ color: '#1a1a2e', marginBottom: '10px' }}>✍️ Signature</h5>
              {selected.signature ? (
                <div style={{ fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#27ae60', flexShrink: 0 }} />
                    <span style={{ color: '#27ae60', fontWeight: '600' }}>Devis signé</span>
                  </div>
                  <img src={selected.signature} alt="Signature client" style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: '6px', background: 'white', display: 'block' }} />
                  {selected.signedAt && (
                    <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                      Signé le {new Date(selected.signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#e74c3c', flexShrink: 0 }} />
                  <span style={{ color: '#888' }}>⏳ En attente de signature</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Statut du devis</label>
              <select
                className="form-control"
                value={selected.status || 'en cours'}
                onChange={(e) => handleStatusChange(selected.id, e.target.value)}
              >
                <option value="en cours">En cours</option>
                <option value="signé">Signé</option>
                <option value="annulé">Annulé</option>
              </select>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary btn-sm w-100" style={{ justifyContent: 'center' }} onClick={() => generatePDF(selected)}>
                📄 Télécharger le devis PDF
              </button>
            </div>

            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#888' }}>
                Lien espace client :
              </p>
              <input
                className="form-control"
                readOnly
                value={`${window.location.origin}/espace-client/${selected.devisNumber}`}
                style={{ fontSize: '11px' }}
                onClick={(e) => e.target.select()}
              />
              {selected.telephone && (
                <a
                  href={buildWhatsAppLink(selected.telephone, `Bonjour ${selected.prenom}, voici le lien vers votre espace client Le Paradise : ${window.location.origin}/espace-client/${selected.devisNumber}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px',
                    background: '#25D366', color: 'white', padding: '8px 14px',
                    borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px',
                  }}
                >
                  💬 Envoyer le lien espace client via WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

