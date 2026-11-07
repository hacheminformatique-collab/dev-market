export class HostingLimitError extends Error {
  constructor() {
    super('Protection de l’hébergement activée (HTTP 429/509). Appels suspendus pendant au moins une minute. Ne relancez pas le lot ; contactez LWS si votre IP reste bloquée.')
    this.name = 'HostingLimitError'
  }
}

export function createSiteFetch({ transport, origin, now = Date.now, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), locks, storage, spacing = 650 }) {
  let tail = Promise.resolve()
  let next = 0
  let blockedUntil = 0
  const reads = new Map()
  const cache = new Map()
  const revisions = new Map()
  function readNumber(key) {
    if (!storage) return 0
    const value = Number(storage.getItem(key) || 0)
    if (!Number.isFinite(value)) throw new Error('État de limitation réseau invalide. Fermez les onglets et effacez les données locales du site.')
    return value
  }
  function assertAvailable() {
    blockedUntil = Math.max(blockedUntil, readNumber('paradise_network_blocked_until'))
    if (now() < blockedUntil) throw new HostingLimitError()
  }
  async function reserve() {
    assertAvailable()
    next = Math.max(next, readNumber('paradise_network_next'))
    await wait(Math.max(0, next - now()))
    assertAvailable()
    next = now() + spacing
    storage?.setItem('paradise_network_next', String(next))
  }
  async function execute(input, options, paced) {
    const request = async () => {
      if (paced) await reserve()
      else assertAvailable()
      options?.signal?.throwIfAborted()
      const response = await transport(input, options)
      const quoteLimit = response.status === 429 && ['quote-followup', 'admin-login'].includes(response.headers.get('X-RateLimit-Scope'))
      if ((response.status === 429 && !quoteLimit) || response.status === 509) {
        const retry = response.headers.get('retry-after')
        const seconds = Number(retry)
        const until = retry && !Number.isFinite(seconds) ? Date.parse(retry) : now() + (seconds || 60) * 1000
        blockedUntil = Math.max(now() + 60_000, Number.isFinite(until) ? until : 0)
        storage?.setItem('paradise_network_blocked_until', String(blockedUntil))
        throw new HostingLimitError()
      }
      return response
    }
    // Hold the lock through dispatch and response so tabs cannot wake in a burst.
    return paced && locks ? locks.request('paradise-site-network', request) : request()
  }
  return function siteFetch(input, options) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, origin)
    if (url.origin !== origin) return transport(input, options)
    const method = (options?.method || input?.method || 'GET').toUpperCase()
    const paced = options?.paced ?? (method !== 'GET' && method !== 'HEAD')
    const transportOptions = options && Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'paced'))
    const key = url.href
    const cacheable = method === 'GET' && url.pathname === '/api/storage.php' && !options?.signal && options?.cache !== 'no-store'
    if (method !== 'GET') {
      const affected = [key]
      if (url.pathname === '/api/city-page-storage.php') {
        const pageKey = url.searchParams.get('key')
        const storageUrl = new URL('/api/storage.php', origin)
        const keys = [pageKey]
        if (url.searchParams.get('action') === 'backup-pages') {
          keys.push(pageKey?.replace(/^paradise_city_pages/, 'paradise_city_pages_backup'))
        }
        for (const storageKey of keys) {
          storageUrl.searchParams.set('key', storageKey)
          affected.push(storageUrl.href)
        }
      }
      for (const affectedKey of affected) {
        revisions.set(affectedKey, (revisions.get(affectedKey) || 0) + 1)
        cache.delete(affectedKey)
        reads.delete(affectedKey)
      }
    }
    if (cacheable && cache.has(key) && cache.get(key).expires > now()) return Promise.resolve(cache.get(key).response.clone())
    if (cacheable && reads.has(key)) return reads.get(key).then((response) => response.clone())
    const revision = revisions.get(key) || 0
    const result = paced ? tail.then(() => execute(input, transportOptions, true)) : execute(input, transportOptions, false)
    if (paced) tail = result.then(() => undefined, () => undefined)
    if (!cacheable) return result
    const read = result.then((response) => {
      if ((revisions.get(key) || 0) === revision && response.ok && response.headers.get('content-type')?.includes('application/json')) {
        cache.set(key, { response: response.clone(), expires: now() + 5000 })
      }
      return response
    })
    reads.set(key, read)
    void read.finally(() => { if (reads.get(key) === read) reads.delete(key) }).catch(() => {})
    return read.then((response) => response.clone())
  }
}

let browserFetch
export function batchFetch(input, options) {
  return siteFetch(input, { ...options, paced: true })
}

export function siteFetch(input, options) {
  if (typeof window === 'undefined') return globalThis.fetch(input, options)
  if (!browserFetch) {
    browserFetch = createSiteFetch({
      transport: globalThis.fetch.bind(globalThis),
      origin: window.location.origin,
      locks: navigator.locks,
      storage: navigator.locks ? window.localStorage : undefined,
    })
    if (!navigator.locks) console.warn('[Network] Coordination multi-onglets indisponible : utilisez un seul onglet pour administrer le site.')
  }
  return browserFetch(input, options)
}
