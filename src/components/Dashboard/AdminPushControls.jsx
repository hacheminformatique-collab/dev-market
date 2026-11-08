import { useEffect, useRef, useState } from 'react'
import { siteFetch } from '../../utils/siteFetch'

const defaults = { prospect: true, draft: true, signed: true, visit: false }
const labels = { prospect: 'Nouveaux prospects', draft: 'Devis non signés', signed: 'Devis signés',
  visit: 'Visites (au maximum une alerte par visiteur pseudonyme et par jour)' }

function decodeKey(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (letter) => letter.charCodeAt(0))
}

export default function AdminPushControls() {
  const [preferences, setPreferences] = useState(defaults)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const registration = useRef(null)
  const configuration = useRef(null)
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true)
  const ios = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  const supported = typeof window !== 'undefined' && window.isSecureContext
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    && (!ios || standalone)

  async function request(data) {
    const response = await siteFetch('/api/admin-push.php', {
      credentials: 'same-origin', cache: 'no-store',
      ...(data ? { method: 'POST', headers: { 'Content-Type': 'application/json',
        'X-Push-Csrf': configuration.current.csrf }, body: JSON.stringify(data) } : {}),
    })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(result.error || 'Gestion des notifications indisponible.')
    return result
  }

  useEffect(() => {
    const manifest = document.querySelector('link[rel="manifest"]')
    const previous = manifest?.getAttribute('href')
    if (manifest) {
      manifest.setAttribute('crossorigin', 'use-credentials')
      manifest.setAttribute('href', '/api/admin-push-manifest.php')
    }
    let active = true
    if (supported) {
      Promise.all([
        request(),
        navigator.serviceWorker.register('/admin-push-sw.js', { scope: '/', updateViaCache: 'none' })
          .then(() => navigator.serviceWorker.ready),
      ]).then(async ([config, worker]) => {
        if (!active) return
        configuration.current = config
        registration.current = worker
        const subscription = await worker.pushManager.getSubscription()
        if (subscription) {
          const status = await request({ action: 'status', endpoint: subscription.endpoint })
          if (!active) return
          setEnabled(status.subscribed)
          if (status.preferences) setPreferences(status.preferences)
        }
        if (active) setReady(true)
      }).catch((error) => { if (active) setMessage(error.message) })
    }
    return () => {
      active = false
      if (manifest && previous) {
        manifest.setAttribute('href', previous)
        manifest.removeAttribute('crossorigin')
      }
    }
  // The installation context is stable for this page's lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  async function enable() {
    // Request permission before any await: iOS requires the button's direct user gesture.
    const permission = Notification.requestPermission()
    setBusy(true)
    setMessage('')
    let created = null
    try {
      if (await permission !== 'granted') throw new Error('Autorisation refusée. Autorisez les notifications dans les réglages de cet appareil.')
      let subscription = await registration.current.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.current.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: decodeKey(configuration.current.publicKey),
        })
        created = subscription
      }
      await request({ action: 'subscribe', endpoint: subscription.endpoint,
        subscription: subscription.toJSON(), preferences })
      setEnabled(true)
      setMessage('Notifications activées sur cet appareil, même lorsque l’application est fermée.')
    } catch (error) {
      if (created) await created.unsubscribe().catch(() => {})
      setMessage(error.message)
    } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true)
    setMessage('')
    try {
      const subscription = await registration.current.pushManager.getSubscription()
      if (subscription) {
        await request({ action: 'unsubscribe', endpoint: subscription.endpoint })
        setEnabled(false)
        await subscription.unsubscribe()
      }
      setEnabled(false)
      setMessage('Notifications désactivées sur cet appareil.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const subscription = await registration.current.pushManager.getSubscription()
      if (!subscription) throw new Error('Abonnement expiré. Réactivez les notifications.')
      await request({ action: 'subscribe', endpoint: subscription.endpoint,
        subscription: subscription.toJSON(), preferences })
      setMessage('Préférences enregistrées sur le serveur pour cet appareil.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <section className="card" style={{ marginTop: '24px', marginBottom: '24px' }}>
    <h3>Notifications administrateur sur cet appareil</h3>
    <p style={{ margin: '12px 0' }}>
      Sur iPhone/iPad (iOS/iPadOS 16.4 minimum), ouvrez cette administration dans Safari en HTTPS,
      puis Partager → Sur l’écran d’accueil. Ouvrez l’icône « Paradise Admin », reconnectez-vous avec
      votre PIN, revenez dans Mes infos et touchez « Activer ». Acceptez l’autorisation système.
      Un simple onglet Safari ne suffit pas sur iOS. HTTPS est obligatoire.
    </p>
    <p>Les alertes restent génériques, sans noms ni données clients. Leur ouverture mène au dashboard
      privé : une reconnexion peut être demandée. Les visites sont désactivées par défaut.
      La réception dépend du réseau et des réglages Notifications/Concentration de l’appareil.</p>
    {!supported && <p role="status">Ce contexte ne permet pas les notifications Web Push.
      {ios && !standalone ? ' Ouvrez l’application depuis l’écran d’accueil.' : ' Utilisez HTTPS et un navigateur compatible.'}</p>}
    {supported && <>
      <p>État : <strong>{enabled ? 'activées' : 'désactivées'}</strong></p>
      <fieldset disabled={busy || !ready} style={{ border: 0, padding: '12px 0' }}>
        {Object.entries(labels).map(([key, label]) => <label key={key} style={{ display: 'block', marginBottom: '8px' }}>
          <input type="checkbox" checked={preferences[key]}
            onChange={(event) => setPreferences((old) => ({ ...old, [key]: event.target.checked }))} /> {label}
        </label>)}
      </fieldset>
      {enabled
        ? <><button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={save}>Enregistrer les préférences</button>{' '}
          <button type="button" className="btn btn-secondary" disabled={busy || !ready} onClick={disable}>Désactiver</button></>
        : <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={enable}>Activer</button>}
    </>}
    {message && <p role="status" style={{ marginTop: '12px' }}>{message}</p>}
  </section>
}
