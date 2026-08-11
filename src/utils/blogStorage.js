/**
 * blogStorage.js – Persistent storage and AI generation for the blog module.
 *
 * Storage layout (same PHP/localStorage dual-backend as cityPageStorage):
 *   paradise_blog_articles  → { [slug]: Article }
 *   paradise_blog_config    → BlogConfig
 *   paradise_blog_backup    → Array of { snapshot, backedUpAt }
 *   paradise_blog_autolog   → Array of AutoLogEntry (last 50)
 *
 * Article schema:
 *   slug            string        – URL-safe identifier
 *   title           string
 *   excerpt         string        – 1-2 sentence summary
 *   content         string        – full Markdown body
 *   theme           string        – cluster/category label
 *   keywords        string[]
 *   status          'draft' | 'published'
 *   createdAt       ISO string
 *   publishedAt     ISO string | null
 *   updatedAt       ISO string
 *   seoTitle        string
 *   seoDescription  string
 *   relatedSlugs    string[]      – slugs of related articles
 *   internalLinks   { href, label }[]  – contextual internal links
 */

const KEY_ARTICLES = 'paradise_blog_articles'
const KEY_CONFIG   = 'paradise_blog_config'
const KEY_BACKUP   = 'paradise_blog_backup'
const KEY_AUTOLOG  = 'paradise_blog_autolog'

// ── Shared get/set (same pattern as cityPageStorage) ──────────────────────────

async function _get(key) {
  try {
    const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`)
    if (res.ok) {
      const data = await res.json()
      if (data !== null) return data
    }
  } catch { /* fall through to localStorage */ }
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

async function _set(key, data) {
  const json = JSON.stringify(data)
  try { localStorage.setItem(key, json) } catch { /* quota */ }
  try {
    await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    })
  } catch { /* offline */ }
}

// ── Config ────────────────────────────────────────────────────────────────────

export const DEFAULT_BLOG_CONFIG = {
  githubToken:              '',
  authorName:               "L'équipe Le Paradise 77",
  tone:                     'chaleureux, expert, rassurant',
  articleLength:            'medium',        // 'short' ~600w | 'medium' ~1000w | 'long' ~1500w
  autoPublishIntervalDays:  5,
  lastAutoPublish:          null,
  businessName:             'Le Paradise 77',
  cronSecret:               '',              // shared secret for the PHP cron endpoint
}

export async function getBlogConfig() {
  const data = await _get(KEY_CONFIG)
  return { ...DEFAULT_BLOG_CONFIG, ...(data || {}) }
}

export async function saveBlogConfig(config) {
  await _set(KEY_CONFIG, config)
}

// ── Articles ──────────────────────────────────────────────────────────────────

/** Returns { [slug]: Article } */
export async function getBlogArticles() {
  return (await _get(KEY_ARTICLES)) || {}
}

export async function saveBlogArticles(articles) {
  await _set(KEY_ARTICLES, articles)
}

/** Returns published articles sorted by publishedAt desc */
export async function getPublishedArticles() {
  const all = await getBlogArticles()
  return Object.values(all)
    .filter((a) => a.status === 'published')
    .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt))
}

// ── Backups ───────────────────────────────────────────────────────────────────

export async function getBlogBackups() {
  return (await _get(KEY_BACKUP)) || []
}

export async function backupBlogArticles() {
  const current = await getBlogArticles()
  if (!Object.keys(current).length) return
  const existing = (await _get(KEY_BACKUP)) || []
  const entry = { snapshot: current, backedUpAt: new Date().toISOString() }
  await _set(KEY_BACKUP, [entry, ...existing].slice(0, 5))
}

// ── Auto-publish log ──────────────────────────────────────────────────────────

export async function getBlogAutoLog() {
  return (await _get(KEY_AUTOLOG)) || []
}

export async function appendBlogAutoLog(entry) {
  const existing = (await _get(KEY_AUTOLOG)) || []
  await _set(KEY_AUTOLOG, [entry, ...existing].slice(0, 50))
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

export function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function makeUniqueSlug(title, existingSlugs = []) {
  const base = slugify(title)
  if (!existingSlugs.includes(base)) return base
  let n = 2
  while (existingSlugs.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ── AI text cleanup ───────────────────────────────────────────────────────────

function _cleanText(raw) {
  if (!raw) return raw
  return raw
    .split('\n')
    .filter((line) => !/^```/.test(line.trim()))
    .join('\n')
    .trim()
}

// ── Fallback template ─────────────────────────────────────────────────────────

