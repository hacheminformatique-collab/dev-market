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
      const prompt = `Tu es un expert en rédaction SEO pour des salles de réception et de mariage en France.
Génère un contenu SEO très riche et détaillé pour la page web de la ville de "${cityName}" (${deptName}).
L'établissement s'appelle "${businessName}" — une salle de mariage et réception de prestige en Seine-et-Marne (77).

INSTRUCTIONS OBLIGATOIRES :
- Le texte DOIT faire AU MINIMUM 1500 mots
- Les termes suivants DOIVENT chacun apparaître AU MOINS 30 fois dans l'ensemble du texte : "salle de mariage", "réception", "le Paradise 77", "mariage"
- Intègre ces termes dans les titres (H2 et H3) également, pas seulement dans le corps du texte
- Utilise le format markdown : ## pour les titres H2 et ### pour les sous-titres H3
- Commence DIRECTEMENT par un titre ## (sans introduction ni meta-commentary)
- Structure le contenu en au moins 10 sections distinctes avec des titres H2 et des sous-titres H3
- Intègre naturellement les mots clés supplémentaires : ${keywords || 'mariage, anniversaire, baptême, soirée privée'}
- Chaque section doit contenir au moins 4 à 6 phrases avec les mots clés obligatoires répétés
- Le texte doit être naturel, convaincant, chaleureux et favorable au référencement (SEO)

Structure recommandée (à adapter) :
## Salle de mariage et réception à ${cityName} — le Paradise 77
### Votre salle de mariage de prestige près de ${cityName}
[paragraphe de 6+ phrases avec "salle de mariage", "réception", "le Paradise 77", "mariage" répétés]
## Organiser votre mariage à ${cityName} avec le Paradise 77
### La salle de réception idéale pour votre mariage à ${cityName}
[paragraphe de 6+ phrases...]
## Le Paradise 77 : salle de mariage incontournable près de ${cityName}
[...]
## Nos offres de réception et mariage pour ${cityName}
[...]
## Pourquoi choisir le Paradise 77 pour votre mariage près de ${cityName}
[...]
## Capacité et prestations de notre salle de mariage
[...]
## Traiteur et services pour votre réception à ${cityName}
[...]
## Témoignages — mariages et réceptions organisés depuis ${cityName}
[...]
## Réserver votre salle de mariage à ${cityName}
[...]
## Le Paradise 77 : votre partenaire mariage en ${deptName}
[...]`

      const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + githubToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
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
  const kw0 = kws[0] || 'mariage'
  const kw1 = kws[1] || 'anniversaire'
  const kw2 = kws[2] || 'baptême'
  const kw3 = kws[3] || 'soirée privée'

  return `## Salle de mariage et réception à ${cityName} — le Paradise 77

### Votre salle de mariage de prestige près de ${cityName}

Vous cherchez une **salle de mariage** exceptionnelle à proximité de ${cityName} (${deptName}) ? **Le Paradise 77** est la salle de réception et de mariage de référence en Seine-et-Marne. Notre salle de mariage accueille vos événements les plus précieux avec un soin exceptionnel apporté à chaque détail. Le Paradise 77 est votre partenaire idéal pour un mariage inoubliable près de ${cityName}. Que vous organisiez un mariage, une réception, un ${kw1} ou une ${kw3}, notre salle de mariage est prête à vous accueillir dans un cadre somptueux. Depuis ${cityName}, rejoindre le Paradise 77 ne prend que quelques minutes, faisant de notre salle de réception le choix évident pour tous vos événements.

Notre salle de mariage est réputée dans toute la région pour la qualité de ses prestations de réception. Le Paradise 77 propose des formules de mariage complètes et personnalisées. Chaque mariage célébré dans notre salle de réception est unique, car notre équipe travaille en étroite collaboration avec les mariés. La salle de mariage du Paradise 77 peut accueillir des cérémonies intimes comme de grands mariages. Notre salle de réception offre un cadre raffiné qui sublime chaque instant de votre mariage. Le Paradise 77 est la salle de mariage et réception préférée des couples de ${cityName} et de toute la ${deptName}.

## Organiser votre mariage à ${cityName} avec le Paradise 77

### La salle de réception idéale pour votre mariage depuis ${cityName}

Organiser un mariage depuis ${cityName} n'a jamais été aussi simple grâce au Paradise 77. Notre salle de mariage et de réception est facilement accessible depuis ${cityName} et toute la région. Le Paradise 77 prend en charge l'organisation complète de votre mariage et de votre réception. Notre salle de mariage dispose de tous les équipements nécessaires pour un mariage réussi. La réception dans notre salle de mariage est synonyme d'élégance et de prestige. Chaque détail de votre mariage est pensé par notre équipe expérimentée de la salle de réception.

Le Paradise 77 est la salle de mariage qui répond à tous vos rêves. Notre salle de réception peut être décorée selon vos envies pour votre mariage. Les mariages organisés au Paradise 77 sont des événements mémorables pour tous les invités. Notre salle de mariage à proximité de ${cityName} est le cadre parfait pour débuter votre vie commune. La réception au Paradise 77 se déroule dans une ambiance festive et chaleureuse. Votre mariage dans notre salle de mariage sera le plus beau jour de votre vie.

## Le Paradise 77 : salle de mariage et réception incontournable près de ${cityName}

### Pourquoi choisir le Paradise 77 pour votre mariage ?

Le Paradise 77 s'impose comme la salle de mariage de référence pour les habitants de ${cityName}. Notre salle de réception bénéficie d'une réputation d'excellence dans toute la ${deptName}. Choisir le Paradise 77 pour votre mariage, c'est opter pour une salle de réception haut de gamme. Notre salle de mariage allie tradition et modernité pour un mariage parfait. Le Paradise 77 est la salle de réception qui correspond à tous les budgets et à tous les styles de mariage. Des mariages intimes aux grandes réceptions, notre salle de mariage s'adapte à tous vos besoins.

La salle de mariage du Paradise 77 a accueilli des centaines de mariages depuis ${cityName} et les environs. Notre salle de réception est disponible pour les mariages toute l'année. Le Paradise 77 garantit un mariage et une réception dans les meilleures conditions. Notre salle de mariage est équipée d'une cuisine professionnelle pour des réceptions gastronomiques. Le Paradise 77 est le partenaire de confiance pour votre mariage et votre réception. Notre salle de mariage est régulièrement plébiscitée par les couples de ${cityName}.

## Nos formules de mariage et réception pour ${cityName}

### Des packages mariage complets au Paradise 77

Le Paradise 77 propose des formules de mariage adaptées à toutes les envies. Notre salle de réception offre des packages mariage tout inclus pour simplifier l'organisation. La salle de mariage du Paradise 77 peut être louée à la demi-journée ou à la journée entière. Notre salle de réception propose des menus de mariage variés et personnalisables. Le Paradise 77 travaille avec les meilleurs prestataires pour votre mariage et votre réception. Notre salle de mariage inclut un service traiteur de qualité pour vos réceptions.

Parmi nos formules de mariage au Paradise 77 :
• **${kw0.charAt(0).toUpperCase() + kw0.slice(1)}** — notre salle de mariage se transforme en cadre de rêve
• **${kw1.charAt(0).toUpperCase() + kw1.slice(1)}** — la salle de réception accueille tous vos proches
• **${kw2.charAt(0).toUpperCase() + kw2.slice(1)}** — le Paradise 77 organise votre réception religieuse
• **${kw3.charAt(0).toUpperCase() + kw3.slice(1)}** — notre salle de mariage se prête à tous les événements

Notre salle de réception au Paradise 77 peut accueillir jusqu'à plusieurs centaines de convives pour votre mariage. Le Paradise 77 est la salle de mariage qui offre le meilleur rapport qualité-prix de la région. Depuis ${cityName}, profitez de notre salle de réception exceptionnelle pour votre mariage.

## Capacité et équipements de notre salle de mariage

### Une salle de réception moderne et spacieuse pour vos mariages

La salle de mariage du Paradise 77 est l'une des plus grandes salles de réception de la ${deptName}. Notre salle de mariage peut accueillir confortablement plusieurs centaines d'invités pour votre réception. Le Paradise 77 dispose d'une salle de mariage modulable selon vos besoins. Notre salle de réception est équipée des dernières technologies son et lumière pour un mariage réussi. La salle de mariage du Paradise 77 offre un parking privé pour tous vos invités. Notre salle de réception dispose d'espaces extérieurs pour des mariages en plein air.

Le Paradise 77 propose une salle de mariage climatisée et chauffée pour un confort optimal en toutes saisons. Notre salle de réception est entièrement accessible aux personnes à mobilité réduite pour un mariage inclusif. La salle de mariage du Paradise 77 est équipée d'un système d'éclairage scénique de qualité professionnelle. Notre salle de réception propose une scène et une piste de danse pour animer votre mariage. Le Paradise 77 met à disposition du matériel audiovisuel complet pour votre réception. Notre salle de mariage est le cadre idéal pour un mariage photographié sous son meilleur angle.

## Traiteur et restauration pour votre réception à ${cityName}

### Un service de restauration d'exception pour votre mariage

Le Paradise 77 propose un service traiteur de qualité pour accompagner votre mariage et votre réception. Notre salle de mariage dispose d'une cuisine entièrement équipée pour des réceptions gastronomiques. Le Paradise 77 travaille avec des traiteurs partenaires spécialisés dans les mariages et les réceptions. Notre salle de réception offre des menus de mariage personnalisables selon vos goûts et votre budget. La salle de mariage du Paradise 77 peut accueillir des traiteurs halal, casher ou végétariens pour votre réception. Depuis ${cityName}, bénéficiez du meilleur service traiteur pour votre mariage au Paradise 77.

Notre salle de mariage propose des cocktails dînatoires, des buffets et des repas assis pour votre réception. Le Paradise 77 garantit une restauration de qualité supérieure pour tous vos mariages. Notre salle de réception travaille avec des pâtissiers renommés pour les gâteaux de mariage. La salle de mariage du Paradise 77 dispose d'un bar entièrement équipé pour animer votre réception. Notre salle de mariage offre des prestations œnologiques pour les amateurs de vins à l'occasion de votre mariage. Le Paradise 77 est la salle de réception qui sublime chaque repas de mariage.

## Décoration et ambiance de la salle de mariage

### Le Paradise 77, la salle de réception qui sublime votre mariage

La salle de mariage du Paradise 77 bénéficie d'une décoration raffinée et élégante. Notre salle de réception peut être personnalisée aux couleurs de votre mariage. Le Paradise 77 propose des décorations florales pour embellir votre salle de mariage. Notre salle de mariage dispose d'un espace lounge pour accueillir vos invités avant la réception. La salle de réception du Paradise 77 est un lieu de mariage qui impressionne dès l'entrée. Notre salle de mariage bénéficie d'une lumière naturelle exceptionnelle pour des photos de mariage sublimes.

Le Paradise 77 collabore avec des décorateurs professionnels pour transformer notre salle de réception selon vos désirs. Notre salle de mariage peut accueillir des thèmes variés : mariage champêtre, mariage oriental, mariage bohème... Le Paradise 77 est la salle de réception qui s'adapte à tous les styles de mariage. Notre salle de mariage propose des espaces photo dédiés pour immortaliser votre réception. La salle de réception du Paradise 77 dispose de jardins et d'espaces verts pour des photos de mariage en plein air. Notre salle de mariage est le cadre parfait pour un mariage de rêve depuis ${cityName}.

## Témoignages de mariages organisés au Paradise 77 depuis ${cityName}

### Ce que disent les couples qui ont choisi notre salle de mariage

De nombreux couples de ${cityName} ont fait confiance au Paradise 77 pour leur mariage et leur réception. Notre salle de mariage a reçu d'excellents avis pour la qualité de ses prestations de réception. Les mariages organisés au Paradise 77 sont unanimement salués par les mariés et leurs invités. Notre salle de réception est reconnue comme l'une des meilleures salles de mariage de la région. Le Paradise 77 est la salle de mariage qui tient toutes ses promesses. Notre salle de réception reçoit régulièrement des témoignages élogieux de la part des couples depuis ${cityName}.

« Notre mariage au Paradise 77 était magique — la salle de réception était somptueuse et le service impeccable. »
« Depuis ${cityName}, nous avons choisi le Paradise 77 pour notre mariage et nous ne le regrettons pas. »
« La salle de mariage du Paradise 77 a dépassé toutes nos attentes pour notre réception. »

## Réserver votre salle de mariage au Paradise 77 depuis ${cityName}

### Comment réserver le Paradise 77 pour votre mariage ou votre réception ?

Réserver la salle de mariage du Paradise 77 depuis ${cityName} est simple et rapide. Notre salle de réception est disponible pour les mariages et réceptions toute l'année. Le Paradise 77 vous accueille pour une visite de notre salle de mariage sur rendez-vous. Notre salle de réception propose des formules de mariage sur mesure adaptées à votre budget. La salle de mariage du Paradise 77 se réserve à l'avance pour garantir la disponibilité de votre date de mariage. Contactez le Paradise 77 dès aujourd'hui pour organiser votre mariage et votre réception depuis ${cityName}.

Notre salle de mariage répond à toutes vos questions sur les modalités de réservation. Le Paradise 77 vous accompagne de A à Z dans l'organisation de votre mariage et de votre réception. Notre salle de réception offre un devis personnalisé pour votre mariage. La salle de mariage du Paradise 77 est votre meilleur allié pour un mariage réussi depuis ${cityName}. Notre salle de réception en ${deptName} attend vos appels pour organiser ensemble votre mariage de rêve. Faites confiance au Paradise 77, la salle de mariage et réception incontournable de la région.

## Le Paradise 77 : votre partenaire mariage et réception en ${deptName}

### La salle de mariage la plus appréciée près de ${cityName}

Le Paradise 77 est la salle de mariage et de réception de référence en ${deptName}. Notre salle de mariage dessert ${cityName} et toutes les communes environnantes. Le Paradise 77 est facilement accessible depuis ${cityName} par autoroute et transports en commun. Notre salle de réception est idéalement située pour accueillir des invités venant de toute l'Île-de-France. La salle de mariage du Paradise 77 est un établissement reconnu pour ses mariages et réceptions de qualité. Notre salle de réception a été primée pour l'excellence de ses services de mariage.

Le Paradise 77 est la salle de mariage qui transforme vos rêves en réalité. Notre salle de réception a accueilli des centaines de mariages mémorables depuis ${cityName}. La salle de mariage du Paradise 77 est le lieu idéal pour commencer une belle aventure. Notre salle de réception propose des tarifs compétitifs pour des mariages d'exception. Le Paradise 77 est la salle de mariage et réception qui vous garantit un événement inoubliable. Depuis ${cityName}, choisissez le Paradise 77 pour votre mariage — vous ne le regretterez jamais.`
}
