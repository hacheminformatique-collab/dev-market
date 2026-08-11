import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getSettings } from '../../utils/storage'

function buildCGV(settings) {
  const l = settings.legalInfo || {}
  const rs      = l.raisonSociale   || 'AFM'
  const enseigne = l.enseigne       || settings.nom || 'PARADISE'
  const forme   = l.formeJuridique  || 'SARL'
  const capital = l.capital         || '7 500,00 EUR'
  const siret   = l.siret           || '904 543 816'
  const siren   = l.siren           || '904 543 816'
  const tva     = l.tva             || 'FR06904543816'
  const rcs     = l.rcs             || 'Meaux'
  const adresse = l.adresse         || '5 avenue FRIDINGEN 77100 NANTEUIL LES MEAUX'
  const ape     = l.ape             || '68.20B'
  const dateStr = l.dateImmatriculation
    ? new Date(l.dateImmatriculation).toLocaleDateString('fr-FR')
    : '01/11/2021'

  return `CONDITIONS GÉNÉRALES DE LOCATION ET DE PRESTATIONS - ${enseigne.toUpperCase()}

ARTICLE 1 : OBJET ET IDENTITÉ DU PRESTATAIRE
Les presentes conditions regissent les relations contractuelles entre la societe ${rs} (Enseigne ${enseigne}), ${forme} au capital de ${capital}, immatriculee au RCS de ${rcs} sous le SIRET ${siret}, dont le siege social est situe au ${adresse}, et le Client. Elles s'appliquent de plein droit a toutes les prestations de location de salle (seche ou avec options), de restauration (Traiteur) et de services evenementiels proposees par ${rs}.

ARTICLE 2 : DESTINATION DES LIEUX
Le lieu de reception est exclusivement destine a accueillir l'evenement precise sur le devis. Les locaux sont loues a titre prive et temporaire pour la duree strictement definie au contrat. Toute modification de l'objet de l'evenement sans accord ecrit de ${rs} peut entrainer l'annulation immediate du contrat.

ARTICLE 3 : ÉQUIPEMENTS
Le Client declare parfaitement connaitre les lieux loues pour les avoir visites. Toute friture ou cuisson vive reste strictement interdite a l'interieur.

ARTICLE 4 : DURÉE ET HORAIRES
La fin de l'evenement est fixee a l'heure mentionnee au devis. Tout depassement sera facture 150 EUR TTC par heure entamee.

ARTICLE 5 : MODALITÉS DE PAIEMENT
Les prix sont exprimes en euros TTC. Taux de TVA : 10% pour la restauration, 20% pour la location et les services. Un acompte de 1 500 EUR minimum est exige a la signature. Le solde total doit etre regle au plus tard 45 jours avant l'evenement.

ARTICLE 6 : ANNULATION PAR LE CLIENT
En cas d'annulation, les acomptes verses restent definitivement acquis a la societe ${rs}. La date etant reservee exclusivement pour le Client, le solde reste du a ${rs} a titre de dedommagement. Conformement a l'Art. L221-28 du Code de la Consommation, aucun droit de retractation ne s'applique.

ARTICLE 7 : NOMBRE DE CONVIVES
Le nombre exact de convives doit etre confirme par ecrit au plus tard 15 jours ouvrables avant l'evenement. Une baisse de plus de 10% de l'effectif ne pourra donner lieu a une reduction du prix total convenu.

ARTICLE 8 : DÉPÔT DE GARANTIE
Un depot de garantie de 3 000 EUR par cheque est exige le jour de l'evenement. Il sera restitue dans un delai de 7 jours ouvres apres verification des equipements.

ARTICLE 9 : RESPONSABILITÉ ET ASSURANCES
Le Client doit fournir une attestation d'assurance Responsabilite Civile "Organisateur d'evenement" au plus tard 30 jours avant l'evenement. ${rs} decline toute responsabilite en cas de vol ou de dommage subi par les biens personnels.

ARTICLE 10 : SÉCURITÉ ET ORDRE PUBLIC
L'usage de flammes reelles, chichas, encens, cierges magiques est strictement interdit. Les tirs de mortiers, feux d'artifice et petards sont strictement interdits. Le service d'alcool aux mineurs est strictement interdit.

ARTICLE 11 : CESSION
Toute cession ou sous-location de la salle est strictement interdite.

ARTICLE 12 : FORCE MAJEURE
En cas d'evenement imprevisible, la prestation pourra etre reportee via un avoir de 12 mois. Aucun remboursement ne pourra etre exige.

ARTICLE 13 : RÉSOLUTION ET LITIGES
Le present contrat sera resilie immediatement en cas de violation d'une clause de securite majeure. A defaut d'accord amiable, tout litige sera porte devant le Tribunal de ${rcs.toUpperCase()} (77).

ARTICLE 14 : PROTECTION DES DONNÉES (RGPD)
Les informations collectees sont necessaires pour la gestion de votre reservation. Vous disposez d'un droit d'acces et de rectification en contactant la ${forme} ${rs}.

${rs.toUpperCase()} - ${enseigne.toUpperCase()} - ${adresse.toUpperCase()}
${forme} au capital de ${capital} - SIREN ${siren} - TVA ${tva}
RCS ${rcs.toUpperCase()} (inscrit le ${dateStr}) - NAF ${ape}`
}

