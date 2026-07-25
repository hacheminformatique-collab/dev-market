/**
 * Storage helpers for the "Pages Client" feature.
 *
 * City pages config and generated content are persisted through the same
 * PHP back-end as the rest of the application
 * (`/api/storage.php?key=<key>`).  We keep a separate module so the main
 * storage.js stays focused on the original features.
 */

const KEY_CONFIG   = 'paradise_city_pages_config'
const KEY_PAGES    = 'paradise_city_pages'
const KEY_GALLERY  = 'paradise_city_gallery'
const KEY_BACKUP   = 'paradise_city_pages_backup'

// ── Helpers ────────────────────────────────────────────────────────────────

async function _get(key) {
  try {
    const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`)
    if (res.ok) {
      const data = await res.json()
      if (data !== null && data !== undefined) return data
    }
  } catch { /* server unreachable */ }
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted */ }
  return null
}

async function _set(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
  try {
    await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch { /* server unreachable – localStorage backup still written */ }
}

// ── Config (keywords, social, Google Maps key) ─────────────────────────────

export const DEFAULT_CONFIG = {
  keywords: '',
  businessName: 'Le Paradise',
  businessType: 'salle de réception',
  googleMapsApiKey: '',
  instagramUsername: '',
  instagramPosts: [],   // array of post URLs to embed
  tiktokUsername: '',
  tiktokPosts: [],      // array of post URLs to embed
  githubToken: '',      // used for AI content generation via GitHub Models API
}

export async function getCityPagesConfig() {
  const data = await _get(KEY_CONFIG)
  return { ...DEFAULT_CONFIG, ...(data || {}) }
}

export async function saveCityPagesConfig(config) {
  await _set(KEY_CONFIG, config)
}

// ── Generated pages ────────────────────────────────────────────────────────

/**
 * Returns the map of generated pages:  { [citySlug]: { content, generatedAt } }
 */
export async function getCityPages() {
  return (await _get(KEY_PAGES)) || {}
}

export async function saveCityPages(pages) {
  await _set(KEY_PAGES, pages)
}

// ── Photo gallery ──────────────────────────────────────────────────────────

/**
 * Gallery is stored as an array of base64 data-URL strings.
 */
export async function getCityGallery() {
  return (await _get(KEY_GALLERY)) || []
}

export async function saveCityGallery(photos) {
  await _set(KEY_GALLERY, photos)
}

// ── Backup ─────────────────────────────────────────────────────────────────

/**
 * Backs up the current pages before generating new ones.
 * Keeps only the last 5 backups to avoid unbounded growth.
 */
export async function backupCityPages() {
  const current = await getCityPages()
  if (!current || Object.keys(current).length === 0) return

  const existing = (await _get(KEY_BACKUP)) || []
  const entry = { snapshot: current, backedUpAt: new Date().toISOString() }
  const updated = [entry, ...existing].slice(0, 5)
  await _set(KEY_BACKUP, updated)
}

export async function getCityPagesBackups() {
  return (await _get(KEY_BACKUP)) || []
}

// ── AI content generation ──────────────────────────────────────────────────

/**
 * Generates rich SEO content for a city using GitHub Models API
 * (https://models.inference.ai.azure.com).
 *
 * Falls back to a local template when the API is unavailable or the token is
 * not configured.
 */
export async function generateCityContent(cityName, deptName, keywords, businessName, businessType, githubToken) {
  if (githubToken) {
    try {
      const prompt = `Tu es un expert en rédaction SEO pour des salles de réception en France.
Génère un texte riche en mots clés pour une page web optimisée pour la ville de "${cityName}" (${deptName}).
L'entreprise s'appelle "${businessName}" et propose des services de "${businessType}".
Mots clés à intégrer naturellement : ${keywords}.
Le texte doit faire environ 300 mots, être naturel, convaincant et favorable au référencement naturel (SEO).
Commence directement par le texte, sans titre ni introduction.`

      const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + githubToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.7,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const text = json.choices?.[0]?.message?.content?.trim()
        if (text) return text
      }
    } catch { /* API unavailable – fall through to template */ }
  }

  // ── Local template fallback ──────────────────────────────────────────────
  const kws = keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : []
  return `Vous êtes à la recherche d'une ${businessType} à ${cityName} (${deptName}) pour votre prochain événement ? **${businessName}** est votre partenaire idéal pour organiser une soirée inoubliable.

Nichée au cœur de la région parisienne, notre salle accueille vos ${kws[0] || 'événements'} avec un soin particulier apporté à chaque détail. Que vous planifiiez un ${kws[1] || 'mariage'}, un ${kws[2] || 'anniversaire'} ou une ${kws[3] || 'soirée privée'}, notre équipe professionnelle est à votre disposition pour faire de votre projet une réalité.

À seulement quelques kilomètres de ${cityName}, **${businessName}** dispose d'une salle modulable pouvant accueillir jusqu'à plusieurs centaines de convives. Nos formules tout inclus vous permettent de profiter pleinement de votre événement sans vous soucier de la logistique.

**Nos services à ${cityName} et ses environs :**
${kws.map((k) => `• ${k.charAt(0).toUpperCase() + k.slice(1)}`).join('\n')}

Faites confiance à **${businessName}** pour un événement mémorable à ${cityName}. Contactez-nous dès aujourd'hui pour obtenir un devis personnalisé et découvrir toutes nos offres adaptées à vos besoins et à votre budget.`
}
