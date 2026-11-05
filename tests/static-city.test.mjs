import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'vite'
import { mkdtemp, cp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer as createTcpServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const root = resolve(import.meta.dirname, '..')
let vite, publication, directory, site, origin, template
const processes = []
const pin = 'publication-test-pin'
const fixture = {
  pages: {
    meaux: { content: '## Mariage à Meaux\nTexte unique $& et <script>non exécuté</script>.', generatedAt: '2026-01-10T12:00:00Z' },
    'nanteuil-les-meaux': { content: 'Une salle pour votre mariage à Nanteuil.', generatedAt: '2026-01-11T12:00:00Z' },
  },
  config: { businessName: 'Salle de test & mariage', githubToken: 'DO-NOT-PUBLISH-TOKEN', instagramPosts: [], tiktokPosts: [] },
  gallery: [],
  allTypePages: {
    mariage: { meaux: { content: 'INTERNAL-OTHER-CONTENT' }, 'nanteuil-les-meaux': { content: 'INTERNAL-OTHER-CONTENT' } },
    anniversaire: { 'nanteuil-les-meaux': { content: 'LEGACY-OTHER-CONTENT' } },
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

function start(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
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
  assert.fail(`Server did not start: ${output()}`)
}

before(async () => {
  vite = await createServer({ root, server: { middlewareMode: true } })
  publication = await vite.ssrLoadModule('/src/utils/staticCityPublication.jsx')
  template = await readFile(join(root, 'dist/static-city.html'), 'utf8')
  directory = await mkdtemp(join(tmpdir(), 'dev-market-static-test-'))
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
DocumentRoot "${site}"
<Directory "${site}">
  Require all granted
  AllowOverride All
</Directory>
ProxyPass /api/ http://127.0.0.1:${phpPort}/api/
`)
  const apacheOutput = start('apache2', ['-X', '-f', configPath])
  await ready(`${origin}/static-city.html`, apacheOutput)
})

after(async () => {
  for (const child of processes) {
    if (child.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
  }
  await vite?.close()
  if (directory) await rm(directory, { recursive: true, force: true })
})

test('the snapshot includes public data only', () => {
  const snapshot = publication.makeCitySnapshot({ slug: 'meaux', ...fixture })
  const json = JSON.stringify(snapshot)
  for (const privateValue of ['DO-NOT-PUBLISH-TOKEN', pin, 'PRIVATE-BANK-INFO', 'PRIVATE-DRAFT', 'INTERNAL-OTHER-CONTENT', 'LEGACY-OTHER-CONTENT']) {
    assert.ok(!json.includes(privateValue), privateValue)
  }
  assert.equal(snapshot.allTypePages.anniversaire['nanteuil-les-meaux'], true)
  assert.equal(snapshot.blogArticles[0].slug, 'exemple')
  assert.throws(() => publication.makeCitySnapshot({ ...fixture, slug: '../escape' }), /invalide/)
  assert.throws(() => publication.makeCitySnapshot({ ...fixture, slug: 'ville-inconnue' }), /invalide/)
})

test('HTML has content, self-canonical, SEO and quote links before JavaScript', () => {
  const snapshot = publication.makeCitySnapshot({ slug: 'meaux', ...fixture })
  const html = publication.renderCityDocument({ template, snapshot, settings: fixture.settings, origin })
  assert.match(html, /<h1[^>]*>Salle de mariage/)
  assert.match(html, /Texte unique \$&amp; et &lt;script&gt;/)
  assert.ok(html.includes(`<link rel="canonical" href="${origin}/locationsalledemariage/meaux"`))
  assert.match(html, /name="robots" content="index, follow/)
  assert.ok(!html.includes('noindex'))
  assert.match(html, /href="\/devis"/)
  assert.match(html, /id="devis"/)
  assert.match(html, /Coordonnées/)
  assert.match(html, /href="\/blog\/exemple"/)
  const data = html.match(/<script id="city-page-data" type="application\/json">([\s\S]*?)<\/script>/)[1]
  assert.deepEqual(JSON.parse(data), JSON.parse(JSON.stringify(snapshot)))
  assert.ok(!data.includes('<script>'))
  assert.doesNotThrow(() => JSON.parse(html.match(/<script id="seo-json-ld" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]))
  assert.throws(() => publication.renderCityDocument({ template: '<div id="root"></div>', snapshot, settings: fixture.settings, origin }), /modèle statique/)
})

test('PHP rejects unauthenticated writes, traversal and malformed HTML', async () => {
  const post = (body, adminPin = pin) => fetch(`${origin}/api/static-publish.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin }, body: JSON.stringify(body),
  })
  assert.equal((await fetch(`${origin}/api/static-publish.php`)).status, 405)
  assert.equal((await post({ action: 'page', slug: 'meaux', html: '' }, 'wrong')).status, 403)
  assert.equal((await post({ action: 'page', slug: '../escape', html: '' })).status, 400)
  assert.equal((await post({ action: 'page', slug: 'meaux', html: '<html>bad</html>' })).status, 400)
  assert.equal((await post({ action: 'seo', sitemap: 'bad', robots: 'bad' })).status, 400)
  assert.equal((await post({ action: 'page', slug: 'meaux', html: 'x'.repeat(15 * 1024 * 1024) })).status, 413)
})

