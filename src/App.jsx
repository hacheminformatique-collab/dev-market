import { useEffect, useMemo, useRef, useState } from 'react'
import CalendarView from './components/CalendarView.jsx'
import SignaturePad from './components/SignaturePad.jsx'
import { generateDevisPdf } from './lib/generatePdf.js'
import './index.css'

const STORAGE_KEY = 'dev-market-data-v1'
const DEVIS_KEY = 'dev-market-devis-v1'
const GUARD_KEY = 'dev-market-admin-guard'

const defaultData = {
  mesInfos: { nom: 'LE PARADISE' },
  adminCode: '2205',
  formules: [
    { id: 'seche', nom: 'Location sèche', contenu: 'Décoration + vaisselles + nettoyage', photo: '' },
    { id: 'prestation', nom: 'Location avec prestation', contenu: 'Décoration + vaisselles + prestation + nettoyage', photo: '' },
  ],
  menus: [
    { id: 'cbs', section: '1', nom: 'Cocktail bienvenue starter', tarif: 5, description: '5/6 pcs par personne', photo: '' },
    { id: 'cbm', section: '1', nom: 'Cocktail bienvenue medium', tarif: 7, description: '8/9 pcs par personne', photo: '' },
    { id: 'cbp', section: '1', nom: 'Cocktail bienvenue premium', tarif: 9, description: '10/12 pcs par personne', photo: '' },
    { id: 'e1', section: '2', nom: 'Salade composée méditéranéene', tarif: 12, description: 'Service en plat central', photo: '' },
    { id: 'e2', section: '2', nom: 'Buratta du chef', tarif: 13, description: "Service à l'assiette", photo: '' },
    { id: 'e3', section: '2', nom: 'Bouchée à la reine forestière', tarif: 13, description: "Service à l'assiette", photo: '' },
    { id: 'e4', section: '2', nom: 'Salade tunisienne', tarif: 12, description: 'Service en plat central', photo: '' },
    { id: 'p1', section: '3', nom: 'Poulet olives', tarif: 15, description: 'Service en plat central', photo: '' },
    { id: 'p2', section: '3', nom: 'Suprême de volaille', tarif: 19, description: "Service à l'assiette avec 2 accompagnements", photo: '' },
    { id: 'p3', section: '3', nom: 'Tajine aux pruneaux', tarif: 19, description: 'Service en plat central', photo: '' },
    { id: 'd1', section: '4', nom: 'Plateaux de fruit', tarif: 8, description: '', photo: '' },
    { id: 'd2', section: '4', nom: 'Trilogie du paradise', tarif: 9, description: '', photo: '' },
    { id: 'enfant', section: '4', nom: 'Menu enfants (nuggets frite + compote)', tarif: 20, description: '20 € / enfant', photo: '' },
    { id: 'b1', section: '5', nom: 'Eau de source', tarif: 0, description: 'Boisson', photo: '' },
    { id: 'b2', section: '5', nom: 'Coca', tarif: 0, description: 'Boisson gazeuse', photo: '' },
    { id: 'b3', section: '5', nom: 'Thé et Café', tarif: 0, description: 'Boisson chaude', photo: '' },
  ],
  gateaux: [
    { id: 'g1', nom: 'Gâteau 1', tarif: 4, photo: '' },
    { id: 'g2', nom: 'Gâteau 2', tarif: 4, photo: '' },
    { id: 'g3', nom: 'Gâteau 3', tarif: 4.5, photo: '' },
    { id: 'g4', nom: 'Gâteau 4', tarif: 4.5, photo: '' },
    { id: 'none', nom: 'Continuer sans gâteau', tarif: 0, photo: '' },
  ],
  prestations: [
    { id: 'dj', nom: 'DJ', tarif: 800, description: 'Pour animer votre soirée', photo: '' },
    { id: 'fumee', nom: 'Fumée lourde', tarif: 150, description: 'Slow et ouverture de bal', photo: '' },
    { id: 'jet', nom: 'Jet de scène', tarif: 100, description: 'Slow ou wedding cake', photo: '' },
    { id: 'photo', nom: 'Photobooth', tarif: 450, description: 'Garder un souvenir', photo: '' },
    { id: 'video', nom: 'Videobooth360', tarif: 250, description: 'Garder un souvenir', photo: '' },
  ],
}

