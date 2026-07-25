/**
 * Île-de-France departments and neighbouring departments
 * with their main cities and GPS coordinates.
 *
 * Coordinates are city-centre lat/lng (WGS-84).
 * Distance-based backlinks (5 km radius) use the Haversine formula.
 */

export const DEPARTMENTS = [
  // ── Île-de-France ──────────────────────────────────────────────────────────
  {
    code: '75', name: 'Paris', region: 'Île-de-France',
    cities: [
      { slug: 'paris-1er', name: 'Paris 1er', lat: 48.8603, lng: 2.3477 },
      { slug: 'paris-2e',  name: 'Paris 2e',  lat: 48.8669, lng: 2.3491 },
      { slug: 'paris-3e',  name: 'Paris 3e',  lat: 48.8630, lng: 2.3600 },
      { slug: 'paris-4e',  name: 'Paris 4e',  lat: 48.8535, lng: 2.3517 },
      { slug: 'paris-5e',  name: 'Paris 5e',  lat: 48.8462, lng: 2.3508 },
      { slug: 'paris-6e',  name: 'Paris 6e',  lat: 48.8497, lng: 2.3322 },
      { slug: 'paris-7e',  name: 'Paris 7e',  lat: 48.8566, lng: 2.3148 },
      { slug: 'paris-8e',  name: 'Paris 8e',  lat: 48.8750, lng: 2.3080 },
      { slug: 'paris-9e',  name: 'Paris 9e',  lat: 48.8766, lng: 2.3360 },
      { slug: 'paris-10e', name: 'Paris 10e', lat: 48.8764, lng: 2.3601 },
      { slug: 'paris-11e', name: 'Paris 11e', lat: 48.8594, lng: 2.3785 },
      { slug: 'paris-12e', name: 'Paris 12e', lat: 48.8403, lng: 2.3880 },
      { slug: 'paris-13e', name: 'Paris 13e', lat: 48.8316, lng: 2.3590 },
      { slug: 'paris-14e', name: 'Paris 14e', lat: 48.8285, lng: 2.3265 },
      { slug: 'paris-15e', name: 'Paris 15e', lat: 48.8417, lng: 2.2973 },
      { slug: 'paris-16e', name: 'Paris 16e', lat: 48.8629, lng: 2.2763 },
      { slug: 'paris-17e', name: 'Paris 17e', lat: 48.8847, lng: 2.3200 },
      { slug: 'paris-18e', name: 'Paris 18e', lat: 48.8924, lng: 2.3444 },
      { slug: 'paris-19e', name: 'Paris 19e', lat: 48.8830, lng: 2.3800 },
      { slug: 'paris-20e', name: 'Paris 20e', lat: 48.8644, lng: 2.4001 },
    ],
  },
  {
    code: '77', name: 'Seine-et-Marne', region: 'Île-de-France',
    cities: [
      { slug: 'meaux',             name: 'Meaux',             lat: 48.9601, lng: 2.8886 },
      { slug: 'melun',             name: 'Melun',             lat: 48.5432, lng: 2.6573 },
      { slug: 'chelles',           name: 'Chelles',           lat: 48.8780, lng: 2.5897 },
      { slug: 'pontault-combault', name: 'Pontault-Combault', lat: 48.7979, lng: 2.6090 },
      { slug: 'torcy',             name: 'Torcy',             lat: 48.8512, lng: 2.6549 },
      { slug: 'savigny-le-temple', name: 'Savigny-le-Temple', lat: 48.5779, lng: 2.5803 },
      { slug: 'roissy-en-brie',    name: 'Roissy-en-Brie',   lat: 48.7920, lng: 2.6443 },
      { slug: 'marne-la-vallee',   name: 'Marne-la-Vallée',  lat: 48.8450, lng: 2.7100 },
      { slug: 'lognes',            name: 'Lognes',            lat: 48.8380, lng: 2.6261 },
      { slug: 'combs-la-ville',    name: 'Combs-la-Ville',   lat: 48.6601, lng: 2.5606 },
      { slug: 'noisiel',           name: 'Noisiel',           lat: 48.8478, lng: 2.6178 },
      { slug: 'montereau-fault-yonne', name: 'Montereau-Fault-Yonne', lat: 48.3848, lng: 2.9548 },
      { slug: 'provins',           name: 'Provins',           lat: 48.5600, lng: 3.2995 },
      { slug: 'fontainebleau',     name: 'Fontainebleau',     lat: 48.4018, lng: 2.7013 },
    ],
  },
  {
    code: '78', name: 'Yvelines', region: 'Île-de-France',
    cities: [
      { slug: 'versailles',        name: 'Versailles',        lat: 48.8047, lng: 2.1204 },
      { slug: 'saint-germain-en-laye', name: 'Saint-Germain-en-Laye', lat: 48.8999, lng: 2.0940 },
      { slug: 'mantes-la-jolie',   name: 'Mantes-la-Jolie',  lat: 48.9883, lng: 1.7170 },
      { slug: 'poissy',            name: 'Poissy',            lat: 48.9270, lng: 2.0457 },
      { slug: 'sartrouville',      name: 'Sartrouville',      lat: 48.9372, lng: 2.1637 },
      { slug: 'conflans-sainte-honorine', name: 'Conflans-Sainte-Honorine', lat: 49.0000, lng: 2.0966 },
      { slug: 'houilles',          name: 'Houilles',          lat: 48.9268, lng: 2.1916 },
      { slug: 'chatou',            name: 'Chatou',            lat: 48.8935, lng: 2.1638 },
      { slug: 'guyancourt',        name: 'Guyancourt',        lat: 48.7706, lng: 2.0713 },
      { slug: 'elancourt',         name: 'Élancourt',         lat: 48.7844, lng: 2.0403 },
      { slug: 'plaisir',           name: 'Plaisir',           lat: 48.8220, lng: 1.9572 },
      { slug: 'rambouillet',       name: 'Rambouillet',       lat: 48.6470, lng: 1.8285 },
    ],
  },
  {
    code: '91', name: 'Essonne', region: 'Île-de-France',
    cities: [
      { slug: 'evry-courcouronnes', name: 'Évry-Courcouronnes', lat: 48.6333, lng: 2.4419 },
      { slug: 'corbeil-essonnes',   name: 'Corbeil-Essonnes',   lat: 48.6151, lng: 2.4823 },
      { slug: 'massy',              name: 'Massy',              lat: 48.7283, lng: 2.2714 },
      { slug: 'palaiseau',          name: 'Palaiseau',          lat: 48.7150, lng: 2.2461 },
      { slug: 'les-ulis',           name: 'Les Ulis',           lat: 48.6810, lng: 2.1664 },
      { slug: 'sainte-genevieve-des-bois', name: 'Sainte-Geneviève-des-Bois', lat: 48.6410, lng: 2.3388 },
      { slug: 'savigny-sur-orge',   name: 'Savigny-sur-Orge',  lat: 48.6805, lng: 2.3496 },
      { slug: 'viry-chatillon',     name: 'Viry-Châtillon',    lat: 48.6680, lng: 2.3827 },
      { slug: 'grigny',             name: 'Grigny',             lat: 48.6578, lng: 2.3999 },
      { slug: 'ris-orangis',        name: 'Ris-Orangis',        lat: 48.6519, lng: 2.4164 },
      { slug: 'longjumeau',         name: 'Longjumeau',         lat: 48.6946, lng: 2.2936 },
      { slug: 'etampes',            name: 'Étampes',            lat: 48.4338, lng: 2.1607 },
    ],
  },
  {
    code: '92', name: 'Hauts-de-Seine', region: 'Île-de-France',
    cities: [
      { slug: 'nanterre',           name: 'Nanterre',           lat: 48.8924, lng: 2.2070 },
      { slug: 'boulogne-billancourt', name: 'Boulogne-Billancourt', lat: 48.8352, lng: 2.2401 },
      { slug: 'rueil-malmaison',    name: 'Rueil-Malmaison',   lat: 48.8760, lng: 2.1890 },
      { slug: 'asnieres-sur-seine', name: 'Asnières-sur-Seine', lat: 48.9127, lng: 2.2865 },
      { slug: 'colombes',           name: 'Colombes',           lat: 48.9219, lng: 2.2534 },
      { slug: 'courbevoie',         name: 'Courbevoie',         lat: 48.8964, lng: 2.2519 },
      { slug: 'levallois-perret',   name: 'Levallois-Perret',  lat: 48.8950, lng: 2.2875 },
      { slug: 'issy-les-moulineaux', name: 'Issy-les-Moulineaux', lat: 48.8234, lng: 2.2700 },
      { slug: 'clamart',            name: 'Clamart',            lat: 48.7999, lng: 2.2676 },
      { slug: 'antony',             name: 'Antony',             lat: 48.7507, lng: 2.2983 },
      { slug: 'montrouge',          name: 'Montrouge',          lat: 48.8159, lng: 2.3196 },
      { slug: 'chatenay-malabry',   name: 'Châtenay-Malabry',  lat: 48.7666, lng: 2.2651 },
      { slug: 'malakoff',           name: 'Malakoff',           lat: 48.8174, lng: 2.3030 },
      { slug: 'gennevilliers',      name: 'Gennevilliers',      lat: 48.9321, lng: 2.2949 },
      { slug: 'vanves',             name: 'Vanves',             lat: 48.8208, lng: 2.2905 },
      { slug: 'sceaux',             name: 'Sceaux',             lat: 48.7780, lng: 2.2957 },
    ],
  },
  {
    code: '93', name: 'Seine-Saint-Denis', region: 'Île-de-France',
    cities: [
      { slug: 'saint-denis',        name: 'Saint-Denis',        lat: 48.9362, lng: 2.3573 },
      { slug: 'montreuil',          name: 'Montreuil',          lat: 48.8640, lng: 2.4444 },
      { slug: 'aubervilliers',      name: 'Aubervilliers',      lat: 48.9173, lng: 2.3833 },
      { slug: 'bobigny',            name: 'Bobigny',            lat: 48.9089, lng: 2.4398 },
      { slug: 'aulnay-sous-bois',   name: 'Aulnay-sous-Bois',  lat: 48.9406, lng: 2.4923 },
      { slug: 'noisy-le-grand',     name: 'Noisy-le-Grand',    lat: 48.8480, lng: 2.5517 },
      { slug: 'pantin',             name: 'Pantin',             lat: 48.8967, lng: 2.4019 },
      { slug: 'clichy-sous-bois',   name: 'Clichy-sous-Bois',  lat: 48.9096, lng: 2.5547 },
      { slug: 'le-blanc-mesnil',    name: 'Le Blanc-Mesnil',   lat: 48.9397, lng: 2.4615 },
      { slug: 'saint-ouen',         name: 'Saint-Ouen',         lat: 48.9116, lng: 2.3344 },
      { slug: 'bagnolet',           name: 'Bagnolet',           lat: 48.8717, lng: 2.4179 },
      { slug: 'drancy',             name: 'Drancy',             lat: 48.9295, lng: 2.4508 },
      { slug: 'epinay-sur-seine',   name: 'Épinay-sur-Seine',  lat: 48.9543, lng: 2.3116 },
      { slug: 'pierrefitte-sur-seine', name: 'Pierrefitte-sur-Seine', lat: 48.9638, lng: 2.3614 },
    ],
  },
  {
    code: '94', name: 'Val-de-Marne', region: 'Île-de-France',
    cities: [
      { slug: 'creteil',            name: 'Créteil',            lat: 48.7908, lng: 2.4577 },
      { slug: 'vincennes',          name: 'Vincennes',          lat: 48.8479, lng: 2.4393 },
      { slug: 'saint-maur-des-fosses', name: 'Saint-Maur-des-Fossés', lat: 48.7997, lng: 2.4974 },
      { slug: 'ivry-sur-seine',     name: 'Ivry-sur-Seine',    lat: 48.8142, lng: 2.3861 },
      { slug: 'vitry-sur-seine',    name: 'Vitry-sur-Seine',   lat: 48.7877, lng: 2.3964 },
      { slug: 'champigny-sur-marne', name: 'Champigny-sur-Marne', lat: 48.8177, lng: 2.5155 },
      { slug: 'alfortville',        name: 'Alfortville',        lat: 48.8062, lng: 2.4222 },
      { slug: 'choisy-le-roi',      name: 'Choisy-le-Roi',     lat: 48.7652, lng: 2.4093 },
      { slug: 'maisons-alfort',     name: 'Maisons-Alfort',    lat: 48.8057, lng: 2.4376 },
      { slug: 'villejuif',          name: 'Villejuif',          lat: 48.7928, lng: 2.3630 },
      { slug: 'fontenay-sous-bois', name: 'Fontenay-sous-Bois', lat: 48.8538, lng: 2.4764 },
      { slug: 'fresnes',            name: 'Fresnes',            lat: 48.7569, lng: 2.3224 },
      { slug: 'joinville-le-pont',  name: 'Joinville-le-Pont', lat: 48.8180, lng: 2.4693 },
      { slug: 'nogent-sur-marne',   name: 'Nogent-sur-Marne',  lat: 48.8368, lng: 2.4831 },
    ],
  },
  {
    code: '95', name: "Val-d'Oise", region: 'Île-de-France',
    cities: [
      { slug: 'cergy',              name: 'Cergy',              lat: 49.0359, lng: 2.0634 },
      { slug: 'argenteuil',         name: 'Argenteuil',         lat: 48.9467, lng: 2.2467 },
      { slug: 'sarcelles',          name: 'Sarcelles',          lat: 48.9957, lng: 2.3804 },
      { slug: 'saint-ouen-l-aumone', name: "Saint-Ouen-l'Aumône", lat: 49.0456, lng: 2.1066 },
      { slug: 'pontoise',           name: 'Pontoise',           lat: 49.0500, lng: 2.1000 },
      { slug: 'garges-les-gonesse', name: 'Garges-lès-Gonesse', lat: 48.9729, lng: 2.4042 },
      { slug: 'goussainville',      name: 'Goussainville',      lat: 49.0209, lng: 2.4622 },
      { slug: 'eragny',             name: 'Éragny',             lat: 49.0143, lng: 2.1048 },
      { slug: 'franconville',       name: 'Franconville',       lat: 48.9887, lng: 2.2306 },
      { slug: 'herblay',            name: 'Herblay',            lat: 49.0004, lng: 2.1656 },
      { slug: 'taverny',            name: 'Taverny',            lat: 49.0243, lng: 2.2223 },
      { slug: 'villiers-le-bel',    name: 'Villiers-le-Bel',   lat: 49.0003, lng: 2.3997 },
      { slug: 'gonesse',            name: 'Gonesse',            lat: 48.9894, lng: 2.4478 },
      { slug: 'montmorency',        name: 'Montmorency',        lat: 49.0021, lng: 2.3260 },
    ],
  },

  // ── Départements limitrophes ───────────────────────────────────────────────
  {
    code: '02', name: 'Aisne', region: 'Hauts-de-France',
    cities: [
      { slug: 'soissons',           name: 'Soissons',           lat: 49.3814, lng: 3.3236 },
      { slug: 'laon',               name: 'Laon',               lat: 49.5636, lng: 3.6242 },
      { slug: 'saint-quentin',      name: 'Saint-Quentin',      lat: 49.8489, lng: 3.2872 },
      { slug: 'chauny',             name: 'Chauny',             lat: 49.6162, lng: 3.2175 },
    ],
  },
  {
    code: '27', name: 'Eure', region: 'Normandie',
    cities: [
      { slug: 'evreux',             name: 'Évreux',             lat: 49.0228, lng: 1.1518 },
      { slug: 'vernon',             name: 'Vernon',             lat: 49.0917, lng: 1.4867 },
      { slug: 'louviers',           name: 'Louviers',           lat: 49.2207, lng: 1.1620 },
      { slug: 'gisors',             name: 'Gisors',             lat: 49.2793, lng: 1.7756 },
    ],
  },
  {
    code: '28', name: 'Eure-et-Loir', region: 'Centre-Val de Loire',
    cities: [
      { slug: 'chartres',           name: 'Chartres',           lat: 48.4572, lng: 1.4892 },
      { slug: 'dreux',              name: 'Dreux',              lat: 48.7365, lng: 1.3663 },
      { slug: 'chateaudun',         name: 'Châteaudun',         lat: 48.0707, lng: 1.3388 },
    ],
  },
  {
    code: '45', name: 'Loiret', region: 'Centre-Val de Loire',
    cities: [
      { slug: 'orleans',            name: 'Orléans',            lat: 47.9029, lng: 1.9090 },
      { slug: 'montargis',          name: 'Montargis',          lat: 48.0037, lng: 2.7320 },
      { slug: 'pithiviers',         name: 'Pithiviers',         lat: 48.1716, lng: 2.2527 },
    ],
  },
  {
    code: '51', name: 'Marne', region: 'Grand Est',
    cities: [
      { slug: 'reims',              name: 'Reims',              lat: 49.2583, lng: 4.0317 },
      { slug: 'chalons-en-champagne', name: 'Châlons-en-Champagne', lat: 48.9573, lng: 4.3649 },
      { slug: 'epernay',            name: 'Épernay',            lat: 49.0455, lng: 3.9598 },
    ],
  },
  {
    code: '60', name: 'Oise', region: 'Hauts-de-France',
    cities: [
      { slug: 'beauvais',           name: 'Beauvais',           lat: 49.4303, lng: 2.0809 },
      { slug: 'compiegne',          name: 'Compiègne',          lat: 49.4173, lng: 2.8252 },
      { slug: 'creil',              name: 'Creil',              lat: 49.2560, lng: 2.4791 },
      { slug: 'chantilly',          name: 'Chantilly',          lat: 49.1934, lng: 2.4728 },
    ],
  },
  {
    code: '76', name: 'Seine-Maritime', region: 'Normandie',
    cities: [
      { slug: 'rouen',              name: 'Rouen',              lat: 49.4432, lng: 1.0993 },
      { slug: 'le-havre',           name: 'Le Havre',           lat: 49.4938, lng: 0.1079 },
      { slug: 'dieppe',             name: 'Dieppe',             lat: 49.9246, lng: 1.0775 },
    ],
  },
]

/** Flat list of every city across all departments */
export const ALL_CITIES = DEPARTMENTS.flatMap((dept) =>
  dept.cities.map((city) => ({ ...city, deptCode: dept.code, deptName: dept.name }))
)

/**
 * Haversine great-circle distance between two {lat, lng} points (in km).
 */
export function haversineKm(a, b) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinDlat = Math.sin(dLat / 2)
  const sinDlng = Math.sin(dLng / 2)
  const h = sinDlat * sinDlat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDlng * sinDlng
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Returns the list of cities within `radiusKm` of a given city slug.
 */
export function getNearbyCities(slug, radiusKm = 5) {
  const origin = ALL_CITIES.find((c) => c.slug === slug)
  if (!origin) return []
  return ALL_CITIES.filter(
    (c) => c.slug !== slug && haversineKm(origin, c) <= radiusKm
  )
}

/** Find a city by its slug */
export function getCityBySlug(slug) {
  return ALL_CITIES.find((c) => c.slug === slug) || null
}
