import { useEffect, useMemo, useState } from 'react'
import './index.css'

const STORAGE_KEY = 'dev-market-data-v1'
const GUARD_KEY = 'dev-market-admin-guard'

const defaultData = {
  mesInfos: { nom: 'LE PARADISE' },
  adminCode: '2205',
  formules: [
    {
      id: 'seche',
      nom: 'Location sèche',
      contenu: 'Décoration + vaisselles + nettoyage',
      photo: '',
    },
    {
      id: 'prestation',
      nom: 'Location avec prestation',
      contenu: 'Décoration + vaisselles + prestation + nettoyage',
      photo: '',
    },
  ],
  menus: [
    { id: 'cbs', section: '1', nom: 'Cocktail bienvenue starter', tarif: 5, description: '5/6 pcs par personne', photo: '' },
    { id: 'cbm', section: '1', nom: 'Cocktail bienvenue medium', tarif: 7, description: '8/9 pcs par personne', photo: '' },
    { id: 'cbp', section: '1', nom: 'Cocktail bienvenue premium', tarif: 9, description: '10/12 pcs par personne', photo: '' },
    { id: 'e1', section: '2', nom: 'Salade composée méditéranéene', tarif: 12, description: 'Service en plat central', photo: '' },
    { id: 'e2', section: '2', nom: 'Buratta du chef', tarif: 13, description: "Service à l'assiette", photo: '' },
    { id: 'p1', section: '3', nom: 'Poulet olives', tarif: 15, description: 'Service en plat central', photo: '' },
    { id: 'p2', section: '3', nom: 'Suprême de volaille', tarif: 19, description: "Service à l'assiette", photo: '' },
    { id: 'd1', section: '4', nom: 'Plateaux de fruit', tarif: 8, description: '', photo: '' },
    { id: 'd2', section: '4', nom: 'Trilogie du paradise', tarif: 9, description: '', photo: '' },
    { id: 'enfant', section: '4', nom: 'Menu enfants', tarif: 20, description: 'Nuggets frite + compote', photo: '' },
    { id: 'b1', section: '5', nom: 'Eau de source', tarif: 0, description: '', photo: '' },
    { id: 'b2', section: '5', nom: 'Coca', tarif: 0, description: '', photo: '' },
    { id: 'b3', section: '5', nom: 'Thé et Café', tarif: 0, description: '', photo: '' },
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
  } catch {
    return defaultData
  }
}

const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

const money = (value) => `${value.toFixed(2)} €`

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
    if (!guard.authenticated) {
      navigate('/admin-login')
      return null
    }
    return <DashboardPage data={data} updateData={updateData} onHome={() => navigate('/')} />
  }

  if (path === '/admin-login') return <AdminLoginPage data={data} onSuccess={() => navigate('/dashboard')} onHome={() => navigate('/')} />
  if (path === '/devis') return <DevisPage data={data} onHome={() => navigate('/')} />
  if (path === '/espace-client') return <ClientSpacePage onHome={() => navigate('/')} />
  if (path === '/staff') return <StaffPage onHome={() => navigate('/')} />

  return <HomePage data={data} onNavigate={navigate} />
}

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

