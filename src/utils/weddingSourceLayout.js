import sourceLayouts from '../data/weddingSourceLayouts.json'
import { WEDDING_SOURCE_MODELS, validateWeddingTemplate } from './weddingPageTemplates'
import { normalizeCityName } from './cityNames'
import { normalizeWeddingDisplayText } from './weddingDisplayText'

export const WEDDING_SOURCE_LAYOUTS = sourceLayouts

export function injectWeddingSource(text, city, legacy = false) {
  const injected = text.replace(/xxxx|yyyy|\$\{businessName\}/g, (marker) =>
    marker === 'xxxx' ? (legacy ? city.name : normalizeCityName(city.name))
      : marker === 'yyyy' ? city.deptName : 'Le Paradise 77')
  return legacy ? injected : normalizeWeddingDisplayText(injected, city)
}

function headingLevel(block) {
  return block.match(/^#{2,3} /)?.[0] || ''
}

// V2 saves one markdown document, not a DOM. Keep its block-level prose edits
// in the corresponding source cards; structural edits cannot be mapped safely.
export function resolveWeddingSourceLayout(page, city) {
  const template = validateWeddingTemplate(page.template)
  if (template?.version !== 2) return null
  const model = WEDDING_SOURCE_MODELS.find((item) => item.id === template.familyId)
  const savedBlocks = page.content.trim().split(/\n\s*\n/)
  const expectedBlocks = model.sections.flatMap((section) => section.content.split('\n\n'))
  if (savedBlocks.length !== expectedBlocks.length) {
    throw new Error('Le texte personnalisé est conservé, mais ses blocs ajoutés ou supprimés ne peuvent pas être associés à la mise en page du modèle. Rétablissez sa structure avant publication.')
  }
  let offset = 0
  const sections = model.sections.map((section, index) => {
    const originals = section.content.split('\n\n')
    const blocks = originals.map((original, blockIndex) => {
      const saved = savedBlocks[offset + blockIndex]
      const generated = injectWeddingSource(original, city)
      const legacy = injectWeddingSource(original, city, true)
      if (headingLevel(saved) !== headingLevel(original)) {
        throw new Error('Le texte personnalisé est conservé, mais les niveaux de titres du modèle ont été modifiés. Rétablissez sa structure avant publication.')
      }
      if (section.id === 'faq' && saved !== generated && saved !== legacy) {
        throw new Error('Les questions FAQ personnalisées sont conservées, mais ne correspondent plus aux réponses connues du modèle. Rétablissez les questions source avant publication.')
      }
      return saved === legacy || saved === generated ? generated : normalizeWeddingDisplayText(saved, city)
    })
    offset += originals.length
    return { id: section.id, tree: sourceLayouts.models[model.id][index], blocks, originals }
  })
  return { model, sections }
}

export function sourceStyle(styleId) {
  const style = sourceLayouts.styles[styleId]
  if (!style) return undefined
  return Object.fromEntries(style.split(';').filter((part) => part.includes(':')).map((part) => {
    const colon = part.indexOf(':')
    const property = part.slice(0, colon).trim()
    const key = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    return [key, part.slice(colon + 1).trim()]
  }))
}
