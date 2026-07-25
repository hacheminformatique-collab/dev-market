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
    </div>
  )
}
