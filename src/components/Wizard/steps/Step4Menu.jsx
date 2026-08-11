import { useEffect } from 'react'
import { getMenus } from '../../../utils/storage'

const SECTION_ORDER = ['Cocktail de bienvenu', 'Entrée', 'Plats', 'Desserts', 'Menu enfants', 'Boissons']

function calcMenuItemTotal(item, nbAdultes, nbEnfants) {
  if (item.tarif === 0) return 0
  if (item.section === 'Cocktail de bienvenu') return item.tarif * (nbAdultes + nbEnfants)
  if (item.section === 'Menu enfants') return item.tarif * nbEnfants
  if (item.section === 'Boissons') return 0
  return item.tarif * nbAdultes
}

export default function Step4Menu({ data, onChange, onNext, onBack }) {
  const allMenus = getMenus()
  const selected = data.menus || []
  const nbAdultes = parseInt(data.nbAdultes) || data.nbPersonnes || 0
  const nbEnfants = parseInt(data.nbEnfants) || 0

  // Auto-select "Menu enfants" when nbEnfants > 0
  useEffect(() => {
    if (nbEnfants > 0) {
      const enfantsMenu = allMenus.find((m) => m.section === 'Menu enfants')
      if (enfantsMenu) {
        const alreadySelected = (data.menus || []).some((m) => m.section === 'Menu enfants')
        if (!alreadySelected) {
          const others = (data.menus || []).filter((m) => m.section !== 'Menu enfants')
          onChange('menus', [...others, enfantsMenu])
        }
      }
    } else {
      // Remove if nbEnfants = 0
      const withoutEnfants = (data.menus || []).filter((m) => m.section !== 'Menu enfants')
      if (withoutEnfants.length !== (data.menus || []).length) {
        onChange('menus', withoutEnfants)
      }
    }
    // Intentionally only depends on nbEnfants to avoid infinite loop
    // (onChange and data.menus would cause re-runs on every menu selection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nbEnfants])

  const sections = SECTION_ORDER.filter((s) => allMenus.some((m) => m.section === s))

  function isSelected(menuId) {
    return selected.some((m) => m.id === menuId)
  }

  function toggle(menu) {
    // Menu enfants cannot be deselected if nbEnfants > 0
    if (menu.section === 'Menu enfants' && nbEnfants > 0) return
    if (isSelected(menu.id)) {
      onChange('menus', selected.filter((m) => m.id !== menu.id))
    } else {
      if (menu.section === 'Boissons') {
        // Boissons: max 3 selectable
        const currentBoissons = selected.filter((m) => m.section === 'Boissons')
        if (currentBoissons.length >= 3) return
        onChange('menus', [...selected, menu])
      } else {
        // Single selection per section
        const others = selected.filter((m) => m.section !== menu.section)
        onChange('menus', [...others, menu])
      }
    }
  }

  function canValidate() {
    const requiredSections = ['Entrée', 'Plats', 'Desserts']
    return requiredSections.every((s) => selected.some((m) => m.section === s))
  }

  const menuTotal = selected.reduce((sum, m) => sum + calcMenuItemTotal(m, nbAdultes, nbEnfants), 0)

  return (
    <div>
      <h2 style={{ marginBottom: '8px', color: '#1a1a2e' }}>Composition des menus</h2>
      <p className="text-muted mb-3">
        {nbAdultes} adulte{nbAdultes > 1 ? 's' : ''}{nbEnfants > 0 ? ` + ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}` : ''}
      </p>

      {sections.map((section) => {
        const items = allMenus.filter((m) => m.section === section)
        const isMultiple = section === 'Boissons'
        const isRequired = ['Entrée', 'Plats', 'Desserts'].includes(section)
        const currentBoissons = selected.filter((m) => m.section === 'Boissons').length
        return (
          <div key={section} style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#1a1a2e', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
              {section}
              {isRequired && <span style={{ color: '#e74c3c', fontSize: '12px', marginLeft: '6px' }}>* obligatoire</span>}
              {isMultiple && <span style={{ color: '#888', fontSize: '12px', marginLeft: '6px' }}>(max 3 — {currentBoissons}/3)</span>}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {items.map((item) => {
                const sel = isSelected(item.id)
                const itemTotal = calcMenuItemTotal(item, nbAdultes, nbEnfants)
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item)}
                    style={{
                      border: sel ? '2px solid #c9a84c' : '1px solid #ddd',
                      borderRadius: '10px',
                      padding: '16px',
                      cursor: 'pointer',
                      background: sel ? '#fdf3d9' : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    {item.photo ? (
                      <img src={item.photo} alt={item.nomMenu} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                    ) : null}
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{item.nomMenu}</div>
                    {item.description && <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{item.description}</div>}
                    <div style={{ fontWeight: '700', color: item.tarif > 0 ? '#c9a84c' : '#27ae60' }}>
                      {item.tarif > 0 ? `${item.tarif} €/pers.` : 'Inclus'}
                    </div>
                    {item.tarif > 0 && itemTotal > 0 && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>= {itemTotal.toLocaleString('fr-FR')} €</div>
                    )}
                    {sel && <div style={{ color: '#b8860b', fontSize: '12px', marginTop: '6px' }}>✅</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {menuTotal > 0 && (
        <div style={{ background: '#fdf3d9', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Total menus</span>
            <strong style={{ color: '#c9a84c', fontSize: '20px' }}>{menuTotal.toLocaleString('fr-FR')} € TTC</strong>
          </div>
        </div>
      )}

      {!canValidate() && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '10px 14px', color: '#856404', fontSize: '13px', marginBottom: '12px' }}>
          ⚠️ Veuillez sélectionner au minimum : une Entrée, un Plat et un Dessert.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <button className="btn btn-outline" onClick={onBack}>← Retour</button>
        <button className="btn btn-primary btn-lg" onClick={onNext} disabled={!canValidate()} style={{ opacity: canValidate() ? 1 : 0.5 }}>Suivant →</button>
      </div>
    </div>
  )
}
