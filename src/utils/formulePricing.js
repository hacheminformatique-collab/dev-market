export function getSeason(dateStr) {
  if (!dateStr || !Number.isFinite(new Date(dateStr).getTime())) return null
  const month = new Date(`${dateStr.slice(0, 10)}T12:00:00`).getMonth() + 1
  return month === 12 || month <= 3 ? 'basse' : 'haute'
}

export function getFormuleTarif(dateStr, formule) {
  const season = getSeason(dateStr)
  if (!season) return null
  const day = new Date(`${dateStr.slice(0, 10)}T12:00:00`).getDay()
  const key = day === 5 ? 'vendredi' : day === 6 ? 'samedi' : 'semaine'
  const configured = typeof formule === 'object' ? formule?.tarifs?.[season]?.[key] : undefined
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 0) return configured
  if (formule?.forfait) return null
  const name = typeof formule === 'string' ? formule : formule?.nomFormule
  const dry = name?.toLowerCase().includes('sèche')
  const legacy = {
    basse: { semaine: dry ? 2000 : 1000, vendredi: dry ? 2500 : 1500, samedi: dry ? 3500 : 2500 },
    haute: { semaine: dry ? 2500 : 1500, vendredi: dry ? 3500 : 2500, samedi: dry ? 4500 : 3000 },
  }
  return legacy[season][key]
}

export function isCategoryIncluded(formule, category) {
  return formule?.forfait === true && Array.isArray(formule.inclusions?.[category])
}

export function getFormulaItems(formule, category, catalog) {
  if (!formule?.forfait) return catalog
  const ids = formule.inclusions?.[category] || []
  return catalog.filter((item) => ids.includes(item.id))
}

export function getQuoteSteps(formule) {
  if (formule?.forfait) {
    return [1, 2, 3,
      ...(isCategoryIncluded(formule, 'menus') ? [4] : []),
      ...(isCategoryIncluded(formule, 'gateaux') ? [5] : []),
      ...(isCategoryIncluded(formule, 'prestations') ? [6] : []), 7]
  }
  return formule?.nomFormule?.toLowerCase().includes('sèche') ? [1, 2, 3, 6, 7] : [1, 2, 3, 4, 5, 6, 7]
}

export function calcMenuItemTotal(item, nbAdultes, nbEnfants) {
  if (!item.tarif || item.section === 'Boissons') return 0
  if (item.section === 'Cocktail de bienvenu') return item.tarif * (nbAdultes + nbEnfants)
  return item.tarif * (item.section === 'Menu enfants' ? nbEnfants : nbAdultes)
}

export function vatBreakdown(ttc, rate) {
  const ht = ttc / (1 + rate)
  return { ht, tva: ttc - ht, ttc }
}

export function calculateQuote(data) {
  const nbAdultes = parseInt(data.nbAdultes) || data.nbPersonnes || 0
  const nbEnfants = parseInt(data.nbEnfants) || 0
  const nbPersonnes = nbAdultes + nbEnfants
  const prixSalle = data.prixSalle ?? 0
  const menuTotal = data.formule?.forfait ? 0 : (data.menus || []).reduce((sum, item) => sum + calcMenuItemTotal(item, nbAdultes, nbEnfants), 0)
  const gateauTotal = data.formule?.forfait ? 0 : (data.gateau?.tarif || 0) * nbPersonnes
  const prestationsTotal = data.formule?.forfait ? 0 : (data.prestations || []).reduce((sum, item) => sum + (item.tarif || 0), 0)
  const traiteurTotal = menuTotal + gateauTotal
  const partTraiteur = data.formule?.forfait ? prixSalle * (data.formule.partTraiteurPourcent || 0) / 100 : 0
  const salle = vatBreakdown(prixSalle - partTraiteur, 0.20)
  const traiteur = vatBreakdown(traiteurTotal + partTraiteur, 0.10)
  const options = vatBreakdown(prestationsTotal, 0.20)
  return {
    nbAdultes, nbEnfants, nbPersonnes, prixSalle, menuTotal, gateauTotal, traiteurTotal, prestationsTotal,
    salle, traiteur, options, partTraiteur,
    totalTTC: prixSalle + traiteurTotal + prestationsTotal,
    totalHT: salle.ht + traiteur.ht + options.ht,
    totalTVA: salle.tva + traiteur.tva + options.tva,
  }
}
