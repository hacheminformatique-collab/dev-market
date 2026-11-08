import { useEffect, useState } from 'react'
import { assertQuoteRequestsAvailable } from '../utils/quoteMaintenance'

export default function QuoteRequestGuard({ children }) {
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        await assertQuoteRequestsAvailable()
        if (!cancelled) { setStatus('open'); setMessage('') }
      } catch (error) {
        if (!cancelled) { setStatus('blocked'); setMessage(error.message) }
      }
    }
    void check()
    const timer = window.setInterval(check, 30000)
    window.addEventListener('focus', check)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', check) }
  }, [])
  if (status === 'checking') return <div aria-busy="true">
    <p role="status">Vérification des demandes de devis…</p>
    <fieldset disabled inert style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
  </div>
  if (status === 'blocked') return <section className="card"><h2>Demandes de devis indisponibles</h2><p role="alert">{message}</p><a href="/espace-client">Accéder à mes devis existants</a></section>
  return children
}
