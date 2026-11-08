import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'vite'
import { mkdtemp, cp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createServer as createTcpServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { normalizeCityName } from '../src/utils/cityNames.js'

const travel = { km: 16, minutes: 20, source: 'test', computedAt: '2026-01-01T00:00:00Z' }

const root = resolve(import.meta.dirname, '..')
let vite, publication, directory, site, origin, template, shellTemplate
let buildSeoData, PAGE_TYPES_BY_ID, getPublishedWeddingSlugs, isPublicPath
let WeddingDirectory
let ALL_CITIES, getCityBySlug
let generateWeddingPage
const processes = []
const pin = 'publication-test-pin'
const fixture = {
  pages: {
    'meaux-77100': { content: '## Mariage à Meaux\nTexte unique $& et <script>non exécuté</script>.', generatedAt: '2026-01-10T12:00:00Z', travel },
    'nanteuil-les-meaux-77100': { content: 'Une salle pour votre mariage à Nanteuil.', generatedAt: '2026-01-11T12:00:00Z', travel },
  },
  config: { businessName: 'Salle de test & mariage', githubToken: 'DO-NOT-PUBLISH-TOKEN', instagramPosts: [], tiktokPosts: [] },
  gallery: [],
  allTypePages: {
    mariage: { 'meaux-77100': { content: 'INTERNAL-OTHER-CONTENT' }, 'nanteuil-les-meaux-77100': { content: 'INTERNAL-OTHER-CONTENT' }, 'bobigny-93000': { content: 'ONLY-GENERATED-NOT-PUBLISHED' } },
    anniversaire: { 'nanteuil-les-meaux-77100': { content: 'LEGACY-OTHER-CONTENT' } },
  },
  blogArticles: {
    exemple: { slug: 'exemple', title: 'Préparer son mariage', theme: 'mariage', excerpt: 'Conseils utiles', status: 'published' },
    brouillon: { slug: 'brouillon', title: 'PRIVATE-DRAFT', status: 'draft' },
  },
  settings: { nom: 'Salle test', pin, whatsapp: '', bankInfo: { account: 'PRIVATE-BANK-INFO' } },
}

async function freePort() {
  const server = createTcpServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((resolveClose) => server.close(resolveClose))
  return port
}

function start(command, args, options = {}) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  child.on('error', (error) => { output += error.message })
  processes.push(child)
  return () => output
}

async function ready(url, output) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* wait for the isolated server to bind */ }
    await new Promise((wait) => setTimeout(wait, 50))
  }
  assert.fail(`Server did not start: ${await output()}`)
}

before(async () => {
  vite = await createServer({ root, server: { middlewareMode: true } })
  publication = await vite.ssrLoadModule('/src/utils/staticCityPublication.jsx')
  ;({ buildSeoData } = await vite.ssrLoadModule('/src/utils/seoData.js'))
  ;({ PAGE_TYPES_BY_ID } = await vite.ssrLoadModule('/src/data/pageTypes.js'))
  ;({ ALL_CITIES, getCityBySlug } = await vite.ssrLoadModule('/src/data/idf-cities.js'))
  ;({ generateWeddingPage } = await vite.ssrLoadModule('/src/utils/weddingPageTemplates.js'))
  ;({ getPublishedWeddingSlugs, isPublicPath } = await vite.ssrLoadModule('/src/utils/weddingPublication.js'))
  ;({ default: WeddingDirectory } = await vite.ssrLoadModule('/src/components/WeddingDirectory.jsx'))
  template = await readFile(join(root, 'dist/static-city.html'), 'utf8')
  shellTemplate = await readFile(join(root, 'dist/index.html'), 'utf8')
  directory = await mkdtemp(join(root, 'tests/.dev-market-static-test-'))
  await chmod(directory, 0o755)
  site = join(directory, 'site')
  await cp(join(root, 'dist'), site, { recursive: true })
  await mkdir(join(site, 'storage-data'), { recursive: true })
  await writeFile(join(site, 'storage-data/paradise_settings.json'), JSON.stringify(fixture.settings))
  const phpPort = await freePort()
  const apachePort = await freePort()
  origin = `http://127.0.0.1:${apachePort}`
  const phpOutput = start('php', ['-d', 'post_max_size=16M', '-S', `127.0.0.1:${phpPort}`, '-t', site])
  await ready(`http://127.0.0.1:${phpPort}/static-city.html`, phpOutput)
  const configPath = join(directory, 'apache.conf')
  // The unprivileged Apache worker cannot traverse /root; its inherited cwd
  // gives access to this isolated fixture without changing ancestor permissions.
  const apacheSite = process.getuid() === 0 ? '/proc/self/cwd/site' : site
  await writeFile(configPath, `
ServerRoot "${directory}"
DefaultRuntimeDir "${directory}"
PidFile "${directory}/apache.pid"
Listen 127.0.0.1:${apachePort}
ServerName 127.0.0.1
LoadModule mpm_event_module /usr/lib/apache2/modules/mod_mpm_event.so
<IfModule !unixd_module>
LoadModule unixd_module /usr/lib/apache2/modules/mod_unixd.so
</IfModule>
LoadModule authz_core_module /usr/lib/apache2/modules/mod_authz_core.so
LoadModule authz_host_module /usr/lib/apache2/modules/mod_authz_host.so
LoadModule access_compat_module /usr/lib/apache2/modules/mod_access_compat.so
LoadModule dir_module /usr/lib/apache2/modules/mod_dir.so
LoadModule mime_module /usr/lib/apache2/modules/mod_mime.so
LoadModule rewrite_module /usr/lib/apache2/modules/mod_rewrite.so
LoadModule headers_module /usr/lib/apache2/modules/mod_headers.so
LoadModule proxy_module /usr/lib/apache2/modules/mod_proxy.so
LoadModule proxy_http_module /usr/lib/apache2/modules/mod_proxy_http.so
User #${process.getuid() === 0 ? 65534 : process.getuid()}
Group #${process.getuid() === 0 ? 65534 : process.getgid()}
ErrorLog "${directory}/apache-error.log"
TypesConfig /etc/mime.types
DocumentRoot "${apacheSite}"
<Directory "${apacheSite}">
  Require all granted
  AllowOverride All
</Directory>
ProxyPass /api/ http://127.0.0.1:${phpPort}/api/
`)
  const apacheOutput = start('apache2', ['-X', '-f', configPath], { cwd: directory })
  await ready(`${origin}/static-city.html`, async () =>
    `${apacheOutput()}\n${await readFile(join(directory, 'apache-error.log'), 'utf8').catch(() => '')}`)
})

after(async () => {
  for (const child of processes) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
  }
  await vite?.close()
  if (directory) await rm(directory, { recursive: true, force: true })
})

test('the snapshot includes public data only', () => {
  const snapshot = publication.makeCitySnapshot({ slug: 'meaux-77100', ...fixture })
  const json = JSON.stringify(snapshot)
  for (const privateValue of ['DO-NOT-PUBLISH-TOKEN', pin, 'PRIVATE-BANK-INFO', 'PRIVATE-DRAFT', 'INTERNAL-OTHER-CONTENT', 'LEGACY-OTHER-CONTENT']) {
    assert.ok(!json.includes(privateValue), privateValue)
  }
  assert.equal(snapshot.allTypePages.anniversaire['nanteuil-les-meaux-77100'], true)
  assert.equal(snapshot.blogArticles[0].slug, 'exemple')
  assert.throws(() => publication.makeCitySnapshot({ ...fixture, slug: '../escape' }), /invalide/)
  assert.throws(() => publication.makeCitySnapshot({ ...fixture, slug: 'ville-inconnue' }), /invalide/)
})

