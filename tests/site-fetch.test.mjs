import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSiteFetch, HostingLimitError } from '../src/utils/siteFetch.js'
import { createServer } from 'vite'

function fixture() {
  let time = 0
  const starts = []
  const values = new Map()
  let lockTail = Promise.resolve()
  const shared = {
    origin: 'https://example.com',
    now: () => time,
    wait: async (ms) => { time += ms },
    storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    locks: { request: (_name, fn) => {
      const result = lockTail.then(fn)
      lockTail = result.catch(() => {})
      return result
    } },
    transport: async (url) => {
      starts.push({ time, url })
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    },
  }
  return { shared, starts, advance: (ms) => { time += ms } }
}

test('two tabs and mixed publication/storage calls stay below two starts in any second without bursts', async () => {
  const { shared, starts } = fixture()
  const tabs = [createSiteFetch(shared), createSiteFetch(shared)]
  await Promise.all(Array.from({ length: 1100 }, (_value, i) => tabs[i % 2](`/api/item-${i}`, { method: i % 3 ? 'GET' : 'POST', paced: true })))
  assert.equal(starts.length, 1100)
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i].time - starts[i - 1].time >= 650)
  for (let i = 2; i < starts.length; i++) assert.ok(starts[i].time - starts[i - 2].time > 1000)
})

test('identical reads share one request, cache briefly and invalidate after writing', async () => {
  const { shared, starts, advance } = fixture()
  const fetch = createSiteFetch(shared)
  const url = '/api/storage.php?key=paradise_city_pages_reception'
  const responses = await Promise.all(Array.from({ length: 10 }, () => fetch(url)))
  await Promise.all(responses.map((response) => response.json()))
  assert.equal(starts.length, 1)
  await fetch(url)
  assert.equal(starts.length, 1)
  await fetch(url, { method: 'POST', body: '{}' })
  await fetch(url)
  assert.equal(starts.length, 3)
  advance(5100)
  await fetch(url)
  await fetch(url, { cache: 'no-store' })
  assert.equal(starts.length, 5)
})

test('509 and 429 suspend queued calls across tabs with no automatic retry', async () => {
  for (const status of [509, 429]) {
    const { shared, starts, advance } = fixture()
    const original = shared.transport
    shared.transport = async (url) => {
      await original(url)
      return new Response('', { status })
    }
    const a = createSiteFetch(shared)
    const b = createSiteFetch(shared)
    const results = await Promise.allSettled([a('/api/a', { paced: true }), b('/api/b', { paced: true }), a('/api/c', { paced: true })])
    assert.equal(starts.length, 1)
    for (const result of results) assert.ok(result.reason instanceof HostingLimitError)
    advance(60001)
    shared.transport = original
    const c = createSiteFetch(shared)
    assert.equal((await c('/api/recovered')).status, 200)
    assert.equal(starts.length, 2)
  }
})

test('incremental page writes and server backups invalidate their storage read caches', async () => {
  const { shared, starts } = fixture()
  const fetch = createSiteFetch(shared)
  const pages = '/api/storage.php?key=paradise_city_pages'
  const backups = '/api/storage.php?key=paradise_city_pages_backup'
  await fetch(pages)
  await fetch(backups)
  await fetch('/api/city-page-storage.php?key=paradise_city_pages&action=save-page', { method: 'POST', body: '{}' })
  await fetch(pages)
  await fetch(backups)
  assert.equal(starts.filter(({ url }) => url === pages).length, 2)
  assert.equal(starts.filter(({ url }) => url === backups).length, 1)
  await fetch('/api/city-page-storage.php?key=paradise_city_pages&action=backup-pages', { method: 'POST', body: '{}' })
  await fetch(backups)
  assert.equal(starts.filter(({ url }) => url === backups).length, 2)
})

test('public reads dispatch immediately without waiting for a pending batch or reserving its slots', async () => {
  const { shared, starts } = fixture()
  let finishBatch
  const original = shared.transport
  shared.transport = async (url, options) => {
    const response = await original(url)
    assert.equal(options?.paced, undefined)
    if (url === '/api/batch') await new Promise((resolve) => { finishBatch = resolve })
    return response
  }
  const fetch = createSiteFetch(shared)
  const batch = fetch('/api/batch', { method: 'POST' })
  while (!finishBatch) await Promise.resolve()
  const startTime = starts[0].time
  await Promise.all(['/api/news.php', '/wedding-pages.json', '/api/storage.php?key=paradise_settings'].map((url) => fetch(url)))
  assert.equal(starts.length, 4)
  assert.ok(starts.every((start) => start.time === startTime))
  finishBatch()
  await batch
})

