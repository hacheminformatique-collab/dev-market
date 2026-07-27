import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getClients, saveClients, getSettings, notifyEvent } from '../../utils/storage'
import { generatePDF } from '../PDF/generatePDF'
import { useIsMobile } from '../../hooks/useIsMobile'
import SignaturePad from '../SignaturePad'
import { getDocsLocal, fetchDocsServer, saveDocsAny, getReceiptsLocal, fetchReceiptsServer } from '../../utils/clientFiles'

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function getDocs(devisId) {
  const local = getDocsLocal(devisId)
  if (Object.keys(local).length > 0) return local
  try { return JSON.parse(localStorage.getItem(`paradise_docs_${devisId}`)) || {} } catch { return {} }
}

async function fetchDocsFromServer(devisId) {
  const docs = await fetchDocsServer(devisId)
  if (docs) return docs
  return fetchDocsServer(String(devisId || '').replace(/[^a-zA-Z0-9_]/g, '_'))
}

function getDataUrlSizeBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx < 0) return new TextEncoder().encode(dataUrl).length
  const base64 = dataUrl.slice(commaIdx + 1)
  const paddingMatch = base64.match(/=+$/)
  const padding = paddingMatch ? paddingMatch[0].length : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

async function compressImageDataUrl(dataUrl, targetBytes = 1_400_000) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl // PDF ou autre : pas de compression

  const profiles = [
    { maxWidthPx: 1400, quality: 0.78 },
    { maxWidthPx: 1200, quality: 0.72 },
    { maxWidthPx: 900, quality: 0.65 },
    { maxWidthPx: 700, quality: 0.55 },
  ]

  const sourceImage = await new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
  if (!sourceImage) return dataUrl

  let best = dataUrl
  let bestSize = getDataUrlSizeBytes(dataUrl)

  for (const profile of profiles) {
    const candidate = await new Promise((resolve) => {
      let w = sourceImage.width
      let h = sourceImage.height
      if (w > profile.maxWidthPx) {
        h = Math.round((h * profile.maxWidthPx) / w)
        w = profile.maxWidthPx
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(sourceImage, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', profile.quality))
    })

    const candidateSize = getDataUrlSizeBytes(candidate)
    if (candidateSize < bestSize) {
      best = candidate
      bestSize = candidateSize
    }
    if (bestSize <= targetBytes) break
  }

  return best
}

async function saveDocs(devisId, docs) {
  return saveDocsAny(devisId, docs)
}

function Voyant({ ok }) {
  return (
    <span style={{
      display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%',
      background: ok ? '#27ae60' : '#e74c3c', marginRight: '8px', flexShrink: 0,
    }} title={ok ? 'Document reçu' : 'Document manquant'} />
  )
}

function openDataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return
  try {
    const [meta, base64] = dataUrl.split(',')
    if (!meta || base64 === undefined) { window.open(dataUrl, '_blank', 'noopener,noreferrer'); return }
    const mimeMatch = meta.match(/data:([^;]+);base64/)
    if (!mimeMatch) { window.open(dataUrl, '_blank', 'noopener,noreferrer'); return }
    const mimeType = mimeMatch[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mimeType })
    const blobUrl = URL.createObjectURL(blob)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
  } catch {
    window.open(dataUrl, '_blank', 'noopener,noreferrer')
  }
}

