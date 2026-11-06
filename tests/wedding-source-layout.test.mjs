import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
let vite, templates, layoutUtils, cityModule, cities, SourceSections, publication
let normalizeWeddingDisplayText

before(async () => {
  vite = await createServer({ root, server: { middlewareMode: true } })
  templates = await vite.ssrLoadModule('/src/utils/weddingPageTemplates.js')
  layoutUtils = await vite.ssrLoadModule('/src/utils/weddingSourceLayout.js')
  cityModule = await vite.ssrLoadModule('/src/components/VillesPages/CityPage.jsx')
  cities = await vite.ssrLoadModule('/src/data/idf-cities.js')
  ;({ default: SourceSections } = await vite.ssrLoadModule('/src/components/VillesPages/WeddingSourceSections.jsx'))
  publication = await vite.ssrLoadModule('/src/utils/staticCityPublication.jsx')
  ;({ normalizeWeddingDisplayText } = await vite.ssrLoadModule('/src/utils/weddingDisplayText.js'))
})
after(async () => { await vite?.close() })

function walk(node) {
  return typeof node === 'string' ? [] : [node, ...node.children.flatMap(walk)]
}

function renderSource(page, city) {
  const layout = layoutUtils.resolveWeddingSourceLayout(page, city)
  const displayCity = { ...city, name: layoutUtils.injectWeddingSource('xxxx', city) }
  return renderToStaticMarkup(createElement(SourceSections, {
    layout, city, knownFaqs: cityModule.getWeddingFaqs({ city: displayCity, businessName: 'Le Paradise' }),
    businessName: 'Le Paradise',
  }))
}

