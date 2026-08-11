import { useState, useEffect } from 'react'
import { getClients, getStaff, getMatieresPremieresRecettes, getIngredients } from '../../../utils/storage'

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

function calcMasseSalariale(devis, staff) {
  if (!devis.assignedStaff || devis.assignedStaff.length === 0) return 0
  return devis.assignedStaff.reduce((s, sid) => {
    const member = staff.find((st) => st.id === sid)
    return s + (member?.tarifEvenement || 0)
  }, 0)
}

function calcFraisMatiere(devis, recettes, ingredients) {
  const nbAdultes = parseInt(devis.nbAdultes) || devis.nbPersonnes || 0
  const nbEnfants = parseInt(devis.nbEnfants) || 0
  let total = 0
  ;(devis.menus || []).forEach((m) => {
    const rec = recettes.find((r) => r.menuId === m.id)
    if (!rec) return
    const nb = m.section === 'Menu enfants' ? nbEnfants : nbAdultes
    const coutRec = (rec.lignes || []).reduce((s, l) => {
      const ing = ingredients.find((i) => i.id === l.ingredientId)
      return s + (ing?.tarif || 0) * (l.quantite || 0)
    }, 0)
    total += coutRec * nb
  })
  // Pain
  const nbP = nbAdultes + nbEnfants
  total += Math.ceil(nbP * 1.5) * 0.165
  return total
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

export default function ComptabiliteTab() {
  const [clients, setClients] = useState(() => getClients())
  const staff = getStaff()
  const recettes = getMatieresPremieresRecettes()
  const ingredients = getIngredients()

  const [filter, setFilter] = useState('all')

  useEffect(() => {
    function reload() { setClients(getClients()) }
    const id = setInterval(reload, 5000)
    window.addEventListener('focus', reload)
    return () => { clearInterval(id); window.removeEventListener('focus', reload) }
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const eventsData = clients
    .filter((c) => c.status !== 'annulé' && c.dateEvenement)
    .filter((c) => {
      if (filter === 'upcoming') return c.dateEvenement >= today
      if (filter === 'past') return c.dateEvenement < today
      return true
    })
    .sort((a, b) => (a.dateEvenement || '').localeCompare(b.dateEvenement || ''))
    .map((c) => {
      const total = calcTotal(c)
      const paid = (c.payments || []).reduce((s, p) => s + (p.montant || 0), 0)
      const solde = total - paid
      const salaires = calcMasseSalariale(c, staff)
      const matiere = calcFraisMatiere(c, recettes, ingredients)
      const marge = total - salaires - matiere
      return { ...c, total, paid, solde, salaires, matiere, marge }
    })

  const totals = eventsData.reduce((acc, ev) => ({
    total: acc.total + ev.total,
    paid: acc.paid + ev.paid,
    solde: acc.solde + ev.solde,
    salaires: acc.salaires + ev.salaires,
    matiere: acc.matiere + ev.matiere,
    marge: acc.marge + ev.marge,
  }), { total: 0, paid: 0, solde: 0, salaires: 0, matiere: 0, marge: 0 })

  return (
    <div>
      <div className="flex-between mb-3">
        <h3 style={{ color: '#1a1a2e' }}>📊 Comptabilité</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[['all', 'Tous'], ['upcoming', 'À venir'], ['past', 'Passés']].map(([v, l]) => (
            <button key={v} className="btn btn-sm" onClick={() => setFilter(v)}
              style={{ background: filter === v ? '#1a1a2e' : '#eee', color: filter === v ? 'white' : '#444' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'CA total', value: totals.total, color: '#c9a84c' },
          { label: 'Encaissé', value: totals.paid, color: '#27ae60' },
          { label: 'Restant dû', value: totals.solde, color: '#e74c3c' },
          { label: 'Frais salaires', value: totals.salaires, color: '#9b59b6' },
          { label: 'Frais matières', value: totals.matiere, color: '#e67e22' },
          { label: 'Marge totale', value: totals.marge, color: totals.marge >= 0 ? '#27ae60' : '#e74c3c' },
        ].map((card) => (
          <div key={card.label} className="card" style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{card.label}</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: card.color }}>{formatMoney(card.value)}</div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>N° Devis</th>
              <th>Client</th>
              <th>Date</th>
              <th>Montant TTC</th>
              <th>Versé</th>
              <th>Restant dû</th>
              <th>Frais salaires</th>
              <th>Frais matières</th>
              <th>Marge</th>
            </tr>
          </thead>
          <tbody>
            {eventsData.map((ev) => (
              <tr key={ev.id}>
                <td><strong style={{ color: '#c9a84c' }}>{ev.devisNumber}</strong></td>
                <td>{ev.prenom} {ev.nom}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{ev.dateEvenement ? new Date(ev.dateEvenement).toLocaleDateString('fr-FR') : '—'}</td>
                <td><strong>{formatMoney(ev.total)}</strong></td>
                <td style={{ color: '#27ae60' }}>{formatMoney(ev.paid)}</td>
                <td style={{ color: ev.solde > 0 ? '#e74c3c' : '#27ae60' }}>{formatMoney(Math.max(0, ev.solde))}</td>
                <td style={{ color: '#9b59b6' }}>{ev.salaires > 0 ? formatMoney(ev.salaires) : <span style={{ color: '#bbb' }}>—</span>}</td>
                <td style={{ color: '#e67e22' }}>{ev.matiere > 0.01 ? formatMoney(ev.matiere) : <span style={{ color: '#bbb' }}>—</span>}</td>
                <td>
                  <strong style={{ color: ev.marge >= 0 ? '#27ae60' : '#e74c3c' }}>{formatMoney(ev.marge)}</strong>
                </td>
              </tr>
            ))}
            {eventsData.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: '24px' }}>Aucun événement</td></tr>
            )}
            {eventsData.length > 0 && (
              <tr style={{ background: '#1a1a2e', color: 'white', fontWeight: '700' }}>
                <td colSpan={3} style={{ color: '#c9a84c' }}>TOTAL ({eventsData.length} événements)</td>
                <td style={{ color: '#c9a84c' }}>{formatMoney(totals.total)}</td>
                <td style={{ color: '#a8e6b8' }}>{formatMoney(totals.paid)}</td>
                <td style={{ color: '#f5a8a8' }}>{formatMoney(Math.max(0, totals.solde))}</td>
                <td style={{ color: '#d7aaff' }}>{formatMoney(totals.salaires)}</td>
                <td style={{ color: '#ffc8a8' }}>{formatMoney(totals.matiere)}</td>
                <td style={{ color: totals.marge >= 0 ? '#a8e6b8' : '#f5a8a8' }}>{formatMoney(totals.marge)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: '#888' }}>
        * Les frais matières sont calculés automatiquement à partir des recettes enregistrées (onglet Matières premières). Les salaires sont basés sur le staff assigné à chaque événement (onglet Calendrier).
      </div>
    </div>
  )
}
