import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'vite'
import { mkdtemp, cp, mkdir, readFile, writeFile, rm, chmod, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer as createTcpServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { renderToStaticMarkup } from 'react-dom/server'

const root = resolve(import.meta.dirname, '..')
let vite, publication, directory, site, origin, template, shellTemplate
let buildSeoData, PAGE_TYPES_BY_ID, getPublishedWeddingSlugs, isPublicPath, generateCityContent
let WeddingDirectory
let ALL_CITIES, getCityBySlug
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
    mariage: { meaux: { content: 'INTERNAL-OTHER-CONTENT' }, 'nanteuil-les-meaux': { content: 'INTERNAL-OTHER-CONTENT' }, bobigny: { content: 'ONLY-GENERATED-NOT-PUBLISHED' } },
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
  ;({ buildSeoData } = await vite.ssrLoadModule('/src/utils/seoData.js'))
  ;({ PAGE_TYPES_BY_ID } = await vite.ssrLoadModule('/src/data/pageTypes.js'))
  ;({ ALL_CITIES, getCityBySlug } = await vite.ssrLoadModule('/src/data/idf-cities.js'))
  ;({ getPublishedWeddingSlugs, isPublicPath } = await vite.ssrLoadModule('/src/utils/weddingPublication.js'))
  ;({ generateCityContent } = await vite.ssrLoadModule('/src/utils/cityPageStorage.js'))
  ;({ default: WeddingDirectory } = await vite.ssrLoadModule('/src/components/WeddingDirectory.jsx'))
  template = await readFile(join(root, 'dist/static-city.html'), 'utf8')
  shellTemplate = await readFile(join(root, 'dist/index.html'), 'utf8')
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
  assert.match(html, /<h1[^>]*>Location salle de mariage près de Meaux/)
  assert.ok(html.includes('<title>Le Paradise 0184196949 | Salle de mariage Meaux 77100</title>'))
  const expectedDescription = 'Vous recherchez une salle de mariage à Meaux 77 ? Découvrez notre salle de réception a proximité de seine et marne, idéale pour célébrer votre mariage. Contactez-nous pour réserver une salle de mariage et obtenir un devis personnalisé à Meaux !'
  assert.ok(html.includes(`<meta name="description" content="${expectedDescription}" />`))
  assert.ok(html.includes(`<meta property="og:description" content="${expectedDescription}" />`))
  assert.ok(html.includes('<meta property="og:title" content="Le Paradise 0184196949 | Salle de mariage Meaux 77100" />'))
  assert.match(html, /Texte unique \$&amp; et &lt;script&gt;/)
  assert.ok(html.includes(`<link rel="canonical" href="${origin}/locationsalledemariage/meaux"`))
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
  assert.match(html, /à vol d’oiseau/)
  assert.ok(!html.includes('key=${'))
  const directory = html.match(/<section class="wedding-directory"[\s\S]*?<\/section>/)[0]
  assert.match(directory, /Seine-et-Marne \(77\)/)
  assert.ok(directory.includes('href="/locationsalledemariage/meaux" title="Location salle de mariage Meaux">Location salle de mariage Meaux</a>'))
  assert.ok(directory.includes('Location salle de mariage Nanteuil-lès-Meaux'))
  assert.ok(!directory.includes('locationsalleanniversaire'))
  assert.ok(!directory.includes('/bobigny'))
  assert.ok(!/\balt=/.test(directory))
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

test('OpenAI PHP authenticates, protects the key and handles provider failures without retries', async () => {
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const responseFile = join(directory, 'openai-response.json')
  const callsFile = join(directory, 'openai-calls.json')
  const shim = join(directory, 'openai-test-preload.php')
  await writeFile(shim, `<?php
namespace Paradise\\AI;
const CURLOPT_POST = 1, CURLOPT_RETURNTRANSFER = 2, CURLOPT_CONNECTTIMEOUT = 3, CURLOPT_TIMEOUT = 4, CURLOPT_HTTPHEADER = 5, CURLOPT_POSTFIELDS = 6, CURLINFO_HTTP_CODE = 7;
$fixture = json_decode(file_get_contents('${responseFile}'), true);
putenv('OPENAI_API_KEY=' . ($fixture['key'] ?? 'test-only-provider-key'));
function curl_init($url) { $GLOBALS['test_url'] = $url; return true; }
function curl_setopt_array($curl, $options) { $GLOBALS['test_options'] = $options; }
function curl_exec($curl) {
    file_put_contents('${callsFile}', json_encode(['url' => $GLOBALS['test_url'], 'options' => $GLOBALS['test_options']]));
    return $GLOBALS['fixture']['networkError'] ?? false ? false : json_encode($GLOBALS['fixture']['body']);
}
function curl_getinfo($curl, $option) { return $GLOBALS['fixture']['status']; }
function curl_errno($curl) { return 28; }
function curl_close($curl) {}
`)
  const setResponse = (body, status = 200, extras = {}) => writeFile(responseFile, JSON.stringify({ body, status, ...extras }))
  await setResponse({ choices: [{ message: { content: '## Mariage\nTexte original' }, finish_reason: 'stop' }] })
  const output = start('php', ['-n', '-d', `auto_prepend_file=${shim}`, '-S', `127.0.0.1:${port}`, '-t', site])
  await ready(`${baseUrl}/static-city.html`, output)
  const post = (payload = { prompt: 'Consignes publiques pour Meaux' }, adminPin = pin) => fetch(`${baseUrl}/api/openai-generate.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin }, body: JSON.stringify(payload),
  })
  assert.equal((await fetch(`${baseUrl}/api/openai-generate.php`)).status, 405)
  assert.equal((await post(undefined, 'wrong')).status, 403)
  assert.equal((await post({ prompt: '' })).status, 400)
  assert.equal((await post({ prompt: 'x'.repeat(33000) })).status, 413)
  const lockPath = join(site, 'storage-data/.openai-generation.lock')
  const holder = spawn('php', ['-r', `$lock = fopen('${lockPath}', 'c'); flock($lock, LOCK_EX); echo 'locked'; sleep(10);`], { stdio: ['ignore', 'pipe', 'ignore'] })
  processes.push(holder)
  await once(holder.stdout, 'data')
  assert.equal((await post()).status, 409)
  holder.kill('SIGTERM')
  await once(holder, 'exit')
  let result = await post()
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { content: '## Mariage\nTexte original' })
  const call = JSON.parse(await readFile(callsFile, 'utf8'))
  assert.equal(call.url, 'https://api.openai.com/v1/chat/completions')
  const request = JSON.parse(call.options['6'])
  assert.equal(request.model, 'gpt-4o-mini')
  assert.equal(request.max_completion_tokens, 4096)
  assert.equal(request.messages[0].content, 'Consignes publiques pour Meaux')
  for (const [status, body, message] of [
    [401, { error: { message: 'secret-provider-details' } }, /Clé OpenAI invalide/],
    [429, { error: { code: 'insufficient_quota' } }, /Crédit ou quota/],
    [429, { error: { code: 'rate_limit_exceeded' } }, /Limite de requêtes/],
    [500, {}, /HTTP 500/],
    [200, { choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] }, /tronqué/],
    [200, { choices: [] }, /vide ou invalide/],
  ]) {
    await setResponse(body, status)
    result = await post()
    assert.ok(!result.ok)
    const text = await result.text()
    assert.match(text, message)
    assert.ok(!text.includes('secret-provider-details'))
    assert.ok(!text.includes('test-only-provider-key'))
  }
  await setResponse({}, 0, { networkError: true })
  result = await post()
  assert.equal(result.status, 502)
  assert.match((await result.json()).error, /aucune relance automatique/)
  await setResponse({}, 200, { key: '' })
  result = await post()
  assert.equal(result.status, 503)
  assert.match((await result.json()).error, /OPENAI_API_KEY/)
  const privateDirectory = join(directory, 'private')
  const privateConfig = join(privateDirectory, 'openai-config.php')
  await mkdir(privateDirectory)
  await writeFile(privateConfig, "<?php return ['apiKey' => 'test-only-private-key'];")
  await setResponse({ choices: [{ message: { content: 'Texte avec clé privée' }, finish_reason: 'stop' }] }, 200, { key: '' })
  result = await post()
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { content: 'Texte avec clé privée' })
  const privateCall = JSON.parse(await readFile(callsFile, 'utf8'))
  assert.ok(privateCall.options['5'].includes('Authorization: Bearer test-only-private-key'))
  await assert.rejects(readFile(join(site, 'private/openai-config.php')), { code: 'ENOENT' })
  assert.ok(!(await (await fetch(`${baseUrl}/private/openai-config.php`)).text()).includes('test-only-private-key'))
  for (const [config, message] of [
    ["<?php return ['apiKey' => 'VOTRE_CLE_API_OPENAI'];", /absente ou invalide/],
    ["<?php return ['apiKey' => []];", /Configuration OpenAI invalide/],
    ["<?php this is invalid PHP containing secret-test-key", /erreur PHP/],
    ["<?php echo 'test-only-private-key'; return ['apiKey' => 'test-only-private-key'];", /aucun contenu/],
  ]) {
    await writeFile(privateConfig, config)
    result = await post()
    assert.equal(result.status, 503)
    const text = await result.text()
    assert.match(text, message)
    assert.ok(!text.includes('secret-test-key'))
    assert.ok(!text.includes('test-only-private-key'))
  }
  await writeFile(privateConfig, "<?php return ['apiKey' => 'test-only-private-key'];")
  await setResponse({ choices: [{ message: { content: 'Env prioritaire' }, finish_reason: 'stop' }] })
  assert.equal((await post()).status, 200)
  const environmentCall = JSON.parse(await readFile(callsFile, 'utf8'))
  assert.ok(environmentCall.options['5'].includes('Authorization: Bearer test-only-provider-key'))
  await setResponse({}, 200, { key: '' })
  await rm(privateConfig)
  const exposedConfig = join(site, 'exposed-test-config.php')
  await writeFile(exposedConfig, "<?php return ['apiKey' => 'test-only-private-key'];")
  await symlink(exposedConfig, privateConfig)
  result = await post()
  assert.equal(result.status, 503)
  assert.match((await result.json()).error, /hors du dossier public/)
})

test('OpenAI client surfaces network, API and deployment errors and never uses a local fallback', async () => {
  const nativeFetch = globalThis.fetch
  const generate = (adminPin = pin) => generateCityContent('Meaux', 'Seine-et-Marne', '', 'Le Paradise', 'salle', adminPin, 'location salle de mariage')
  let calls = 0
  try {
    globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch') }
    await assert.rejects(generate(), /Connexion au serveur/)
    assert.equal(calls, 1)
    globalThis.fetch = async () => new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } })
    await assert.rejects(generate(), /déploiement/)
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Crédit OpenAI épuisé' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(generate(), /Crédit OpenAI épuisé/)
    globalThis.fetch = async () => new Response(JSON.stringify({ content: '' }), { headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(generate(), /vide/)
    await assert.rejects(generate(''), /PIN administrateur absent/)
  } finally {
    globalThis.fetch = nativeFetch
  }
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
    assert.ok(!sitemap.includes('/devis'))
    assert.ok(!sitemap.includes('/locationsalledemariage/bobigny'))
    assert.ok((await (await fetch('/robots.txt')).text()).includes(`Sitemap: ${origin}/sitemap.xml`))
    assert.equal((await fetch('/storage-data/paradise_settings.json')).status, 403)
    const directory = await (await fetch('/wedding-directory.html')).text()
    const home = await (await fetch('/')).text()
    assert.ok(home.includes(directory), 'The directory must be in the initial homepage HTML')
    assert.ok(home.includes('id="public-wedding-directory"'))
    assert.match(home, /<title>Location salle de mariage à Nanteuil-lès-Meaux/)
    assert.ok(home.includes(`rel="canonical" href="${origin}/"`))
    assert.equal((home.match(/id="public-wedding-directory"/g) || []).length, 1)
    assert.deepEqual(await getPublishedWeddingSlugs(), ['meaux', 'nanteuil-les-meaux'])
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
    const updatedHome = await (await fetch('/')).text()
    assert.equal((updatedHome.match(/id="public-wedding-directory"/g) || []).length, 1)
    assert.equal((updatedHome.match(/rel="canonical"/g) || []).length, 1)
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
  const slugs = ['meaux', 'torcy', 'mitry-mory', 'paris-1er', 'versailles', 'evry', 'nanterre', 'bobigny', 'creteil', 'argenteuil', 'meaux', 'ville-inconnue']
  const html = renderToStaticMarkup(WeddingDirectory({ slugs }))
  for (const department of ['75', '77', '78', '91', '92', '93', '94', '95']) {
    assert.ok(html.includes(`(${department})`), department)
  }
  const links = [...html.matchAll(/<a href="\/locationsalledemariage\/([^"]+)" title="([^"]+)">([^<]+)<\/a>/g)]
  assert.equal(links.length, new Set(slugs).size - 1)
  assert.equal(new Set(links.map((link) => link[1])).size, links.length)
  for (const link of links) {
    assert.equal(link[2], link[3])
    assert.ok(link[2].startsWith('Location salle de mariage '))
  }
  assert.ok(html.indexOf('Location salle de mariage Meaux') < html.indexOf('Location salle de mariage Mitry-Mory'))
  assert.ok(html.indexOf('Location salle de mariage Mitry-Mory') < html.indexOf('Location salle de mariage Torcy'))
  assert.ok(!html.includes('ville-inconnue'))
  assert.ok(!html.includes('alt='))
  assert.equal(renderToStaticMarkup(WeddingDirectory({ slugs: [] })), '')
})

test('SEO uses unique local titles without moving the venue or indexing private pages', () => {
  const settings = { nom: 'Le Paradise', siteUrl: origin }
  const meaux = buildSeoData('/locationsalledemariage/meaux', settings, fixture.pages, PAGE_TYPES_BY_ID.mariage, null, null, origin)
  const nanteuil = buildSeoData('/locationsalledemariage/nanteuil-les-meaux', settings, fixture.pages, PAGE_TYPES_BY_ID.mariage, null, null, origin)
  assert.notEqual(meaux.title, nanteuil.title)
  assert.notEqual(meaux.description, nanteuil.description)
  assert.equal(meaux.title, 'Le Paradise 0184196949 | Salle de mariage Meaux 77100')
  assert.equal(meaux.description, 'Vous recherchez une salle de mariage à Meaux 77 ? Découvrez notre salle de réception a proximité de seine et marne, idéale pour célébrer votre mariage. Contactez-nous pour réserver une salle de mariage et obtenir un devis personnalisé à Meaux !')
  assert.equal(nanteuil.title, 'Le Paradise 0184196949 | Salle de mariage Nanteuil les Meaux 77100')
  assert.ok(meaux.imageUrl.endsWith('/media/hero-paradise.jpg'))
  for (const path of ['/', '/blog', '/blog/exemple', '/devis', '/mentions-legales', '/conditions-generales', '/politique-confidentialite', '/locationsalledemariage/meaux', '/locationsalledereception/meaux']) {
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
    ['paris-1er', 'Paris 1er', '75001', 'paris'],
    ['versailles', 'Versailles', '78000', 'yvelines'],
    ['evry', 'Evry', '91000', 'essonne'],
    ['boulogne-billancourt', 'Boulogne Billancourt', '92100', 'hauts de seine'],
    ['epinay-sur-seine', 'Epinay sur Seine', '93800', 'seine saint denis'],
    ['hay-les-roses', 'Hay les Roses', '94240', 'val de marne'],
    ['cergy', 'Cergy', '95000', 'val d oise'],
  ]) {
    const seo = buildSeoData(`/locationsalledemariage/${slug}`, fixture.settings, { [slug]: { content: 'Contenu' } }, PAGE_TYPES_BY_ID.mariage, null, null, origin)
    assert.equal(seo.title, `Le Paradise 0184196949 | Salle de mariage ${name} ${postcode}`)
    assert.ok(seo.description.includes(`proximité de ${department},`))
  }
  const reception = buildSeoData('/locationsalledereception/nanteuil-les-meaux', fixture.settings, fixture.pages, PAGE_TYPES_BY_ID.reception, null, null, origin)
  assert.equal(reception.title, `Salle de réception à Nanteuil-lès-Meaux — ${fixture.settings.nom}`)
})

test('AI instructions forbid keyword quotas, fictitious venues and invented testimonials', async () => {
  const nativeFetch = globalThis.fetch
  let prompt = ''
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/openai-generate.php')
      assert.equal(options.headers['X-Admin-Pin'], 'test-only-pin')
      prompt = JSON.parse(options.body).prompt
      assert.ok(!options.body.includes('test-only-pin'))
      return new Response(JSON.stringify({ content: '## Préparer votre réception\nContenu utile.' }), { headers: { 'Content-Type': 'application/json' } })
    }
    await generateCityContent('Meaux', 'Seine-et-Marne', '', 'Le Paradise', 'salle', 'test-only-pin', 'location salle de mariage')
    assert.match(prompt, /5 avenue Fridingen/)
    assert.match(prompt, /pas d'une salle ou d'une agence située/)
    assert.match(prompt, /N'invente jamais d'avis, de témoignages/)
    assert.match(prompt, /sans bourrage de mots-clés/)
    assert.ok(!prompt.includes('AU MOINS 30'))
    assert.ok(!prompt.includes('AU MINIMUM 1500'))
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
      : url === '/'
        ? new Response(shellTemplate)
        : new Response(JSON.stringify({ error: 'Droits insuffisants' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(publication.publishWeddingPages(options), /Droits insuffisants/)
    globalThis.fetch = async (url) => url === '/static-city.html'
      ? new Response(template)
      : url === '/'
        ? new Response(shellTemplate)
        : url === '/api/static-publish.php'
          ? new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } })
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
