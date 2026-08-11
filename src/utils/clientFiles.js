function sanitizeStorageId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_]/g, '_')
}

function makeStorageKey(prefix, identifier) {
  return `${prefix}_${sanitizeStorageId(identifier)}`
}

function getLocalJson(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
}

function setLocalJson(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
}

async function getServerJson(key) {
  try {
    const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || typeof data !== 'object') return null
    setLocalJson(key, data)
    return data
  } catch {
    return null
  }
}

async function postServerJson(key, data, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) return true
    } catch { /* retry */ }
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  return false
}

export function getDocsKey(identifier) {
  return makeStorageKey('paradise_docs', identifier)
}

export function getReceiptsKey(identifier) {
  return makeStorageKey('paradise_receipts', identifier)
}

export function getDocsLocal(identifier) {
  return getLocalJson(getDocsKey(identifier))
}

export function getReceiptsLocal(identifier) {
  return getLocalJson(getReceiptsKey(identifier))
}

export async function fetchDocsServer(identifier) {
  return getServerJson(getDocsKey(identifier))
}

export async function fetchReceiptsServer(identifier) {
  return getServerJson(getReceiptsKey(identifier))
}

export async function saveDocsAny(identifier, docs) {
  const key = getDocsKey(identifier)
  setLocalJson(key, docs)
  return postServerJson(key, docs)
}

export async function saveReceiptsAny(identifier, receipts) {
  const key = getReceiptsKey(identifier)
  setLocalJson(key, receipts)
  return postServerJson(key, receipts)
}
