import { batchFetch as fetch } from './siteFetch'
import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { CityPageContent } from '../components/VillesPages/CityPage'
import { buildSeoData } from './seoData'
import { PAGE_TYPES, PAGE_TYPES_BY_ID } from '../data/pageTypes'
import { getCityBySlug } from '../data/idf-cities'
import { buildSitemapXml, buildRobotsTxt } from './seoFiles'
import WeddingDirectory from '../components/WeddingDirectory'
import directoryStyles from '../components/WeddingDirectory.css?raw'
import { validateWeddingTemplate } from './weddingPageTemplates'
import { resolveWeddingSourceLayout } from './weddingSourceLayout'
import { validateWeddingTravel } from './weddingTravel'
import { WEDDING_DEPARTMENTS, departmentPath, directoryDepartmentCode } from './weddingDepartments'
import DepartmentPage from '../components/VillesPages/DepartmentPage'
import { canonicalCityPages, legacyCityAliases } from './cityPageIdentity'
import { verifyPublishedUrl } from './publicationVerification'

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')
}

async function hashText(text) {
  if (!globalThis.crypto?.subtle) throw new Error('La vérification des pages nécessite HTTPS et un navigateur compatible.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function cityDirectory(slugs, slug, businessName) {
  const city = getCityBySlug(slug)
  return renderToStaticMarkup(<WeddingDirectory slugs={slugs} businessName={businessName} cityName={city.name} departmentCode={directoryDepartmentCode(city)} />)
}

export function renderDepartmentDocument({ template, departmentCode, businessName, slugs, origin }) {
  const department = WEDDING_DEPARTMENTS.find(({ code }) => code === departmentCode)
  if (!department || !template.includes('<!-- CITY_SEO -->') || !template.includes('<!-- CITY_DATA -->')) {
    throw new Error('Département ou modèle HTML invalide.')
  }
  const path = departmentPath(departmentCode)
  const snapshot = { departmentCode, businessName, slugs }
  const canonical = new URL(path, origin).href
  const title = `Location salle de mariage — ${department.name} (${department.code}) | ${businessName}`
  const description = `Préparez votre mariage depuis ${department.name} (${department.code}). ${businessName} vous accueille au 5 avenue Fridingen à Nanteuil les Meaux. Découvrez les communes et demandez votre devis.`
  const head = renderSeoHead({
    title, description, keywords: `location salle mariage ${department.name}`,
    canonical, robots: 'index, follow', imageUrl: `${origin}/media/hero-paradise.jpg`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical, description, about: { '@type': 'AdministrativeArea', name: department.name } },
  })
  const body = renderToString(<DepartmentPage {...snapshot} />)
  return template
    .replace(/<meta name="robots" content="noindex, nofollow"\s*\/?>/, '')
    .replace('<!-- CITY_SEO -->', () => head)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
    .replace('<!-- CITY_DATA -->', () => `<script id="city-page-data" type="application/json">${scriptJson(snapshot)}</script>`)
}

