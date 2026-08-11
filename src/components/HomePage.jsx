import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, getStaff } from '../utils/storage'

export default function HomePage() {
  const navigate = useNavigate()
  const settings = getSettings()
  const nomSalle = settings.nom || 'Le Paradise'

  const [showClientInput, setShowClientInput] = useState(false)
  const [devisIdInput, setDevisIdInput] = useState('')
  const [clientError, setClientError] = useState('')
  const [showStaffInput, setShowStaffInput] = useState(false)
  const [staffIdInput, setStaffIdInput] = useState('')
  const [staffPinInput, setStaffPinInput] = useState('')
  const [staffError, setStaffError] = useState('')

  function handleEspaceClient() {
    if (!devisIdInput.trim()) { setClientError('Veuillez saisir votre numéro de devis.'); return }
    setClientError('')
    navigate(`/espace-client/${devisIdInput.trim()}`)
  }

  function handleEspaceStaff() {
    const matricule = staffIdInput.trim()
    if (!matricule) { setStaffError('Veuillez saisir votre matricule.'); return }
    const allStaff = getStaff()
    const member = allStaff.find((s) => s.matricule === matricule)
    if (!member) { setStaffError('Matricule introuvable.'); return }
    const expectedPin = member.pin || '1234'
    if (staffPinInput !== expectedPin) { setStaffError('Code PIN incorrect.'); return }
    setStaffError('')
    sessionStorage.setItem(`staffAuth_${member.id}`, '1')
    navigate(`/espace-staff/${member.id}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #14142a 0%, #1c1c3a 55%, #10101e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(20px, 4vw, 40px) 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Subtle background pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(184,151,74,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(184,151,74,0.04) 0%, transparent 45%)',
      }} />

      {/* Top horizontal rule */}
      <div style={{ position: 'absolute', top: '40px', left: '50%', transform: 'translateX(-50%)', width: 'min(320px, 80vw)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(184,151,74,0.35)' }} />
        <div style={{ color: 'rgba(184,151,74,0.5)', fontSize: '14px', letterSpacing: '0.3em' }}>✦</div>
        <div style={{ flex: 1, height: '1px', background: 'rgba(184,151,74,0.35)' }} />
      </div>

      <div style={{ textAlign: 'center', color: 'white', maxWidth: '620px', width: '100%', position: 'relative', zIndex: 1 }}>

        {/* Logo / Brand */}
        <p style={{
          fontSize: '11px',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          color: 'rgba(184,151,74,0.7)',
          marginBottom: '12px',
          fontFamily: 'var(--font-body)',
          fontWeight: '700',
        }}>
          Salle de réception
        </p>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(2.8rem, 6vw, 4.5rem)',
          fontWeight: '400',
          color: '#fff',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          lineHeight: 1,
          marginBottom: '8px',
        }}>
          {nomSalle}
        </h1>

        {/* Gold ornament */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', margin: '18px 0 36px' }}>
          <div style={{ width: '60px', height: '1px', background: 'linear-gradient(to right, transparent, rgba(184,151,74,0.8))' }} />
          <div style={{ color: 'var(--gold)', fontSize: '16px', letterSpacing: '0.2em' }}>✦</div>
          <div style={{ width: '60px', height: '1px', background: 'linear-gradient(to left, transparent, rgba(184,151,74,0.8))' }} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>

          <button onClick={() => navigate('/devis')} className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '300px', justifyContent: 'center', fontSize: '13px' }}>
            Demander un devis
          </button>

          <button onClick={() => setShowClientInput((v) => !v)} className="btn btn-outline btn-lg" style={{ width: '100%', maxWidth: '300px', justifyContent: 'center', fontSize: '13px' }}>
            Espace client
          </button>

          {showClientInput && (
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(184,151,74,0.3)',
              borderRadius: '12px',
              padding: '22px',
              width: '100%',
              maxWidth: '300px',
              textAlign: 'left',
            }}>
              <p style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px', fontWeight: '700' }}>
                N° de devis
              </p>
              <input
                type="text"
                value={devisIdInput}
                onChange={(e) => setDevisIdInput(e.target.value)}
                placeholder="DEV-20240101-001"
                onKeyDown={(e) => e.key === 'Enter' && handleEspaceClient()}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '6px',
                  border: '1.5px solid rgba(184,151,74,0.4)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white', fontSize: '14px', marginBottom: '10px',
                  outline: 'none', fontFamily: 'var(--font-body)',
                }}
              />
              {clientError && <p style={{ color: '#f5a623', fontSize: '12px', marginBottom: '8px' }}>{clientError}</p>}
              <button className="btn btn-primary w-100" style={{ justifyContent: 'center', fontSize: '12px' }} onClick={handleEspaceClient}>
                Accéder →
              </button>
            </div>
          )}

          <button onClick={() => setShowStaffInput((v) => !v)} className="btn btn-outline btn-lg" style={{ width: '100%', maxWidth: '300px', justifyContent: 'center', fontSize: '13px' }}>
            Espace staff
          </button>

          {showStaffInput && (
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '22px',
              width: '100%',
              maxWidth: '300px',
              textAlign: 'left',
            }}>
              <p style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px', fontWeight: '700' }}>
                Identifiant staff
              </p>
              <input
                type="text"
                value={staffIdInput}
                onChange={(e) => setStaffIdInput(e.target.value)}
                placeholder="EMP-XXXX"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '6px',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'white', fontSize: '14px', marginBottom: '10px',
                  outline: 'none', fontFamily: 'var(--font-body)',
                }}
              />
              <p style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px', fontWeight: '700' }}>
                Code PIN
              </p>
              <input
                type="password"
                value={staffPinInput}
                onChange={(e) => setStaffPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4 chiffres"
                maxLength={4}
                onKeyDown={(e) => e.key === 'Enter' && handleEspaceStaff()}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '6px',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'white', fontSize: '14px', marginBottom: '10px',
                  outline: 'none', fontFamily: 'var(--font-body)',
                }}
              />
              {staffError && <p style={{ color: '#f5a623', fontSize: '12px', marginBottom: '8px' }}>{staffError}</p>}
              <button
                className="btn w-100"
                style={{ justifyContent: 'center', fontSize: '12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                onClick={handleEspaceStaff}
              >
                Accéder →
              </button>
            </div>
          )}

          <button onClick={() => navigate('/blog')} className="btn btn-outline btn-lg" style={{ width: '100%', maxWidth: '300px', justifyContent: 'center', fontSize: '13px' }}>
            📝 Blog
          </button>

          <button onClick={() => navigate('/admin')} className="btn btn-outline btn-lg" style={{ width: '100%', maxWidth: '300px', justifyContent: 'center', fontSize: '13px' }}>
            🔐 Administration
          </button>
        </div>

        {/* Presentation section */}
        <div style={{ marginTop: 'clamp(40px, 6vw, 80px)', textAlign: 'center' }}>
          <p style={{
            fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(184,151,74,0.6)', marginBottom: '16px', fontWeight: '700',
          }}>
            Notre espace
          </p>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontWeight: '400',
            fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', color: 'white',
            letterSpacing: '0.08em', marginBottom: '16px',
          }}>
            Un cadre élégant pour vos événements
          </h2>
          <p style={{
            fontSize: '15px', lineHeight: '1.8', color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-body)', maxWidth: '540px', margin: '0 auto 40px',
          }}>
            Nichée en Seine-et-Marne, la salle de réception {nomSalle} accueille tous vos moments précieux — mariages, anniversaires, baptêmes, fiançailles et séminaires — dans un cadre raffiné alliant luxe, confort et service sur mesure.
          </p>

          {/* Feature cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px', textAlign: 'left',
          }}>
            {[
              { icon: '💍', title: 'Mariages & Fiançailles', desc: 'Décoration somptueuse et coordination complète pour le plus beau jour de votre vie.' },
              { icon: '🎂', title: 'Anniversaires', desc: 'Célébrez chaque étape de la vie dans un espace chaleureux et personnalisé.' },
              { icon: '🕊️', title: 'Baptêmes', desc: 'Accueillez vos proches dans une atmosphère sereine et lumineuse.' },
              { icon: '🤝', title: 'Séminaires', desc: 'Salles modulables et équipements professionnels pour vos événements d\'entreprise.' },
            ].map((item) => (
              <div key={item.title} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(184,151,74,0.15)',
                borderRadius: '12px', padding: '20px',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{item.icon}</div>
                <p style={{
                  fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'rgba(184,151,74,0.85)', marginBottom: '8px',
                }}>{item.title}</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 'clamp(40px, 6vw, 80px)', padding: '24px 0', borderTop: '1px solid rgba(184,151,74,0.2)' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', lineHeight: '2', marginBottom: '16px' }}>
            SARL AFM — 5 avenue Fridingen, 77100 Nanteuil les Meaux<br />
            📞 0782821582 — ✉️ contact@leparadise77.fr
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Mentions légales', path: '/mentions-legales' },
              { label: 'CGU', path: '/conditions-generales' },
              { label: 'Confidentialité & RGPD', path: '/politique-confidentialite' },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontSize: '11px', letterSpacing: '0.08em',
                  textDecoration: 'underline', textUnderlineOffset: '3px', padding: 0,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/33782821582"
        target="_blank"
        rel="noopener noreferrer"
        title="Contactez-nous sur WhatsApp"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          zIndex: 9999,
          textDecoration: 'none',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.45)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  )
}
