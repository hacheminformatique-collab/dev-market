import { ALL_CITIES, getCityBySlug } from '../data/idf-cities'

export function canonicalCityPages(pages = {}) {
  const result = {}
  // Canonical keys take priority over legacy copies of the same page.
  const entries = Object.entries(pages).sort(([a], [b]) => Number(a === getCityBySlug(a)?.slug) - Number(b === getCityBySlug(b)?.slug))
  for (const [slug, page] of entries) {
    const keyedCity = getCityBySlug(slug)
    const city = keyedCity?.slug === slug ? keyedCity : (getCityBySlug(page?.city?.slug) || keyedCity)
    const key = city?.slug || slug
    result[key] = page
  }
  return result
}

export const legacyCityAliases = Object.fromEntries(
  ALL_CITIES.filter((city) => getCityBySlug(city.legacySlug).slug === city.slug)
    .map((city) => [city.legacySlug, city.slug]),
)

export function ungeneratedCitySlugs(department, pages) {
  const existing = canonicalCityPages(pages)
  return department.cities.filter((city) => !existing[city.slug]?.content?.trim()).map((city) => city.slug)
}
