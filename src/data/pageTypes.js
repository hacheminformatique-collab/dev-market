/**
 * Centralised definition of all city-page types.
 *
 * Each entry describes one "section" of pages that can be generated per city:
 *   id          – internal identifier (also used as storage-key suffix)
 *   basePath    – URL base path for the public-facing city pages
 *   dashboardId – id used in the Dashboard tab list
 *   label       – human-readable tab label (Dashboard)
 *   icon        – emoji icon shown in the Dashboard tab
 *   mainKeyword – primary SEO keyword injected into AI prompt / fallback template
 *   seoCityTitle – template for <title> on a city page  ({{city}} and {{business}} are replaced)
 *   seoCityDesc  – template for meta description        ({{city}}, {{dept}}, {{business}})
 */
export const PAGE_TYPES = [
  {
    id: 'mariage',
    basePath: '/locationsalledemariage',
    dashboardId: 'pages-mariage',
    label: 'Pages salle de mariage',
    icon: '💍',
    mainKeyword: 'location salle de mariage',
    seoCityTitle: 'Salle de mariage à {{city}} — {{business}}',
    seoCityDesc: '{{business}} accompagne vos mariages et réceptions à {{city}} ({{dept}}). Découvrez nos prestations et demandez un devis gratuit.',
  },
  {
    id: 'reception',
    basePath: '/locationsalledereception',
    dashboardId: 'pages-reception',
    label: 'Pages salle de réception',
    icon: '🥂',
    mainKeyword: 'location salle de réception',
    seoCityTitle: 'Salle de réception à {{city}} — {{business}}',
    seoCityDesc: '{{business}} propose une salle de réception de prestige pour vos événements à {{city}} ({{dept}}). Devis gratuit en ligne.',
  },
  {
    id: 'anniversaire',
    basePath: '/locationsalleanniversaire',
    dashboardId: 'pages-anniversaire',
    label: 'Pages salle anniversaire',
    icon: '🎂',
    mainKeyword: 'location de salle pour anniversaire',
    seoCityTitle: 'Salle anniversaire à {{city}} — {{business}}',
    seoCityDesc: 'Organisez votre anniversaire à {{city}} ({{dept}}) avec {{business}}. Salle festive, traiteur et animations. Devis gratuit.',
  },
  {
    id: 'bapteme',
    basePath: '/locationsallebapteme',
    dashboardId: 'pages-bapteme',
    label: 'Pages salle de baptême',
    icon: '👶',
    mainKeyword: 'location de salle pour baptême',
    seoCityTitle: 'Salle de baptême à {{city}} — {{business}}',
    seoCityDesc: 'Célébrez le baptême de votre enfant à {{city}} ({{dept}}) dans la salle de réception {{business}}. Devis gratuit.',
  },
  {
    id: 'fiancaille',
    basePath: '/locationsallefiancaille',
    dashboardId: 'pages-fiancaille',
    label: 'Pages salle de fiançailles',
    icon: '💑',
    mainKeyword: 'location de salle pour fiançailles',
    seoCityTitle: 'Salle de fiançailles à {{city}} — {{business}}',
    seoCityDesc: 'Organisez vos fiançailles à {{city}} ({{dept}}) chez {{business}}. Cadre romantique et prestation haut de gamme. Devis gratuit.',
  },
  {
    id: 'seminaire',
    basePath: '/locationsalleseminaire',
    dashboardId: 'pages-seminaire',
    label: 'Pages salle de séminaire',
    icon: '🏢',
    mainKeyword: "location de salle pour séminaire d'entreprise",
    seoCityTitle: "Salle de séminaire à {{city}} — {{business}}",
    seoCityDesc: "Organisez votre séminaire d'entreprise à {{city}} ({{dept}}) avec {{business}}. Espace professionnel équipé. Devis gratuit.",
  },
]

/** Lookup map: id → pageType */
export const PAGE_TYPES_BY_ID = Object.fromEntries(PAGE_TYPES.map((pt) => [pt.id, pt]))

/** Lookup map: basePath → pageType */
export const PAGE_TYPES_BY_PATH = Object.fromEntries(PAGE_TYPES.map((pt) => [pt.basePath, pt]))
