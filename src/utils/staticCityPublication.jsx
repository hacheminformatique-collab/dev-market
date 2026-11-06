import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { CityPageContent } from '../components/VillesPages/CityPage'
import { buildSeoData } from './seoData'
import { PAGE_TYPES, PAGE_TYPES_BY_ID } from '../data/pageTypes'
import { getCityBySlug } from '../data/idf-cities'
import { buildSitemapXml, buildRobotsTxt } from './seoFiles'
import WeddingDirectory from '../components/WeddingDirectory'
import { validateWeddingTemplate } from './weddingPageTemplates'

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')
}

export function makeCitySnapshot({ slug, pages, config, gallery, allTypePages, blogArticles }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !getCityBySlug(slug) || !pages[slug]?.content?.trim()) {
    throw new Error(`Page mariage invalide ou vide : ${slug}`)
  }
  const page = pages[slug]
  if (Number.isNaN(new Date(page.generatedAt).getTime())) {
    throw new Error(`Date de génération invalide : ${slug}`)
  }
  return {
    citySlug: slug,
    pageType: PAGE_TYPES_BY_ID.mariage,
    page: { content: page.content, generatedAt: page.generatedAt, ...(page.template === undefined ? {} : { template: validateWeddingTemplate(page.template) }) },
    config: {
      businessName: config.businessName,
      googleMapsApiKey: config.googleMapsApiKey,
      instagramUsername: config.instagramUsername,
      instagramPosts: config.instagramPosts || [],
      tiktokUsername: config.tiktokUsername,
      tiktokPosts: config.tiktokPosts || [],
    },
    gallery,
    allTypePages: Object.fromEntries(PAGE_TYPES.map((pt) => [
      pt.id,
      Object.fromEntries(Object.keys(pt.id === 'mariage' ? pages : allTypePages[pt.id] || {}).map((citySlug) => [citySlug, true])),
    ])),
    blogArticles: Object.values(blogArticles)
      .filter((article) => article.status === 'published')
      .sort((a, b) => Number((b.theme || '').toLowerCase().includes('mariage'))
        - Number((a.theme || '').toLowerCase().includes('mariage')))
      .slice(0, 3)
      .map(({ slug: articleSlug, title, theme, excerpt }) => ({ slug: articleSlug, title, theme, excerpt })),
  }
}

export function renderSeoHead(seo) {
  const meta = (name, content, attr = 'name') => `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`
  return [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta('description', seo.description),
    meta('keywords', seo.keywords),
    meta('robots', seo.robots),
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
    meta('og:title', seo.title, 'property'),
    meta('og:description', seo.description, 'property'),
    meta('og:type', seo.ogType, 'property'),
    meta('og:url', seo.canonical, 'property'),
    meta('og:image', seo.imageUrl, 'property'),
    meta('og:locale', 'fr_FR', 'property'),
    meta('twitter:card', 'summary_large_image'),
    `<script id="seo-json-ld" type="application/ld+json">${scriptJson(seo.jsonLd)}</script>`,
  ].join('\n')
}

export function renderCityDocument({ template, snapshot, settings, origin }) {
  if (!template.includes('<!-- CITY_SEO -->') || !template.includes('<!-- CITY_DATA -->')
    || !template.includes('<div id="root"></div>')
    || !/src="\/assets\/[^"]+\.js"/.test(template) || template.includes('/src/')) {
    throw new Error('Le modèle statique compilé est absent ou invalide. Déployez le dossier dist complet après npm run build.')
  }
  const path = `${snapshot.pageType.basePath}/${snapshot.citySlug}`
  const seo = buildSeoData(path, {
    nom: snapshot.config.businessName || settings.nom,
    siteUrl: origin,
    whatsapp: settings.whatsapp,
    legalInfo: settings.legalInfo,
  }, { [snapshot.citySlug]: snapshot.page }, snapshot.pageType, null, null, origin)
  const head = renderSeoHead(seo)
  const body = renderToString(
    <MemoryRouter initialEntries={[path]}>
      <CityPageContent {...snapshot} published />
    </MemoryRouter>,
  )
  // Callback replacements keep literal "$&" and "$'" in generated content intact.
  return template
    .replace(/<meta name="robots" content="noindex, nofollow"\s*\/?>/, '')
    .replace('<!-- CITY_SEO -->', () => head)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
    .replace('<!-- CITY_DATA -->', () => `<script id="city-page-data" type="application/json">${scriptJson(snapshot)}</script>`)
}

