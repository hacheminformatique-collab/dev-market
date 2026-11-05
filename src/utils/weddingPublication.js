import { getCityBySlug } from '../data/idf-cities'

export function isPublicPath(pathname) {
  return pathname === '/' || pathname === '/devis' || pathname === '/blog'
    || pathname.startsWith('/blog/') || /^\/locationsalle[^/]*\/[^/]+\/?$/.test(pathname)
    || ['/mentions-legales', '/conditions-generales', '/politique-confidentialite'].includes(pathname)
}

export async function getPublishedWeddingSlugs() {
  const response = await fetch('/wedding-pages.json', { cache: 'no-store' })
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`Liste des pages publiées inaccessible (HTTP ${response.status}).`)
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Liste des pages publiées invalide. Republiez les pages mariage avec la version actuelle du site.')
  }
  const slugs = await response.json()
  if (!Array.isArray(slugs) || slugs.some((slug) => typeof slug !== 'string' || !getCityBySlug(slug))) {
    throw new Error('Liste des villes publiées invalide.')
  }
  return [...new Set(slugs)]
}