test('unsupported restored FAQ edits stop publication before any page write', async () => {
  const generated = generateWeddingPage({ slug: 'nanteuil-les-meaux-77100', seed: 12, travel })
  const changed = {
    ...generated,
    content: generated.content.replace('Peut-on apporter son propre traiteur ?', 'Une question sans réponse connue ?'),
  }
  assert.notEqual(changed.content, generated.content)
  const originalFetch = globalThis.fetch
  let writes = 0
  globalThis.fetch = async (input, options) => {
    if (options?.method === 'POST') writes++
    return originalFetch(new URL(input, origin), options)
  }
  try {
    await assert.rejects(publication.publishWeddingPages({
      ...fixture,
      pages: { 'meaux-77100': fixture.pages['meaux-77100'], 'nanteuil-les-meaux-77100': changed },
      origin,
      onProgress() {},
    }), /questions FAQ personnalisées/)
    assert.equal(writes, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('HTML has content, self-canonical, SEO and quote links before JavaScript', () => {
  const snapshot = publication.makeCitySnapshot({ slug: 'meaux-77100', ...fixture })
  const html = publication.renderCityDocument({ template, snapshot, settings: fixture.settings, origin })
  assert.match(html, /<h1[^>]*>Location salle de mariage près de Meaux/)
  assert.ok(html.includes('<title>Le Paradise 0184196949 | Salle de mariage Meaux 77100</title>'))
  const expectedDescription = 'Vous recherchez une salle de mariage à Meaux 77 ? Découvrez notre salle de réception a proximité de seine et marne, idéale pour célébrer votre mariage. Contactez-nous pour réserver une salle de mariage et obtenir un devis personnalisé à Meaux !'
  assert.ok(html.includes(`<meta name="description" content="${expectedDescription}" />`))
  assert.ok(html.includes(`<meta property="og:description" content="${expectedDescription}" />`))
  assert.ok(html.includes('<meta property="og:title" content="Le Paradise 0184196949 | Salle de mariage Meaux 77100" />'))
  assert.match(html, /Texte unique \$&amp; et &lt;script&gt;/)
  assert.ok(html.includes(`<link rel="canonical" href="${origin}/locationsalledemariage/meaux-77100"`))
  assert.match(html, /name="robots" content="index, follow/)
  assert.ok(!html.includes('noindex'))
  assert.match(html, /href="\/devis"/)
  assert.match(html, /id="devis"/)
  assert.match(html, /Coordonnées/)
  assert.equal((html.match(/<video\b/g) || []).length, 1)
  const video = html.match(/<video\b[^>]*>/)[0]
  assert.match(video, /poster="\/media\/hero-paradise.jpg"/)
  assert.match(video, /preload="none"/)
  assert.match(video, /muted/)
  assert.match(video, /playsInline|playsinline/)
  assert.ok(!/\ssrc=/.test(video))
  assert.match(html, /Lire la vidéo/)
  assert.match(html, /href="\/blog\/exemple"/)
  const data = html.match(/<script id="city-page-data" type="application\/json">([\s\S]*?)<\/script>/)[1]
  assert.deepEqual(JSON.parse(data), JSON.parse(JSON.stringify(snapshot)))
  assert.ok(!data.includes('<script>'))
  const seo = JSON.parse(html.match(/<script id="seo-json-ld" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  const venue = seo['@graph'].find((entry) => Array.isArray(entry['@type']) && entry['@type'].includes('EventVenue'))
  assert.equal(venue.address.addressLocality, 'Nanteuil-lès-Meaux')
  assert.equal(venue.address.postalCode, '77100')
  assert.ok(seo['@graph'].some((entry) => entry['@type'] === 'Service' && entry.areaServed.name === 'Meaux'))
  assert.match(html, /<details[^>]*>.*?<summary/s)
  assert.match(html, /Le tarif de location de/)
  assert.doesNotMatch(html, /à vol d’oiseau|Ce texte reprend un modèle fourni/)
  assert.ok(html.indexOf('id="devis"') < html.indexOf('id="intro"'))
  assert.match(html, /href="\/espace-client"/)
  assert.match(html, /href="\/espace-staff"/)
  assert.ok(!html.includes('key=${'))
  const directory = html.match(/<section class="wedding-directory"[\s\S]*?<\/section>/)[0]
  assert.match(directory, /Seine-et-Marne \(77\)/)
  assert.ok(directory.includes('href="/locationsalledemariage/meaux-77100" title="Location salle de mariage Meaux">Location salle de mariage Meaux</a>'))
  assert.ok(directory.includes('Location salle de mariage Nanteuil les Meaux'))
  assert.ok(!directory.includes('locationsalleanniversaire'))
  assert.ok(!directory.includes('/bobigny'))
  assert.ok(!/\balt=/.test(directory))
  assert.throws(() => publication.renderCityDocument({ template: '<div id="root"></div>', snapshot, settings: fixture.settings, origin }), /modèle statique/)
})

test('city pages render responsive official Instagram and TikTok embeds', () => {
  const snapshot = publication.makeCitySnapshot({
    slug: 'meaux-77100',
    ...fixture,
    config: {
      ...fixture.config,
      instagramPosts: ['https://www.instagram.com/reel/ABC123xyz/'],
      tiktokPosts: ['https://www.tiktok.com/@paradise/video/1234567890123456789'],
    },
  })
  const html = publication.renderCityDocument({ template, snapshot, settings: fixture.settings, origin })
  assert.match(html, /instagram\.com\/reel\/ABC123xyz\/embed/)
  assert.match(html, /tiktok\.com\/embed\/1234567890123456789/)
  assert.match(html, /border-radius:16px/)
  assert.match(html, /referrerPolicy="strict-origin-when-cross-origin"/)
  assert.match(html, /loading="lazy"/)
  assert.match(html, /Ouvrir cette publication sur Instagram/)
  const introduction = html.slice(html.indexOf('id="intro"'), html.indexOf('id="pourquoi"'))
  assert.match(introduction, /id="galerie"/)

  const invalidSnapshot = publication.makeCitySnapshot({
    slug: 'meaux-77100',
    ...fixture,
    config: { ...fixture.config, instagramPosts: ['javascript:alert(1)'] },
  })
  const invalidHtml = publication.renderCityDocument({ template, snapshot: invalidSnapshot, settings: fixture.settings, origin })
  assert.doesNotMatch(invalidHtml, /(?:src|href)="javascript:alert/)
  assert.match(invalidHtml, /Lien Instagram invalide/)
})

test('PHP rejects unauthenticated writes, traversal and malformed HTML', async () => {
  const post = (body, adminPin = pin) => fetch(`${origin}/api/static-publish.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin }, body: JSON.stringify(body),
  })
  assert.equal((await fetch(`${origin}/api/static-publish.php`)).status, 405)
  assert.equal((await post({ action: 'page', slug: 'meaux-77100', html: '' }, 'wrong')).status, 403)
  assert.equal((await post({ action: 'page', slug: '../escape', html: '' })).status, 400)
  assert.equal((await post({ action: 'page', slug: 'meaux-77100', html: '<html>bad</html>' })).status, 400)
  assert.equal((await post({ action: 'seo', sitemap: 'bad', robots: 'bad', expectedRegistryHash: 'missing', aliases: {} })).status, 400)
  assert.equal((await post({ action: 'inspect', slugs: ['meaux'] })).status, 409)
  assert.equal((await post({ action: 'page', slug: 'meaux-77100', html: 'x'.repeat(15 * 1024 * 1024) })).status, 413)
})

test('the former OpenAI endpoint is disabled even when deployed over an old site', async () => {
  const response = await fetch(origin + '/api/openai-generate.php', { method: 'POST' })
  assert.equal(response.status, 410)
  assert.match((await response.json()).error, /modèles locaux/)
})

test('publishes physical files at extensionless URLs and republishes safely', async () => {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
  const progress = []
  try {
    assert.deepEqual(await publication.publishWeddingPages({ ...fixture, origin, onProgress: (value) => progress.push(value) }), { total: 2, published: 2, unchanged: 0, upgraded: 0 })
    assert.equal(progress.at(-1).done, 2)
    for (const slug of Object.keys(fixture.pages)) {
      const response = await fetch(`/locationsalledemariage/${slug}`)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), /text\/html/)
      assert.equal(await response.text(), await readFile(join(site, 'locationsalledemariage', `${slug}.html`), 'utf8'))
      for (const suffix of ['.html', '/']) {
        const redirect = await fetch(`/locationsalledemariage/${slug}${suffix}`, { redirect: 'manual' })
        assert.equal(redirect.status, 301)
        assert.equal(redirect.headers.get('location'), `${origin}/locationsalledemariage/${slug}`)
      }
    }
    const sitemap = await (await fetch('/sitemap.xml')).text()
    assert.ok(sitemap.includes(`${origin}/locationsalledemariage/meaux-77100`))
    assert.ok(sitemap.includes('/locationsalleanniversaire/nanteuil-les-meaux-77100'))
    assert.ok(sitemap.includes('/blog/exemple'))
    assert.ok(!sitemap.includes('/blog/brouillon'))
    assert.ok(!sitemap.includes('/devis'))
    assert.ok(!sitemap.includes('/locationsalledemariage/bobigny-93000'))
    assert.ok((await (await fetch('/robots.txt')).text()).includes(`Sitemap: ${origin}/sitemap.xml`))
    assert.equal((await fetch('/storage-data/paradise_settings.json')).status, 403)
    const directory = await (await fetch('/wedding-directory.html')).text()
    const home = await (await fetch('/')).text()
    assert.ok(home.includes(directory), 'The directory must be in the initial homepage HTML')
    assert.ok(home.includes('id="public-wedding-directory"'))
    assert.match(home, /<title>Location salle de mariage à Nanteuil-lès-Meaux/)
    assert.ok(home.includes(`rel="canonical" href="${origin}/"`))
    assert.equal((home.match(/id="public-wedding-directory"/g) || []).length, 1)
    assert.deepEqual(await getPublishedWeddingSlugs(), ['meaux-77100', 'nanteuil-les-meaux-77100'])
    // Changing the source JSON must not change a published page until republication.
    await writeFile(join(site, 'storage-data/paradise_city_pages.json'), JSON.stringify({
      'meaux-77100': { content: 'SOURCE-CHANGED-NOT-YET-PUBLISHED', generatedAt: '2026-01-12T12:00:00Z', travel },
    }))
    assert.ok(!(await (await fetch('/locationsalledemariage/meaux-77100')).text()).includes('SOURCE-CHANGED-NOT-YET-PUBLISHED'))
    const changed = { ...fixture, pages: { ...fixture.pages, 'meaux-77100': { ...fixture.pages['meaux-77100'], content: 'Contenu republié et fixe.' } } }
    assert.deepEqual(await publication.publishWeddingPages({ ...changed, origin, onProgress() {} }), { total: 2, published: 1, unchanged: 1, upgraded: 0 })
    assert.match(await (await fetch('/locationsalledemariage/meaux-77100')).text(), /Contenu republié et fixe/)
    assert.match(await (await fetch('/locationsalledemariage/nanteuil-les-meaux-77100')).text(), /Une salle pour votre mariage/)
    assert.match(await (await fetch('/devis')).text(), /id="root"/)
    assert.match(await (await fetch('/locationsalleanniversaire/nanteuil-les-meaux-77100')).text(), /id="root"/)
    const updatedHome = await (await fetch('/')).text()
    assert.equal((updatedHome.match(/id="public-wedding-directory"/g) || []).length, 1)
    assert.equal((updatedHome.match(/rel="canonical"/g) || []).length, 1)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('publishes saved local templates with the same reviews and keeps legacy pages unchanged', async () => {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
  try {
    const savedPage = generateWeddingPage({ slug: 'meaux-77100', seed: 15, travel })
    const pages = { ...fixture.pages, 'meaux-77100': savedPage }
    const options = { ...fixture, pages, origin, onProgress() {} }
    await publication.publishWeddingPages(options)
    const html = await (await fetch('/locationsalledemariage/meaux-77100')).text()
    const snapshot = JSON.parse(html.match(/<script id="city-page-data" type="application\/json">([\s\S]*?)<\/script>/)[1])
    assert.equal(snapshot.page.content, savedPage.content)
    assert.deepEqual(snapshot.page.template.reviewIds, savedPage.template.reviewIds)
    assert.equal((html.match(/<blockquote/g) || []).length, 2)
    const legacy = await (await fetch('/locationsalledemariage/nanteuil-les-meaux-77100')).text()
    assert.ok(legacy.includes(fixture.pages['nanteuil-les-meaux-77100'].content))
    assert.ok(!legacy.includes('google-reviews-heading'))
    await publication.publishWeddingPages(options)
    assert.equal(await (await fetch('/locationsalledemariage/meaux-77100')).text(), html)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('publication registry returns no links before publication and rejects invalid content', async () => {
  const nativeFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('', { status: 404 })
    assert.deepEqual(await getPublishedWeddingSlugs(), [])
    globalThis.fetch = async () => new Response('<html></html>')
    await assert.rejects(getPublishedWeddingSlugs(), /invalide/)
    globalThis.fetch = async () => new Response('["ville-inconnue"]', { headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(getPublishedWeddingSlugs(), /invalide/)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('directory covers all IDF departments with exact text, title, order and unique URLs', () => {
  const slugs = ['meaux-77100', 'torcy-77200', 'mitry-mory-77290', 'paris-1er-75001', 'versailles-78000', 'evry-91000', 'nanterre-92000', 'bobigny-93000', 'creteil-94000', 'argenteuil-95100', 'meaux-77100', 'ville-inconnue']
  const html = renderToStaticMarkup(WeddingDirectory({ slugs }))
  for (const department of ['75', '77', '78', '91', '92', '93', '94', '95']) {
    assert.ok(html.includes(`(${department})`), department)
  }
  const links = [...html.matchAll(/<a href="\/locationsalledemariage\/([^"]+)" title="([^"]+)">([^<]+)<\/a>/g)]
  assert.equal(links.length, new Set(slugs).size - 1)
  assert.equal(new Set(links.map((link) => link[1])).size, links.length)
  for (const link of links) {
    assert.equal(link[2], link[3])
    assert.equal(link[2], `Location salle de mariage ${normalizeCityName(getCityBySlug(link[1]).name)}`)
  }
  assert.ok(html.indexOf('Location salle de mariage Meaux') < html.indexOf('Location salle de mariage Mitry Mory'))
  assert.ok(html.indexOf('Location salle de mariage Mitry Mory') < html.indexOf('Location salle de mariage Torcy'))
  assert.ok(!html.includes('ville-inconnue'))
  assert.ok(!html.includes('alt='))
  assert.equal(renderToStaticMarkup(WeddingDirectory({ slugs: [] })), '')
})

test('SEO uses unique local titles without moving the venue or indexing private pages', () => {
  const settings = { nom: 'Le Paradise', siteUrl: origin }
  const meaux = buildSeoData('/locationsalledemariage/meaux-77100', settings, fixture.pages, PAGE_TYPES_BY_ID.mariage, null, null, origin)
  const nanteuil = buildSeoData('/locationsalledemariage/nanteuil-les-meaux-77100', settings, fixture.pages, PAGE_TYPES_BY_ID.mariage, null, null, origin)
  assert.notEqual(meaux.title, nanteuil.title)
  assert.notEqual(meaux.description, nanteuil.description)
  assert.equal(meaux.title, 'Le Paradise 0184196949 | Salle de mariage Meaux 77100')
  assert.equal(meaux.description, 'Vous recherchez une salle de mariage à Meaux 77 ? Découvrez notre salle de réception a proximité de seine et marne, idéale pour célébrer votre mariage. Contactez-nous pour réserver une salle de mariage et obtenir un devis personnalisé à Meaux !')
  assert.equal(nanteuil.title, 'Le Paradise 0184196949 | Salle de mariage Nanteuil les Meaux 77100')
  assert.ok(meaux.imageUrl.endsWith('/media/hero-paradise.jpg'))
  for (const path of ['/', '/blog', '/blog/exemple', '/devis', '/mentions-legales', '/conditions-generales', '/politique-confidentialite', '/locationsalledemariage/meaux-77100', '/locationsalledereception/meaux-77100']) {
    assert.equal(isPublicPath(path), true, path)
    assert.doesNotThrow(() => buildSeoData(path, settings, fixture.pages, null, null, null, origin))
  }
  for (const path of ['/admin', '/dashboard', '/espace-client/exemple', '/espace-staff/exemple', '/not-found']) {
    assert.equal(isPublicPath(path), false, path)
    assert.match(buildSeoData(path, settings, {}, null, null, null, origin).robots, /noindex/)
  }
})

test('all wedding cities have a real postal code and punctuation-free metadata names', () => {
  for (const city of ALL_CITIES) {
    assert.match(city.postalCode, /^\d{5}$/, `${city.deptCode}/${city.slug}`)
    // Homonymous URLs keep the existing first-match city resolution.
    const resolved = getCityBySlug(city.slug)
    const pages = { [city.slug]: { content: 'Ancien contenu restauré.', seoTitle: 'Ancien titre', seoDescription: 'Ancienne description' } }
    const seo = buildSeoData(`/locationsalledemariage/${city.slug}`, fixture.settings, pages, PAGE_TYPES_BY_ID.mariage, null, null, origin)
    assert.match(seo.title, /^Le Paradise 0184196949 \| Salle de mariage [A-Za-z0-9 ]+ \d{5}$/)
    assert.ok(seo.title.endsWith(` ${resolved.postalCode}`))
    assert.equal((seo.description.match(/Vous recherchez/g) || []).length, 1)
    assert.ok(!seo.description.includes('{{'))
    assert.equal(seo.canonical, `${origin}/locationsalledemariage/${city.slug}`)
  }
  for (const [slug, name, postcode, department] of [
    ['paris-1er-75001', 'Paris 1er', '75001', 'paris'],
    ['versailles-78000', 'Versailles', '78000', 'yvelines'],
    ['evry-91000', 'Evry', '91000', 'essonne'],
    ['boulogne-billancourt-92100', 'Boulogne Billancourt', '92100', 'hauts de seine'],
    ['epinay-sur-seine-93800', 'Epinay sur Seine', '93800', 'seine saint denis'],
    ['hay-les-roses-94240', 'Hay les Roses', '94240', 'val de marne'],
    ['cergy-95000', 'Cergy', '95000', 'val d oise'],
  ]) {
    const seo = buildSeoData(`/locationsalledemariage/${slug}`, fixture.settings, { [slug]: { content: 'Contenu' } }, PAGE_TYPES_BY_ID.mariage, null, null, origin)
    assert.equal(seo.title, `Le Paradise 0184196949 | Salle de mariage ${name} ${postcode}`)
    assert.ok(seo.description.includes(`proximité de ${department},`))
  }
  const reception = buildSeoData('/locationsalledereception/nanteuil-les-meaux-77100', fixture.settings, fixture.pages, PAGE_TYPES_BY_ID.reception, null, null, origin)
  assert.equal(reception.title, `Salle de réception à Nanteuil-lès-Meaux — ${fixture.settings.nom}`)
})

test('publication reports API failures, incorrect routing and canonical domain mismatch', async () => {
  const nativeFetch = globalThis.fetch
  const options = { ...fixture, origin, onProgress() {} }
  try {
    await assert.rejects(publication.publishWeddingPages({ ...options, settings: { ...fixture.settings, siteUrl: 'https://wrong.example' } }), /domaine/)
    globalThis.fetch = async (url) => url === '/static-city.html'
      ? new Response(template)
      : url === '/'
        ? new Response(shellTemplate)
        : new Response(JSON.stringify({ error: 'Droits insuffisants' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(publication.publishWeddingPages(options), /Droits insuffisants/)
    globalThis.fetch = async (url, request) => url === '/static-city.html'
      ? new Response(template)
      : url === '/'
        ? new Response(shellTemplate)
        : url === '/api/static-publish.php'
          ? new Response(JSON.stringify(JSON.parse(request.body).action === 'inspect'
            ? { ok: true, registryHash: 'missing', publishedSlugs: [], pages: Object.fromEntries(Object.keys(fixture.pages).map((slug) => [slug, { fileHash: 'missing', fingerprint: null, sharedDirectory: false }])) }
            : { ok: true }), { headers: { 'Content-Type': 'application/json' } })
          : new Response('<div id="root"></div>')
    await assert.rejects(publication.publishWeddingPages(options), /ne sert pas le HTML publié/)
    let writes = 0
    globalThis.fetch = async (url) => {
      if (url === '/api/static-publish.php') writes++
      return new Response(url === '/static-city.html' ? template : '<html>ancien modèle</html>')
    }
    await assert.rejects(publication.publishWeddingPages(options), /index.html est incompatible/)
    assert.equal(writes, 0, 'An incompatible index must be rejected before any page is written')
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('video and poster are deployed once with fast-start MP4 and bounded sizes', async () => {
  const video = await readFile(join(root, 'dist/media/hero-paradise.mp4'))
  const poster = await readFile(join(root, 'dist/media/hero-paradise.jpg'))
  assert.ok(video.length < 5 * 1024 * 1024, 'Video must remain below 5 MiB')
  assert.ok(poster.length < 200 * 1024, 'Poster must remain below 200 KiB')
  assert.equal(poster.readUInt16BE(0), 0xffd8)
  const boxes = []
  for (let offset = 0; offset + 8 <= video.length;) {
    const size = video.readUInt32BE(offset)
    assert.ok(size >= 8)
    boxes.push(video.toString('ascii', offset + 4, offset + 8))
    offset += size
  }
  assert.ok(boxes.includes('moov') && boxes.includes('mdat'))
  assert.ok(boxes.indexOf('moov') < boxes.indexOf('mdat'), 'MP4 metadata must precede media for streaming')
  for (const [path, content] of [['hero-paradise.mp4', video], ['hero-paradise.jpg', poster]]) {
    const response = await fetch(`${origin}/media/${path}`)
    assert.equal(response.status, 200)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), content)
  }
})

async function testDepartments() {
  const { WEDDING_DEPARTMENTS, departmentPath } = await vite.ssrLoadModule('/src/utils/weddingDepartments.js')
  assert.equal(WEDDING_DEPARTMENTS.length, 16)
  const nativeFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = (url, options) => {
    if (url === '/api/static-publish.php') requests.push(JSON.parse(options.body))
    return nativeFetch(new URL(url, origin), options)
  }
  try {
    const pages = { ...fixture.pages }
    for (const department of WEDDING_DEPARTMENTS) {
      const city = department.cities.find((city) => getCityBySlug(city.slug)?.deptCode === department.code)
      assert.ok(city)
      pages[city.slug] = { content: `Présentation depuis ${city.name}`, generatedAt: '2026-01-01T00:00:00Z', travel }
    }
    const options = { ...fixture, pages, origin, onProgress() {} }
    await publication.publishWeddingPages(options)
    for (const department of WEDDING_DEPARTMENTS) {
      const path = departmentPath(department.code)
      const response = await fetch(path)
      assert.equal(response.status, 200)
      const html = await response.text()
      assert.equal(html, await readFile(join(site, `${path}.html`), 'utf8'))
      assert.ok(html.includes(`<link rel="canonical" href="${origin}${path}"`))
      assert.ok(html.includes(`Location salle de mariage — ${department.name}`.replaceAll('&', '&amp;')))
      const data = JSON.parse(html.match(/<script id="city-page-data" type="application\/json">([\s\S]*?)<\/script>/)[1])
      assert.equal(data.departmentCode, department.code)
      assert.ok(data.slugs.every((slug) => getCityBySlug(slug).deptCode === department.code))
      assert.ok(!html.includes(pin))
      const citySlug = Object.keys(pages).find((slug) => getCityBySlug(slug).deptCode === department.code)
      const cityHtml = await (await fetch(`/locationsalledemariage/${citySlug}`)).text()
      const directoryHtml = cityHtml.match(/<!-- CITY_DIRECTORY_START -->([\s\S]*?)<!-- CITY_DIRECTORY_END -->/)[1]
      const links = [...directoryHtml.matchAll(/href="\/locationsalledemariage\/([a-z0-9-]+)"/g)].map((match) => match[1])
      if (department.region !== 'Île-de-France') assert.ok(links.every((slug) => getCityBySlug(slug).deptCode === department.code))
      else assert.ok(links.includes('meaux-77100') && links.some((slug) => getCityBySlug(slug).deptCode === '02'))
      assert.ok(directoryHtml.includes(`href="${path}"`))
      assert.ok((await (await fetch('/sitemap.xml')).text()).includes(`${origin}${path}</loc>`))
      const redirected = await fetch(`${path}.html`, { redirect: 'manual' })
      assert.equal(redirected.status, 301)
    }
    assert.equal((await fetch('/locationsalledemariage/departements/99')).status, 404)
    const regionalDirectory = await (await fetch('/wedding-directory-idf.html')).text()
    for (const path of ['/blog', '/blog/prix-moyen-d-un-mariage-en-france-en-2025']) {
      const response = await fetch(path)
      assert.equal(response.status, 200)
      const html = await response.text()
      const footer = html.match(/<!-- WEDDING_DIRECTORY_START -->([\s\S]*?)<!-- WEDDING_DIRECTORY_END -->/)[1]
      assert.ok(footer.includes(regionalDirectory))
      assert.match(footer, /Zone de location de salle de mariage/)
      assert.match(footer, /href="\/locationsalledemariage\/departements\/77"/)
      const cityLinks = [...footer.matchAll(/href="\/locationsalledemariage\/([a-z0-9-]+)"/g)].map((match) => match[1])
      assert.ok(cityLinks.length > 0)
      assert.ok(cityLinks.every((slug) => ['75', '77', '78', '91', '92', '93', '94', '95'].includes(getCityBySlug(slug).deptCode)))
      for (const code of ['02', '27', '28', '45', '51', '60', '76', '89']) {
        assert.ok(!footer.includes(`/departements/${code}`))
      }
    }
    const home = await (await fetch('/')).text()
    assert.match(home, /href="\/locationsalledemariage\/departements\/02"/, 'Homepage retains its full directory')
    assert.deepEqual(await (await fetch('/wedding-departments.json')).json(), WEDDING_DEPARTMENTS.map(({ code }) => code))
    requests.length = 0
    await publication.publishWeddingPages(options)
    assert.equal(requests.filter(({ action }) => ['department', 'page', 'city-directory'].includes(action)).length, 0, 'No unchanged HTML is rewritten')
    assert.ok(requests.filter(({ action }) => action === 'inspect').every(({ inspectSlugs }) => Array.isArray(inspectSlugs) && inspectSlugs.length <= 25))
    const post = (body) => fetch('/api/static-publish.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin }, body: JSON.stringify(body),
    })
    const inspection = await (await post({ action: 'inspect', slugs: Object.keys(pages), aliases: {} })).json()
    const metadata = await (await post({ action: 'inspect', slugs: Object.keys(pages), aliases: {}, inspectSlugs: [] })).json()
    assert.equal(Object.keys(metadata.pages).length, 0)
    assert.equal(metadata.registryHash, inspection.registryHash)
    assert.deepEqual(metadata.publishedSlugs, inspection.publishedSlugs)
    const scoped = await (await post({ action: 'inspect', slugs: Object.keys(pages), aliases: {}, inspectSlugs: ['meaux-77100'] })).json()
    assert.deepEqual(Object.keys(scoped.pages), ['meaux-77100'])
    assert.deepEqual(scoped.pages['meaux-77100'], inspection.pages['meaux-77100'])
    assert.equal((await post({ action: 'inspect', slugs: Object.keys(pages), aliases: {}, inspectSlugs: Array(26).fill('meaux-77100') })).status, 400)
    assert.equal((await post({ action: 'inspect', slugs: Object.keys(pages), aliases: {}, inspectSlugs: ['ville-inconnue-75001'] })).status, 400)
    const html = await readFile(join(site, 'locationsalledemariage/departements/75.html'), 'utf8')
    assert.equal((await post({ action: 'department', code: '../75', html, expectedHash: 'missing' })).status, 400)
    assert.equal((await post({ action: 'department', code: '75', html, expectedHash: 'missing' })).status, 409)
    assert.equal((await post({ action: 'department', code: '75', html, expectedHash: inspection.departments['75'] })).status, 200)
    assert.equal(await readFile(join(site, 'locationsalledemariage/departements/75.html'), 'utf8'), html)
  } finally {
    globalThis.fetch = nativeFetch
  }
}

test('publication inspects bounded batches before writing and explains empty PHP responses', async () => {
  const nativeFetch = globalThis.fetch
  const slugs = ALL_CITIES.slice(0, 60).map((city) => city.slug)
  const legacyResponse = await nativeFetch(`${origin}/api/static-publish.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin },
    body: JSON.stringify({ action: 'inspect', slugs, aliases: {} }),
  })
  assert.equal(legacyResponse.status, 409)
  assert.match((await legacyResponse.json()).error, /ancienne version.*dist.*assets/)
  const pages = Object.fromEntries(slugs.map((slug) => [slug, { content: 'Page de test', generatedAt: '2026-01-01T00:00:00Z', travel }]))
  const calls = []
  let emptyResponse = false
  globalThis.fetch = async (url, options) => {
    if (url === '/static-city.html') return new Response(template)
    if (url === '/') return new Response(shellTemplate)
    if (url !== '/api/static-publish.php') throw new Error(`Unexpected fetch ${url}`)
    const payload = JSON.parse(options.body)
    calls.push(payload)
    if (emptyResponse) return new Response('', { status: 500, headers: { 'Content-Type': 'application/json' } })
    if (payload.action !== 'inspect') return new Response(JSON.stringify({ error: 'Stop after inspection' }), { status: 409 })
    return new Response(JSON.stringify({
      ok: true, pages: Object.fromEntries(payload.inspectSlugs.map((slug) => [slug, { fileHash: 'missing', fingerprint: null, directoryHash: null }])),
      departments: {}, publishedSlugs: [], registryHash: 'missing',
    }))
  }
  try {
    await assert.rejects(publication.publishWeddingPages({ ...fixture, pages, origin, onProgress() {} }), /Stop after inspection/)
    assert.deepEqual(calls.filter(({ action }) => action === 'inspect').map(({ inspectSlugs }) => inspectSlugs.length), [0, 25, 25, 10])
    assert.deepEqual(calls.filter(({ action }) => action === 'inspect').flatMap(({ inspectSlugs }) => inspectSlugs), slugs)
    assert.equal(calls[4].action, 'page')
    calls.length = 0
    emptyResponse = true
    await assert.rejects(publication.publishWeddingPages({ ...fixture, pages, origin, onProgress() {} }), /réponse vide.*static-publish\.php.*inspect.*HTTP 500/)
    assert.equal(calls.length, 1)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('publication migrates legacy directories and writes updated city links into HTML', async () => {
  const nativeFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = (url, options) => {
    if (url === '/api/static-publish.php') requests.push(JSON.parse(options.body))
    return nativeFetch(new URL(url, origin), options)
  }
  try {
    const options = { ...fixture, origin, onProgress() {} }
    await publication.publishWeddingPages(options)
    const file = join(site, 'locationsalledemariage', 'meaux-77100.html')
    const original = await readFile(file, 'utf8')
    assert.match(original, /<!-- CITY_DIRECTORY_START -->/)
    const block = original.match(/<!-- CITY_DIRECTORY_START -->([\s\S]*?)<!-- CITY_DIRECTORY_END -->/)[0]
    const legacyDirectory = block.replace('<!-- CITY_DIRECTORY_START -->', '').replace('<!-- CITY_DIRECTORY_END -->', '')
    const rootEnd = original.lastIndexOf('</div>', original.indexOf('<!-- CITY_DIRECTORY_START -->'))
    assert.ok(rootEnd > original.indexOf('<div id="root">'))
    const legacy = (original.slice(0, rootEnd) + legacyDirectory + original.slice(rootEnd))
      .replace(block, '')
      .replace('</body>', '<script defer src="/shared-wedding-directory-v1.js"></script>\n</body>')
    assert.notEqual(legacy, original)
    await writeFile(file, legacy)
    requests.length = 0
    const upgrade = await publication.publishWeddingPages(options)
    assert.equal(upgrade.upgraded, 0)
    assert.equal(upgrade.published, 1)
    const migrated = await readFile(file, 'utf8')
    assert.match(migrated, /<!-- CITY_DIRECTORY_START -->/)
    assert.doesNotMatch(migrated, /legacy-wedding-directory-style/)
    assert.doesNotMatch(migrated, /shared-wedding-directory-v1\.js/)
    assert.equal(requests.filter((request) => request.action === 'city-directory').length, 0)
    assert.equal(requests.filter((request) => request.action === 'page').length, 1)

    const withNewCity = { ...fixture.pages, 'bobigny-93000': { content: 'Nouvelle page Bobigny', generatedAt: '2026-02-01T12:00:00Z', travel } }
    requests.length = 0
    const addition = await publication.publishWeddingPages({ ...options, pages: withNewCity })
    assert.deepEqual(addition, { total: 3, published: 3, unchanged: 0, upgraded: 0 })
    const withDirectory = await readFile(file, 'utf8')
    const visibleDirectory = withDirectory.match(/<!-- CITY_DIRECTORY_START -->([\s\S]*?)<!-- CITY_DIRECTORY_END -->/)[1]
    assert.match(visibleDirectory, /href="\/locationsalledemariage\/bobigny-93000"/)
    assert.match(visibleDirectory, /Location salle de mariage près de Meaux/)
    assert.notEqual(withDirectory, migrated)
    assert.match(withDirectory, /Texte unique \$&amp; et &lt;script&gt;/)
    assert.equal(requests.filter((request) => request.action === 'city-directory').length, 0, 'Each generated file already contains the final footer')
    assert.deepEqual(requests.filter((request) => request.action === 'page').map((request) => request.slug).sort(), ['bobigny-93000', 'meaux-77100', 'nanteuil-les-meaux-77100'])
    assert.match(await (await fetch('/wedding-directory.html')).text(), /locationsalledemariage\/bobigny-93000/)
    assert.doesNotMatch(original, /href="\/locationsalledemariage\/bobigny-93000"/)
    assert.match(await (await fetch('/locationsalledemariage/meaux-77100')).text(), /<!-- CITY_DIRECTORY_START -->[\s\S]*href="\/locationsalledemariage\/bobigny-93000"/)
    assert.match(await readFile(join(site, 'locationsalledemariage', 'bobigny-93000.html'), 'utf8'), /Location salle de mariage près de Bobigny/)

    requests.length = 0
    const subset = await publication.publishWeddingPages({ ...options, pages: { 'meaux-77100': fixture.pages['meaux-77100'] } })
    assert.deepEqual(subset, { total: 3, published: 0, unchanged: 3, upgraded: 0 })
    assert.equal(await readFile(file, 'utf8'), withDirectory)
    assert.deepEqual(requests.filter((request) => request.action === 'page' || request.action === 'city-directory'), [])
    assert.match(await (await fetch('/sitemap.xml')).text(), /locationsalledemariage\/bobigny-93000/)
    assert.match(await (await fetch('/wedding-directory.html')).text(), /locationsalledemariage\/nanteuil-les-meaux-77100/)

    requests.length = 0
    const forced = await publication.publishWeddingPages({ ...options, pages: { 'meaux-77100': fixture.pages['meaux-77100'] }, updateTemplate: true })
    assert.deepEqual(forced, { total: 3, published: 1, unchanged: 2, upgraded: 0 })
    assert.deepEqual(requests.filter((request) => request.action === 'page').map((request) => request.slug), ['meaux-77100'])
    const updated = await readFile(file, 'utf8')
    assert.match(updated, /<h2 id="wedding-directory-heading">Location salle de mariage près de Meaux<\/h2>/)

    const post = (body) => fetch('/api/static-publish.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin }, body: JSON.stringify(body),
    })

    const race = await post({ action: 'city-directory', slug: 'meaux-77100', directory: visibleDirectory, styles: '.wedding-directory{}', expectedHash: '0'.repeat(64) })
    assert.equal(race.status, 409)
    assert.equal(await readFile(file, 'utf8'), updated)
    const oldClient = await post({ action: 'page', slug: 'meaux-77100', html: updated })
    assert.equal(oldClient.status, 409)
    const conflict = await post({ action: 'page', slug: 'meaux-77100', html: updated, expectedHash: '0'.repeat(64) })
    assert.equal(conflict.status, 409)
    assert.equal(await readFile(file, 'utf8'), updated)

    const compatibleLegacy = updated.replace('<script id="city-page-data" type="application/json">',
      "<script type='application/json' data-publication='legacy' id = 'city-page-data'>")
    await writeFile(file, compatibleLegacy)
    const compatibleInspection = await post({ action: 'inspect', slugs: ['meaux-77100'], aliases: {} })
    assert.equal(compatibleInspection.status, 200, 'Attribute order, quotes and spacing in old HTML must be recognized')
    assert.equal(await readFile(file, 'utf8'), compatibleLegacy, 'Inspection never changes the file')
    await publication.publishWeddingPages({ ...options, pages: { 'meaux-77100': fixture.pages['meaux-77100'] } })
    assert.equal(await readFile(file, 'utf8'), updated, 'Unified publication upgrades the old markup')

    requests.length = 0
    globalThis.fetch = (url, fetchOptions) => {
      if (url === '/static-city.html') {
        return Promise.resolve(new Response(template.replace('</body>', '<!-- new-site-model --></body>'),
          { headers: { 'Content-Type': 'text/html' } }))
      }
      if (url === '/api/static-publish.php') requests.push(JSON.parse(fetchOptions.body))
      return nativeFetch(new URL(url, origin), fetchOptions)
    }
    const modelUpgrade = await publication.publishWeddingPages({
      ...options, pages: { 'meaux-77100': fixture.pages['meaux-77100'] },
    })
    assert.equal(modelUpgrade.published, 1, 'Normal publication must apply changed template assets without a second button')
    assert.match(await readFile(file, 'utf8'), /new-site-model/)
    globalThis.fetch = (url, fetchOptions) => {
      if (url === '/api/static-publish.php') requests.push(JSON.parse(fetchOptions.body))
      return nativeFetch(new URL(url, origin), fetchOptions)
    }
    await publication.publishWeddingPages({ ...options, pages: { 'meaux-77100': fixture.pages['meaux-77100'] } })
    assert.equal(await readFile(file, 'utf8'), updated)

    const optionalLegacy = updated.replace(/(<script id="city-page-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
      (_match, open, json, close) => {
        const snapshot = JSON.parse(json)
        snapshot.gallery = null
        delete snapshot.blogArticles
        return `${open}${JSON.stringify(snapshot).replaceAll('<', '\\u003c')}${close}`
      })
    await writeFile(file, optionalLegacy)
    assert.equal((await post({ action: 'inspect', slugs: ['meaux-77100'], aliases: {} })).status, 200,
      'Null or omitted optional collections must not reject otherwise recognized publication data')
    await writeFile(file, updated)

    const corrupt = updated.replace(/(<script id="city-page-data" type="application\/json">)[\s\S]*?(<\/script>)/,
      '$1{"broken":true}$2')
    await writeFile(file, corrupt)
    const rejected = await post({ action: 'inspect', slugs: ['meaux-77100'], aliases: {} })
    assert.equal(rejected.status, 409, 'Truly unknown data must still stop publication')
    assert.equal(await readFile(file, 'utf8'), corrupt)
    await writeFile(file, updated)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('incremental PHP storage saves bounded requests and backs up large collections on the server', async () => {
  const nativeFetch = globalThis.fetch
  const key = 'paradise_city_pages_reception'
  const path = join(site, 'storage-data', `${key}.json`)
  const backupPath = join(site, 'storage-data', 'paradise_city_pages_backup_reception.json')
  const existing = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [
    `city-${index}`, { content: 'Texte conservé. '.repeat(1100), generatedAt: '2026-01-01T00:00:00Z', travel },
  ]))
  const sizes = []
  await writeFile(path, JSON.stringify(existing))
  assert.ok(Buffer.byteLength(JSON.stringify(existing)) > 1024 * 1024)
  globalThis.fetch = (url, options) => {
    if (options?.method === 'POST') {
      sizes.push(Buffer.byteLength(options.body))
      if (sizes.at(-1) > 128 * 1024) return Promise.resolve(new Response('Request too large', { status: 413 }))
    }
    return nativeFetch(new URL(url, origin), options)
  }
  try {
    const { makePageTypeStorage } = await vite.ssrLoadModule('/src/utils/cityPageStorage.js')
    const api = makePageTypeStorage('reception')
    const page = { content: 'Page ajoutée', generatedAt: '2026-02-01T00:00:00Z', template: { version: 1, seed: 42 } }
    const vauxPage = generateWeddingPage({ slug: 'vaux-sur-lunain-77710', seed: 42, travel })
    await api.backupPages({ requireServer: true })
    await api.savePage('meaux-77100', page)
    await api.savePage('vaux-sur-lunain-77710', vauxPage)
    assert.ok(sizes.every((size) => size < 128 * 1024), 'Neither saving nor backing up may upload the full collection')
    const saved = JSON.parse(await readFile(path, 'utf8'))
    assert.deepEqual(saved, { ...existing, 'meaux-77100': page, 'vaux-sur-lunain-77710': vauxPage })
    const backups = JSON.parse(await readFile(backupPath, 'utf8'))
    assert.deepEqual(backups[0].snapshot, existing)
    for (let i = 0; i < 5; i++) await api.backupPages({ requireServer: true })
    assert.equal(JSON.parse(await readFile(backupPath, 'utf8')).length, 5)
    await assert.rejects(api.savePage('../invalid', page), /HTTP 400/)
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), saved)
    await writeFile(path, '{invalid JSON')
    await assert.rejects(api.savePage('meaux-77100', page), /HTTP 409.*Aucun fichier/)
    assert.equal(await readFile(path, 'utf8'), '{invalid JSON')
    await assert.rejects(api.backupPages({ requireServer: true }), /HTTP 409/)
    assert.equal(JSON.parse(await readFile(backupPath, 'utf8')).length, 5)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('all sixteen departments publish real HTML pages and regional directories remain scoped', testDepartments)

test('postcode identities preserve homonymous towns and migrate historical URLs without deletion', async () => {
  const { canonicalCityPages, ungeneratedCitySlugs, legacyCityAliases } = await vite.ssrLoadModule('/src/utils/cityPageIdentity.js')
  const { DEPARTMENTS } = await vite.ssrLoadModule('/src/data/idf-cities.js')
  assert.equal(new Set(ALL_CITIES.map((city) => city.slug)).size, ALL_CITIES.length)
  assert.ok(ALL_CITIES.every((city) => city.slug.endsWith(`-${city.postalCode}`)))
  assert.equal(getCityBySlug('villeroy-77410').deptCode, '77')
  assert.equal(getCityBySlug('villeroy-89100').deptCode, '89')
  assert.equal(getCityBySlug('villeroy').slug, 'villeroy-77410', 'Historical lookup keeps its original department')
  const oldPage = { content: 'Ancien texte conservé', generatedAt: '2026-01-01T00:00:00Z', travel }
  const secondPage = { ...oldPage, content: 'Texte Yonne distinct' }
  assert.deepEqual(canonicalCityPages({ villeroy: oldPage, 'villeroy-89100': secondPage }), {
    'villeroy-77410': oldPage, 'villeroy-89100': secondPage,
  })
  const taggedPage = { ...secondPage, city: { slug: 'villeroy-89100' } }
  assert.deepEqual(canonicalCityPages({ villeroy: taggedPage }), { 'villeroy-89100': taggedPage })
  assert.deepEqual(canonicalCityPages({ villeroy: oldPage, 'villeroy-77410': secondPage }), { 'villeroy-77410': secondPage })
  const department = DEPARTMENTS.find(({ code }) => code === '77')
  const missing = ungeneratedCitySlugs(department, { meaux: oldPage, villeroy: oldPage })
  assert.ok(!missing.includes('meaux-77100') && !missing.includes('villeroy-77410'))
  assert.ok(missing.includes('chessy-77700'))
  assert.ok(!missing.includes('villeroy-89100'))
  const nativeFetch = globalThis.fetch
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
  try {
    const { makePageTypeStorage } = await vite.ssrLoadModule('/src/utils/cityPageStorage.js')
    const api = makePageTypeStorage('anniversaire')
    const storagePath = join(site, 'storage-data/paradise_city_pages_anniversaire.json')
    await writeFile(storagePath, JSON.stringify({ villeroy: oldPage }))
    await api.migratePageKeys()
    await api.savePage('villeroy-89100', secondPage)
    const stored = JSON.parse(await readFile(storagePath, 'utf8'))
    assert.deepEqual(stored, { 'villeroy-77410': oldPage, 'villeroy-89100': secondPage })
    const backups = await api.getBackups()
    assert.deepEqual(backups[0].snapshot.villeroy, oldPage)

    const snapshot = publication.makeCitySnapshot({ ...fixture, slug: 'villeroy-77410', pages: { 'villeroy-77410': oldPage } })
    const canonicalHtml = publication.renderCityDocument({ template, snapshot, settings: fixture.settings, origin })
    const oldHtml = canonicalHtml.replaceAll('villeroy-77410', 'villeroy')
    await writeFile(join(site, 'locationsalledemariage/villeroy.html'), oldHtml)
    const registryPath = join(site, 'wedding-pages.json')
    const registry = JSON.parse(await readFile(registryPath, 'utf8'))
    await writeFile(registryPath, JSON.stringify([...registry, 'villeroy']))
    // Simulate a restored backup that omits this already-published city.
    await publication.publishWeddingPages({ ...fixture, origin, onProgress() {} })
    const migrated = await readFile(join(site, 'locationsalledemariage/villeroy-77410.html'), 'utf8')
    assert.ok(migrated.includes(oldPage.content))
    assert.ok(migrated.includes(`<link rel="canonical" href="${origin}/locationsalledemariage/villeroy-77410"`))
    assert.equal(await readFile(join(site, 'locationsalledemariage/villeroy.html'), 'utf8'), oldHtml)
    const redirect = await fetch('/locationsalledemariage/villeroy', { redirect: 'manual' })
    assert.equal(redirect.status, 301)
    assert.ok(redirect.headers.get('location').endsWith('/locationsalledemariage/villeroy-77410'))
    for (const type of Object.values(PAGE_TYPES_BY_ID)) {
      for (const suffix of ['', '.html', '/']) {
        const response = await fetch(`${type.basePath}/villeroy${suffix}`, { redirect: 'manual' })
        assert.equal(response.status, 301)
        assert.ok(response.headers.get('location').endsWith(`${type.basePath}/villeroy-77410`))
      }
    }
    assert.equal((await fetch('/locationsalledemariage/villeroy-77410')).status, 200)
    assert.ok(!(await (await fetch('/sitemap.xml')).text()).includes(`${origin}/locationsalledemariage/villeroy</loc>`))
    assert.deepEqual(JSON.parse(await readFile(join(site, 'wedding-city-aliases.json'), 'utf8')).villeroy, legacyCityAliases.villeroy)
    await publication.publishWeddingPages({ ...fixture, pages: { ...fixture.pages, 'villeroy-89100': secondPage }, origin, onProgress() {} })
    assert.ok((await (await fetch('/locationsalledemariage/villeroy-89100')).text()).includes(secondPage.content))
    assert.ok((await (await fetch('/locationsalledemariage/villeroy-77410')).text()).includes(oldPage.content))
    const preserved = await readFile(join(site, 'locationsalledemariage/villeroy-77410.html'), 'utf8')
    await publication.publishWeddingPages({ ...fixture, pages: { ...fixture.pages, 'villeroy-89100': secondPage }, origin, onProgress() {} })
    assert.equal(await readFile(join(site, 'locationsalledemariage/villeroy-77410.html'), 'utf8'), preserved)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('maintenance gates static pages and APIs, renamed administration stays accessible, and purges persist', async () => {
  const request = async (path, data, cookie) => {
    const csrf = path === '/api/site-admin.php' && cookie && data && data.action !== 'login'
      ? (await (await fetch(new URL(path, origin), { headers: { Cookie: cookie } })).json()).csrf : ''
    return fetch(new URL(path, origin), {
    ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}),
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-Admin-CSRF': csrf } : {}) },
    redirect: 'manual',
  })
  }
  assert.equal((await request('/api/site-admin.php')).status, 403)
  assert.equal((await request('/api/data-purge.php', { type: 'all', confirmation: 'PURGER' })).status, 403)
  const publicSettings = await (await request('/api/storage.php?key=paradise_settings')).json()
  assert.ok(!Object.hasOwn(publicSettings, 'pin'))
  assert.equal((await request('/api/storage.php?key=paradise_settings', { pin: 'changed' })).status, 403)
  const login = await request('/api/site-admin.php', { action: 'login', pin })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  assert.equal((await request('/api/site-admin.php', { action: 'save', adminSlug: '../invalid' }, cookie)).status, 400)
  const renamed = await request('/api/site-admin.php', { action: 'save', adminSlug: 'gestion-paradise-test' }, cookie)
  assert.equal(renamed.status, 200)
  assert.equal((await request('/admin')).status, 404)
  assert.equal((await request('/dashboard')).status, 404)
  const customLogin = await request('/gestion-paradise-test')
  assert.equal(customLogin.status, 200)
  assert.ok((await customLogin.text()).includes('"dashboard":"/gestion-paradise-test/dashboard"'))
  assert.ok(!(await (await request('/')).text()).includes('gestion-paradise-test'))
  assert.equal((await request('/api/site-admin.php', { action: 'save', maintenance: true }, cookie)).status, 200)
  assert.equal((await request('/')).status, 200)
  for (const path of ['/blog', '/devis', '/locationsalledemariage/meaux-77100', '/locationsalledemariage/meaux-77100.html', '/locationsalledemariage/departements/77', '/sitemap.xml']) {
    const blocked = await request(path)
    assert.equal(blocked.status, 503, path)
    assert.equal(blocked.headers.get('retry-after'), '3600')
  }
  assert.equal((await request('/gestion-paradise-test/dashboard', null, cookie)).status, 200)
  assert.equal((await request('/api/storage.php?key=paradise_clients')).status, 503)
  assert.equal((await request('/api/storage.php?key=paradise_clients', null, cookie)).status, 200)
  assert.equal((await request('/api/storage.php?key=paradise_settings')).status, 200)
  assert.equal((await request('/api/site-admin.php', { action: 'save', maintenance: false }, cookie)).status, 200)
  assert.equal((await request('/locationsalledemariage/meaux-77100')).status, 200)

  const json = async (key) => JSON.parse(await readFile(join(site, `storage-data/${key}.json`), 'utf8'))
  const store = async (key, value) => writeFile(join(site, `storage-data/${key}.json`), JSON.stringify(value))
  const client = { id: 'test', nom: 'Conservé', dateEvenement: '2027-05-15', status: 'validé_admin',
    payments: [{ montant: 100 }], paymentReceipts: [{ id: 'receipt' }], assignedStaff: ['staff'] }
  await store('paradise_clients', [client])
  await store('paradise_receipts_test', { receipt: 'private' })
  await store('paradise_cal_manual_events', [{ id: 'event' }])
  const purge = (type, confirmation = 'PURGER') => request('/api/data-purge.php', { type, confirmation }, cookie)
  assert.equal((await purge('all', 'incorrect')).status, 400)
  assert.equal((await purge('compta')).status, 200)
  const accountant = (await json('paradise_clients'))[0]
  assert.equal(accountant.nom, client.nom)
  assert.equal(accountant.dateEvenement, client.dateEvenement)
  assert.deepEqual(accountant.payments, [])
  assert.deepEqual(accountant.paymentReceipts, [])
  assert.equal(accountant.accountingExcluded, true)
  assert.deepEqual(await json('paradise_receipts_test'), {})
  assert.equal((await purge('calendar')).status, 200)
  assert.equal((await json('paradise_clients'))[0].calendarExcluded, true)
  assert.equal((await json('paradise_clients'))[0].dateEvenement, client.dateEvenement)
  assert.deepEqual(await json('paradise_cal_manual_events'), [])
  const { default: ComptabiliteTab } = await vite.ssrLoadModule('/src/components/Dashboard/tabs/ComptabiliteTab.jsx')
  const { default: CalendarTab } = await vite.ssrLoadModule('/src/components/Dashboard/tabs/CalendarTab.jsx')
  const storage = await vite.ssrLoadModule('/src/utils/storage.js')
  const nativeFetch = globalThis.fetch
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), { ...options, headers: { ...options?.headers, Cookie: cookie } })
  try {
    await storage.initStorage({ names: ['clients', 'calOverrides', 'calStaff', 'calManualEvents', 'staff', 'ingredients', 'matieresPremieresRecettes'], reload: true, persistDefaults: false, paced: false })
    assert.ok(!renderToStaticMarkup(createElement(ComptabiliteTab)).includes('Conservé'))
    assert.ok(!renderToStaticMarkup(createElement(CalendarTab)).includes('Conservé'))
  } finally { globalThis.fetch = nativeFetch }
  for (const [type, keys] of [
    ['staff', ['paradise_staff']], ['stock', ['paradise_stock_sec', 'paradise_stock_matiere', 'paradise_stock_boisson']],
    ['matieres', ['paradise_ingredients', 'paradise_matieres_recettes']], ['formules', ['paradise_formules']],
    ['menus', ['paradise_menus']], ['gateaux', ['paradise_gateaux']], ['prestations', ['paradise_prestations']],
  ]) {
    for (const key of keys) await store(key, [{ id: 'delete-me' }])
    assert.equal((await purge(type)).status, 200, type)
    for (const key of keys) assert.deepEqual(await json(key), [])
    assert.equal((await json('paradise_clients'))[0].nom, client.nom)
  }
  await store('paradise_city_pages', fixture.pages)
  await store('paradise_city_pages_backup', [{ snapshot: fixture.pages }])
  assert.equal((await purge('pages-mariage')).status, 200)
  assert.deepEqual(await json('paradise_city_pages'), {})
  assert.deepEqual(await json('paradise_city_pages_backup'), [])
  assert.equal((await request('/locationsalledemariage/meaux-77100')).status, 404)
  assert.equal((await request('/locationsalledemariage/meaux-77100.html')).status, 404)
  assert.equal((await request('/locationsalledemariage/villeroy')).status, 404)
  assert.equal((await request('/locationsalledemariage/departements/77')).status, 404)
  assert.ok(!(await (await request('/sitemap.xml')).text()).includes('/locationsalledemariage/'))
  assert.ok(!(await (await request('/')).text()).includes('/locationsalledemariage/meaux-77100'))
  await mkdir(join(site, 'storage-data/quote-followups'), { recursive: true })
  await writeFile(join(site, 'storage-data/quote-followups/flow-test.json'), '{}')
  await store('paradise_docs_test', { document: 'private' })
  await store('paradise_blog_articles', fixture.blogArticles)
  await store('paradise_blog_backup', [{ articles: fixture.blogArticles }])
  assert.equal((await purge('all')).status, 200)
  assert.deepEqual(await json('paradise_clients'), [])
  assert.deepEqual(await json('paradise_docs_test'), {})
  assert.deepEqual(await json('paradise_blog_articles'), {})
  assert.deepEqual(await json('paradise_blog_backup'), [])
  assert.deepEqual(await json('paradise_settings'), fixture.settings)
  assert.equal((await json('site-controls')).adminSlug, 'gestion-paradise-test')
  assert.equal((await request('/api/site-admin.php', null, cookie)).status, 200)
  assert.equal((await request('/')).status, 200)
  const newSettings = { ...fixture.settings, pin: 'changed-test-pin' }
  assert.equal((await request('/api/storage.php?key=paradise_settings', newSettings, cookie)).status, 200)
  assert.equal((await request('/api/site-admin.php', null, cookie)).status, 200, 'Changing PIN retains the authenticated session')
  assert.equal((await request('/api/site-admin.php', { action: 'logout' }, cookie)).status, 200)
  assert.equal((await request('/api/site-admin.php', null, cookie)).status, 403)
  for (let count = 0; count < 3; count++) {
    assert.equal((await request('/api/site-admin.php', { action: 'login', pin: 'incorrect' })).status, 403)
  }
  const throttled = await request('/api/site-admin.php', { action: 'login', pin: newSettings.pin })
  assert.equal(throttled.status, 429)
  assert.equal(throttled.headers.get('X-RateLimit-Scope'), 'admin-login')
})
