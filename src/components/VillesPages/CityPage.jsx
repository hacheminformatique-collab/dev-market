import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCityPages, getCityGallery, getCityPagesConfig } from '../../utils/cityPageStorage'
import { getCityBySlug, getNearbyCities } from '../../data/idf-cities'

// ── Section wrapper ────────────────────────────────────────────────────────

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

// ── Google Map embed ───────────────────────────────────────────────────────

function CityMap({ city, apiKey }) {
  if (!city) return null

  // With an API key use the Embed Maps API; without it use a simple iframe query
  const src = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city.name + ', France')}&zoom=14`
    : `https://www.google.com/maps?q=${encodeURIComponent(city.name + ', France')}&output=embed`

  return (
    <div style={{
      borderRadius: '12px', overflow: 'hidden',
      border: '2px solid var(--gold)',
      boxShadow: 'var(--shadow-md)',
    }}>
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

// ── Photo gallery ──────────────────────────────────────────────────────────

function Gallery({ photos }) {
  const [lightbox, setLightbox] = useState(null)

  if (!photos || photos.length === 0) return null

  return (
    <Section title="📸 Notre galerie">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        {photos.map((src, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            style={{
              border: '2px solid transparent', borderRadius: '8px', overflow: 'hidden',
              cursor: 'zoom-in', padding: 0, background: 'none',
              transition: 'border-color 0.15s, transform 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <img
              src={src}
              alt={`Galerie photo ${i + 1}`}
              style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l > 0 ? l - 1 : photos.length - 1)) }}
            style={{ position: 'fixed', left: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px' }}
          >‹</button>
          <img
            src={photos[lightbox]}
            alt={`Galerie photo ${lightbox + 1}`}
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '8px', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l < photos.length - 1 ? l + 1 : 0)) }}
            style={{ position: 'fixed', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px' }}
          >›</button>
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px' }}
          >✕</button>
        </div>
      )}
    </Section>
  )
}

// ── Instagram post embed ───────────────────────────────────────────────────

function InstagramEmbed({ url }) {
  if (!url) return null
  // Convert post URL to embed URL
  const embedUrl = url.replace(/\/$/, '') + '/embed'
  return (
    <iframe
      src={embedUrl}
      title="Instagram post"
      style={{ border: 'none', borderRadius: '12px', width: '328px', minHeight: '440px', maxWidth: '100%' }}
      scrolling="no"
      allowTransparency
      allow="encrypted-media"
    />
  )
}

// ── TikTok post embed ──────────────────────────────────────────────────────

function TikTokEmbed({ url }) {
  if (!url) return null
  // Extract video ID from URL like https://www.tiktok.com/@user/video/1234567
  const match = url.match(/\/video\/(\d+)/)
  if (!match) return null
  const videoId = match[1]
  return (
    <iframe
      src={`https://www.tiktok.com/embed/${videoId}`}
      title="TikTok video"
      style={{ border: 'none', borderRadius: '12px', width: '325px', height: '575px', maxWidth: '100%' }}
      allowFullScreen
      allow="encrypted-media"
    />
  )
}

// ── City news RSS feed ─────────────────────────────────────────────────────

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

// Strip "– Source Name" or "- Source Name" appended by Google News to titles
function cleanGoogleNewsTitle(raw) {
  return raw.replace(/\s*[-–]\s+[^-–]{2,60}$/, '').trim()
}

function parseRssXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return []

  const rawItems = Array.from(doc.getElementsByTagName('item')).slice(0, 5)
  if (rawItems.length === 0) return []

  return rawItems.map((el) => {
    // <link> in RSS XML sits between its sibling nodes, not as a child —
    // use nextSibling traversal when textContent is empty
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

  // ── Strategy 1: rss2json.com – purpose-built RSS→JSON API with CORS support
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
          desc:    (it.description || it.content || '')
            .replace(/<[^>]*>/g, '')
            .slice(0, 180),
        })).filter((it) => it.title)
        if (items.length > 0) return items
      }
    }
  } catch {
    // fall through to next strategy
  }

  // ── Strategy 2: allorigins JSON endpoint (returns { contents: "<xml>" }) ──
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
  } catch {
    // fall through
  }

  // ── Strategy 3: generic CORS proxies returning raw XML ────────────────────
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
    } catch {
      // Try next proxy
    }
  }
  return []
}

