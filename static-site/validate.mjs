import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

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
    assert.ok(html.includes('La salle ne se trouve pas à'))
  }
}
for (const asset of ['site.css', 'site.js', 'favicon.svg', 'salle-reception.jpg', 'tables-reception.jpg', 'decoration-table.jpg', 'art-de-la-table.jpg']) {
  assert.ok((await stat(path.join(out, 'assets', asset))).size > 0)
}
console.log(`${htmlFiles.length} pages validées : titles uniques, H1, canonicals, schema.org, sitemap, ${checkedLinks} liens internes et maillage complet des ${cities.length} villes.`)
