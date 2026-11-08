import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import { transformWithOxc } from 'vite'
import { getFormuleTarif, getSeason } from '../src/utils/formulePricing.js'

const source = await readFile(new URL('../src/components/Dashboard/tabs/CalendarTab.jsx', import.meta.url), 'utf8')
const { code } = await transformWithOxc(
  source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\n/gm, '').replace('export default function CalendarTab', 'function CalendarTab'),
  'CalendarTab.jsx',
  { jsx: { runtime: 'classic', pragma: 'React.createElement' } },
)

const tariffs = (value) => ({
  basse: { semaine: value, vendredi: value + 10, samedi: value + 20 },
  haute: { semaine: value + 30, vendredi: value + 40, samedi: value + 50 },
})
const clone = (value) => JSON.parse(JSON.stringify(value))
const dry = { id: 'dry', nomFormule: 'Location sèche', photo: 'keep.jpg', tarifs: tariffs(2000) }
const bundle = { id: 'bundle', nomFormule: 'Forfait fête', forfait: true, tarifs: tariffs(6000), inclusions: { menus: ['menu-1'] } }

function harness(formules = [dry, bundle], clients = [], overrides = {}) {
  const db = { formules: clone(formules), clients: clone(clients), overrides: clone(overrides), clientSaves: 0 }
  const slots = []
  let cursor = 0
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    getFormuleTarif, getSeason,
    getFormules: () => clone(db.formules),
    saveFormules: (value) => { db.formules = clone(value) },
    getClients: () => clone(db.clients),
    saveClients: (value) => { db.clients = clone(value); db.clientSaves++ },
    getCalOverrides: () => clone(db.overrides),
    saveCalOverrides: (value) => { db.overrides = clone(value) },
    getStaff: () => [],
    getCalStaff: () => ({}),
    saveCalStaff: () => {},
    getCalManualEvents: () => [],
    saveCalManualEvents: () => {},
    CalendarView: 'CalendarView',
  })
  vm.runInContext(`${code}\nglobalThis.components = { CalendarTab, PriceGrid, EventDetail, PriceOverrideModal };`, context)
  return {
    db,
    render(name, props = {}) {
      cursor = 0
      return context.components[name](props)
    },
  }
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('')
  if (!tree || typeof tree !== 'object') return tree ?? ''
  return text(tree.props?.children)
}
function button(tree, label, index = 0) {
  const result = nodes(tree).filter((node) => node.type === 'button' && text(node).includes(label))[index]
  assert.ok(result, `Missing button: ${label}`)
  return result
}
const input = (tree, label) => nodes(tree).find((node) => node.type === 'input' && node.props['aria-label']?.includes(label))
const alert = (tree) => nodes(tree).find((node) => node.props?.role === 'alert')

function grid(formules) {
  const h = harness(formules)
  const render = () => h.render('PriceGrid', { formules: h.db.formules, onChange() {} })
  button(render(), 'Grille tarifaire').props.onClick()
  return { ...h, render }
}

test('grid defaults visible, uses formula objects and includes Sunday in weekday rates', () => {
  const h = grid([
    { id: 'a', nomFormule: 'Même nom', tarifs: tariffs(111) },
    { id: 'b', nomFormule: 'Même nom', tarifs: tariffs(222) },
    { id: 'c', nomFormule: 'Nouveau forfait', forfait: true },
    { id: 'd', nomFormule: 'Location sèche' },
  ])
  const tree = h.render()
  assert.equal(button(tree, 'Modifier les tarifs', 3).props.disabled, false)
  assert.match(text(tree), /Dimanche–jeudi/)
  assert.match(text(tree), /111,00/)
  assert.match(text(tree), /222,00/)
  assert.match(text(tree), /À configurer/)
  assert.match(text(tree), /2.*000,00/)
  assert.match(text(tree), /jamais par personne/)
})

test('saving six rates permits zero and preserves catalog metadata and concurrent additions', () => {
  const h = grid([dry, bundle])
  button(h.render(), 'Modifier les tarifs', 1).props.onClick()
  for (const [index, field] of nodes(h.render()).filter((node) => node.type === 'input').entries()) {
    field.props.onChange({ target: { value: String(index) } })
  }
  h.db.formules[1].photo = 'updated-in-other-tab.jpg'
  h.db.formules.push({ id: 'new', nomFormule: 'Concurrent addition' })
  button(h.render(), 'Enregistrer les tarifs').props.onClick()
  assert.deepEqual(h.db.formules[1].tarifs, {
    basse: { semaine: 0, vendredi: 1, samedi: 2 },
    haute: { semaine: 3, vendredi: 4, samedi: 5 },
  })
  assert.deepEqual(h.db.formules[1].inclusions, bundle.inclusions)
  assert.equal(h.db.formules[1].photo, 'updated-in-other-tab.jpg')
  assert.deepEqual(h.db.formules[0], dry)
  assert.equal(h.db.formules[2].id, 'new')
  assert.equal(h.db.clientSaves, 0)
})

test('blank, negative and non-finite grid prices refuse saving with explicit errors', () => {
  for (const value of ['', ' ', '-1', 'Infinity', 'NaN']) {
    const h = grid([bundle])
    button(h.render(), 'Modifier les tarifs').props.onClick()
    input(h.render(), 'Dimanche–jeudi').props.onChange({ target: { value } })
    button(h.render(), 'Enregistrer les tarifs').props.onClick()
    assert.match(text(alert(h.render())), /prix obligatoire, fini et supérieur ou égal à zéro/)
    assert.deepEqual(h.db.formules[0].tarifs, bundle.tarifs)
    assert.ok(button(h.render(), 'Enregistrer les tarifs'))
  }
})

