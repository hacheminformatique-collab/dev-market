import { getSettings } from '../../utils/storage'
import LegalLayout from './LegalLayout'

export default function PolitiqueConfidentialite() {
  const s = getSettings()
  const l = s.legalInfo || {}
  const raisonSociale = l.raisonSociale || 'SARL AFM'
  const adresse = l.adresse || '5 avenue Fridingen, 77100 Nanteuil les Meaux'
  const email = l.email || 'contact@leparadise77.fr'
  const telephone = l.telephone || '07 82 82 15 82'

  return (
    <LegalLayout title="Politique de confidentialité & RGPD">
      <h2 style={h2}>1. Responsable du traitement</h2>
      <p>
        <strong>{raisonSociale}</strong><br />
        {adresse}<br />
        E-mail : {email} — Tél. : {telephone}
      </p>

      <h2 style={h2}>2. Données collectées</h2>
      <p>Dans le cadre de l&apos;utilisation de ce site, nous sommes susceptibles de collecter les données suivantes :</p>
      <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
        <li>Nom, prénom, adresse e-mail, numéro de téléphone (via le formulaire de devis) ;</li>
        <li>Date et type d&apos;événement souhaité ;</li>
        <li>Toute information communiquée volontairement lors d&apos;une prise de contact.</li>
      </ul>

      <h2 style={h2}>3. Finalités du traitement</h2>
      <p>Les données collectées sont utilisées pour :</p>
      <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
        <li>Établir et transmettre un devis personnalisé ;</li>
        <li>Gérer la relation client (suivi de dossier, facturation) ;</li>
        <li>Répondre à vos demandes d&apos;information ;</li>
        <li>Respecter nos obligations légales et réglementaires.</li>
      </ul>

      <h2 style={h2}>4. Base légale</h2>
      <p>
        Le traitement de vos données est fondé sur votre consentement (formulaire de devis) et/ou sur l&apos;exécution d&apos;un contrat (gestion de réservation), conformément à l&apos;article 6 du Règlement Général sur la Protection des Données (RGPD — UE 2016/679).
      </p>

      <h2 style={h2}>5. Durée de conservation</h2>
      <p>
        Vos données sont conservées pendant la durée nécessaire à la finalité pour laquelle elles ont été collectées, soit :
      </p>
      <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
        <li>3 ans à compter du dernier contact pour les prospects ;</li>
        <li>10 ans à compter de la clôture du contrat pour les clients (obligations comptables).</li>
      </ul>

      <h2 style={h2}>6. Destinataires des données</h2>
      <p>
        Vos données sont strictement réservées à l&apos;usage interne de {raisonSociale}. Elles ne sont en aucun cas transmises, vendues ou louées à des tiers, sauf obligation légale.
      </p>

      <h2 style={h2}>7. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
      </p>
      <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
        <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données ;</li>
        <li><strong>Droit de rectification</strong> — corriger des données inexactes ;</li>
        <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données ;</li>
        <li><strong>Droit à la limitation</strong> — restreindre certains traitements ;</li>
        <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement de vos données ;</li>
        <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré.</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous à : <strong>{email}</strong>
      </p>

      <h2 style={h2}>8. Cookies</h2>
      <p>
        Ce site utilise le stockage local (localStorage) de votre navigateur uniquement pour le fonctionnement technique de l&apos;application (données de devis, paramètres). Aucun cookie de traçage ou de publicité n&apos;est utilisé.
      </p>

      <h2 style={h2}>9. Réclamation</h2>
      <p>
        Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) :<br />
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(184,151,74,0.9)' }}>www.cnil.fr</a> — 3, place de Fontenoy, 75007 Paris
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
