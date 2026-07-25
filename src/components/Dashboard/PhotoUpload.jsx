export default function PhotoUpload({ value, onChange, label = 'Photo' }) {
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleRemove(e) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' }}>{label}</div>
      {value ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={value}
            alt="aperçu"
            style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #c9a84c' }}
          />
          <button
            type="button"
            onClick={handleRemove}
            style={{
              position: 'absolute', top: '-8px', right: '-8px',
              background: '#e74c3c', color: 'white', border: 'none',
              borderRadius: '50%', width: '22px', height: '22px',
              cursor: 'pointer', fontSize: '12px', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      ) : (
        <div style={{ width: '120px', height: '90px', background: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '12px', border: '2px dashed #ddd' }}>
          📷 Aucune
        </div>
      )}
      <label style={{ display: 'block', marginTop: '6px' }}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <span style={{
          display: 'inline-block', padding: '4px 12px', background: '#1a1a2e', color: 'white',
          borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
        }}>
          {value ? '🔄 Remplacer' : '📤 Uploader'}
        </span>
      </label>
      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Format recommandé : 400×300px</div>
    </div>
  )
}
