import { normalizeCityName } from './cityNames'

export function testimonialBlockIndexes(blocks) {
  const hidden = new Set()
  let hiddenLevel = 0
  blocks.forEach((block, index) => {
    const heading = block.match(/^(#{2,3}) /)
    if (heading) {
      const level = heading[1].length
      if (level <= hiddenLevel) hiddenLevel = 0
      if (/^#{2,3} Témoignages\b/i.test(block)) hiddenLevel = level
    }
    if (hiddenLevel) hidden.add(index)
  })
  return hidden
}

export function withoutTestimonials(content) {
  const blocks = content.split(/\n\s*\n/)
  const hidden = testimonialBlockIndexes(blocks)
  return blocks.filter((_, index) => !hidden.has(index)).join('\n\n')
}

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
