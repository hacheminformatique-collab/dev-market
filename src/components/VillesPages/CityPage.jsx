import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { makePageTypeStorage, getCityPagesConfig } from '../../utils/cityPageStorage'
import { getCityBySlug, getNearbyCities, haversineKm } from '../../data/idf-cities'
import { PAGE_TYPES } from '../../data/pageTypes'

// ── Paradise 77 location (5 avenue Fridingen, 77100 Nanteuil-lès-Meaux) ──────
const PARADISE_LAT = 48.9617
const PARADISE_LNG = 2.8985

// ── Helpers ───────────────────────────────────────────────────────────────────

function cityVariant(name, n = 3) {
  return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % n
}

function getTravelInfo(city) {
  const km = haversineKm({ lat: city.lat, lng: city.lng }, { lat: PARADISE_LAT, lng: PARADISE_LNG })
  const roadKm = Math.round(km * 1.35)
  const driveMin = Math.max(10, Math.round(roadKm / 80 * 60))
  return { km: Math.round(km), roadKm, driveMin }
}

// Clean AI-generated text before rendering:
// 1. Decode literal \uXXXX escape sequences (GPT sometimes outputs them as plain text)
// 2. Strip markdown code-fence wrappers (```markdown … ```) that GPT occasionally adds
function cleanAIContent(raw) {
  if (!raw) return raw
  // Decode literal \uXXXX sequences → real Unicode characters
  let text = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  )
  // Remove lines that are only a code-fence marker (``` or ```markdown etc.)
  text = text
    .split('\n')
    .filter((line) => !/^```/.test(line.trim()))
    .join('\n')
    .trim()
  return text
}

function renderContent(text) {
  if (!text) return null
  const cleaned = cleanAIContent(text)
  return cleaned.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} style={{
          fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '600',
          color: 'var(--dark)', margin: '28px 0 12px', lineHeight: 1.3,
        }}>
          {line.slice(4)}
        </h3>
      )
    }
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} style={{
          fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: '700',
          color: 'var(--dark)', margin: '40px 0 16px', paddingBottom: '10px',
          borderBottom: '2px solid var(--gold)', display: 'block',
        }}>
          {line.slice(3)}
        </h2>
      )
    }
    const parts = line.split(/\*\*(.*?)\*\*/g)
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    )
    if (line.startsWith('• ') || line.startsWith('- ')) {
      return (
        <p key={i} style={{ marginBottom: '8px', lineHeight: 1.75, paddingLeft: '20px' }}>
          {rendered}
        </p>
      )
    }
    return <p key={i} style={{ marginBottom: '10px', lineHeight: 1.75 }}>{rendered}</p>
  })
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ id, title, children, style }) {
  return (
    <section id={id} style={{ marginBottom: '56px', ...style }}>
      {title && (
        <h2 style={{
          fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: '600',
          color: 'var(--dark)', marginBottom: '20px', paddingBottom: '12px',
          borderBottom: '2px solid var(--gold)', display: 'inline-block',
        }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

// ── Google Map embed ───────────────────────────────────────────────────────────

function CityMap({ city, apiKey }) {
  if (!city) return null
  const src = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city.name + ', France')}&zoom=14`
    : `https://www.google.com/maps?q=${encodeURIComponent(city.name + ', France')}&output=embed`
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--gold)', boxShadow: 'var(--shadow-md)' }}>
      <iframe
        title={`Carte de ${city.name}`}
        src={src}
        width="100%"
        height="400"
        style={{ border: 0, display: 'block' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}

// ── Photo gallery (no Section wrapper — used inside SectionGalerie) ───────────

function GalleryGrid({ photos }) {
  const [lightbox, setLightbox] = useState(null)
  if (!photos || photos.length === 0) return null
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {photos.map((src, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            style={{ border: '2px solid transparent', borderRadius: '8px', overflow: 'hidden', cursor: 'zoom-in', padding: 0, background: 'none', transition: 'border-color 0.15s, transform 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <img src={src} alt={`Galerie photo ${i + 1}`} loading="lazy" decoding="async" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      {lightbox !== null && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l > 0 ? l - 1 : photos.length - 1)) }} style={{ position: 'fixed', left: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px' }}>&#x2039;</button>
          <img src={photos[lightbox]} alt={`Galerie photo ${lightbox + 1}`} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
          <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l < photos.length - 1 ? l + 1 : 0)) }} style={{ position: 'fixed', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px' }}>&#x203a;</button>
          <button onClick={() => setLightbox(null)} style={{ position: 'fixed', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px' }}>&#x2715;</button>
        </div>
      )}
    </>
  )
}

// ── Instagram post embed ───────────────────────────────────────────────────────

function InstagramEmbed({ url }) {
  if (!url) return null
  const embedUrl = url.replace(/\/$/, '') + '/embed'
  return (
    <iframe
      src={embedUrl}
      title="Instagram post"
      style={{ border: 'none', borderRadius: '12px', width: '328px', minHeight: '440px', maxWidth: '100%' }}
      scrolling="no"
      loading="lazy"
      allowTransparency
      allow="encrypted-media"
    />
  )
}

// ── TikTok post embed ──────────────────────────────────────────────────────────

function TikTokEmbed({ url }) {
  if (!url) return null
  const match = url.match(/\/video\/(\d+)/)
  if (!match) return null
  const videoId = match[1]
  return (
    <iframe
      src={`https://www.tiktok.com/embed/${videoId}`}
      title="TikTok video"
      style={{ border: 'none', borderRadius: '12px', width: '325px', height: '575px', maxWidth: '100%' }}
      loading="lazy"
      allowFullScreen
      allow="encrypted-media"
    />
  )
}

// ── City news RSS feed ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs = 6000) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  }
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }
  return fetch(url)
}

function cleanGoogleNewsTitle(raw) {
  return raw.replace(/\s*[-–]\s+[^-–]{2,60}$/, '').trim()
}

function parseRssXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return []
  const rawItems = Array.from(doc.getElementsByTagName('item')).slice(0, 5)
  if (rawItems.length === 0) return []
  return rawItems.map((el) => {
    let link = el.getElementsByTagName('link')[0]?.textContent?.trim() || ''
    if (!link) {
      const linkEl = el.getElementsByTagName('link')[0]
      if (linkEl) link = linkEl.nextSibling?.nodeValue?.trim() || ''
    }
    const rawTitle = el.getElementsByTagName('title')[0]?.textContent?.trim() || ''
    const title    = cleanGoogleNewsTitle(rawTitle)
    const pubDate  = el.getElementsByTagName('pubDate')[0]?.textContent?.trim() || ''
    const source   = el.getElementsByTagName('source')[0]?.textContent?.trim() || ''
    const desc     = el.getElementsByTagName('description')[0]?.textContent?.trim() || ''
    const cleanDesc = desc.replace(/<[^>]*>/g, '').slice(0, 180)
    return { title, link, pubDate, source, desc: cleanDesc }
  }).filter((it) => it.title)
}

async function fetchRssItems(cityName) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(cityName)}&hl=fr&gl=FR&ceid=FR:fr`
  try {
    const res = await fetchWithTimeout(`/api/news.php?city=${encodeURIComponent(cityName)}`, 8000)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch { /* fall through */ }
  try {
    const jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=5`
    const res = await fetchWithTimeout(jsonUrl, 8000)
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
        const items = data.items.slice(0, 5).map((it) => ({
          title:   cleanGoogleNewsTitle(it.title?.trim() || ''),
          link:    it.link  || '',
          pubDate: it.pubDate || '',
          source:  it.author || data.feed?.title || '',
          desc:    (it.description || it.content || '').replace(/<[^>]*>/g, '').slice(0, 180),
        })).filter((it) => it.title)
        if (items.length > 0) return items
      }
    }
  } catch { /* fall through */ }
  try {
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`
    const res = await fetchWithTimeout(url, 7000)
    if (res.ok) {
      const data = await res.json()
      if (data.contents) {
        const items = parseRssXml(data.contents)
        if (items.length > 0) return items
      }
    }
  } catch { /* fall through */ }
  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
  ]
  for (const proxyUrl of proxies) {
    try {
      const res = await fetchWithTimeout(proxyUrl, 6000)
      if (!res.ok) continue
      const xml = await res.text()
      const items = parseRssXml(xml)
      if (items.length > 0) return items
    } catch { /* try next */ }
  }
  return []
}

function getLocalFallbackItems(city) {
  const { name, deptName, deptCode } = city
  const q = encodeURIComponent(name)
  const qDept = encodeURIComponent(deptName)
  return [
    { title: `Actualités de ${name} sur Google Actualités`, link: `https://news.google.com/search?q=${q}&hl=fr&gl=FR&ceid=FR:fr`, desc: `Retrouvez les dernières actualités et informations sur ${name} et ses environs directement sur Google Actualités.`, source: 'Google Actualités', pubDate: '' },
    { title: `${name} — Informations pratiques`, link: `https://fr.wikipedia.org/wiki/${q}`, desc: `Découvrez ${name}, commune du département ${deptName} (${deptCode}).`, source: 'Wikipédia', pubDate: '' },
    { title: `Actualités du département ${deptName}`, link: `https://news.google.com/search?q=${qDept}&hl=fr&gl=FR&ceid=FR:fr`, desc: `Suivez toutes les actualités et événements du département ${deptName} (${deptCode}).`, source: 'Google Actualités', pubDate: '' },
  ]
}

