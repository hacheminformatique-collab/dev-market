export function normalizeCityName(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
