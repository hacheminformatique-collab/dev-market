import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolve } from 'node:path'
import { calculateQuote, getFormuleTarif, getQuoteSteps, getFormulaItems } from '../src/utils/formulePricing.js'

const root = resolve(import.meta.dirname, '..')
const menus = [
  { id: 'm1', nomMenu: 'Plat inclus', section: 'Plats', tarif: 80 },
  { id: 'm2', nomMenu: 'Menu non autorise', section: 'Entrée', tarif: 50 },
]
const gateaux = [
  { id: 'g1', nomGateau: 'Gateau inclus', tarif: 15 },
  { id: 'g2', nomGateau: 'Gateau non autorise', tarif: 30 },
]
const prestations = [
  { id: 'p1', nomPresta: 'DJ inclus', tarif: 1000 },
  { id: 'p2', nomPresta: 'Prestation non autorisee', tarif: 2000 },
]
const formule = {
  id: 'f1', nomFormule: 'Forfait test', forfait: true,
  inclusions: { menus: ['m1'], gateaux: ['g1'], prestations: ['p1'] },
  partTraiteurPourcent: 40,
  tarifs: {
    basse: { semaine: 3000, vendredi: 4000, samedi: 5000 },
    haute: { semaine: 3500, vendredi: 4500, samedi: 5500 },
  },
}
const quote = {
  formule, prixSalle: 5000, dateEvenement: '2027-01-09',
  nbAdultes: 100, nbEnfants: 20, nbPersonnes: 120,
  menus: [menus[0]], gateau: gateaux[0], prestations: [prestations[0]],
}

test('global price ignores included catalog prices and uses explicit VAT allocation', () => {
  const result = calculateQuote(quote)
  assert.equal(result.totalTTC, 5000)
  assert.equal(result.menuTotal, 0)
  assert.equal(result.gateauTotal, 0)
  assert.equal(result.prestationsTotal, 0)
  assert.equal(result.partTraiteur, 2000)
  assert.ok(Math.abs(result.totalHT - (3000 / 1.2 + 2000 / 1.1)) < 0.00001)
  assert.ok(Math.abs(result.totalHT + result.totalTVA - 5000) < 0.00001)
  assert.equal(calculateQuote({ ...quote, nbAdultes: 250, nbEnfants: 50 }).totalTTC, 5000)
  assert.equal(calculateQuote({ ...quote, prixSalle: 0 }).totalTTC, 0)
  assert.equal(calculateQuote({ ...quote, formule: { ...formule, partTraiteurPourcent: 100 } }).totalHT, 5000 / 1.1)
})

test('legacy quotes keep separate catalog prices, even after the current formula changes', () => {
  const historic = { ...quote, formule: { id: 'f1', nomFormule: 'Location avec prestation' } }
  const original = structuredClone(historic)
  assert.equal(calculateQuote(historic).totalTTC, 5000 + 8000 + 1800 + 1000)
  assert.deepEqual(historic, original)
  assert.equal(calculateQuote(quote).totalTTC, 5000)
})

test('six season/day prices are keyed by formula, including zero and missing rates', () => {
  for (const [date, amount] of [
    ['2027-01-07', 3000], ['2027-01-08', 4000], ['2027-01-09', 5000],
    ['2027-04-08', 3500], ['2027-04-09', 4500], ['2027-04-10', 5500],
  ]) assert.equal(getFormuleTarif(date, formule), amount)
  assert.equal(getFormuleTarif('2027-01-09', { ...formule, tarifs: undefined }), null)
  assert.equal(getFormuleTarif('2027-01-09', { ...formule, tarifs: { basse: { samedi: 0 } } }), 0)
  assert.equal(getFormuleTarif('2027-01-09', 'Location sèche'), 3500)
  assert.equal(getFormuleTarif('2027-01-09', 'Location avec prestation'), 2500)
  assert.equal(getFormuleTarif('', formule), null)
})

