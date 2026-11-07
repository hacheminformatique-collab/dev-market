import { siteFetch as fetch } from './siteFetch'
import { getCityBySlug } from '../data/idf-cities'
import { WEDDING_DEPARTMENTS } from './weddingDepartments'

export function isPublicPath(pathname) {
  return pathname === '/' || pathname === '/devis' || pathname === '/blog'
    || pathname.startsWith('/blog/') || /^\/locationsalle[^/]*\/[^/]+\/?$/.test(pathname)
    || /^\/locationsalledemariage\/departements\/\d{2}\/?$/.test(pathname)
    || ['/mentions-legales', '/conditions-generales', '/politique-confidentialite'].includes(pathname)
}

export async function getPublishedWeddingDepartments() {
  const response = await fetch('/wedding-departments.json', { cache: 'no-store' })
  if (response.status === 404) return []
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Registre des départements inaccessible ou invalide.')
  const codes = await response.json()
  if (!Array.isArray(codes) || codes.some((code) => !WEDDING_DEPARTMENTS.some((department) => department.code === code))) throw new Error('Liste des départements publiée invalide.')
  return [...new Set(codes)]
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
  return [...new Set(slugs.map((slug) => getCityBySlug(slug).slug))]
}