test('new forfait without rates starts blank and cannot save until all six cells are filled', () => {
  const h = grid([{ id: 'new', nomFormule: 'Location sèche incluse', forfait: true }])
  button(h.render(), 'Modifier les tarifs').props.onClick()
  const fields = nodes(h.render()).filter((node) => node.type === 'input')
  assert.equal(fields.length, 6)
  assert.ok(fields.every((field) => field.props.value === ''))
  fields[0].props.onChange({ target: { value: '0' } })
  button(h.render(), 'Enregistrer les tarifs').props.onClick()
  assert.ok(alert(h.render()))
  assert.equal(h.db.formules[0].tarifs, undefined)
})

test('hiding and readding only toggles grid visibility and keeps formulas and rates', () => {
  const h = grid([bundle])
  button(h.render(), 'Masquer de la grille').props.onClick()
  assert.deepEqual(h.db.formules, [{ ...bundle, afficherGrilleTarifaire: false }])
  assert.match(text(h.render()), /Aucune formule affichée/)
  const select = nodes(h.render()).find((node) => node.type === 'select')
  select.props.onChange({ target: { value: bundle.id } })
  button(h.render(), 'Réafficher dans la grille').props.onClick()
  assert.deepEqual(h.db.formules, [{ ...bundle, afficherGrilleTarifaire: true }])
  assert.ok(button(h.render(), 'Modifier les tarifs'))
  assert.equal(h.db.clientSaves, 0)
})

const quote = {
  id: 'quote-1', prenom: 'Alice', nom: 'Martin', dateEvenement: '2026-01-03',
  formule: bundle, prixSalle: 4321, totalTTC: 4321, acompte: 1234,
  nbAdultes: 80, nbEnfants: 10, menus: [], prestations: [],
}

test('EventDetail displays saved forfait global price, not edited grid or daily promo', () => {
  for (const prixSalle of [4321, 0]) {
    const h = harness([bundle])
    const tree = h.render('EventDetail', {
      client: { ...quote, prixSalle, formule: { ...bundle, nomFormule: 'Location sèche en forfait' } },
      formules: [{ ...bundle, tarifs: tariffs(9999) }], staffList: [], assignedStaffIds: [],
      calOverride: { customPrice: 555, isPromo: true },
    })
    assert.match(text(tree), /Forfait TTC global enregistré au devis/)
    assert.ok(text(tree).includes(Number(prixSalle).toLocaleString('fr-FR', { minimumFractionDigits: 2 })))
    assert.doesNotMatch(text(tree), /Prix personnalisé|PROMO EN COURS|Remise prestation incluse/)
    assert.doesNotMatch(text(tree), /non applicable pour une location sèche/)
  }
})

test('dragging and rescheduling forfait quotes preserve all saved monetary amounts', () => {
  const h = harness([bundle], [quote], { '2026-07-04': { customPrice: 1 } })
  let tree = h.render('CalendarTab')
  nodes(tree).find((node) => node.type === 'CalendarView').props.onEventDrop(quote.id, '2026-07-04')
  assert.deepEqual(h.db.clients[0], { ...quote, calendarExcluded: false, dateEvenement: '2026-07-04' })
  tree = h.render('CalendarTab')
  nodes(tree).find((node) => node.type === 'CalendarView').props.onEventClick(quote.id)
  tree = h.render('CalendarTab')
  nodes(tree).find((node) => node.type?.name === 'EventDetail').props.onReschedule('2026-12-25')
  assert.deepEqual(h.db.clients[0], { ...quote, calendarExcluded: false, dateEvenement: '2026-12-25' })
})

test('saving daily override never rewrites saved forfait or prestation quotes', () => {
  for (const formule of [bundle, { id: 'presta', nomFormule: 'Location avec prestation', tarifs: tariffs(3000) }]) {
    const client = { ...quote, formule }
    const h = harness([formule], [client])
    let tree = h.render('CalendarTab')
    nodes(tree).find((node) => node.type === 'CalendarView').props.onEventClick(client.id)
    tree = h.render('CalendarTab')
    nodes(tree).find((node) => node.type?.name === 'EventDetail').props.onPriceOverride()
    tree = h.render('CalendarTab')
    nodes(tree).find((node) => node.type?.name === 'PriceOverrideModal').props.onSave({ customPrice: 0, isPromo: true })
    assert.deepEqual(h.db.clients[0], client)
    assert.equal(h.db.clientSaves, 0)
    assert.equal(h.db.overrides['2026-01-03'].customPrice, 0)
  }
})

test('legacy dry rental still honors daily overrides while prestation uses its object rates', () => {
  for (const formule of [dry, { id: 'presta', nomFormule: 'Location avec prestation', tarifs: tariffs(3000) }]) {
    const h = harness([formule], [{ ...quote, formule }], { '2026-07-04': { customPrice: 0 } })
    const tree = h.render('CalendarTab')
    nodes(tree).find((node) => node.type === 'CalendarView').props.onEventDrop(quote.id, '2026-07-04')
    assert.equal(h.db.clients[0].prixSalle, formule.id === dry.id ? 0 : 3050)
  }
})

test('daily override modal permits zero and rejects blank, negative and infinite values', () => {
  for (const value of ['0', '', '-1', 'Infinity']) {
    const h = harness([dry])
    let saved
    const render = () => h.render('PriceOverrideModal', {
      dateStr: '2026-01-03', formules: [dry], onSave: (data) => { saved = data },
    })
    nodes(render()).find((node) => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value } })
    button(render(), 'Enregistrer').props.onClick()
    if (value === '0') assert.equal(saved.customPrice, 0)
    else {
      assert.equal(saved, undefined)
      assert.match(text(alert(render())), /prix TTC valide/)
    }
  }
})
