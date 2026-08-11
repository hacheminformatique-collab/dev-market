import { PAGE_TYPES } from '../data/pageTypes'

function normalizeBaseUrl(rawUrl) {
  const fallback = window.location.origin
  const input = (rawUrl || '').trim() || fallback
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
  const url = new URL(withProtocol)
  return url.origin
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * @param {object} opts
 * @param {string}  opts.baseUrl
 * @param {object}  [opts.cityPages]        – legacy mariage pages { [slug]: { content, generatedAt } }
 * @param {object}  [opts.allTypePages]     – { [typeId]: { [slug]: { content, generatedAt } } }
 * @param {object}  [opts.blogArticles]     – { [slug]: Article } from blogStorage
 */
export function buildSitemapXml({ baseUrl, cityPages = {}, allTypePages = {}, blogArticles = {} }) {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const today = new Date().toISOString().slice(0, 10)

  const rows = [
    { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: today },
    { path: '/devis', changefreq: 'weekly', priority: '0.8', lastmod: today },
    { path: '/blog', changefreq: 'daily', priority: '0.8', lastmod: today },
  ]

  // Helper to add pages for a given basePath
  function addPageRows(basePath, pages) {
    Object.entries(pages || {}).forEach(([slug, page]) => {
      if (!slug || !page?.content) return
      const generatedAt = page?.generatedAt ? new Date(page.generatedAt) : null
      const validDate = generatedAt && !Number.isNaN(generatedAt.getTime())
      rows.push({
        path: `${basePath}/${slug}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: validDate ? generatedAt.toISOString().slice(0, 10) : today,
      })
    })
  }

  // Add pages for every known page type (via allTypePages)
  PAGE_TYPES.forEach((pt) => {
    const pages = allTypePages[pt.id] || (pt.id === 'mariage' ? cityPages : {})
    addPageRows(pt.basePath, pages)
  })

  // Add published blog articles
  Object.entries(blogArticles).forEach(([slug, article]) => {
    if (!slug || article?.status !== 'published') return
    const publishedAt = article?.publishedAt ? new Date(article.publishedAt) : null
    const updatedAt = article?.updatedAt ? new Date(article.updatedAt) : null
    const lastDate = updatedAt || publishedAt
    const validDate = lastDate && !Number.isNaN(lastDate.getTime())
    rows.push({
      path: `/blog/${slug}`,
      changefreq: 'monthly',
      priority: '0.6',
      lastmod: validDate ? lastDate.toISOString().slice(0, 10) : today,
    })
  })

  const uniq = new Map()
  rows.forEach((row) => {
    if (!uniq.has(row.path)) uniq.set(row.path, row)
  })

  const urlsXml = [...uniq.values()]
    .map((row) => {
      const absolute = new URL(row.path, normalizedBase).toString()
      return [
        '  <url>',
        `    <loc>${xmlEscape(absolute)}</loc>`,
        `    <lastmod>${row.lastmod}</lastmod>`,
        `    <changefreq>${row.changefreq}</changefreq>`,
        `    <priority>${row.priority}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`
}

export function buildRobotsTxt(baseUrl) {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const sitemapUrl = new URL('/sitemap.xml', normalizedBase).toString()
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /espace-client/',
    'Disallow: /espace-staff/',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n')
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
}
