import PublicHeader from '../PublicHeader'
import VideoHero from '../VideoHero'
import WeddingDirectory from '../WeddingDirectory'
import { WEDDING_DEPARTMENTS } from '../../utils/weddingDepartments'

export default function DepartmentPage({ departmentCode, businessName = 'Le Paradise', slugs }) {
  const department = WEDDING_DEPARTMENTS.find(({ code }) => code === departmentCode)
  if (!department) throw new Error('Département de publication invalide.')
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <PublicHeader businessName={businessName} subtitle={`${department.name} (${department.code})`} />
      <VideoHero style={{ textAlign: 'center' }}>
        <h1>Location salle de mariage — {department.name} ({department.code})</h1>
        <p style={{ marginTop: '20px', fontSize: '1.2rem' }}>Organisez votre réception au Paradise depuis {department.name}.</p>
      </VideoHero>
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px', lineHeight: 1.8 }}>
        <nav aria-label="Fil d’Ariane"><a href="/">Accueil</a> › {department.name} ({department.code})</nav>
        <h2 style={{ marginTop: '28px' }}>Votre mariage depuis {department.name}, en {department.region}</h2>
        <p>
          Vous préparez un mariage avec des invités venant de {department.name} ({department.code}) ?
          {` ${businessName}`} vous accueille dans son unique salle de réception au
          5 avenue Fridingen, 77100 Nanteuil les Meaux, en Seine-et-Marne.
          {department.code !== '77' && ` L’établissement n’est pas situé dans le département ${department.name}.`}
        </p>
        <h2 style={{ marginTop: '28px' }}>Une réception adaptée à votre projet</h2>
        <p>
          Découvrez une salle pouvant accueillir jusqu’à 300 invités, avec parking,
          cuisine et possibilités de personnalisation. Préparez ensemble le nombre
          de convives, la décoration et les prestations souhaitées.
        </p>
        <h2 style={{ marginTop: '28px' }}>Préparer les déplacements et la visite</h2>
        <p>
          Pour les familles venant de {department.name}, choisissez la page de votre
          commune ci-dessous pour consulter son itinéraire vers la salle.
          Prévoyez les déplacements de vos invités et organisez une visite sur rendez-vous
          avant de réserver. Les durées peuvent varier selon le trafic.
        </p>
        <a className="btn btn-primary" href="/devis" style={{ marginTop: '24px' }}>Demander un devis personnalisé</a>
        <p style={{ marginTop: '20px' }}><a href="/blog">Nos conseils pour organiser votre mariage</a></p>
      </main>
      <WeddingDirectory slugs={slugs} businessName={businessName} departmentCode={departmentCode} />
    </div>
  )
}
