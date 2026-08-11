import jsPDF from 'jspdf'
import { getSettings } from '../../utils/storage'

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function generatePaymentReceiptPDF({ client, payment, totalPaid, soldeRestant, receiptNumber }) {
  const settings = getSettings()
  const l = settings.legalInfo || {}
  const company = l.enseigne || settings.nom || 'LE PARADISE'
  const address = l.adresse || '5 avenue Fridingen, 77100 Nanteuil les Meaux'
  const email = l.email || 'contact@leparadise77.fr'
  const phone = l.telephone || '0782821582'

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFillColor(26, 26, 46)
  doc.rect(0, 0, pageW, 36, 'F')
  doc.setTextColor(201, 168, 76)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(company, 14, 16)
  doc.setTextColor(230, 230, 230)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(address, 14, 24)
  doc.text(`Tél : ${phone}  |  ${email}`, 14, 30)

  y = 48
  doc.setTextColor(26, 26, 46)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('REÇU DE PAIEMENT', 14, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`N° reçu : ${receiptNumber}`, pageW - 14, y, { align: 'right' })
  y += 8
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, pageW - 14, y, { align: 'right' })

  y += 12
  doc.setDrawColor(210, 210, 210)
  doc.setFillColor(248, 245, 240)
  doc.rect(14, y, pageW - 28, 42, 'FD')
  y += 8
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'bold')
  doc.text('Client', 18, y)
  doc.setFont('helvetica', 'normal')
  y += 6
  doc.text(`${client.prenom || ''} ${client.nom || ''}`.trim() || 'Non renseigné', 18, y)
  y += 5
  doc.text(`Devis : ${client.devisNumber || '—'}`, 18, y)
  y += 5
  if (client.email) {
    doc.text(`Email : ${client.email}`, 18, y)
  }

  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 26, 46)
  doc.text('Détail du règlement', 14, y)
  y += 8

  const lines = [
    ['Date du paiement', payment.date ? new Date(payment.date).toLocaleDateString('fr-FR') : '—'],
    ['Mode de paiement', payment.mode || '—'],
    ['Montant versé', formatMoney(payment.montant)],
    ['Total réglé à ce jour', formatMoney(totalPaid)],
    ['Solde restant', formatMoney(Math.max(0, soldeRestant))],
  ]

  lines.forEach(([label, value], idx) => {
    const rowY = y + idx * 8
    doc.setFillColor(idx % 2 === 0 ? 252 : 246, idx % 2 === 0 ? 252 : 246, idx % 2 === 0 ? 252 : 246)
    doc.rect(14, rowY - 5, pageW - 28, 8, 'F')
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'bold')
    doc.text(label, 18, rowY)
    doc.setFont('helvetica', 'normal')
    doc.text(value, pageW - 18, rowY, { align: 'right' })
  })

  y += lines.length * 8 + 8
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.text('Merci pour votre confiance.', 14, y)

  return doc
}