function DocUploadRow({ label, docKey, docs, onChange }) {
  const uploaded = !!docs[docKey]

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(docKey, ev.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eee' }}>
      <Voyant ok={uploaded} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', fontSize: '14px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>{uploaded ? '✅ Document chargé' : '⏳ En attente'}</div>
      </div>
      <label style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
        <span style={{ background: uploaded ? '#27ae60' : '#1a1a2e', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
          {uploaded ? '🔄 Remplacer' : '📤 Charger'}
        </span>
      </label>
    </div>
  )
}

export default function EspaceClient() {
  const { devisId } = useParams()
  const navigate = useNavigate()
  const [clients, setClients] = useState(() => getClients())
  const devis = clients.find((c) => c.id === devisId || c.devisNumber === devisId)
  const settings = getSettings()

  const [signed, setSigned] = useState(!!devis?.signature)
  const [signatureData, setSignatureData] = useState(devis?.signature || null)
  const [pendingSignatureData, setPendingSignatureData] = useState(null)
  const [signaturePadKey, setSignaturePadKey] = useState(0)
  const [showSig, setShowSig] = useState(false)
  const [docs, setDocs] = useState(() => getDocs(devisId))
  const [receipts, setReceipts] = useState(() => getReceiptsLocal(devisId))
  const [activeTab, setActiveTab] = useState('devis')
  const [invites, setInvites] = useState(() => devis?.invites || [])
  const [newInvite, setNewInvite] = useState({ nom: '', prenom: '', categorie: 'adulte', allergies: '' })
  const isMobile = useIsMobile()

  useEffect(() => {
    function reload() {
      setClients(getClients())
    }
    window.addEventListener('storage', reload)
    window.addEventListener('focus', reload)
    return () => {
      window.removeEventListener('storage', reload)
      window.removeEventListener('focus', reload)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchDocsFromServer(devisId),
      fetchReceiptsServer(devis?.id || devisId),
      devis?.devisNumber ? fetchReceiptsServer(devis.devisNumber) : Promise.resolve(null),
    ]).then(([serverDocs, receiptsById, receiptsByNumber]) => {
      if (cancelled) return
      if (serverDocs) setDocs(serverDocs)
      const resolved = (receiptsById && Object.keys(receiptsById).length > 0)
        ? receiptsById
        : (receiptsByNumber && Object.keys(receiptsByNumber).length > 0)
          ? receiptsByNumber
          : {}
      setReceipts(resolved)
    })
    return () => { cancelled = true }
  }, [devisId, devis?.id, devis?.devisNumber])

  if (!devis) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f5f0' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <h2>Devis introuvable</h2>
          <p className="text-muted mt-1">Ce lien de devis n&apos;est pas valide ou a expiré.</p>
          <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>Retour à l&apos;accueil</button>
        </div>
      </div>
    )
  }

  const nbAdultes = parseInt(devis.nbAdultes) || devis.nbPersonnes || 0
  const nbEnfants = parseInt(devis.nbEnfants) || 0
  const nbPersonnes = nbAdultes + nbEnfants
  const prixSalle = devis.prixSalle || 0

  function calcMenuItemTotal(item) {
    if (!item.tarif) return 0
    if (item.section === 'Cocktail de bienvenu') return item.tarif * (nbAdultes + nbEnfants)
    if (item.section === 'Menu enfants') return item.tarif * nbEnfants
    if (item.section === 'Boissons') return 0
    return item.tarif * nbAdultes
  }

  const menuTotal = (devis.menus || []).reduce((s, m) => s + calcMenuItemTotal(m), 0)
  const gateauTotal = (devis.gateau?.tarif || 0) * nbPersonnes
  const prestationsTotal = (devis.prestations || []).reduce((s, p) => s + (p.tarif || 0), 0)
  const totalTTC = prixSalle + menuTotal + gateauTotal + prestationsTotal

  // Payments / balance
  const payments = devis.payments || []
  const totalPaid = payments.reduce((s, p) => s + (p.montant || 0), 0)
  const soldeRestant = totalTTC - totalPaid

  function handleSign() {
    if (!pendingSignatureData) return
    const sigData = pendingSignatureData
    const updated = clients.map((c) =>
      (c.id === devisId || c.devisNumber === devisId) ? { ...c, signature: sigData, status: 'signé_client', signedAt: new Date().toISOString() } : c
    )
    saveClients(updated)
    const signedDevis = updated.find((c) => c.id === devis?.id) || updated.find((c) => c.devisNumber === devis?.devisNumber)
    if (signedDevis) notifyEvent({ ...signedDevis, notificationType: 'devis_signe' })
    setClients(updated)
    setSignatureData(sigData)
    setSigned(true)
    setShowSig(false)
    setPendingSignatureData(null)
  }

  function clearSig() {
    setPendingSignatureData(null)
    setSignaturePadKey((key) => key + 1)
  }

  async function handleDocChange(docKey, dataUrl) {
    // Compresser l'image si c'est une image (les PDFs sont ignorés)
    const compressed = await compressImageDataUrl(dataUrl)

    const updated = { ...docs, [docKey]: compressed }
    setDocs(updated)

    const ok = await saveDocs(devisId, updated)
    if (!ok) {
      alert("⚠️ Le document n'a pas pu être envoyé au serveur. Il est sauvegardé localement mais ne sera peut-être pas visible depuis le dashboard.\n\nEssayez un fichier plus léger (image ou PDF) ou contactez l'équipe pour ajuster la limite serveur.")
    }

    // Store only lightweight markers in client record (NOT the actual base64 data)
    // This prevents paradise_clients.json from becoming too large for PHP POST limits
    const docMarkers = {}
    for (const k of Object.keys(updated)) {
      docMarkers[k] = true
    }
    const updatedClients = clients.map((c) =>
      (c.id === devisId || c.devisNumber === devisId) ? { ...c, documentsUploaded: docMarkers } : c
    )
    // Remove any legacy embedded documents field to reduce JSON size
    const cleanedClients = updatedClients.map((c) => {
      if (c.documents && (c.id === devisId || c.devisNumber === devisId)) {
        const cleaned = { ...c }
        delete cleaned.documents
        return cleaned
      }
      return c
    })
    saveClients(cleanedClients)
    setClients(cleanedClients)
  }

  function handleAddInvite() {
    if (!newInvite.nom || !newInvite.prenom) return
    const invite = { ...newInvite, id: Date.now().toString() }
    const updatedInvites = [...invites, invite]
    setInvites(updatedInvites)
    const updatedClients = clients.map((c) =>
      (c.id === devisId || c.devisNumber === devisId) ? { ...c, invites: updatedInvites } : c
    )
    saveClients(updatedClients)
    setClients(updatedClients)
    setNewInvite({ nom: '', prenom: '', categorie: 'adulte', allergies: '' })
  }

  function handleDeleteInvite(id) {
    const updatedInvites = invites.filter((inv) => inv.id !== id)
    setInvites(updatedInvites)
    const updatedClients = clients.map((c) =>
      (c.id === devisId || c.devisNumber === devisId) ? { ...c, invites: updatedInvites } : c
    )
    saveClients(updatedClients)
    setClients(updatedClients)
  }

  const statusColor = devis.status === 'validé_admin' ? '#27ae60' : devis.status === 'signé_client' ? '#f39c12' : devis.status === 'signé' ? '#27ae60' : devis.status === 'annulé' ? '#e74c3c' : '#c9a84c'
  const statusLabel = devis.status === 'brouillon_envoyé' ? 'Brouillon envoyé'
    : devis.status === 'signé_client' ? '⏳ En attente de validation'
    : devis.status === 'validé_admin' ? '✅ Réservation confirmée'
    : (devis.status || 'En cours')

  // Build WhatsApp link - normalize phone to international format (France)
  const rawPhone = (settings.whatsapp || '0782821582').replace(/\s/g, '')
  const intlPhone = rawPhone.startsWith('+') ? rawPhone.replace('+', '') : rawPhone.startsWith('0') ? `33${rawPhone.slice(1)}` : rawPhone
  const whatsappLink = `https://wa.me/${intlPhone}`

  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f0', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '20px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : 0 }}>
          <div>
            <div style={{ color: '#c9a84c', fontWeight: '800', fontSize: '20px' }}>LE PARADISE</div>
            <div style={{ color: '#aaa', fontSize: '12px' }}>Espace client</div>
          </div>
          <div style={{ color: 'white', textAlign: 'right' }}>
            <div style={{ fontWeight: '700' }}>{devis.prenom} {devis.nom}</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>{devis.devisNumber}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Status banner */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px',
          display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : 0,
          borderLeft: `4px solid ${statusColor}`
        }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px' }}>Devis {devis.devisNumber}</div>
            <div style={{ color: '#888', fontSize: '13px' }}>
              Créé le {new Date(devis.createdAt).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div>
            <span style={{ background: statusColor + '22', color: statusColor, padding: '6px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '14px' }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'white', borderRadius: '12px', padding: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {[
            { key: 'devis', label: '📋 Mon devis' },
            { key: 'documents', label: '📎 Documents' },
            { key: 'invites', label: `👥 Invités${invites.length > 0 ? ` (${invites.length})` : ''}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: activeTab === key ? '700' : '500', fontSize: isMobile ? '12px' : '14px',
                background: activeTab === key ? '#1a1a2e' : 'transparent',
                color: activeTab === key ? '#c9a84c' : '#888',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pending validation info */}
        {devis.status === 'signé_client' && (
          <div style={{ background: '#fff8e1', border: '1.5px solid #f39c12', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: '#8a6d00' }}>
            ⏳ <strong>Votre devis est signé et en attente de validation définitive par notre équipe.</strong> Nous vous enverrons une confirmation par email sous peu.
          </div>
        )}
        {devis.status === 'validé_admin' && (
          <div style={{ background: '#f0fff4', border: '1.5px solid #27ae60', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: '#155724' }}>
            ✅ <strong>Votre réservation est confirmée définitivement !</strong> Votre événement est enregistré dans notre agenda.
          </div>
        )}

        {/* Tab: Mon devis */}
        {activeTab === 'devis' && (
          <>
            {/* Event summary */}
            <div className="card mb-3">
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>🎉 Votre événement</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: '#888' }}>Type d&apos;événement</span>
                  <div style={{ fontWeight: '600' }}>{devis.typeEvenement}</div>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Date</span>
                  <div style={{ fontWeight: '600' }}>
                    {devis.dateEvenement ? new Date(devis.dateEvenement).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Nombre de personnes</span>
                  <div style={{ fontWeight: '600' }}>{devis.nbPersonnes}</div>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Formule</span>
                  <div style={{ fontWeight: '600' }}>{devis.formule?.nomFormule}</div>
                </div>
                {devis.heureDebut && (
                  <div>
                    <span style={{ color: '#888' }}>Horaires</span>
                    <div style={{ fontWeight: '600' }}>{devis.heureDebut} — {devis.heureFin}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="card mb-3">
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>💰 Détail tarifaire</h3>
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <tbody>
                  {prixSalle > 0 && (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 0' }}>Location salle — {devis.formule?.nomFormule}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '600' }}>{formatMoney(prixSalle)}</td>
                    </tr>
                  )}
                  {(devis.menus || []).filter((m) => m.tarif > 0).map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0', paddingLeft: '16px', color: '#666' }}>
                        {m.nomMenu}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: '#666' }}>{formatMoney(calcMenuItemTotal(m))}</td>
                    </tr>
                  ))}
                  {gateauTotal > 0 && (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0', paddingLeft: '16px', color: '#666' }}>
                        {devis.gateau?.nomGateau} × {nbPersonnes} pers.
                        {devis.gateauPersonnalisation && (
                          <div style={{ fontSize: '11px', color: '#aaa' }}>
                            Niv.2: {devis.gateauPersonnalisation.niv2} | Niv.3: {devis.gateauPersonnalisation.niv3} | Niv.4: {devis.gateauPersonnalisation.niv4}
                            {devis.gateauPersonnalisation.initiales ? ` | Initiales: ${devis.gateauPersonnalisation.initiales}` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: '#666' }}>{formatMoney(gateauTotal)}</td>
                    </tr>
                  )}
                  {(devis.prestations || []).map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0', paddingLeft: '16px', color: '#666' }}>{p.nomPresta}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: '#666' }}>{formatMoney(p.tarif)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#1a1a2e', color: 'white' }}>
                    <td style={{ padding: '14px 12px', fontWeight: '700', fontSize: '16px' }}>TOTAL TTC</td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: '800', fontSize: '20px', color: '#c9a84c' }}>
                      {formatMoney(totalTTC)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Balance */}
            <div className="card mb-3">
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>💳 Solde à régler</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                <span>Montant total</span>
                <span style={{ fontWeight: '600' }}>{formatMoney(totalTTC)}</span>
              </div>
              {payments.length > 0 && payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#27ae60', marginBottom: '4px' }}>
                  <span>✅ Règlement du {new Date(p.date).toLocaleDateString('fr-FR')} ({p.mode || ''})</span>
                  <span>- {formatMoney(p.montant)}</span>
                </div>
              ))}
              <div style={{ borderTop: '2px solid #1a1a2e', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', fontSize: '16px' }}>Solde restant</span>
                <span style={{ fontWeight: '800', fontSize: '22px', color: soldeRestant <= 0 ? '#27ae60' : '#e74c3c' }}>
                  {formatMoney(Math.max(0, soldeRestant))}
                </span>
              </div>
            </div>

            {/* Bank Info */}
            {(settings.bankInfo?.iban || settings.bankInfo?.titulaire) && (
              <div className="card mb-3">
                <h3 style={{ marginBottom: '12px', color: '#1a1a2e' }}>🏦 Coordonnées bancaires</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>Pour le règlement par virement :</p>
                <div style={{ fontSize: '14px', lineHeight: '1.8', background: '#f8f5f0', borderRadius: '8px', padding: '14px' }}>
                  {settings.bankInfo?.titulaire && <div><strong>Titulaire :</strong> {settings.bankInfo.titulaire}</div>}
                  {settings.bankInfo?.iban && <div><strong>IBAN :</strong> {settings.bankInfo.iban}</div>}
                  {settings.bankInfo?.bic && <div><strong>BIC :</strong> {settings.bankInfo.bic}</div>}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="card mb-3">
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>📋 Actions</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => generatePDF(devis)}
                >
                  📄 Télécharger le devis PDF
                </button>

                {devis.status !== 'signé' && (
                  <button
                    className="btn btn-dark"
                    onClick={() => setShowSig(true)}
                  >
                    ✍️ Signer le devis
                  </button>
                )}
              </div>
            </div>

            {/* Signature panel */}
            {showSig && (
              <div className="card mb-3">
                <h3 style={{ marginBottom: '8px', color: '#1a1a2e' }}>✍️ Signature électronique</h3>
                <p className="text-muted mb-2" style={{ fontSize: '13px' }}>
                  En signant ce devis, vous acceptez les conditions générales de vente.
                </p>
                <div style={{ border: '2px dashed #c9a84c', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
                  <SignaturePad key={signaturePadKey} onChange={setPendingSignatureData} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button className="btn btn-outline btn-sm" onClick={clearSig}>Effacer</button>
                  <button className="btn btn-primary" onClick={handleSign} disabled={!pendingSignatureData}>✅ Valider la signature</button>
                  <button className="btn btn-sm" style={{ background: '#eee', color: '#444' }} onClick={() => setShowSig(false)}>Annuler</button>
                </div>
              </div>
            )}

            {/* Signed confirmation */}
            {signed && signatureData && (
              <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ color: '#155724', fontWeight: '700', marginBottom: '8px' }}>✅ Devis signé électroniquement</div>
                <img src={signatureData} alt="Signature" style={{ maxWidth: '200px', border: '1px solid #ccc', borderRadius: '6px', background: 'white' }} />
                {devis.signedAt && (
                  <div style={{ color: '#155724', fontSize: '12px', marginTop: '8px' }}>
                    Signé le {new Date(devis.signedAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tab: Documents */}
        {activeTab === 'documents' && (
          <div className="card mb-3">
            <h3 style={{ marginBottom: '4px', color: '#1a1a2e' }}>📎 Documents officiels</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
              Veuillez charger les documents requis. Les voyants passent au vert une fois le fichier envoyé.
            </p>
            <DocUploadRow label="Carte d'identité — recto" docKey="cni_recto" docs={docs} onChange={handleDocChange} />
            <DocUploadRow label="Carte d'identité — verso" docKey="cni_verso" docs={docs} onChange={handleDocChange} />
            <DocUploadRow label="Attestation d'assurance" docKey="assurance" docs={docs} onChange={handleDocChange} />

            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', color: '#1a1a2e' }}>🧾 Reçus de paiement</h4>
              {Object.values(receipts || {}).length === 0 ? (
                <p style={{ fontSize: '13px', color: '#888' }}>Aucun reçu disponible pour le moment.</p>
              ) : (
                Object.values(receipts)
                  .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                  .map((receipt) => (
                    <div key={receipt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '13px' }}>
                        <div style={{ fontWeight: '600' }}>{receipt.receiptNumber || 'Reçu'}</div>
                        <div style={{ color: '#888' }}>{receipt.date ? new Date(receipt.date).toLocaleDateString('fr-FR') : '—'} — {formatMoney(receipt.montant)}</div>
                      </div>
                      <button className="btn btn-sm btn-outline" onClick={() => openDataUrl(receipt.dataUrl)}>📄 Ouvrir</button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Tab: Invités */}
        {activeTab === 'invites' && (
          <div>
            {/* Summary counter */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { label: 'Total invités', value: invites.length, color: '#1a1a2e' },
                { label: 'Adultes', value: invites.filter((i) => i.categorie === 'adulte').length, color: '#c9a84c' },
                { label: 'Enfants', value: invites.filter((i) => i.categorie === 'enfant').length, color: '#3498db' },
              ].map((stat) => (
                <div key={stat.label} className="card" style={{ flex: '1', minWidth: '100px', textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{stat.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Add invite form */}
            <div className="card mb-3">
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>➕ Ajouter un invité</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Prénom *</label>
                  <input className="form-control" value={newInvite.prenom}
                    onChange={(e) => setNewInvite((p) => ({ ...p, prenom: e.target.value }))}
                    placeholder="Prénom" />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Nom *</label>
                  <input className="form-control" value={newInvite.nom}
                    onChange={(e) => setNewInvite((p) => ({ ...p, nom: e.target.value }))}
                    placeholder="Nom" />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Catégorie</label>
                  <select className="form-control" value={newInvite.categorie}
                    onChange={(e) => setNewInvite((p) => ({ ...p, categorie: e.target.value }))}>
                    <option value="adulte">Adulte</option>
                    <option value="enfant">Enfant</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Allergies / régime (optionnel)</label>
                  <input className="form-control" value={newInvite.allergies}
                    onChange={(e) => setNewInvite((p) => ({ ...p, allergies: e.target.value }))}
                    placeholder="Ex: sans gluten, végétarien…" />
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAddInvite}
                disabled={!newInvite.nom || !newInvite.prenom}
              >
                ➕ Ajouter l&apos;invité
              </button>
            </div>

            {/* Guest list */}
            <div className="card">
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>👥 Liste des invités</h3>
              {invites.length === 0 ? (
                <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                  Aucun invité ajouté pour l&apos;instant.
                </p>
              ) : (
                <div>
                  {invites.map((inv) => (
                    <div key={inv.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 0', borderBottom: '1px solid #eee', gap: '8px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{inv.prenom} {inv.nom}</div>
                        <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: inv.categorie === 'adulte' ? '#c9a84c22' : '#3498db22',
                            color: inv.categorie === 'adulte' ? '#c9a84c' : '#3498db',
                            padding: '2px 8px', borderRadius: '10px', fontWeight: '600',
                          }}>
                            {inv.categorie === 'adulte' ? '👤 Adulte' : '🧒 Enfant'}
                          </span>
                          {inv.allergies && (
                            <span style={{ color: '#e67e22' }}>⚠️ {inv.allergies}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteInvite(inv.id)}
                        style={{ background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '13px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact + WhatsApp (always visible) */}
        <div className="card" style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '12px', color: '#1a1a2e' }}>📞 Contact</h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#555', marginBottom: '16px' }}>
            <p>📍 5 avenue Fridingen, 77100 Nanteuil les Meaux</p>
            <p>📞 0782821582</p>
            <p>✉️ contact@leparadise77.fr</p>
            <p>🏢 SARL AFM — RCS de Meaux : 904543816</p>
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              background: '#25D366', color: 'white', padding: '12px 20px',
              borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '14px',
            }}
          >
            <span style={{ fontSize: '20px' }}>💬</span>
            Une question ? Contactez-nous sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
