import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile, symlink, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const hash = (content) => createHash('sha256').update(content).digest('hex')
const pin = 'checkpoint-test-pin'
const aliases = { meaux: 'meaux-77100' }
const page = (slug, text = '') => `<!doctype html><html><head><link rel="canonical" href="https://example.fr/locationsalledemariage/${slug}"></head><body>${text}<script id="city-page-data" type="application/json">{"page":{},"config":{}}</script></body></html>`

async function freePort() {
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise((done) => probe.close(done))
  return port
}

test('publication checkpoints persist verified batches safely and support interrupted resumption', async (t) => {
  const fixture = join(root, `tests/.publication-checkpoints-${process.pid}`)
  const site = join(fixture, 'site')
  const storage = join(site, 'storage-data')
  const registry = join(site, 'wedding-pages.json')
  const journal = join(storage, 'wedding-publication-checkpoints.json')
  const cities = join(site, 'locationsalledemariage')
  const processes = []
  const origins = []
  const file = (slug) => join(cities, `${slug}.html`)
  const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
  const request = (body, origin = origins[0], providedPin = pin) => fetch(`${origin}/api/static-publish.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': providedPin }, body: JSON.stringify(body),
  })
  const inspect = (slugs = [], inspectSlugs = slugs) => request({ action: 'inspect', aliases, slugs, inspectSlugs })
  const checkpoint = (pages, expectedRegistryHash = 'missing', extra = {}) => request({ action: 'checkpoint', aliases, pages, expectedRegistryHash, ...extra })
  const snapshot = async () => [await readFile(registry, 'utf8').catch(() => null), await readFile(journal, 'utf8').catch(() => null)]
  try {
    await mkdir(join(site, 'api'), { recursive: true })
    await mkdir(storage, { recursive: true })
    await mkdir(cities, { recursive: true })
    await mkdir(join(fixture, 'sessions'), { recursive: true })
    for (const name of ['static-publish.php', 'site-controls.php', 'site-guard.php', 'site-admin.php', 'data-purge.php']) {
      await cp(join(root, 'public/api', name), join(site, 'api', name))
    }
    await writeFile(join(storage, 'paradise_settings.json'), JSON.stringify({ pin }))
    await writeFile(join(site, 'index.html'), '<!-- WEDDING_DIRECTORY_START --><!-- WEDDING_DIRECTORY_END -->')
    await writeFile(join(site, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>')
    for (let i = 0; i < 2; i++) {
      const origin = `http://127.0.0.1:${await freePort()}`
      const server = spawn('php', ['-d', `session.save_path=${join(fixture, 'sessions')}`, '-S', origin.slice(7), '-t', site], { stdio: 'ignore' })
      processes.push(server)
      origins.push(origin)
      let ready = false
      for (let attempt = 0; attempt < 60 && !ready; attempt++) {
        try { ready = (await fetch(`${origin}/index.html`)).ok } catch { /* server startup */ }
        if (!ready) await new Promise((done) => setTimeout(done, 50))
      }
      assert.ok(ready, 'isolated PHP server started')
    }

    await t.test('authentication, payload and exact disk hashes fail without writes', async () => {
      const html = page('meaux-77100')
      await writeFile(file('meaux-77100'), html)
      const payload = { action: 'checkpoint', aliases, pages: { 'meaux-77100': hash(html) }, expectedRegistryHash: 'missing' }
      assert.equal((await request(payload, origins[0], '')).status, 403)
      assert.equal((await fetch(`${origins[0]}/api/static-publish.php`)).status, 405)
      for (const pages of [[], null, { '../escape': hash(html) }, { 'meaux-77100': 'missing' }, { 'meaux-77100': 42 }, Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`city-${i}`, hash(html)]))]) {
        assert.equal((await checkpoint(pages)).status, 400)
      }
      assert.equal((await checkpoint(payload.pages, 'stale')).status, 409)
      assert.equal((await checkpoint(payload.pages, 'missing', { aliases: undefined })).status, 409)
      assert.equal((await checkpoint(payload.pages, 'missing', { aliases: { meaux: 'meaux-other' } })).status, 400)
      assert.equal((await checkpoint({ 'meaux-77100': 'a'.repeat(64) })).status, 409)
      assert.equal((await checkpoint({ 'missing-77100': hash(html) })).status, 409)
      assert.deepEqual(await snapshot(), [null, null])
      assert.equal(await readFile(file('meaux-77100'), 'utf8'), html)
    })

    await t.test('interrupted page write remains discoverable before acknowledgement', async () => {
      let inspection = await (await inspect(['meaux-77100'])).json()
      assert.equal(inspection.checkpointsSupported, true)
      assert.equal(inspection.registryHash, 'missing')
      assert.equal(inspection.pages['meaux-77100'].fileHash, hash(page('meaux-77100')))
      assert.equal(inspection.pages['meaux-77100'].verifiedHash, null)
      const result = await (await checkpoint({ 'meaux-77100': hash(page('meaux-77100')) })).json()
      assert.equal(result.ok, true)
      assert.equal(result.registryHash, hash(await readFile(registry)))
      assert.deepEqual(await readJson(registry), ['meaux-77100'])
      inspection = await (await inspect(['meaux-77100'])).json()
      assert.equal(inspection.pages['meaux-77100'].verifiedHash, inspection.pages['meaux-77100'].fileHash)
      const before = await Promise.all([stat(registry), stat(journal)])
      await checkpoint({ 'meaux-77100': hash(page('meaux-77100')) }, result.registryHash)
      const after = await Promise.all([stat(registry), stat(journal)])
      assert.deepEqual(after.map((s) => s.mtimeMs), before.map((s) => s.mtimeMs), 'idempotent acknowledgements do not rewrite')
    })

    await t.test('changed HTML and directory require a fresh verified hash', async () => {
      const oldHash = hash(page('meaux-77100'))
      const changed = page('meaux-77100', 'changed')
      assert.equal((await request({ action: 'page', slug: 'meaux-77100', html: changed, expectedHash: oldHash })).status, 200)
      const before = await snapshot()
      assert.equal((await checkpoint({ 'meaux-77100': oldHash }, hash(before[0]))).status, 409)
      assert.deepEqual(await snapshot(), before)
      let inspection = await (await inspect(['meaux-77100'])).json()
      assert.equal(inspection.pages['meaux-77100'].verifiedHash, oldHash)
      assert.equal(inspection.pages['meaux-77100'].fileHash, hash(changed))
      const response = await request({
        action: 'city-directory', slug: 'meaux-77100', expectedHash: hash(changed),
        directory: '<section class="wedding-directory"><a href="/locationsalledemariage/meaux-77100">Meaux</a></section>',
        styles: '.wedding-directory{display:block}',
      })
      assert.equal(response.status, 200)
      const result = await response.json()
      assert.equal(result.fileHash, hash(await readFile(file('meaux-77100'))))
      assert.equal(typeof result.directoryHash, 'string')
      assert.equal((await checkpoint({ 'meaux-77100': result.fileHash }, inspection.registryHash)).status, 200)
      inspection = await (await inspect(['meaux-77100'])).json()
      assert.equal(inspection.pages['meaux-77100'].verifiedHash, result.fileHash)
    })

    await t.test('batches merge monotonically, canonicalize legacy entries and metadata avoids HTML inspection', async () => {
      await writeFile(registry, JSON.stringify(['meaux', 'meaux-77100']))
      const pages = {}
      for (let i = 0; i < 25; i++) {
        const slug = `city-${i}-77100`
        const html = page(slug)
        await writeFile(file(slug), html)
        pages[slug] = hash(html)
      }
      const currentHash = hash(await readFile(registry))
      const result = await (await checkpoint(pages, currentHash)).json()
      assert.equal(result.ok, true)
      assert.deepEqual(await readJson(registry), ['meaux-77100', ...Object.keys(pages)])
      assert.equal(Object.keys(await readJson(journal)).length, 26)
      assert.equal(await readFile(join(site, 'sitemap.xml'), 'utf8'), '<?xml version="1.0"?><urlset></urlset>', 'checkpoint does not rewrite the sitemap')
      await writeFile(file('city-0-77100'), 'unrecognized interrupted document')
      const metadata = await (await inspect([], [])).json()
      assert.equal(metadata.checkpointsSupported, true)
      assert.equal(metadata.registryHash, result.registryHash)
      assert.equal(metadata.publishedSlugs.length, 26)
      assert.equal((await inspect(['city-0-77100'])).status, 409)
      await writeFile(file('city-0-77100'), page('city-0-77100'))
    })

    await t.test('a bad last entry, invalid journal and symlinks never partially acknowledge', async () => {
      const before = await snapshot()
      assert.equal((await checkpoint({ 'city-0-77100': hash(page('city-0-77100')), 'city-1-77100': 'b'.repeat(64) }, hash(before[0]))).status, 409)
      assert.deepEqual(await snapshot(), before)
      for (const invalid of ['{broken', '[]', '{"city-0-77100":"invalid"}', '{"../escape":"' + 'a'.repeat(64) + '"}']) {
        await writeFile(journal, invalid)
        assert.equal((await inspect([], [])).status, 409)
        assert.equal((await checkpoint({ 'city-0-77100': hash(page('city-0-77100')) }, hash(before[0]))).status, 409)
        assert.deepEqual(await snapshot(), [before[0], invalid])
      }
      await writeFile(journal, before[1])
      await symlink(file('city-0-77100'), file('linked-77100'))
      assert.equal((await checkpoint({ 'linked-77100': hash(page('city-0-77100')) }, hash(before[0]))).status, 409)
      await rm(file('linked-77100'))
      await rm(journal)
      await symlink(file('city-0-77100'), journal)
      assert.equal((await checkpoint({ 'city-0-77100': hash(page('city-0-77100')) }, hash(before[0]))).status, 409)
      await rm(journal)
      await writeFile(journal, before[1])
      assert.deepEqual(await snapshot(), before)
    })

    await t.test('concurrent stale writers cannot lose successful acknowledgements', async () => {
      const expectedRegistryHash = hash(await readFile(registry))
      const payloads = []
      for (const slug of ['concurrent-a-77100', 'concurrent-b-77100']) {
        const html = page(slug)
        await writeFile(file(slug), html)
        payloads.push({ action: 'checkpoint', aliases, pages: { [slug]: hash(html) }, expectedRegistryHash })
      }
      const responses = await Promise.all(payloads.map((payload, i) => request(payload, origins[i])))
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
      const winner = responses.findIndex((r) => r.status === 200)
      const loser = 1 - winner
      assert.ok((await readJson(registry)).includes(Object.keys(payloads[winner].pages)[0]))
      assert.equal((await readJson(journal))[Object.keys(payloads[loser].pages)[0]], undefined)
      const metadata = await (await inspect([], [])).json()
      assert.equal((await request({ ...payloads[loser], expectedRegistryHash: metadata.registryHash })).status, 200)
      assert.ok((await readJson(registry)).includes(Object.keys(payloads[loser].pages)[0]))
      assert.equal((await readJson(registry)).length, 28)
    })

    await t.test('registry cap and malformed registry fail before journal updates', async () => {
      const before = await snapshot()
      const full = JSON.stringify(Array.from({ length: 6000 }, (_, i) => `existing-${i}-77100`))
      await writeFile(registry, full)
      assert.equal((await checkpoint({ 'city-0-77100': hash(page('city-0-77100')) }, hash(full))).status, 400)
      assert.equal(await readFile(journal, 'utf8'), before[1])
      for (const invalid of ['["../bad"]', '{}', '{"0":"city-0-77100"}', '{broken']) {
        await writeFile(registry, invalid)
        assert.equal((await checkpoint({}, hash(invalid))).status, 409)
        assert.equal((await inspect([], [])).status, 409)
        assert.equal(await readFile(journal, 'utf8'), before[1])
      }
      await writeFile(registry, before[0])
    })

    await t.test('pages and full purges reset the checkpoint journal under the publication lock', async () => {
      const login = await fetch(`${origins[0]}/api/site-admin.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', pin }) })
      assert.equal(login.status, 200)
      const cookie = login.headers.get('set-cookie').split(';')[0]
      for (const type of ['pages-mariage', 'all']) {
        await writeFile(journal, JSON.stringify({ 'city-0-77100': hash(page('city-0-77100')) }))
        const response = await fetch(`${origins[0]}/api/data-purge.php`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ type, confirmation: 'PURGER' }),
        })
        assert.equal(response.status, 200)
        assert.deepEqual(await readJson(journal), {})
        assert.deepEqual(await readJson(registry), [])
      }
    })
  } finally {
    for (const child of processes) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit')
        child.kill('SIGTERM')
        await exited
      }
    }
    await rm(fixture, { recursive: true, force: true })
  }
})
