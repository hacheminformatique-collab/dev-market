import { useState } from 'react'
import { getSettings, saveSettings } from '../../../utils/storage'

export default function MesInfosTab() {
  const [data, setData] = useState(getSettings())
  const [saved, setSaved] = useState(false)

  function handleChange(field, value) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function handleBankChange(field, value) {
    setData((prev) => ({ ...prev, bankInfo: { ...prev.bankInfo, [field]: value } }))
  }

  function handleSave() {
    saveSettings(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', color: '#1a1a2e' }}>Informations générales</h3>
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label>Nom de la salle</label>
          <input className="form-control" value={data.nom || ''} onChange={(e) => handleChange('nom', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Code PIN administrateur</label>
          <input className="form-control" type="password" value={data.pin || ''} onChange={(e) => handleChange('pin', e.target.value)} />
        </div>
        <div className="form-group">
          <label>WhatsApp (numéro ou lien)</label>
          <input className="form-control" value={data.whatsapp || ''} onChange={(e) => handleChange('whatsapp', e.target.value)} placeholder="0782821582" />
        </div>

        <hr style={{ margin: '20px 0', borderColor: '#eee' }} />
        <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Informations bancaires</h4>

        <div className="form-group">
          <label>Titulaire du compte</label>
          <input className="form-control" value={data.bankInfo?.titulaire || ''} onChange={(e) => handleBankChange('titulaire', e.target.value)} />
        </div>
        <div className="form-group">
          <label>IBAN</label>
          <input className="form-control" value={data.bankInfo?.iban || ''} onChange={(e) => handleBankChange('iban', e.target.value)} />
        </div>
        <div className="form-group">
          <label>BIC</label>
          <input className="form-control" value={data.bankInfo?.bic || ''} onChange={(e) => handleBankChange('bic', e.target.value)} />
        </div>

        <button onClick={handleSave} className="btn btn-primary">
          {saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
