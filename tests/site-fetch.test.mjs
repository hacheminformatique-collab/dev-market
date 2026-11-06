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
  await Promise.all(Array.from({ length: 1100 }, (_value, i) => tabs[i % 2](`/api/item-${i}`, { method: i % 3 ? 'GET' : 'POST' })))
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
    const results = await Promise.allSettled([a('/api/a'), b('/api/b'), a('/api/c')])
    assert.equal(starts.length, 1)
    for (const result of results) assert.ok(result.reason instanceof HostingLimitError)
    advance(60001)
    shared.transport = original
    const c = createSiteFetch(shared)
    assert.equal((await c('/api/recovered')).status, 200)
    assert.equal(starts.length, 2)
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
