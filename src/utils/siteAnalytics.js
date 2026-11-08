const STORAGE_KEY = 'paradise_analytics_visitor'
const OPT_OUT_KEY = 'paradise_analytics_opt_out'
let fallbackVisitorId = ''
let lastLocationKey = ''

function parisDate() {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function newVisitorId() {
  if (!globalThis.crypto?.getRandomValues) return ''
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function visitorIdForDay(date) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (stored?.date === date && /^[a-f0-9]{32}$/.test(stored.id || '')) return stored.id
    const id = newVisitorId()
    if (!id) return ''
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, id }))
    return id
  } catch {
    if (!fallbackVisitorId) fallbackVisitorId = newVisitorId()
    return fallbackVisitorId
  }
}

export function trackPageView(pathname, locationKey) {
  if (locationKey && locationKey === lastLocationKey) return
  lastLocationKey = locationKey || ''
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === 'true') return
  } catch { /* Continue with anonymous in-memory counting if storage is unavailable. */ }
  if (/^\/(?:admin|dashboard|espace-client(?:\/|$)|espace-staff(?:\/|$)|api(?:\/|$))/.test(pathname)) return

  const date = parisDate()
  const visitorId = visitorIdForDay(date)
  if (!visitorId) {
    console.error('[Analytics] Impossible de créer un identifiant de visite anonyme.')
    return
  }
  fetch('/api/site-analytics.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'track', date, visitorId, path: pathname }),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  }).catch((error) => console.error('[Analytics] Enregistrement de la visite impossible :', error))
}

export function setAnalyticsOptOut(disabled) {
  try {
    if (disabled) {
      localStorage.setItem(OPT_OUT_KEY, 'true')
      localStorage.removeItem(STORAGE_KEY)
    }
    else localStorage.removeItem(OPT_OUT_KEY)
    return true
  } catch {
    return false
  }
}
