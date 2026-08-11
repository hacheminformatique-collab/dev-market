import { jsPDF } from 'jspdf'
import { CGV_ARTICLES } from './cgv.js'

const money = (v) => `${Number(v).toFixed(2)} EUR`

const checkPageBreak = (doc, y, needed = 20) => {
  if (y + needed > 272) {
    doc.addPage()
    return 20
  }
  return y
}

const writeWrapped = (doc, text, x, y, maxW, lineH = 4.5) => {
  const lines = doc.splitTextToSize(text, maxW)
  lines.forEach((line) => {
    y = checkPageBreak(doc, y, lineH + 2)
    doc.text(line, x, y)
    y += lineH
  })
  return y
}

export function generateDevisPdf({ quoteNumber, client, event, formule, menuById, gateauById, prestaById, menu, gateau, options, totals, signatureDataUrl }) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = 210
  const margin = 14
  const contentW = pageW - 2 * margin

  // ─────────────────────────────────────────────
  // PAGE 1 : DEVIS
  // ─────────────────────────────────────────────

  // Header background
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageW, 42, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('LE PARADISE', margin, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('SARL AFM  •  5 avenue Fridingen, 77100 Nanteuil-les-Meaux', margin, 22)
  doc.text('Tél : 07 82 28 15 82  •  contact@leparadise77.fr', margin, 28)
  doc.text('RCS Meaux : 904 543 816  •  TVA : FR06904543816', margin, 34)

  let y = 52

  // Title
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('DEVIS', margin, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`N° ${quoteNumber}`, margin, y + 7)
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, pageW - margin, y + 7, { align: 'right' })
  y += 18

  // Client info box
  doc.setTextColor(0, 0, 0)
  doc.setFillColor(245, 247, 252)
  doc.setDrawColor(200, 210, 230)
  doc.rect(margin, y, contentW, 26, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CLIENT', margin + 3, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(`${client.prenom} ${client.nom}`, margin + 3, y + 14)
  doc.text(`Tél : ${client.phone}   •   Email : ${client.email}`, margin + 3, y + 20)
  y += 32

  // Event info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('ÉVÉNEMENT', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const dateStr = event.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'
  const guests = Number(event.adults) + Number(event.children)
  doc.text(`Type : ${event.type}     Date : ${dateStr}`, margin, y)
  y += 5
  doc.text(`Adultes : ${event.adults}   Enfants : ${event.children}   Total convives : ${guests}`, margin, y)
  y += 10

  // Table header
  const col = { desc: margin, ht: margin + 112, tvaLbl: margin + 140, ttc: margin + 162 }
  doc.setFillColor(30, 41, 59)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.rect(margin, y, contentW, 8, 'F')
  doc.text('Description', col.desc + 2, y + 5.5)
  doc.text('Montant HT', col.ht, y + 5.5)
  doc.text('TVA', col.tvaLbl, y + 5.5)
  doc.text('TTC', col.ttc, y + 5.5)
  y += 8

  let rowIdx = 0
  const addRow = (desc, ttc, tvaRate) => {
    y = checkPageBreak(doc, y, 8)
    const ht = ttc / (1 + tvaRate / 100)
    const tvaAmt = ttc - ht
    const bg = rowIdx % 2 === 0 ? [248, 249, 255] : [255, 255, 255]
    doc.setFillColor(...bg)
    doc.setDrawColor(220, 225, 235)
    doc.rect(margin, y, contentW, 7, 'FD')
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(desc, col.desc + 2, y + 5)
    doc.text(money(ht), col.ht, y + 5)
    doc.text(`${tvaRate}%  (${money(tvaAmt)})`, col.tvaLbl, y + 5)
    doc.text(money(ttc), col.ttc, y + 5)
    y += 7
    rowIdx++
  }

  // Salle
  const formuleNom = formule === 'seche' ? 'Location sèche (décoration + vaisselles + nettoyage)' : 'Location avec prestation (décoration + vaisselles + prestation + nettoyage)'
  addRow(formuleNom, totals.salleTtc, 20)

  // Menu section 1
  if (menu.s1 && menuById[menu.s1]) {
    const it = menuById[menu.s1]
    addRow(`Cocktail bienvenu : ${it.nom} (${it.description})`, it.tarif * guests, 10)
  }
  // Section 2
  if (menu.s2 && menuById[menu.s2]) {
    const it = menuById[menu.s2]
    addRow(`Entrée : ${it.nom} (${it.description})`, it.tarif * Number(event.adults), 10)
  }
  // Section 3
  if (menu.s3 && menuById[menu.s3]) {
    const it = menuById[menu.s3]
    addRow(`Plat : ${it.nom} (${it.description})`, it.tarif * Number(event.adults), 10)
  }
  // Section 4
  if (menu.s4 && menuById[menu.s4]) {
    const it = menuById[menu.s4]
    addRow(`Dessert : ${it.nom}`, it.tarif * Number(event.adults), 10)
  }
  // Menu enfants
  if (menu.menuEnfant && Number(event.children) > 0) {
    const it = menuById['enfant']
    if (it) addRow(`Menu enfants : ${it.nom}`, it.tarif * Number(event.children), 10)
  }
  // Gâteau
  if (gateau.id && gateau.id !== 'none' && gateauById[gateau.id]) {
    const it = gateauById[gateau.id]
    addRow(`Gâteau : ${it.nom}`, it.tarif * guests, 10)
  }
  // Options
  options.forEach((id) => {
    if (prestaById[id]) addRow(`Option : ${prestaById[id].nom} – ${prestaById[id].description}`, prestaById[id].tarif, 20)
  })

  y += 2

  // Totals footer
  doc.setFillColor(30, 41, 59)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.rect(margin, y, contentW, 9, 'F')
  doc.text('TOTAL TTC', col.ht, y + 6)
  doc.text(money(totals.totalTtc), col.ttc, y + 6)
  y += 14

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('TVA 20% applicable sur location salle et prestations supplémentaires. TVA 10% applicable sur traiteur et gâteau.', margin, y)
  y += 10

  // Payment conditions
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Conditions de règlement :', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  ;[
    '• Acompte minimum 1 500 EUR à la signature pour réserver la date ferme et définitive.',
    '• Solde total à régler au plus tard 45 jours calendaires avant l\'événement.',
    '• Dépôt de garantie : 3 000 EUR par chèque le jour de l\'événement (chèque non encaissé).',
  ].forEach((line) => {
    y = checkPageBreak(doc, y, 6)
    doc.text(line, margin, y)
    y += 5
  })
  y += 6

  // Signature section
  y = checkPageBreak(doc, y, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Signature du client', margin, y)
  doc.text('Signature LE PARADISE', pageW - margin - 78, y)
  y += 4
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text('Lu et approuvé – Bon pour accord', margin, y)
  y += 3
  doc.setDrawColor(160, 170, 190)
  doc.rect(margin, y, 80, 38, 'D')
  if (signatureDataUrl) {
    try { doc.addImage(signatureDataUrl, 'PNG', margin + 2, y + 2, 76, 34) } catch {}
  }
  doc.rect(pageW - margin - 78, y, 78, 38, 'D')
  y += 44

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('Les conditions générales de location et de prestations figurant aux pages suivantes font partie intégrante du présent contrat.', margin, y)

  // ─────────────────────────────────────────────
  // PAGES CGV
  // ─────────────────────────────────────────────
  doc.addPage()
  y = 20

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('CONDITIONS GÉNÉRALES DE LOCATION ET DE PRESTATIONS', pageW / 2, y, { align: 'center' })
  y += 6
  doc.text('LE PARADISE RÉCEPTION', pageW / 2, y, { align: 'center' })
  y += 12

  CGV_ARTICLES.forEach((article) => {
    y = checkPageBreak(doc, y, 16)
    doc.setTextColor(30, 41, 59)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(article.title, margin, y)
    y += 6

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    y = writeWrapped(doc, article.text, margin, y, contentW, 4.5)
    y += 5
  })

  // Signature reproduced on last CGV page
  y = checkPageBreak(doc, y, 55)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Signature client – Lu et approuvé – Bon pour accord', margin, y)
  y += 4
  doc.setDrawColor(160, 170, 190)
  doc.rect(margin, y, 80, 38, 'D')
  if (signatureDataUrl) {
    try { doc.addImage(signatureDataUrl, 'PNG', margin + 2, y + 2, 76, 34) } catch {}
  }

  // Footer on every page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 150)
    doc.text('SARL AFM – LE PARADISE – 5 avenue Fridingen, 77100 Nanteuil-les-Meaux – SIREN 904 543 816', margin, 287)
    doc.text(`Page ${i} / ${pageCount}`, pageW - margin, 287, { align: 'right' })
  }

  return doc
}
