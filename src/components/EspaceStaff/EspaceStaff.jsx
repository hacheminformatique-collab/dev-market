import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { getStaff, saveStaff, getClients } from '../../utils/storage'
import { useIsMobile } from '../../hooks/useIsMobile'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function calcBoissonQty(nomBoisson, nbPersonnes) {
  if (nomBoisson === 'Eau de source') return Math.ceil((nbPersonnes / 10) * 2)
  if (nomBoisson === 'Thé et Café') return null
  return Math.ceil((nbPersonnes / 10) * 1.5)
}

export default function EspaceStaff() {
  const { staffId } = useParams()
  const navigate = useNavigate()

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedEv, setSelectedEv] = useState(null)
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinMsg, setPinMsg] = useState(null)
  const isMobile = useIsMobile()

  // Auth check — redirect to home if not authenticated
  if (!sessionStorage.getItem(`staffAuth_${staffId}`)) {
    return <Navigate to="/" replace />
  }

  const allStaff = getStaff()
  const member = allStaff.find((s) => s.id === staffId)

  if (!member) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f5f0' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <h2>Profil introuvable</h2>
          <p className="text-muted mt-1">Ce lien n&apos;est pas valide.</p>
          <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>Retour à l&apos;accueil</button>
        </div>
      </div>
    )
  }

  // Only events this staff member is assigned to
  const allClients = getClients()
  const myEvents = allClients.filter((c) =>
    c.status !== 'annulé' &&
    c.dateEvenement &&
    (c.assignedStaff || []).includes(staffId)
  )

  const eventsByDate = {}
  myEvents.forEach((c) => {
    const key = c.dateEvenement ? c.dateEvenement.slice(0, 10) : null
    if (!key) return
    if (!eventsByDate[key]) eventsByDate[key] = []
    eventsByDate[key].push(c)
  })

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  function handlePinChange() {
    const currentPin = member.pin || '1234'
    if (pinCurrent !== currentPin) { setPinMsg({ type: 'error', text: 'Code PIN actuel incorrect.' }); return }
    if (!/^\d{4}$/.test(pinNew)) { setPinMsg({ type: 'error', text: 'Le nouveau code doit contenir exactement 4 chiffres.' }); return }
    if (pinNew !== pinConfirm) { setPinMsg({ type: 'error', text: 'Les codes ne correspondent pas.' }); return }
    const updated = getStaff().map((s) => s.id === staffId ? { ...s, pin: pinNew } : s)
    saveStaff(updated)
    setPinCurrent(''); setPinNew(''); setPinConfirm('')
    setPinMsg({ type: 'success', text: 'Code PIN modifié avec succès.' })
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dateKey(day) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${viewYear}-${mm}-${dd}`
  }

  function isToday(day) {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
  }

  const upcomingEvents = myEvents
    .filter((c) => c.dateEvenement >= today.toISOString().split('T')[0])
    .sort((a, b) => a.dateEvenement.localeCompare(b.dateEvenement))

  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f0', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '20px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : 0 }}>
          <div>
            <div style={{ color: '#c9a84c', fontWeight: '800', fontSize: '20px' }}>LE PARADISE</div>
            <div style={{ color: '#aaa', fontSize: '12px' }}>Espace staff</div>
          </div>
          <div style={{ color: 'white', textAlign: 'right' }}>
            <div style={{ fontWeight: '700' }}>{member.prenom} {member.nom}</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>{member.poste} — {member.matricule}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Next event highlight */}
        {upcomingEvents.length > 0 && (
          <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #c9a84c' }}>
            <h3 style={{ marginBottom: '12px', color: '#1a1a2e' }}>🎉 Prochain événement</h3>
            {(() => {
              const ev = upcomingEvents[0]
              const nb = (parseInt(ev.nbAdultes) || ev.nbPersonnes || 0) + (parseInt(ev.nbEnfants) || 0)
              const menus = (ev.menus || []).filter((m) => m.tarif > 0)
              const boissons = (ev.menus || []).filter((m) => m.section === 'Boissons')
              return (
                <div>
                  <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>
                    📅 {new Date(ev.dateEvenement).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '2', color: '#555' }}>
                    <div><strong>Type :</strong> {ev.typeEvenement}</div>
                    <div><strong>Convives :</strong> {nb} personnes</div>
                    {ev.heureDebut && <div><strong>Horaires :</strong> {ev.heureDebut} — {ev.heureFin}</div>}
                    {menus.length > 0 && (
                      <div>
                        <strong>Menu :</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                          {menus.map((m) => <li key={m.id}>{m.nomMenu}</li>)}
                        </ul>
                      </div>
                    )}
                    {boissons.length > 0 && (
                      <div>
                        <strong>Boissons :</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                          {boissons.map((b) => {
                            const qty = calcBoissonQty(b.nomMenu, nb)
                            return <li key={b.id}>{b.nomMenu}{qty !== null ? ` — ${qty} bouteilles` : ' — Machine'}</li>
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Calendar */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>📅 Mes dates</h3>
          <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a2e', padding: '12px 20px' }}>
              <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>‹</button>
              <span style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8f5f0' }}>
              {DAYS.map((d) => <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: '12px', fontWeight: '700', color: '#888' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
              {cells.map((day, i) => {
                const key = day ? dateKey(day) : null
                const events = key ? (eventsByDate[key] || []) : []
                const hasEvent = events.length > 0
                const tod = day && isToday(day)
                return (
                  <div key={i} style={{
                    minHeight: '70px', padding: '6px',
                    borderRight: '1px solid #eee', borderBottom: '1px solid #eee',
                    background: hasEvent ? '#fdf3d9' : tod ? '#f0f7ef' : 'white',
                    cursor: hasEvent ? 'pointer' : 'default',
                  }} onClick={() => hasEvent && setSelectedEv(events[0])}>
                    {day && (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: tod ? '800' : '400', color: tod ? '#27ae60' : hasEvent ? '#b8860b' : '#222', marginBottom: '2px' }}>{day}</div>
                        {events.map((ev, idx) => (
                          <div key={idx} style={{ background: '#c9a84c', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '10px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {ev.typeEvenement}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Event list */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>📋 Tous mes événements assignés</h3>
          {myEvents.length === 0 ? (
            <p style={{ color: '#888', fontSize: '14px' }}>Aucun événement assigné pour le moment.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myEvents.sort((a, b) => a.dateEvenement.localeCompare(b.dateEvenement)).map((ev) => {
                const nb = (parseInt(ev.nbAdultes) || ev.nbPersonnes || 0) + (parseInt(ev.nbEnfants) || 0)
                const menus = (ev.menus || []).filter((m) => m.tarif > 0)
                const isPast = ev.dateEvenement < today.toISOString().split('T')[0]
                return (
                  <div key={ev.id} style={{ padding: '14px', background: isPast ? '#f5f5f5' : '#fdf3d9', borderRadius: '10px', borderLeft: `4px solid ${isPast ? '#ccc' : '#c9a84c'}`, opacity: isPast ? 0.7 : 1 }}>
                    <div style={{ fontWeight: '700', marginBottom: '6px', fontSize: '15px' }}>
                      📅 {new Date(ev.dateEvenement).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      {isPast && <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>Passé</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.8' }}>
                      <div><strong>Type :</strong> {ev.typeEvenement}</div>
                      <div><strong>Convives :</strong> {nb} personnes</div>
                      {menus.length > 0 && <div><strong>Menu :</strong> {menus.map((m) => m.nomMenu).join(', ')}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PIN change section */}
        <div className="card" style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>🔑 Modifier mon code PIN</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '13px' }}>Code actuel</label>
              <input type="password" className="form-control" value={pinCurrent} maxLength={4} placeholder="••••" onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '13px' }}>Nouveau code</label>
              <input type="password" className="form-control" value={pinNew} maxLength={4} placeholder="4 chiffres" onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '13px' }}>Confirmer nouveau code</label>
              <input type="password" className="form-control" value={pinConfirm} maxLength={4} placeholder="4 chiffres" onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))} />
            </div>
            {pinMsg && (
              <p style={{ fontSize: '13px', color: pinMsg.type === 'error' ? '#e74c3c' : '#27ae60', margin: 0 }}>{pinMsg.text}</p>
            )}
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handlePinChange}>Modifier</button>
          </div>
        </div>
      </div>

      {/* Event detail modal */}
      {selectedEv && (
        <div className="modal-overlay" onClick={() => setSelectedEv(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedEv(null)}>✕</button>
            <h3 className="modal-title">📅 Détail de l&apos;événement</h3>
            {(() => {
              const ev = selectedEv
              const nb = (parseInt(ev.nbAdultes) || ev.nbPersonnes || 0) + (parseInt(ev.nbEnfants) || 0)
              const menus = (ev.menus || []).filter((m) => m.tarif > 0)
              const boissons = (ev.menus || []).filter((m) => m.section === 'Boissons')
              return (
                <div style={{ fontSize: '14px', lineHeight: '2', color: '#555' }}>
                  <div><strong>Date :</strong> {new Date(ev.dateEvenement).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  <div><strong>Type :</strong> {ev.typeEvenement}</div>
                  <div><strong>Convives :</strong> {nb} personnes</div>
                  {ev.heureDebut && <div><strong>Horaires :</strong> {ev.heureDebut} — {ev.heureFin}</div>}
                  {menus.length > 0 && (
                    <div>
                      <strong>Menu :</strong>
                      <ul style={{ paddingLeft: '20px' }}>
                        {menus.map((m) => <li key={m.id}>{m.nomMenu}</li>)}
                      </ul>
                    </div>
                  )}
                  {boissons.length > 0 && (
                    <div>
                      <strong>Boissons :</strong>
                      <ul style={{ paddingLeft: '20px' }}>
                        {boissons.map((b) => {
                          const qty = calcBoissonQty(b.nomMenu, nb)
                          return <li key={b.id}>{b.nomMenu}{qty !== null ? ` — ${qty} bouteilles` : ' — Machine'}</li>
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
