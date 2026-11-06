import './PublicHeader.css'

export default function PublicHeader({ businessName = 'Le Paradise', subtitle = '' }) {
  return (
    <header className="public-header">
      <a href="/" className="public-header-brand">
        <strong>{businessName}</strong>
        {subtitle && <small>{subtitle}</small>}
      </a>
      <nav aria-label="Accès rapides">
        <a href="/devis" className="btn btn-primary">DEMANDER UN DEVIS</a>
        <a href="/espace-client" className="btn btn-outline">ESPACE CLIENT</a>
        <a href="/espace-staff" className="btn btn-outline">ESPACE STAFF</a>
      </nav>
    </header>
  )
}