function CityNews({ city }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetchRssItems(city.name).then(setItems).finally(() => setLoading(false))
  }, [city.name])

  const cardStyle = { display: 'block', padding: '16px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', textDecoration: 'none', transition: 'box-shadow 0.15s, border-color 0.15s', boxShadow: 'var(--shadow-sm)' }

  const displayItems = items.length > 0 ? items : getLocalFallbackItems(city)

  return (
    <Section title={`📰 Quoi de neuf à ${city.name} ?`}>
      <p style={{ color: 'var(--text-light)', fontSize: '14px', marginBottom: '20px' }}>
        Les dernières actualités de {city.name} et de ses environs.
      </p>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ height: '72px', borderRadius: '10px', background: 'linear-gradient(90deg, #f0ece4 25%, #faf8f4 50%, #f0ece4 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', border: '1px solid var(--border)' }} />
          ))}
          <style>{'@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }'}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayItems.map((item, i) => {
            const pubDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
            return (
              <a key={i} href={item.link || '#'} target="_blank" rel="noreferrer noopener" style={cardStyle}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--gold)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--dark)', marginBottom: '6px', lineHeight: 1.4 }}>{item.title}</div>
                {item.desc && <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '6px', lineHeight: 1.5 }}>{item.desc}{item.desc.length === 180 ? '…' : ''}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#aaa' }}>
                  {item.source && <span style={{ fontWeight: '600' }}>{item.source}</span>}
                  {pubDate && <span>• {pubDate}</span>}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ── WhatsApp floating button ───────────────────────────────────────────────────

function WhatsAppButton() {
  return (
    <a href="https://wa.me/33782821582" target="_blank" rel="noreferrer noopener" aria-label="Contactez-nous sur WhatsApp"
      style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, width: '60px', height: '60px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,211,102,0.45)', transition: 'transform 0.18s, box-shadow 0.18s', textDecoration: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,211,102,0.6)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,211,102,0.45)' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="32" height="32" fill="white">
        <path d="M24 4C12.95 4 4 12.95 4 24c0 3.55.93 6.87 2.56 9.75L4 44l10.5-2.75A19.87 19.87 0 0 0 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4zm0 36.5c-3.16 0-6.13-.87-8.67-2.38l-.62-.37-6.23 1.63 1.66-6.06-.41-.64A16.43 16.43 0 0 1 7.5 24C7.5 14.84 14.84 7.5 24 7.5S40.5 14.84 40.5 24 33.16 40.5 24 40.5zm9.08-12.3c-.49-.25-2.92-1.44-3.37-1.6-.45-.17-.78-.25-1.1.25-.33.49-1.27 1.6-1.56 1.93-.29.33-.57.37-1.06.12-.49-.25-2.07-.76-3.94-2.43-1.46-1.3-2.44-2.9-2.73-3.39-.29-.49-.03-.76.22-1 .22-.22.49-.57.74-.86.25-.29.33-.49.49-.82.17-.33.08-.62-.04-.86-.12-.25-1.1-2.65-1.51-3.63-.4-.95-.8-.82-1.1-.84-.29-.02-.62-.02-.95-.02-.33 0-.86.12-1.31.62-.45.49-1.72 1.68-1.72 4.1 0 2.42 1.76 4.76 2.01 5.09.25.33 3.47 5.3 8.41 7.43 1.17.51 2.09.81 2.8 1.04 1.18.38 2.25.32 3.1.2.94-.14 2.92-1.19 3.33-2.34.41-1.15.41-2.14.29-2.34-.12-.2-.45-.33-.94-.57z"/>
      </svg>
    </a>
  )
}

// ── 1. Section Introduction / Présentation de la salle ────────────────────────

function SectionIntro({ city, businessName, page }) {
  return (
    <Section id="intro" title={`${businessName} à ${city.name} — Présentation`}>
      <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.8 }}>
        {renderContent(page.content)}
      </div>
    </Section>
  )
}

// ── 2. Section Pourquoi choisir Le Paradise 77 ────────────────────────────────