test('twenty exact source DOM layouts retain all cards, icons, headings, lists and five steps', () => {
  const city = cities.getCityBySlug('meaux')
  for (const model of templates.WEDDING_SOURCE_MODELS) {
    const page = templates.generateWeddingPage({ slug: city.slug, familyId: model.id, seed: 42 })
    const layout = layoutUtils.resolveWeddingSourceLayout(page, city)
    assert.deepEqual(layout.sections.map((s) => s.id), ['intro', 'pourquoi', 'prestations', 'reservation', 'capacite', 'lieux', 'conseils', 'faq'])
    const html = renderSource(page, city)
    const visible = html.replace(/<[^>]*>/g, '')
    for (const section of layout.sections) {
      if (section.id === 'faq') continue
      for (const block of section.blocks) {
        const text = block.replace(/^#{2,3} /, '').replaceAll('&', '&amp;').replaceAll("'", '&#x27;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        assert.ok(visible.includes(text), `${model.id}: missing original prose ${text.slice(0, 70)}`)
      }
    }
    for (const label of ['Temps de trajet', 'Parking gratuit', 'Cuisine', 'Accessibilité', '01', '02', '03', '04', '05']) assert.ok(visible.includes(label))
    assert.ok((html.match(/grid-template-columns:/g) || []).length >= 3)
    assert.ok((html.match(/<li /g) || []).length >= 17)
    assert.ok((html.match(/✓/g) || []).length >= 17)
    assert.ok(!html.includes('xxxx') && !html.includes('yyyy') && !html.includes('${businessName}'))
    assert.ok(!html.includes('localhost:5173'))
    assert.ok(!html.includes('<script') && !html.includes('onclick='))
    for (const node of layout.sections.flatMap((section) => walk(section.tree))) {
      assert.ok(Object.keys(node.attrs).every((key) => ['id', 'style', 'href', 'target', 'rel', 'title'].includes(key)))
    }
  }
})

test('all twenty FAQs keep fourteen original questions in order and SSR includes every known answer', () => {
  const city = cities.getCityBySlug('meaux')
  for (const model of templates.WEDDING_SOURCE_MODELS) {
    const page = templates.generateWeddingPage({ slug: city.slug, familyId: model.id, seed: 42 })
    const html = renderSource(page, city)
    assert.equal((html.match(/<details /g) || []).length, 14)
    assert.equal((html.match(/<summary /g) || []).length, 14)
    assert.equal((html.match(/aria-controls="source-faq-/g) || []).length, 14)
    let previous = -1
    const questions = model.sections.at(-1).content.split('\n\n').filter((block) => block.startsWith('### '))
    assert.equal(questions.length, 14)
    for (const block of questions) {
      const question = layoutUtils.injectWeddingSource(block.slice(4), city).replaceAll("'", '&#x27;')
      const position = html.indexOf(question)
      assert.ok(position > previous, `${model.id}: question order`)
      previous = position
    }
    assert.match(html, /jusqu&#x27;à 300 invités/)
    assert.match(html, /ne dispose pas d&#x27;espace extérieur ou de jardin/)
    assert.match(html, /Hôtel Première Classe/)
    for (let index = 0; index < 14; index++) {
      assert.ok(html.includes(`id="source-faq-${index}"`))
    }
  }
})

test('old accented V2 saves upgrade without losing block-level customized prose', () => {
  const city = cities.getCityBySlug('chatenay-malabry')
  for (const model of templates.WEDDING_SOURCE_MODELS) {
    const page = templates.generateWeddingPage({ slug: city.slug, familyId: model.id, seed: 42 })
    const oldContent = model.sections.map((section) => layoutUtils.injectWeddingSource(section.content, city, true)).join('\n\n')
    const legacy = { ...page, content: oldContent }
    assert.equal(renderSource(legacy, city), renderSource(page, city))
    assert.ok(renderSource(legacy, city).includes('Chatenay Malabry'))
    const blocks = oldContent.split('\n\n')
    const customIndex = blocks.findIndex((block) => !block.startsWith('##'))
    blocks[customIndex] = 'Notre paragraphe personnalisé : réception élégante, mémoire conservée.'
    const custom = { ...page, content: blocks.join('\n\n') }
    const html = renderSource(custom, city)
    assert.ok(html.includes('Notre paragraphe personnalisé : réception élégante, mémoire conservée.'))
    assert.equal((html.match(/<details /g) || []).length, 14)
    assert.ok(!html.includes(layoutUtils.injectWeddingSource(model.sections[0].content.split('\n\n')[customIndex], city)))
    assert.equal(custom.content, blocks.join('\n\n'))
    assert.throws(() => layoutUtils.resolveWeddingSourceLayout({ ...custom, content: `${custom.content}\n\nNouveau bloc` }, city), /blocs ajoutés ou supprimés/)
    const modifiedFaq = { ...page, content: page.content.replace('Peut-on apporter son propre traiteur ?', 'Une question sans réponse connue ?') }
    assert.throws(() => layoutUtils.resolveWeddingSourceLayout(modifiedFaq, city), /questions FAQ personnalisées/)
  }
})

test('complete SSR puts devis immediately after breadcrumb, preserves V1 and rejects unsupported V2 before publishing', async () => {
  const page = templates.generateWeddingPage({ slug: 'meaux', seed: 42 })
  const config = { businessName: 'Le Paradise' }
  const snapshot = publication.makeCitySnapshot({
    slug: 'meaux', pages: { meaux: page }, config, gallery: [],
    allTypePages: { mariage: { meaux: page } }, blogArticles: {},
  })
  const compiled = await readFile(resolve(root, 'dist/static-city.html'), 'utf8')
  const html = publication.renderCityDocument({ template: compiled, snapshot, settings: {}, origin: 'https://example.com' })
  const breadcrumb = html.indexOf('aria-label="Fil d’Ariane"')
  const quote = html.indexOf('id="devis"')
  assert.ok(breadcrumb < quote && quote < html.indexOf('id="acces-local"') && quote < html.indexOf('id="intro"'))
  assert.equal((html.match(/id="devis"/g) || []).length, 1)
  assert.ok(!html.includes('Ce texte reprend') && !html.includes('à vol d’oiseau'))
  assert.equal((html.match(/<blockquote/g) || []).length, 2)
  const legacyPage = { ...page, content: 'Texte historique personnalisé', template: { ...page.template, version: 1, familyId: 'presentation' } }
  const legacyHtml = publication.renderCityDocument({ template: compiled, snapshot: { ...snapshot, page: legacyPage }, settings: {}, origin: 'https://example.com' })
  assert.ok(legacyHtml.includes(legacyPage.content))
  assert.equal((legacyHtml.match(/<details /g) || []).length, 14)
  const bad = { ...page, content: `${page.content}\n\nBloc ajouté à conserver` }
  assert.throws(() => publication.renderCityDocument({ template: compiled, snapshot: { ...snapshot, page: bad }, settings: {}, origin: 'https://example.com' }), /blocs ajoutés/)
  const preview = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(cityModule.CityPageContent, { ...snapshot, page: bad })))
  assert.ok(preview.includes('Bloc ajouté à conserver') && preview.includes('role="alert"'))
})

test('normalization is restricted to public known town names, preserving French prose, regions and URLs', () => {
  const city = cities.getCityBySlug('saint-denis')
  const text = `Saint-Denis — ${city.deptName} : réception élégante à Nanteuil-lès-Meaux. https://example.com/Saint-Denis?city=Nanteuil-lès-Meaux`
  const displayed = normalizeWeddingDisplayText(text, city)
  assert.equal(displayed, `Saint Denis — ${city.deptName} : réception élégante à Nanteuil les Meaux. https://example.com/Saint-Denis?city=Nanteuil-lès-Meaux`)
  const snapshot = {
    citySlug: 'chatenay-malabry', pageType: { id: 'mariage' },
    page: { content: 'Texte personnalisé pour Châtenay-Malabry, réception élégante.', generatedAt: new Date().toISOString() },
    config: {}, gallery: [], allTypePages: {}, blogArticles: [],
  }
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(cityModule.CityPageContent, snapshot)))
  assert.ok(html.includes('Texte personnalisé pour Chatenay Malabry, réception élégante.'))
  assert.ok(html.includes('Nanteuil les Meaux'))
})

test('native accordion has keyboard focus styling and explicit plus/minus states', async () => {
  const css = await readFile(resolve(root, 'src/components/VillesPages/WeddingSourceSections.css'), 'utf8')
  assert.ok(css.includes("content: '+'") && css.includes("content: '−'"))
  assert.ok(css.includes('[open]') && css.includes(':focus-visible'))
})

test('importer reproduces exact MIME-decoded original DOM and styles, without file writes', async (t) => {
  const archive = process.env.WEDDING_MODEL_ARCHIVE || '/root/.copilot/uploads/2026-11-06-3b06c384/model.zip'
  try { await access(archive) } catch { t.skip('Set WEDDING_MODEL_ARCHIVE to verify original MHTML fixtures'); return }
  const output = execFileSync('python', ['tools/import-wedding-layouts.py', archive, '--check'], { cwd: root, encoding: 'utf8' })
  assert.equal((output.match(/8 sections, 14 FAQ questions/g) || []).length, 20)
  assert.equal((output.match(/recovered answers: 0/g) || []).length, 20)
})
