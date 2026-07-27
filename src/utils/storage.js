const KEYS = {
  settings: 'paradise_settings',
  formules: 'paradise_formules',
  menus: 'paradise_menus',
  gateaux: 'paradise_gateaux',
  prestations: 'paradise_prestations',
  clients: 'paradise_clients',
  loginAttempts: 'paradise_login_attempts',
  staff: 'paradise_staff',
  stockSec: 'paradise_stock_sec',
  stockMatiere: 'paradise_stock_matiere',
  stockBoisson: 'paradise_stock_boisson',
  ingredients: 'paradise_ingredients',
  matieresPremieresRecettes: 'paradise_matieres_recettes',
}

// ---------------------------------------------------------------------------
// Sync status tracking
// ---------------------------------------------------------------------------
const RETRY_QUEUE_KEY = 'paradise_retry_queue'
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]

let _syncStatus = {
  pending: 0,
  synced: 0,
  failed: 0,
  offline: false,
}

const _syncListeners = new Set()

function _notifySyncListeners() {
  _syncListeners.forEach((cb) => {
    try { cb({ ..._syncStatus }) } catch { /* ignore listener errors */ }
  })
}

function _updateSyncStatus(patch) {
  _syncStatus = { ..._syncStatus, ...patch }
  _notifySyncListeners()
}

export function getSyncStatus() {
  return { ..._syncStatus }
}

export function onSyncStatusChange(callback) {
  _syncListeners.add(callback)
}

export function offSyncStatusChange(callback) {
  _syncListeners.delete(callback)
}

// ---------------------------------------------------------------------------
// Refresh listeners – notified when server data changes during polling
// ---------------------------------------------------------------------------
const _refreshListeners = new Set()

function _notifyRefreshListeners() {
  _refreshListeners.forEach((cb) => {
    try { cb() } catch { /* ignore listener errors */ }
  })
}

export function onDataRefresh(callback) {
  _refreshListeners.add(callback)
}

export function offDataRefresh(callback) {
  _refreshListeners.delete(callback)
}

/**
 * Re-fetch all keys from the server and update the cache if anything changed.
 * Returns true if at least one key was updated, false otherwise.
 * Safe to call at any time – if the server is unreachable the cache is kept as-is.
 */
export async function refreshFromServer() {
  let changed = false
  await Promise.all(
    Object.entries(KEYS).map(async ([, key]) => {
      try {
        const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data === null || data === undefined) return
        if (JSON.stringify(_cache[key]) !== JSON.stringify(data)) {
          _cache[key] = data
          try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* ignore */ }
          changed = true
        }
      } catch { /* server unreachable – keep cache as-is */ }
    })
  )
  if (changed) _notifyRefreshListeners()
  return changed
}

let _autoRefreshInterval = null
let _visibilityHandler = null

/**
 * Start polling the server every `intervalMs` milliseconds (default 5 s).
 * Also refreshes immediately when the user returns to the tab.
 * Calls stopAutoRefresh() first to prevent duplicate intervals.
 */
export function startAutoRefresh(intervalMs = 5000) {
  stopAutoRefresh()
  _autoRefreshInterval = setInterval(() => { refreshFromServer() }, intervalMs)
  _visibilityHandler = () => {
    if (document.visibilityState === 'visible') refreshFromServer()
  }
  document.addEventListener('visibilitychange', _visibilityHandler)
}

/**
 * Force an immediate refresh from the server and return whether any data changed.
 * Convenience alias for refreshFromServer() intended for manual / on-demand calls.
 */
export async function forceRefresh() {
  return refreshFromServer()
}

/** Stop the polling interval and remove the visibility listener. */
export function stopAutoRefresh() {
  if (_autoRefreshInterval !== null) {
    clearInterval(_autoRefreshInterval)
    _autoRefreshInterval = null
  }
  if (_visibilityHandler !== null) {
    document.removeEventListener('visibilitychange', _visibilityHandler)
    _visibilityHandler = null
  }
}

