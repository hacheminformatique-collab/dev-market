import { useNavigate } from 'react-router-dom'

export default function LegalLayout({ title, children }) {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #14142a 0%, #1c1c3a 55%, #10101e 100%)',
      color: 'white',
      padding: 'clamp(20px, 4vw, 60px) 16px',
    }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', color: 'rgba(184,151,74,0.8)',
            cursor: 'pointer', fontSize: '13px', letterSpacing: '0.08em',
            marginBottom: '32px', padding: 0, display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          ← Retour à l&apos;accueil
        </button>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
          fontWeight: '400',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '12px',
        }}>
          {title}
        </h1>

        <div style={{ width: '60px', height: '2px', background: 'rgba(184,151,74,0.5)', marginBottom: '36px' }} />

        <div style={{
          fontSize: '15px',
          lineHeight: '1.9',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: 'var(--font-body)',
        }}>
          {children}
        </div>

        <div style={{ marginTop: '60px', borderTop: '1px solid rgba(184,151,74,0.15)', paddingTop: '20px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
          SARL AFM — 5 avenue Fridingen, 77100 Nanteuil les Meaux
        </div>
      </div>
    </div>
  )
}
