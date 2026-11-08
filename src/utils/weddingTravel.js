export const PARADISE_ADDRESS = 'Le Paradise, 5 avenue Fridingen, 77100 Nanteuil-lès-Meaux, France'
export const PARADISE_COORDS = { lat: 48.937362, lng: 2.882801 }

const ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving'
// Public routing service: keep at most one request per second, one city at a time.
const MIN_INTERVAL_MS = 1100
let nextSlot = 0
let queue = Promise.resolve()

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function validateWeddingTravel(travel) {
  if (travel === undefined) return undefined
  if (!travel || !Number.isInteger(travel.km) || travel.km < 0 || travel.km > 500
    || !Number.isInteger(travel.minutes) || travel.minutes < 1 || travel.minutes > 600
    || typeof travel.source !== 'string' || !travel.source
    || typeof travel.computedAt !== 'string' || Number.isNaN(new Date(travel.computedAt).getTime())) {
    throw new Error('Trajet enregistré invalide. Mettez à jour les trajets avant de publier.')
  }
  return { km: travel.km, minutes: travel.minutes, source: travel.source, computedAt: travel.computedAt }
}

// Replace the travel figures copied from the source models with the computed route.
// « Gare de Meaux … 15 min en voiture » is unrelated and intentionally left as is.
export function applyWeddingTravel(text, travel) {
  if (!travel) return text
  return text
    .replace(/≈ \d+ min en voiture/g, `≈ ${travel.minutes} min en voiture`)
    .replace(/\b\d+ km depuis /g, `${travel.km} km depuis `)
    .replace(/(ne prend que|à seulement|un trajet de|accédez en|En seulement) \d+ minutes/g, `$1 ${travel.minutes} minutes`)
}

function schedule(task) {
  const run = queue.then(async () => {
    const delay = nextSlot - Date.now()
    if (delay > 0) await wait(delay)
    nextSlot = Date.now() + MIN_INTERVAL_MS
    return task()
  })
  // Keep scheduling usable after a failure; the caller still receives the rejection.
  queue = run.catch(() => {})
  return run
}

export function fetchWeddingTravel(city, { fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  if (!Number.isFinite(city?.lat) || !Number.isFinite(city?.lng)) {
    return Promise.reject(new Error(`Coordonnées inconnues pour ${city?.name || 'cette ville'}.`))
  }
  const url = `${ROUTING_URL}/${city.lng},${city.lat};${PARADISE_COORDS.lng},${PARADISE_COORDS.lat}?overview=false&alternatives=false&steps=false`
  return schedule(async () => {
    let response
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new Error('Service d’itinéraire injoignable. Aucune page n’a été enregistrée pour cette ville ; réessayez plus tard.')
    }
    if (response.status === 429 || response.status === 509) {
      throw new Error('Service d’itinéraire saturé. Patientez quelques minutes avant de relancer.')
    }
    const data = response.ok ? await response.json().catch(() => null) : null
    const route = data?.code === 'Ok' ? data.routes?.[0] : null
    if (!route || !Number.isFinite(route.distance) || route.distance < 0
      || !Number.isFinite(route.duration) || route.duration < 0) {
      throw new Error(`Itinéraire introuvable (HTTP ${response.status}). Aucune valeur estimée n’a été publiée.`)
    }
    return validateWeddingTravel({
      km: Math.round(route.distance / 1000),
      minutes: Math.max(1, Math.round(route.duration / 60)),
      source: 'osrm',
      computedAt: now().toISOString(),
    })
  })
}
