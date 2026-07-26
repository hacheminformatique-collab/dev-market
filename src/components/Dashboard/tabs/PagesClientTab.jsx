import { useState, useEffect } from 'react'
import {
  makePageTypeStorage,
  generateCityContent,
} from '../../../utils/cityPageStorage'
import { DEPARTMENTS, ALL_CITIES } from '../../../data/idf-cities'

// Delay between consecutive AI page generation requests (milliseconds).
// At ~5 500 tokens/page, 7 s gives ≈ 47 000 tokens/min — safely under the
// 60 000 tokens/min quota of the GitHub Models API.
const INTER_PAGE_DELAY_MS = 7_000

// ── Small helpers ──────────────────────────────────────────────────────────

function Label({ children, sub }) {
  return (
    <div style={{ marginBottom: sub ? '4px' : '8px' }}>
      <span style={{ fontSize: sub ? '12px' : '13px', fontWeight: '600', color: sub ? '#888' : '#333' }}>
        {children}
      </span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
  borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-body)',
  background: 'white', color: 'var(--text)', outline: 'none',
}

// ── Sub-tab navigation ─────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'selection', label: '🗺️ Sélection villes' },
  { id: 'config',    label: '⚙️ Configuration' },
  { id: 'gallery',   label: '🖼️ Galerie photos' },
  { id: 'social',    label: '📱 Réseaux sociaux' },
  { id: 'backups',   label: '💾 Sauvegardes' },
]

// ── Main component ─────────────────────────────────────────────────────────

