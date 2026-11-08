import { useCallback, useEffect, useState } from 'react'
import { siteFetch } from '../../../utils/siteFetch'
import { getSettings } from '../../../utils/storage'

const RANGE_LABELS = [
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 90, label: '90 derniers jours' },
]

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))
}

export default function StatisticsTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await siteFetch('/api/site-analytics.php', {
        cache: 'no-store',
        headers: { 'X-Admin-Pin': getSettings().pin },
      })
      const result = await response.json()
      if (!response.ok || !result.ok || !Array.isArray(result.daily)
        || !result.periods || !Array.isArray(result.topPages)) {
        throw new Error(result.error || 'Les statistiques reçues sont invalides.')
      }
      setData(result)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const maxVisitors = Math.max(1, ...(data?.daily || []).map((day) => day.visitors))

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2>Fréquentation du site</h2>
          <p className="text-muted" style={{ marginTop: '8px' }}>
            Visiteurs uniques estimés par navigateur, pages vues et pages les plus consultées.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {error && <p role="alert" style={{ color: '#c0392b', marginTop: '16px' }}>{error}</p>}
      {loading && !data && <p role="status" style={{ marginTop: '20px' }}>Chargement des statistiques…</p>}
      {!loading && !error && !data?.daily.some((day) => day.visitors || day.pageViews) && (
        <p className="card" style={{ marginTop: '20px' }}>
          Aucune visite mesurée pour le moment. Les statistiques commencent à se remplir après l’installation de cette version.
        </p>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', margin: '22px 0' }}>
            {RANGE_LABELS.map(({ days, label }) => {
              const period = data.periods[days]
              return (
                <article className="card" key={days}>
                  <h3 style={{ margin: 0 }}>{label}</h3>
                  <p style={{ margin: '12px 0 4px', fontSize: '1.45rem', fontWeight: 700, color: 'var(--gold)' }}>
                    {formatNumber(period.averageVisitorsPerDay)} visiteurs / jour
                  </p>
                  <p className="text-muted" style={{ margin: 0 }}>
                    {formatNumber(period.visitors)} visiteurs estimés · {formatNumber(period.pageViews)} pages vues
                  </p>
                  <p className="text-muted" style={{ margin: '4px 0 0' }}>
                    Moyenne : {formatNumber(period.averagePageViewsPerDay)} pages vues / jour
                  </p>
                </article>
              )
            })}
          </div>

          <article className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Visiteurs par jour — 30 derniers jours</h3>
            <div role="img" aria-label="Histogramme du nombre quotidien de visiteurs uniques estimés"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(30, minmax(3px, 1fr))', alignItems: 'end', gap: '4px', height: '150px', paddingTop: '12px' }}>
              {data.daily.map((day) => (
                <div key={day.date} title={`${formatDate(day.date)} : ${day.visitors} visiteurs, ${day.pageViews} pages vues`}
                  style={{ height: `${Math.max(3, (day.visitors / maxVisitors) * 100)}%`, minHeight: '3px', background: 'var(--gold)', borderRadius: '3px 3px 0 0' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)', fontSize: '12px', marginTop: '8px' }}>
              <span>{data.daily[0] ? formatDate(data.daily[0].date) : ''}</span>
              <span>{data.daily.at(-1) ? formatDate(data.daily.at(-1).date) : ''}</span>
            </div>
            <details style={{ marginTop: '14px' }}>
              <summary style={{ cursor: 'pointer' }}>Voir les chiffres de chaque jour</summary>
              <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr><th style={cellStyle}>Date</th><th style={cellStyle}>Visiteurs estimés</th><th style={cellStyle}>Pages vues</th></tr></thead>
                  <tbody>
                    {[...data.daily].reverse().map((day) => (
                      <tr key={day.date}>
                        <td style={cellStyle}>{formatDate(day.date)}</td>
                        <td style={cellStyle}>{formatNumber(day.visitors)}</td>
                        <td style={cellStyle}>{formatNumber(day.pageViews)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>Pages les plus consultées — 30 derniers jours</h3>
            {!data.topPages.length ? <p className="text-muted">Aucune page vue enregistrée.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr><th style={cellStyle}>Page</th><th style={cellStyle}>Pages vues</th></tr></thead>
                  <tbody>
                    {data.topPages.map(({ path, pageViews }) => (
                      <tr key={path}><td style={cellStyle}><code>{path}</code></td><td style={cellStyle}>{formatNumber(pageViews)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <p className="text-muted" style={{ fontSize: '12px', marginTop: '12px' }}>
            Les mesures sont agrégées par jour, sans conservation de l’adresse IP. Les empreintes pseudonymisées sont renouvelées chaque jour.
            Les moyennes incluent les jours sans visite.
          </p>
        </>
      )}
    </section>
  )
}

const cellStyle = { padding: '10px 8px', borderBottom: '1px solid var(--border)' }