/**
 * Format a monetary amount for use inside PDF tables.
 * Avoids locale-specific non-breaking spaces (U+202F / U+00A0) that can cause
 * jsPDF-autotable to split numbers at unexpected positions.
 */
function formatPdfMoney(n) {
  const val = Number(n || 0).toFixed(2).replace('.', ',')
  // insert regular thousand separator
  const [int, dec] = val.split(',')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${intFmt},${dec} EUR`
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function vatBreakdown(ttc, rate) {
  const ht = ttc / (1 + rate)
  const tva = ttc - ht
  return { ht, tva, ttc }
}

function calcMenuItemTotal(item, nbAdultes, nbEnfants) {
  if (!item.tarif) return 0
  if (item.section === 'Cocktail de bienvenu') return item.tarif * (nbAdultes + nbEnfants)
  if (item.section === 'Menu enfants') return item.tarif * nbEnfants
  if (item.section === 'Boissons') return 0
  return item.tarif * nbAdultes
}

export function generatePDF(devis, options = {}) {
  const { download = true } = options
  const settings = getSettings()
  const l = settings.legalInfo || {}
  const nomEnseigne = l.enseigne || settings.nom || 'LE PARADISE'
  const adresseSiege = l.adresse || '5 avenue Fridingen, 77100 Nanteuil les Meaux'
  const telContact = l.telephone || '0782821582'
  const emailContact = l.email || 'contact@leparadise77.fr'
  const raisonSociale = l.raisonSociale || 'SARL AFM'
  const forme = l.formeJuridique || 'SARL'
  const rcs = l.rcs || 'Meaux'
  const siren = l.siren || '904543816'

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 20
  const marginR = 14
  const usableW = pageW - marginL - marginR   // 176 mm
  let y = 20

  // ---- Header — fond blanc, encadré discret ----
  doc.setFillColor(245, 245, 250)
  doc.rect(0, 0, pageW, 44, 'F')
  doc.setDrawColor(200, 200, 210)
  doc.line(0, 44, pageW, 44)

  let headerTextX = marginL
  if (settings.logo) {
    try {
      doc.addImage(settings.logo, marginL, 6, 28, 22)
      headerTextX = marginL + 32
    } catch { /* fallback to text-only header */ }
  }

  doc.setTextColor(30, 30, 50)
  doc.setFontSize(settings.logo ? 17 : 20)
  doc.setFont('helvetica', 'bold')
  doc.text(nomEnseigne, headerTextX, 18)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 100)
  doc.text(adresseSiege, headerTextX, 26)
  doc.text(`Tél : ${telContact}   ${emailContact}`, headerTextX, 32)

  // Devis title — right side
  doc.setTextColor(30, 30, 50)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('DEVIS', pageW - marginR, 18, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 100)
  doc.text(devis.devisNumber || '', pageW - marginR, 26, { align: 'right' })
  const dateStr = new Date(devis.createdAt || Date.now()).toLocaleDateString('fr-FR')
  doc.text(`Date : ${dateStr}`, pageW - marginR, 33, { align: 'right' })

  y = 54

  // ---- Client info ----
  doc.setFillColor(248, 248, 252)
  doc.setDrawColor(220, 220, 230)
  doc.roundedRect(marginL, y, usableW / 2 - 4, 32, 3, 3, 'FD')
  doc.setTextColor(30, 30, 50)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENT', marginL + 4, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  doc.text(`${devis.prenom || ''} ${devis.nom || ''}`.trim(), marginL + 4, y + 14)
  if (devis.adresse) doc.text(devis.adresse, marginL + 4, y + 19)
  doc.text(`Email : ${devis.email || '—'}`, marginL + 4, y + 24)
  doc.text(`Tél : ${devis.telephone || '—'}`, marginL + 4, y + 29)

  // ---- Event info ----
  const evBoxX = marginL + usableW / 2 + 4
  const evBoxW = usableW / 2 - 4
  doc.setFillColor(248, 248, 252)
  doc.roundedRect(evBoxX, y, evBoxW, 32, 3, 3, 'FD')
  doc.setTextColor(30, 30, 50)
  doc.setFont('helvetica', 'bold')
  doc.text('ÉVÉNEMENT', evBoxX + 4, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  const evDate = devis.dateEvenement ? new Date(devis.dateEvenement).toLocaleDateString('fr-FR') : '—'
  doc.text(`Type : ${devis.typeEvenement || '—'}`, evBoxX + 4, y + 14)
  doc.text(`Date : ${evDate}`, evBoxX + 4, y + 19)
  const nbAdultes = parseInt(devis.nbAdultes) || devis.nbPersonnes || 0
  const nbEnfants = parseInt(devis.nbEnfants) || 0
  const nbPersonnes = nbAdultes + nbEnfants
  doc.text(`Pers. : ${nbPersonnes} (${nbAdultes} ad.${nbEnfants > 0 ? ` + ${nbEnfants} enf.` : ''})`, evBoxX + 4, y + 24)
  if (devis.heureDebut) doc.text(`Horaires : ${devis.heureDebut} — ${devis.heureFin || ''}`, evBoxX + 4, y + 29)

  y += 40

  // Formule
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 50)
  doc.text(`Formule : `, marginL, y)
  doc.setFont('helvetica', 'normal')
  doc.text(devis.formule?.nomFormule || '—', marginL + 22, y)
  y += 10

  // ---- Pricing table ----
  const prixSalle = devis.prixSalle || 0
  const menuTotal = (devis.menus || []).reduce((s, m) => s + calcMenuItemTotal(m, nbAdultes, nbEnfants), 0)
  const gateauTotal = (devis.gateau?.tarif || 0) * nbPersonnes
  const traiteurTotal = menuTotal + gateauTotal
  const prestationsTotal = (devis.prestations || []).reduce((s, p) => s + (p.tarif || 0), 0)

  const isAvecPrestation = devis.formule?.nomFormule && !devis.formule.nomFormule.toLowerCase().includes('sèche')
  let remiseMontant = 0
  if (isAvecPrestation && devis.dateEvenement) {
    const month = new Date(devis.dateEvenement).getMonth() + 1
    const day = new Date(devis.dateEvenement).getDay()
    const isBasSaison = (month === 12 || month <= 3)
    let prixSec, prixPresta
    if (isBasSaison) {
      if (day === 5) { prixSec = 2500; prixPresta = 1500 }
      else if (day === 6) { prixSec = 3500; prixPresta = 2500 }
      else { prixSec = 2000; prixPresta = 1000 }
    } else {
      if (day === 5) { prixSec = 3500; prixPresta = 2500 }
      else if (day === 6) { prixSec = 4500; prixPresta = 3000 }
      else { prixSec = 2500; prixPresta = 1500 }
    }
    remiseMontant = prixSec - prixPresta
    if (remiseMontant < 0) remiseMontant = 0
  }

  const salle = vatBreakdown(prixSalle, 0.20)
  const traiteur = vatBreakdown(traiteurTotal, 0.10)
  const optionsVat = vatBreakdown(prestationsTotal, 0.20)
  const totalHT = salle.ht + traiteur.ht + optionsVat.ht
  const totalTVA = salle.tva + traiteur.tva + optionsVat.tva
  const totalTTC = prixSalle + traiteurTotal + prestationsTotal

  const rows = []
  if (prixSalle > 0) {
    rows.push([
      `Location salle\n${devis.formule?.nomFormule || ''}`,
      '20%',
      formatPdfMoney(salle.ht),
      formatPdfMoney(salle.tva),
      formatPdfMoney(prixSalle),
    ])
  }
  if (isAvecPrestation && remiseMontant > 0) {
    const prixSecBase = prixSalle + remiseMontant
    rows.push([
      `REMISE prestation incluse\nTarif seche ${formatPdfMoney(prixSecBase)} -> prestation ${formatPdfMoney(prixSalle)}`,
      '20%',
      formatPdfMoney(-remiseMontant / 1.20),
      formatPdfMoney(-remiseMontant / 1.20 * 0.20),
      formatPdfMoney(-remiseMontant),
    ])
  }

  if ((devis.menus || []).length > 0) {
    const menuLines = (devis.menus || []).filter((m) => m.tarif > 0).map((m) => {
      const total = calcMenuItemTotal(m, nbAdultes, nbEnfants)
      return `${m.nomMenu} (${m.tarif} EUR/pers.) = ${formatPdfMoney(total)}`
    }).join('\n')
    if (menuLines && menuTotal > 0) {
      const menuHT = vatBreakdown(menuTotal, 0.10)
      rows.push([
        `Traiteur - Menus\n${menuLines}`,
        '10%',
        formatPdfMoney(menuHT.ht),
        formatPdfMoney(menuHT.tva),
        formatPdfMoney(menuTotal),
      ])
    }
  }

  if (gateauTotal > 0) {
    const gateauHT = vatBreakdown(gateauTotal, 0.10)
    rows.push([
      `Gateau - ${devis.gateau?.nomGateau || ''}\n${nbPersonnes} pers. x ${devis.gateau?.tarif} EUR`,
      '10%',
      formatPdfMoney(gateauHT.ht),
      formatPdfMoney(gateauHT.tva),
      formatPdfMoney(gateauTotal),
    ])
  }

  for (const p of (devis.prestations || [])) {
    const pHT = vatBreakdown(p.tarif, 0.20)
    rows.push([
      `${p.nomPresta}\n${p.description || ''}`,
      '20%',
      formatPdfMoney(pHT.ht),
      formatPdfMoney(pHT.tva),
      formatPdfMoney(p.tarif),
    ])
  }

  // Column widths: sum = usableW = 176 mm
  // Désignation: 88  TVA%: 12  HT: 26  TVA€: 22  TTC: 28
  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [['Désignation', 'TVA', 'HT', 'TVA €', 'TTC']],
    body: rows,
    foot: [
      ['', 'Sous-total HT', formatPdfMoney(totalHT), '', ''],
      ['', 'TVA totale', formatPdfMoney(totalTVA), '', ''],
      ['', 'TOTAL TTC', '', '', formatPdfMoney(totalTTC)],
    ],
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      textColor: [30, 30, 30],
      font: 'helvetica',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [50, 50, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    footStyles: {
      fillColor: [235, 235, 245],
      textColor: [30, 30, 30],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 88, fontStyle: 'normal' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [249, 249, 253] },
    didDrawCell: () => {},
  })

  y = doc.lastAutoTable.finalY + 12

  // ---- Totals highlight box ----
  if (y > pageH - 50) { doc.addPage(); y = 20 }
  doc.setFillColor(40, 40, 65)
  doc.roundedRect(marginL, y, usableW, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL TTC', marginL + 4, y + 9)
  doc.setFontSize(13)
  doc.text(formatPdfMoney(totalTTC), pageW - marginR, y + 9, { align: 'right' })
  y += 20

  // ---- Bank info ----
  const bank = settings.bankInfo || {}
  if (bank.iban) {
    if (y > pageH - 60) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 50)
    doc.text('RÈGLEMENT', marginL, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    if (bank.titulaire) { doc.text(`Titulaire : ${bank.titulaire}`, marginL, y); y += 4 }
    doc.text(`IBAN : ${bank.iban}`, marginL, y); y += 4
    if (bank.bic) { doc.text(`BIC : ${bank.bic}`, marginL, y); y += 4 }
    y += 8
  }

  // ---- Signature block on quote page ----
  if (y > pageH - 70) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 50)
  doc.text('BON POUR ACCORD', marginL, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text('Lu et approuvé — Signature du client :', marginL, y)
  y += 6
  doc.setDrawColor(180, 180, 190)
  doc.rect(marginL, y, 80, 30)
  if (devis.signature) {
    try { doc.addImage(devis.signature, 'PNG', marginL + 2, y + 2, 76, 26) } catch { /* ignore signature rendering errors */ }
  }
  doc.setFontSize(8)
  doc.setTextColor(110, 110, 110)
  if (devis.signedAt) {
    doc.text(`Signé électroniquement le ${new Date(devis.signedAt).toLocaleDateString('fr-FR')}`, marginL, y + 35)
  }

  // ---- CGV ----
  doc.addPage()
  y = 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 50)
  doc.text('CONDITIONS GÉNÉRALES DE LOCATION ET DE PRESTATIONS', marginL, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  const lines = doc.splitTextToSize(buildCGV(settings), pageW - marginL - marginR)
  lines.forEach((line) => {
    if (y > pageH - 20) { doc.addPage(); y = 20 }
    doc.text(line, marginL, y)
    y += 4
  })

  // ---- Signature area on last CGV page ----
  if (y > pageH - 50) { doc.addPage(); y = 20 }
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 50)
  doc.text('BON POUR ACCORD', marginL, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text('Lu et approuvé — Signature du client :', marginL, y)
  y += 6
  if (devis.signature) {
    try {
      doc.addImage(devis.signature, 'PNG', marginL, y, 80, 30)
      y += 34
    } catch { y += 34 }
  } else {
    doc.setDrawColor(180, 180, 190)
    doc.rect(marginL, y, 80, 30)
    y += 34
  }
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  if (devis.signedAt) {
    doc.text(`Signé électroniquement le ${new Date(devis.signedAt).toLocaleDateString('fr-FR')}`, marginL, y)
  }

  // ---- Footer on all pages ----
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `${forme} ${raisonSociale} — ${adresseSiege} — RCS ${rcs} : ${siren}`,
      pageW / 2, pageH - 8, { align: 'center' }
    )
    doc.text(`Page ${i} / ${pageCount}`, pageW - marginR, pageH - 8, { align: 'right' })
  }

  if (download) doc.save(`${devis.devisNumber || 'devis'}.pdf`)
  return doc
}