function getLocalFallbackItems(city) {
  const { name, deptName, deptCode } = city
  const q = encodeURIComponent(name)
  const qDept = encodeURIComponent(deptName)
  return [
    {
      title: `Actualités de ${name} sur Google Actualités`,
      link: `https://news.google.com/search?q=${q}&hl=fr&gl=FR&ceid=FR:fr`,
      desc: `Retrouvez les dernières actualités et informations sur ${name} et ses environs directement sur Google Actualités.`,
      source: 'Google Actualités',
      pubDate: '',
    },
    {
      title: `${name} — Informations pratiques`,
      link: `https://fr.wikipedia.org/wiki/${q}`,
      desc: `Découvrez ${name}, commune du département ${deptName} (${deptCode}).`,
      source: 'Wikipédia',
      pubDate: '',
    },
    {
      title: `Actualités du département ${deptName}`,
      link: `https://news.google.com/search?q=${qDept}&hl=fr&gl=FR&ceid=FR:fr`,
      desc: `Suivez toutes les actualités et événements du département ${deptName} (${deptCode}).`,
      source: 'Google Actualités',
      pubDate: '',
    },
  ]
}

function CityNews({ city }) {
  const cityName = city.name
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRssItems(cityName)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [cityName])

  const newsItemStyle = {
    display: 'block', padding: '16px 18px',
    background: 'white', border: '1px solid var(--border)',
    borderRadius: '10px', textDecoration: 'none',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    boxShadow: 'var(--shadow-sm)',
  }

  return (
    <Section title={`📰 Quoi de neuf à ${cityName} ?`}>
      <p style={{ color: 'var(--text-light)', fontSize: '14px', marginBottom: '20px' }}>
        Les dernières actualités de {cityName} et de ses environs.
      </p>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{
              height: '72px', borderRadius: '10px',
              background: 'linear-gradient(90deg, #f0ece4 25%, #faf8f4 50%, #f0ece4 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s infinite',
              border: '1px solid var(--border)',
            }} />
          ))}
          <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item, i) => {
            const pubDate = item.pubDate
              ? new Date(item.pubDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
              : ''
            return (
              <a
                key={i}
                href={item.link || '#'}
                target="_blank"
                rel="noreferrer noopener"
                style={newsItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--gold)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--dark)', marginBottom: '6px', lineHeight: 1.4 }}>
                  {item.title}
                </div>
                {item.desc && (
                  <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '6px', lineHeight: 1.5 }}>
                    {item.desc}{item.desc.length === 180 ? '…' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#aaa' }}>
                  {item.source && <span style={{ fontWeight: '600' }}>{item.source}</span>}
                  {pubDate && <span>• {pubDate}</span>}
                </div>
              </a>
            )
          })}
        </div>
      )}

      {!loading && items.length === 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {getLocalFallbackItems(city).map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                style={newsItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--gold)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--dark)', marginBottom: '6px', lineHeight: 1.4 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '6px', lineHeight: 1.5 }}>
                  {item.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#aaa' }}>
                  <span style={{ fontWeight: '600' }}>{item.source}</span>
                </div>
              </a>
            ))}
          </div>
          <p style={{ color: '#ccc', fontSize: '12px', fontStyle: 'italic', marginTop: '12px' }}>
            Liens informatifs — flux actualités indisponible pour le moment.
          </p>
        </>
      )}
    </Section>
  )
}

// ── WhatsApp floating button ───────────────────────────────────────────────

function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/33782821582"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Contactez-nous sur WhatsApp"
      style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
        width: '60px', height: '60px', borderRadius: '50%',
        background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(37,211,102,0.45)',
        transition: 'transform 0.18s, box-shadow 0.18s',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,211,102,0.6)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,211,102,0.45)' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="32" height="32" fill="white">
        <path d="M24 4C12.95 4 4 12.95 4 24c0 3.55.93 6.87 2.56 9.75L4 44l10.5-2.75A19.87 19.87 0 0 0 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4zm0 36.5c-3.16 0-6.13-.87-8.67-2.38l-.62-.37-6.23 1.63 1.66-6.06-.41-.64A16.43 16.43 0 0 1 7.5 24C7.5 14.84 14.84 7.5 24 7.5S40.5 14.84 40.5 24 33.16 40.5 24 40.5zm9.08-12.3c-.49-.25-2.92-1.44-3.37-1.6-.45-.17-.78-.25-1.1.25-.33.49-1.27 1.6-1.56 1.93-.29.33-.57.37-1.06.12-.49-.25-2.07-.76-3.94-2.43-1.46-1.3-2.44-2.9-2.73-3.39-.29-.49-.03-.76.22-1 .22-.22.49-.57.74-.86.25-.29.33-.49.49-.82.17-.33.08-.62-.04-.86-.12-.25-1.1-2.65-1.51-3.63-.4-.95-.8-.82-1.1-.84-.29-.02-.62-.02-.95-.02-.33 0-.86.12-1.31.62-.45.49-1.72 1.68-1.72 4.1 0 2.42 1.76 4.76 2.01 5.09.25.33 3.47 5.3 8.41 7.43 1.17.51 2.09.81 2.8 1.04 1.18.38 2.25.32 3.1.2.94-.14 2.92-1.19 3.33-2.34.41-1.15.41-2.14.29-2.34-.12-.2-.45-.33-.94-.57z"/>
      </svg>
    </a>
  )
}

