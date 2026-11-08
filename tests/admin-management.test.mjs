import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('quote guard preserves SSR content but keeps forms inert until the server check', async () => {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({ root, server: { middlewareMode: true } })
  try {
    const { default: Guard } = await vite.ssrLoadModule('/src/components/QuoteRequestGuard.jsx')
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(createElement(Guard, {}, createElement('form', {}, createElement('label', {}, 'Coordonnées'), createElement('input'))))
    assert.match(html, /Coordonnées/)
    assert.match(html, /<fieldset[^>]*disabled=""[^>]*inert=""/)
    assert.match(html, /Vérification des demandes de devis/)
  } finally {
    await vite.close()
  }
})

test('session/CSRF prospect management, tombstones and independent quote maintenance', async () => {
  const fixture = path.join(root, `tests/.admin-management-${process.pid}`)
  const publicRoot = path.join(fixture, 'public')
  const api = path.join(publicRoot, 'api')
  const storage = path.join(publicRoot, 'storage-data')
  let server
  try {
    await mkdir(api, { recursive: true })
    await mkdir(path.join(storage, 'quote-followups'), { recursive: true })
    await mkdir(path.join(fixture, 'sessions'), { recursive: true })
    for (const name of ['site-controls.php', 'site-admin.php', 'site-guard.php', 'site-router.php', 'quote-access.php', 'quote_followup.php', 'prospects.php', 'storage.php', 'notify.php']) {
      await cp(path.join(root, 'public/api', name), path.join(api, name))
    }
    await writeFile(path.join(publicRoot, 'index.html'), '<html><head></head><body>Site ouvert</body></html>')
    await writeFile(path.join(storage, 'paradise_settings.json'), JSON.stringify({ pin: 'test-management-pin' }))
    const flowId = '0123456789abcdef0123456789abcdef'
    const otherId = 'abcdef0123456789abcdef0123456789'
    const summary = { prenom: 'Alice', nom: 'Martin', email: 'alice@example.fr', telephone: '0601020304', typeEvenement: 'Mariage', dateEvenement: '2099-06-12', nbAdultes: 50, nbEnfants: 0 }
    const flowFile = path.join(storage, 'quote-followups', `flow-${flowId}.json`)
    const record = { flowId, summary, stage: 2, updatedAt: '2026-11-08T00:00:00Z' }
    await writeFile(flowFile, JSON.stringify(record))
    const clientsFile = path.join(storage, 'paradise_clients.json')
    const clients = [{ id: 'existing', quoteFlowId: otherId, email: 'other@example.fr' }]
    await writeFile(clientsFile, JSON.stringify(clients))
    const port = await new Promise((resolve) => {
      const probe = createServer()
      probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)) })
    })
    server = spawn('php', ['-d', `session.save_path=${path.join(fixture, 'sessions')}`, '-d', 'sendmail_path=/bin/true', '-S', `127.0.0.1:${port}`, '-t', publicRoot], { stdio: 'ignore' })
    const origin = `http://127.0.0.1:${port}`
    let cookie = ''
    let csrf = ''
    const request = (name, body, authenticated = true, token = csrf) => fetch(`${origin}/api/${name}`, {
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie, 'X-Admin-CSRF': token } : {}) },
    })
    let ready = false
    for (let i = 0; i < 40 && !ready; i++) {
      try { ready = (await request('quote-access.php')).status === 200 } catch { await new Promise((resolve) => setTimeout(resolve, 50)) }
    }
    assert.ok(ready)
    assert.equal((await request('prospects.php', null, false)).status, 403)
    assert.equal((await fetch(`${origin}/api/prospects.php`, { headers: { 'X-Admin-Pin': 'test-management-pin' } })).status, 403)
    const login = await request('site-admin.php', { action: 'login', pin: 'test-management-pin' }, false)
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie').split(';')[0]
    let list = await (await request('prospects.php')).json()
    csrf = list.csrf
    assert.equal(list.prospects.length, 1)
    assert.equal((await request('prospects.php', { action: 'notes', flowId, internalNotes: 'test' }, true, '')).status, 403)
    assert.equal((await request('prospects.php', { action: 'notes', flowId: '../escape', internalNotes: 'test' })).status, 400)
    const notes = 'Rappeler lundi.\nBudget : 5 000 € <interne>'
    assert.equal((await request('prospects.php', { action: 'notes', flowId, internalNotes: notes })).status, 200)
    list = await (await request('prospects.php')).json()
    assert.equal(list.prospects[0].internalNotes, notes)
    assert.equal(JSON.parse(await readFile(flowFile, 'utf8')).internalNotes, notes)
    // A public progress retry cannot overwrite administrative notes.
    await request('notify.php', { notificationType: 'quote_followup', flowId, stage: 2, acceptedConditions: true, summary }, false)
    assert.equal(JSON.parse(await readFile(flowFile, 'utf8')).internalNotes, notes)
    await writeFile(clientsFile, JSON.stringify([...clients, { id: 'associated', quoteFlowId: flowId }]))
    const clientsBefore = await readFile(clientsFile, 'utf8')
    assert.equal((await request('prospects.php', { action: 'delete', flowId })).status, 200)
    assert.equal(await readFile(clientsFile, 'utf8'), clientsBefore)
    assert.equal((await (await request('prospects.php')).json()).prospects.length, 0)
    const tombstone = JSON.parse(await readFile(flowFile, 'utf8'))
    assert.ok(tombstone.deletedAt)
    assert.equal(tombstone.summary, undefined)
    assert.equal(tombstone.internalNotes, undefined)
    for (const stage of [1, 2, 3]) {
      const resumed = await request('notify.php', { notificationType: 'quote_followup', flowId, stage, acceptedConditions: true, summary: { ...summary, formule: 'Location sèche' } }, false)
      assert.equal(resumed.status, 200)
      assert.deepEqual(await resumed.json(), { ok: true, duplicate: true })
    }
    assert.deepEqual(JSON.parse(await readFile(flowFile, 'utf8')), tombstone)
    assert.equal((await request('storage.php?key=paradise_clients', [...clients, { id: 'new', quoteFlowId: flowId }], false)).status, 200, 'Deleting the prospect does not block quote completion')
    csrf = (await (await request('site-admin.php')).json()).csrf
    assert.equal((await request('site-admin.php', { action: 'save', quoteMaintenance: true }, true, '')).status, 403)
    assert.equal((await request('site-admin.php', { action: 'save', quoteMaintenance: true })).status, 200)
    const controls = (await (await request('site-admin.php')).json()).controls
    assert.equal(controls.maintenance, false)
    assert.equal(controls.quoteMaintenance, true)
    assert.equal((await request('quote-access.php', null, false)).status, 503)
    assert.equal((await request('site-router.php?route=devis', null, false)).status, 503)
    for (const route of ['', 'blog', 'espace-client/existing', 'dashboard']) assert.equal((await request(`site-router.php?route=${route}`, null, false)).status, 200)
    for (const notificationType of ['quote_followup', 'devis_brouillon']) {
      const blocked = await request('notify.php', { notificationType, flowId, stage: 1, acceptedConditions: true, summary }, false)
      assert.equal(blocked.status, 503)
      assert.match((await blocked.json()).error, /Maintenance devis/)
    }
    const existing = JSON.parse(await readFile(clientsFile, 'utf8'))
    assert.equal((await request('storage.php?key=paradise_clients', [...existing, { id: 'blocked-new' }], false)).status, 503)
    assert.equal((await request('storage.php?key=paradise_clients', existing.map((client) => ({ ...client, signature: 'signed' })), false)).status, 200)
    const signed = await request('notify.php', { notificationType: 'devis_signe', devisNumber: 'existing', email: 'alice@example.fr' }, false)
    assert.equal(signed.status, 200, 'Existing quote signatures are still notified')
    assert.equal((await request('storage.php?key=paradise_clients', null, false)).status, 200)
    assert.equal((await request('prospects.php')).status, 200)
    assert.equal((await request('site-admin.php', { action: 'save', quoteMaintenance: false })).status, 200)
    assert.equal((await request('quote-access.php', null, false)).status, 200)
  } finally {
    if (server) { const exited = once(server, 'exit'); server.kill(); await exited }
    await rm(fixture, { recursive: true, force: true })
  }
})
