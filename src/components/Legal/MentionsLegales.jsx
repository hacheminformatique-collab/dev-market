import LegalLayout from './LegalLayout'

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales">
      <h2 style={h2}>1. Éditeur du site</h2>
      <p>
        <strong>Raison sociale :</strong> SARL AFM<br />
        <strong>Adresse :</strong> 5 avenue Fridingen, 77100 Nanteuil les Meaux<br />
        <strong>Téléphone :</strong> 07 82 82 15 82<br />
        <strong>E-mail :</strong> contact@leparadise77.fr<br />
        <strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)<br />
        <strong>Capital social :</strong> à préciser<br />
        <strong>SIRET :</strong> à préciser<br />
        <strong>RCS :</strong> à préciser
      </p>

      <h2 style={h2}>2. Directeur de la publication</h2>
      <p>Le directeur de la publication est le gérant de la SARL AFM.</p>

      <h2 style={h2}>3. Hébergement</h2>
      <p>
        Ce site est hébergé par un prestataire d&apos;hébergement professionnel. Pour toute question relative à l&apos;hébergement, veuillez nous contacter à contact@leparadise77.fr.
      </p>

      <h2 style={h2}>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus présents sur ce site (textes, images, logos, etc.) sont la propriété exclusive de la SARL AFM ou de leurs auteurs respectifs, et sont protégés par les lois françaises et internationales relatives à la propriété intellectuelle. Toute reproduction, représentation, modification ou adaptation, totale ou partielle, est strictement interdite sans autorisation écrite préalable.
      </p>

      <h2 style={h2}>5. Responsabilité</h2>
      <p>
        La SARL AFM s&apos;efforce de maintenir les informations publiées sur ce site à jour et exactes. Elle ne saurait toutefois être tenue responsable des erreurs, omissions ou résultats qui pourraient être obtenus par un mauvais usage de ces informations.
      </p>

      <h2 style={h2}>6. Droit applicable</h2>
      <p>
        Le présent site est soumis au droit français. Tout litige relatif à son utilisation sera soumis à la compétence exclusive des tribunaux français.
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
