import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { normalizeCityName } from '../src/utils/cityNames.js'

test('city names lose all diacritics and punctuation without altering slugs or ordinary prose', () => {
  assert.equal(normalizeCityName('L’Haÿ-les-Roses'), 'L Hay les Roses')
  assert.equal(normalizeCityName('Évry-Courcouronnes'), 'Evry Courcouronnes')
  assert.equal(normalizeCityName('Noël, Château & Cœur'), 'Noel Chateau Coeur')
  assert.equal(normalizeCityName('Sèvres'), 'Sevres')
})

test('public header exposes working access routes without admin links and home removes its admin shortcut', async () => {
  const vite = await createServer({ root: new URL('../', import.meta.url).pathname, server: { middlewareMode: true } })
  try {
    const { default: PublicHeader } = await vite.ssrLoadModule('/src/components/PublicHeader.jsx')
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(createElement(PublicHeader, { businessName: 'Le Paradise' }))
    for (const [url, text] of [['/devis', 'DEMANDER UN DEVIS'], ['/espace-client', 'ESPACE CLIENT'], ['/espace-staff', 'ESPACE STAFF']]) {
      assert.ok(html.includes(`href="${url}"`))
      assert.ok(html.includes(text))
    }
    assert.doesNotMatch(html, /\/admin|\/dashboard/)
    assert.doesNotMatch(html, /href="\/blog"/)
    const home = await readFile(new URL('../src/components/HomePage.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(home, /navigate\('\/admin'\)|navigate\('\/dashboard'\)/)
    const { default: HomePage } = await vite.ssrLoadModule('/src/components/HomePage.jsx')
    const { MemoryRouter } = await import('react-router-dom')
    const homeHtml = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(HomePage)))
    const header = homeHtml.match(/<header[\s\S]*?<\/header>/)[0]
    assert.match(header, /ESPACE STAFF<\/a><a href="\/blog" class="btn btn-outline">BLOG<\/a>/)
    const hero = homeHtml.match(/class="video-hero video-hero-home"([\s\S]*?)<\/video>([\s\S]*?)<\/button>/)[0]
    assert.doesNotMatch(hero, /Demander un devis|Espace client|Espace staff|Blog/)
    assert.match(homeHtml, /👶/)
    assert.doesNotMatch(homeHtml, /🕊/)
    assert.match(homeHtml, /class="home-event-grid"/)
    assert.equal((homeHtml.match(/Mariages &amp; Fiançailles|Anniversaires|Baptêmes|Séminaires/g) || []).length, 4)
    const entry = await readFile(new URL('../src/static-city.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(entry, /initStorage/)
  } finally {
    await vite.close()
  }
})

test('conditions checkbox is after all contact fields, immediately before the Next button', async () => {
  const vite = await createServer({ root: new URL('../', import.meta.url).pathname, server: { middlewareMode: true } })
  try {
    const { default: Step1Client } = await vite.ssrLoadModule('/src/components/Wizard/steps/Step1Client.jsx')
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(createElement(Step1Client, { data: {}, conditionsAccepted: false, onChange() {}, onConditionsChange() {}, onNext() {} }))
    const checkbox = html.indexOf('type="checkbox"')
    assert.ok(html.indexOf('Code postal') < checkbox)
    assert.ok(html.indexOf('<label>Ville</label>') < checkbox)
    assert.ok(checkbox < html.indexOf('Suivant'))
    assert.doesNotMatch(html.slice(checkbox, html.indexOf('Suivant')), /<input(?! type="checkbox")/)
    assert.match(html, /href="\/conditions-generales"/)
    assert.doesNotMatch(html, /type="checkbox"[^>]*checked/)
  } finally {
    await vite.close()
  }
})
