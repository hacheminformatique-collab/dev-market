import { useState } from 'react'
import CalendarView from '../../CalendarView'
import {
  getClients, saveClients,
  getStaff,
  getCalOverrides, saveCalOverrides,
  getCalStaff, saveCalStaff,
} from '../../../utils/storage'

// ── Pricing helpers (same logic as Step3Formule) ─────────────────────────────

function getSeason(dateStr) {
  if (!dateStr) return null
  const month = new Date(dateStr).getMonth() + 1
  return (month === 12 || month <= 3) ? 'basse' : 'haute'
}

function getSeasonLabel(dateStr) {
  if (!dateStr) return ''
  return getSeason(dateStr) === 'basse' ? '🌧️ Basse saison (déc–mars)' : '☀️ Haute saison (avr–nov)'
}

function getDayOfWeek(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).getDay() // 0=dim,1=lun,...,5=ven,6=sam
}

function getPriceForDate(dateStr, formuleNom) {
  if (!dateStr) return 0
  const month = new Date(dateStr).getMonth() + 1
  const day = getDayOfWeek(dateStr)
  const isBasSaison = (month === 12 || month <= 3)
  const isSec = formuleNom && formuleNom.toLowerCase().includes('sèche')

  if (isBasSaison) {
    if (day === 5) return isSec ? 2500 : 1500
    if (day === 6) return isSec ? 3500 : 2500
    return isSec ? 2000 : 1000
  } else {
    if (day === 5) return isSec ? 3500 : 2500
    if (day === 6) return isSec ? 4500 : 3000
    return isSec ? 2500 : 1500
  }
}

function getRemise(dateStr) {
  if (!dateStr) return 0
  const secPrice = getPriceForDate(dateStr, 'Location sèche')
  const presPrice = getPriceForDate(dateStr, 'Location avec prestation')
  return secPrice - presPrice
}

// ── Bread calculation ─────────────────────────────────────────────────────────

function calcBread(nbGuests) {
  const loaves = Math.ceil(nbGuests * 1.5)
  const cost = loaves * 0.165
  return { loaves, cost }
}

// ── Beverage calculation ──────────────────────────────────────────────────────

const TEA_COFFEE_NAMES = ['thé', 'cafe', 'café', 'tea', 'coffee']

function isCoffeeOrTea(name) {
  const n = (name || '').toLowerCase()
  return TEA_COFFEE_NAMES.some((kw) => n.includes(kw))
}

function isEauDeSource(name) {
  const n = (name || '').toLowerCase()
  return n.includes('eau') && (n.includes('source') || n.includes('minérale') || n.includes('minerale'))
}

