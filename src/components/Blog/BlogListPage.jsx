import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getPublishedArticles } from '../../utils/blogStorage'
import { BLOG_CLUSTERS } from '../../data/blogTopics'
import { getSettings } from '../../utils/storage'

const PAGE_SIZE = 12

function ArticleCard({ article }) {
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <Link
      to={`/blog/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, transform 0.2s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Theme stripe */}
        <div style={{ height: '4px', background: 'var(--gold)' }} />

        <div style={{ padding: '20px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Theme tag */}
          <div style={{
            display: 'inline-block',
            background: 'var(--gold-pale)',
            color: 'var(--gold)',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '3px 10px',
            borderRadius: '20px',
            marginBottom: '12px',
            alignSelf: 'flex-start',
          }}>
            {article.theme}
          </div>

          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'var(--dark)',
            lineHeight: 1.35,
            marginBottom: '10px',
            flex: 1,
          }}>
            {article.title}
          </h2>

          {article.excerpt && (
            <p style={{
              fontSize: '13px',
              color: 'var(--text-light)',
              lineHeight: 1.65,
              marginBottom: '14px',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {article.excerpt}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
            {date && (
              <span style={{ fontSize: '12px', color: '#aaa' }}>{date}</span>
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: 'var(--gold)',
              letterSpacing: '0.04em',
            }}>
              Lire →
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

export default function BlogListPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTheme, setActiveTheme] = useState('Tous')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const settings = getSettings()
  const businessName = settings?.nom?.trim() || 'Le Paradise 77'

  useEffect(() => {
    getPublishedArticles().then((list) => {
      setArticles(list)
      setLoading(false)
    })
  }, [])

  // Compute available themes from actual articles
  const themes = useMemo(() => {
    const used = new Set(articles.map((a) => a.theme))
    return ['Tous', ...BLOG_CLUSTERS.filter((c) => used.has(c))]
  }, [articles])

  const filtered = useMemo(() => {
    let list = articles
    if (activeTheme !== 'Tous') list = list.filter((a) => a.theme === activeTheme)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt || '').toLowerCase().includes(q) ||
        (a.keywords || []).some((k) => k.toLowerCase().includes(q))
      )
    }
    return list
  }, [articles, activeTheme, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageArticles = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleTheme(t) {
    setActiveTheme(t)
    setPage(1)
  }

  function handleSearch(e) {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--dark)',
        color: 'white',
        padding: '0 clamp(16px,5vw,80px)',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(28,28,46,0.3)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
          <div style={{ width: '2px', height: '36px', background: 'var(--gold)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: '22px', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{businessName}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Blog Mariage</div>
          </div>
        </Link>
        <Link to="/devis" className="btn btn-primary" style={{ fontSize: '13px' }}>Demander un devis</Link>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--dark) 0%, var(--navy) 100%)',
        color: 'white',
        padding: 'clamp(40px,6vw,70px) clamp(16px,5vw,80px)',
        textAlign: 'center',
      }}>
        <nav style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Accueil</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: 'var(--gold)' }}>Blog</span>
        </nav>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: '700', marginBottom: '12px', color: 'white' }}>
          Blog mariage — Conseils et inspirations
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)', maxWidth: '620px', margin: '0 auto 24px' }}>
          Tous les conseils pour préparer votre mariage : budget, organisation, décoration, traiteur et bien plus encore.
        </p>
        {/* Search */}
        <div style={{ maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            placeholder="Rechercher un article…"
            value={search}
            onChange={handleSearch}
            style={{
              width: '100%',
              padding: '14px 48px 14px 20px',
              borderRadius: '40px',
              border: 'none',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              outline: 'none',
              background: 'white',
              color: 'var(--text)',
            }}
          />
          <span style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#ccc', pointerEvents: 'none' }}>
            🔍
          </span>
        </div>
      </div>

      {/* ── Theme filter tabs ───────────────────────────────────────────────── */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        padding: '0 clamp(16px,5vw,80px)',
      }}>
        <div style={{ display: 'flex', gap: '2px', padding: '10px 0', minWidth: 'max-content' }}>
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => handleTheme(t)}
              style={{
                padding: '7px 16px',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
                background: activeTheme === t ? 'var(--gold)' : 'transparent',
                color: activeTheme === t ? 'white' : 'var(--text-light)',
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Article grid ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(16px,5vw,40px)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-light)' }}>
            <span style={{ fontSize: '28px' }}>⏳</span>
            <p style={{ marginTop: '12px' }}>Chargement des articles…</p>
          </div>
        ) : pageArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-light)' }}>
            <span style={{ fontSize: '36px' }}>✍️</span>
            <p style={{ marginTop: '12px', fontSize: '15px' }}>Aucun article trouvé.</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="btn btn-outline"
                style={{ marginTop: '16px' }}
              >
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '20px', color: 'var(--text-light)', fontSize: '13px' }}>
              {filtered.length} article{filtered.length > 1 ? 's' : ''}{activeTheme !== 'Tous' ? ` — ${activeTheme}` : ''}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '24px',
            }}>
              {pageArticles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '40px', flexWrap: 'wrap' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: p === page ? 'none' : '1px solid var(--border)',
                      background: p === page ? 'var(--gold)' : 'white',
                      color: p === page ? 'white' : 'var(--text)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--dark), var(--navy))',
        padding: 'clamp(40px,5vw,60px) clamp(16px,5vw,80px)',
        textAlign: 'center',
        color: 'white',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem,3vw,2rem)', color: 'var(--gold)', marginBottom: '10px' }}>
          Prêt(e) à concrétiser votre projet ?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
          Contactez {businessName} pour un devis gratuit et personnalisé. Notre équipe vous répond sous 24h.
        </p>
        <Link to="/devis" className="btn btn-primary" style={{ fontSize: '15px', padding: '14px 36px' }}>
          Demander mon devis gratuit
        </Link>
      </div>

      {/* ── Footer breadcrumb ───────────────────────────────────────────────── */}
      <div style={{ padding: '20px clamp(16px,5vw,80px)', textAlign: 'center', fontSize: '12px', color: '#bbb', borderTop: '1px solid var(--border)', background: 'white' }}>
        <Link to="/" style={{ color: '#bbb', textDecoration: 'none' }}>Accueil</Link>
        {' › '}
        <span>Blog mariage</span>
        {' · '}
        {businessName}
      </div>
    </div>
  )
}