const readData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultData, ...JSON.parse(raw) } : defaultData
  } catch { return defaultData }
}
const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

const readDevis = () => {
  try { return JSON.parse(localStorage.getItem(DEVIS_KEY) || '[]') } catch { return [] }
}
const saveDevis = (list) => localStorage.setItem(DEVIS_KEY, JSON.stringify(list))

const money = (v) => `${Number(v).toFixed(2)} €`

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [data, setData] = useState(readData)

  useEffect(() => saveData(data), [data])

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  const updateData = (next) => setData((prev) => ({ ...prev, ...next }))

  if (path === '/dashboard') {
    const guard = JSON.parse(localStorage.getItem(GUARD_KEY) || '{}')
    if (!guard.authenticated) { navigate('/admin-login'); return null }
    return <DashboardPage data={data} updateData={updateData} onHome={() => navigate('/')} />
  }
  if (path === '/admin-login') return <AdminLoginPage data={data} onSuccess={() => navigate('/dashboard')} onHome={() => navigate('/')} />
  if (path === '/devis') return <DevisPage data={data} onHome={() => navigate('/')} />
  if (path.startsWith('/espace-client')) return <ClientSpacePage onHome={() => navigate('/')} />
  if (path === '/staff') return <StaffPage onHome={() => navigate('/')} />

  return <HomePage data={data} onNavigate={navigate} />
}