function _fallbackArticle(topic, businessName) {
  const intro = `Organiser un mariage est l'une des plus belles aventures de la vie, mais aussi l'une des plus complexes. "${topic.title}" — voilà une question que se posent tous les futurs mariés à un moment ou un autre de leur préparation. Dans cet article, nous vous donnons tous les conseils pratiques pour aborder ce sujet avec sérénité.`
  return `## ${topic.title}

${intro}

## Les points essentiels à retenir

### Anticiper et planifier

La clé d'une organisation réussie, c'est l'anticipation. Commencez par lister vos priorités et définissez un calendrier réaliste. Chaque décision mérite une réflexion posée pour éviter les regrets et les imprévus de dernière minute. Prenez le temps de consulter plusieurs professionnels avant de vous engager.

### Les erreurs les plus fréquentes

Nombreux sont les couples qui, faute d'information, font des choix qu'ils regrettent. Nous vous conseillons de vous entourer de prestataires de confiance, de lire attentivement les contrats et de toujours prévoir une marge dans votre budget pour les imprévus.

## Conseils pratiques pour les futurs mariés

- Commencez vos démarches au moins 12 à 18 mois à l'avance pour les prestataires les plus demandés
- Établissez un budget réaliste dès le début et respectez-le
- Faites confiance à votre instinct lors des visites de prestataires
- Déléguez les tâches non essentielles à des proches de confiance le jour J

## Comment faire les bons choix ?

Le mariage est une journée unique que vous méritez de vivre pleinement. Pour cela, entourez-vous de professionnels qui partagent votre vision et comprennent vos attentes. Lors de chaque rencontre, posez toutes vos questions sans hésiter — un bon prestataire prend toujours le temps d'écouter et de répondre.

## ${businessName} : votre partenaire pour un mariage d'exception

Pour votre mariage ou votre réception en Seine-et-Marne, **${businessName}** vous accompagne de la première visite jusqu'au Jour J. Notre équipe expérimentée saura répondre à toutes vos questions et vous proposer une solution adaptée à votre budget et vos envies.

N'hésitez pas à [demander un devis gratuit](/devis) — notre équipe vous répond sous 24h.`
}

// ── AI article generation ─────────────────────────────────────────────────────

/**
 * Generates a blog article for the given topic using the GitHub Models API.
 * Falls back to a local template if the API is unavailable or token is missing.
 *
 * @param {object} topic         – { title, theme, keywords, slug }
 * @param {object} config        – BlogConfig (githubToken, tone, etc.)
 * @returns {Promise<string>}    – Markdown content
 */
export async function generateBlogArticle(topic, config) {
  const wordTarget = config.articleLength === 'short' ? 600
    : config.articleLength === 'long' ? 1500
    : 1000
  const businessName = config.businessName || 'Le Paradise 77'
  const tone = config.tone || 'chaleureux, expert, rassurant'
  const kws = (topic.keywords || []).join(', ')

  if (config.githubToken) {
    try {
      const prompt = `Tu es un expert en rédaction de blog pour des futurs mariés en France.
Rédige un article de blog ORIGINAL, INFORMATIF et UNIQUE pour le blog d'une salle de mariage de prestige.
L'établissement s'appelle "${businessName}" (salle de réception en Seine-et-Marne 77).

Titre de l'article : "${topic.title}"
Thème / catégorie : ${topic.theme}
Mots-clés principaux : ${kws || topic.theme}
Ton éditorial : ${tone}
Longueur cible : environ ${wordTarget} mots

RÈGLES ABSOLUES :
- Contenu 100% ORIGINAL, pratique et utile pour les futurs mariés français
- Cite "${businessName}" de façon naturelle 1 à 2 fois maximum comme référence, jamais de façon forcée
- Inclure UNE mention douce vers /devis ("demander un devis gratuit") quand c'est pertinent
- Format Markdown strict : ## pour H2, ### pour H3 (PAS de #)
- Commence directement par le premier ## sans introduction ni méta-commentaire
- Au minimum 4 sections avec titre H2
- Chaque section ≥ 3 phrases de conseils concrets
- Style : ${tone}, chaleureux, pratique, adapté aux couples français
- Intègre les mots-clés naturellement tout au long du texte (jamais forcé)
- Termine par un paragraphe "Besoin d'aide ?" renvoyant vers ${businessName} et /devis

Inspiration thématique (style, pas de copie) : questions des futurs mariés sur mariages.net, 1001salles.com, abcsalles.com`

      const maxTokens = wordTarget === 600 ? 1100 : wordTarget === 1500 ? 2800 : 1900
      const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + config.githubToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.85,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const text = json.choices?.[0]?.message?.content?.trim()
        if (text) return _cleanText(text)
      }
    } catch { /* fall through to template */ }
  }

  return _fallbackArticle(topic, businessName)
}

