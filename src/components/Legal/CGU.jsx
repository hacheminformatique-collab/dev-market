import { getSettings } from '../../utils/storage'
import LegalLayout from './LegalLayout'

export default function CGU() {
  const s = getSettings()
  const l = s.legalInfo || {}
  const raisonSociale = l.raisonSociale || 'SARL AFM'
  const adresse = l.adresse || '5 avenue Fridingen, 77100 Nanteuil les Meaux'

  return (
    <LegalLayout title="Conditions Générales d'Utilisation">
      <h2 style={h2}>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation du site internet de la salle de réception {l.enseigne || s.nom || 'Le Paradise'}, exploité par {raisonSociale}, {adresse}.
      </p>

      <h2 style={h2}>2. Acceptation</h2>
      <p>
        L&apos;accès et l&apos;utilisation du site impliquent l&apos;acceptation pleine et entière des présentes CGU. Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser ce site.
      </p>

      <h2 style={h2}>3. Services proposés</h2>
      <p>
        Le site permet aux utilisateurs de :
      </p>
      <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
        <li>Consulter les offres et formules de la salle de réception ;</li>
        <li>Effectuer une demande de devis en ligne ;</li>
        <li>Accéder à leur espace client pour consulter leur devis ;</li>
        <li>Lire les articles du blog.</li>
      </ul>

      <h2 style={h2}>4. Accès au site</h2>
      <p>
        Le site est accessible 24h/24 et 7j/7, sauf interruption, programmée ou non, pour des raisons de maintenance ou de force majeure. {raisonSociale} ne saurait être tenue responsable de toute interruption de service.
      </p>

      <h2 style={h2}>5. Responsabilité de l&apos;utilisateur</h2>
      <p>
        L&apos;utilisateur s&apos;engage à utiliser le site de manière loyale et conforme à la loi. Il est interdit d&apos;utiliser le site à des fins illicites, abusives ou portant atteinte aux droits de tiers.
      </p>

      <h2 style={h2}>6. Demandes de devis</h2>
      <p>
        Les demandes de devis effectuées via le formulaire en ligne constituent une simple demande d&apos;information. Elles ne constituent pas une commande ferme et ne génèrent aucune obligation contractuelle de la part de {raisonSociale} tant qu&apos;aucun contrat écrit n&apos;a été signé.
      </p>

      <h2 style={h2}>7. Propriété intellectuelle</h2>
      <p>
        Tous les contenus du site sont protégés par le droit d&apos;auteur. Toute reproduction ou utilisation non autorisée est interdite.
      </p>

      <h2 style={h2}>8. Modification des CGU</h2>
      <p>
        {raisonSociale} se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet dès leur publication sur le site.
      </p>

      <h2 style={h2}>9. Droit applicable et juridiction</h2>
      <p>
        Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des juridictions françaises.
      </p>

      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '32px' }}>
        Dernière mise à jour : juillet 2025
      </p>
    </LegalLayout>
  )
}

const h2 = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: '600',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(184,151,74,0.9)',
  marginTop: '32px',
  marginBottom: '10px',
}