function SectionWhyChoose({ city, businessName }) {
  const travel = getTravelInfo(city)
  const v = cityVariant(city.name)

  const intros = [
    `Les habitants de ${city.name} qui souhaitent organiser un mariage ou une réception d'exception connaissent bien ${businessName}. Situé à seulement ${travel.driveMin} minutes en voiture depuis le centre de ${city.name}, notre salle de mariage et de réception allie prestige, accessibilité et services complets. Voici pourquoi des centaines de couples de ${city.name} nous font confiance chaque année.`,
    `Depuis ${city.name}, rejoindre ${businessName} ne prend que ${travel.driveMin} minutes en voiture — une distance raisonnable pour une salle de mariage d'exception. Notre établissement s'est imposé comme la référence incontournable pour les résidents de ${city.name} qui veulent célébrer leur mariage ou leur réception dans un cadre luxueux et sans compromis.`,
    `Vous planifiez votre mariage ou votre réception depuis ${city.name} ? ${businessName} est votre allié le plus proche pour un événement inoubliable. En seulement ${travel.driveMin} minutes depuis ${city.name}, vous accédez à une salle de mariage pouvant accueillir jusqu'à 300 invités, avec tous les services nécessaires pour faire de votre journée un souvenir impérissable.`,
  ]

  const cards = [
    { icon: '⏱', title: 'Temps de trajet', value: `≈ ${travel.driveMin} min en voiture`, desc: `${travel.roadKm} km depuis ${city.name}` },
    { icon: '🅿', title: 'Parking gratuit', value: '∼ 60 places', desc: 'Surveillé par agent de sécurité' },
    { icon: '🛣', title: 'Accès autoroute', value: 'A4 · A104 · N3', desc: 'A140 · A1 · A3 à proximité' },
    { icon: '🚉', title: 'Gare à proximité', value: 'Gare de Meaux', desc: '15 min en voiture' },
    { icon: '👥', title: 'Capacité', value: "Jusqu'à 300 invités", desc: 'Grande salle de réception' },
  ]

  const whyParagraphs = [
    [
      `${businessName} propose une expérience unique qui se distingue de toutes les autres salles de réception de la région. Depuis ${city.name}, vous accédez facilement à une salle de mariage équipée des dernières technologies audio-visuelles, avec une cuisine professionnelle intégrée et un parking privatif sécurisé. Notre équipe de professionnels expérimentés prend en charge chaque détail pour que votre mariage se déroule dans les meilleures conditions.`,
      `La réputation de ${businessName} dépasse largement ${city.name} pour s'étendre à toute l'Île-de-France. De nombreux couples choisissent notre salle parce qu'elle offre la combinaison parfaite entre prestige, polyvalence et accessibilité. Avec des formules allant de la location sèche aux prestations tout-compris, ${businessName} s'adapte à tous les budgets et à tous les styles de mariage.`,
    ],
    [
      `Pourquoi de si nombreux résidents de ${city.name} choisissent-ils ${businessName} pour leur mariage ? La réponse tient en quelques mots : qualité, fiabilité et service personnalisé. Notre équipe accompagne chaque couple de ${city.name} de la première visite jusqu'au Jour J, en passant par toutes les étapes de préparation. Chaque mariage organisé chez nous bénéficie d'une attention particulière aux détails.`,
      `${businessName} s'est bâti une solide réputation auprès des familles de ${city.name} grâce à ses années d'expérience dans l'organisation d'événements d'exception. Notre salle de réception accueille mariages, anniversaires, baptêmes et séminaires dans un cadre élégant et modulable. Choisir ${businessName} depuis ${city.name}, c'est choisir la tranquillité d'esprit et l'excellence à chaque instant.`,
    ],
    [
      `${businessName} incarne depuis plusieurs années le rêve de nombreux couples de ${city.name} : une salle de mariage grande, belle et accessible. Notre infrastructure moderne inclut une sonorisation professionnelle JBL, un espace vidéoprojecteur et multimédia, une cuisine entièrement équipée et un accès PMR pour tous vos invités. Depuis ${city.name}, rejoindre notre salle est simple et rapide, quel que soit le mode de transport choisi.`,
      `Les témoignages de couples mariés à ${businessName} depuis ${city.name} sont unanimes : l'accueil chaleureux, la qualité des installations et la flexibilité des formules font toute la différence. Notre équipe est disponible 7j/7 pour répondre à toutes vos questions et vous accompagner dans la réalisation de votre mariage de rêve.`,
    ],
  ]

  return (
    <Section id="pourquoi" title={`Pourquoi choisir ${businessName} depuis ${city.name} ?`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '28px', color: 'var(--text)' }}>
        {intros[v]}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '36px' }}>
        {cards.map((card) => (
          <div key={card.title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 16px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', marginBottom: '8px' }}>{card.icon}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>{card.title}</div>
            <div style={{ fontWeight: '700', color: 'var(--dark)', fontSize: '14px', marginBottom: '4px' }}>{card.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{card.desc}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '600', color: 'var(--dark)', margin: '0 0 14px' }}>
        Pourquoi de nombreux habitants de {city.name} choisissent {businessName}
      </h3>
      {whyParagraphs[v].map((p, i) => (
        <p key={i} style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '14px', color: 'var(--text)' }}>{p}</p>
      ))}

      <div style={{ marginTop: '20px' }}>
        <a
          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(city.name + ', France')}&destination=${encodeURIComponent('5 avenue Fridingen 77100 Nanteuil-les-Meaux')}`}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-outline"
          style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          &#x1F4CD; Itinéraire depuis {city.name} vers {businessName}
        </a>
      </div>
    </Section>
  )
}

// ── 3. Section Prestations ─────────────────────────────────────────────────────

function SectionPrestations({ city, businessName }) {
  const v = cityVariant(city.name, 2)

  const intros = [
    `${businessName} est bien plus qu'une simple salle de réception. C'est un espace polyvalent qui s'adapte à chaque type d'événement. Que vous soyez de ${city.name} ou d'une commune voisine, découvrez l'étendue de nos prestations et trouvez la formule qui correspond parfaitement à votre projet.`,
    `Depuis ${city.name}, les familles et les professionnels font confiance à ${businessName} pour l'organisation de leurs moments les plus importants. Notre salle de réception accueille tous types d'événements avec le même souci du détail et la même exigence de qualité. Voici un aperçu complet de nos prestations disponibles.`,
  ]

  const eventTypes = [
    {
      emoji: '💍',
      title: 'Salle de mariage',
      desc: `${businessName} est avant tout une salle de mariage d'exception. Depuis ${city.name}, de nombreux couples choisissent notre établissement pour célébrer leur union dans un cadre élégant et luxueux. Notre salle de mariage accueille jusqu'à 300 convives et offre tous les services nécessaires pour un Jour J inoubliable : sonorisation professionnelle, éclairage scénique, espace pour le cocktail et bien plus encore. Nous proposons aussi bien la cérémonie civile laïque que la cérémonie religieuse, selon vos souhaits.`,
    },
    {
      emoji: '🍾',
      title: 'Salle de réception',
      desc: `Au-delà des mariages, ${businessName} est la salle de réception idéale pour tous vos événements festifs. Dîners de famille, soirées privées, banquets ou galas — notre équipe s'adapte à votre vision et votre budget pour vous offrir une réception mémorable. Depuis ${city.name}, profitez d'un espace de réception spacieux, climatisé et entièrement équipé pour accueillir vos proches dans les meilleures conditions.`,
    },
    {
      emoji: '🎂',
      title: 'Salle anniversaire',
      desc: `Célébrez votre anniversaire en grand à ${businessName} ! Que vous souhaitiez fêter vos 18 ans, vos 30 ans, vos 50 ans ou un autre cap important, notre salle anniversaire se transforme selon votre thème. Depuis ${city.name}, offrez-vous une fête d'anniversaire digne des plus grandes soirées, avec DJ, animations, photobooth et un traiteur aux petits soins.`,
    },
    {
      emoji: '👶',
      title: 'Salle baptême',
      desc: `${businessName} accueille avec joie et tendresse les baptêmes et cérémonies de bienvenue. Notre équipe comprend l'importance de ce moment unique et met tout en œuvre pour que la journée soit aussi belle que symbolique. Depuis ${city.name}, venez fêter l'arrivée de votre petit(e) dans un cadre chaleureux pouvant accueillir toute votre famille et vos amis.`,
    },
    {
      emoji: '💏',
      title: 'Salle fiançailles',
      desc: `Les fiançailles méritent une célébration à la hauteur de votre amour. ${businessName} met à votre disposition un espace raffiné pour organiser votre soirée de fiançailles dans une ambiance intimiste et romantique. Depuis ${city.name}, surprenez votre entourage avec une soirée de fiançailles organisée avec passion et professionnalisme.`,
    },
    {
      emoji: '💼',
      title: 'Salle séminaire',
      desc: `${businessName} dispose d'un espace parfaitement équipé pour vos séminaires professionnels. Écran vidéoprojecteur, sonorisation, écran multimédia et restauration sur place font de notre salle séminaire un choix privilégié pour les entreprises de ${city.name} et de toute la région. Organisez vos réunions, formations et team-buildings dans un cadre motivant et professionnel.`,
    },
    {
      emoji: '🏢',
      title: 'Salle entreprise',
      desc: `Pour vos événements d'entreprise — inaugurations, remises de prix, soirées de fin d'année — ${businessName} vous propose un espace modulable à l'image de votre société. Notre équipe prend en charge la logistique complète pour que vos collaborateurs venant de ${city.name} et d'ailleurs passent une soirée mémorable.`,
    },
    {
      emoji: '🥂',
      title: 'Salle cocktail',
      desc: `La formule cocktail de ${businessName} est idéale pour les événements debout, les apéritifs dinatoires et les réceptions en mode convivial. Depuis ${city.name}, proposez à vos invités un cocktail de prestige servi par notre équipe de professionnels, dans un cadre moderne et élégant. Jusqu'à 300 personnes peuvent être accueillies en configuration cocktail.`,
    },
  ]

  const services = [
    { cat: '🎬 Animations & Équipements', items: ["Location sèche (salle, chaises, tables)", "Location avec traiteurs partenaires", "Service traiteur en déplacement", "DJ professionnel", "Animation fumée lourde (slow inoubliable)", "Jet de scène (pièce montée / entrée des mariés)", "Photobooth", "Videobooth 360°"] },
    { cat: '🏛️ Équipements de la salle', items: ["Capacité jusqu'à 300 invités", "Parking privé gratuit (~60 places)", "Cuisine professionnelle complète", "Accès PMR (personnes à mobilité réduite)", "Climatisation", "Chauffage", "Sonorisation professionnelle JBL", "Écran vidéoprojecteur", "Écran multimédia"] },
  ]

  return (
    <Section id="prestations" title={`Nos prestations — ${businessName}`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '32px', color: 'var(--text)' }}>{intros[v]}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginBottom: '40px' }}>
        {eventTypes.map((et) => (
          <div key={et.title} style={{ borderLeft: '4px solid var(--gold)', paddingLeft: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: '700', color: 'var(--dark)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{et.emoji}</span> {et.title}
            </h2>
            <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>{et.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', marginTop: '16px' }}>
        {services.map((group) => (
          <div key={group.cat} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: '700', color: 'var(--dark)', marginBottom: '14px' }}>{group.cat}</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.items.map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--gold)', fontWeight: '700', flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 4. Section Comment réserver ────────────────────────────────────────────────

function SectionReservation({ city, businessName }) {
  const v = cityVariant(city.name, 2)

  const intros = [
    `Réserver votre salle de mariage ou de réception au ${businessName} depuis ${city.name} est un processus simple et transparent. En 5 étapes claires, notre équipe vous guide de votre première demande jusqu'au Jour J, en s'assurant que chaque détail est parfaitement maîtrisé.`,
    `${businessName} a développé un processus de réservation fluide et sans surprise pour tous les couples et familles de ${city.name}. Voici les 5 étapes qui vous mèneront vers votre événement parfait, organisé avec soin et professionnalisme par notre équipe dédiée.`,
  ]

  const steps = [
    {
      n: '01', emoji: '📋', title: 'Demande de devis',
      desc: `Commencez par nous contacter via notre formulaire en ligne ou par téléphone/WhatsApp. Précisez la date souhaitée, le type d'événement (mariage, anniversaire, etc.), le nombre d'invités estimé et vos besoins spécifiques. Notre équipe vous répond sous 24h avec un devis personnalisé et sans engagement. Depuis ${city.name}, votre projet mérite toute notre attention dès le premier contact.`,
    },
    {
      n: '02', emoji: '👀', title: 'Visite de la salle',
      desc: `Rien ne vaut une visite en personne pour se projeter ! Nous vous invitons à découvrir ${businessName} sur rendez-vous. Depuis ${city.name}, un trajet de ${getTravelInfo(city).driveMin} minutes vous permet de visualiser la salle, les équipements, la cuisine et le parking. Notre équipe vous accueille et répond à toutes vos questions lors de cette visite conviviale et sans pression.`,
    },
    {
      n: '03', emoji: '🖊', title: 'Signature du contrat',
      desc: `Une fois votre choix arrêté, nous établissons un contrat de location clair et détaillé qui récapitule toutes les prestations choisies, les dates, les horaires et les conditions. La signature officialise votre réservation et protège les deux parties. Chez ${businessName}, la transparence est au cœur de notre relation avec chaque client de ${city.name}.`,
    },
    {
      n: '04', emoji: '💳', title: "Versement de l'acompte",
      desc: `Lors de la signature, un acompte est versé pour confirmer et sécuriser votre date. Cet acompte est déduit du montant total de votre prestation. Différents moyens de paiement sont acceptés. Le solde est réglé à la date convenue dans le contrat, généralement avant votre événement.`,
    },
    {
      n: '05', emoji: '🎉', title: 'Le Jour J',
      desc: `C'est le grand jour ! L'équipe de ${businessName} est là dès le début pour coordonner la mise en place, accueillir vos invités et s'assurer que tout se déroule parfaitement. Vous et vos proches venant de ${city.name} et d'ailleurs n'avez plus qu'à profiter de chaque instant. Nous gérons la logistique pour que vous puissiez vivre pleinement votre événement.`,
    },
  ]

  return (
    <Section id="reservation" title={`Comment réserver une salle de mariage à ${city.name}`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '32px', color: 'var(--text)' }}>{intros[v]}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {steps.map((step) => (
          <div key={step.n} style={{ display: 'flex', gap: '20px', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ flexShrink: 0, width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '18px' }}>{step.n}</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: '700', color: 'var(--dark)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{step.emoji}</span> {step.title}
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 5. Section Capacité ────────────────────────────────────────────────────────

function SectionCapacite({ city, businessName }) {
  const v = cityVariant(city.name, 2)
  const intros = [
    `${businessName} est l'une des salles de réception les plus spacieuses et les mieux équipées d'Île-de-France. Depuis ${city.name}, accédez en ${getTravelInfo(city).driveMin} minutes à un espace capable d'accueillir jusqu'à 300 invités dans des conditions optimales de confort et d'élégance.`,
    `Avec une capacité maximale de 300 personnes, ${businessName} est la salle de réception de référence pour les grands événements depuis ${city.name}. Que vous soyez 80 ou 300 invités, notre espace modulable s'adapte à la taille de votre réunion pour un résultat toujours impeccable.`,
  ]
  const specs = [
    { icon: '👥', label: 'Capacité maximale', value: '300 personnes' },
    { icon: '🅿', label: 'Parking', value: '~60 places gratuites' },
    { icon: '🍳', label: 'Cuisine', value: 'Professionnelle équipée' },
    { icon: '♿', label: 'Accessibilité', value: 'PMR — accès total' },
    { icon: '❄', label: 'Climatisation', value: 'Toutes saisons' },
    { icon: '🔊', label: 'Sonorisation', value: 'JBL Professionnelle' },
    { icon: '💻', label: 'Multimédia', value: 'Vidéoprojecteur + écran' },
    { icon: '🔒', label: 'Sécurité', value: 'Agent de sécurité' },
  ]
  return (
    <Section id="capacite" title={`Capacité et équipements — ${businessName}`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '28px', color: 'var(--text)' }}>{intros[v]}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
        {specs.map((s) => (
          <div key={s.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px 14px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ fontWeight: '700', color: 'var(--dark)', fontSize: '14px' }}>{s.value}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 6. Section Galerie ─────────────────────────────────────────────────────────

function SectionGalerie({ gallery, instagramUsername, instagramPosts, tiktokUsername, tiktokPosts }) {
  return (
    <Section id="galerie" title="📸 Galerie & Réseaux sociaux">
      {gallery && gallery.length > 0 && (
        <div style={{ marginBottom: '36px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: '700', color: 'var(--dark)', marginBottom: '16px' }}>Notre galerie photos</h3>
          <GalleryGrid photos={gallery} />
        </div>
      )}

      {(instagramUsername || instagramPosts.length > 0) && (
        <div style={{ marginBottom: '36px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: '700', color: 'var(--dark)', marginBottom: '10px' }}>
            📸 Instagram
          </h3>
          {instagramUsername && (
            <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-light)' }}>
              Suivez-nous sur{' '}
              <a href={`https://www.instagram.com/${instagramUsername}`} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--gold)', fontWeight: '600' }}>
                @{instagramUsername}
              </a>
            </p>
          )}
          {instagramPosts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {instagramPosts.filter(Boolean).map((url, i) => <InstagramEmbed key={i} url={url} />)}
            </div>
          )}
        </div>
      )}

      {(tiktokUsername || tiktokPosts.length > 0) && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: '700', color: 'var(--dark)', marginBottom: '10px' }}>
            🎵 TikTok
          </h3>
          {tiktokUsername && (
            <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-light)' }}>
              Nos dernières vidéos sur{' '}
              <a href={`https://www.tiktok.com/@${tiktokUsername}`} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--gold)', fontWeight: '600' }}>
                @{tiktokUsername}
              </a>
            </p>
          )}
          {tiktokPosts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {tiktokPosts.filter(Boolean).map((url, i) => <TikTokEmbed key={i} url={url} />)}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── 7. Section Lieux emblématiques ─────────────────────────────────────────────

function SectionLieux({ city, businessName }) {
  const v = cityVariant(city.name)

  const lieuxVariants = [
    [
      { emoji: '🏛', title: `Mairie de ${city.name}`, desc: `La mairie de ${city.name} est le premier lieu symbolique de votre mariage. C'est ici que se déroule la cérémonie civile officielle, moment solennel et émouvant qui unit légalement les deux époux. Le bâtiment historique de la mairie de ${city.name} offre souvent un cadre architectural charmant pour vos premières photos de couple.` },
      { emoji: '⛪', title: `Église / lieu de culte à ${city.name}`, desc: `Après la cérémonie civile, de nombreux couples de ${city.name} choisissent de prolonger leur engagement par une cérémonie religieuse. Les lieux de culte de ${city.name} et de ses environs — église paroissiale, temple, synagogue ou mosquée — offrent un cadre spirituel et solennel pour la bénédiction de votre union.` },
      { emoji: '🌳', title: `Parc municipal de ${city.name}`, desc: `Le parc ou les espaces verts de ${city.name} sont idéaux pour les photos de mariage en plein air. Les arbres centenaires, les allées fleuries et la verdure offrent des décors naturels magnifiques pour immortaliser votre Jour J. Votre photographe de mariage appréciera la beauté et la lumière de ces espaces.` },
      { emoji: '🏙', title: `Centre-ville et monuments de ${city.name}`, desc: `Le centre-ville de ${city.name}, avec ses ruelles pittoresques et ses monuments locaux, constitue un décor authentique pour vos photos de mariage. Chaque ville a ses lieux emblématiques et ses perspectives uniques — autant d'opportunités pour des clichés originaux et pleins de caractère.` },
    ],
    [
      { emoji: '🏛', title: `Hôtel de ville de ${city.name}`, desc: `L'hôtel de ville de ${city.name} est le cadre officiel de votre mariage civil. Ce bâtiment municipal, souvent chargé d'histoire, accueille chaque année des dizaines de cérémonies civiles. C'est le premier acte de votre engagement, celui qui vous unit aux yeux de la loi, dans la salle des mariages de la commune.` },
      { emoji: '🌿', title: `Jardin public de ${city.name}`, desc: `Les jardins publics de ${city.name} offrent un cadre verdoyant et apaisé pour vos photos de mariage. Rosiers en fleurs, fontaines et allées ombragées créent des décors bucoliques parfaits pour les portraits de couple et les photos de groupe après la cérémonie. Une escapade nature à deux pas de la salle de réception.` },
      { emoji: '⛪', title: `Chapelle et lieux de cérémonie à ${city.name}`, desc: `Pour les couples souhaitant une cérémonie religieuse ou une bénédiction, ${city.name} et ses environs comptent plusieurs chapelles et lieux de culte de caractère. Ces petits sanctuaires, souvent patrimoniaux, offrent une intimité et une émotion particulières pour célébrer votre union devant Dieu et vos proches.` },
      { emoji: '🏙', title: `Place centrale et patrimoine de ${city.name}`, desc: `La place centrale de ${city.name} et ses abords historiques sont un décor de premier choix pour vos photos de mariage. Les façades anciennes, les cafés en terrasse et l'architecture locale créent une atmosphère typiquement française qui donnera du cachet à vos souvenirs photographiques.` },
    ],
    [
      { emoji: '🏛', title: `Mairie de ${city.name} — cérémonie civile`, desc: `La mairie de ${city.name} est incontournable pour tout mariage : c'est là que se tient la cérémonie civile, moment légal et symbolique de votre union. Les agents municipaux de ${city.name} vous accompagnent avec bienveillance pour que ce moment soit gravé dans vos mémoires.` },
      { emoji: '🌲', title: `Forêt / bois à proximité de ${city.name}`, desc: `Les bois et forêts à proximité de ${city.name} offrent des décors naturels somptueux pour vos photos de mariage. La lumière filtrée par les frondaisons, les chemins forestiers et la sérénité de la nature créent des portraits de couple d'une rare beauté. Un cadre idéal pour les amoureux de la nature.` },
      { emoji: '🕌', title: `Domaine et parc près de ${city.name}`, desc: `Aux alentours de ${city.name}, quelques domaines et parcs historiques ouvrent leurs portes aux couples pour des séances photo de mariage. Ces espaces privatifs ou publics offrent des perspectives grandioses et une élégance naturelle qui sublimeront vos photos de couple.` },
      { emoji: '⛪', title: `Lieu de cérémonie religieuse à ${city.name}`, desc: `Pour les couples souhaitant unir leur mariage civil à une cérémonie religieuse, ${city.name} et ses alentours proposent des lieux de culte accessibles à toutes les confessions. Ces espaces de recueillement offrent une dimension spirituelle profonde à votre engagement amoureux.` },
    ],
  ]

  const intros = [
    `${city.name} regorge de lieux chargés d'histoire et de charme qui se prêtent à merveille aux photos et moments clés de votre mariage. Voici les endroits emblématiques de ${city.name} à ne pas manquer pour un reportage photo mémorable et des souvenirs impérissables.`,
    `Votre mariage à ${city.name} ne serait pas complet sans un tour des lieux emblématiques de la ville. Ces espaces locaux, chargés de sens et d'histoire, constituent le cadre parfait pour vos photos de couple, vos portraits de famille et vos souvenirs de mariage.`,
    `${city.name} offre à chaque couple des espaces uniques pour célébrer et immortaliser leur mariage. Des monuments historiques aux espaces naturels préservés, voici une sélection des lieux emblématiques à explorer pour vos photos et moments forts du Jour J.`,
  ]

  const outros = [
    `Après avoir profité de tous ces décors magnifiques à ${city.name}, il ne vous restera plus qu'à rejoindre ${businessName || 'Le Paradise 77'} en quelques minutes pour démarrer la célébration en salle. La proximité de notre salle depuis ${city.name} est l'un de ses atouts majeurs.`,
    `Ces lieux emblématiques de ${city.name} constituent le prologue parfait à votre soirée de réception au ${businessName || 'Paradise 77'}. Profitez de la journée pour explorer ${city.name} et créez des souvenirs inoubliables avant de rejoindre notre salle pour la grande célébration.`,
    `L'alliance entre les beaux décors de ${city.name} et l'excellence de notre salle de réception font du mariage depuis ${city.name} une expérience hors du commun. Contactez-nous dès maintenant pour planifier votre Jour J et visiter notre établissement.`,
  ]

  return (
    <Section id="lieux" title={`Lieux emblématiques de ${city.name} pour votre mariage`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '28px', color: 'var(--text)' }}>{intros[v]}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {lieuxVariants[v].map((lieu) => (
          <div key={lieu.title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>{lieu.emoji}</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: '700', color: 'var(--dark)', margin: '0 0 10px' }}>{lieu.title}</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.75, color: 'var(--text)', margin: 0 }}>{lieu.desc}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '14px', lineHeight: 1.85, color: 'var(--text-light)', fontStyle: 'italic' }}>{outros[v]}</p>
    </Section>
  )
}

// ── 8. Section Conseils pour organiser son mariage ─────────────────────────────

function SectionConseils({ city }) {
  const v = cityVariant(city.name)

  const conseilsVariants = [
    [
      { emoji: '📅', title: "Réservez votre salle au moins 12 à 18 mois à l'avance", desc: `Les salles de mariage de qualité, comme Le Paradise 77, se réservent très tôt. Si vous habitez ${city.name} et rêvez d'un mariage dans les 12 prochains mois, commencez par vérifier la disponibilité de votre salle en priorité. Les meilleures dates (mai à octobre, weekends) partent souvent en premier. N'attendez pas pour sécuriser votre créneau.` },
      { emoji: '💰', title: 'Définissez votre budget total avant toute réservation', desc: `Établir un budget global réaliste est la première étape pour éviter les mauvaises surprises. Répartissez-le entre les principaux postes : salle de réception (~25-30%), traiteur (~30-35%), photo/vidéo (~10-15%), robe et costumes (~10%), fleurs et décoration (~8-10%), musique/DJ (~8%). Cette répartition vous permettra de faire des choix éclairés depuis ${city.name}.` },
      { emoji: '📝', title: "Établissez votre liste d'invités avec précision", desc: `Le nombre d'invités impacte directement le coût total de votre mariage. Soyez méthodiques : commencez par les indispensables (famille proche, meilleurs amis), puis étendez selon votre budget. Une liste d'environ 100-200 personnes est idéale pour la grande salle du Paradise 77, permettant un dîner assis confortable avec espace de danse.` },
      { emoji: '🏛', title: 'Choisissez votre salle de réception en priorité', desc: `La salle de réception est le pivot de votre organisation. Depuis ${city.name}, visitez Le Paradise 77 pour vous assurer que l'espace répond à vos attentes en termes de capacité, d'ambiance et d'équipements. Une fois la salle confirmée, les autres prestataires (traiteur, DJ, décorateur) peuvent être choisis en fonction du lieu.` },
      { emoji: '🍽', title: 'Sélectionnez votre traiteur selon vos goûts', desc: `Le repas est l'un des moments les plus attendus de votre mariage. Au Paradise 77, vous pouvez choisir parmi nos traiteurs partenaires (cuisine française, africaine, orientale, internationale) ou apporter votre propre traiteur. Organisez des dégustations pour vos invités venant de ${city.name} et faites votre choix en toute connaissance.` },
      { emoji: '🎶', title: 'Pensez aux animations dès le début', desc: `Un mariage mémorable, c'est aussi de l'animation ! DJ, photobooth, videobooth 360°, fumée lourde pour le slow, jet de scène pour la pièce montée... Le Paradise 77 propose toutes ces animations en interne. Définissez dès la réservation les animations souhaitées pour que votre soirée depuis ${city.name} soit exceptionnelle.` },
      { emoji: '📸', title: 'Choisissez vos prestataires photo et vidéo', desc: `Le photographe et le vidéaste capturent l'émotion de votre Jour J pour l'éternité. Rencontrez plusieurs prestataires depuis ${city.name}, consultez leurs portfolios et assurez-vous de votre feeling avec eux. Réservez-les tôt car les bons photographes de mariage sont rapidement complets sur les dates de week-end.` },
      { emoji: '💌', title: "Envoyez les faire-part 3 à 4 mois à l'avance", desc: `Les faire-part doivent parvenir à vos invités suffisamment tôt pour qu'ils puissent s'organiser, surtout s'ils viennent de loin. Envoyez les save the date 6 à 8 mois avant, puis les invitations officielles 3 à 4 mois avant la cérémonie. N'oubliez pas d'inclure toutes les informations pratiques pour rejoindre Le Paradise 77 depuis ${city.name}.` },
    ],
    [
      { emoji: '🎨', title: 'Définissez votre thème et style de mariage', desc: `Le thème de votre mariage donne la direction à tous vos choix (couleurs, décoration, tenue, fleurs, invitation). Bohème, romantique, champêtre, moderne, mariage africain ou oriental... Définissez votre style dès le début pour que tout soit cohérent. La salle modulable du Paradise 77 s'adapte à tous les thèmes depuis ${city.name}.` },
      { emoji: '🏛', title: 'Réservez votre salle de réception en priorité absolue', desc: `Avant même de contacter d'autres prestataires, sécurisez votre salle. Le Paradise 77, à seulement quelques minutes de ${city.name}, propose des dates tout au long de l'année. Une fois la salle réservée, vous disposez d'un cadre et d'une date fixes pour organiser le reste sereinement.` },
      { emoji: '📋', title: 'Planifiez le menu avec votre traiteur', desc: `Le menu est l'un des sujets les plus discutés d'un mariage. Pour vos invités venant de ${city.name} et d'ailleurs, proposez un menu équilibré qui respecte les préférences culturelles et les régimes alimentaires de chacun. Le Paradise 77 travaille avec des traiteurs multispecialités pour satisfaire tous vos convives.` },
      { emoji: '🌸', title: 'Pensez à la décoration en accord avec la salle', desc: `La décoration transforme votre salle de réception en un espace unique et personnel. Fleurs, centres de table, luminaires, tissus, arches florales... Visitez Le Paradise 77 depuis ${city.name} pour vous inspirer et imaginer la décoration idéale. Notre espace spacieux permet des installations décoratives ambitieuses et créatives.` },
      { emoji: '🎵', title: "Choisissez votre DJ pour l'ambiance musicale", desc: `La musique est l'âme de votre soirée. Le Paradise 77 dispose d'une sonorisation professionnelle JBL qui valorise le travail de votre DJ. Choisissez un DJ expérimenté en mariages depuis ${city.name}, qui sait animer une salle diverse et maintenir l'énergie tout au long de la nuit jusqu'à 4h du matin.` },
      { emoji: '📊', title: 'Préparez un plan de table réfléchi', desc: `Le plan de table évite les situations délicates et favorise les échanges entre convives. Prenez en compte les affinités, les âges et les liens familiaux. Avec une salle de 300 personnes comme Le Paradise 77, un plan de table bien pensé transforme votre réception en un moment de convivialité générale pour tous vos invités de ${city.name}.` },
      { emoji: '🚌', title: 'Organisez le transport de vos invités', desc: `Pensez à faciliter l'accès au Paradise 77 pour vos invités qui ne connaissent pas le chemin depuis ${city.name} ou d'autres villes. Communiquez clairement l'adresse, les indications routières et les informations parking dans vos invitations. Pour les invités sans voiture, mentionnez les options de transport depuis Meaux (taxi, covoiturage).` },
      { emoji: '💍', title: 'Préparez votre planning du Jour J', desc: `Un mariage bien orchestré suit un planning précis et clair. Établissez un rétroplanning détaillé heure par heure pour le Jour J : horaire de la mairie, photos, arrivée à la salle, cocktail, repas, animations... Partagez ce planning avec votre équipe et les prestataires pour que chacun sache exactement quoi faire.` },
    ],
    [
      { emoji: '🏛', title: 'Commencez par réserver Le Paradise 77', desc: `La règle d'or : réservez votre salle de mariage en premier. Le Paradise 77, à quelques minutes de ${city.name}, est souvent complet 12 à 18 mois à l'avance pour les grandes dates. Lancez votre demande de devis dès maintenant et sécurisez votre date avant toute autre démarche.` },
      { emoji: '💰', title: 'Budgétisez chaque poste de dépense', desc: `Un mariage réussi depuis ${city.name} se planifie avec un budget réaliste. Listez tous les postes de dépenses (salle, traiteur, DJ, décoration, tenues, photographe, fleurs, transport, hébergement invités...) et attribuez une enveloppe à chacun. Le Paradise 77 propose des formules à différents budgets pour s'adapter à votre situation.` },
      { emoji: '📝', title: "Finalisez votre liste d'invités rapidement", desc: `Le nombre d'invités détermine le coût total de votre mariage et l'organisation de la salle. Dressez une liste définitive dès que possible pour optimiser votre budget. Le Paradise 77 accueille jusqu'à 300 personnes, offrant une grande flexibilité pour les familles nombreuses de ${city.name} et de la région.` },
      { emoji: '⛪', title: 'Planifiez la cérémonie civile et/ou religieuse', desc: `N'oubliez pas de prendre rendez-vous avec la mairie de ${city.name} pour la publication des bans et la cérémonie civile. Si vous souhaitez une cérémonie religieuse, contactez votre lieu de culte au plus tôt. Ces étapes administratives et spirituelles sont incontournables et demandent du temps de préparation.` },
      { emoji: '📸', title: 'Choisissez vos prestataires photo et vidéo avec soin', desc: `Les photos et la vidéo de votre mariage resteront vos souvenirs pour toujours. Investissez dans de bons professionnels depuis ${city.name} qui connaissent les lieux et savent capter l'émotion du Jour J. Consultez plusieurs portfolios et n'hésitez pas à rencontrer vos candidats en personne avant de décider.` },
      { emoji: '🎉', title: 'Pensez aux animations pour toute la nuit', desc: `Pour que vos invités de ${city.name} dansent jusqu'à 4h du matin, misez sur des animations variées et de qualité. Le Paradise 77 propose DJ, photobooth, videobooth 360°, fumée lourde pour le slow et jet de scène. Ces animations incluses dans nos formules garantissent une soirée rythmée et mémorable pour tous.` },
      { emoji: '💌', title: 'Envoyez des faire-part personnalisés', desc: `Vos faire-part sont la première impression que vos invités auront de votre mariage. Soignez-les ! Incluez toutes les informations pratiques pour rejoindre Le Paradise 77 depuis ${city.name} et les villes environnantes : adresse, GPS, parking, hébergements à proximité. Un beau faire-part annonce un beau mariage.` },
      { emoji: '📋', title: 'Préparez un rétroplanning détaillé', desc: `De J-18 mois à J+1, établissez un rétroplanning complet avec toutes les échéances importantes : réservations, rendez-vous prestataires, essayages, répétitions... Ce document de référence vous permettra d'avancer sereinement dans la préparation de votre mariage depuis ${city.name} sans rien oublier.` },
    ],
  ]

  return (
    <Section id="conseils" title={`Conseils pour organiser votre mariage à ${city.name}`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '28px', color: 'var(--text)' }}>
        Organiser un mariage depuis {city.name} est un projet magnifique qui demande rigueur et anticipation. Notre équipe, forte de nombreuses années d&#x27;expérience dans l&#x27;organisation d&#x27;événements, partage avec vous ses meilleurs conseils pour faire de votre Jour J un souvenir impérissable.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {conseilsVariants[v].map((conseil, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', boxShadow: 'var(--shadow-sm)', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '28px', flexShrink: 0 }}>{conseil.emoji}</div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: '700', color: 'var(--dark)', margin: '0 0 8px' }}>{conseil.title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--text)', margin: 0 }}>{conseil.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 9. Section FAQ ─────────────────────────────────────────────────────────────

function SectionFAQ({ city, businessName }) {
  const [open, setOpen] = useState(null)
  const v = cityVariant(city.name)

  const baseFaqs = [
    {
      q: `Combien coûte une salle de mariage près de ${city.name} ?`,
      a: `Le tarif de location de ${businessName} varie selon la formule choisie (location sèche, avec traiteur, ou tout compris) et la période de l'année. Nous proposons des formules adaptées à tous les budgets. Depuis ${city.name}, contactez-nous pour recevoir un devis gratuit, détaillé et sans engagement, personnalisé selon votre projet.`,
    },
    {
      q: 'Peut-on apporter son propre traiteur ?',
      a: `Oui, il est possible d'apporter votre propre traiteur au ${businessName}. Cependant, nous proposons également un service traiteur complet avec plusieurs spécialités culinaires (cuisine africaine, orientale, française, internationale). Nos traiteurs partenaires connaissent parfaitement nos locaux et vous garantissent une prestation de qualité irréprochable.`,
    },
    {
      q: "Combien d'invités peut accueillir la salle ?",
      a: `${businessName} peut accueillir jusqu'à 300 invités. Notre salle est modulable pour s'adapter à tous les formats d'événements, qu'il s'agisse d'un dîner intime de 80 personnes ou d'une grande réception de 300 convives. Chaque configuration est optimisée pour offrir confort et convivialité à tous vos invités venant de ${city.name}.`,
    },
    {
      q: 'Existe-t-il un parking sur place ?',
      a: `Oui, ${businessName} dispose d'un parking privatif gratuit d'environ 60 places, surveillé par un agent de sécurité. Vos invités venant de ${city.name} et d'ailleurs peuvent se garer facilement et en toute sécurité. Le parking est éclairé et accessible tout au long de la soirée jusqu'à la fermeture à 4h du matin.`,
    },
    {
      q: "Y a-t-il un jardin ou un espace extérieur ?",
      a: `Non, ${businessName} ne dispose pas d'espace extérieur ou de jardin. Toute la magie se passe à l'intérieur, dans notre salle climatisée et entièrement équipée. Pour les photos en extérieur, votre photographe peut organiser des sessions dans les espaces verts à proximité de la salle, avant ou après la cérémonie.`,
    },
    {
      q: 'Peut-on organiser une cérémonie religieuse dans la salle ?',
      a: `Oui, il est tout à fait possible d'organiser une cérémonie religieuse ou laïque au ${businessName}. Notre salle accueille toutes les confessions et traditions : cérémonie catholique, musulmane, juive, bouddhiste ou cérémonie laïque personnalisée. Nous mettons à votre disposition un espace adapté pour ce moment solennel et émouvant.`,
    },
    {
      q: "Jusqu'à quelle heure peut durer la soirée ?",
      a: `La soirée au ${businessName} peut se prolonger jusqu'à 4h du matin. Vous avez tout le temps pour profiter pleinement de votre nuit de fête, sans vous soucier de l'heure. Depuis ${city.name}, vos invités ont le temps de célébrer, de danser et de créer des souvenirs inoubliables.`,
    },
    {
      q: 'Peut-on visiter la salle avant de réserver ?',
      a: `Oui, les visites de ${businessName} sont possibles sur rendez-vous. Depuis ${city.name}, rejoignez notre salle en seulement ${getTravelInfo(city).driveMin} minutes pour découvrir en personne nos espaces, nos équipements et notre cuisine professionnelle. Notre équipe vous accueille chaleureusement et répond à toutes vos questions sans engagement.`,
    },
    {
      q: 'La salle est-elle climatisée ?',
      a: `Oui, ${businessName} est entièrement climatisée. Quelle que soit la saison — été ou hiver — la température intérieure est toujours agréable pour vous et vos invités. Profitez de votre soirée dans un confort optimal, sans jamais vous soucier de la chaleur ou du froid.`,
    },
    {
      q: 'La salle est-elle chauffée en hiver ?',
      a: `Oui, bien évidemment. ${businessName} est équipée d'un système de chauffage performant pour maintenir une température confortable en toutes saisons. Vos hivers mariages et réceptions d'hiver se déroulent dans la même chaleur et le même confort que les événements estivaux.`,
    },
    {
      q: "Y a-t-il des hôtels à proximité de la salle ?",
      a: `Oui, deux hôtels se trouvent à seulement 200 mètres du ${businessName} : l'Hôtel Première Classe et l'Hôtel Kyriad. Ces établissements sont parfaitement adaptés pour accueillir vos invités venant de ${city.name} et de loin qui souhaitent éviter la route après la soirée. Précisez-les dans vos invitations pour faciliter l'organisation.`,
    },
    {
      q: `${businessName} propose-t-il des formules tout compris ?`,
      a: `Oui ! En plus de la location sèche, ${businessName} propose des formules clé en main incluant la salle, le traiteur, le DJ, les animations (photobooth, videobooth 360°, fumée lourde, jet de scène), la décoration et bien plus. Une seule adresse depuis ${city.name} pour tout organiser, sans stress et sans courir après plusieurs prestataires.`,
    },
  ]

  const extraFaqs = [
    [
      { q: "La salle est-elle accessible aux personnes à mobilité réduite (PMR) ?", a: `Oui, ${businessName} est entièrement accessible aux personnes à mobilité réduite. Nos installations sont conçues et aménagées pour accueillir tous vos invités dans les meilleures conditions, quelles que soient leurs capacités physiques. L'accès PMR est une priorité pour notre équipe.` },
      { q: "Proposez-vous des formules pour les anniversaires et autres événements ?", a: `Absolument ! En plus des mariages, ${businessName} organise des anniversaires mémorables (18, 30, 40, 50 ans...), des baptêmes, des fiançailles et des séminaires d'entreprise. Depuis ${city.name}, toutes vos occasions de fête méritent le cadre exceptionnel du Paradise 77.` },
    ],
    [
      { q: "Peut-on organiser un séminaire d'entreprise au ${businessName} ?", a: `Oui, ${businessName} accueille séminaires et événements d'entreprise. Notre salle équipée d'un vidéoprojecteur, d'un écran multimédia et d'une sonorisation professionnelle est idéale pour vos réunions, formations et team-buildings depuis ${city.name}. Contactez-nous pour un devis entreprise personnalisé.` },
      { q: `Disposez-vous d'un espace pour un cocktail de bienvenue ?`, a: `Oui, ${businessName} peut aménager un espace cocktail dans notre salle. Que ce soit pour un apéritif dinatoire ou un cocktail de bienvenue, nos équipes s'occupent de tout. Vos invités de ${city.name} seront accueillis en grande pompe dès leur arrivée.` },
    ],
    [
      { q: `Y a-t-il un service de covoiturage ou de navette possible depuis ${city.name} ?`, a: `${businessName} ne propose pas de navette directe depuis ${city.name}, mais nous pouvons vous recommander des prestataires de transport partenaires. Avec notre parking de 60 places, la plupart de vos invités peuvent venir en voiture. La gare de Meaux, à 15 minutes, est également accessible pour vos invités sans véhicule.` },
      { q: `Proposez-vous un accompagnement pour la coordination du mariage ?`, a: `Oui, l'équipe du ${businessName} peut vous accompagner dans la coordination de votre mariage depuis ${city.name}. Nous travaillons en partenariat avec des wedding planners expérimentés pour que votre Jour J se déroule parfaitement, de la mise en place au final de la soirée.` },
    ],
  ]

  const allFaqs = [...baseFaqs, ...extraFaqs[v]]

  return (
    <Section id="faq" title={`FAQ — Toutes vos questions sur ${businessName} depuis ${city.name}`}>
      <p style={{ fontSize: '15px', lineHeight: 1.85, marginBottom: '24px', color: 'var(--text)' }}>
        Vous avez des questions sur la réservation d&#x27;une salle de mariage ou de réception depuis {city.name} ? Voici les réponses aux questions les plus fréquemment posées par nos futurs mariés.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allFaqs.map((faq, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
            >
              <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--dark)', lineHeight: 1.4 }}>{faq.q}</span>
              <span style={{ flexShrink: 0, color: 'var(--gold)', fontSize: '20px', lineHeight: 1 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 20px 16px', fontSize: '14px', lineHeight: 1.8, color: 'var(--text)', borderTop: '1px solid var(--border)' }}>
                <div style={{ paddingTop: '12px' }}>{faq.a}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── 10. Maillage interne — Zone d'intervention ─────────────────────────────────

function NearbyLinks({ citySlug, allTypePages, city, businessName, currentBasePath }) {
  const nearby = getNearbyCities(citySlug, 5)

  // For each nearby city, collect links to every page type that has been generated
  const nearbyCitiesWithLinks = nearby.map((c) => {
    const typeLinks = PAGE_TYPES.flatMap((pt) => {
      const pages = allTypePages[pt.id]
      if (!pages || !pages[c.slug]) return []
      return [{ basePath: pt.basePath, label: pt.label, icon: pt.icon, id: pt.id }]
    })
    return { city: c, typeLinks }
  }).filter((item) => item.typeLinks.length > 0)

  if (nearbyCitiesWithLinks.length === 0) return null

  const v = cityVariant(city.name, 2)
  const intros = [
    `${businessName} intervient dans toute la région Île-de-France et bien au-delà de ${city.name}. Retrouvez ci-dessous les pages dédiées aux communes les plus proches (moins de 5 km) — mariages, réceptions, anniversaires, baptêmes, fiançailles et séminaires — qui bénéficient également de nos services.`,
    `Notre zone d'intervention couvre ${city.name} et toutes les communes environnantes dans un rayon de 5 km. ${businessName} est facilement accessible depuis chacune de ces villes voisines pour l'organisation de tous vos événements : mariages, réceptions, anniversaires, baptêmes, fiançailles et séminaires.`,
  ]

  return (
    <Section id="maillage" title="🗺️ Notre zone d'intervention">
      <p style={{ color: 'var(--text)', fontSize: '15px', lineHeight: 1.85, marginBottom: '24px' }}>
        {intros[v]}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {nearbyCitiesWithLinks.map(({ city: c, typeLinks }) => (
          <div key={c.slug} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '15px', color: 'var(--dark)', marginBottom: '10px' }}>
              📍 {c.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {typeLinks.map((tl) => (
                <Link
                  key={tl.id}
                  to={`${tl.basePath}/${c.slug}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 14px',
                    background: tl.basePath === currentBasePath ? 'var(--gold)' : 'var(--gold-pale)',
                    border: '1px solid var(--gold)',
                    borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    color: tl.basePath === currentBasePath ? 'white' : 'var(--dark)',
                    textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = tl.basePath === currentBasePath ? 'var(--gold)' : 'var(--gold-pale)'
                    e.currentTarget.style.color = tl.basePath === currentBasePath ? 'white' : 'var(--dark)'
                  }}
                >
                  {tl.icon} {tl.label.replace(/^Pages /, '')}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--text-light)', fontSize: '13px', lineHeight: 1.7, marginTop: '16px' }}>
        Vous ne trouvez pas votre commune ? {businessName} accueille des clients de toute l&#x27;Île-de-France. Contactez-nous directement pour tout renseignement.
      </p>
    </Section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CityPage({ pageType }) {
  const { citySlug } = useParams()
  const [page, setPage]             = useState(null)
  const [gallery, setGallery]       = useState([])
  const [config, setConfig]         = useState(null)
  const [allTypePages, setAllTypePages] = useState({})
  const [loading, setLoading]       = useState(true)

  // Use the page-type-scoped storage
  const storage = makePageTypeStorage(pageType?.id || 'mariage')
  const basePath = pageType?.basePath || '/locationsalledemariage'

  useEffect(() => {
    setLoading(true)
    // Load current type pages + gallery + config + ALL other type pages in parallel
    const allTypeStorages = PAGE_TYPES.map((pt) => makePageTypeStorage(pt.id))
    Promise.all([
      storage.getPages(),
      storage.getGallery(),
      getCityPagesConfig(),
      ...allTypeStorages.map((s) => s.getPages()),
    ]).then(([pages, gal, cfg, ...typePagesArr]) => {
      setPage(pages?.[citySlug] || null)
      setGallery(gal || [])
      setConfig(cfg)
      // Build a map: { [typeId]: pagesMap }
      const typeMap = {}
      PAGE_TYPES.forEach((pt, i) => {
        typeMap[pt.id] = typePagesArr[i] || {}
      })
      setAllTypePages(typeMap)
      setLoading(false)
    })
  }, [citySlug, pageType?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const city = getCityBySlug(citySlug)

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        Chargement…
      </div>
    )
  }

  if (!city || !page) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>🏙</div>
        <h2 style={{ color: 'var(--dark)' }}>Page introuvable</h2>
        <p style={{ color: '#888' }}>Cette page n&#x27;a pas encore été générée.</p>
        <Link to="/" className="btn btn-primary">Retour à l&#x27;accueil</Link>
      </div>
    )
  }

  const businessName      = config?.businessName || 'Le Paradise 77'
  const instagramUsername = config?.instagramUsername || ''
  const tiktokUsername    = config?.tiktokUsername || ''
  const instagramPosts    = config?.instagramPosts || []
  const tiktokPosts       = config?.tiktokPosts || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--dark)', color: 'white', padding: '0 clamp(16px,5vw,80px)', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(28,28,46,0.3)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
          <div style={{ width: '2px', height: '36px', background: 'var(--gold)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: '22px', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{businessName}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{city.deptName}</div>
          </div>
        </Link>
        <Link to="/devis" className="btn btn-primary" style={{ fontSize: '13px' }}>Demander un devis</Link>
      </header>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(135deg, var(--dark) 0%, var(--navy) 100%)', color: 'white', padding: 'clamp(40px,8vw,80px) clamp(16px,5vw,80px)', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'var(--gold)', color: 'white', padding: '4px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>
          {city.deptCode} — {city.deptName}
        </div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: '700', color: 'white', marginBottom: '12px', letterSpacing: '0.03em' }}>
          Salle de mariage et réception — {businessName} à {city.name}
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', maxWidth: '680px', margin: '0 auto 8px' }}>
          Le Paradise 77 — votre salle de mariage de prestige pour tous vos mariages et réceptions
        </p>
        <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', maxWidth: '600px', margin: '0 auto 24px' }}>
          Salle de mariage et réception accessible depuis {city.name} ({city.deptName})
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/devis" className="btn btn-primary" style={{ fontSize: '14px', padding: '12px 28px' }}>
            📋 Demander un devis gratuit
          </Link>
          <a href="#carte" className="btn btn-outline" style={{ fontSize: '14px', padding: '12px 28px', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>
            📍 Nous trouver
          </a>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,5vw,40px)' }}>

        {/* 1. Introduction */}
        <SectionIntro city={city} businessName={businessName} page={page} />

        {/* 2. Pourquoi choisir Le Paradise 77 */}
        <SectionWhyChoose city={city} businessName={businessName} />

        {/* 3. Prestations */}
        <SectionPrestations city={city} businessName={businessName} />

        {/* 4. Comment réserver */}
        <SectionReservation city={city} businessName={businessName} />

        {/* 5. Capacité */}
        <SectionCapacite city={city} businessName={businessName} />

        {/* 6. Galerie */}
        <SectionGalerie
          gallery={gallery}
          instagramUsername={instagramUsername}
          instagramPosts={instagramPosts}
          tiktokUsername={tiktokUsername}
          tiktokPosts={tiktokPosts}
        />

        {/* 7. Lieux emblématiques */}
        <SectionLieux city={city} businessName={businessName} />

        {/* 8. Conseils mariage */}
        <SectionConseils city={city} />

        {/* 9. FAQ */}
        <SectionFAQ city={city} businessName={businessName} />

        {/* 10. Formulaire de devis — CTA */}
        <section id="devis" style={{ marginBottom: '56px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--dark), var(--navy))', borderRadius: '16px', padding: 'clamp(28px,5vw,48px)', textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem,4vw,2rem)', color: 'var(--gold)', marginBottom: '10px' }}>
              Réservez votre salle de mariage à {city.name}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px', fontSize: '15px' }}>
              {businessName} — salle de mariage et réception de prestige en Seine-et-Marne
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '28px', fontSize: '14px', maxWidth: '520px', margin: '0 auto 28px' }}>
              Devis gratuit, personnalisé et sans engagement. Notre équipe vous rappelle sous 24h depuis votre demande à {city.name}.
            </p>
            <Link to="/devis" className="btn btn-primary" style={{ fontSize: '15px', padding: '14px 36px' }}>
              📋 Demander mon devis gratuit
            </Link>
          </div>
        </section>

        {/* 11. Carte / Map */}
        <Section id="carte" title={`📍 ${businessName} — Accès depuis ${city.name}`}>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '16px' }}>
            5 avenue Fridingen, 77100 Nanteuil-lès-Meaux — à environ {getTravelInfo(city).driveMin} minutes depuis {city.name}
          </p>
          <CityMap city={city} apiKey={config?.googleMapsApiKey} />
        </Section>

        {/* 12. Maillage interne */}
        <NearbyLinks citySlug={citySlug} allTypePages={allTypePages} city={city} businessName={businessName} currentBasePath={basePath} />

        {/* Actualités locales */}
        <CityNews city={city} />

        {/* Micro-data footer */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)', fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
          Page mise à jour le {new Date(page.generatedAt).toLocaleDateString('fr-FR')} • {businessName} • {city.name}, {city.deptName}
        </div>
      </div>

      <WhatsAppButton />
    </div>
  )
}
