import { useState, useEffect } from 'react'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// A date is "blocked" (admin validated) when status is signé, validé_admin
// A date is "pending" (client signed, awaiting admin) when status is signé_client or brouillon_envoyé
function buildBookingMaps(clients) {
  const booked = new Set()  // dates with admin-validated reservations
  const pending = new Set() // dates with pending (not yet admin-validated) devis
  ;(clients || []).forEach((c) => {
    if (!c.dateEvenement) return
    const key = c.dateEvenement.slice(0, 10)
    if (c.status === 'signé' || c.status === 'validé_admin') {
      booked.add(key)
    } else if (c.status === 'signé_client' || c.status === 'brouillon_envoyé') {
      pending.add(key)
    }
  })
  return { booked, pending }
}

/**
 * @param {object} props
 * @param {string}  props.value        – selected date string 'YYYY-MM-DD'
 * @param {function} props.onChange    – called with 'YYYY-MM-DD'
 * @param {string}  props.minDate      – minimum selectable date 'YYYY-MM-DD'
 * @param {Set|null} props.promoDates  – set of 'YYYY-MM-DD' strings with active promos
 */
export default function InlineCalendar({ value, onChange, minDate, promoDates }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const minD = minDate ? new Date(minDate + 'T00:00:00') : today

  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const initYear = selectedDate ? selectedDate.getFullYear() : today.getFullYear()
  const initMonth = selectedDate ? selectedDate.getMonth() : today.getMonth()

  const [viewYear, setViewYear] = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  const [pendingWarning, setPendingWarning] = useState(null) // dateStr of the pending date the user clicked

  // Live-load promo dates from server if not provided
  const [serverPromos, setServerPromos] = useState(null)
  const [bookedDates, setBookedDates] = useState(new Set())
  const [pendingDates, setPendingDates] = useState(new Set())

  useEffect(() => {
    if (promoDates !== undefined) return // caller-provided, skip fetch
    fetch('/api/storage.php?key=paradise_cal_overrides')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && typeof data === 'object') {
          const promoSet = new Set(
            Object.entries(data)
              .filter(([, v]) => v?.isPromo)
              .map(([k]) => k)
          )
          setServerPromos(promoSet)
        }
      })
      .catch(() => {})
  }, [promoDates])

  // Fetch client reservations to show booked/pending dates
  useEffect(() => {
    fetch('/api/storage.php?key=paradise_clients')
      .then((r) => r.ok ? r.json() : null)
      .then((clients) => {
        if (Array.isArray(clients)) {
          const { booked, pending } = buildBookingMaps(clients)
          setBookedDates(booked)
          setPendingDates(pending)
        }
      })
      .catch(() => {})
  }, [])

  const activePromos = promoDates !== undefined ? (promoDates || new Set()) : (serverPromos || new Set())

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  // Build days for the grid
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function handleDay(day) {
    if (!day) return
    const date = new Date(viewYear, viewMonth, day)
    if (date < minD) return
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const key = `${yyyy}-${mm}-${dd}`
    if (bookedDates.has(key)) return // blocked – cannot select
    if (pendingDates.has(key)) {
      setPendingWarning(key)
      return
    }
    setPendingWarning(null)
    onChange(key)
  }

  function isSelected(day) {
    if (!day || !selectedDate) return false
    return selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
  }

  function isDisabled(day) {
    if (!day) return true
    const date = new Date(viewYear, viewMonth, day)
    if (date < minD) return true
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const key = `${viewYear}-${mm}-${dd}`
    return bookedDates.has(key)
  }

  function isBooked(day) {
    if (!day) return false
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return bookedDates.has(`${viewYear}-${mm}-${dd}`)
  }

  function isPending(day) {
    if (!day) return false
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return pendingDates.has(`${viewYear}-${mm}-${dd}`)
  }

  function isToday(day) {
    if (!day) return false
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
  }

  function isPromo(day) {
    if (!day) return false
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return activePromos.has(`${viewYear}-${mm}-${dd}`)
  }

  return (
    <div style={{ border: '1.5px solid #ddd', borderRadius: '12px', overflow: 'hidden', background: 'white', userSelect: 'none' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a2e', padding: '12px 16px' }}>
        <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>‹</button>
        <span style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f5f0' }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: '12px', fontWeight: '700', color: '#888' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', padding: '8px' }}>
        {cells.map((day, i) => {
          const sel = isSelected(day)
          const dis = isDisabled(day)
          const tod = isToday(day)
          const promo = isPromo(day)
          const booked = isBooked(day)
          const pend = isPending(day)
          let bg = 'transparent'
          if (sel) bg = '#c9a84c'
          else if (booked) bg = '#f5f5f5'
          else if (pend) bg = '#fff8e1'
          else if (promo) bg = '#fff0f0'
          else if (tod) bg = '#fdf3d9'
          let color = '#222'
          if (sel) color = 'white'
          else if (dis) color = '#ccc'
          else if (booked) color = '#bbb'
          else if (tod) color = '#b8860b'
          let border = '1px solid transparent'
          if (pend && !sel) border = '1px solid #f39c12'
          else if (promo && !sel) border = '1px solid #e74c3c'
          else if (tod && !sel) border = '1px solid #c9a84c'
          return (
            <div
              key={i}
              onClick={() => handleDay(day)}
              style={{
                textAlign: 'center',
                padding: '8px 4px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: sel ? '700' : tod ? '600' : '400',
                cursor: day && !dis ? 'pointer' : 'default',
                background: bg,
                color,
                border,
                transition: 'background 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {booked && day && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  background: '#888',
                  color: 'white',
                  fontSize: '7px',
                  fontWeight: '700',
                  textAlign: 'center',
                  lineHeight: '10px',
                  padding: '0 1px',
                }}>
                  RÉSERVÉ
                </div>
              )}
              {pend && !booked && day && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  background: '#f39c12',
                  color: 'white',
                  fontSize: '7px',
                  fontWeight: '700',
                  textAlign: 'center',
                  lineHeight: '10px',
                  padding: '0 1px',
                }}>
                  EN COURS
                </div>
              )}
              {promo && !dis && !booked && !pend && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  background: '#e74c3c',
                  color: 'white',
                  fontSize: '7px',
                  fontWeight: '700',
                  textAlign: 'center',
                  lineHeight: '10px',
                  padding: '0 1px',
                }}>
                  PROMO
                </div>
              )}
              <span style={{ position: 'relative', zIndex: 1, marginTop: (booked || pend || promo) ? '8px' : 0, display: 'block' }}>
                {day || ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pending date warning */}
      {pendingWarning && (
        <div style={{ padding: '10px 16px', background: '#fff8e1', borderTop: '1px solid #f39c12', fontSize: '13px', color: '#b8860b' }}>
          ⚠️ Un devis est en cours de traitement pour cette date. Vous pouvez tout de même soumettre votre demande et notre équipe reviendra vers vous.
          <button
            type="button"
            onClick={() => { setPendingWarning(null); onChange(pendingWarning) }}
            style={{ marginLeft: '8px', background: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}
          >
            Continuer quand même
          </button>
        </div>
      )}

      {/* Selected date display */}
      {selectedDate && (
        <div style={{ padding: '10px 16px', background: '#fdf3d9', textAlign: 'center', fontSize: '13px', color: '#b8860b', fontWeight: '600' }}>
          📅 {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}

      {/* Legends */}
      <div style={{ padding: '6px 16px', background: '#f9f9f9', borderTop: '1px solid #eee', fontSize: '11px', color: '#888', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span>⬛ Réservé (indisponible)</span>
        <span style={{ color: '#f39c12' }}>🟡 Devis en cours</span>
        {activePromos.size > 0 && <span style={{ color: '#e74c3c' }}>🔴 Offre promo</span>}
      </div>
    </div>
  )
}
