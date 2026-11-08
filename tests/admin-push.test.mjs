import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('admin push session auth, CSRF, subscriptions, VAPID storage, library encryption and bounded delivery', async () => {
  const fixture = path.join(root, `tests/.admin-push-http-${process.pid}`)
  const publicDir = path.join(fixture, 'public')
  const api = path.join(publicDir, 'api')
  let server
  try {
    await mkdir(api, { recursive: true })
    await mkdir(path.join(publicDir, 'storage-data'), { recursive: true })
    await mkdir(path.join(fixture, 'sessions'), { recursive: true })
    for (const file of ['site-controls.php', 'site-admin.php', 'admin-push-lib.php', 'admin-push.php', 'admin-push-manifest.php']) {
      await cp(path.join(root, 'public/api', file), path.join(api, file))
    }
    await cp(path.join(root, 'public/api/push-runtime'), path.join(api, 'push-runtime'), { recursive: true })
    await cp(path.join(root, 'public/admin-push.webmanifest'), path.join(publicDir, 'admin-push.webmanifest'))
    await writeFile(path.join(publicDir, 'storage-data/paradise_settings.json'), JSON.stringify({ pin: 'push-test-pin', email: 'admin@example.org' }))
    await writeFile(path.join(publicDir, 'storage-data/site-controls.json'), JSON.stringify({ maintenance: false, adminSlug: 'private-test-route' }))
    const port = await new Promise((resolve, reject) => {
      const probe = createServer()
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)) })
    })
    server = spawn('php', ['-d', `session.save_path=${path.join(fixture, 'sessions')}`, '-S', `127.0.0.1:${port}`, '-t', publicDir], { stdio: 'ignore' })
    const origin = `http://127.0.0.1:${port}`
    let ready = false
    for (let attempt = 0; attempt < 60 && !ready; attempt++) {
      try { ready = (await fetch(`${origin}/api/admin-push.php`)).status === 403 }
      catch { await new Promise((resolve) => setTimeout(resolve, 50)) }
    }
    assert.equal(ready, true)
    const endpoint = `${origin}/api/admin-push.php`
    assert.equal((await fetch(endpoint, { headers: { 'X-Admin-Pin': 'push-test-pin' } })).status, 403, 'legacy PIN headers cannot subscribe')
    const login = await fetch(`${origin}/api/site-admin.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', pin: 'push-test-pin' }),
    })
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const configuration = await fetch(endpoint, { headers: { Cookie: cookie } })
    assert.equal(configuration.status, 200)
    assert.match(configuration.headers.get('cache-control'), /no-store/)
    const config = await configuration.json()
    assert.equal(config.preferences.visit, false)
    assert.equal(config.publicKey.length, 87)
    assert.equal(config.privateKey, undefined)
    const manifest = await (await fetch(`${origin}/api/admin-push-manifest.php`, { headers: { Cookie: cookie } })).json()
    assert.equal(manifest.start_url, '/private-test-route/dashboard')
    assert.equal((await fetch(`${origin}/api/admin-push-manifest.php`)).status, 403)
    const protectedDir = path.join(publicDir, 'storage-data/admin-push')
    assert.equal((await readFile(path.join(protectedDir, '.htaccess'), 'utf8')).trim(), 'Require all denied')
    const vapid = JSON.parse(await readFile(path.join(protectedDir, 'vapid.json'), 'utf8'))
    assert.equal(vapid.publicKey, config.publicKey)
    assert.ok(vapid.privateKey)

    const preferences = { prospect: true, draft: true, signed: true, visit: false }
    const subscription = {
      endpoint: 'https://web.push.apple.com/test-subscription-1',
      keys: { p256dh: config.publicKey, auth: Buffer.alloc(16, 7).toString('base64url') },
    }
    const body = { action: 'subscribe', endpoint: subscription.endpoint, subscription, preferences }
    const post = (data, csrf = config.csrf) => fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Push-Csrf': csrf },
      body: JSON.stringify(data),
    })
    assert.equal((await post(body, '')).status, 403)
    assert.equal((await post(body, 'bad-token')).status, 403)
    for (const bad of [
      'http://web.push.apple.com/x', 'https://127.0.0.1/x', 'https://[::1]/x',
      'https://web.push.apple.com.evil.example/x', 'https://web.push.apple.com@127.0.0.1/x',
      'https://web.push.apple.com:8443/x', 'https://web.push.apple.com/x#private',
      'https://fcm.googleapis.com\\@127.0.0.1/x', 'https://fcm.googleapis.com/',
      'https://sub.sub.push.apple.com/x', 'https://localhost/x',
    ]) {
      assert.equal((await post({ ...body, endpoint: bad, subscription: { ...subscription, endpoint: bad } })).status, 400, bad)
    }
    assert.equal((await post({ ...body, subscription: { ...subscription, keys: { ...subscription.keys, auth: 'x' } } })).status, 400)
    assert.equal((await post({ ...body, subscription: { ...subscription, keys: { ...subscription.keys, p256dh: Buffer.alloc(65, 4).toString('base64url') } } })).status, 400)
    assert.equal((await post({ ...body, preferences: { ...preferences, visit: 'yes' } })).status, 400)
    assert.equal((await post(body)).status, 200)
    let status = await (await post({ action: 'status', endpoint: subscription.endpoint })).json()
    assert.equal(status.subscribed, true)
    assert.deepEqual(status.preferences, preferences)
    assert.equal((await post({ ...body, preferences: { ...preferences, visit: true } })).status, 200)
    status = await (await post({ action: 'status', endpoint: subscription.endpoint })).json()
    assert.equal(status.preferences.visit, true)
    assert.equal((await post({ action: 'unsubscribe', endpoint: subscription.endpoint })).status, 200)
    assert.equal((await (await post({ action: 'status', endpoint: subscription.endpoint })).json()).subscribed, false)
    for (let index = 0; index < 10; index++) {
      const item = { ...subscription, endpoint: `https://web.push.apple.com/test-${index}` }
      assert.equal((await post({ ...body, endpoint: item.endpoint, subscription: item })).status, 200)
    }
    assert.equal((await post(body)).status, 503, 'bounded device capacity')
    const adminCsrf = (await (await fetch(`${origin}/api/site-admin.php`, { headers: { Cookie: cookie } })).json()).csrf
    const logout = await fetch(`${origin}/api/site-admin.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Admin-CSRF': adminCsrf },
      body: JSON.stringify({ action: 'logout' }),
    })
    assert.equal(logout.status, 200)
    assert.equal((await post(body)).status, 403, 'logout invalidates access to subscriptions')

    const script = path.join(fixture, 'delivery.php')
    await writeFile(script, `<?php
require '${api}/admin-push-lib.php';
adminPushRuntime();
$keys = adminPushVapid();
$sub = ['endpoint' => 'https://web.push.apple.com/encryption-test', 'keys' =>
    ['p256dh' => $keys['publicKey'], 'auth' => rtrim(strtr(base64_encode(str_repeat('a', 16)), '+/', '-_'), '=')],
    'contentEncoding' => 'aes128gcm'];
$history = [];
$mock = new \\GuzzleHttp\\Handler\\MockHandler([new \\GuzzleHttp\\Psr7\\Response(201)]);
$handler = \\GuzzleHttp\\HandlerStack::create($mock);
$handler->push(\\GuzzleHttp\\Middleware::history($history));
$sender = new \\Minishlink\\WebPush\\WebPush(['VAPID' => $keys + ['subject' => 'mailto:admin@example.org']],
    ['TTL' => 3600], 3, ['handler' => $handler]);
$payload = adminPushPayload('signed', '/private-test-route/dashboard');
$report = $sender->sendOneNotification(\\Minishlink\\WebPush\\Subscription::create($sub), $payload);
$request = $history[0]['request'];
$preferences = ['prospect' => true, 'draft' => true, 'signed' => true, 'visit' => true];
adminPushLocked(function ($dir) use ($sub, $preferences) {
    $all = [];
    foreach ([201, 410, 500, 404] as $status) {
        $item = $sub; $item['endpoint'] .= '-' . $status;
        $all[hash('sha256', $item['endpoint'])] = ['subscription' => $item,
            'preferences' => $preferences, 'updatedAt' => 'version'];
    }
    adminPushWrite($dir, 'subscriptions', $all);
    adminPushWrite($dir, 'events', []);
});
$calls = 0;
$delivery = function ($subscription, $message) use (&$calls) {
    $calls++;
    if (str_contains($message, 'test-person') || str_contains($message, 'example.org')) throw new Exception('Private payload');
    return (int) substr($subscription['endpoint'], -3);
};
adminPushDispatch('visit', '2026-11-07:pseudonymous', $delivery);
adminPushDispatch('visit', '2026-11-07:pseudonymous', $delivery);
$afterFirst = $calls;
adminPushDispatch('visit', '2026-11-08:pseudonymous', $delivery);
$state = adminPushLocked(fn ($dir) => adminPushRead($dir, 'subscriptions'));
adminPushDispatch('draft', 'test-quote', function () { throw new RuntimeException('intentional transport failure'); });
echo json_encode(['encrypted' => !str_contains((string) $request->getBody(), 'Paradise'),
    'encoding' => $request->getHeaderLine('Content-Encoding'),
    'authorization' => $request->getHeaderLine('Authorization'),
    'bytes' => $request->getBody()->getSize(), 'success' => $report->isSuccess(),
    'firstCalls' => $afterFirst, 'totalCalls' => $calls, 'remaining' => count($state),
    'businessContinued' => true, 'keysPersistent' => adminPushVapid() === $keys]);
`)
    const result = spawnSync('php', [script], { encoding: 'utf8', env: { ...process.env, XDEBUG_MODE: 'off' } })
    assert.equal(result.status, 0, result.stderr)
    const proof = JSON.parse(result.stdout)
    assert.equal(proof.encrypted, true)
    assert.equal(proof.encoding, 'aes128gcm')
    assert.match(proof.authorization, /^vapid t=eyJ.+, k=/)
    assert.ok(proof.bytes > 100)
    assert.equal(proof.success, true)
    assert.equal(proof.firstCalls, 4)
    assert.equal(proof.totalCalls, 6)
    assert.equal(proof.remaining, 2, '404 and 410 subscriptions removed')
    assert.equal(proof.businessContinued, true)
    assert.equal(proof.keysPersistent, true)
    assert.match(result.stderr, /Delivery failed; HTTP 410/)
    assert.match(result.stderr, /Delivery failed; HTTP 500/)
    assert.match(result.stderr, /Delivery unavailable/)
    assert.doesNotMatch(result.stderr, /encryption-test|pseudonymous|intentional transport failure/)
  } finally {
    if (server) { const done = once(server, 'exit'); server.kill(); await done }
    await rm(fixture, { recursive: true, force: true })
  }
})

test('push worker handles notifications/clicks while closed and never caches private responses', async () => {
  const source = await readFile(path.join(root, 'public/admin-push-sw.js'), 'utf8')
  const listeners = {}
  const notifications = []
  const opened = []
  const context = vm.createContext({ URL, self: {
    location: { origin: 'https://example.org' },
    addEventListener: (name, handler) => { listeners[name] = handler },
    registration: { showNotification: async (...args) => notifications.push(args) },
    clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url), claim: async () => {} },
    skipWaiting: async () => {},
  } })
  vm.runInContext(source, context)
  assert.equal(listeners.fetch, undefined)
  let completed
  listeners.push({ data: { json: () => ({ title: 'Le Paradise', body: 'Un devis a été signé.',
    url: '/private-route/dashboard' }) }, waitUntil: (promise) => { completed = promise } })
  await completed
  assert.equal(notifications.length, 1)
  listeners.notificationclick({ notification: { close() {}, data: notifications[0][1].data },
    waitUntil: (promise) => { completed = promise } })
  await completed
  assert.equal(opened[0], 'https://example.org/private-route/dashboard')
  listeners.push({ data: { json: () => ({ url: '//evil.example/steal' }) },
    waitUntil: (promise) => { completed = promise } })
  await completed
  assert.equal(notifications[1][1].data.url, '/dashboard')
  const manifest = JSON.parse(await readFile(path.join(root, 'public/admin-push.webmanifest'), 'utf8'))
  assert.equal(manifest.display, 'standalone')
  for (const icon of manifest.icons) {
    const file = await readFile(path.join(root, 'public', icon.src))
    assert.equal(file.subarray(1, 4).toString(), 'PNG')
    assert.equal(file.readUInt32BE(16), Number.parseInt(icon.sizes))
  }
  const headers = await readFile(path.join(root, 'public/.htaccess'), 'utf8')
  assert.match(headers, /<Files "admin-push-sw\.js">[\s\S]*?no-cache, no-store/)
  const ui = await readFile(path.join(root, 'src/components/Dashboard/AdminPushControls.jsx'), 'utf8')
  assert.ok(ui.indexOf('Notification.requestPermission()') < ui.indexOf("if (await permission"))
})
