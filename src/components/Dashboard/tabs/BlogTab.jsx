import { useState, useEffect, useRef } from 'react'
import {
  getBlogConfig, saveBlogConfig,
  getBlogArticles, saveBlogArticles, backupBlogArticles, getBlogBackups,
  getBlogAutoLog, appendBlogAutoLog,
  generateBlogArticle, extractExcerpt, buildInternalLinks, buildRelatedSlugs,
  makeUniqueSlug, slugify,
  maybeAutoPublish,
} from '../../../utils/blogStorage'
import { BLOG_TOPICS, BLOG_CLUSTERS } from '../../../data/blogTopics'

// ── Small UI helpers ──────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
  borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-body)',
  background: 'white', color: 'var(--text)', outline: 'none',
}

const SUB_TABS = [
  { id: 'articles', label: '📰 Articles' },
  { id: 'editor',   label: '✍️ Nouvel article' },
  { id: 'batch',    label: '🤖 Génération IA' },
  { id: 'config',   label: '⚙️ Configuration' },
  { id: 'autolog',  label: '📊 Journal auto-pub' },
]

function Badge({ children, color = 'var(--gold)' }) {
  return (
    <span style={{
      display: 'inline-block', background: color, color: 'white',
      fontSize: '10px', fontWeight: '700', padding: '2px 8px',
      borderRadius: '20px', letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BlogTab() {
  const [subTab, setSubTab]             = useState('articles')
  const [config, setConfig]             = useState(null)
  const [articles, setArticles]         = useState({})
  const [_backups, setBackups]          = useState([])
  const [autoLog, setAutoLog]           = useState([])
  const [saving, setSaving]             = useState(false)
  // Batch generation state
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: '' })
  const [batchDone, setBatchDone]       = useState(false)
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [filterTheme, setFilterTheme]   = useState('Tous')
  const [topicSearch, setTopicSearch]   = useState('')
  // Article search/filter
  const [artSearch, setArtSearch]       = useState('')
  const [artTheme, setArtTheme]         = useState('Tous')
  const [artStatus, setArtStatus]       = useState('all')
  // Editor state
  const [editSlug, setEditSlug]         = useState(null)   // null = new, string = existing
  const [editorData, setEditorData]     = useState(null)
  const [genLoading, setGenLoading]     = useState(false)
  const abortRef = useRef(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getBlogConfig(),
      getBlogArticles(),
      getBlogBackups(),
      getBlogAutoLog(),
    ]).then(([cfg, arts, bkps, log]) => {
      setConfig(cfg)
      setArticles(arts || {})
      setBackups(bkps || [])
      setAutoLog(log || [])
    })
    // Check if auto-publish is due
    maybeAutoPublish(BLOG_TOPICS).then((result) => {
      if (result.ran) {
        getBlogArticles().then(setArticles)
        getBlogAutoLog().then(setAutoLog)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!config) {
    return <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>Chargement…</div>
  }

  // ── Config helpers ─────────────────────────────────────────────────────────

  function updateConfig(patch) { setConfig((c) => ({ ...c, ...patch })) }

  async function handleSaveConfig() {
    setSaving(true)
    await saveBlogConfig(config)
    setSaving(false)
  }

  // ── Article CRUD ───────────────────────────────────────────────────────────

  function openNewEditor() {
    setEditSlug(null)
    setEditorData({
      title: '',
      excerpt: '',
      content: '',
      theme: BLOG_CLUSTERS[0],
      keywords: '',
      status: 'draft',
      seoTitle: '',
      seoDescription: '',
    })
    setSubTab('editor')
  }

  function openEditEditor(slug) {
    const art = articles[slug]
    if (!art) return
    setEditSlug(slug)
    setEditorData({
      title: art.title,
      excerpt: art.excerpt || '',
      content: art.content || '',
      theme: art.theme,
      keywords: (art.keywords || []).join(', '),
      status: art.status,
      seoTitle: art.seoTitle || '',
      seoDescription: art.seoDescription || '',
    })
    setSubTab('editor')
  }

  async function handleSaveArticle(publish = false) {
    if (!editorData?.title?.trim()) return
    setSaving(true)
    try {
      const existing = await getBlogArticles()
      const now = new Date().toISOString()
      const slug = editSlug || makeUniqueSlug(editorData.title, Object.keys(existing))
      const base = existing[slug] || {}
      const keywords = (editorData.keywords || '').split(',').map((k) => k.trim()).filter(Boolean)
      const status = publish ? 'published' : (editorData.status || 'draft')
      const article = {
        ...base,
        slug,
        title: editorData.title.trim(),
        excerpt: editorData.excerpt || extractExcerpt(editorData.content),
        content: editorData.content,
        theme: editorData.theme,
        keywords,
        status,
        createdAt: base.createdAt || now,
        publishedAt: status === 'published' ? (base.publishedAt || now) : base.publishedAt || null,
        updatedAt: now,
        seoTitle: editorData.seoTitle || `${editorData.title} — ${config.businessName}`,
        seoDescription: editorData.seoDescription || extractExcerpt(editorData.content, 155),
        relatedSlugs: base.relatedSlugs || [],
        internalLinks: base.internalLinks || buildInternalLinks({ title: editorData.title, theme: editorData.theme, keywords }, existing),
      }
      const updated = { ...existing, [slug]: article }
      await saveBlogArticles(updated)
      setArticles(updated)
      setEditSlug(slug)
      setEditorData((d) => ({ ...d, status }))
    } finally { setSaving(false) }
  }

  async function handleGenArticleForEditor() {
    if (!editorData?.title?.trim()) return
    setGenLoading(true)
    try {
      const topic = {
        title: editorData.title,
        theme: editorData.theme,
        keywords: (editorData.keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      }
      const content = await generateBlogArticle(topic, config)
      const excerpt = extractExcerpt(content)
      setEditorData((d) => ({
        ...d,
        content,
        excerpt,
        seoTitle: d.seoTitle || `${d.title} — ${config.businessName}`,
        seoDescription: d.seoDescription || excerpt.slice(0, 155),
      }))
    } finally { setGenLoading(false) }
  }

  async function handleToggleStatus(slug) {
    const art = articles[slug]
    if (!art) return
    const now = new Date().toISOString()
    const newStatus = art.status === 'published' ? 'draft' : 'published'
    const updated = {
      ...articles,
      [slug]: {
        ...art,
        status: newStatus,
        publishedAt: newStatus === 'published' ? (art.publishedAt || now) : art.publishedAt,
        updatedAt: now,
      },
    }
    await saveBlogArticles(updated)
    setArticles(updated)
  }

  async function handleDeleteArticle(slug) {
    if (!window.confirm(`Supprimer l'article "${articles[slug]?.title}" ?`)) return
    const updated = { ...articles }
    delete updated[slug]
    await saveBlogArticles(updated)
    setArticles(updated)
  }

  // ── Batch generation ───────────────────────────────────────────────────────

  const usedSlugs = new Set(Object.keys(articles))
  const pendingTopics = BLOG_TOPICS.filter((t) => !usedSlugs.has(slugify(t.title)))
  const filteredTopics = pendingTopics.filter((t) => {
    if (filterTheme !== 'Tous' && t.theme !== filterTheme) return false
    if (topicSearch.trim()) {
      const q = topicSearch.trim().toLowerCase()
      return t.title.toLowerCase().includes(q) || t.theme.toLowerCase().includes(q)
    }
    return true
  })

  function toggleTopic(slug) {
    setSelectedTopics((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug); else next.add(slug)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedTopics((prev) => {
      const next = new Set(prev)
      filteredTopics.forEach((t) => next.add(slugify(t.title)))
      return next
    })
  }

  function deselectAll() { setSelectedTopics(new Set()) }

  async function handleBatchGenerate() {
    const slugsToGen = [...selectedTopics]
    if (slugsToGen.length === 0) return
    setBatchRunning(true)
    setBatchDone(false)
    setBatchProgress({ done: 0, total: slugsToGen.length, current: '' })
    abortRef.current = false

    await backupBlogArticles()
    let current = await getBlogArticles()
    let done = 0

    for (const topicSlug of slugsToGen) {
      if (abortRef.current) break
      const topic = BLOG_TOPICS.find((t) => slugify(t.title) === topicSlug)
      if (!topic) continue
      setBatchProgress({ done, total: slugsToGen.length, current: topic.title })
      try {
        const slug = makeUniqueSlug(topic.title, Object.keys(current))
        const content = await generateBlogArticle(topic, config)
        const now = new Date().toISOString()
        current[slug] = {
          slug,
          title: topic.title,
          excerpt: extractExcerpt(content),
          content,
          theme: topic.theme,
          keywords: topic.keywords || [],
          status: 'draft',
          createdAt: now,
          publishedAt: null,
          updatedAt: now,
          seoTitle: `${topic.title} — ${config.businessName}`,
          seoDescription: extractExcerpt(content, 155),
          relatedSlugs: buildRelatedSlugs(topic, current, topic.relatedThemes),
          internalLinks: buildInternalLinks(topic, current),
        }
        done++
        setBatchProgress({ done, total: slugsToGen.length, current: topic.title })
      } catch { done++ }
    }

    await saveBlogArticles(current)
    setArticles(current)
    setSelectedTopics(new Set())
    setBatchRunning(false)
    setBatchDone(true)
    setBatchProgress((p) => ({ ...p, done: slugsToGen.length }))

    // Update lastAutoPublish if not set
    if (!config.lastAutoPublish) {
      const newCfg = { ...config, lastAutoPublish: new Date().toISOString() }
      await saveBlogConfig(newCfg)
      setConfig(newCfg)
    }
    await appendBlogAutoLog({
      at: new Date().toISOString(),
      count: done,
      status: 'batch-complete',
      source: 'manual-batch',
    })
    const log = await getBlogAutoLog()
    setAutoLog(log)
  }

  // ── Filtered article list ─────────────────────────────────────────────────

  const articleList = Object.values(articles)
    .filter((a) => {
      if (artTheme !== 'Tous' && a.theme !== artTheme) return false
      if (artStatus !== 'all' && a.status !== artStatus) return false
      if (artSearch.trim()) {
        const q = artSearch.trim().toLowerCase()
        return a.title.toLowerCase().includes(q) || (a.excerpt || '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))

  const publishedCount = Object.values(articles).filter((a) => a.status === 'published').length
  const draftCount = Object.values(articles).filter((a) => a.status === 'draft').length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600',
              fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
              transition: 'all 0.15s',
              background: subTab === t.id ? 'var(--gold)' : 'var(--gold-pale)',
              color: subTab === t.id ? 'white' : 'var(--dark)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ARTICLES ────────────────────────────────────────────────────────── */}
      {subTab === 'articles' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total articles', value: Object.keys(articles).length, color: 'var(--dark)' },
              { label: 'Publiés', value: publishedCount, color: 'var(--success)' },
              { label: 'Brouillons', value: draftCount, color: '#e67e22' },
              { label: 'Topics restants', value: pendingTopics.length, color: 'var(--gold)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 20px', minWidth: '130px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={openNewEditor} style={{ padding: '8px 16px' }}>
              + Nouvel article
            </button>
            <input
              style={{ ...inputStyle, maxWidth: '240px', padding: '7px 12px' }}
              placeholder="Rechercher…"
              value={artSearch}
              onChange={(e) => setArtSearch(e.target.value)}
            />
            <select
              style={{ ...inputStyle, maxWidth: '200px', padding: '7px 12px' }}
              value={artTheme}
              onChange={(e) => setArtTheme(e.target.value)}
            >
              <option value="Tous">Tous les thèmes</option>
              {BLOG_CLUSTERS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select
              style={{ ...inputStyle, maxWidth: '160px', padding: '7px 12px' }}
              value={artStatus}
              onChange={(e) => setArtStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="published">Publiés</option>
              <option value="draft">Brouillons</option>
            </select>
          </div>

          {/* Article table */}
          {articleList.length === 0 ? (
            <div style={{ color: '#bbb', textAlign: 'center', padding: '40px' }}>
              Aucun article trouvé. {Object.keys(articles).length === 0 && 'Lancez la génération IA pour créer vos premiers articles.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {articleList.map((a) => (
                <div key={a.slug} style={{
                  background: 'white', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--dark)', marginBottom: '3px' }}>{a.title}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {a.theme} · {a.publishedAt
                        ? `Publié le ${new Date(a.publishedAt).toLocaleDateString('fr-FR')}`
                        : `Créé le ${new Date(a.createdAt).toLocaleDateString('fr-FR')}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <Badge color={a.status === 'published' ? 'var(--success)' : '#e67e22'}>
                      {a.status === 'published' ? 'Publié' : 'Brouillon'}
                    </Badge>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditEditor(a.slug)}
                      style={{ padding: '5px 10px', fontSize: '11px' }}
                    >
                      ✏️ Éditer
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleToggleStatus(a.slug)}
                      style={{ padding: '5px 10px', fontSize: '11px' }}
                    >
                      {a.status === 'published' ? '↩ Dépublier' : '✅ Publier'}
                    </button>
                    <a
                      href={`/blog/${a.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none' }}
                    >
                      👁 Voir
                    </a>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeleteArticle(a.slug)}
                      style={{ padding: '5px 10px', fontSize: '11px', background: 'var(--danger)', color: 'white', border: 'none' }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EDITOR ──────────────────────────────────────────────────────────── */}
      {subTab === 'editor' && editorData && (
        <div style={{ maxWidth: '800px' }}>
          <h3 style={{ marginBottom: '20px', color: 'var(--dark)' }}>
            {editSlug ? '✏️ Modifier l\'article' : '✍️ Nouvel article'}
          </h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Titre *</label>
            <input style={inputStyle} value={editorData.title} onChange={(e) => setEditorData((d) => ({ ...d, title: e.target.value }))} placeholder="Comment choisir sa salle de mariage ?" />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Thème / catégorie</label>
              <select style={inputStyle} value={editorData.theme} onChange={(e) => setEditorData((d) => ({ ...d, theme: e.target.value }))}>
                {BLOG_CLUSTERS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Statut</label>
              <select style={inputStyle} value={editorData.status} onChange={(e) => setEditorData((d) => ({ ...d, status: e.target.value }))}>
                <option value="draft">Brouillon</option>
                <option value="published">Publié</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Mots-clés SEO (séparés par virgules)</label>
            <input style={inputStyle} value={editorData.keywords} onChange={(e) => setEditorData((d) => ({ ...d, keywords: e.target.value }))} placeholder="mariage, budget, salle de réception…" />
          </div>

          {/* AI generate button */}
          <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              onClick={handleGenArticleForEditor}
              disabled={genLoading || !editorData.title?.trim()}
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              {genLoading ? '⏳ Génération en cours…' : '🤖 Générer le contenu avec l\'IA'}
            </button>
            {!config.githubToken && (
              <span style={{ fontSize: '12px', color: '#e67e22' }}>⚠️ Configurez votre token GitHub pour la génération IA</span>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Extrait</label>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={editorData.excerpt}
              onChange={(e) => setEditorData((d) => ({ ...d, excerpt: e.target.value }))}
              placeholder="Résumé de l'article (1-2 phrases)…"
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Contenu (Markdown) *</label>
            <textarea
              style={{ ...inputStyle, minHeight: '320px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
              value={editorData.content}
              onChange={(e) => setEditorData((d) => ({ ...d, content: e.target.value }))}
              placeholder="## Titre H2&#10;### Sous-titre H3&#10;&#10;Votre contenu ici…"
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Titre SEO</label>
            <input style={inputStyle} value={editorData.seoTitle} onChange={(e) => setEditorData((d) => ({ ...d, seoTitle: e.target.value }))} placeholder={`${editorData.title} — ${config.businessName}`} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Meta description SEO</label>
            <textarea
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              value={editorData.seoDescription}
              onChange={(e) => setEditorData((d) => ({ ...d, seoDescription: e.target.value }))}
              placeholder="Description pour les moteurs de recherche (155 car. max)…"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => handleSaveArticle(false)} disabled={saving}>
              {saving ? '⏳ Enregistrement…' : '💾 Enregistrer (brouillon)'}
            </button>
            <button className="btn btn-primary" onClick={() => handleSaveArticle(true)} disabled={saving}>
              {saving ? '⏳…' : '✅ Enregistrer et publier'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSubTab('articles')} style={{ marginLeft: 'auto' }}>
              ← Retour
            </button>
          </div>
        </div>
      )}

      {/* ── BATCH GENERATION ────────────────────────────────────────────────── */}
      {subTab === 'batch' && (
        <div>
          <div style={{ marginBottom: '20px', background: 'var(--gold-pale)', borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ fontSize: '14px', color: 'var(--dark)' }}>
              <strong>🤖 Génération par lots (batch)</strong> — Sélectionnez des topics et générez les articles en une seule opération.
              {!config.githubToken && (
                <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>⚠️ Token GitHub requis (onglet Configuration).</span>
              )}
            </p>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              {pendingTopics.length} topic{pendingTopics.length > 1 ? 's' : ''} encore non générés sur {BLOG_TOPICS.length} au total.
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <select
              style={{ ...inputStyle, maxWidth: '220px', padding: '7px 12px' }}
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
            >
              <option value="Tous">Tous les thèmes</option>
              {BLOG_CLUSTERS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input
              style={{ ...inputStyle, maxWidth: '240px', padding: '7px 12px' }}
              placeholder="Rechercher un topic…"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
            />
            <button className="btn btn-sm btn-outline" onClick={selectAllVisible} style={{ padding: '7px 14px', fontSize: '11px' }}>
              Sélectionner tout ({filteredTopics.length})
            </button>
            <button className="btn btn-sm btn-ghost" onClick={deselectAll} style={{ padding: '7px 14px', fontSize: '11px' }}>
              Tout déselectionner
            </button>
          </div>

          {/* Progress bar */}
          {batchRunning && (
            <div style={{ marginBottom: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', marginBottom: '8px' }}>
                ⏳ Génération en cours : <strong>{batchProgress.current}</strong>
              </p>
              <div style={{ background: '#eee', borderRadius: '20px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '20px',
                  background: 'var(--gold)',
                  width: `${batchProgress.total ? Math.round(batchProgress.done / batchProgress.total * 100) : 0}%`,
                  transition: 'width 0.3s',
                }} />
              </div>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                {batchProgress.done} / {batchProgress.total}
              </p>
              <button
                className="btn btn-sm"
                onClick={() => { abortRef.current = true }}
                style={{ marginTop: '10px', background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 14px', fontSize: '11px' }}
              >
                Arrêter
              </button>
            </div>
          )}

          {batchDone && (
            <div style={{ marginBottom: '16px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '10px', padding: '12px 18px', fontSize: '13px', color: '#2e7d32' }}>
              ✅ Génération terminée — {batchProgress.done} article{batchProgress.done > 1 ? 's' : ''} créé{batchProgress.done > 1 ? 's' : ''} (en brouillon). Rendez-vous dans l'onglet Articles pour les publier.
            </div>
          )}

          {/* Generate button */}
          {selectedTopics.size > 0 && !batchRunning && (
            <div style={{ marginBottom: '16px' }}>
              <button
                className="btn btn-primary"
                onClick={handleBatchGenerate}
                style={{ padding: '10px 24px' }}
              >
                🚀 Générer {selectedTopics.size} article{selectedTopics.size > 1 ? 's' : ''} sélectionné{selectedTopics.size > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* Topic list */}
          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', background: 'white' }}>
            {filteredTopics.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#bbb' }}>
                {pendingTopics.length === 0 ? 'Tous les topics ont déjà été générés 🎉' : 'Aucun topic ne correspond aux filtres.'}
              </div>
            ) : filteredTopics.map((t) => {
              const ts = slugify(t.title)
              const checked = selectedTopics.has(ts)
              return (
                <div
                  key={ts}
                  onClick={() => toggleTopic(ts)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border-light)',
                    background: checked ? 'var(--gold-pale)' : 'white',
                    transition: 'background 0.12s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    style={{ flexShrink: 0, accentColor: 'var(--gold)', width: '15px', height: '15px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark)' }}>{t.title}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{t.theme}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CONFIG ──────────────────────────────────────────────────────────── */}
      {subTab === 'config' && (
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ marginBottom: '20px', color: 'var(--dark)' }}>⚙️ Configuration du blog</h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Nom de l'auteur / éditeur</label>
            <input style={inputStyle} value={config.authorName} onChange={(e) => updateConfig({ authorName: e.target.value })} placeholder="L'équipe Le Paradise 77" />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Nom de l'entreprise</label>
            <input style={inputStyle} value={config.businessName} onChange={(e) => updateConfig({ businessName: e.target.value })} placeholder="Le Paradise 77" />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Ton éditorial</label>
            <input style={inputStyle} value={config.tone} onChange={(e) => updateConfig({ tone: e.target.value })} placeholder="chaleureux, expert, rassurant" />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Longueur des articles</label>
            <select style={inputStyle} value={config.articleLength} onChange={(e) => updateConfig({ articleLength: e.target.value })}>
              <option value="short">Court (~600 mots)</option>
              <option value="medium">Moyen (~1000 mots)</option>
              <option value="long">Long (~1500 mots)</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fréquence auto-publication (jours)</label>
            <input
              type="number" min={1} max={60}
              style={inputStyle}
              value={config.autoPublishIntervalDays}
              onChange={(e) => updateConfig({ autoPublishIntervalDays: Number(e.target.value) })}
            />
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Un nouvel article sera auto-publié toutes les {config.autoPublishIntervalDays} jours (à la prochaine visite du dashboard ou via le cron PHP).
            </p>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Token GitHub (génération IA)</label>
            <input
              type="password" style={inputStyle}
              value={config.githubToken}
              onChange={(e) => updateConfig({ githubToken: e.target.value })}
              placeholder="ghp_…"
            />
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Utilisé pour appeler GPT-4o via GitHub Models API. Sans token : texte template utilisé.
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Secret cron (pour l'endpoint PHP)</label>
            <input
              style={inputStyle}
              value={config.cronSecret}
              onChange={(e) => updateConfig({ cronSecret: e.target.value })}
              placeholder="secret aléatoire pour sécuriser le cron"
            />
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Appelez <code>/api/blog-autopublish.php?token=VOTRE_SECRET</code> toutes les 24h depuis un cron externe (ex. cron-job.org) pour auto-publier un article tous les {config.autoPublishIntervalDays} jours.
            </p>
          </div>

          <div style={{ marginBottom: '20px', background: 'var(--gold-pale)', borderRadius: '8px', padding: '14px 18px' }}>
            <p style={{ fontSize: '12px', color: '#555', fontWeight: '600', marginBottom: '4px' }}>Dernière auto-publication :</p>
            <p style={{ fontSize: '13px', color: 'var(--dark)' }}>
              {config.lastAutoPublish
                ? new Date(config.lastAutoPublish).toLocaleString('fr-FR')
                : 'Jamais (lancez une génération manuelle pour initialiser)'}
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving ? '⏳ Enregistrement…' : '💾 Sauvegarder la configuration'}
          </button>
        </div>
      )}

      {/* ── AUTO LOG ────────────────────────────────────────────────────────── */}
      {subTab === 'autolog' && (
        <div>
          <h3 style={{ marginBottom: '16px', color: 'var(--dark)' }}>📊 Journal des auto-publications</h3>
          {autoLog.length === 0 ? (
            <div style={{ color: '#bbb', padding: '30px', textAlign: 'center' }}>Aucun événement enregistré.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {autoLog.map((entry, i) => (
                <div key={i} style={{
                  background: 'white', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '12px 16px',
                  display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap',
                }}>
                  <Badge color={entry.status === 'error' ? 'var(--danger)' : entry.status === 'success' ? 'var(--success)' : 'var(--gold)'}>
                    {entry.status}
                  </Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--dark)', fontWeight: '600' }}>
                      {entry.title || `Batch — ${entry.count ?? 0} article(s)`}
                    </div>
                    {entry.theme && <div style={{ fontSize: '11px', color: '#888' }}>{entry.theme}</div>}
                    {entry.error && <div style={{ fontSize: '11px', color: 'var(--danger)' }}>{entry.error}</div>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>
                    {new Date(entry.at).toLocaleString('fr-FR')} · {entry.source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
