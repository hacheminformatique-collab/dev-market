import { useIsMobile } from '../../hooks/useIsMobile'

function calcMenuItemTotal(item, nbAdultes, nbEnfants) {
  if (!item.tarif) return 0
  if (item.section === 'Cocktail de bienvenu') return item.tarif * (nbAdultes + nbEnfants)
  if (item.section === 'Menu enfants') return item.tarif * nbEnfants
  if (item.section === 'Boissons') return 0
  return item.tarif * nbAdultes
}

export default function CartFloat({ data }) {
  const nbAdultes = parseInt(data.nbAdultes) || data.nbPersonnes || 0
  const nbEnfants = parseInt(data.nbEnfants) || 0
  const nbPersonnes = nbAdultes + nbEnfants
  const prixSalle = data.prixSalle || 0
  const menuTotal = (data.menus || []).reduce((sum, m) => sum + calcMenuItemTotal(m, nbAdultes, nbEnfants), 0)
  const gateauTotal = (data.gateau?.tarif || 0) * nbPersonnes
  const prestationsTotal = (data.prestations || []).reduce((sum, p) => sum + (p.tarif || 0), 0)
  const totalTTC = prixSalle + menuTotal + gateauTotal + prestationsTotal
  const isMobile = useIsMobile()

  if (totalTTC === 0) return null

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#1a1a2e',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
        zIndex: 100,
      }}>
        <div style={{ fontSize: '12px', color: '#aaa' }}>🛒 Total estimé — {nbPersonnes} pers.</div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: '#c9a84c' }}>
          {totalTTC.toLocaleString('fr-FR')} €
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#1a1a2e',
      color: 'white',
      borderRadius: '16px',
      padding: '16px 24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: 100,
      minWidth: '200px',
    }}>
      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>🛒 Total estimé</div>
      <div style={{ fontSize: '24px', fontWeight: '800', color: '#c9a84c' }}>
        {totalTTC.toLocaleString('fr-FR')} €
      </div>
      <div style={{ fontSize: '11px', color: '#666' }}>TTC — {nbPersonnes} pers.</div>
    </div>
  )
}
