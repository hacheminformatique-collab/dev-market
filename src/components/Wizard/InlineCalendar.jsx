import { useState, useEffect } from 'react'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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

  // Live-load promo dates from server if not provided
  const [serverPromos, setServerPromos] = useState(null)
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
    onChange(`${yyyy}-${mm}-${dd}`)
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
    return date < minD
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
                background: sel ? '#c9a84c' : promo ? '#fff0f0' : tod ? '#fdf3d9' : 'transparent',
                color: sel ? 'white' : dis ? '#ccc' : tod ? '#b8860b' : '#222',
                border: promo && !sel ? '1px solid #e74c3c' : tod && !sel ? '1px solid #c9a84c' : '1px solid transparent',
                transition: 'background 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {promo && !dis && (
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
              <span style={{ position: 'relative', zIndex: 1, marginTop: promo ? '8px' : 0, display: 'block' }}>
                {day || ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Selected date display */}
      {selectedDate && (
        <div style={{ padding: '10px 16px', background: '#fdf3d9', textAlign: 'center', fontSize: '13px', color: '#b8860b', fontWeight: '600' }}>
          📅 {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}

      {/* Promo legend */}
      {activePromos.size > 0 && (
        <div style={{ padding: '6px 16px', background: '#fff5f5', textAlign: 'center', fontSize: '11px', color: '#e74c3c', borderTop: '1px solid #fdd' }}>
          🏷️ Les dates en rouge bénéficient d&apos;une <strong>offre promotionnelle</strong> — contactez-nous !
        </div>
      )}
    </div>
  )
}
