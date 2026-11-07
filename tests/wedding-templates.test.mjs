import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = resolve(import.meta.dirname, '..')
const travel = { km: 16, minutes: 20, source: 'test', computedAt: '2026-01-01T00:00:00Z' }
let vite, templates, storage, publication, cities, reviews
let normalizeCityName

before(async () => {
  vite = await createServer({ root, server: { middlewareMode: true } })
  templates = await vite.ssrLoadModule('/src/utils/weddingPageTemplates.js')
  storage = await vite.ssrLoadModule('/src/utils/cityPageStorage.js')
  publication = await vite.ssrLoadModule('/src/utils/staticCityPublication.jsx')
  cities = await vite.ssrLoadModule('/src/data/idf-cities.js')
  reviews = await vite.ssrLoadModule('/src/data/weddingReviews.js')
  ;({ normalizeCityName } = await vite.ssrLoadModule('/src/utils/cityNames.js'))
})
after(async () => { await vite?.close() })

test('twenty whole source models generate without network calls and replay saved selections', () => {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = () => assert.fail('Local generation must not call a provider')
  try {
    assert.equal(templates.WEDDING_TEMPLATE_FAMILIES.length, 20)
    for (const family of templates.WEDDING_TEMPLATE_FAMILIES) {
      const page = templates.generateWeddingPage({ slug: 'meaux', familyId: family.id, seed: 42 })
      assert.equal(page.template.familyId, family.id)
      assert.equal(page.template.reviewIds.length, 2)
      assert.equal(new Set(page.template.reviewIds).size, 2)
      assert.match(page.content, /^## /)
      assert.ok(page.content.split(/\s+/).length >= 550)
      assert.match(page.content, /300/)
      assert.ok(page.content.includes('Meaux'))
      assert.ok(page.content.includes('Seine-et-Marne'))
      assert.ok(!page.content.includes('{{'))
      const replay = templates.generateWeddingPage({ slug: 'meaux', familyId: page.template.familyId, seed: page.template.seed })
      assert.equal(replay.content, page.content)
      assert.deepEqual(replay.template, page.template)
    }
    const automatic = templates.generateWeddingPage({ slug: 'meaux', seed: 1234 })
    assert.equal(templates.generateWeddingPage({ slug: 'meaux', ...automatic.template }).content, automatic.content)
    const unseeded = Array.from({ length: 20 }, () => templates.generateWeddingPage({ slug: 'meaux' }))
    assert.equal(new Set(unseeded.map((page) => page.template.seed)).size, 20)
    assert.ok(new Set(unseeded.map((page) => page.content)).size > 1)
  } finally {
    globalThis.fetch = nativeFetch
  }
})

test('random generation selects one of exactly twenty complete models without recombination', () => {
  const models = templates.WEDDING_SOURCE_MODELS
  assert.equal(models.length, 20)
  assert.equal(new Set(models.map((model) => model.sourceFile)).size, 20)
  const selected = new Set()
  for (let seed = 0; seed < 500; seed++) {
    const page = templates.generateWeddingPage({ slug: 'meaux', seed })
    const model = models.find((item) => item.id === page.template.familyId)
    const expected = model.sections.map((section) => section.content.replace(/xxxx|yyyy|\$\{businessName\}/g, (marker) => marker === 'xxxx' ? 'Meaux' : marker === 'yyyy' ? 'Seine-et-Marne' : 'Le Paradise 77')).join('\n\n')
    assert.equal(page.content, expected)
    selected.add(model.id)
    assert.equal(model.sections.length, 8)
    assert.ok(model.cityReplacements > 20)
    assert.ok(model.departmentReplacements > 0)
    assert.match(model.sourceSha256, /^[a-f0-9]{64}$/)
    assert.ok(model.sections.every((section) => !section.content.includes(model.label)))
  }
  assert.equal(selected.size, 20)
})

test('every supported city produces valid local content while invalid input is explicit', () => {
  for (const city of cities.ALL_CITIES) {
    const page = templates.generateWeddingPage({ slug: city.slug, seed: 1 })
    const resolved = cities.getCityBySlug(city.slug)
    assert.ok(page.content.includes(normalizeCityName(resolved.name)))
    assert.ok(page.content.includes(resolved.deptName))
    assert.ok(!page.content.includes('undefined'))
    assert.ok(!page.content.includes('{{'))
  }
  for (const input of [
    { slug: 'unknown' }, { slug: 'meaux', seed: -1 }, { slug: 'meaux', seed: 1.5 },
    { slug: 'meaux', seed: 0x100000000 }, { slug: 'meaux', familyId: 'missing' }, { slug: 'meaux', businessName: ' ' },
  ]) assert.throws(() => templates.generateWeddingPage(input))
  const escaped = templates.generateWeddingPage({ slug: 'meaux', businessName: 'Salle\n## <script>**test**', seed: 1 })
  assert.ok(!escaped.content.includes('<script>'))
  assert.ok(!escaped.content.includes('\n## <'))
})

test('review excerpts are attributed, selected once, and included in published HTML', async () => {
  assert.equal(reviews.WEDDING_REVIEWS.length, 7)
  assert.equal(reviews.WEDDING_REVIEWS.find((review) => review.id === 'florine').excerpt, 'Le gérant de l’établissement est très professionnel et à l’écoute.')
  const page = templates.generateWeddingPage({ slug: 'meaux', seed: 15, travel })
  const config = { businessName: 'Le Paradise', githubToken: 'private-old-token' }
  const params = { slug: 'meaux', pages: { meaux: page }, config, gallery: [], allTypePages: { mariage: { meaux: page } }, blogArticles: {} }
  const snapshot = publication.makeCitySnapshot(params)
  assert.deepEqual(snapshot.page.template.reviewIds, page.template.reviewIds)
  assert.ok(!JSON.stringify(snapshot).includes('private-old-token'))
  const template = await readFile(resolve(root, 'dist/static-city.html'), 'utf8')
  const html = publication.renderCityDocument({ template, snapshot, settings: {}, origin: 'https://example.com' })
  for (const id of page.template.reviewIds) {
    const review = reviews.WEDDING_REVIEWS.find((item) => item.id === id)
    assert.ok(html.includes(review.author))
    assert.ok(html.includes(review.excerpt.replaceAll("'", '&#x27;')))
  }
  assert.equal((html.match(/<blockquote/g) || []).length, 2)
  assert.match(html.replace(/<!--.*?-->/g, ''), /5\/5 sur Google/)
  assert.ok(html.includes(reviews.WEDDING_REVIEW_SOURCE))
  assert.ok(html.includes('<title>Le Paradise 0184196949 | Salle de mariage Meaux 77100</title>'))
  assert.ok(!html.includes('"@type":"Review"'))
  assert.ok(!html.includes('aggregateRating'))
  assert.match(html, /sans attribution à une ville particulière/)
  const visible = html.split('<script id="city-page-data"')[0]
  assert.equal((visible.match(/Comment réserver une salle de mariage à Meaux/g) || []).length, 1)
  assert.equal((visible.match(/Capacité et équipements — Le Paradise/g) || []).length, 1)
  assert.ok(!html.includes('xxxx'))
  assert.ok(!html.includes('yyyy'))
  assert.ok(!html.includes('${businessName}'))
  const legacyTemplate = { version: 1, familyId: 'presentation', seed: 15, reviewIds: page.template.reviewIds }
  assert.deepEqual(templates.validateWeddingTemplate(legacyTemplate), legacyTemplate)
  const old = { content: 'Ancien texte conservé', generatedAt: page.generatedAt, travel }
  const oldSnapshot = publication.makeCitySnapshot({ ...params, pages: { meaux: old } })
  assert.equal(oldSnapshot.page.content, old.content)
  assert.equal(oldSnapshot.page.template, undefined)
  assert.throws(() => publication.makeCitySnapshot({
    ...params, pages: { meaux: { ...page, template: { ...page.template, reviewIds: ['unknown', 'florine'] } } },
  }), /avis invalide/)
})

test('generation storage preserves unselected pages and restored variants, and exposes save failures', async () => {
  const nativeFetch = globalThis.fetch
  const originalLocalStorage = globalThis.localStorage
  const data = new Map([['paradise_city_pages', { old: { content: 'Unselected content' } }]])
  const incrementalBodies = []
  globalThis.localStorage = { setItem() {} }
  globalThis.fetch = async (url, options) => {
    const requestUrl = new URL(url, 'http://localhost')
    const key = requestUrl.searchParams.get('key')
    if (requestUrl.pathname === '/api/city-page-storage.php') {
      const payload = JSON.parse(options.body)
      incrementalBodies.push(options.body)
      if (requestUrl.searchParams.get('action') === 'save-page') {
        data.set(key, { ...data.get(key), [payload.slug]: payload.page })
      } else {
        const backupKey = key.replace('paradise_city_pages', 'paradise_city_pages_backup')
        data.set(backupKey, [{ snapshot: structuredClone(data.get(key)) }, ...(data.get(backupKey) || [])].slice(0, 5))
      }
    } else if (options?.method === 'POST') data.set(key, JSON.parse(options.body))
    return new Response(JSON.stringify(options?.method === 'POST' ? { ok: true } : data.get(key) ?? null), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const api = storage.makePageTypeStorage('mariage')
    const existing = await api.getPages({ requireServer: true })
    await api.backupPages({ requireServer: true })
    const page = templates.generateWeddingPage({ slug: 'meaux', seed: 15 })
    await api.savePage('meaux', page)
    assert.deepEqual(JSON.parse(incrementalBodies[0]), {}, 'Backup must not upload existing snapshots')
    assert.deepEqual(JSON.parse(incrementalBodies[1]), { slug: 'meaux', page })
    assert.ok(!incrementalBodies[1].includes('Unselected content'))
    assert.deepEqual((await api.getPages()).old, existing.old)
    await api.backupPages({ requireServer: true })
    const [backup] = await api.getBackups()
    await api.savePages({ old: existing.old }, { requireServer: true })
    await api.savePages(backup.snapshot, { requireServer: true })
    assert.deepEqual((await api.getPages()).meaux, page)
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 500 })
    await assert.rejects(api.savePage('meaux', page), /Enregistrement serveur impossible.*HTTP 500/)
    await assert.rejects(api.savePages({ meaux: page }, { requireServer: true }), /Enregistrement serveur impossible/)
    await assert.rejects(api.getPages({ requireServer: true }), /Lecture du stockage/)
    await assert.rejects(api.backupPages({ requireServer: true }), /Enregistrement serveur impossible/)
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Espace disque insuffisant' }), { status: 500 })
    await assert.rejects(api.savePage('meaux', page), /HTTP 500.*Espace disque insuffisant/)
    globalThis.fetch = async () => new Response('<html>Too large</html>', { status: 413 })
    await assert.rejects(api.savePage('meaux', page), /HTTP 413.*limite de taille/)
  } finally {
    globalThis.fetch = nativeFetch
    if (originalLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalLocalStorage
  }
})

test('road travel replaces every model figure and is required for publication', async () => {
  const { applyWeddingTravel, fetchWeddingTravel, PARADISE_COORDS } = await vite.ssrLoadModule('/src/utils/weddingTravel.js')
  const city = cities.getCityBySlug('chessy')
  const shell = await readFile(resolve(root, 'dist/static-city.html'), 'utf8')
  const figure = /(≈ \d+ min en voiture|\d+ km depuis|(?:ne prend que|à seulement|un trajet de|accédez en|En seulement) \d+ minutes)/g
  for (const model of templates.WEDDING_SOURCE_MODELS) {
    const page = templates.generateWeddingPage({ slug: 'chessy', familyId: model.id, seed: 3, travel })
    const figures = page.content.match(figure) || []
    assert.ok(figures.length >= 3, model.id)
    for (const value of figures) assert.match(value, /(^≈ 20 min|^16 km| 20 minutes$)/, `${model.id}: ${value}`)
    assert.match(page.content, /15 min en voiture/, 'Gare de Meaux inchangée')
    assert.deepEqual(page.travel, travel)
    const old = templates.generateWeddingPage({ slug: 'chessy', familyId: model.id, seed: 3 })
    assert.throws(() => publication.makeCitySnapshot({ slug: 'chessy', pages: { chessy: old }, config: {}, gallery: [], allTypePages: {}, blogArticles: {} }), /Trajet routier non calculé/)
    const updated = { ...old, content: applyWeddingTravel(old.content, travel), travel }
    assert.equal(updated.content, page.content)
    const snapshot = publication.makeCitySnapshot({ slug: 'chessy', pages: { chessy: updated }, config: {}, gallery: [], allTypePages: {}, blogArticles: {} })
    assert.deepEqual(snapshot.page.travel, travel)
    const html = publication.renderCityDocument({ template: shell, snapshot, settings: {}, origin: 'https://example.com' })
    const visible = html.split('<script id="city-page-data"')[0].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')
    for (const value of visible.match(figure) || []) assert.match(value, /(^≈ 20 min|^16 km| 20 minutes$)/, `${model.id}: rendered ${value}`)
    assert.match(visible, /≈ 20 min en voiture/)
    assert.match(visible, /16 km depuis Chessy/)
    assert.match(visible, /environ 20 minutes en voiture/)
    assert.equal((html.match(/<details /g) || []).length, 14)
    assert.match(html, /maps\.google\.com\/maps\?q=Le%20Paradise%2C%205%20avenue%20Fridingen/)
    assert.match(html, /"latitude":48\.937362,"longitude":2\.882801/)
  }

  const requests = []
  const fetchImpl = async (url) => {
    requests.push({ url, at: Date.now() })
    return new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 16234, duration: 1190 }] }), { status: 200 })
  }
  const first = await fetchWeddingTravel(city, { fetchImpl })
  const second = await fetchWeddingTravel(city, { fetchImpl })
  assert.deepEqual([first.km, first.minutes, first.source], [16, 20, 'osrm'])
  assert.equal(second.minutes, 20)
  assert.ok(requests[0].url.includes(`${city.lng},${city.lat};${PARADISE_COORDS.lng},${PARADISE_COORDS.lat}`))
  assert.ok(requests[1].at - requests[0].at >= 1000, 'requêtes régulées')
  await assert.rejects(fetchWeddingTravel(city, { fetchImpl: async () => new Response('', { status: 429 }) }), /saturé/)
  await assert.rejects(fetchWeddingTravel(city, { fetchImpl: async () => new Response('{"code":"NoRoute"}', { status: 200 }) }), /Itinéraire introuvable/)
  await assert.rejects(fetchWeddingTravel(city, { fetchImpl: async () => { throw new Error('offline') } }), /injoignable/)
  await assert.rejects(fetchWeddingTravel(city, { fetchImpl: async () => new Response('{"code":"Ok","routes":[{"distance":-1,"duration":60}]}', { status: 200 }) }), /Itinéraire introuvable/)
})