function calcBeverages(menus, nbGuests) {
  const boissons = (menus || []).filter((m) => m.section === 'Boissons')
  return boissons.map((b) => {
    if (isCoffeeOrTea(b.nomMenu)) {
      return { name: b.nomMenu, qty: null, note: 'Machine à disposition' }
    }
    const factor = isEauDeSource(b.nomMenu) ? 2 : 1.5
    const qty = Math.ceil(nbGuests / 10 * factor)
    return { name: b.nomMenu, qty }
  })
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function dateLabel(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

const DAY_NAMES_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

// ── Price Override Modal ──────────────────────────────────────────────────────

function PriceOverrideModal({ dateStr, currentOverride, onSave, onClose }) {
  const auto = getPriceForDate(dateStr, 'Location sèche')
  const [customPrice, setCustomPrice] = useState(
    currentOverride?.customPrice != null ? String(currentOverride.customPrice) : String(auto)
  )
  const [isPromo, setIsPromo] = useState(currentOverride?.isPromo ?? false)
  const [note, setNote] = useState(currentOverride?.note || '')

  function handleSave() {
    onSave({ customPrice: parseFloat(customPrice) || auto, isPromo, note })
  }

  function handleRemove() {
    onSave(null)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '420px' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3 className="modal-title">💰 Tarif pour le {dateLabel(dateStr)}</h3>

        <div style={{ background: '#f8f5f0', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px' }}>
          <div>{getSeasonLabel(dateStr)} — {DAY_NAMES_FR[getDayOfWeek(dateStr)]}</div>
          <div style={{ marginTop: '6px' }}>
            <strong>Tarif standard :</strong>
            <div style={{ paddingLeft: '12px', lineHeight: '1.8', color: '#555' }}>
              Location sèche : {formatMoney(getPriceForDate(dateStr, 'Location sèche'))}<br />
              Avec prestation : {formatMoney(getPriceForDate(dateStr, 'Location avec prestation'))}<br />
              Remise prestation : {formatMoney(getRemise(dateStr))}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Prix personnalisé (€) — remplace le tarif saisonnier de location sèche</label>
          <input
            type="number"
            min="0"
            className="form-control"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id="isPromo"
            checked={isPromo}
            onChange={(e) => setIsPromo(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="isPromo" style={{ margin: 0 }}>Afficher badge <strong>PROMO EN COURS</strong> sur le calendrier client</label>
        </div>

        <div className="form-group">
          <label>Note (optionnelle)</label>
          <input
            className="form-control"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Promo Saint-Valentin"
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', flexWrap: 'wrap' }}>
          {currentOverride && (
            <button className="btn btn-danger btn-sm" onClick={handleRemove}>🗑️ Supprimer l&apos;override</button>
          )}
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

// ── Event detail panel ────────────────────────────────────────────────────────

function EventDetail({ client, staffList, assignedStaffIds, calOverride, onClose, onDelete, onReschedule, onStaffChange, onPriceOverride }) {
  const nbGuests = (parseInt(client.nbAdultes) || client.nbPersonnes || 0) + (parseInt(client.nbEnfants) || 0)
  const bread = calcBread(nbGuests)
  const beverages = calcBeverages(client.menus, nbGuests)

  const dateStr = (client.dateEvenement || '').slice(0, 10)
  const isSeche = client.formule?.nomFormule?.toLowerCase().includes('sèche')
  const autoPrice = getPriceForDate(dateStr, client.formule?.nomFormule)
  const effectivePrice = calOverride?.customPrice != null ? calOverride.customPrice : autoPrice
  const remise = isSeche ? 0 : getRemise(dateStr)

  const payroll = staffList
    .filter((s) => assignedStaffIds.includes(s.id))
    .reduce((sum, s) => sum + (s.tarifEvenement || 0), 0)

  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState(dateStr)

  function handleReschedule() {
    if (newDate && newDate !== dateStr) {
      onReschedule(newDate)
    }
    setShowReschedule(false)
  }

  return (
    <div className="card" style={{ position: 'sticky', top: 0, alignSelf: 'start', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ color: '#1a1a2e', margin: 0 }}>
          📋 {client.prenom} {client.nom}
        </h4>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }} onClick={onClose}>✕</button>
      </div>

      {/* Event info */}
      <div style={{ fontSize: '13px', lineHeight: '1.8', marginBottom: '12px', background: '#f8f5f0', borderRadius: '8px', padding: '10px' }}>
        <div>🎉 <strong>{client.typeEvenement}</strong></div>
        <div>📅 <strong>{dateLabel(dateStr)}</strong></div>
        <div>{getSeasonLabel(dateStr)}</div>
        <div>👥 {nbGuests} invités ({parseInt(client.nbAdultes) || 0} adultes + {parseInt(client.nbEnfants) || 0} enfants)</div>
        <div>🏛️ {client.formule?.nomFormule || '—'}</div>
        <div>🔖 {client.devisNumber}</div>
      </div>

      {/* Reschedule */}
      <div style={{ marginBottom: '12px' }}>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setShowReschedule((v) => !v)}
        >
          📆 Reporter l&apos;événement
        </button>
        {showReschedule && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-control"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{ maxWidth: '180px', fontSize: '13px', padding: '6px 10px' }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleReschedule}>✅ Confirmer</button>
            <button className="btn btn-sm" style={{ background: '#eee', color: '#444' }} onClick={() => setShowReschedule(false)}>Annuler</button>
          </div>
        )}
      </div>

      {/* Price & REMISE */}
      <div style={{ marginBottom: '12px', background: '#fdf3d9', borderRadius: '8px', padding: '10px' }}>
        <div style={{ fontWeight: '700', marginBottom: '6px', color: '#1a1a2e' }}>💰 Tarification</div>
        <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
          {calOverride?.customPrice != null ? (
            <div>💲 Prix personnalisé : <strong>{formatMoney(effectivePrice)}</strong>
              {calOverride.note && <span style={{ color: '#888', fontSize: '11px' }}> ({calOverride.note})</span>}
            </div>
          ) : (
            <div>💲 Tarif saisonnier ({isSeche ? 'location sèche' : 'avec prestation'}) : <strong>{formatMoney(effectivePrice)}</strong></div>
          )}
          {!isSeche && remise > 0 && (
            <div style={{ color: '#27ae60' }}>🏷️ Remise prestation incluse : <strong>-{formatMoney(remise)}</strong>
              <div style={{ fontSize: '11px', color: '#888' }}>
                (Tarif sèche {formatMoney(getPriceForDate(dateStr, 'Location sèche'))} – {formatMoney(effectivePrice)} = {formatMoney(remise)})
              </div>
            </div>
          )}
          {calOverride?.isPromo && (
            <div style={{ color: '#e74c3c', fontWeight: '700' }}>🏷️ PROMO EN COURS affiché sur calendrier client</div>
          )}
        </div>
        <button
          className="btn btn-sm btn-outline"
          style={{ marginTop: '8px' }}
          onClick={onPriceOverride}
        >
          ✏️ Modifier le tarif / promo de ce jour
        </button>
      </div>

      {/* Staff assignment */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontWeight: '700', marginBottom: '8px', color: '#1a1a2e' }}>👷 Staff assigné</div>
        {staffList.length === 0 && (
          <p style={{ fontSize: '13px', color: '#888' }}>Aucun employé enregistré.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {staffList.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={assignedStaffIds.includes(s.id)}
                onChange={() => onStaffChange(s.id)}
              />
              <span>{s.prenom} {s.nom}</span>
              <span style={{ fontSize: '11px', color: '#888' }}>{s.poste}</span>
              <span style={{ marginLeft: 'auto', color: '#c9a84c', fontWeight: '600' }}>{formatMoney(s.tarifEvenement)}</span>
            </label>
          ))}
        </div>
        {assignedStaffIds.length > 0 && (
          <div style={{ marginTop: '8px', fontWeight: '700', color: '#1a1a2e', fontSize: '14px', borderTop: '1px solid #e0e0e0', paddingTop: '8px' }}>
            💰 Masse salariale : {formatMoney(payroll)}
          </div>
        )}
      </div>

      {/* Bread */}
      <div style={{ marginBottom: '12px', background: '#f8f5f0', borderRadius: '8px', padding: '10px' }}>
        <div style={{ fontWeight: '700', marginBottom: '6px', color: '#1a1a2e' }}>🍞 Commande de pain</div>
        <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
          <div>Nombre de pains : <strong>{bread.loaves}</strong> ({nbGuests} invités × 1,5)</div>
          <div>Coût estimé : <strong>{formatMoney(bread.cost)}</strong> ({bread.loaves} × 0,165 €)</div>
        </div>
      </div>

      {/* Beverages */}
      <div style={{ marginBottom: '16px', background: '#f8f5f0', borderRadius: '8px', padding: '10px' }}>
        <div style={{ fontWeight: '700', marginBottom: '6px', color: '#1a1a2e' }}>🥤 Boissons</div>
        {beverages.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#888' }}>Aucune boisson sélectionnée par le client.</p>
        ) : (
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {beverages.map((b, i) => (
              <div key={i}>
                <strong>{b.name}</strong> :{' '}
                {b.qty != null
                  ? <span>{b.qty} bouteille{b.qty > 1 ? 's' : ''} <span style={{ color: '#888', fontSize: '11px' }}>(base : {nbGuests} inv. ÷ 10 × {isEauDeSource(b.name) ? 2 : 1.5})</span></span>
                  : <span style={{ color: '#27ae60' }}>{b.note}</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (confirm(`Supprimer l'événement de ${client.prenom} ${client.nom} ?`)) onDelete()
          }}
        >
          🗑️ Supprimer l&apos;événement
        </button>
      </div>
    </div>
  )
}

// ── CalendarTab ───────────────────────────────────────────────────────────────

export default function CalendarTab() {
  const [clients, setClients] = useState(getClients())
  const [calOverrides, setCalOverrides] = useState(getCalOverrides())
  const [calStaff, setCalStaff] = useState(getCalStaff())
  const staffList = getStaff()

  const [selectedClientId, setSelectedClientId] = useState(null)
  const [priceOverrideDate, setPriceOverrideDate] = useState(null)

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null
  const assignedStaffIds = selectedClient ? (calStaff[selectedClient.id] || []) : []

  const events = clients
    .filter((c) => c.dateEvenement)
    .map((c) => ({
      id: c.id,
      date: c.dateEvenement,
      label: `${c.prenom || ''} ${c.nom || ''} – ${c.typeEvenement || ''}`,
      type: c.typeEvenement || '',
    }))

  const promoDateKeys = new Set(
    Object.entries(calOverrides)
      .filter(([, v]) => v?.isPromo)
      .map(([k]) => k)
  )

  function handleEventClick(id) {
    setSelectedClientId((prev) => (prev === id ? null : id))
  }

  function handleEventDrop(id, newDateStr) {
    const updated = clients.map((c) => {
      if (c.id !== id) return c
      // Recalculate prixSalle based on new date (unless there's a custom override)
      const override = calOverrides[newDateStr]
      const newPrice = override?.customPrice != null
        ? override.customPrice
        : getPriceForDate(newDateStr, c.formule?.nomFormule)
      return { ...c, dateEvenement: newDateStr, prixSalle: newPrice }
    })
    saveClients(updated)
    setClients(updated)
    if (selectedClientId === id) {
      setSelectedClientId(id)
    }
  }

  function handleDelete() {
    if (!selectedClient) return
    const updated = clients.filter((c) => c.id !== selectedClient.id)
    saveClients(updated)
    setClients(updated)
    setSelectedClientId(null)
  }

  function handleReschedule(newDate) {
    if (!selectedClient) return
    handleEventDrop(selectedClient.id, newDate)
  }

  function handleStaffChange(staffId) {
    if (!selectedClient) return
    const current = calStaff[selectedClient.id] || []
    const updated = current.includes(staffId)
      ? current.filter((id) => id !== staffId)
      : [...current, staffId]
    const newCalStaff = { ...calStaff, [selectedClient.id]: updated }
    saveCalStaff(newCalStaff)
    setCalStaff(newCalStaff)
  }

  function handlePriceOverride() {
    if (selectedClient?.dateEvenement) {
      setPriceOverrideDate(selectedClient.dateEvenement.slice(0, 10))
    }
  }

  function handleSavePriceOverride(overrideData) {
    const key = priceOverrideDate
    let newOverrides
    if (overrideData === null) {
      newOverrides = { ...calOverrides }
      delete newOverrides[key]
    } else {
      newOverrides = { ...calOverrides, [key]: overrideData }
    }
    saveCalOverrides(newOverrides)
    setCalOverrides(newOverrides)

    // If the currently selected client is on this date, update prixSalle
    if (selectedClient && selectedClient.dateEvenement?.slice(0, 10) === key) {
      const newPrice = overrideData?.customPrice != null
        ? overrideData.customPrice
        : getPriceForDate(key, selectedClient.formule?.nomFormule)
      const updated = clients.map((c) =>
        c.id === selectedClient.id ? { ...c, prixSalle: newPrice } : c
      )
      saveClients(updated)
      setClients(updated)
    }

    setPriceOverrideDate(null)
  }

  function handleDateClick(dateStr) {
    setPriceOverrideDate(dateStr)
  }

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ color: '#1a1a2e', margin: 0 }}>📅 Calendrier des événements</h3>
        <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>💡 Cliquez sur un événement pour voir les détails</span>
          <span>↔️ Glissez pour reporter</span>
          <span>📅 Cliquez sur une date libre pour gérer le tarif/promo</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedClient ? '1fr 380px' : '1fr', gap: '20px', alignItems: 'start' }}>
        <CalendarView
          events={events}
          promoDateKeys={promoDateKeys}
          onEventClick={handleEventClick}
          onEventDrop={handleEventDrop}
          onDateClick={handleDateClick}
        />

        {selectedClient && (
          <EventDetail
            client={selectedClient}
            staffList={staffList}
            assignedStaffIds={assignedStaffIds}
            calOverride={calOverrides[selectedClient.dateEvenement?.slice(0, 10)]}
            onClose={() => setSelectedClientId(null)}
            onDelete={handleDelete}
            onReschedule={handleReschedule}
            onStaffChange={handleStaffChange}
            onPriceOverride={handlePriceOverride}
          />
        )}
      </div>

      {priceOverrideDate && (
        <PriceOverrideModal
          dateStr={priceOverrideDate}
          currentOverride={calOverrides[priceOverrideDate] || null}
          onSave={handleSavePriceOverride}
          onClose={() => setPriceOverrideDate(null)}
        />
      )}
    </div>
  )
}

