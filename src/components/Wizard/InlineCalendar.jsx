import { useState } from 'react'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function InlineCalendar({ value, onChange, minDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const minD = minDate ? new Date(minDate + 'T00:00:00') : today

  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const initYear = selectedDate ? selectedDate.getFullYear() : today.getFullYear()
  const initMonth = selectedDate ? selectedDate.getMonth() : today.getMonth()

  const [viewYear, setViewYear] = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)

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
  // Monday-based: 0=Mon..6=Sun
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
                background: sel ? '#c9a84c' : tod ? '#fdf3d9' : 'transparent',
                color: sel ? 'white' : dis ? '#ccc' : tod ? '#b8860b' : '#222',
                border: tod && !sel ? '1px solid #c9a84c' : '1px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              {day || ''}
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
    </div>
  )
}
