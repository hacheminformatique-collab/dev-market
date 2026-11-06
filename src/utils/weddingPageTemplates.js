import { getCityBySlug } from '../data/idf-cities'
import { WEDDING_REVIEWS } from '../data/weddingReviews'
import sourceModels from '../data/weddingSourceModels.json'

export const WEDDING_TEMPLATE_VERSION = 2
export const WEDDING_SOURCE_MODELS = sourceModels

const LEGACY_TEMPLATE_FAMILIES = ['presentation', 'organisation', 'reception', 'personnalisation', 'budget', 'acces'].map((id) => ({ id }))
export const WEDDING_TEMPLATE_FAMILIES = sourceModels.map(({ id, label }) => ({ id, label }))

function randomFromSeed(seed) {
  let state = seed
  return () => {
    state += 0x6D2B79F5
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(values, random) {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function generateWeddingPage({ slug, businessName = 'Le Paradise', seed, familyId }) {
  const city = getCityBySlug(slug)
  if (!city || !/^\d{5}$/.test(city.postalCode || '')) throw new Error(`Ville ou code postal invalide : ${slug}`)
  if (!businessName.trim()) throw new Error('Le nom de la salle doit être renseigné.')
  const chosenSeed = seed ?? crypto.getRandomValues(new Uint32Array(1))[0]
  if (!Number.isInteger(chosenSeed) || chosenSeed < 0 || chosenSeed > 0xFFFFFFFF) throw new Error('Graine de génération invalide.')
  const random = randomFromSeed(chosenSeed)
  const selectedModel = sourceModels[Math.floor(random() * sourceModels.length)]
  const model = familyId ? sourceModels.find((item) => item.id === familyId) : selectedModel
  if (!model) throw new Error(`Modèle inconnu : ${familyId}`)
  const content = model.sections.map((section) => section.content
    .replace(/xxxx|yyyy|\$\{businessName\}/g, (marker) => marker === 'xxxx' ? city.name : marker === 'yyyy' ? city.deptName : 'Le Paradise 77')).join('\n\n')
  const reviewIds = shuffle(WEDDING_REVIEWS, random).slice(0, 2).map((review) => review.id)
  return {
    content,
    generatedAt: new Date().toISOString(),
    template: { version: WEDDING_TEMPLATE_VERSION, familyId: model.id, seed: chosenSeed, reviewIds },
  }
}

export function validateWeddingTemplate(template) {
  if (template === undefined) return undefined
  if (!template || ![1, WEDDING_TEMPLATE_VERSION].includes(template.version)
    || !(template.version === 1 ? LEGACY_TEMPLATE_FAMILIES : WEDDING_TEMPLATE_FAMILIES).some((family) => family.id === template.familyId)
    || !Number.isInteger(template.seed) || template.seed < 0 || template.seed > 0xFFFFFFFF
    || !Array.isArray(template.reviewIds) || template.reviewIds.length !== 2
    || new Set(template.reviewIds).size !== 2
    || template.reviewIds.some((id) => !WEDDING_REVIEWS.some((review) => review.id === id))) {
    throw new Error('Modèle ou sélection des avis invalide. Régénérez cette page avant de la publier.')
  }
  return {
    version: template.version,
    familyId: template.familyId,
    seed: template.seed,
    reviewIds: [...template.reviewIds],
  }
}