test('company settings are prefilled without overriding saved values or bank details', async () => {
  const { withSettingsDefaults } = await vite.ssrLoadModule('/src/utils/storage.js')
  const empty = withSettingsDefaults({ pin: '9999', siteUrl: '', legalInfo: { email: '', gerant: 'Autre gérant' }, bankInfo: { iban: '' } })
  assert.equal(empty.pin, '9999')
  assert.equal(empty.siteUrl, 'https://www.leparadise77.fr')
  assert.equal(empty.whatsapp, '+33782821582')
  assert.equal(empty.legalInfo.email, 'contact@leparadise77.fr')
  assert.equal(empty.legalInfo.gerant, 'Autre gérant')
  assert.equal(empty.legalInfo.tva, 'FR06904543816')
  assert.deepEqual(empty.bankInfo, { iban: '', bic: '', titulaire: '' })
  const source = await readFile(resolve(root, 'src/utils/storage.js'), 'utf8')
  assert.ok(!/FR76|QNTOFRP/.test(source), 'aucune coordonnée bancaire dans le dépôt')
  const { default: MesInfosTab } = await vite.ssrLoadModule('/src/components/Dashboard/tabs/MesInfosTab.jsx')
  const html = renderToStaticMarkup(createElement(MesInfosTab))
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /Modifier<\/button>/)
  assert.match(html, /value="https:\/\/www\.leparadise77\.fr"/)
  assert.match(html, /value="SARL AFM"/)
})
