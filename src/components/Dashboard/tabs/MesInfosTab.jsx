import { useState } from 'react'
import { getSettings, saveSettings } from '../../../utils/storage'
import { makePageTypeStorage } from '../../../utils/cityPageStorage'
import { buildSitemapXml, buildRobotsTxt, downloadTextFile } from '../../../utils/seoFiles'
import { PAGE_TYPES } from '../../../data/pageTypes'
import { getBlogArticles } from '../../../utils/blogStorage'

function resizeImageToDataUrl(file, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

function resizeImageToSquare(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const ratio = Math.min(size / img.width, size / img.height)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

export default function MesInfosTab() {
  const [data, setData] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [seoBusy, setSeoBusy] = useState(false)
  const [seoMessage, setSeoMessage] = useState('')
  const [faviconBusy, setFaviconBusy] = useState(false)
  const [faviconMessage, setFaviconMessage] = useState('')

  function handleChange(field, value) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function handleBankChange(field, value) {
    setData((prev) => ({ ...prev, bankInfo: { ...prev.bankInfo, [field]: value } }))
  }

  function handleLegalChange(field, value) {
    setData((prev) => {
      const legalInfo = { ...(prev.legalInfo || {}), [field]: value }
      if (field === 'siret') {
        legalInfo.siren = value.replace(/\s/g, '').slice(0, 9)
      }
      return { ...prev, legalInfo }
    })
  }

  async function handleLogoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const resized = await resizeImageToDataUrl(file, 400, 200)
      handleChange('logo', resized)
    } catch { /* ignore */ }
    e.target.value = ''
  }

  async function handleFaviconFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFaviconBusy(true)
    setFaviconMessage('')
    try {
      const [fav32, fav64] = await Promise.all([
        resizeImageToSquare(file, 32),
        resizeImageToSquare(file, 64),
      ])
      const res = await fetch('/api/favicon-write.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favicon32: fav32.split(',')[1],
          favicon64: fav64.split(',')[1],
        }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        setFaviconMessage('✅ Favicon déposé sur le serveur.')
      } else {
        setFaviconMessage('❌ Impossible de déposer le favicon : ' + (json.error || 'erreur serveur'))
      }
    } catch {
      setFaviconMessage('❌ Erreur lors de la génération du favicon.')
    } finally {
      setFaviconBusy(false)
      e.target.value = ''
    }
  }

  function handleSave() {
    saveSettings(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleGenerateSeoFiles() {
    setSeoBusy(true)
    setSeoMessage('')
    try {
      // Load pages for all page types
      const allTypePages = {}
      let totalPages = 0
      await Promise.all(PAGE_TYPES.map(async (pt) => {
        const pages = await makePageTypeStorage(pt.id).getPages()
        allTypePages[pt.id] = pages || {}
        totalPages += Object.keys(pages || {}).length
      }))
      const sitemapXml = buildSitemapXml({ baseUrl: data.siteUrl, allTypePages, blogArticles: await getBlogArticles() })
      const robotsTxt = buildRobotsTxt(data.siteUrl)

      // Try to write files directly on the server
      let savedOnServer = false
      try {
        const res = await fetch('/api/seo-write.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sitemap: sitemapXml, robots: robotsTxt }),
        })
        const json = await res.json()
        if (res.ok && json.ok) savedOnServer = true
      } catch { /* fallback */ }

      if (savedOnServer) {
        setSeoMessage(`✅ Fichiers déposés sur le serveur (${totalPages} pages villes incluses).`)
      } else {
        downloadTextFile('sitemap.xml', sitemapXml, 'application/xml;charset=utf-8')
        downloadTextFile('robots.txt', robotsTxt, 'text/plain;charset=utf-8')
        setSeoMessage(`✅ Fichiers téléchargés (${totalPages} pages villes incluses). Déposez-les à la racine du serveur.`)
      }
    } catch {
      setSeoMessage("❌ Échec de génération. Vérifiez l'URL du site et réessayez.")
    } finally {
      setSeoBusy(false)
    }
  }

  const legal = data.legalInfo || {}

  return (
    <div>
      <h3 style={{ marginBottom: '20px', color: '#1a1a2e' }}>Informations générales</h3>
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label>Nom de la salle</label>
          <input className="form-control" value={data.nom || ''} onChange={(e) => handleChange('nom', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Code PIN administrateur</label>
          <input className="form-control" type="password" value={data.pin || ''} onChange={(e) => handleChange('pin', e.target.value)} />
        </div>
        <div className="form-group">
          <label>WhatsApp (numéro ou lien)</label>
          <input className="form-control" value={data.whatsapp || ''} onChange={(e) => handleChange('whatsapp', e.target.value)} placeholder="0782821582" />
        </div>
        <div className="form-group">
          <label>URL publique du site (SEO)</label>
          <input
            className="form-control"
            value={data.siteUrl || ''}
            onChange={(e) => handleChange('siteUrl', e.target.value)}
            placeholder="https://www.votresite.fr"
          />
          <small style={{ color: '#777', display: 'block', marginTop: '6px' }}>
            Utilisée pour générer des URLs absolues valides dans le sitemap.
          </small>
        </div>

        <hr style={{ margin: '20px 0', borderColor: '#eee' }} />
        <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Identité visuelle</h4>

        <div className="form-group">
          <label>Logo de l&apos;entreprise</label>
          {data.logo ? (
            <div style={{ marginBottom: '10px' }}>
              <img
                src={data.logo}
                alt="Logo"
                style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #eee', borderRadius: '6px', padding: '4px', display: 'block', marginBottom: '6px' }}
              />
              <button type="button" className="btn btn-outline" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => handleChange('logo', '')}>
                ✕ Supprimer le logo
              </button>
            </div>
          ) : null}
          <label style={{ display: 'inline-block', marginTop: '6px', cursor: 'pointer' }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleLogoFile} />
            <span className="btn btn-outline" style={{ fontSize: '13px' }}>
              {data.logo ? '🔄 Remplacer le logo' : '📤 Charger le logo'}
            </span>
          </label>
          <small style={{ color: '#777', display: 'block', marginTop: '4px' }}>
            PNG / JPG / WebP — redimensionné à 400×200 px max. Repris dans les PDF générés.
          </small>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label>Favicon du site</label>
          <div>
            <label style={{ display: 'inline-block', cursor: faviconBusy ? 'not-allowed' : 'pointer', opacity: faviconBusy ? 0.6 : 1 }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} disabled={faviconBusy} onChange={handleFaviconFile} />
              <span className="btn btn-outline" style={{ fontSize: '13px' }}>
                {faviconBusy ? '⏳ Génération...' : '🔖 Générer le favicon'}
              </span>
            </label>
          </div>
          <small style={{ color: '#777', display: 'block', marginTop: '4px' }}>
            Sélectionnez une image — redimensionnée en 32×32 et 64×64 px et déposée sur le serveur.
          </small>
          {faviconMessage && (
            <p style={{ marginTop: '6px', fontSize: '13px', color: faviconMessage.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
              {faviconMessage}
            </p>
          )}
        </div>

        <hr style={{ margin: '20px 0', borderColor: '#eee' }} />
        <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Informations légales</h4>

        <div className="form-group">
          <label>Raison sociale</label>
          <input className="form-control" value={legal.raisonSociale || ''} onChange={(e) => handleLegalChange('raisonSociale', e.target.value)} placeholder="SARL AFM" />
        </div>
        <div className="form-group">
          <label>Enseigne commerciale</label>
          <input className="form-control" value={legal.enseigne || ''} onChange={(e) => handleLegalChange('enseigne', e.target.value)} placeholder="LE PARADISE" />
        </div>
        <div className="form-group">
          <label>Forme juridique</label>
          <input className="form-control" value={legal.formeJuridique || ''} onChange={(e) => handleLegalChange('formeJuridique', e.target.value)} placeholder="SARL" />
        </div>
        <div className="form-group">
          <label>Capital social</label>
          <input className="form-control" value={legal.capital || ''} onChange={(e) => handleLegalChange('capital', e.target.value)} placeholder="7 500,00 EUR" />
        </div>
        <div className="form-group">
          <label>SIRET (14 chiffres)</label>
          <input className="form-control" value={legal.siret || ''} onChange={(e) => handleLegalChange('siret', e.target.value)} placeholder="90454381600000" maxLength={14} />
        </div>
        <div className="form-group">
          <label>SIREN (calculé automatiquement)</label>
          <input className="form-control" value={legal.siren || ''} readOnly style={{ background: '#f5f5f5', color: '#888' }} />
        </div>
        <div className="form-group">
          <label>N° TVA intracommunautaire</label>
          <input className="form-control" value={legal.tva || ''} onChange={(e) => handleLegalChange('tva', e.target.value)} placeholder="FR06904543816" />
        </div>
        <div className="form-group">
          <label>RCS (ville d&apos;immatriculation)</label>
          <input className="form-control" value={legal.rcs || ''} onChange={(e) => handleLegalChange('rcs', e.target.value)} placeholder="Meaux" />
        </div>
        <div className="form-group">
          <label>Date d&apos;immatriculation</label>
          <input className="form-control" type="date" value={legal.dateImmatriculation || ''} onChange={(e) => handleLegalChange('dateImmatriculation', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Code APE / NAF</label>
          <input className="form-control" value={legal.ape || ''} onChange={(e) => handleLegalChange('ape', e.target.value)} placeholder="68.20B" />
        </div>
        <div className="form-group">
          <label>Nom du gérant</label>
          <input className="form-control" value={legal.gerant || ''} onChange={(e) => handleLegalChange('gerant', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Adresse du siège social</label>
          <input className="form-control" value={legal.adresse || ''} onChange={(e) => handleLegalChange('adresse', e.target.value)} placeholder="5 avenue Fridingen, 77100 Nanteuil les Meaux" />
        </div>
        <div className="form-group">
          <label>Email de contact</label>
          <input className="form-control" type="email" value={legal.email || ''} onChange={(e) => handleLegalChange('email', e.target.value)} placeholder="contact@leparadise77.fr" />
        </div>
        <div className="form-group">
          <label>Téléphone</label>
          <input className="form-control" value={legal.telephone || ''} onChange={(e) => handleLegalChange('telephone', e.target.value)} placeholder="07 82 82 15 82" />
        </div>

        <hr style={{ margin: '20px 0', borderColor: '#eee' }} />
        <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Informations bancaires</h4>

        <div className="form-group">
          <label>Titulaire du compte</label>
          <input className="form-control" value={data.bankInfo?.titulaire || ''} onChange={(e) => handleBankChange('titulaire', e.target.value)} />
        </div>
        <div className="form-group">
          <label>IBAN</label>
          <input className="form-control" value={data.bankInfo?.iban || ''} onChange={(e) => handleBankChange('iban', e.target.value)} />
        </div>
        <div className="form-group">
          <label>BIC</label>
          <input className="form-control" value={data.bankInfo?.bic || ''} onChange={(e) => handleBankChange('bic', e.target.value)} />
        </div>

        <button onClick={handleSave} className="btn btn-primary">
          {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
        <button
          onClick={handleGenerateSeoFiles}
          className="btn btn-outline"
          style={{ marginLeft: '10px' }}
          disabled={seoBusy}
        >
          {seoBusy ? '⏳ Génération...' : '🗺️ Générer sitemap.xml + robots.txt'}
        </button>
        {seoMessage && (
          <p style={{ marginTop: '10px', color: seoMessage.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
            {seoMessage}
          </p>
        )}
      </div>
    </div>
  )
}