// ---------------------------------------------------------------------------
// Retry queue – persists across page reloads via localStorage
// ---------------------------------------------------------------------------
function _loadRetryQueue() {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function _saveRetryQueue(queue) {
  try { localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue)) } catch { /* ignore */ }
}

async function _postToServer(key, data) {
  const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Server responded ${res.status}`)
}

async function _postWithRetry(key, data, attempt = 0) {
  try {
    await _postToServer(key, data)
    // Remove from retry queue on success, then update status
    const queue = _loadRetryQueue().filter((item) => item.key !== key)
    _saveRetryQueue(queue)
    _updateSyncStatus({ pending: Math.max(0, _syncStatus.pending - 1), offline: false, synced: _syncStatus.synced + 1 })
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      setTimeout(() => _postWithRetry(key, data, attempt + 1), RETRY_DELAYS[attempt])
    } else {
      console.warn(`[storage] Failed to persist key "${key}" to server after ${MAX_RETRIES} retries:`, err)
      // Persist to retry queue so it survives page reload, then update status
      const queue = _loadRetryQueue().filter((item) => item.key !== key)
      queue.push({ key, data, timestamp: Date.now() })
      _saveRetryQueue(queue)
      _updateSyncStatus({ pending: Math.max(0, _syncStatus.pending - 1), offline: true, failed: _syncStatus.failed + 1 })
    }
  }
}

export function retryFailedWrites() {
  // Snapshot and clear the queue before retrying to prevent duplicate retries
  const queue = _loadRetryQueue()
  if (queue.length === 0) return
  _saveRetryQueue([])
  queue.forEach(({ key, data }) => {
    _updateSyncStatus({ pending: _syncStatus.pending + 1 })
    _postWithRetry(key, data, 0)
  })
}

// ---------------------------------------------------------------------------
// In-memory cache – populated by initStorage() before the app first renders.
// All get/save functions operate on this cache so they stay synchronous.
// ---------------------------------------------------------------------------
const _cache = {}

const DEFAULTS = {
  settings: {
    nom: 'LE PARADISE',
    pin: '2205',
    siteUrl: '',
    logo: '',
    bankInfo: {
      iban: '',
      bic: '',
      titulaire: '',
    },
    whatsapp: '',
    legalInfo: {
      raisonSociale: '',
      enseigne: '',
      formeJuridique: '',
      capital: '',
      siret: '',
      siren: '',
      tva: '',
      rcs: '',
      dateImmatriculation: '',
      ape: '',
      gerant: '',
      adresse: '',
      email: '',
      telephone: '',
    },
  },
  formules: [
    { id: '1', nomFormule: 'Location sèche', contenuFormule: 'Déco + vaisselles + nettoyage', photo: '' },
    { id: '2', nomFormule: 'Location avec prestation', contenuFormule: 'Déco + vaisselles + prestation + nettoyage', photo: '' },
  ],
  menus: [
    { id: '1', section: 'Cocktail de bienvenu', nomMenu: 'Cocktail starter', tarif: 5, description: '5/6 pcs par personne', photo: '' },
    { id: '2', section: 'Cocktail de bienvenu', nomMenu: 'Cocktail medium', tarif: 7, description: '8/9 pcs par personne', photo: '' },
    { id: '3', section: 'Cocktail de bienvenu', nomMenu: 'Cocktail premium', tarif: 9, description: '10/12 pcs par personne', photo: '' },
    { id: '4', section: 'Entrée', nomMenu: 'Salade composée méditerranéenne', tarif: 12, description: 'plat central', photo: '' },
    { id: '5', section: 'Entrée', nomMenu: 'Burrata du chef', tarif: 13, description: "à l'assiette", photo: '' },
    { id: '6', section: 'Entrée', nomMenu: 'Bouchée à la reine forestière', tarif: 13, description: "à l'assiette", photo: '' },
    { id: '7', section: 'Entrée', nomMenu: 'Salade tunisienne', tarif: 12, description: 'plat central', photo: '' },
    { id: '8', section: 'Plats', nomMenu: 'Poulet olives', tarif: 15, description: 'plat central', photo: '' },
    { id: '9', section: 'Plats', nomMenu: 'Suprême de volaille', tarif: 19, description: "à l'assiette, 2 accompagnements au choix", photo: '' },
    { id: '10', section: 'Plats', nomMenu: 'Tajine aux pruneaux', tarif: 19, description: 'plat central', photo: '' },
    { id: '11', section: 'Desserts', nomMenu: 'Plateaux de fruit', tarif: 8, description: '', photo: '' },
    { id: '12', section: 'Desserts', nomMenu: 'Trilogie du Paradise', tarif: 9, description: '', photo: '' },
    { id: '13', section: 'Menu enfants', nomMenu: 'Nuggets frites + compote', tarif: 20, description: '', photo: '' },
    { id: '14', section: 'Boissons', nomMenu: 'Eau de source', tarif: 0, description: '', photo: '' },
    { id: '15', section: 'Boissons', nomMenu: 'Coca', tarif: 0, description: '', photo: '' },
    { id: '16', section: 'Boissons', nomMenu: 'Thé et Café', tarif: 0, description: '', photo: '' },
  ],
  gateaux: [
    { id: '1', nomGateau: 'Gâteau 1', tarif: 4, photo: '' },
    { id: '2', nomGateau: 'Gâteau 2', tarif: 4, photo: '' },
    { id: '3', nomGateau: 'Gâteau 3', tarif: 4.5, photo: '' },
    { id: '4', nomGateau: 'Gâteau 4', tarif: 4.5, photo: '' },
    { id: '5', nomGateau: 'Continuer sans gâteau', tarif: 0, photo: '' },
  ],
  prestations: [
    { id: '1', nomPresta: 'DJ', tarif: 800, description: 'pour animer votre soirée', photo: '' },
    { id: '2', nomPresta: 'Fumée lourde', tarif: 150, description: 'pour vos slow et ouverture de bal', photo: '' },
    { id: '3', nomPresta: 'Jet de scène', tarif: 100, description: 'pour animer votre slow ou wedding cake', photo: '' },
    { id: '4', nomPresta: 'Photobooth', tarif: 450, description: 'garder un souvenir', photo: '' },
    { id: '5', nomPresta: 'Videobooth360', tarif: 250, description: 'garder un souvenir', photo: '' },
  ],
  clients: [],
  loginAttempts: { count: 0, blockedUntil: null },
  staff: [],
  stockSec: [],
  stockMatiere: [],
  stockBoisson: [],
  ingredients: [],
  matieresPremieresRecettes: [],
}

// Read from in-memory cache (synchronous)
function _get(key) {
  const val = _cache[key]
  return val !== undefined ? val : null
}

// Write to cache, persist to localStorage as backup, and async-POST to server with retry
function _save(key, data) {
  _cache[key] = data
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* localStorage may be unavailable */ }
  _updateSyncStatus({ pending: _syncStatus.pending + 1 })
  return _postWithRetry(key, data, 0)
}

/**
 * Load all storage keys into the in-memory cache.
 * Priority: PHP server → localStorage → built-in defaults.
 * Must be awaited once in App.jsx before the React tree renders.
 */
export async function initStorage() {
  await Promise.all(
    Object.entries(KEYS).map(async ([name, key]) => {
      // 1. Try server
      try {
        const res = await fetch(`/api/storage.php?key=${encodeURIComponent(key)}`)
        if (res.ok) {
          const data = await res.json()
          if (data !== null && data !== undefined) {
            _cache[key] = data
            return
          }
        }
      } catch { /* server unreachable or returned an error – proceed to fallback */ }

      // 2. Fall back to localStorage
      try {
        const raw = localStorage.getItem(key)
        if (raw !== null) {
          _cache[key] = JSON.parse(raw)
          return
        }
      } catch { /* localStorage may be corrupted – proceed to defaults */ }

      // 3. Nothing found – initialise with defaults and persist them
      _cache[key] = DEFAULTS[name]
      _save(key, DEFAULTS[name])
    })
  )

  // One-time migration: strip any embedded base64 documents from client records.
  // Previously, EspaceClient stored the full base64 data URL inside the client record,
  // which caused paradise_clients.json to exceed PHP's post_max_size limit.
  // Now only lightweight boolean markers (documentsUploaded) are stored there.
  const clientsKey = KEYS.clients
  const clientsList = _cache[clientsKey]
  if (Array.isArray(clientsList)) {
    let needsMigration = false
    const migratedClients = clientsList.map((c) => {
      if (!c.documents) return c
      // Check if any embedded document value looks like a base64 data URL (long string)
      const hasBase64 = Object.values(c.documents).some(
        (v) => typeof v === 'string' && v.length > 1000
      )
      if (!hasBase64) return c
      needsMigration = true
      // Convert to boolean markers and remove the bulky documents field
      const docMarkers = {}
      for (const [k, v] of Object.entries(c.documents)) {
        if (v) docMarkers[k] = true
      }
      const migrated = { ...c, documentsUploaded: { ...(c.documentsUploaded || {}), ...docMarkers } }
      delete migrated.documents
      return migrated
    })
    if (needsMigration) {
      _cache[clientsKey] = migratedClients
      _save(clientsKey, migratedClients)
    }
  }
}

/** @deprecated Use initStorage() instead. Kept for compatibility. */
export function initDefaults() {
  // No-op: data initialisation is now handled by initStorage() in App.jsx
}

export const getSettings = () => _get(KEYS.settings) || DEFAULTS.settings
export const saveSettings = (data) => _save(KEYS.settings, data)

export const getFormules = () => _get(KEYS.formules) || DEFAULTS.formules
export const saveFormules = (data) => _save(KEYS.formules, data)

export const getMenus = () => _get(KEYS.menus) || DEFAULTS.menus
export const saveMenus = (data) => _save(KEYS.menus, data)

export const getGateaux = () => _get(KEYS.gateaux) || DEFAULTS.gateaux
export const saveGateaux = (data) => _save(KEYS.gateaux, data)

export const getPrestations = () => _get(KEYS.prestations) || DEFAULTS.prestations
export const savePrestations = (data) => _save(KEYS.prestations, data)

export const getClients = () => _get(KEYS.clients) || []
export const saveClients = (data) => _save(KEYS.clients, data)

export const getLoginAttempts = () => _get(KEYS.loginAttempts) || DEFAULTS.loginAttempts
export const saveLoginAttempts = (data) => _save(KEYS.loginAttempts, data)

export const getStaff = () => _get(KEYS.staff) || []
export const saveStaff = (data) => _save(KEYS.staff, data)

export const getStockSec = () => _get(KEYS.stockSec) || []
export const saveStockSec = (data) => _save(KEYS.stockSec, data)

export const getStockMatiere = () => _get(KEYS.stockMatiere) || []
export const saveStockMatiere = (data) => _save(KEYS.stockMatiere, data)

export const getStockBoisson = () => _get(KEYS.stockBoisson) || []
export const saveStockBoisson = (data) => _save(KEYS.stockBoisson, data)

export const getIngredients = () => _get(KEYS.ingredients) || []
export const saveIngredients = (data) => _save(KEYS.ingredients, data)

export const getMatieresPremieresRecettes = () => _get(KEYS.matieresPremieresRecettes) || []
export const saveMatieresPremieresRecettes = (data) => _save(KEYS.matieresPremieresRecettes, data)

export function generateDevisNumber() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}${mm}${dd}`

  const clients = getClients()
  const todayPrefix = `DEV-${dateStr}-`
  const todayDevis = clients.filter((c) => c.devisNumber && c.devisNumber.startsWith(todayPrefix))
  const nextNum = String(todayDevis.length + 1).padStart(3, '0')
  return `${todayPrefix}${nextNum}`
}

export function notifyEvent(payload) {
  fetch('/api/notify.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn('[storage] Failed to send notification:', err)
  })
}

export function notifyNewDevis(devis) {
  notifyEvent(devis)
}