test('all eight category combinations produce only their enabled steps and allowed choices', () => {
  for (let mask = 0; mask < 8; mask++) {
    const inclusions = {}
    const steps = [1, 2, 3]
    for (const [index, category] of ['menus', 'gateaux', 'prestations'].entries()) {
      if (mask & (1 << index)) {
        inclusions[category] = formule.inclusions[category]
        steps.push(index + 4)
      }
    }
    const configured = { ...formule, inclusions }
    assert.deepEqual(getQuoteSteps(configured), [...steps, 7])
    assert.deepEqual(getFormulaItems(configured, 'menus', menus), inclusions.menus ? [menus[0]] : [])
  }
  assert.deepEqual(getQuoteSteps({ nomFormule: 'Location sèche' }), [1, 2, 3, 6, 7])
  assert.deepEqual(getQuoteSteps({ nomFormule: 'Location avec prestation' }), [1, 2, 3, 4, 5, 6, 7])
})

let vite, components, storage, generatePDF
const originalFetch = globalThis.fetch
before(async () => {
  const collections = { paradise_formules: [formule], paradise_menus: menus, paradise_gateaux: gateaux, paradise_prestations: prestations, paradise_clients: [] }
  globalThis.fetch = async (url) => new Response(JSON.stringify(collections[new URL(url, 'http://localhost').searchParams.get('key')] ?? null), { headers: { 'Content-Type': 'application/json' } })
  vite = await createServer({ root, server: { middlewareMode: true } })
  storage = await vite.ssrLoadModule('/src/utils/storage.js')
  await storage.initStorage({ names: ['formules', 'menus', 'gateaux', 'prestations', 'clients'], paced: false, persistDefaults: false })
  components = {}
  for (const name of ['Step3Formule', 'Step4Menu', 'Step5Gateau', 'Step6Options', 'Step7Summary']) {
    components[name] = (await vite.ssrLoadModule(`/src/components/Wizard/steps/${name}.jsx`)).default
  }
  ;({ generatePDF } = await vite.ssrLoadModule('/src/components/PDF/generatePDF.js'))
})
after(async () => {
  await vite?.close()
  globalThis.fetch = originalFetch
})

test('customer choice screens and summary show inclusions instead of catalog amounts', () => {
  for (const name of ['Step4Menu', 'Step5Gateau', 'Step6Options', 'Step7Summary']) {
    const html = renderToStaticMarkup(createElement(components[name], { data: quote, onChange() {}, onNext() {}, onBack() {} }))
    assert.match(html, /Inclus dans votre forfait|incluses dans votre forfait/)
    assert.doesNotMatch(html, /non autoris/)
    assert.doesNotMatch(html, /80 €\/pers|15 €\/pers|1 000 €/)
  }
  const html = renderToStaticMarkup(createElement(components.Step3Formule, { data: quote, onChange() {}, onNext() {}, onBack() {} }))
  assert.match(html, /5 000 €/)
})

test('PDF retains included choices without billing their original prices', () => {
  const doc = generatePDF({ ...quote, devisNumber: 'TEST-FORFAIT', nom: 'Test', prenom: 'Alice' }, { download: false })
  const rows = doc.lastAutoTable.body.map((row) => Object.values(row.cells).map((cell) => cell.raw))
  assert.match(rows[0][0], /Forfait tout compris/)
  assert.equal(rows[0][4], '5 000,00 EUR')
  assert.ok(rows.some((row) => row[0].includes('Plat inclus') && row[4] === 'Inclus'))
  assert.ok(rows.some((row) => row[0].includes('Gateau inclus') && row[4] === 'Inclus'))
  assert.ok(rows.some((row) => row[0].includes('DJ inclus') && row[4] === 'Inclus'))
  assert.equal(rows.length, 4)
})

test('quote persistence waits for server approval and never caches a rejected quote', async () => {
  const previous = storage.getClients()
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Demandes de devis suspendues.' }), { status: 503 })
  await assert.rejects(storage.saveClientsConfirmed([quote]), /Demandes de devis suspendues/)
  assert.deepEqual(storage.getClients(), previous)
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  await storage.saveClientsConfirmed([quote])
  assert.deepEqual(storage.getClients(), [quote])
})