export default function PagesClientTab({ pageType }) {
  // Derive storage helpers for this page type
  const storage = makePageTypeStorage(pageType.id)

  const [subTab, setSubTab]         = useState('selection')
  const [config, setConfig]         = useState(null)
  const [pages, setPages]           = useState({})
  const [gallery, setGallery]       = useState([])
  const [backups, setBackups]       = useState([])
  const [restoringIdx, setRestoringIdx] = useState(null)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0, current: '' })
  const [genDone, setGenDone]       = useState(false)
  const [genError, setGenError]     = useState('')
  const [selDepts, setSelDepts]     = useState({})   // { deptCode: 'all' | Set<slug> }
  const [focusDept, setFocusDept]   = useState(null)
  const [citySearch, setCitySearch] = useState('')

  // Reset state when page type changes
  useEffect(() => {
    setSubTab('selection')
    setConfig(null)
    setPages({})
    setGallery([])
    setBackups([])
    setSelDepts({})
    setFocusDept(null)
    setCitySearch('')
    setGenDone(false)
    setGenError('')
  }, [pageType.id])

  // Load everything on mount / when page type changes
  useEffect(() => {
    Promise.all([
      storage.getConfig(),
      storage.getPages(),
      storage.getGallery(),
      storage.getBackups(),
    ]).then(([cfg, pgs, gal, bkps]) => {
      setConfig(cfg)
      setPages(pgs || {})
      setGallery(gal || [])
      setBackups(bkps || [])
    })
  }, [pageType.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!config) {
    return <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>Chargement…</div>
  }

  // ── Config helpers ──────────────────────────────────────────────────────

  function updateConfig(patch) {
    setConfig((c) => ({ ...c, ...patch }))
  }

  async function handleSaveConfig() {
    setSaving(true)
    await storage.saveConfig(config)
    setSaving(false)
  }

  // ── City / dept selection helpers ────────────────────────────────────────

  function focusDeptCode(code) {
    setFocusDept((prev) => (prev === code ? null : code))
    setCitySearch('')
  }

  function selectAllDept(code) {
    setSelDepts((prev) => ({ ...prev, [code]: 'all' }))
  }

  function deselectAllDept(code) {
    setSelDepts((prev) => { const n = { ...prev }; delete n[code]; return n })
  }

  function toggleCity(deptCode, slug) {
    setSelDepts((prev) => {
      const cur = prev[deptCode]
      if (cur === 'all') {
        // switch dept from 'all' to individual set minus this city
        const dept = DEPARTMENTS.find((d) => d.code === deptCode)
        const allSlugs = new Set(dept.cities.map((c) => c.slug))
        allSlugs.delete(slug)
        if (allSlugs.size === 0) {
          const next = { ...prev }; delete next[deptCode]; return next
        }
        return { ...prev, [deptCode]: allSlugs }
      }
      if (!cur) {
        return { ...prev, [deptCode]: new Set([slug]) }
      }
      const next = new Set(cur)
      if (next.has(slug)) {
        next.delete(slug)
        if (next.size === 0) {
          const r = { ...prev }; delete r[deptCode]; return r
        }
      } else {
        next.add(slug)
        // if all cities selected → switch to 'all'
        const dept = DEPARTMENTS.find((d) => d.code === deptCode)
        if (next.size === dept.cities.length) return { ...prev, [deptCode]: 'all' }
      }
      return { ...prev, [deptCode]: next }
    })
  }

  function getDeptCheck(code) {
    const val = selDepts[code]
    if (!val) return 'none'
    if (val === 'all') return 'all'
    return 'partial'
  }

  function getSelectedSlugs() {
    const slugs = []
    for (const [code, val] of Object.entries(selDepts)) {
      const dept = DEPARTMENTS.find((d) => d.code === code)
      if (!dept) continue
      if (val === 'all') {
        dept.cities.forEach((c) => slugs.push(c.slug))
      } else {
        val.forEach((s) => slugs.push(s))
      }
    }
    return slugs
  }

  const selectedSlugs = getSelectedSlugs()

  // ── Generate pages ────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (selectedSlugs.length === 0) return

    // Block generation and show red error if no GitHub token is configured
    if (!config.githubToken?.trim()) {
      setGenError('❌ Token GitHub non configuré. Rendez-vous dans l\'onglet ⚙️ Configuration pour l\'ajouter afin d\'activer la génération par IA.')
      return
    }

    setGenerating(true)
    setGenDone(false)
    setGenError('')
    setGenProgress({ done: 0, total: selectedSlugs.length, current: '' })

    // 1. Backup existing pages
    await storage.backupPages()

    // 2. Load existing pages to keep unselected ones
    const existing = await storage.getPages()
    const updated = { ...existing }

    // 3. Generate content per city
    for (let i = 0; i < selectedSlugs.length; i++) {
      const slug = selectedSlugs[i]
      const city = ALL_CITIES.find((c) => c.slug === slug)
      if (!city) continue
      setGenProgress({ done: i, total: selectedSlugs.length, current: city.name })
      try {
        const content = await generateCityContent(
          city.name,
          city.deptName,
          config.keywords,
          config.businessName,
          config.businessType,
          config.githubToken,
          pageType.mainKeyword,
          (statusMsg) => setGenProgress((prev) => ({ ...prev, current: statusMsg })),
        )
        updated[slug] = { content, generatedAt: new Date().toISOString() }
      } catch (e) {
        setGenerating(false)
        setGenError(`❌ Erreur IA pour "${city.name}" : ${e.message}. Vérifiez votre token GitHub dans ⚙️ Configuration.`)
        return
      }
      // Pause between requests to stay within the API rate limit (60 000 tokens/min).
      if (i < selectedSlugs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, INTER_PAGE_DELAY_MS))
      }
    }

    await storage.savePages(updated)
    setPages(updated)
    setGenerating(false)
    setGenDone(true)
    setGenProgress({ done: selectedSlugs.length, total: selectedSlugs.length, current: '' })
    // Refresh backups list
    const bkps = await storage.getBackups()
    setBackups(bkps)
  }

  // ── Gallery helpers ───────────────────────────────────────────────────────

  function handleGalleryAdd(e) {
    const files = Array.from(e.target.files)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const updated = [...gallery, ev.target.result]
        setGallery(updated)
        await storage.saveGallery(updated)
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  async function handleGalleryRemove(idx) {
    const updated = gallery.filter((_, i) => i !== idx)
    setGallery(updated)
    await storage.saveGallery(updated)
  }

  async function handleRestoreBackup(idx) {
    const backup = backups[idx]
    if (!backup?.snapshot) return
    const ok = window.confirm('Restaurer cette sauvegarde des pages villes ? Les pages actuelles seront remplacées.')
    if (!ok) return

    setRestoringIdx(idx)
    try {
      const snapshot = backup.snapshot || {}
      await storage.savePages(snapshot)
      setPages(snapshot)
      const bkps = await storage.getBackups()
      setBackups(bkps || [])
    } finally {
      setRestoringIdx(null)
    }
  }

  // ── Social helpers ────────────────────────────────────────────────────────

  function addPost(field) {
    updateConfig({ [field]: [...(config[field] || []), ''] })
  }

  function updatePost(field, idx, val) {
    const arr = [...(config[field] || [])]
    arr[idx] = val
    updateConfig({ [field]: arr })
  }

  function removePost(field, idx) {
    const arr = (config[field] || []).filter((_, i) => i !== idx)
    updateConfig({ [field]: arr })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const focusDeptObj = focusDept ? DEPARTMENTS.find((d) => d.code === focusDept) : null
  const generatedCount = Object.keys(pages).length

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '13px', fontWeight: subTab === t.id ? '700' : '400',
              background: subTab === t.id ? 'var(--gold)' : 'var(--offwhite)',
              color: subTab === t.id ? 'white' : 'var(--text-light)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SELECTION ─────────────────────────────────────────────────────── */}
      {subTab === 'selection' && (
        <div>
          <p style={{ color: 'var(--text-light)', marginBottom: '8px', fontSize: '13px' }}>
            Sélectionnez les départements (colonne gauche) ou des villes spécifiques (colonne droite) puis cliquez sur <strong>Générer</strong>.
          </p>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '12px' }}>
            Mot-clé principal généré : <strong style={{ color: 'var(--gold)' }}>{pageType.mainKeyword}</strong>
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Villes sélectionnées', value: selectedSlugs.length, color: 'var(--gold)' },
              { label: 'Pages générées', value: generatedCount, color: 'var(--success)' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'white', border: '1px solid var(--border)', borderRadius: '10px',
                padding: '12px 20px', minWidth: '160px',
              }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Two-column table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {/* Column 1 – Departments */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ background: 'var(--dark)', color: 'var(--gold)', padding: '10px 16px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.05em' }}>
                DÉPARTEMENTS
              </div>
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {DEPARTMENTS.map((dept) => {
                  const check = getDeptCheck(dept.code)
                  return (
                    <div
                      key={dept.code}
                      onClick={() => focusDeptCode(dept.code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 16px', cursor: 'pointer',
                        background: focusDept === dept.code ? 'var(--gold-pale)' : 'white',
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'background 0.12s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={check !== 'none'}
                        ref={(el) => { if (el) el.indeterminate = check === 'partial' }}
                        onChange={(e) => {
                          e.stopPropagation()
                          if (check === 'none') {
                            selectAllDept(dept.code)
                          } else {
                            deselectAllDept(dept.code)
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer', accentColor: 'var(--gold)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark)', flex: 1 }}>
                        {dept.code} – {dept.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#aaa' }}>
                        {check === 'all' ? '✅ tout' : check === 'partial' ? `${(selDepts[dept.code] || new Set()).size}/${dept.cities.length}` : dept.cities.length + ' villes'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Column 2 – Cities of focused department */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ background: 'var(--dark)', color: 'var(--gold)', padding: '10px 16px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.05em' }}>
                {focusDeptObj ? `VILLES — ${focusDeptObj.name}` : 'VILLES'}
              </div>

              {/* Toolbar: search + select-all (only when a dept is focused) */}
              {focusDeptObj && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '8px', alignItems: 'center', background: '#fafafa' }}>
                  <input
                    type="text"
                    placeholder="🔍 Rechercher une ville…"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-body)', outline: 'none' }}
                  />
                  {(() => {
                    const deptVal = selDepts[focusDeptObj.code]
                    const allSelected = deptVal === 'all'
                    return (
                      <button
                        onClick={() => allSelected ? deselectAllDept(focusDeptObj.code) : selectAllDept(focusDeptObj.code)}
                        style={{
                          padding: '6px 12px', border: '1.5px solid var(--gold)', borderRadius: '6px',
                          background: allSelected ? 'var(--gold)' : 'white', color: allSelected ? 'white' : 'var(--gold)',
                          fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {allSelected ? '✓ Tout désélectionner' : 'Sélectionner tout'}
                      </button>
                    )
                  })()}
                </div>
              )}

              <div style={{ maxHeight: '380px', overflowY: 'auto', flex: 1 }}>
                {!focusDeptObj ? (
                  <div style={{ padding: '24px', color: '#bbb', fontSize: '13px', textAlign: 'center' }}>
                    ← Cliquez sur un département
                  </div>
                ) : (() => {
                  const deptVal = selDepts[focusDeptObj.code]
                  const needle = citySearch.trim().toLowerCase()
                  const filtered = needle
                    ? focusDeptObj.cities.filter((c) => c.name.toLowerCase().includes(needle))
                    : focusDeptObj.cities
                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: '24px', color: '#bbb', fontSize: '13px', textAlign: 'center' }}>
                        Aucune ville trouvée
                      </div>
                    )
                  }
                  return filtered.map((city) => {
                    const checked = deptVal === 'all' || (deptVal instanceof Set && deptVal.has(city.slug))
                    return (
                      <label
                        key={city.slug}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 16px', cursor: 'pointer',
                          background: checked ? '#faf5e4' : 'white',
                          borderBottom: '1px solid var(--border-light)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCity(focusDeptObj.code, city.slug)}
                          style={{ cursor: 'pointer', accentColor: 'var(--gold)' }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{city.name}</span>
                        {pages[city.slug] && (
                          <span title={`Générée le ${new Date(pages[city.slug].generatedAt).toLocaleDateString('fr-FR')}`}
                            style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d52', padding: '2px 6px', borderRadius: '4px' }}>
                            ✓ générée
                          </span>
                        )}
                      </label>
                    )
                  })
                })()}
              </div>
            </div>
          </div>

          {/* Generate button */}
          {selectedSlugs.length > 0 && !generating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                style={{ fontSize: '14px', padding: '12px 28px' }}
              >
                🚀 Générer {selectedSlugs.length} page{selectedSlugs.length > 1 ? 's' : ''}
              </button>
              {genDone && (
                <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '600' }}>
                  ✅ {selectedSlugs.length} page{selectedSlugs.length > 1 ? 's' : ''} générée{selectedSlugs.length > 1 ? 's' : ''} avec succès !
                </span>
              )}
            </div>
          )}

          {/* Red error message */}
          {genError && !generating && (
            <div style={{
              marginTop: '16px',
              background: '#fff0f0',
              border: '1.5px solid #e53935',
              borderRadius: '10px',
              padding: '14px 18px',
              color: '#c62828',
              fontSize: '13px',
              fontWeight: '600',
              lineHeight: '1.5',
            }}>
              {genError}
            </div>
          )}

          {/* Progress */}
          {generating && (
            <div style={{ background: 'var(--dark)', borderRadius: '10px', padding: '20px', color: 'white' }}>
              <div style={{ fontWeight: '600', marginBottom: '10px' }}>
                ⏳ Génération en cours… {genProgress.done}/{genProgress.total}
              </div>
              {genProgress.current && (
                <div style={{ fontSize: '13px', color: 'var(--gold)', marginBottom: '10px' }}>
                  Ville en cours : {genProgress.current}
                </div>
              )}
              <div style={{ background: '#333', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'var(--gold)',
                  width: `${genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0}%`,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}

          {/* Generated pages list */}
          {generatedCount > 0 && (
            <div style={{ marginTop: '24px' }}>
              <Label>Pages générées ({generatedCount})</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {Object.entries(pages).map(([slug, _page]) => {
                  const city = ALL_CITIES.find((c) => c.slug === slug)
                  return (
                    <a
                      key={slug}
                      href={`${pageType.basePath}/${slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '5px 12px', background: 'white',
                        border: '1px solid var(--border)', borderRadius: '20px',
                        fontSize: '12px', color: 'var(--dark)', textDecoration: 'none',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      🏙️ {city ? city.name : slug}
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG ────────────────────────────────────────────────────────── */}
      {subTab === 'config' && (
        <div style={{ maxWidth: '640px' }}>
          <Field label="Nom de l'entreprise">
            <input
              style={inputStyle}
              value={config.businessName}
              onChange={(e) => updateConfig({ businessName: e.target.value })}
              placeholder="Le Paradise"
            />
          </Field>

          <Field label="Type de service">
            <input
              style={inputStyle}
              value={config.businessType}
              onChange={(e) => updateConfig({ businessType: e.target.value })}
              placeholder="salle de réception, traiteur…"
            />
          </Field>

          <Field label="Mots clés SEO (séparés par des virgules)">
            <textarea
              style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              value={config.keywords}
              onChange={(e) => updateConfig({ keywords: e.target.value })}
              placeholder="mariage, anniversaire, baptême, soirée privée, traiteur halal…"
            />
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Ces mots clés seront intégrés dans le contenu de chaque page ville.
            </div>
          </Field>

          <Field label="Clé API Google Maps">
            <input
              style={inputStyle}
              value={config.googleMapsApiKey}
              onChange={(e) => updateConfig({ googleMapsApiKey: e.target.value })}
              placeholder="AIza…"
            />
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Nécessaire pour afficher la carte Google Maps sur chaque page ville.
            </div>
          </Field>

          <Field label="Token GitHub (génération IA — optionnel)">
            <input
              type="password"
              style={inputStyle}
              value={config.githubToken}
              onChange={(e) => updateConfig({ githubToken: e.target.value })}
              placeholder="ghp_…"
            />
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              Si renseigné, le contenu de chaque page sera généré par IA via GitHub Models (GPT-4o mini).
              Sans token, un texte template sera utilisé.
            </div>
          </Field>

          <button
            className="btn btn-primary"
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving ? '⏳ Enregistrement…' : '💾 Enregistrer la configuration'}
          </button>
        </div>
      )}

      {/* ── GALLERY ───────────────────────────────────────────────────────── */}
      {subTab === 'gallery' && (
        <div>
          <p style={{ color: 'var(--text-light)', fontSize: '13px', marginBottom: '16px' }}>
            Les photos de la galerie apparaîtront sur toutes les pages villes.
          </p>

          <label style={{ display: 'inline-block', marginBottom: '20px' }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={handleGalleryAdd}
            />
            <span className="btn btn-dark" style={{ cursor: 'pointer' }}>
              📤 Ajouter des photos
            </span>
          </label>

          {gallery.length === 0 ? (
            <div style={{ color: '#bbb', fontSize: '13px' }}>Aucune photo dans la galerie.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {gallery.map((src, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img
                    src={src}
                    alt={`Galerie ${i + 1}`}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                  />
                  <button
                    onClick={() => handleGalleryRemove(i)}
                    style={{
                      position: 'absolute', top: '6px', right: '6px',
                      background: 'rgba(192,57,43,0.9)', color: 'white', border: 'none',
                      borderRadius: '50%', width: '24px', height: '24px',
                      cursor: 'pointer', fontSize: '13px', lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                  <div style={{ padding: '4px 8px', fontSize: '11px', color: '#888', background: '#fafafa' }}>
                    Photo {i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SOCIAL ────────────────────────────────────────────────────────── */}
      {subTab === 'social' && (
        <div style={{ maxWidth: '640px' }}>
          {/* Instagram */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>📸 Instagram</h3>
            <Field label="Nom d'utilisateur Instagram">
              <input
                style={inputStyle}
                value={config.instagramUsername}
                onChange={(e) => updateConfig({ instagramUsername: e.target.value })}
                placeholder="moncompte"
              />
            </Field>
            <Label sub>URLs des derniers posts à intégrer (ex. https://www.instagram.com/p/ABC…)</Label>
            {(config.instagramPosts || []).map((url, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={url}
                  onChange={(e) => updatePost('instagramPosts', i, e.target.value)}
                  placeholder="https://www.instagram.com/p/…"
                />
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '6px 10px' }}
                  onClick={() => removePost('instagramPosts', i)}
                >✕</button>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => addPost('instagramPosts')} style={{ marginTop: '4px' }}>
              + Ajouter un post
            </button>
          </div>

          {/* TikTok */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>🎵 TikTok</h3>
            <Field label="Nom d'utilisateur TikTok">
              <input
                style={inputStyle}
                value={config.tiktokUsername}
                onChange={(e) => updateConfig({ tiktokUsername: e.target.value })}
                placeholder="moncompte"
              />
            </Field>
            <Label sub>URLs des derniers posts à intégrer (ex. https://www.tiktok.com/@compte/video/…)</Label>
            {(config.tiktokPosts || []).map((url, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={url}
                  onChange={(e) => updatePost('tiktokPosts', i, e.target.value)}
                  placeholder="https://www.tiktok.com/@…/video/…"
                />
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '6px 10px' }}
                  onClick={() => removePost('tiktokPosts', i)}
                >✕</button>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => addPost('tiktokPosts')} style={{ marginTop: '4px' }}>
              + Ajouter un post
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
          </button>
        </div>
      )}

      {/* ── BACKUPS ───────────────────────────────────────────────────────── */}
      {subTab === 'backups' && (
        <div>
          <p style={{ color: 'var(--text-light)', fontSize: '13px', marginBottom: '16px' }}>
            Une sauvegarde est créée automatiquement avant chaque génération de pages.
            Les 5 dernières sont conservées.
          </p>
          {backups.length === 0 ? (
            <div style={{ color: '#bbb', fontSize: '13px' }}>Aucune sauvegarde disponible.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {backups.map((bk, i) => {
                const count = Object.keys(bk.snapshot || {}).length
                const date = new Date(bk.backedUpAt).toLocaleString('fr-FR')
                return (
                  <div key={i} style={{
                    background: 'white', border: '1px solid var(--border)', borderRadius: '10px',
                    padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '16px',
                  }}>
                    <span style={{ fontSize: '22px' }}>💾</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>Sauvegarde #{backups.length - i}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{date} — {count} page{count > 1 ? 's' : ''}</div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#aaa', background: '#f5f5f5', padding: '3px 10px', borderRadius: '20px' }}>
                      {i === 0 ? 'Dernière' : `Il y a ${i + 1}`}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleRestoreBackup(i)}
                      disabled={restoringIdx !== null}
                      style={{ minWidth: '110px', justifyContent: 'center' }}
                    >
                      {restoringIdx === i ? '⏳ Restauration…' : '↩ Restaurer'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
