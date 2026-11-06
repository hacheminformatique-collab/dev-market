import { normalizeCityName } from './cityNames'

export function normalizeWeddingDisplayText(text, city) {
  if (!text) return text
  const lower = text.toLowerCase()
  const names = [...new Set([city?.name, 'Nanteuil-lès-Meaux'].filter(Boolean))]
    .filter((name) => normalizeCityName(name) !== name && lower.includes(name.toLowerCase()))
  if (!names.length) return text
  const department = city?.deptName?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const protectedParts = new RegExp(`(https?:\\/\\/\\S+${department ? `|${department}` : ''})`, 'g')
  // Normalize only known town names, never French prose or captured URLs.
  return text.split(protectedParts).map((part) => {
    if (/^https?:\/\//.test(part) || part === city?.deptName) return part
    return names.reduce((value, name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return value.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), normalizeCityName(name))
    }, part)
  }).join('')
}