test('publishes physical files at extensionless URLs and republishes safely', async () => {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
  const progress = []
  try {
    assert.equal(await publication.publishWeddingPages({ ...fixture, origin, onProgress: (value) => progress.push(value) }), 2)
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
    assert.ok(sitemap.includes(`${origin}/locationsalledemariage/meaux`))
    assert.ok(sitemap.includes('/locationsalleanniversaire/nanteuil-les-meaux'))
    assert.ok(sitemap.includes('/blog/exemple'))
    assert.ok(!sitemap.includes('/blog/brouillon'))
    assert.ok((await (await fetch('/robots.txt')).text()).includes(`Sitemap: ${origin}/sitemap.xml`))
    assert.equal((await fetch('/storage-data/paradise_settings.json')).status, 403)
    // Changing the source JSON must not change a published page until republication.
    await writeFile(join(site, 'storage-data/paradise_city_pages.json'), JSON.stringify({
      meaux: { content: 'SOURCE-CHANGED-NOT-YET-PUBLISHED', generatedAt: '2026-01-12T12:00:00Z' },
    }))
    assert.ok(!(await (await fetch('/locationsalledemariage/meaux')).text()).includes('SOURCE-CHANGED-NOT-YET-PUBLISHED'))
    const changed = { ...fixture, pages: { ...fixture.pages, meaux: { ...fixture.pages.meaux, content: 'Contenu republié et fixe.' } } }
    await publication.publishWeddingPages({ ...changed, origin, onProgress() {} })
    assert.match(await (await fetch('/locationsalledemariage/meaux')).text(), /Contenu republié et fixe/)
    assert.match(await (await fetch('/locationsalledemariage/nanteuil-les-meaux')).text(), /Une salle pour votre mariage/)
    assert.match(await (await fetch('/devis')).text(), /id="root"/)
    assert.match(await (await fetch('/locationsalleanniversaire/nanteuil-les-meaux')).text(), /id="root"/)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('publication reports API failures, incorrect routing and canonical domain mismatch', async () => {
  const nativeFetch = globalThis.fetch
  const options = { ...fixture, origin, onProgress() {} }
  try {
    await assert.rejects(publication.publishWeddingPages({ ...options, settings: { ...fixture.settings, siteUrl: 'https://wrong.example' } }), /domaine/)
    globalThis.fetch = async (url) => url === '/static-city.html'
      ? new Response(template)
      : new Response(JSON.stringify({ error: 'Droits insuffisants' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(publication.publishWeddingPages(options), /Droits insuffisants/)
    globalThis.fetch = async (url) => url === '/static-city.html'
      ? new Response(template)
      : url === '/api/static-publish.php'
        ? new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } })
        : new Response('<div id="root"></div>')
    await assert.rejects(publication.publishWeddingPages(options), /ne sert pas le HTML publié/)
  } finally {
    globalThis.fetch = nativeFetch
  }
})
