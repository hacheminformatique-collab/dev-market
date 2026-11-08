import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { verifyPublishedUrl } from '../src/utils/publicationVerification.js'

const html = '<!doctype html><title>Coulours</title>'
const hashText = async (text) => createHash('sha256').update(text).digest('hex')
const expectedHash = await hashText(html)
const options = { path: '/locationsalledemariage/coulours-89320', label: 'Coulours', expectedHash, hashText }

test('verification retries transient HTTP errors and stale cached HTML without rewriting', async () => {
  const responses = [new Response('Temporary error', { status: 503 }), new Response('Stale HTML'), new Response(html)]
  const calls = []
  const waits = []
  await verifyPublishedUrl({
    ...options,
    transport: async (url, request) => { calls.push([url, request]); return responses.shift() },
    wait: async (ms) => { waits.push(ms) },
  })
  assert.equal(calls.length, 3)
  assert.equal(calls[0][0], options.path)
  assert.match(calls[1][0], /\?publication-check=/)
  assert.ok(calls.every(([, request]) => !request.method && request.cache === 'no-store'))
  assert.deepEqual(waits, [1000, 2000])
})

test('persistent HTML mismatch reports URL and status instead of claiming rewrite is certainly broken', async () => {
  let calls = 0
  await assert.rejects(verifyPublishedUrl({
    ...options, transport: async () => { calls++; return new Response('SPA shell') }, wait: async () => {},
  }), /Coulours.*coulours-89320.*HTTP 200.*contenu différent.*sans le réécrire/)
  assert.equal(calls, 3)
})

test('missing or forbidden URLs and hosting rate limits stop without retry storms', async () => {
  for (const status of [403, 404]) {
    let calls = 0
    await assert.rejects(verifyPublishedUrl({
      ...options, transport: async () => { calls++; return new Response('Denied', { status }) }, wait: async () => {},
    }), new RegExp(`HTTP ${status}`))
    assert.equal(calls, 1)
  }
  const error = new Error('Hosting blocked')
  error.name = 'HostingLimitError'
  let calls = 0
  await assert.rejects(verifyPublishedUrl({
    ...options, transport: async () => { calls++; throw error }, wait: async () => {},
  }), (actual) => actual === error)
  assert.equal(calls, 1)
})
