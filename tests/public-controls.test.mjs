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
    const home = await readFile(new URL('../src/components/HomePage.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(home, /navigate\('\/admin'\)|navigate\('\/dashboard'\)/)
    const entry = await readFile(new URL('../src/static-city.jsx', import.meta.url), 'utf8')
    assert.doesNotMatch(entry, /initStorage/)
  } finally {
    await vite.close()
  }
})
