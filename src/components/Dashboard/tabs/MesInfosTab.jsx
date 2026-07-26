import { useState } from 'react'
import { getSettings, saveSettings } from '../../../utils/storage'
import { makePageTypeStorage } from '../../../utils/cityPageStorage'
import { buildSitemapXml, buildRobotsTxt, downloadTextFile } from '../../../utils/seoFiles'
import { PAGE_TYPES } from '../../../data/pageTypes'

export default function MesInfosTab() {
  const [data, setData] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [seoBusy, setSeoBusy] = useState(false)
  const [seoMessage, setSeoMessage] = useState('')

  function handleChange(field, value) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function handleBankChange(field, value) {
    setData((prev) => ({ ...prev, bankInfo: { ...prev.bankInfo, [field]: value } }))
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
      const sitemapXml = buildSitemapXml({ baseUrl: data.siteUrl, allTypePages })
      const robotsTxt = buildRobotsTxt(data.siteUrl)
      downloadTextFile('sitemap.xml', sitemapXml, 'application/xml;charset=utf-8')
      downloadTextFile('robots.txt', robotsTxt, 'text/plain;charset=utf-8')
      setSeoMessage(`✅ Fichiers générés (${totalPages} pages villes incluses).`)
    } catch {
      setSeoMessage("❌ Échec de génération. Vérifiez l'URL du site et réessayez.")
    } finally {
      setSeoBusy(false)
    }
  }

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
