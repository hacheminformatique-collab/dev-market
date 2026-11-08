import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('site analytics records pseudonymous daily visitors and serves aggregates only to admins', async () => {
  const fixture = path.join(root, `tests/.site-analytics-http-${process.pid}`)
  const webroot = path.join(fixture, 'public')
  const api = path.join(webroot, 'api')
  const storage = path.join(webroot, 'storage-data')
  const settings = { pin: 'test-analytics-pin' }
  let phpServer
  try {
    await rm(fixture, { recursive: true, force: true })
    await mkdir(api, { recursive: true })
    await mkdir(storage, { recursive: true })
    await cp(path.join(root, 'public/api/site-analytics.php'), path.join(api, 'site-analytics.php'))
    await cp(path.join(root, 'public/api/site-controls.php'), path.join(api, 'site-controls.php'))
    await writeFile(path.join(storage, 'paradise_settings.json'), JSON.stringify(settings))

    const httpPort = await new Promise((resolve, reject) => {
      const probe = createServer()
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', () => {
        const port = probe.address().port
        probe.close(() => resolve(port))
      })
    })
    phpServer = spawn('php', ['-S', `127.0.0.1:${httpPort}`, '-t', webroot], { stdio: 'ignore' })
    const endpoint = `http://127.0.0.1:${httpPort}/api/site-analytics.php`
    let ready = false
    for (let attempt = 0; attempt < 40 && !ready; attempt++) {
      try {
        ready = (await fetch(endpoint)).status === 403
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
    assert.equal(ready, true, 'PHP test server should start')

    const date = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const track = (visitorId, page) => fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track', date, visitorId, path: page }),
    })
    for (const [visitor, page] of [
      ['a'.repeat(32), '/locationsalledemariage/meaux'],
      ['a'.repeat(32), '/locationsalledemariage/chessy'],
      ['b'.repeat(32), '/locationsalledemariage/meaux'],
    ]) {
      const response = await track(visitor, page)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { ok: true })
    }
    assert.deepEqual(await (await track('c'.repeat(32), '/admin')).json(), { ok: true, ignored: true })
    const botVisit = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Googlebot/2.1' },
      body: JSON.stringify({ action: 'track', date, visitorId: 'd'.repeat(32), path: '/locationsalledemariage/meaux' }),
    })
    assert.deepEqual(await botVisit.json(), { ok: true, ignored: true })
    assert.equal((await track('x'.repeat(32), 'https://example.com')).status, 400)
    assert.equal((await track('x'.repeat(32), `/path?email=${encodeURIComponent('alice@example.fr')}`)).status, 400)

    await mkdir(path.join(storage, 'site-analytics'), { recursive: true })
    await writeFile(path.join(storage, 'site-analytics', '2000-01-01.json'), JSON.stringify({
      date: '2000-01-01', visitors: {}, pages: {},
    }))
    assert.equal((await fetch(endpoint)).status, 403)
    const response = await fetch(endpoint, { headers: { 'X-Admin-Pin': settings.pin } })
    assert.equal(response.status, 200)
    const report = await response.json()
    assert.equal(report.daily.length, 30)
    assert.equal(report.periods[7].visitors, 2)
    assert.equal(report.periods[7].pageViews, 3)
    assert.equal(report.periods[90].averageVisitorsPerDay, 0)
    assert.deepEqual(report.topPages, [
      { path: '/locationsalledemariage/meaux', pageViews: 2 },
      { path: '/locationsalledemariage/chessy', pageViews: 1 },
    ])
    const stored = await readFile(path.join(storage, 'site-analytics', `${date}.json`), 'utf8')
    assert.doesNotMatch(stored, /a{32}|b{32}|alice@example\.fr/)
    assert.match(await readFile(path.join(storage, 'site-analytics', '.htaccess'), 'utf8'), /Require all denied/)
    await assert.rejects(readFile(path.join(storage, 'site-analytics', '2000-01-01.json')))
  } finally {
    if (phpServer) {
      const exited = once(phpServer, 'exit')
      phpServer.kill()
      await exited
    }
    await rm(fixture, { recursive: true, force: true })
  }
})
