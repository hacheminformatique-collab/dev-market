import { useState, useRef } from 'react'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  const raw = new Date(year, month, 1).getDay()
  return (raw + 6) % 7
}

/**
 * @param {object} props
 * @param {Array}  props.events        – list of { id, date, label, type }
 * @param {Set}    props.promoDateKeys – set of 'YYYY-MM-DD' strings with active promo
 * @param {Set}    props.bookedDateKeys – set of 'YYYY-MM-DD' strings already booked
 * @param {function} props.onEventClick(id) – called when an event label is clicked
 * @param {function} props.onEventDrop(id, newDateStr) – called when an event is dropped on a new date
 * @param {function} props.onDateClick(dateStr) – called when an empty date cell is clicked
 */
export default function CalendarView({
  events = [],
  promoDateKeys = new Set(),
  bookedDateKeys = new Set(),
  onEventClick,
  onEventDrop,
  onDateClick,
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [dragOverDate, setDragOverDate] = useState(null)
  const draggingId = useRef(null)

  const prev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  // Build map date string → events
  const eventsByDate = {}
  events.forEach((ev) => {
    if (!ev.date) return
    const key = ev.date.slice(0, 10)
    if (!eventsByDate[key]) eventsByDate[key] = []
    eventsByDate[key].push(ev)
  })

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function handleDragStart(e, id) {
    draggingId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, dateKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(dateKey)
  }

  function handleDragLeave() {
    setDragOverDate(null)
  }

  function handleDrop(e, dateKey) {
    e.preventDefault()
    setDragOverDate(null)
    if (draggingId.current && onEventDrop) {
      onEventDrop(draggingId.current, dateKey)
    }
    draggingId.current = null
  }

  function handleDragEnd() {
    draggingId.current = null
    setDragOverDate(null)
  }

  return (
    <div className="cal-wrap">
      <div className="cal-nav">
        <button onClick={prev}>&lsaquo;</button>
        <strong>{MONTHS[month]} {year}</strong>
        <button onClick={next}>&rsaquo;</button>
      </div>
      <div className="cal-grid">
        {DAYS.map((d) => <div key={d} className="cal-head">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="cal-cell empty" />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayEvents = eventsByDate[key] || []
          const isToday = key === todayStr
          const isPromo = promoDateKeys.has(key)
          const isBooked = bookedDateKeys.has(key)
          const isDragOver = dragOverDate === key
          return (
            <div
              key={key}
              className={`cal-cell ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-event' : ''}`}
              style={{
                cursor: onDateClick ? 'pointer' : 'default',
                border: isDragOver ? '2px dashed #c9a84c' : undefined,
                background: isDragOver ? '#fdf3d9' : undefined,
                position: 'relative',
                minHeight: '60px',
              }}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, key)}
              onClick={() => { if (onDateClick && !dayEvents.length) onDateClick(key) }}
            >
              {isPromo && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  background: 'linear-gradient(90deg, #e74c3c, #c0392b)',
                  color: 'white',
                  fontSize: '9px',
                  fontWeight: '700',
                  textAlign: 'center',
                  padding: '1px 2px',
                  letterSpacing: '0.05em',
                  zIndex: 2,
                }}>
                  🏷️ PROMO
                </div>
              )}
              <span className="cal-day-num" style={{ marginTop: isPromo ? '14px' : undefined, display: 'block' }}>{day}</span>
              {isBooked && !dayEvents.length && (
                <div style={{ fontSize: '9px', color: '#888', textAlign: 'center' }}>reservé</div>
              )}
              {dayEvents.map((ev) => (
                <div
                  key={ev.id || ev.label}
                  className="cal-event-dot"
                  title={ev.label || ev.type || ''}
                  draggable={!!onEventDrop}
                  onDragStart={(e) => handleDragStart(e, ev.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onEventClick) onEventClick(ev.id)
                  }}
                  style={{
                    cursor: onEventClick ? 'pointer' : 'default',
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    background: '#1a1a2e',
                    color: '#c9a84c',
                    marginTop: '2px',
                    display: 'block',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    userSelect: 'none',
                  }}
                >
                  {ev.label || ev.type || '📅'}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
