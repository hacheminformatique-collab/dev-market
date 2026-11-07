import { useEffect, useState } from 'react'
import { siteFetch } from '../../../utils/siteFetch'
import { getSettings } from '../../../utils/storage'

export default function ProspectsTab() {
  const [prospects, setProspects] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await siteFetch('/api/prospects.php', {
          cache: 'no-store',
          headers: { 'X-Admin-Pin': getSettings().pin },
        })
        const result = await response.json()
        if (!response.ok || !result.ok || !Array.isArray(result.prospects)) throw new Error(result.error || 'Liste des prospects invalide.')
        if (!cancelled) setProspects(result.prospects)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

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
        </article>
      ))}
    </section>
  )
}
