import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getBlogArticles } from '../../utils/blogStorage'
import { getSettings } from '../../utils/storage'

// ── Markdown renderer (same style as CityPage.jsx) ────────────────────────────

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
          borderBottom: '2px solid var(--gold)',
        }}>
          {line.slice(3)}
        </h2>
      )
    }
    // Bold + internal-link resolution
    const parts = line.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g)
    const rendered = parts.map((part, j) => {
      if (/^\*\*.*\*\*$/.test(part)) return <strong key={j}>{part.slice(2, -2)}</strong>
      const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/)
      if (linkMatch) {
        const href = linkMatch[2]
        const isInternal = href.startsWith('/')
        return isInternal
          ? <Link key={j} to={href} style={{ color: 'var(--gold)', textDecoration: 'underline' }}>{linkMatch[1]}</Link>
          : <a key={j} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>{linkMatch[1]}</a>
      }
      return part
    })
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

// ── Structured data helper ────────────────────────────────────────────────────

function BlogPostingJsonLd({ article, baseUrl, businessName }) {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: article.seoTitle || article.title,
        description: article.seoDescription || article.excerpt,
        author: {
          '@type': 'Organization',
          name: businessName,
        },
        publisher: {
          '@type': 'Organization',
          name: businessName,
          url: baseUrl,
        },
        datePublished: article.publishedAt || article.createdAt,
        dateModified: article.updatedAt || article.publishedAt,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${baseUrl}/blog/${article.slug}`,
        },
        keywords: (article.keywords || []).join(', '),
        about: {
          '@type': 'Thing',
          name: article.theme || 'Mariage',
        },
        inLanguage: 'fr-FR',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: baseUrl },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
          { '@type': 'ListItem', position: 3, name: article.theme, item: `${baseUrl}/blog?theme=${encodeURIComponent(article.theme)}` },
          { '@type': 'ListItem', position: 4, name: article.title, item: `${baseUrl}/blog/${article.slug}` },
        ],
      },
    ],
  }

  useEffect(() => {
    let tag = document.head.querySelector('#blog-json-ld')
    if (!tag) {
      tag = document.createElement('script')
      tag.id = 'blog-json-ld'
      tag.type = 'application/ld+json'
      document.head.appendChild(tag)
    }
    tag.textContent = JSON.stringify(ld)
    return () => {
      const el = document.head.querySelector('#blog-json-ld')
      if (el) el.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.slug])

  return null
}

// ── Related article card ──────────────────────────────────────────────────────

function RelatedCard({ article }) {
  return (
    <Link to={`/blog/${article.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '10px',
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>
          {article.theme}
        </div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark)', lineHeight: 1.4 }}>
          {article.title}
        </div>
      </div>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BlogArticlePage() {
  const { slug } = useParams()
  const [article, setArticle] = useState(null)
  const [relatedArticles, setRelatedArticles] = useState([])
  const [allArticles, setAllArticles] = useState({})
  const [loading, setLoading] = useState(true)
  const settings = getSettings()
  const businessName = settings?.nom?.trim() || 'Le Paradise 77'
  const baseUrl = (() => {
    const raw = settings?.siteUrl || ''
    const input = raw.trim()
    if (!input) return window.location.origin
    try {
      return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).origin
    } catch { return window.location.origin }
  })()

  useEffect(() => {
    getBlogArticles().then((arts) => {
      setAllArticles(arts)
      const found = arts[slug]
      if (found && found.status === 'published') {
        setArticle(found)
        // Build related articles
        const relSlugs = found.relatedSlugs || []
        const related = relSlugs
          .map((s) => arts[s])
          .filter((a) => a && a.status === 'published')
          .slice(0, 5)
        // If not enough, add same-theme articles
        if (related.length < 4) {
          Object.values(arts)
            .filter((a) => a.status === 'published' && a.slug !== slug && a.theme === found.theme && !relSlugs.includes(a.slug))
            .slice(0, 5 - related.length)
            .forEach((a) => related.push(a))
        }
        setRelatedArticles(related)
      }
      setLoading(false)
    })
  }, [slug])

  // SEO meta tags
  useEffect(() => {
    if (!article) return
    document.title = `${article.seoTitle || article.title} — ${businessName}`
    let desc = document.head.querySelector('meta[name="description"]')
    if (!desc) { desc = document.createElement('meta'); desc.setAttribute('name', 'description'); document.head.appendChild(desc) }
    desc.setAttribute('content', article.seoDescription || article.excerpt || '')
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical) }
    canonical.setAttribute('href', `${baseUrl}/blog/${article.slug}`)
    return () => { document.title = businessName }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.slug])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--text-light)' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '28px' }}>⏳</span>
          <p style={{ marginTop: '12px' }}>Chargement…</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', gap: '16px' }}>
        <span style={{ fontSize: '48px' }}>✍️</span>
        <h2 style={{ color: 'var(--dark)' }}>Article introuvable</h2>
        <Link to="/blog" className="btn btn-primary">← Retour au blog</Link>
      </div>
    )
  }

  const publishDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Structured data */}
      <BlogPostingJsonLd article={article} baseUrl={baseUrl} businessName={businessName} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--dark)', color: 'white',
        padding: '0 clamp(16px,5vw,80px)', height: '72px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '10px clamp(16px,5vw,80px)' }}>
        <nav style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: 'var(--text-light)', textDecoration: 'none' }}>Accueil</Link>
          <span>›</span>
          <Link to="/blog" style={{ color: 'var(--text-light)', textDecoration: 'none' }}>Blog</Link>
          <span>›</span>
          <Link to={`/blog?theme=${encodeURIComponent(article.theme)}`} style={{ color: 'var(--text-light)', textDecoration: 'none' }}>{article.theme}</Link>
          <span>›</span>
          <span style={{ color: 'var(--dark)' }}>{article.title}</span>
        </nav>
      </div>

      {/* ── Content layout ───────────────────────────────────────────────── */}
      <div style={{
        maxWidth: '1160px', margin: '0 auto',
        padding: 'clamp(28px,4vw,48px) clamp(16px,5vw,40px)',
        display: 'grid',
        gridTemplateColumns: relatedArticles.length > 0 ? 'minmax(0,1fr) 280px' : '1fr',
        gap: '40px',
        alignItems: 'start',
      }}>

        {/* ── Main article ──────────────────────────────────────────────── */}
        <article>
          {/* Theme tag */}
          <div style={{
            display: 'inline-block',
            background: 'var(--gold-pale)', color: 'var(--gold)',
            fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '4px 12px',
            borderRadius: '20px', marginBottom: '16px',
          }}>
            {article.theme}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.8rem,4vw,2.4rem)',
            fontWeight: '700', color: 'var(--dark)', lineHeight: 1.25,
            marginBottom: '16px',
          }}>
            {article.title}
          </h1>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', fontSize: '13px', color: 'var(--text-light)', borderBottom: '1px solid var(--border)', paddingBottom: '20px', flexWrap: 'wrap' }}>
            {publishDate && (
              <span>📅 Publié le {publishDate}</span>
            )}
            <span>✍️ {article.seoTitle?.split('—')?.[1]?.trim() || businessName}</span>
            <span>📂 {article.theme}</span>
          </div>

          {/* Excerpt */}
          {article.excerpt && (
            <div style={{
              background: 'var(--gold-pale)', borderLeft: '4px solid var(--gold)',
              borderRadius: '0 8px 8px 0', padding: '16px 20px',
              marginBottom: '28px', fontSize: '15px', lineHeight: 1.7,
              color: 'var(--text)', fontStyle: 'italic',
            }}>
              {article.excerpt}
            </div>
          )}

          {/* Content */}
          <div style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--text)' }}>
            {renderContent(article.content)}
          </div>

          {/* Keywords */}
          {article.keywords?.length > 0 && (
            <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>Mots-clés :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {article.keywords.map((k, i) => (
                  <span key={i} style={{
                    background: 'var(--offwhite)', color: 'var(--text-light)',
                    fontSize: '11px', padding: '3px 10px',
                    borderRadius: '20px', border: '1px solid var(--border)',
                  }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Internal links / maillage */}
          {article.internalLinks?.length > 0 && (
            <div style={{
              marginTop: '32px', background: 'white',
              border: '1px solid var(--border)', borderRadius: '12px',
              padding: '20px 24px',
            }}>
              <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--dark)', marginBottom: '12px' }}>
                📚 Pages utiles
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {article.internalLinks.map((lk, i) => (
                  <Link
                    key={i}
                    to={lk.href}
                    style={{
                      fontSize: '13px', color: 'var(--gold)',
                      textDecoration: 'none', display: 'flex',
                      alignItems: 'center', gap: '6px',
                    }}
                  >
                    <span>→</span> {lk.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{
            marginTop: '40px',
            background: 'linear-gradient(135deg, var(--dark), var(--navy))',
            borderRadius: '14px', padding: '28px 28px',
            textAlign: 'center', color: 'white',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: 'var(--gold)', marginBottom: '8px' }}>
              Prêt(e) à organiser votre mariage ?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px', fontSize: '14px' }}>
              {businessName} — salle de mariage de prestige en Seine-et-Marne. Devis gratuit sous 24h.
            </p>
            <Link to="/devis" className="btn btn-primary" style={{ fontSize: '14px' }}>
              Demander mon devis gratuit
            </Link>
          </div>

          {/* Prev / Next navigation (within same theme) */}
          {(() => {
            const sameTheme = Object.values(allArticles)
              .filter((a) => a.status === 'published' && a.theme === article.theme)
              .sort((a, b) => new Date(a.publishedAt || a.createdAt) - new Date(b.publishedAt || b.createdAt))
            const idx = sameTheme.findIndex((a) => a.slug === slug)
            const prev = idx > 0 ? sameTheme[idx - 1] : null
            const next = idx < sameTheme.length - 1 ? sameTheme[idx + 1] : null
            if (!prev && !next) return null
            return (
              <div style={{
                marginTop: '32px', display: 'flex',
                justifyContent: 'space-between', gap: '16px',
                flexWrap: 'wrap',
              }}>
                {prev ? (
                  <Link to={`/blog/${prev.slug}`} style={{ flex: 1, minWidth: '180px', textDecoration: 'none', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px' }}>
                    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>← Article précédent</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark)' }}>{prev.title}</div>
                  </Link>
                ) : <div style={{ flex: 1 }} />}
                {next && (
                  <Link to={`/blog/${next.slug}`} style={{ flex: 1, minWidth: '180px', textDecoration: 'none', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Article suivant →</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark)' }}>{next.title}</div>
                  </Link>
                )}
              </div>
            )
          })()}
        </article>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        {relatedArticles.length > 0 && (
          <aside>
            <div style={{
              background: 'white', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '20px',
              position: 'sticky', top: '24px',
            }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--dark)', marginBottom: '14px' }}>
                Articles similaires
              </h3>
              {relatedArticles.map((a) => (
                <RelatedCard key={a.slug} article={a} />
              ))}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <Link
                  to="/blog"
                  style={{ fontSize: '13px', color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}
                >
                  ← Tous les articles
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px clamp(16px,5vw,80px)', textAlign: 'center', fontSize: '12px', color: '#bbb', borderTop: '1px solid var(--border)', background: 'white', marginTop: '20px' }}>
        <Link to="/" style={{ color: '#bbb', textDecoration: 'none' }}>Accueil</Link>
        {' › '}
        <Link to="/blog" style={{ color: '#bbb', textDecoration: 'none' }}>Blog</Link>
        {' › '}
        <span>{article.theme}</span>
        {' · '}
        {businessName}
      </div>
    </div>
  )
}
