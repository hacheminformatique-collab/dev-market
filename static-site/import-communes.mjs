import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const source = process.argv[2]
if (!source) throw new Error('Usage: node static-site/import-communes.mjs /chemin/des/pages-modeles')
const names = {
  '75': 'Paris', '77': 'Seine-et-Marne', '78': 'Yvelines', '91': 'Essonne',
  '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': "Val-d’Oise",
}
const departments = []
const allFiles = new Set()
for (const [code, name] of Object.entries(names)) {
  const html = await readFile(path.join(source, `${code}-2.html`), 'utf8')
  const cities = []
  for (const match of html.matchAll(/href="([a-z0-9-]+-(\d{5})\.html)"[^>]*>([^<]+)</g)) {
    const [, file, postalCode, rawName] = match
    if (allFiles.has(file)) throw new Error(`URL dupliquée : ${file}`)
    allFiles.add(file)
    const cityName = code === '75'
      ? `Paris ${Number(postalCode.slice(2))}${postalCode === '75001' ? 'er' : 'e'} arrondissement`
      : rawName.trim().replaceAll('&amp;', '&').replaceAll('&#39;', "'")
    cities.push({ name: cityName, file, postalCode })
  }
  if (!cities.length) throw new Error(`Aucune ville trouvée pour ${code}`)
  departments.push({ code, name, cities })
}
await writeFile(path.join(root, 'communes.json'), JSON.stringify({
  source: 'Liens des huit pages département HTML fournies par le propriétaire. Liste historique, non vérifiée auprès de l’API geo.api.gouv.fr (inaccessible).',
  departments,
}, null, 2) + '\n')
console.log(`${allFiles.size} pages ville importées ; ${departments.length} départements.`)