// ─────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────
function HomePage({ data, onNavigate }) {
  return (
    <main className="centered">
      <h1>{data.mesInfos.nom.toUpperCase()}</h1>
      <p className="subtitle">Votre expérience commence ici</p>
      <div className="actions">
        <button onClick={() => onNavigate('/admin-login')}>Admin</button>
        <button onClick={() => onNavigate('/devis')}>Devis</button>
        <button onClick={() => onNavigate('/espace-client')}>Espace client</button>
        <button onClick={() => onNavigate('/staff')}>Staff</button>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────────────
function AdminLoginPage({ data, onSuccess, onHome }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const guard = JSON.parse(localStorage.getItem(GUARD_KEY) || '{}')
  const now = Date.now()
  const locked = guard.lockUntil && guard.lockUntil > now
  const minutesLeft = locked ? Math.ceil((guard.lockUntil - now) / 60000) : 0

  const submit = (e) => {
    e.preventDefault()
    if (locked) return
    if (code === data.adminCode) {
      localStorage.setItem(GUARD_KEY, JSON.stringify({ authenticated: true, attempts: 0, lockUntil: 0 }))
      onSuccess()
      return
    }
    const attempts = (guard.attempts || 0) + 1
    if (attempts >= 3) {
      localStorage.setItem(GUARD_KEY, JSON.stringify({ authenticated: false, attempts: 0, lockUntil: Date.now() + 10 * 60 * 1000 }))
      setMessage('3 codes erronés : accès bloqué 10 minutes.')
      return
    }
    localStorage.setItem(GUARD_KEY, JSON.stringify({ authenticated: false, attempts, lockUntil: 0 }))
    setMessage(`Code incorrect (${attempts}/3).`)
  }

  return (
    <main className="panel narrow">
      <h2>Connexion Admin</h2>
      {locked ? <p className="error">Accès verrouillé, réessayez dans {minutesLeft} min.</p> : null}
      {message ? <p className="error">{message}</p> : null}
      <form onSubmit={submit}>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Code 4 chiffres" required />
        <div className="row">
          <button type="submit" disabled={locked}>Se connecter</button>
          <button type="button" onClick={onHome}>Retour</button>
        </div>
      </form>
    </main>
  )
}

// ─────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────
function DashboardPage({ data, updateData, onHome }) {
  const tabs = ['Mes infos', 'Mot de passe', 'Formules', 'Menus', 'Gâteaux', 'Prestations', 'Calendrier', 'Clients & Devis']
  const [tab, setTab] = useState(tabs[0])

  const logout = () => {
    localStorage.setItem(GUARD_KEY, JSON.stringify({ authenticated: false, attempts: 0, lockUntil: 0 }))
    onHome()
  }

  return (
    <main className="panel">
      <div className="row between">
        <h2>Dashboard</h2>
        <div className="row">
          <button onClick={onHome}>Accueil</button>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}
      </div>
      {tab === 'Mes infos' && <MesInfosTab data={data} updateData={updateData} />}
      {tab === 'Mot de passe' && <MotDePasseTab data={data} updateData={updateData} />}
      {tab === 'Formules' && <ProductTab title="formules" items={data.formules} fields={['nom', 'contenu']} update={(items) => updateData({ formules: items })} />}
      {tab === 'Menus' && <ProductTab title="menus" items={data.menus} fields={['section', 'nom', 'tarif', 'description']} update={(items) => updateData({ menus: items })} />}
      {tab === 'Gâteaux' && <ProductTab title="gâteaux" items={data.gateaux} fields={['nom', 'tarif']} update={(items) => updateData({ gateaux: items })} />}
      {tab === 'Prestations' && <ProductTab title="prestations" items={data.prestations} fields={['nom', 'tarif', 'description']} update={(items) => updateData({ prestations: items })} />}
      {tab === 'Calendrier' && <CalendrierTab />}
      {tab === 'Clients & Devis' && <ClientsDevisTab />}
    </main>
  )
}

function MesInfosTab({ data, updateData }) {
  return (
    <div className="tab-content">
      <label>Nom de la salle</label>
      <input value={data.mesInfos.nom} onChange={(e) => updateData({ mesInfos: { ...data.mesInfos, nom: e.target.value } })} />
    </div>
  )
}

function MotDePasseTab({ data, updateData }) {
  return (
    <div className="tab-content">
      <label>Code admin (4 chiffres)</label>
      <input value={data.adminCode} onChange={(e) => updateData({ adminCode: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
    </div>
  )
}

function ProductTab({ title, items, fields, update }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map((f) => [f, f === 'tarif' ? 0 : ''])))

  const add = () => {
    if (!draft.nom) return
    update([...items, { ...draft, id: `${title}-${crypto.randomUUID()}`, photo: '' }])
    setDraft(Object.fromEntries(fields.map((f) => [f, f === 'tarif' ? 0 : ''])))
  }

  const remove = (id) => update(items.filter((item) => item.id !== id))
  const patch = (id, key, value) => update(items.map((item) => (item.id === id ? { ...item, [key]: key === 'tarif' ? Number(value) || 0 : value } : item)))

  const loadPhoto = (id, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => patch(id, 'photo', String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  return (
    <div className="tab-content">
      <h3>Gestion {title}</h3>
      <div className="grid-products">
        {items.map((item) => (
          <article key={item.id} className="card">
            {item.photo ? <img src={item.photo} alt={item.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
            {fields.map((field) => (
              <input key={field} type={field === 'tarif' ? 'number' : 'text'} value={item[field] ?? ''} onChange={(e) => patch(item.id, field, e.target.value)} placeholder={field} />
            ))}
            <input type="file" accept="image/*" onChange={(e) => loadPhoto(item.id, e.target.files?.[0])} />
            <button onClick={() => remove(item.id)}>Supprimer</button>
          </article>
        ))}
      </div>
      <h4>Ajouter</h4>
      <div className="row wrap">
        {fields.map((field) => (
          <input key={field} type={field === 'tarif' ? 'number' : 'text'} value={draft[field]} placeholder={field}
            onChange={(e) => setDraft((prev) => ({ ...prev, [field]: field === 'tarif' ? Number(e.target.value) || 0 : e.target.value }))} />
        ))}
        <button onClick={add}>Ajouter</button>
      </div>
    </div>
  )
}

function CalendrierTab() {
  const devis = readDevis()
  const events = devis.map((d) => ({
    date: d.event?.date || '',
    label: `${d.client?.prenom || ''} ${d.client?.nom || ''} – ${d.event?.type || ''}`,
    type: d.event?.type || '',
  }))
  return (
    <div className="tab-content">
      <h3>Calendrier des événements</h3>
      <CalendarView events={events} />
    </div>
  )
}

function ClientsDevisTab() {
  const devis = readDevis()
  return (
    <div className="tab-content">
      <h3>Clients & Devis ({devis.length})</h3>
      {devis.length === 0 && <p>Aucun devis enregistré pour le moment.</p>}
      <div className="table-wrap">
        {devis.map((d) => (
          <div key={d.quoteNumber} className="client-row">
            <div>
              <strong>{d.client?.prenom} {d.client?.nom}</strong>
              <span className="badge">{d.quoteNumber}</span>
            </div>
            <div className="row wrap">
              <span>{d.event?.type}</span>
              <span>{d.event?.date}</span>
              <span>{Number(d.event?.adults || 0) + Number(d.event?.children || 0)} convives</span>
              <span className="amount">{money(d.totals?.totalTtc || 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// DEVIS WIZARD
// ─────────────────────────────────────────────────────
function DevisPage({ data, onHome }) {
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [client, setClient] = useState({ nom: '', prenom: '', phone: '', email: '' })
  const [event, setEvent] = useState({ type: '', date: '', adults: 0, children: 0 })
  const [formule, setFormule] = useState('')
  const [menu, setMenu] = useState({ s1: '', s2: '', s3: '', s4: '', menuEnfant: false, s5: [] })
  const [gateau, setGateau] = useState({ id: '', detailsDone: false, levels: { l2: '', l3: '', l4: '' }, initiales: '' })
  const [showPopup, setShowPopup] = useState(false)
  const [options, setOptions] = useState([])
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [validated, setValidated] = useState(false)
  const quoteNumber = useRef(`DEV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`).current

  const guests = Number(event.adults || 0) + Number(event.children || 0)

  const sallePricing = useMemo(() => {
    if (!event.date) return { seche: 0, prestation: 0, remise: 0 }
    const d = new Date(event.date + 'T12:00:00')
    const month = d.getMonth() + 1
    const day = d.getDay()
    const basse = month === 12 || month <= 3
    const key = day === 5 ? 'fri' : day === 6 ? 'sat' : 'other'
    const secheTable = basse ? { fri: 2500, sat: 3500, other: 2000 } : { fri: 3500, sat: 4500, other: 2500 }
    const prestaTable = basse ? { fri: 1500, sat: 2500, other: 1000 } : { fri: 2500, sat: 3000, other: 1500 }
    const seche = secheTable[key]
    const prestation = prestaTable[key]
    return { seche, prestation, remise: seche - prestation }
  }, [event.date])

  const menuById = useMemo(() => Object.fromEntries(data.menus.map((m) => [m.id, m])), [data.menus])
  const gateauById = useMemo(() => Object.fromEntries(data.gateaux.map((g) => [g.id, g])), [data.gateaux])
  const prestaById = useMemo(() => Object.fromEntries(data.prestations.map((p) => [p.id, p])), [data.prestations])

  const totals = useMemo(() => {
    const salleTtc = formule === 'seche' ? sallePricing.seche : formule === 'prestation' ? sallePricing.prestation : 0
    const sec1 = menu.s1 ? (menuById[menu.s1]?.tarif || 0) * guests : 0
    const sec2 = menu.s2 ? (menuById[menu.s2]?.tarif || 0) * Number(event.adults || 0) : 0
    const sec3 = menu.s3 ? (menuById[menu.s3]?.tarif || 0) * Number(event.adults || 0) : 0
    const sec4 = menu.s4 ? (menuById[menu.s4]?.tarif || 0) * Number(event.adults || 0) : 0
    const enfants = menu.menuEnfant ? (menuById.enfant?.tarif || 0) * Number(event.children || 0) : 0
    const traiteurTtc = sec1 + sec2 + sec3 + sec4 + enfants
    const gateauTtc = gateau.id && gateau.id !== 'none' ? (gateauById[gateau.id]?.tarif || 0) * guests : 0
    const optionsTtc = options.reduce((acc, id) => acc + (prestaById[id]?.tarif || 0), 0)
    return { salleTtc, traiteurTtc, gateauTtc, optionsTtc, totalTtc: salleTtc + traiteurTtc + gateauTtc + optionsTtc }
  }, [event.adults, event.children, formule, gateau.id, gateauById, guests, menu.menuEnfant, menu.s1, menu.s2, menu.s3, menu.s4, options, prestaById, sallePricing.prestation, sallePricing.seche, menuById])

  const canNext = () => {
    if (step === 1) return client.nom && client.prenom && client.phone && client.email
    if (step === 2) return event.type && event.date && guests > 0 && guests <= 300
    if (step === 3) return !!formule
    if (step === 4) return !!menu.s2 && !!menu.s3 && !!menu.s4
    if (step === 5) return !!gateau.id && (gateau.id === 'none' || gateau.detailsDone)
    return true
  }

  const next = () => {
    setError('')
    if (!canNext()) {
      setError(guests > 300 ? 'La capacité maximum de la salle de réception est de 300 personnes.' : 'Merci de compléter les champs obligatoires.')
      return
    }
    if (step === 3 && formule === 'seche') setStep(6)
    else setStep((prev) => Math.min(7, prev + 1))
  }

  const back = () => {
    setError('')
    if (step === 6 && formule === 'seche') { setStep(3); return }
    setStep((prev) => Math.max(1, prev - 1))
  }

  const sectionItems = (section) => data.menus.filter((i) => i.section === section)

  const buildPdfArgs = () => ({
    quoteNumber, client, event, formule, menuById, gateauById, prestaById, menu, gateau, options, totals, sallePricing, signatureDataUrl,
  })

  const handleDownloadDevis = () => {
    const doc = generateDevisPdf(buildPdfArgs())
    doc.save(`Devis-${quoteNumber}.pdf`)
  }

  const handleValidate = () => {
    if (!signatureDataUrl) { setError('Merci de signer le devis avant de valider.'); return }
    // Generate PDF and open in new tab
    const doc = generateDevisPdf(buildPdfArgs())
    const pdfUrl = doc.output('bloburl')
    window.open(pdfUrl, '_blank')
    // Persist devis
    const token = crypto.randomUUID()
    const record = { quoteNumber, token, client, event, formule, menu, gateau: { id: gateau.id }, options, totals, signedAt: new Date().toISOString(), docsUploaded: { recto: false, verso: false, assurance: false }, payments: [] }
    const list = readDevis()
    list.push(record)
    saveDevis(list)
    // Compose email body
    const clientUrl = `${window.location.origin}/espace-client?token=${token}`
    const subject = encodeURIComponent(`Votre devis LE PARADISE – ${quoteNumber}`)
    const body = encodeURIComponent(`Bonjour ${client.prenom} ${client.nom},\n\nVotre devis ${quoteNumber} a été signé.\n\nAccédez à votre espace client pour retrouver votre devis et déposer vos documents :\n${clientUrl}\n\nMerci de joindre :\n- Copie pièce d'identité (recto/verso)\n- Attestation d'assurance responsabilité civile\n\nÀ très bientôt,\nL'équipe LE PARADISE\ncontact@leparadise77.fr`)
    window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`
    setValidated(true)
  }

  const handleSendLink = () => {
    const clientUrl = `${window.location.origin}/espace-client`
    const subject = encodeURIComponent(`Votre devis LE PARADISE – ${quoteNumber}`)
    const body = encodeURIComponent(`Bonjour ${client.prenom} ${client.nom},\n\nRetrouvez votre devis et votre espace client ici :\n${clientUrl}\n\nÀ très bientôt,\nL'équipe LE PARADISE\ncontact@leparadise77.fr`)
    window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`
  }

  if (validated) {
    return (
      <main className="panel narrow centered">
        <h2>✅ Devis validé !</h2>
        <p>Le PDF s'est ouvert dans un nouvel onglet. Un email a été préparé pour {client.email}.</p>
        <p>Le client recevra un lien vers son espace client.</p>
        <button onClick={onHome}>Retour accueil</button>
      </main>
    )
  }

  return (
    <main className="panel">
      <div className="row between">
        <h2>Devis – Étape {step}/7</h2>
        <button onClick={onHome}>Accueil</button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      {step === 1 && (
        <div className="tab-content">
          <h3>Vos coordonnées</h3>
          <div className="grid-two">
            <input placeholder="Nom" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} />
            <input placeholder="Prénom" value={client.prenom} onChange={(e) => setClient({ ...client, prenom: e.target.value })} />
            <input placeholder="Téléphone" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
            <input placeholder="Mail" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="tab-content">
          <h3 className="center">Personnaliser mon évènement</h3>
          <label>Type d'évènement</label>
          <select value={event.type} onChange={(e) => setEvent({ ...event, type: e.target.value })}>
            <option value="">Sélectionner</option>
            {['Anniversaire', 'Babyshower', 'Baptême', 'Fiançailles', 'Mariage', 'Autres'].map((x) => <option key={x}>{x}</option>)}
          </select>
          <label>Date de l'évènement</label>
          <input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} />
          {event.date && (
            <p className="info-box">
              Tarif applicable : <strong>
                {sallePricing.seche > 0 ? `Location sèche ${money(sallePricing.seche)} / Avec prestation ${money(sallePricing.prestation)}` : '–'}
              </strong>
            </p>
          )}
          <div className="grid-two">
            <input type="number" min="0" max="300" placeholder="Nombre d'adultes" value={event.adults || ''} onChange={(e) => setEvent({ ...event, adults: Number(e.target.value) || 0 })} />
            <input type="number" min="0" max="300" placeholder="Nombre d'enfants" value={event.children || ''} onChange={(e) => setEvent({ ...event, children: Number(e.target.value) || 0 })} />
          </div>
          {guests > 0 && <p className="info-box">Total convives : <strong>{guests}</strong> / 300 max</p>}
        </div>
      )}

      {step === 3 && (
        <div className="tab-content">
          <h3 className="center">Je choisis ma formule</h3>
          <div className="grid-products">
            {data.formules.map((f) => {
              const prix = f.id === 'seche' ? sallePricing.seche : sallePricing.prestation
              return (
                <article key={f.id} className={`card selectable ${formule === f.id ? 'selected' : ''}`} onClick={() => setFormule(f.id)}>
                  {f.photo ? <img src={f.photo} alt={f.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
                  <strong>{f.nom}</strong>
                  <p>{f.contenu}</p>
                  <p className="amount">Tarif : {money(prix)}</p>
                  {f.id === 'prestation' && <p className="promo">Remise incluse : {money(sallePricing.remise)}</p>}
                </article>
              )
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="tab-content">
          <h3>Menu traiteur</h3>
          <MenuSelector title="Section 1 – Cocktail bienvenu (optionnel)" items={sectionItems('1')} value={menu.s1} onChange={(id) => setMenu({ ...menu, s1: id })} perUnit="total invités" />
          <MenuSelector title="Section 2 – Entrée (obligatoire *)" items={sectionItems('2')} value={menu.s2} onChange={(id) => setMenu({ ...menu, s2: id })} required perUnit="adulte" />
          <MenuSelector title="Section 3 – Plat (obligatoire *)" items={sectionItems('3')} value={menu.s3} onChange={(id) => setMenu({ ...menu, s3: id })} required perUnit="adulte" />
          <MenuSelector title="Section 4 – Dessert (obligatoire *)" items={sectionItems('4').filter((i) => i.id !== 'enfant')} value={menu.s4} onChange={(id) => setMenu({ ...menu, s4: id })} required perUnit="adulte" />
          <label className="checkbox-label">
            <input type="checkbox" checked={menu.menuEnfant} onChange={(e) => setMenu({ ...menu, menuEnfant: e.target.checked })} />
            Ajouter menu enfants – nuggets frite + compote (20 € x {event.children} enfants)
          </label>
          <div>
            <p><strong>Section 5 – Boissons (max 3)</strong></p>
            <div className="row wrap">
              {sectionItems('5').map((item) => (
                <label key={item.id} className="checkbox-label">
                  <input type="checkbox" checked={menu.s5.includes(item.id)} onChange={(e) => {
                    const next = e.target.checked ? [...menu.s5, item.id] : menu.s5.filter((id) => id !== item.id)
                    if (next.length <= 3) setMenu({ ...menu, s5: next })
                  }} />
                  {item.nom}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="tab-content">
          <h3>Choix du gâteau</h3>
          <div className="grid-products">
            {data.gateaux.map((g) => (
              <article key={g.id} className={`card selectable ${gateau.id === g.id ? 'selected' : ''}`} onClick={() => {
                setGateau({ ...gateau, id: g.id, detailsDone: g.id === 'none' })
                if (g.id !== 'none') setShowPopup(true)
              }}>
                {g.photo ? <img src={g.photo} alt={g.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
                <strong>{g.nom}</strong>
                <p>{g.tarif > 0 ? `${money(g.tarif)} / personne` : 'Gratuit'}</p>
              </article>
            ))}
          </div>
          {showPopup && (
            <div className="modal">
              <div className="panel narrow">
                <h4>Personnalisation du gâteau</h4>
                <p>Niveau 1 : <strong>Chocolat</strong></p>
                {[['l2', 2], ['l3', 3], ['l4', 4]].map(([key, num]) => (
                  <div key={key}>
                    <label>Niveau {num}</label>
                    <select value={gateau.levels[key]} onChange={(e) => setGateau({ ...gateau, levels: { ...gateau.levels, [key]: e.target.value } })}>
                      <option value="">Choisir un goût</option>
                      {['Chocolat', 'Fruit', 'Fraise', 'Caramel spéculos'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                ))}
                <label>Initiales à inscrire sur le gâteau</label>
                <input placeholder="Ex: M & J" value={gateau.initiales} onChange={(e) => setGateau({ ...gateau, initiales: e.target.value })} />
                <button onClick={() => {
                  if (gateau.levels.l2 && gateau.levels.l3 && gateau.levels.l4 && gateau.initiales) {
                    setGateau((prev) => ({ ...prev, detailsDone: true }))
                    setShowPopup(false)
                  }
                }}>Valider</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 6 && (
        <div className="tab-content">
          <h3>Options supplémentaires</h3>
          <div className="grid-products">
            {data.prestations.map((p) => (
              <label key={p.id} className={`card selectable ${options.includes(p.id) ? 'selected' : ''}`}>
                {p.photo ? <img src={p.photo} alt={p.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
                <input type="checkbox" checked={options.includes(p.id)} onChange={(e) => setOptions(e.target.checked ? [...options, p.id] : options.filter((id) => id !== p.id))} />
                <strong>{p.nom}</strong>
                <p>{p.description}</p>
                <p className="amount">{money(p.tarif)}</p>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="tab-content">
          <h3>Synthèse détaillée – Validation</h3>
          <div className="summary-box">
            <p><strong>N° devis :</strong> {quoteNumber}</p>
            <p><strong>Client :</strong> {client.prenom} {client.nom} – {client.phone} – {client.email}</p>
            <p><strong>Événement :</strong> {event.type} le {event.date} – {guests} convives ({event.adults} adultes / {event.children} enfants)</p>
          </div>
          <table className="devis-table">
            <thead>
              <tr>
                <th>Désignation</th><th>TVA</th><th>TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{formule === 'seche' ? 'Location sèche' : 'Location avec prestation'}</td><td>20%</td><td>{money(totals.salleTtc)}</td></tr>
              {totals.traiteurTtc > 0 && <tr><td>Traiteur</td><td>10%</td><td>{money(totals.traiteurTtc)}</td></tr>}
              {totals.gateauTtc > 0 && <tr><td>Gâteau</td><td>10%</td><td>{money(totals.gateauTtc)}</td></tr>}
              {totals.optionsTtc > 0 && <tr><td>Options</td><td>20%</td><td>{money(totals.optionsTtc)}</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><strong>TOTAL TTC</strong></td><td><strong>{money(totals.totalTtc)}</strong></td></tr>
            </tfoot>
          </table>
          <div className="sig-section">
            <h4>Bon pour accord – Signature du client</h4>
            <SignaturePad onChange={setSignatureDataUrl} />
            {signatureDataUrl && <p className="ok-text">✅ Signature enregistrée</p>}
          </div>
          <div className="row wrap">
            <button onClick={handleSendLink}>Recevoir mon devis par mail</button>
            <button onClick={handleDownloadDevis}>Télécharger le PDF</button>
            <button className="btn-primary" onClick={handleValidate}>Je valide mon devis</button>
          </div>
        </div>
      )}

      {step >= 3 && (
        <p className="cart-total">Panier actuel : <strong>{money(totals.totalTtc)}</strong></p>
      )}

      <div className="row nav-row">
        <button onClick={back} disabled={step === 1}>← Précédent</button>
        {step < 7 && <button onClick={next}>Suivant →</button>}
      </div>
    </main>
  )
}

function MenuSelector({ title, items, value, onChange, _required, perUnit }) {
  return (
    <div className="menu-section">
      <p><strong>{title}</strong></p>
      <div className="grid-products">
        {items.map((item) => (
          <article key={item.id} className={`card selectable ${value === item.id ? 'selected' : ''}`} onClick={() => onChange(item.id)}>
            {item.photo ? <img src={item.photo} alt={item.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
            <strong>{item.nom}</strong>
            {item.description ? <p>{item.description}</p> : null}
            {item.tarif > 0 ? <p className="amount">{money(item.tarif)} / {perUnit}</p> : null}
          </article>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// ESPACE CLIENT
// ─────────────────────────────────────────────────────
function ClientSpacePage({ onHome }) {
  const [docs, setDocs] = useState({ recto: false, verso: false, assurance: false })
  // In a real app we'd load the devis from URL token; here we show the latest
  const devis = readDevis()
  const latest = devis[devis.length - 1] || null

  return (
    <main className="panel">
      <div className="row between">
        <h2>Espace client</h2>
        <button onClick={onHome}>Accueil</button>
      </div>

      {latest && (
        <div className="summary-box">
          <p><strong>Devis :</strong> {latest.quoteNumber}</p>
          <p><strong>Événement :</strong> {latest.event?.type} – {latest.event?.date}</p>
          <p><strong>Montant total :</strong> {money(latest.totals?.totalTtc || 0)}</p>
        </div>
      )}

      <h3>Documents officiels</h3>
      <p>Merci de déposer les documents suivants. Un voyant vert confirmera la réception.</p>
      <DocRow label="Carte identité recto" done={docs.recto} onUpload={() => setDocs({ ...docs, recto: true })} />
      <DocRow label="Carte identité verso" done={docs.verso} onUpload={() => setDocs({ ...docs, verso: true })} />
      <DocRow label="Attestation d'assurance responsabilité civile" done={docs.assurance} onUpload={() => setDocs({ ...docs, assurance: true })} />

      <div className="summary-box">
        <p><strong>Solde restant à régler :</strong> {money((latest?.totals?.totalTtc || 0) - (latest?.payments?.reduce((s, p) => s + p, 0) || 0))}</p>
        <p><strong>Coordonnées bancaires (virement) :</strong></p>
        <p>Titulaire : SARL AFM</p>
        <p>IBAN : à compléter dans le dashboard</p>
        <p>
          <a className="whatsapp-btn" href="https://wa.me/33782281582" target="_blank" rel="noreferrer">
            💬 Contacter sur WhatsApp
          </a>
        </p>
      </div>
    </main>
  )
}

function DocRow({ label, done, onUpload }) {
  return (
    <div className="doc-row row between">
      <span>{label}</span>
      <div className="row">
        <span className={`dot ${done ? 'ok' : 'ko'}`} title={done ? 'Document reçu' : 'En attente'} />
        <input type="file" onChange={onUpload} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────────────────
function StaffPage({ onHome }) {
  const devis = readDevis()
  const staffEvents = devis.map((d) => ({
    date: d.event?.date || '',
    label: `${d.event?.type || 'Événement'} – ${Number(d.event?.adults || 0) + Number(d.event?.children || 0)} convives`,
    type: d.event?.type || '',
  }))

  return (
    <main className="panel">
      <div className="row between">
        <h2>Espace Staff</h2>
        <button onClick={onHome}>Accueil</button>
      </div>
      <p>Calendrier des événements sur lesquels vous êtes assigné(e).</p>
      <CalendarView events={staffEvents} />
      <h3>Prochains événements</h3>
      {devis.length === 0 && <p>Aucun événement planifié.</p>}
      {devis.map((d) => {
        const total = Number(d.event?.adults || 0) + Number(d.event?.children || 0)
        return (
          <div key={d.quoteNumber} className="client-row">
            <strong>{d.event?.type}</strong> – le {d.event?.date} – {total} convives
          </div>
        )
      })}
    </main>
  )
}

export default App
