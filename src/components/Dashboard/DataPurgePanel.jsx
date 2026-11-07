import { useState } from 'react'
import { siteFetch } from '../../utils/siteFetch'
import { getSettings, getSyncStatus } from '../../utils/storage'

const TYPES = [
  ['clients', 'Clients & Devis'], ['calendar', 'Calendrier'], ['compta', 'Comptabilité'],
  ['staff', 'Staff'], ['stock', 'Stock'], ['matieres', 'Matières premières'],
  ['formules', 'Formules'], ['menus', 'Menus'], ['gateaux', 'Gâteaux'],
  ['prestations', 'Prestations'], ['pages-mariage', 'Pages salle de mariage'], ['all', 'Tout purger'],
]

export default function DataPurgePanel() {
  const [target, setTarget] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function purge(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const retries = JSON.parse(localStorage.getItem('paradise_retry_queue') || '[]')
      if (!Array.isArray(retries)) throw new Error('État de synchronisation local invalide.')
      if (getSyncStatus().pending || getSyncStatus().offline || retries.length) {
        throw new Error('Terminez la synchronisation des modifications avant de purger.')
      }
      const response = await siteFetch('/api/data-purge.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': getSettings().pin },
        body: JSON.stringify({ type: target[0], confirmation }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || `Purge refusée (HTTP ${response.status}).`)
      for (const key of result.keys) localStorage.removeItem(key)
      localStorage.setItem('paradise_retry_queue', JSON.stringify(retries.filter(({ key }) => !result.keys.includes(key))))
      window.location.reload()
    } catch (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }
  return (
    <section className="card" style={{ marginBottom: '24px', border: '1px solid #c0392b' }}>
      <h3>Purge des données</h3>
      <p style={{ margin: '12px 0' }}>Suppression définitive. Exportez vos sauvegardes avant de continuer et fermez les autres onglets administratifs pour éviter de réenregistrer une ancienne copie.</p>
      <p style={{ marginBottom: '12px' }}>Clients & Devis supprime aussi les documents, reçus et prospects. Calendrier retire les réservations et affectations sans effacer les dates des devis. Comptabilité efface les paiements/reçus et retire les devis des calculs, sans supprimer les devis. Les pages mariage sont supprimées avec leurs HTML, annuaires et sauvegardes.</p>
      <p style={{ marginBottom: '16px' }}><strong>Tout purger</strong> inclut aussi le blog, les prospects et les anciens types de pages. Mes Infos, le PIN administrateur et l’adresse administrative sont conservés.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {TYPES.map(([id, label]) => <button key={id} disabled={busy} className="btn btn-outline" style={{ color: '#c0392b' }} onClick={() => { setTarget([id, label]); setConfirmation(''); setMessage('') }}>{label}</button>)}
      </div>
      {target && <form onSubmit={purge} style={{ marginTop: '20px' }}>
        <label htmlFor="purge-confirm">Confirmer « {target[1]} » : saisissez PURGER</label>
        <input id="purge-confirm" className="form-control" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required pattern="PURGER" autoComplete="off" />
        <button className="btn btn-danger" style={{ marginTop: '12px' }} disabled={busy || confirmation !== 'PURGER'}>{busy ? 'Purge en cours…' : 'Supprimer définitivement'}</button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setTarget(null)} style={{ marginLeft: '8px' }}>Annuler</button>
      </form>}
      {message && <p role="alert" style={{ color: '#c0392b', marginTop: '12px' }}>{message}</p>}
    </section>
  )
}
