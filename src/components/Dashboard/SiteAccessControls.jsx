import { useEffect, useState } from 'react'
import { siteAdminRequest } from '../../utils/siteAdministration'

export default function SiteAccessControls({ kind }) {
  const maintenanceKey = kind === 'quotes' ? 'quoteMaintenance' : 'maintenance'
  const isMaintenance = kind !== 'address'
  const [controls, setControls] = useState(null)
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let cancelled = false
    siteAdminRequest().then(({ controls: saved }) => {
      if (!cancelled) { setControls(saved); setSlug(saved.adminSlug) }
    }).catch((error) => { if (!cancelled) setMessage(error.message) })
    return () => { cancelled = true }
  }, [])

  async function save(event) {
    event.preventDefault()
    if (isMaintenance && !window.confirm(controls[maintenanceKey]
      ? kind === 'quotes' ? 'Rouvrir les nouvelles demandes de devis ?' : 'Rouvrir toutes les pages publiques du site ?'
      : kind === 'quotes' ? 'Suspendre les nouvelles demandes de devis ? Les devis existants restent accessibles et signables.'
      : 'Activer la maintenance ? Seuls l’accueil et l’administration resteront accessibles.')) return
    setBusy(true)
    setMessage('')
    try {
      const result = await siteAdminRequest({ action: 'save',
        ...(isMaintenance ? { [maintenanceKey]: !controls[maintenanceKey] } : { adminSlug: slug.trim() }) })
      setControls(result.controls)
      if (kind === 'address') window.location.assign(`/${result.controls.adminSlug}/dashboard`)
      else setMessage(result.controls[maintenanceKey] ? 'Maintenance activée.' : kind === 'quotes' ? 'Demandes de devis rouvertes.' : 'Site rouvert.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" style={{ marginTop: '24px', marginBottom: '24px' }}>
      <h3>{kind === 'quotes' ? 'Maintenance devis' : kind === 'maintenance' ? 'Maintenance du site' : 'Adresse privée de l’administration'}</h3>
      <p style={{ margin: '12px 0' }}>
        {kind === 'quotes' ? 'Suspend uniquement les nouvelles demandes et formulaires de devis, même déjà ouverts. Le site, l’administration, les devis existants et leur signature restent accessibles.'
          : kind === 'maintenance'
          ? 'En maintenance, seul l’accueil reste public. L’administration reste accessible pour rouvrir le site. Les autres pages répondent HTTP 503 sans supprimer leurs fichiers.'
          : 'Change l’adresse de connexion et celle du dashboard. Les anciennes adresses /admin et /dashboard deviennent indisponibles. Notez la nouvelle adresse : elle ne remplace pas la protection par PIN.'}
      </p>
      {controls && <form onSubmit={save}>
        {kind === 'address' && <div className="form-group">
          <label htmlFor="admin-slug">Nouvelle adresse (8 à 80 caractères)</label>
          <input id="admin-slug" className="form-control" value={slug} onChange={(event) => setSlug(event.target.value)} pattern="[a-z][a-z0-9-]{7,79}" required />
          <p style={{ marginTop: '8px' }}>{window.location.origin}/{slug || 'votre-adresse'} — dashboard : /{slug || 'votre-adresse'}/dashboard</p>
        </div>}
        {isMaintenance && <p style={{ marginBottom: '12px' }}>État : <strong>{controls[maintenanceKey] ? 'en maintenance' : kind === 'quotes' ? 'demandes ouvertes' : 'site ouvert'}</strong></p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : kind === 'address' ? 'Modifier l’adresse'
            : controls[maintenanceKey] ? `Désactiver la maintenance${kind === 'quotes' ? ' devis' : ''}` : `Activer la maintenance${kind === 'quotes' ? ' devis' : ''}`}
        </button>
      </form>}
      {!controls && !message && <p role="status">Chargement des réglages…</p>}
      {message && <p role="status" style={{ marginTop: '12px' }}>{message}</p>}
    </section>
  )
}