/**
 * Generates a short SEO excerpt from a markdown article.
 * Returns the first paragraph that's meaningful text (no headings/bullets).
 */
export function extractExcerpt(content, maxLen = 180) {
  if (!content) return ''
  const lines = content.split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('-') || t.startsWith('•') || t.startsWith('[')) continue
    const clean = t.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    if (clean.length > 40) return clean.slice(0, maxLen) + (clean.length > maxLen ? '…' : '')
  }
  return content.slice(0, maxLen) + '…'
}

/**
 * Builds an array of internal links (maillage) for a generated article:
 *  – Always includes a link to /devis and /blog
 *  – Adds links to related published articles in the same theme
 *
 * @param {object} topic
 * @param {object} allArticles – existing { [slug]: Article }
 * @returns {{ href: string, label: string }[]}
 */
export function buildInternalLinks(topic, allArticles = {}) {
  const links = [
    { href: '/devis', label: 'Demander un devis gratuit — Le Paradise 77' },
    { href: '/blog', label: 'Tous nos articles mariage' },
  ]
  // Add 2-3 published articles in the same theme
  const related = Object.values(allArticles)
    .filter((a) => a.status === 'published' && a.theme === topic.theme && a.slug !== slugify(topic.title))
    .slice(0, 3)
  related.forEach((a) => {
    links.push({ href: `/blog/${a.slug}`, label: a.title })
  })
  return links
}

/**
 * Builds the relatedSlugs array for a new article.
 * Finds up to 5 published articles in the same or adjacent themes.
 */
export function buildRelatedSlugs(topic, allArticles = {}, relatedThemes = []) {
  const themes = [topic.theme, ...relatedThemes]
  return Object.values(allArticles)
    .filter((a) => a.status === 'published' && themes.includes(a.theme) && a.slug !== slugify(topic.title))
    .slice(0, 5)
    .map((a) => a.slug)
}

// ── Auto-publish logic (client-side fallback) ─────────────────────────────────

/**
 * Checks if an auto-publish run is due and, if so, publishes one article.
 * Designed to be called on Dashboard mount.
 *
 * @param {object[]} allTopics   – full BLOG_TOPICS list
 * @returns {Promise<{ran: boolean, slug?: string, error?: string}>}
 */
export async function maybeAutoPublish(allTopics) {
  try {
    const config = await getBlogConfig()
    if (!config.githubToken) return { ran: false }
    if (!config.lastAutoPublish) return { ran: false }  // needs first manual trigger

    const daysSince = (Date.now() - new Date(config.lastAutoPublish).getTime()) / 86_400_000
    if (daysSince < config.autoPublishIntervalDays) return { ran: false }

    const articles = await getBlogArticles()
    const usedSlugs = new Set(Object.keys(articles))
    const pending = allTopics.filter((t) => !usedSlugs.has(slugify(t.title)))
    if (!pending.length) return { ran: false }

    // Pick a random pending topic
    const topic = pending[Math.floor(Math.random() * pending.length)]
    const slug = makeUniqueSlug(topic.title, Object.keys(articles))

    const content = await generateBlogArticle(topic, config)
    const now = new Date().toISOString()
    const article = {
      slug,
      title: topic.title,
      excerpt: extractExcerpt(content),
      content,
      theme: topic.theme,
      keywords: topic.keywords || [],
      status: 'published',
      createdAt: now,
      publishedAt: now,
      updatedAt: now,
      seoTitle: `${topic.title} — ${config.businessName || 'Le Paradise 77'}`,
      seoDescription: extractExcerpt(content, 155),
      relatedSlugs: buildRelatedSlugs(topic, articles, topic.relatedThemes),
      internalLinks: buildInternalLinks(topic, articles),
    }

    const updated = { ...articles, [slug]: article }
    await saveBlogArticles(updated)
    await saveBlogConfig({ ...config, lastAutoPublish: now })
    await appendBlogAutoLog({
      at: now, slug, title: topic.title, theme: topic.theme,
      status: 'success', source: 'client-auto',
    })
    return { ran: true, slug }
  } catch (e) {
    await appendBlogAutoLog({
      at: new Date().toISOString(), slug: null, title: null, theme: null,
      status: 'error', source: 'client-auto', error: String(e),
    })
    return { ran: false, error: String(e) }
  }
}
