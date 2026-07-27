import { useEffect, useState } from 'react'
import { getClients, saveClients, generateDevisNumber, notifyEvent } from '../../../utils/storage'
import { generatePDF } from '../../PDF/generatePDF'
import SignaturePad from '../../SignaturePad'

function vatBreakdown(ttc, rate) {
  const ht = ttc / (1 + rate)
  const tva = ttc - ht
  return { ht, tva, ttc }
}

function calcMenuItemTotal(item, nbAdultes, nbEnfants) {
  if (!item.tarif) return 0
  if (item.section === 'Cocktail de bienvenu') return item.tarif * (nbAdultes + nbEnfants)
  if (item.section === 'Menu enfants') return item.tarif * nbEnfants
  if (item.section === 'Boissons') return 0
  return item.tarif * nbAdultes
}

export default function Step7Summary({ data, onBack, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [devisId, setDevisId] = useState(null)
  const [devisNumber, setDevisNumber] = useState(null)
  const [submissionType, setSubmissionType] = useState('signé')
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [pendingSignedDevis, setPendingSignedDevis] = useState(null)

  const nbAdultes = parseInt(data.nbAdultes) || data.nbPersonnes || 0
  const nbEnfants = parseInt(data.nbEnfants) || 0
  const nbPersonnes = nbAdultes + nbEnfants
  const prixSalle = data.prixSalle || 0

  const menuTotal = (data.menus || []).reduce((sum, m) => sum + calcMenuItemTotal(m, nbAdultes, nbEnfants), 0)
  const gateauTotal = (data.gateau?.tarif || 0) * nbPersonnes
  const traiteurTotal = menuTotal + gateauTotal
  const prestationsTotal = (data.prestations || []).reduce((sum, p) => sum + (p.tarif || 0), 0)
  const totalTTC = prixSalle + traiteurTotal + prestationsTotal

  const salle = vatBreakdown(prixSalle, 0.20)
  const traiteur = vatBreakdown(traiteurTotal, 0.10)
  const options = vatBreakdown(prestationsTotal, 0.20)

  const totalHT = salle.ht + traiteur.ht + options.ht
  const totalTVA = salle.tva + traiteur.tva + options.tva

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function buildDevis(status, signature = null) {
    const now = new Date().toISOString()
    const id = Date.now().toString()
    return {
      id,
      devisNumber: generateDevisNumber(),
      createdAt: now,
      status,
      ...data,
      totalTTC,
      totalHT,
      totalTVA,
      signature,
      signedAt: status === 'signé' ? now : null,
    }
  }

  function finalizeDevis(devis, notificationType) {
    const clients = getClients()
    saveClients([...clients, devis])
    notifyEvent({ ...devis, notificationType })
    setDevisId(devis.id)
    setDevisNumber(devis.devisNumber)
    setSubmitted(true)
    setSubmitting(false)
    if (onSubmit) onSubmit(devis)
  }

  function handleSendByMail() {
    setSubmitError('')
    setSubmitting(true)
    const devis = buildDevis('brouillon_envoyé', null)
    finalizeDevis(devis, 'devis_brouillon')
    setSubmissionType('brouillon_envoyé')
  }

  function openValidationPreview() {
    if (!signatureDataUrl) {
      setSubmitError('Veuillez signer le devis avant de le valider.')
      return
    }
    setSubmitError('')
    const devis = buildDevis('signé', signatureDataUrl)
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const doc = generatePDF(devis, { download: false })
      const blob = doc.output('blob')
      setPreviewUrl(URL.createObjectURL(blob))
      setPendingSignedDevis(devis)
      setPreviewOpen(true)
    } catch (e) {
      console.error(`Failed to generate preview PDF for devis ${devis.devisNumber}`, e)
      setSubmitError('Impossible de générer l’aperçu PDF. Veuillez réessayer.')
    }
  }

  function confirmSignedDevis() {
    if (!pendingSignedDevis) return
    setSubmitting(true)
    finalizeDevis(pendingSignedDevis, 'devis_signe')
    try { generatePDF(pendingSignedDevis) } catch (e) { console.error(`Failed to generate signed PDF for devis ${pendingSignedDevis.devisNumber}`, e) }
    setSubmissionType('signé')
    setPreviewOpen(false)
  }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ color: '#1a1a2e', marginBottom: '8px' }}>
          {submissionType === 'signé' ? 'Devis validé avec succès !' : 'Devis envoyé par mail !'}
        </h2>
        <p className="text-muted mb-3">
          {submissionType === 'signé'
            ? 'Votre devis signé a été enregistré. Vous pouvez poursuivre dans votre espace client.'
            : 'Votre devis a été enregistré sans signature. Retrouvez-le dans votre espace client pour le valider.'}
        </p>
        <div style={{ background: '#fdf3d9', borderRadius: '10px', padding: '16px', display: 'inline-block', marginBottom: '24px' }}>
          <strong>Numéro de devis : </strong>
          <span style={{ color: '#c9a84c', fontWeight: '800' }}>{devisNumber}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`/espace-client/${devisNumber || devisId}`} className="btn btn-primary">
            👤 Accéder à l&apos;espace client
          </a>
          <a href="/" className="btn btn-outline">
            🏠 Retour à l&apos;accueil
          </a>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Récapitulatif de votre devis</h2>
      <p className="text-muted mb-3">Vérifiez votre commande avant de continuer</p>

      <div className="card mb-2">
        <h4 style={{ marginBottom: '12px', color: '#1a1a2e' }}>👤 Vos informations</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
          <div><span className="text-muted">Nom : </span>{data.prenom} {data.nom}</div>
          <div><span className="text-muted">Email : </span>{data.email}</div>
          <div><span className="text-muted">Téléphone : </span>{data.telephone}</div>
          {data.adresse && <div><span className="text-muted">Adresse : </span>{data.adresse}</div>}
        </div>
      </div>

      <div className="card mb-2">
        <h4 style={{ marginBottom: '12px', color: '#1a1a2e' }}>🎉 Votre événement</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
          <div><span className="text-muted">Type : </span>{data.typeEvenement}</div>
          <div><span className="text-muted">Date : </span>{data.dateEvenement ? new Date(data.dateEvenement).toLocaleDateString('fr-FR') : '—'}</div>
          <div><span className="text-muted">Personnes : </span>{data.nbPersonnes}</div>
          {data.heureDebut && <div><span className="text-muted">Horaires : </span>{data.heureDebut} — {data.heureFin}</div>}
        </div>
      </div>

      <div className="card mb-2">
        <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>💰 Détail tarifaire</h4>
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f5f0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Désignation</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>HT</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>TVA</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>TTC</th>
            </tr>
          </thead>
          <tbody>
            {prixSalle > 0 && (
              <tr>
                <td style={{ padding: '8px 12px' }}>
                  Location salle — {data.formule?.nomFormule}
                  <div style={{ fontSize: '12px', color: '#888' }}>TVA 20%</div>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{salle.ht.toFixed(2)} €</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{salle.tva.toFixed(2)} €</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{prixSalle.toLocaleString('fr-FR')} €</td>
              </tr>
            )}
            {traiteurTotal > 0 && (
              <tr>
                <td style={{ padding: '8px 12px' }}>
                  Traiteur & Gâteau ({nbPersonnes} pers.)
                  {data.gateau && data.gateauPersonnalisation && (
                    <div style={{ fontSize: '11px', color: '#aaa' }}>
                      {data.gateau.nomGateau} — Niv.2: {data.gateauPersonnalisation.niv2} | Niv.3: {data.gateauPersonnalisation.niv3} | Niv.4: {data.gateauPersonnalisation.niv4}
                      {data.gateauPersonnalisation.initiales ? ` | Initiales: ${data.gateauPersonnalisation.initiales}` : ''}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#888' }}>TVA 10%</div>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{traiteur.ht.toFixed(2)} €</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{traiteur.tva.toFixed(2)} €</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{traiteurTotal.toLocaleString('fr-FR')} €</td>
              </tr>
            )}
            {prestationsTotal > 0 && (
              <tr>
                <td style={{ padding: '8px 12px' }}>
                  Prestations & Options
                  <div style={{ fontSize: '12px', color: '#888' }}>TVA 20%</div>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{options.ht.toFixed(2)} €</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{options.tva.toFixed(2)} €</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{prestationsTotal.toLocaleString('fr-FR')} €</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid #1a1a2e', background: '#1a1a2e', color: 'white' }}>
              <td style={{ padding: '12px', fontWeight: '700' }}>TOTAL</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>{totalHT.toFixed(2)} €</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>{totalTVA.toFixed(2)} €</td>
              <td style={{ padding: '12px', textAlign: 'right', fontSize: '18px', fontWeight: '800', color: '#c9a84c' }}>
                {totalTTC.toLocaleString('fr-FR')} €
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card mb-2">
        <h4 style={{ marginBottom: '12px', color: '#1a1a2e' }}>✍️ Signature (pour validation immédiate)</h4>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>Bon pour accord — veuillez signer si vous souhaitez valider maintenant.</p>
        <SignaturePad onChange={(value) => {
          setSignatureDataUrl(value)
          if (value) setSubmitError('')
        }}
        />
        {signatureDataUrl && <p style={{ color: '#27ae60', fontWeight: '600', marginTop: '8px', fontSize: '13px' }}>✅ Signature enregistrée</p>}
        {submitError && <p style={{ color: '#c0392b', fontWeight: '600', marginTop: '8px', fontSize: '13px' }}>{submitError}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn btn-outline" onClick={onBack}>← Retour</button>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-dark" onClick={handleSendByMail} disabled={submitting}>
            {submitting ? '⏳ Envoi...' : '📧 Recevoir mon devis par mail'}
          </button>
          <button className="btn btn-primary btn-lg" onClick={openValidationPreview} disabled={submitting}>
            ✅ Je valide mon devis
          </button>
        </div>
      </div>

      {previewOpen && (
        <div className="modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="modal" style={{ maxWidth: '900px', padding: '20px', height: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewOpen(false)}>✕</button>
            <h3 className="modal-title" style={{ marginBottom: '10px' }}>📄 Aperçu du devis avant validation</h3>
            <p style={{ fontSize: '13px', color: '#777', marginBottom: '10px' }}>
              Vérifiez le document, puis confirmez la validation finale.
            </p>
            <div style={{ height: 'calc(90vh - 170px)', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', background: '#f8f8f8' }}>
              {previewUrl && <iframe title="Aperçu devis" src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} />}
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setPreviewOpen(false)}>Retour</button>
              <button className="btn btn-primary" onClick={confirmSignedDevis} disabled={submitting}>✅ Confirmer et signer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