test('public storage loads settings alone without writing defaults or initializing private keys', async () => {
  const vite = await createServer({ root: new URL('../', import.meta.url).pathname, server: { middlewareMode: true } })
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = { getItem: () => null, setItem() {} }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response('null', { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const storage = await vite.ssrLoadModule('/src/utils/storage.js')
    const { storageProfile } = await vite.ssrLoadModule('/src/utils/storageProfiles.js')
    await Promise.all([storage.initStorage(storageProfile('/')), storage.initStorage(storageProfile('/blog'))])
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /key=paradise_settings$/)
    assert.equal(calls[0].options.paced, false)
    assert.equal(storageProfile('/dashboard'), undefined)
    await storage.initStorage()
    assert.equal(calls.filter((call) => call.options?.method !== 'POST').length, 16)
  } finally {
    globalThis.fetch = originalFetch
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
    await vite.close()
  }
})

test('external requests bypass hosting limiter; cancelled calls are not dispatched', async () => {
  const { shared, starts } = fixture()
  const fetch = createSiteFetch(shared)
  await fetch('https://external.example/api')
  assert.equal(starts.length, 1)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(fetch('/api/cancelled', { signal: controller.signal }), /abort/i)
  assert.equal(starts.length, 1)
})

test('company defaults persist only after entering administration and preserve saved settings', async () => {
  const vite = await createServer({ root: new URL('../', import.meta.url).pathname, server: { middlewareMode: true } })
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  const saved = { pin: 'existing-pin', siteUrl: '', legalInfo: { email: '', gerant: 'Gérant existant' } }
  globalThis.localStorage = { getItem: () => null, setItem() {} }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(url.includes('key=paradise_settings') ? saved : null), { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const storage = await vite.ssrLoadModule('/src/utils/storage.js')
    const { storageProfile } = await vite.ssrLoadModule('/src/utils/storageProfiles.js')
    await storage.initStorage(storageProfile('/'))
    assert.equal(calls.length, 1)
    assert.equal(storage.getSettings().siteUrl, 'https://www.leparadise77.fr')
    await storage.initStorage()
    const writes = calls.filter((call) => call.options?.method === 'POST' && call.url.includes('key=paradise_settings'))
    assert.equal(writes.length, 1)
    const merged = JSON.parse(writes[0].options.body)
    assert.equal(merged.pin, saved.pin)
    assert.equal(merged.legalInfo.gerant, saved.legalInfo.gerant)
    assert.equal(merged.legalInfo.email, 'contact@leparadise77.fr')
    assert.deepEqual(merged.bankInfo, { iban: '', bic: '', titulaire: '' })
  } finally {
    globalThis.fetch = originalFetch
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
    await vite.close()
  }
})

test('a quote-specific notification limit is reported without suspending the whole site', async () => {
  const { shared, starts } = fixture()
  const original = shared.transport
  shared.transport = async (url) => {
    const response = await original(url)
    return url === '/api/notify.php'
      ? new Response('{"error":"Limite de notifications atteinte"}', { status: 429, headers: { 'X-RateLimit-Scope': 'quote-followup', 'Content-Type': 'application/json' } })
      : response
  }
  const fetch = createSiteFetch(shared)
  const response = await fetch('/api/notify.php', { method: 'POST', body: '{}' })
  assert.equal(response.status, 429)
  assert.match((await response.json()).error, /Limite/)
  assert.equal((await fetch('/wedding-pages.json')).status, 200)
  assert.equal(starts.length, 2)
})

test('storage initialization and refresh cycles coalesce and a server outage never writes defaults', async () => {
  const vite = await createServer({ root: new URL('../', import.meta.url).pathname, server: { middlewareMode: true } })
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const calls = []
  globalThis.localStorage = { getItem: () => null, setItem() {} }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options?.method || 'GET' })
    return new Response('{}', { status: 500 })
  }
  try {
    const storage = await vite.ssrLoadModule('/src/utils/storage.js')
    const first = storage.initStorage()
    assert.equal(storage.initStorage(), first)
    await first
    assert.equal(calls.length, 16)
    assert.ok(calls.every((call) => call.method === 'GET'))
    const refresh = storage.refreshFromServer()
    assert.equal(storage.refreshFromServer(), refresh)
    await refresh
    assert.equal(calls.length, 32)
  } finally {
    globalThis.fetch = originalFetch
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
    await vite.close()
  }
})
