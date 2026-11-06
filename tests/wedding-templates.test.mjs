import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
let vite, templates, storage, publication, cities, reviews

before(async () => {
  vite = await createServer({ root, server: { middlewareMode: true } })
  templates = await vite.ssrLoadModule('/src/utils/weddingPageTemplates.js')
  storage = await vite.ssrLoadModule('/src/utils/cityPageStorage.js')
  publication = await vite.ssrLoadModule('/src/utils/staticCityPublication.jsx')
  cities = await vite.ssrLoadModule('/src/data/idf-cities.js')
  reviews = await vite.ssrLoadModule('/src/data/weddingReviews.js')
})
after(async () => { await vite?.close() })

test('six coherent families generate without any network calls and replay saved variants', () => {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = () => assert.fail('Local generation must not call a provider')
  try {
    assert.equal(templates.WEDDING_TEMPLATE_FAMILIES.length, 6)
    for (const family of templates.WEDDING_TEMPLATE_FAMILIES) {
      const page = templates.generateWeddingPage({ slug: 'meaux', familyId: family.id, seed: 42 })
      assert.equal(page.template.familyId, family.id)
      assert.equal(page.template.reviewIds.length, 2)
      assert.equal(new Set(page.template.reviewIds).size, 2)
      assert.equal(Object.keys(page.template.blockChoices).length, 6)
      assert.match(page.content, /^## /)
      assert.ok(page.content.split(/\s+/).length >= 550)
      assert.match(page.content, /300/)
      assert.match(page.content, /5 avenue Fridingen|Nanteuil-lès-Meaux/)
      assert.match(page.content, /Meaux \(77100\)/)
      assert.match(page.content, /Seine-et-Marne \(77\)/)
      assert.match(page.content, /vol d’oiseau/)
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

function shingles(text) {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
  return new Set(words.slice(0, -4).map((_word, i) => words.slice(i, i + 5).join(' ')))
}

test('variation changes actual prose, not just the city name or section order', () => {
  // Use one city for the entire sample so city substitutions cannot mask reuse.
  const sample = Array.from({ length: 100 }, (_value, seed) => templates.generateWeddingPage({ slug: 'meaux', seed }))
  assert.equal(new Set(sample.map((page) => page.content)).size, 100)
  assert.equal(new Set(sample.map((page) => page.template.familyId)).size, 6)
  const sets = sample.map((page) => shingles(page.content))
  let max = 0
  let total = 0
  let pairs = 0
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const shared = [...sets[i]].filter((value) => sets[j].has(value)).length
      const similarity = shared / (sets[i].size + sets[j].size - shared)
      max = Math.max(max, similarity)
      total += similarity
      pairs++
    }
  }
  assert.ok(max < 0.70, `Maximum five-word shingle similarity: ${max}`)
  assert.ok(total / pairs < 0.30, `Average five-word shingle similarity: ${total / pairs}`)
})

test('every supported city produces valid local content while invalid input is explicit', () => {
  for (const city of cities.ALL_CITIES) {
    const page = templates.generateWeddingPage({ slug: city.slug, seed: 1 })
    const resolved = cities.getCityBySlug(city.slug)
    assert.ok(page.content.includes(resolved.name))
    assert.ok(page.content.includes(resolved.postalCode))
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
  const page = templates.generateWeddingPage({ slug: 'meaux', seed: 15 })
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
  const old = { content: 'Ancien texte conservé', generatedAt: page.generatedAt }
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
  globalThis.localStorage = { setItem() {} }
  globalThis.fetch = async (url, options) => {
    const key = new URL(url, 'http://localhost').searchParams.get('key')
    if (options?.method === 'POST') data.set(key, JSON.parse(options.body))
    return new Response(JSON.stringify(options?.method === 'POST' ? { ok: true } : data.get(key) ?? null), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const api = storage.makePageTypeStorage('mariage')
    const existing = await api.getPages({ requireServer: true })
    await api.backupPages({ requireServer: true })
    const page = templates.generateWeddingPage({ slug: 'meaux', seed: 15 })
    await api.savePages({ ...existing, meaux: page }, { requireServer: true })
    assert.deepEqual((await api.getPages()).old, existing.old)
    await api.backupPages({ requireServer: true })
    const [backup] = await api.getBackups()
    await api.savePages({ old: existing.old }, { requireServer: true })
    await api.savePages(backup.snapshot, { requireServer: true })
    assert.deepEqual((await api.getPages()).meaux, page)
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 500 })
    await assert.rejects(api.savePages({ meaux: page }, { requireServer: true }), /Enregistrement serveur impossible/)
    await assert.rejects(api.getPages({ requireServer: true }), /Lecture du stockage/)
    await assert.rejects(api.backupPages({ requireServer: true }), /Lecture du stockage/)
  } finally {
    globalThis.fetch = nativeFetch
    if (originalLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalLocalStorage
  }
})