export async function publishWeddingPages({ pages, config, gallery, allTypePages, blogArticles, settings, origin, onProgress }) {
  const slugs = Object.keys(pages)
  if (!slugs.length) throw new Error('Aucune page mariage à publier.')
  if (!settings.pin) throw new Error('Enregistrez votre code PIN dans Mes Infos avant de publier.')
  const configured = (settings.siteUrl || '').trim()
  const base = new URL(configured ? (/^https?:\/\//i.test(configured) ? configured : `https://${configured}`) : origin)
  if (base.origin !== origin) {
    throw new Error('Le domaine configuré dans Mes Infos doit correspondre au domaine actuel du site pour que les URL canonical soient accessibles.')
  }
  const response = await fetch('/static-city.html', { cache: 'no-store' })
  if (!response.ok) throw new Error(`Modèle statique inaccessible (HTTP ${response.status}). Déployez le dossier dist complet.`)
  const template = await response.text()

  async function write(payload) {
    const res = await fetch('/api/static-publish.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': settings.pin },
      body: JSON.stringify(payload),
    })
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`API PHP de publication indisponible (HTTP ${res.status}). Vérifiez le déploiement et la limite post_max_size.`)
    }
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || `Publication refusée (HTTP ${res.status}).`)
  }

  const shell = await fetch('/', { cache: 'no-store' })
  const shellHtml = await shell.text()
  if (!shell.ok || !shellHtml.includes('<!-- WEDDING_DIRECTORY_START -->')
    || !shellHtml.includes('<!-- WEDDING_DIRECTORY_END -->')
    || !shellHtml.includes('<!-- HOME_SEO_START -->') || !shellHtml.includes('<!-- HOME_SEO_END -->')) {
    throw new Error('Le modèle index.html est incompatible avec l’annuaire. Déployez le dossier dist complet avant de publier.')
  }
  // Validate all inputs before writing the first file.
  for (const slug of slugs) makeCitySnapshot({ slug, pages, config, gallery, allTypePages, blogArticles })
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    onProgress({ done: i, total: slugs.length, current: getCityBySlug(slug).name })
    const snapshot = makeCitySnapshot({ slug, pages, config, gallery, allTypePages, blogArticles })
    const html = renderCityDocument({ template, snapshot, settings, origin })
    await write({ action: 'page', slug, html })
    const check = await fetch(`${snapshot.pageType.basePath}/${slug}`, { cache: 'no-store' })
    if (!check.ok || await check.text() !== html) {
      throw new Error(`Le fichier de ${getCityBySlug(slug).name} a été écrit, mais son URL ne sert pas le HTML publié. Vérifiez le fichier .htaccess et mod_rewrite.`)
    }
    onProgress({ done: i + 1, total: slugs.length, current: '' })
  }
  onProgress({ done: slugs.length, total: slugs.length, current: 'Publication de l’annuaire, du sitemap et de robots.txt' })
  const sitemap = buildSitemapXml({ baseUrl: origin, allTypePages: { ...allTypePages, mariage: pages }, blogArticles })
  const robots = buildRobotsTxt(origin)
  const directory = renderToStaticMarkup(<WeddingDirectory slugs={slugs} businessName={config.businessName || settings.nom} />)
  const homeSeo = renderSeoHead(buildSeoData('/', { ...settings, siteUrl: origin }, {}, null, null, null, origin))
  await write({ action: 'seo', sitemap, robots, directory, slugs, homeSeo })
  for (const [path, content] of [['/sitemap.xml', sitemap], ['/robots.txt', robots], ['/wedding-directory.html', directory], ['/wedding-pages.json', JSON.stringify(slugs)]]) {
    const check = await fetch(path, { cache: 'no-store' })
    if (!check.ok || await check.text() !== content) throw new Error(`Le fichier ${path} a été écrit mais n'est pas accessible à son URL.`)
  }
  const home = await fetch('/', { cache: 'no-store' })
  if (!home.ok || !(await home.text()).includes(directory)) {
    throw new Error('L’annuaire a été publié mais n’est pas présent dans le HTML initial de l’accueil. Vérifiez le déploiement de index.html.')
  }
  onProgress({ done: slugs.length, total: slugs.length, current: '' })
  return slugs.length
}
