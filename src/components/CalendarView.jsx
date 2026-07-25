import { useState } from 'react'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  // 0=Sun, shift to Mon=0
  const raw = new Date(year, month, 1).getDay()
  return (raw + 6) % 7
}

export default function CalendarView({ events = [] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

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
          return (
            <div key={key} className={`cal-cell ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-event' : ''}`}>
              <span className="cal-day-num">{day}</span>
              {dayEvents.map((ev, j) => (
                <span key={j} className="cal-event-dot" title={ev.label || ev.type || ''}>{ev.label || ev.type || '📅'}</span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