export function makeCitySnapshot({ slug, pages, config, gallery, allTypePages, blogArticles }) {
  pages = canonicalCityPages(pages)
  slug = getCityBySlug(slug)?.slug || slug
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !getCityBySlug(slug) || !pages[slug]?.content?.trim()) {
    throw new Error(`Page mariage invalide ou vide : ${slug}`)
  }
  const page = pages[slug]
  if (Number.isNaN(new Date(page.generatedAt).getTime())) {
    throw new Error(`Date de génération invalide : ${slug}`)
  }
  if (!page.travel) {
    throw new Error(`Trajet routier non calculé pour ${getCityBySlug(slug).name}. Cliquez sur « Mettre à jour les trajets » avant de publier.`)
  }
  const travel = validateWeddingTravel(page.travel)
  if (page.template?.version === 2) resolveWeddingSourceLayout(page, getCityBySlug(slug))
  return {
    citySlug: slug,
    pageType: PAGE_TYPES_BY_ID.mariage,
    page: { content: page.content, generatedAt: page.generatedAt, travel,
      city: { slug, name: getCityBySlug(slug).name, postalCode: getCityBySlug(slug).postalCode, deptCode: getCityBySlug(slug).deptCode },
      ...(page.template === undefined ? {} : { template: validateWeddingTemplate(page.template) }) },
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
      Object.fromEntries(Object.keys(pt.id === 'mariage' ? pages : canonicalCityPages(allTypePages[pt.id] || {})).map((citySlug) => [citySlug, true])),
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

export function renderCityDocument({ template, snapshot, settings, origin, directorySlugs = Object.keys(snapshot.allTypePages.mariage || {}) }) {
  if (!template.includes('<!-- CITY_SEO -->') || !template.includes('<!-- CITY_DATA -->')
    || !template.includes('<div id="root"></div>')
    || !template.includes('</body>')
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
  const directory = cityDirectory(directorySlugs, snapshot.citySlug, snapshot.config.businessName || 'Le Paradise 77')
  // Callback replacements keep literal "$&" and "$'" in generated content intact.
  return template
    .replace(/<meta name="robots" content="noindex, nofollow"\s*\/?>/, '')
    .replace('<!-- CITY_SEO -->', () => head)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
    .replace('<!-- CITY_DATA -->', () => `<!-- CITY_DIRECTORY_START -->${directory}<!-- CITY_DIRECTORY_END -->\n<script id="city-page-data" type="application/json">${scriptJson(snapshot)}</script>`)
}

export async function publishWeddingPages({ pages, config, gallery, allTypePages, blogArticles, settings, origin, onProgress: reportProgress, updateTemplate = false }) {
  const counts = { published: 0, unchanged: 0, upgraded: 0 }
  const onProgress = (progress) => reportProgress({ ...progress, ...counts })
  pages = canonicalCityPages(pages)
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
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch {
      throw new Error(`Publication : réponse ${text.trim() ? 'invalide ou tronquée' : 'vide'} de api/static-publish.php, opération « ${payload.action} » (HTTP ${res.status}). Consultez les journaux PHP pour vérifier les limites mémoire et de durée d’exécution.`)
    }
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Publication refusée (HTTP ${res.status}, opération « ${payload.action} »).`)
    return data
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
  const inspection = await write({ action: 'inspect', slugs, aliases: legacyCityAliases, inspectSlugs: [] })
  if (!inspection.pages || typeof inspection.pages !== 'object' || !Array.isArray(inspection.publishedSlugs)
    || typeof inspection.registryHash !== 'string'
    || (inspection.registryHash !== 'missing' && !/^[a-f0-9]{64}$/.test(inspection.registryHash))
    || inspection.publishedSlugs.some((slug) => typeof slug !== 'string' || !getCityBySlug(slug))) {
    throw new Error('Vérification des fichiers publiés invalide.')
  }
  const allSlugs = [...new Set([...inspection.publishedSlugs, ...slugs])]
  for (let offset = 0; offset < allSlugs.length; offset += 25) {
    onProgress({ done: 0, total: allSlugs.length, current: `Vérification préalable : ${offset} / ${allSlugs.length}` })
    const inspectSlugs = allSlugs.slice(offset, offset + 25)
    const batch = await write({ action: 'inspect', slugs, aliases: legacyCityAliases, inspectSlugs })
    if (batch.registryHash !== inspection.registryHash) {
      throw new Error('Le registre des pages a changé pendant la vérification. Relancez la publication pour protéger les fichiers.')
    }
    for (const slug of inspectSlugs) {
      if (!batch.pages?.[slug]) throw new Error(`Vérification du fichier de ${getCityBySlug(slug).name} absente de la réponse serveur.`)
      inspection.pages[slug] = batch.pages[slug]
    }
  }
  const pageHashes = {}
  const directoryHashes = {}
  const publishedNow = new Set()
  const pendingCheckpoints = {}
  async function flushCheckpoints() {
    if (!inspection.checkpointsSupported || !Object.keys(pendingCheckpoints).length) return
    const result = await write({ action: 'checkpoint', pages: pendingCheckpoints, aliases: legacyCityAliases, expectedRegistryHash: inspection.registryHash })
    if (!/^[a-f0-9]{64}$/.test(result.registryHash || '')) throw new Error('Confirmation de reprise de publication invalide.')
    inspection.registryHash = result.registryHash
    for (const slug of Object.keys(pendingCheckpoints)) delete pendingCheckpoints[slug]
  }
  async function verifyCity(slug, fileHash) {
    const alreadyVerified = inspection.checkpointsSupported && inspection.pages[slug]?.verifiedHash === fileHash
    if (alreadyVerified && inspection.publishedSlugs.includes(slug)) return
    if (!alreadyVerified) await verifyPublishedUrl({ path: `${PAGE_TYPES_BY_ID.mariage.basePath}/${slug}`, expectedHash: fileHash, label: getCityBySlug(slug).name, hashText })
    if (inspection.checkpointsSupported) {
      pendingCheckpoints[slug] = fileHash
      if (Object.keys(pendingCheckpoints).length >= 25) await flushCheckpoints()
    }
  }
  try {
  for (let i = 0; i < allSlugs.length; i++) {
    const slug = allSlugs[i]
    onProgress({ done: i, total: allSlugs.length, current: getCityBySlug(slug).name })
    const existing = inspection.pages[slug]
    if (!existing || typeof existing.fileHash !== 'string'
      || (existing.fileHash !== 'missing' && !/^[a-f0-9]{64}$/.test(existing.fileHash))) {
      throw new Error(`Vérification du fichier de ${getCityBySlug(slug).name} invalide.`)
    }
    const snapshot = pages[slug] ? makeCitySnapshot({ slug, pages, config, gallery, allTypePages, blogArticles }) : null
    if (snapshot) snapshot.allTypePages.mariage = Object.fromEntries(allSlugs.map((citySlug) => [citySlug, true]))
    if (!snapshot) {
      if (!snapshot && existing.fileHash === 'missing' && existing.legacySlug) {
        const result = await write({ action: 'city-migrate', slug, legacySlug: existing.legacySlug, expectedHash: existing.legacyHash })
        await verifyCity(slug, result.fileHash)
        pageHashes[slug] = result.fileHash
        directoryHashes[slug] = result.directoryHash
        counts.published++
        publishedNow.add(slug)
        onProgress({ done: i + 1, total: allSlugs.length, current: '' })
        continue
      }
      if (!snapshot && existing.fileHash === 'missing') throw new Error(`Page publiée manquante : ${slug}.`)
      pageHashes[slug] = existing.fileHash
      directoryHashes[slug] = existing.directoryHash
      if (inspection.checkpointsSupported) await verifyCity(slug, existing.fileHash)
      counts.unchanged++
      onProgress({ done: i + 1, total: allSlugs.length, current: '' })
      continue
    }
    const html = renderCityDocument({ template, snapshot, settings, origin, directorySlugs: allSlugs })
    const desiredHash = await hashText(html)
    if (!updateTemplate && existing.fileHash === desiredHash) {
      pageHashes[slug] = existing.fileHash
      directoryHashes[slug] = existing.directoryHash
      if (inspection.checkpointsSupported) await verifyCity(slug, desiredHash)
      counts.unchanged++
      onProgress({ done: i + 1, total: allSlugs.length, current: '' })
      continue
    }
    await write({ action: 'page', slug, html, expectedHash: existing.fileHash })
    await verifyCity(slug, desiredHash)
    counts.published++
    publishedNow.add(slug)
    pageHashes[slug] = desiredHash
    directoryHashes[slug] = await hashText(cityDirectory(allSlugs, slug, snapshot.config.businessName || 'Le Paradise 77'))
    onProgress({ done: i + 1, total: allSlugs.length, current: '' })
  }
  await flushCheckpoints()
  for (let i = 0; i < allSlugs.length; i++) {
    const slug = allSlugs[i]
    onProgress({ done: i, total: allSlugs.length, current: `Annuaire : ${getCityBySlug(slug).name}` })
    const existing = inspection.pages[slug]
    const businessName = pages[slug] ? (config.businessName || 'Le Paradise 77') : existing.businessName
    if (typeof businessName !== 'string' || !businessName) throw new Error(`Nom de la salle indisponible pour ${slug}.`)
    const directoryHtml = cityDirectory(allSlugs, slug, businessName)
    const directoryHash = await hashText(directoryHtml)
    if (directoryHashes[slug] !== directoryHash) {
      const result = await write({ action: 'city-directory', slug, directory: directoryHtml, styles: directoryStyles, expectedHash: pageHashes[slug] })
      if (result.directoryHash !== directoryHash) throw new Error(`L’annuaire de ${getCityBySlug(slug).name} n’a pas pu être vérifié.`)
      if (inspection.checkpointsSupported) {
        if (!/^[a-f0-9]{64}$/.test(result.fileHash || '')) throw new Error(`Hash de l’annuaire de ${slug} invalide.`)
        await verifyCity(slug, result.fileHash)
        pageHashes[slug] = result.fileHash
      }
      if (!publishedNow.has(slug)) {
        counts.unchanged--
        counts.upgraded++
      }
    }
  }
  await flushCheckpoints()
  } catch (error) {
    try {
      await flushCheckpoints()
    } catch (checkpointError) {
      throw new Error(`${error.message} La confirmation de reprise a aussi échoué : ${checkpointError.message}`, { cause: error })
    }
    throw error
  }
  const departmentCodes = WEDDING_DEPARTMENTS.map(({ code }) => code)
  for (const code of departmentCodes) {
    onProgress({ done: allSlugs.length, total: allSlugs.length, current: `Département : ${code}` })
    const departmentSlugs = allSlugs.filter((slug) => getCityBySlug(slug).deptCode === code)
    const html = renderDepartmentDocument({ template, departmentCode: code, businessName: config.businessName || settings.nom || 'Le Paradise', slugs: departmentSlugs, origin })
    const expectedHash = inspection.departments?.[code] ?? 'missing'
    if (expectedHash !== await hashText(html)) {
      await write({ action: 'department', code, html, expectedHash })
      const check = await fetch(departmentPath(code), { cache: 'no-store' })
      if (!check.ok || await check.text() !== html) throw new Error(`La page du département ${code} n’est pas accessible. Vérifiez .htaccess.`)
    }
  }
  onProgress({ done: allSlugs.length, total: allSlugs.length, current: 'Publication de l’annuaire, du sitemap et de robots.txt' })
  const sitemapPages = Object.fromEntries(allSlugs.map((slug) => [slug, pages[slug] || { content: 'published', generatedAt: inspection.pages[slug].generatedAt }]))
  const sitemap = buildSitemapXml({ baseUrl: origin, allTypePages: { ...allTypePages, mariage: sitemapPages }, blogArticles, departmentCodes })
  const robots = buildRobotsTxt(origin)
  const directory = renderToStaticMarkup(<WeddingDirectory slugs={allSlugs} businessName={config.businessName || settings.nom} />)
  const idfDirectory = renderToStaticMarkup(<WeddingDirectory slugs={allSlugs} businessName={config.businessName || settings.nom} region="Île-de-France" />)
  const homeSeo = renderSeoHead(buildSeoData('/', { ...settings, siteUrl: origin }, {}, null, null, null, origin))
  await write({ action: 'seo', sitemap, robots, directory, idfDirectory, slugs: allSlugs, aliases: legacyCityAliases, departmentCodes, homeSeo, expectedRegistryHash: inspection.registryHash })
  for (const [path, content] of [['/sitemap.xml', sitemap], ['/robots.txt', robots], ['/wedding-directory.html', directory], ['/wedding-directory-idf.html', idfDirectory], ['/wedding-pages.json', JSON.stringify(allSlugs)], ['/wedding-city-aliases.json', JSON.stringify(legacyCityAliases)], ['/wedding-departments.json', JSON.stringify(departmentCodes)]]) {
    const check = await fetch(path, { cache: 'no-store' })
    if (!check.ok || await check.text() !== content) throw new Error(`Le fichier ${path} a été écrit mais n'est pas accessible à son URL.`)
  }
  const home = await fetch('/', { cache: 'no-store' })
  if (!home.ok || !(await home.text()).includes(directory)) {
    throw new Error('L’annuaire a été publié mais n’est pas présent dans le HTML initial de l’accueil. Vérifiez le déploiement de index.html.')
  }
  onProgress({ done: allSlugs.length, total: allSlugs.length, current: '' })
  return { total: allSlugs.length, ...counts }
}
