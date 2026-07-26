import { useState, useRef } from 'react'
import { PAGE_TYPES } from '../../../data/pageTypes'
import { makePageTypeStorage } from '../../../utils/cityPageStorage'
import { getBlogArticles, saveBlogArticles } from '../../../utils/blogStorage'

// ── Styles ────────────────────────────────────────────────────────────────────

const card = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '20px',
}

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 20px', borderRadius: '8px', border: 'none',
  background: 'var(--gold)', color: 'white', fontWeight: '700',
  fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-body)',
  letterSpacing: '0.04em',
}

const btnOutline = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 20px', borderRadius: '8px',
  border: '2px solid var(--gold)', background: 'transparent',
  color: 'var(--gold)', fontWeight: '700',
  fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-body)',
  letterSpacing: '0.04em',
}

const btnDanger = {
  ...btnOutline,
  border: '2px solid #e53e3e',
  color: '#e53e3e',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function collectAllData() {
  const cityPages = {}
  for (const pt of PAGE_TYPES) {
    const storage = makePageTypeStorage(pt.id)
    const pages = await storage.getPages()
    cityPages[pt.id] = pages
  }
  const blogArticles = await getBlogArticles()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cityPages,
    blogArticles,
  }
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function countPages(cityPages = {}) {
  return Object.values(cityPages).reduce((sum, pages) => sum + Object.keys(pages || {}).length, 0)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BackupTab() {
  const [exporting, setExporting]     = useState(false)
  const [restoring, setRestoring]     = useState(false)
  const [status, setStatus]           = useState(null)   // { type: 'success'|'error', msg }
  const [preview, setPreview]         = useState(null)   // parsed backup file, pending confirm
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileRef = useRef(null)

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    setStatus(null)
    try {
      const data = await collectAllData()
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(data, `paradise-backup-${date}.json`)
      setStatus({ type: 'success', msg: `Sauvegarde téléchargée — ${countPages(data.cityPages)} pages villes + ${Object.keys(data.blogArticles || {}).length} articles blog.` })
    } catch (e) {
      setStatus({ type: 'error', msg: `Erreur lors de l'export : ${e.message}` })
    } finally {
      setExporting(false)
    }
  }

  // ── Import / Restore ──────────────────────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus(null)
    setPreview(null)
    setConfirmOpen(false)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        if (!parsed.version || !parsed.cityPages) {
          setStatus({ type: 'error', msg: 'Fichier invalide : ce n\'est pas un backup Paradise valide.' })
          return
        }
        setPreview(parsed)
        setConfirmOpen(true)
      } catch {
        setStatus({ type: 'error', msg: 'Impossible de lire le fichier. Assurez-vous qu\'il s\'agit d\'un fichier JSON valide.' })
      }
    }
    reader.readAsText(file)
    // reset file input so the same file can be re-selected
    e.target.value = ''
  }

  async function handleConfirmRestore() {
    if (!preview) return
    setRestoring(true)
    setConfirmOpen(false)
    setStatus(null)
    try {
      // Restore city pages
      for (const pt of PAGE_TYPES) {
        const pages = preview.cityPages?.[pt.id]
        if (pages && Object.keys(pages).length > 0) {
          const storage = makePageTypeStorage(pt.id)
          await storage.savePages(pages)
        }
      }
      // Restore blog articles
      if (preview.blogArticles && Object.keys(preview.blogArticles).length > 0) {
        await saveBlogArticles(preview.blogArticles)
      }
      const totalCity = countPages(preview.cityPages)
      const totalBlog = Object.keys(preview.blogArticles || {}).length
      setStatus({ type: 'success', msg: `Restauration réussie — ${totalCity} pages villes + ${totalBlog} articles blog restaurés depuis le backup du ${preview.exportedAt?.slice(0, 10) || '?'}.` })
      setPreview(null)
    } catch (e) {
      setStatus({ type: 'error', msg: `Erreur lors de la restauration : ${e.message}` })
    } finally {
      setRestoring(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '720px' }}>

      {/* Status banner */}
      {status && (
        <div style={{
          padding: '14px 18px', borderRadius: '8px', marginBottom: '20px',
          background: status.type === 'success' ? '#f0fff4' : '#fff5f5',
          border: `1.5px solid ${status.type === 'success' ? '#68d391' : '#fc8181'}`,
          color: status.type === 'success' ? '#276749' : '#c53030',
          fontSize: '13px', lineHeight: '1.5',
        }}>
          {status.type === 'success' ? '✅ ' : '❌ '}{status.msg}
        </div>
      )}

      {/* Export card */}
      <div style={card}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--dark)', marginBottom: '8px' }}>
          💾 Sauvegarder & Télécharger
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '20px', lineHeight: '1.7' }}>
          Exporte l&apos;ensemble des pages générées (6 types de pages villes) et tous les articles du blog dans un fichier JSON.
          Conservez ce fichier sur votre ordinateur pour pouvoir restaurer vos données après une mise à jour.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {PAGE_TYPES.map((pt) => (
            <span key={pt.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'var(--gold-pale)', color: 'var(--gold)',
              fontSize: '11px', fontWeight: '700', padding: '4px 10px',
              borderRadius: '20px', letterSpacing: '0.04em',
            }}>
              {pt.icon} {pt.label}
            </span>
          ))}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: '#f0fff4', color: '#276749',
            fontSize: '11px', fontWeight: '700', padding: '4px 10px',
            borderRadius: '20px', letterSpacing: '0.04em',
          }}>
            📝 Articles blog
          </span>
        </div>
        <button style={btnPrimary} onClick={handleExport} disabled={exporting}>
          {exporting ? '⏳ Export en cours…' : '⬇️ Télécharger la sauvegarde'}
        </button>
      </div>

      {/* Restore card */}
      <div style={card}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--dark)', marginBottom: '8px' }}>
          🔄 Restaurer depuis un backup
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '8px', lineHeight: '1.7' }}>
          Importez un fichier de sauvegarde précédemment téléchargé pour restaurer vos pages et articles sans avoir à les régénérer.
        </p>
        <p style={{ fontSize: '12px', color: '#e53e3e', fontWeight: '600', marginBottom: '20px' }}>
          ⚠️ Attention : la restauration remplace les données actuelles par celles du backup.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          style={btnOutline}
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
        >
          {restoring ? '⏳ Restauration en cours…' : '📂 Sélectionner un fichier backup'}
        </button>
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && preview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,28,46,0.6)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            maxWidth: '500px', width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--dark)', marginBottom: '12px' }}>
              🔄 Confirmer la restauration
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px', lineHeight: '1.7' }}>
              Vous êtes sur le point de restaurer le backup du&nbsp;
              <strong>{preview.exportedAt?.slice(0, 10) || '?'}</strong>&nbsp;:
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '20px', lineHeight: '2', paddingLeft: '20px' }}>
              <li><strong>{countPages(preview.cityPages)}</strong> pages villes (6 types)</li>
              <li><strong>{Object.keys(preview.blogArticles || {}).length}</strong> articles blog</li>
            </ul>
            <p style={{ fontSize: '12px', color: '#e53e3e', fontWeight: '600', marginBottom: '24px' }}>
              ⚠️ Cette action remplacera vos données actuelles. Elle est irréversible (sauf si vous avez un autre backup).
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ ...btnOutline, border: '2px solid var(--border)', color: 'var(--text-light)' }}
                onClick={() => { setConfirmOpen(false); setPreview(null) }}
              >
                Annuler
              </button>
              <button style={btnDanger} onClick={handleConfirmRestore}>
                Oui, restaurer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info note */}
      <div style={{
        background: '#fffbeb', border: '1px solid #f6d860', borderRadius: '10px',
        padding: '16px 20px', fontSize: '13px', color: '#92400e', lineHeight: '1.7',
      }}>
        <strong>💡 Conseil :</strong> Avant chaque mise à jour de l&apos;application, téléchargez une sauvegarde.
        Après la mise à jour, si vos pages ont été réinitialisées, utilisez le bouton &quot;Restaurer&quot; pour les récupérer en quelques secondes.
      </div>
    </div>
  )
}