function DashboardPage({ data, updateData, onHome }) {
  const tabs = ['Mes infos', 'Mot de passe', 'Formules', 'Menus', 'Gâteaux', 'Prestations']
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
      <div className="tabs">{tabs.map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
      {tab === 'Mes infos' ? <MesInfosTab data={data} updateData={updateData} /> : null}
      {tab === 'Mot de passe' ? <MotDePasseTab data={data} updateData={updateData} /> : null}
      {tab === 'Formules' ? <ProductTab title="formules" items={data.formules} fields={['nom', 'contenu']} update={(items) => updateData({ formules: items })} /> : null}
      {tab === 'Menus' ? <ProductTab title="menus" items={data.menus} fields={['section', 'nom', 'tarif', 'description']} update={(items) => updateData({ menus: items })} /> : null}
      {tab === 'Gâteaux' ? <ProductTab title="gâteaux" items={data.gateaux} fields={['nom', 'tarif']} update={(items) => updateData({ gateaux: items })} /> : null}
      {tab === 'Prestations' ? <ProductTab title="prestations" items={data.prestations} fields={['nom', 'tarif', 'description']} update={(items) => updateData({ prestations: items })} /> : null}
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
          <input key={field} type={field === 'tarif' ? 'number' : 'text'} value={draft[field]} placeholder={field} onChange={(e) => setDraft((prev) => ({ ...prev, [field]: field === 'tarif' ? Number(e.target.value) || 0 : e.target.value }))} />
        ))}
        <button onClick={add}>Ajouter</button>
      </div>
    </div>
  )
}

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
  const [signature, setSignature] = useState('')

  const guests = Number(event.adults || 0) + Number(event.children || 0)

  const sallePricing = useMemo(() => {
    if (!event.date) return { seche: 0, prestation: 0, remise: 0 }
    const d = new Date(event.date)
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

  const menuById = Object.fromEntries(data.menus.map((m) => [m.id, m]))
  const gateauById = Object.fromEntries(data.gateaux.map((g) => [g.id, g]))
  const prestaById = Object.fromEntries(data.prestations.map((p) => [p.id, p]))

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
    return {
      salleTtc,
      traiteurTtc,
      gateauTtc,
      optionsTtc,
      totalTtc: salleTtc + traiteurTtc + gateauTtc + optionsTtc,
    }
  }, [event.adults, event.children, formule, gateau.id, gateauById, guests, menu.menuEnfant, menu.s1, menu.s2, menu.s3, menu.s4, options, prestaById, sallePricing.prestation, sallePricing.seche, menuById])

  const canNext = () => {
    if (step === 1) return client.nom && client.prenom && client.phone && client.email
    if (step === 2) return event.type && event.date && Number(event.adults) + Number(event.children) > 0 && guests <= 300
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
    if (step === 6 && formule === 'seche') {
      setStep(3)
      return
    }
    setStep((prev) => Math.max(1, prev - 1))
  }

  const sectionItems = (section) => data.menus.filter((i) => i.section === section)

  const quoteNumber = `DEV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String((Date.now() % 1000)).padStart(3, '0')}`

  return (
    <main className="panel">
      <div className="row between"><h2>Devis - Étape {step}/7</h2><button onClick={onHome}>Accueil</button></div>
      {error ? <p className="error">{error}</p> : null}

      {step === 1 ? (
        <div className="tab-content">
          <h3>Vos coordonnées</h3>
          <div className="grid-two">
            <input placeholder="Nom" value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} />
            <input placeholder="Prénom" value={client.prenom} onChange={(e) => setClient({ ...client, prenom: e.target.value })} />
            <input placeholder="Téléphone" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
            <input placeholder="Mail" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="tab-content">
          <h3 className="center">Personnaliser mon évènement</h3>
          <label>Type d'évènement</label>
          <select value={event.type} onChange={(e) => setEvent({ ...event, type: e.target.value })}>
            <option value="">Sélectionner</option>
            {['Anniversaire', 'Babyshower', 'Baptême', 'Fiançailles', 'Mariage', 'Autres'].map((x) => <option key={x}>{x}</option>)}
          </select>
          <label>Calendrier</label>
          <input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} />
          <div className="grid-two">
            <input type="number" min="0" placeholder="Nombre d'adultes" value={event.adults} onChange={(e) => setEvent({ ...event, adults: Number(e.target.value) || 0 })} />
            <input type="number" min="0" placeholder="Nombre d'enfants" value={event.children} onChange={(e) => setEvent({ ...event, children: Number(e.target.value) || 0 })} />
          </div>
          <p>Tarif selon date sélectionnée: basse/haute saison + jour appliqués automatiquement.</p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="tab-content">
          <h3 className="center">Je choisis ma formule</h3>
          <div className="grid-products">
            {data.formules.map((f) => {
              const prix = f.id === 'seche' ? sallePricing.seche : sallePricing.prestation
              return (
                <article key={f.id} className={`card ${formule === f.id ? 'selected' : ''}`} onClick={() => setFormule(f.id)}>
                  {f.photo ? <img src={f.photo} alt={f.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
                  <strong>{f.nom}</strong>
                  <p>{f.contenu}</p>
                  <p>Tarif: {money(prix)}</p>
                  {f.id === 'prestation' ? <p>Remise incluse: {money(sallePricing.remise)}</p> : null}
                </article>
              )
            })}
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="tab-content">
          <h3>Menu traiteur</h3>
          <MenuSelector title="Section 1 - Cocktail (optionnel)" items={sectionItems('1')} value={menu.s1} onChange={(id) => setMenu({ ...menu, s1: id })} />
          <MenuSelector title="Section 2 - Entrée (obligatoire)" items={sectionItems('2')} value={menu.s2} onChange={(id) => setMenu({ ...menu, s2: id })} required />
          <MenuSelector title="Section 3 - Plat (obligatoire)" items={sectionItems('3')} value={menu.s3} onChange={(id) => setMenu({ ...menu, s3: id })} required />
          <MenuSelector title="Section 4 - Dessert (obligatoire)" items={sectionItems('4').filter((i) => i.id !== 'enfant')} value={menu.s4} onChange={(id) => setMenu({ ...menu, s4: id })} required />
          <label><input type="checkbox" checked={menu.menuEnfant} onChange={(e) => setMenu({ ...menu, menuEnfant: e.target.checked })} /> Ajouter menu enfants (auto x nb enfants)</label>
          <div>
            <p>Section 5 - Boissons (max 3)</p>
            <div className="row wrap">
              {sectionItems('5').map((item) => (
                <label key={item.id}><input type="checkbox" checked={menu.s5.includes(item.id)} onChange={(e) => {
                  const nextItems = e.target.checked ? [...menu.s5, item.id] : menu.s5.filter((id) => id !== item.id)
                  if (nextItems.length <= 3) setMenu({ ...menu, s5: nextItems })
                }} /> {item.nom}</label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="tab-content">
          <h3>Choix du gâteau</h3>
          <div className="grid-products">
            {data.gateaux.map((g) => (
              <article key={g.id} className={`card ${gateau.id === g.id ? 'selected' : ''}`} onClick={() => {
                setGateau({ ...gateau, id: g.id, detailsDone: g.id === 'none' })
                if (g.id !== 'none') setShowPopup(true)
              }}>
                {g.photo ? <img src={g.photo} alt={g.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
                <strong>{g.nom}</strong>
                <p>{money(g.tarif)} / personne</p>
              </article>
            ))}
          </div>
          {showPopup ? (
            <div className="modal">
              <div className="panel narrow">
                <h4>Détails du gâteau</h4>
                <p>Niveau 1: chocolat</p>
                {['l2', 'l3', 'l4'].map((lvl) => (
                  <select key={lvl} value={gateau.levels[lvl]} onChange={(e) => setGateau({ ...gateau, levels: { ...gateau.levels, [lvl]: e.target.value } })}>
                    <option value="">Choisir goût niveau {lvl.slice(1)}</option>
                    {['chocolat', 'fruit', 'fraise', 'caramel spéculos'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                ))}
                <input placeholder="Initiales" value={gateau.initiales} onChange={(e) => setGateau({ ...gateau, initiales: e.target.value })} />
                <button onClick={() => {
                  if (gateau.levels.l2 && gateau.levels.l3 && gateau.levels.l4 && gateau.initiales) {
                    setGateau((prev) => ({ ...prev, detailsDone: true }))
                    setShowPopup(false)
                  }
                }}>Valider</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 6 ? (
        <div className="tab-content">
          <h3>Options supplémentaires</h3>
          <div className="grid-products">
            {data.prestations.map((p) => (
              <label key={p.id} className={`card ${options.includes(p.id) ? 'selected' : ''}`}>
                {p.photo ? <img src={p.photo} alt={p.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
                <input type="checkbox" checked={options.includes(p.id)} onChange={(e) => setOptions(e.target.checked ? [...options, p.id] : options.filter((id) => id !== p.id))} />
                <strong>{p.nom}</strong>
                <p>{p.description}</p>
                <p>{money(p.tarif)}</p>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="tab-content">
          <h3>Synthèse détaillée</h3>
          <p><strong>N° devis:</strong> {quoteNumber}</p>
          <p><strong>Client:</strong> {client.prenom} {client.nom}</p>
          <p><strong>Total TTC:</strong> {money(totals.totalTtc)}</p>
          <ul>
            <li>Salle TTC: {money(totals.salleTtc)} (TVA 20%)</li>
            <li>Traiteur TTC: {money(totals.traiteurTtc)} (TVA 10%)</li>
            <li>Gâteau TTC: {money(totals.gateauTtc)} (TVA 10%)</li>
            <li>Options TTC: {money(totals.optionsTtc)} (TVA 20%)</li>
          </ul>
          <div className="panel">
            <p><strong>Bon pour accord</strong></p>
            <input placeholder="Signature (nom/prénom)" value={signature} onChange={(e) => setSignature(e.target.value)} />
          </div>
          <div className="row wrap">
            <button onClick={() => alert('Un lien espace client a été simulé par email.')}>Recevoir mon devis par mail</button>
            <button onClick={() => {
              if (!signature) {
                setError('Merci de renseigner la signature.')
                return
              }
              alert('Devis validé avec signature. Envoi email client simulé.')
            }}>Je valide mon devis</button>
          </div>
        </div>
      ) : null}

      {step >= 3 ? <p className="cart-total">Panier actuel: <strong>{money(totals.totalTtc)}</strong></p> : null}

      <div className="row">
        <button onClick={back} disabled={step === 1}>Précédent</button>
        <button onClick={next} disabled={step === 7}>Suivant</button>
      </div>
    </main>
  )
}

function MenuSelector({ title, items, value, onChange, required }) {
  return (
    <div>
      <p>{title} {required ? '*' : ''}</p>
      <div className="grid-products">
        {items.map((item) => (
          <article key={item.id} className={`card ${value === item.id ? 'selected' : ''}`} onClick={() => onChange(item.id)}>
            {item.photo ? <img src={item.photo} alt={item.nom} className="thumb" /> : <div className="thumb empty">Photo</div>}
            <strong>{item.nom}</strong>
            <p>{item.description}</p>
            <p>{money(item.tarif)} / pers.</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function ClientSpacePage({ onHome }) {
  const [docs, setDocs] = useState({ recto: false, verso: false, assurance: false })

  return (
    <main className="panel">
      <div className="row between"><h2>Espace client</h2><button onClick={onHome}>Accueil</button></div>
      <h3>Documents officiels</h3>
      <DocRow label="Carte identité recto" done={docs.recto} onUpload={() => setDocs({ ...docs, recto: true })} />
      <DocRow label="Carte identité verso" done={docs.verso} onUpload={() => setDocs({ ...docs, verso: true })} />
      <DocRow label="Attestation d'assurance" done={docs.assurance} onUpload={() => setDocs({ ...docs, assurance: true })} />
      <div className="panel">
        <p><strong>Solde restant à régler:</strong> 0.00 €</p>
        <p>Coordonnées bancaires: IBAN à compléter dans le dashboard.</p>
        <p><a href="https://wa.me/33782281582" target="_blank" rel="noreferrer">Contacter sur WhatsApp</a></p>
      </div>
    </main>
  )
}

function DocRow({ label, done, onUpload }) {
  return (
    <div className="row between doc-row">
      <span>{label}</span>
      <div className="row">
        <span className={`dot ${done ? 'ok' : 'ko'}`} />
        <input type="file" onChange={onUpload} />
      </div>
    </div>
  )
}

function StaffPage({ onHome }) {
  return (
    <main className="panel">
      <div className="row between"><h2>Espace staff</h2><button onClick={onHome}>Accueil</button></div>
      <p>Vue staff MVP: calendrier dédié (dates assignées), nombre de personnes, menu, sans données tarif/client.</p>
    </main>
  )
}

export default App