// ── Nearby city backlinks ──────────────────────────────────────────────────

function NearbyLinks({ citySlug, pages }) {
  const nearby = getNearbyCities(citySlug, 5)
  if (nearby.length === 0) return null

  return (
    <Section title="🗺️ Villes à proximité">
      <p style={{ color: 'var(--text-light)', fontSize: '14px', marginBottom: '16px' }}>
        Nous intervenons également dans les communes situées à moins de 5 km :
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {nearby.map((city) => {
          const hasPage = pages && pages[city.slug]
          if (!hasPage) return null
          return (
            <Link
              key={city.slug}
              to={`/villes/${city.slug}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px',
                background: 'var(--gold-pale)',
                border: '1px solid var(--gold)',
                borderRadius: '20px',
                fontSize: '13px', fontWeight: '600', color: 'var(--dark)',
                textDecoration: 'none',
                transition: 'background 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gold-pale)'; e.currentTarget.style.color = 'var(--dark)' }}
            >
              📍 {city.name}
            </Link>
          )
        })}
      </div>
    </Section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CityPage() {
  const { citySlug } = useParams()
  const [page, setPage]     = useState(null)
  const [gallery, setGallery] = useState([])
  const [config, setConfig]   = useState(null)
  const [allPages, setAllPages] = useState({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getCityPages(),
      getCityGallery(),
      getCityPagesConfig(),
    ]).then(([pages, gal, cfg]) => {
      setAllPages(pages || {})
      setPage(pages?.[citySlug] || null)
      setGallery(gal || [])
      setConfig(cfg)
      setLoading(false)
    })
  }, [citySlug])

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
        <div style={{ fontSize: '48px' }}>🏙️</div>
        <h2 style={{ color: 'var(--dark)' }}>Page introuvable</h2>
        <p style={{ color: '#888' }}>Cette page n&apos;a pas encore été générée.</p>
        <Link to="/" className="btn btn-primary">Retour à l&apos;accueil</Link>
      </div>
    )
  }

  const businessName = config?.businessName || 'Le Paradise'
  const instagramUsername = config?.instagramUsername || ''
  const tiktokUsername = config?.tiktokUsername || ''
  const instagramPosts = config?.instagramPosts || []
  const tiktokPosts = config?.tiktokPosts || []

  // Convert markdown headings and bold to proper elements
  function renderContent(text) {
    if (!text) return null
    return text.split('\n').map((line, i) => {
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
      // Bold replacement
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--dark)', color: 'white', padding: '0 clamp(16px,5vw,80px)',
        height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(28,28,46,0.3)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
          <div style={{ width: '2px', height: '36px', background: 'var(--gold)' }} />
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: '22px',
              color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {businessName}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {city.deptName}
            </div>
          </div>
        </Link>
        <Link to="/devis" className="btn btn-primary" style={{ fontSize: '13px' }}>
          Demander un devis
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--dark) 0%, var(--navy) 100%)',
        color: 'white',
        padding: 'clamp(40px,8vw,80px) clamp(16px,5vw,80px)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', background: 'var(--gold)', color: 'white',
          padding: '4px 16px', borderRadius: '20px', fontSize: '12px',
          fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          {city.deptCode} — {city.deptName}
        </div>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: '700', color: 'white', marginBottom: '12px', letterSpacing: '0.03em',
        }}>
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,5vw,40px)' }}>

        {/* Main SEO content */}
        <Section title={`${businessName} à ${city.name}`}>
          <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.8 }}>
            {renderContent(page.content)}
          </div>
        </Section>

        {/* Extra SEO keyword sections */}
        <Section>
          <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.8 }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: '700',
              color: 'var(--dark)', marginBottom: '16px', paddingBottom: '10px',
              borderBottom: '2px solid var(--gold)',
            }}>
              Salle de mariage et réception — {businessName} près de {city.name}
            </h2>
            <p>
              Vous planifiez un <strong>mariage</strong> ou une <strong>réception</strong> à {city.name} ou dans les environs ?{' '}
              <strong>Le Paradise 77</strong> est votre <strong>salle de mariage</strong> de prestige en Seine-et-Marne.
              Notre <strong>salle de mariage</strong> accueille vos événements les plus précieux dans un cadre élégant et raffiné.
              Le Paradise 77 est la <strong>salle de réception</strong> idéale pour un <strong>mariage</strong> inoubliable depuis {city.name}.
            </p>
            <p>
              Depuis {city.name}, rejoindre la <strong>salle de mariage</strong> du <strong>Paradise 77</strong> ne prend que quelques minutes.
              Notre <strong>salle de réception</strong> est facilement accessible depuis {city.name} et toute la {city.deptName}.
              Le <strong>Paradise 77</strong> est la <strong>salle de mariage</strong> et <strong>réception</strong> préférée des couples de {city.name}.
              Chaque <strong>mariage</strong> célébré dans notre <strong>salle de réception</strong> est unique et mémorable.
            </p>
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '600',
              color: 'var(--dark)', margin: '28px 0 12px',
            }}>
              Pourquoi choisir le Paradise 77 pour votre mariage à {city.name} ?
            </h3>
            <p>
              Le <strong>Paradise 77</strong> propose des formules de <strong>mariage</strong> et de <strong>réception</strong> adaptées à tous les budgets.
              Notre <strong>salle de mariage</strong> peut accueillir des cérémonies intimes comme de grandes <strong>réceptions</strong>.
              Le <strong>Paradise 77</strong> est la <strong>salle de réception</strong> qui s&apos;adapte à tous vos besoins de <strong>mariage</strong>.
              Notre <strong>salle de mariage</strong> est régulièrement plébiscitée par les couples venant de {city.name} et des environs.
            </p>
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '600',
              color: 'var(--dark)', margin: '28px 0 12px',
            }}>
              Réserver le Paradise 77 pour votre mariage et réception depuis {city.name}
            </h3>
            <p>
              Réserver la <strong>salle de mariage</strong> du <strong>Paradise 77</strong> depuis {city.name} est simple et rapide.
              Notre <strong>salle de réception</strong> est disponible pour les <strong>mariages</strong> et <strong>réceptions</strong> toute l&apos;année.
              Le <strong>Paradise 77</strong> vous accompagne dans l&apos;organisation de votre <strong>mariage</strong> de A à Z.
              Notre <strong>salle de mariage</strong> garantit un événement inoubliable pour votre <strong>mariage</strong> et votre <strong>réception</strong>.
              Contactez le <strong>Paradise 77</strong> dès aujourd&apos;hui pour un devis de <strong>mariage</strong> personnalisé depuis {city.name}.
            </p>
          </div>
        </Section>

        {/* Gallery */}
        <Gallery photos={gallery} />

        {/* Google Map */}
        <Section id="carte" title="📍 Nous trouver">
          <CityMap city={city} apiKey={config?.googleMapsApiKey} />
        </Section>

        {/* Nearby city backlinks */}
        <NearbyLinks citySlug={citySlug} pages={allPages} />

        {/* Instagram */}
        {(instagramUsername || instagramPosts.length > 0) && (
          <Section title="📸 Suivez-nous sur Instagram">
            {instagramUsername && (
              <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-light)' }}>
                Retrouvez nos dernières réalisations sur{' '}
                <a
                  href={`https://www.instagram.com/${instagramUsername}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ color: 'var(--gold)', fontWeight: '600' }}
                >
                  @{instagramUsername}
                </a>
              </p>
            )}
            {instagramPosts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {instagramPosts.filter(Boolean).map((url, i) => (
                  <InstagramEmbed key={i} url={url} />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* TikTok */}
        {(tiktokUsername || tiktokPosts.length > 0) && (
          <Section title="🎵 Suivez-nous sur TikTok">
            {tiktokUsername && (
              <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-light)' }}>
                Retrouvez nos dernières vidéos sur{' '}
                <a
                  href={`https://www.tiktok.com/@${tiktokUsername}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ color: 'var(--gold)', fontWeight: '600' }}
                >
                  @{tiktokUsername}
                </a>
              </p>
            )}
            {tiktokPosts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {tiktokPosts.filter(Boolean).map((url, i) => (
                  <TikTokEmbed key={i} url={url} />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* City news RSS feed */}
        <CityNews city={city} />

        {/* CTA */}
        <div style={{
          background: 'linear-gradient(135deg, var(--dark), var(--navy))',
          borderRadius: '16px', padding: '40px', textAlign: 'center', color: 'white',
          marginTop: '40px',
        }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--gold)', marginBottom: '8px' }}>
            Votre salle de mariage et réception à {city.name}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px', fontSize: '15px' }}>
            Le Paradise 77 — salle de mariage et réception de prestige en Seine-et-Marne
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px', fontSize: '14px' }}>
            Réservez votre mariage et votre réception au Paradise 77 depuis {city.name}. Devis gratuit et personnalisé.
          </p>
          <Link to="/devis" className="btn btn-primary" style={{ fontSize: '15px', padding: '14px 36px' }}>
            📋 Réserver votre salle de mariage — Devis gratuit
          </Link>
        </div>

        {/* Page generation info (SEO micro-data) */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)', fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
          Page mise à jour le {new Date(page.generatedAt).toLocaleDateString('fr-FR')} • {businessName} • {city.name}, {city.deptName}
        </div>
      </div>

      {/* Floating WhatsApp button */}
      <WhatsAppButton />
    </div>
  )
}
