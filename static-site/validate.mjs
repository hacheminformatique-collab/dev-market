import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import { cityTemplateIds, selectCityTemplate } from './city-content.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(root, 'dist')
const { departments } = JSON.parse(await readFile(path.join(root, 'communes.json'), 'utf8'))
const config = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'))
const cities = departments.flatMap((d) => d.cities)
const names = await readdir(out)
const cityFiles = new Set(cities.map((c) => c.file))
assert.equal(cityFiles.size, cities.length, 'Les URLs ville doivent être uniques')
assert.equal(cities.length, 1283, 'Le modèle fourni comporte 1283 URLs ville')
assert.equal(departments.length, 8)
const htmlFiles = names.filter((name) => name.endsWith('.html') && name !== '404.html')
assert.equal(htmlFiles.length, cities.length + departments.length + 8)
const known = new Set([...names, ...(await readdir(path.join(root, 'dist', 'assets'))).map((name) => `assets/${name}`)])
const titles = new Set()
const sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8')
assert.equal([...sitemap.matchAll(/<loc>/g)].length, htmlFiles.length)
let checkedLinks = 0
const templateCounts = Object.fromEntries(cityTemplateIds.map((id) => [id, 0]))
let minimumCityWords = Infinity
let maximumCityWords = 0
for (const file of htmlFiles) {
  const html = await readFile(path.join(out, file), 'utf8')
  const title = html.match(/<title>(.*?)<\/title>/)?.[1]
  assert.ok(title, `Title absent : ${file}`)
  assert.ok(!titles.has(title), `Title dupliqué : ${file}`)
  titles.add(title)
  assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1, `Un seul H1 attendu : ${file}`)
  assert.ok(html.includes('name="description"'), `Description absente : ${file}`)
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1]
  const expected = new URL(file === 'index.html' ? '/' : file, config.siteUrl).href
  assert.equal(canonical, expected)
  assert.ok(sitemap.includes(`<loc>${expected}</loc>`), `URL absente du sitemap : ${file}`)
  const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1]
  const schema = JSON.parse(json)
  const venue = schema['@graph'].find((item) => item['@type']?.includes('EventVenue'))
  assert.equal(venue.address.addressLocality, config.city)
  assert.equal(venue.address.postalCode, config.postalCode)
  assert.ok(!html.includes('<iframe'), 'Les lecteurs externes doivent attendre un clic')
  for (const [, attr, url] of html.matchAll(/\b(href|src|action)="([^"]+)"/g)) {
    if (/^(https:|tel:|mailto:|#)/.test(url)) continue
    assert.ok(known.has(url), `Lien ${attr} cassé dans ${file} : ${url}`)
    checkedLinks++
  }
  if (cityFiles.has(file)) {
    for (const city of cities) assert.ok(html.includes(`href="${city.file}"`), `Maillage incomplet : ${file} → ${city.file}`)
    const city = cities.find((c) => c.file === file)
    assert.ok(html.includes(city.postalCode))
    assert.ok(html.includes(city.name === config.city ? 'Votre commune accueille notre établissement.' : 'La salle ne se trouve pas à'))
    const template = html.match(/data-city-template="([^"]+)"/)?.[1]
    assert.equal(template, selectCityTemplate(file).id, `Modèle incorrect : ${file}`)
    templateCounts[template]++
    const editorial = html.match(/<div class="city-editorial"[^>]*>(.*?)<\/div><section class="section final">/s)?.[1]
    assert.ok(editorial, `Contenu éditorial absent : ${file}`)
    assert.ok(!/\{(?:city|department|venue|venueCity)\}/.test(editorial), `Variable non remplacée : ${file}`)
    assert.ok(!/\bLe Le\b/i.test(editorial), `Nom de salle mal composé : ${file}`)
    const visible = editorial.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const wordCount = visible.split(/\s+/).filter(Boolean).length
    assert.ok(wordCount >= 2500, `Texte ville trop court, hors maillage (${wordCount} mots) : ${file}`)
    assert.ok((visible.match(/location de salle de mariage/gi) || []).length >= 6, `Expression principale absente des textes : ${file}`)
    minimumCityWords = Math.min(minimumCityWords, wordCount)
    maximumCityWords = Math.max(maximumCityWords, wordCount)
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id))
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `Ancre cassée : ${file} #${id}`)
  }
}
for (const count of Object.values(templateCounts)) {
  assert.ok(count >= cities.length * 0.2 && count <= cities.length * 0.3, 'Répartition des quatre modèles déséquilibrée')
}
for (const asset of ['site.css', 'site.js', 'favicon.svg', 'salle-reception.jpg', 'tables-reception.jpg', 'decoration-table.jpg', 'art-de-la-table.jpg']) {
  assert.ok((await stat(path.join(out, 'assets', asset))).size > 0)
}
console.log(`${htmlFiles.length} pages validées : titles uniques, H1, canonicals, schema.org, sitemap, ${checkedLinks} liens internes et maillage complet des ${cities.length} villes.`)
console.log(`Texte éditorial hors maillage : ${minimumCityWords} à ${maximumCityWords} mots. Modèles : ${JSON.stringify(templateCounts)}`)
