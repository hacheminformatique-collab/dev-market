import { useEffect, useState } from 'react'
import { siteFetch } from '../../../utils/siteFetch'

export default function ProspectsTab() {
  const [prospects, setProspects] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [csrf, setCsrf] = useState('')
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await siteFetch('/api/prospects.php', {
          cache: 'no-store',
        })
        const result = await response.json()
        if (!response.ok || !result.ok || !Array.isArray(result.prospects)) throw new Error(result.error || 'Liste des prospects invalide.')
        if (!cancelled) {
          setProspects(result.prospects)
          setCsrf(result.csrf)
          setNotes(Object.fromEntries(result.prospects.map((prospect) => [prospect.flowId, prospect.internalNotes || ''])))
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function manage(flowId, action) {
    if (action === 'delete' && !window.confirm('Supprimer ce prospect et ses notes internes ? Aucun devis associé ne sera supprimé. Le client peut toujours terminer son parcours.')) return
    setBusy(flowId)
    setError('')
    setMessage('')
    try {
      const response = await siteFetch('/api/prospects.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf },
        body: JSON.stringify({ flowId, action, ...(action === 'notes' ? { internalNotes: notes[flowId] || '' } : {}) }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'Modification du prospect impossible.')
      if (action === 'delete') setProspects((current) => current.filter((item) => item.flowId !== flowId))
      else setProspects((current) => current.map((item) => item.flowId === flowId ? result.prospect : item))
      setMessage(action === 'delete' ? 'Prospect supprimé. Aucun devis supprimé.' : 'Notes enregistrées.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const needle = search.trim().toLowerCase()
  const filtered = prospects.filter(({ summary }) =>
    `${summary.prenom} ${summary.nom} ${summary.email} ${summary.telephone}`.toLowerCase().includes(needle))

  return (
    <section>
      <h2>Prospect</h2>
      <p className="text-muted" style={{ margin: '12px 0 20px' }}>
        Coordonnées et événement validés, formule non validée et aucun devis envoyé.
        Ces demandes peuvent encore être en cours.
      </p>
      <input className="form-control" aria-label="Rechercher un prospect" placeholder="Nom, e-mail ou téléphone" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: '500px', marginBottom: '20px' }} />
      {loading && <p role="status">Chargement des prospects…</p>}
      {error && <p role="alert" style={{ color: '#c0392b' }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      {!loading && !error && !filtered.length && <p>Aucun prospect correspondant.</p>}
      {filtered.map(({ flowId, summary, updatedAt }) => (
        <article key={flowId} className="card" style={{ marginBottom: '16px' }}>
          <h3>{summary.prenom} {summary.nom}</h3>
          <p style={{ marginTop: '12px' }}><a href={`mailto:${summary.email}`}>{summary.email}</a> — <a href={`tel:${summary.telephone}`}>{summary.telephone}</a></p>
          <p>{summary.adresse} {summary.codePostal} {summary.ville}</p>
          <p>{summary.typeEvenement} — {summary.dateEvenement} — {summary.nbAdultes} adultes, {summary.nbEnfants} enfants</p>
          <p>{summary.heureDebut} – {summary.heureFin}</p>
          {summary.commentaire && <p>{summary.commentaire}</p>}
          <small>Dernière activité : {new Date(updatedAt).toLocaleString('fr-FR')}</small>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label htmlFor={`notes-${flowId}`}>Notes internes (non transmises au client)</label>
            <textarea id={`notes-${flowId}`} className="form-control" rows={4} maxLength={10000} value={notes[flowId] || ''} onChange={(event) => setNotes((current) => ({ ...current, [flowId]: event.target.value }))} disabled={busy === flowId} />
          </div>
          <button className="btn btn-primary" disabled={Boolean(busy) || !csrf} onClick={() => manage(flowId, 'notes')}>Enregistrer les notes</button>
          <button className="btn btn-outline" style={{ marginLeft: '12px' }} disabled={Boolean(busy) || !csrf} onClick={() => manage(flowId, 'delete')}>Supprimer le prospect</button>
        </article>
      ))}
    </section>
  )
}
