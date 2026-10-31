import test from 'node:test'
import assert from 'node:assert/strict'
import { cityTemplateIds, selectCityTemplate, renderCityContent } from './city-content.mjs'

const config = {
  name: 'Le Paradise', city: 'Nanteuil-lès-Meaux',
  address: '5 avenue Fridingen', postalCode: '77100',
}
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const render = (file, name = 'Ville témoin') => renderCityContent({
  city: { name, file, postalCode: '77100' },
  department: { name: 'Département témoin', code: '77' },
  config, escape, itinerary: 'https://www.google.com/maps/dir/?api=1&origin=Ville',
  gallery: () => '<div class="gallery"></div>',
})

test('les quatre pages sources conservent leur modèle', () => {
  assert.equal(cityTemplateIds.length, 4)
  for (const id of cityTemplateIds) assert.equal(selectCityTemplate(`${id}-77100.html`).id, id)
  assert.equal(selectCityTemplate('les-pavillons-sous-bois-93320.html').id, 'pavillons-sous-bois')
})

test('le choix du modèle ne dépend ni du hasard ni de l’ordre de génération', () => {
  const files = ['meaux-77100.html', 'rueil-malmaison-92500.html', 'neuilly-sur-seine-92200.html']
  const first = files.map((file) => selectCityTemplate(file).id)
  for (const file of [...files].reverse()) {
    assert.equal(selectCityTemplate(file).id, first[files.indexOf(file)])
    assert.equal(render(file), render(file))
  }
})

test('chaque modèle contient des textes longs et toutes les rubriques sans ville source résiduelle', () => {
  const outputs = []
  for (const id of cityTemplateIds) {
    const html = render(`${id}-77100.html`)
    outputs.push(html)
    assert.ok(html.includes(`data-city-template="${id}"`))
    assert.ok(html.includes('Ville témoin'))
    assert.ok(html.includes('Département témoin'))
    assert.ok(html.includes('La salle ne se trouve pas à Ville témoin'))
    assert.ok(!/\bLe Le\b/i.test(html))
    assert.ok(!/\{(?:city|department|venue|venueCity)\}/.test(html))
    for (const source of ['Aubervilliers', 'Bobigny', 'Boulogne-Billancourt', 'Pavillons-sous-Bois']) {
      assert.ok(!html.includes(source), `Ville source résiduelle : ${source}`)
    }
    const plain = html.replace(/<[^>]+>/g, ' ')
    assert.ok(plain.split(/\s+/).filter(Boolean).length >= 2500)
    for (const key of ['prestations', 'reservation', 'equipements', 'galerie', 'ceremonie', 'conseils', 'questions', 'acces']) {
      assert.equal([...html.matchAll(new RegExp(`id="${key}-ville"`, 'g'))].length, 1)
    }
    assert.ok(!/jusqu’à \d+|sous 24h|\d+ minutes/.test(plain), 'Promesse non confirmée')
  }
  assert.equal(new Set(outputs).size, 4)
})

test('la page de la commune de la salle ne nie pas sa présence', () => {
  const html = render('nanteuil-les-meaux-77100.html', config.city)
  assert.ok(html.includes('Votre commune accueille notre établissement.'))
  assert.ok(!html.includes('La salle ne se trouve pas à'))
})

test('le nom d’une ville commençant par une voyelle utilise une élision', () => {
  assert.ok(render('aubervilliers-93300.html', 'Aubervilliers').includes('couples d’Aubervilliers'))
})

test('les valeurs ville sont échappées avant insertion en HTML', () => {
  const html = render('test-77100.html', '<script>alert("ville")</script>')
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('api=1&amp;origin=Ville'))
})
