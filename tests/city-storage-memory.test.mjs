import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const helper = join(root, 'public/api/city-json-stream.php')

function parse(text, pages = true) {
  return JSON.parse(execFileSync('php', ['-d', 'xdebug.mode=off', '-r', `
    require ${JSON.stringify(helper)};
    $stream = fopen('php://temp', 'w+b');
    fwrite($stream, stream_get_contents(STDIN));
    try {
      echo json_encode(['entries' => cityJsonEntries($stream, ${pages ? 'true' : 'false'})]);
    } catch (Throwable $e) { echo json_encode(['error' => get_class($e)]); }
  `], { input: text, encoding: 'utf8' }))
}

test('streamed JSON validation rejects corruption and preserves offsets across buffer boundaries', () => {
  const content = 'é\\" \n'.repeat(20000)
  const text = ` \n${JSON.stringify({ 'ville-75001': { content, nested: [true, false, null, -0.125e20] }, duplicate: null })}\n`
  const result = parse(text)
  assert.equal(result.error, undefined)
  const entry = result.entries['ville-75001']
  assert.deepEqual(JSON.parse(Buffer.from(text).subarray(entry.offset, entry.offset + entry.length)), { content, nested: [true, false, null, -0.125e20] })
  assert.equal(result.entries.duplicate.null, true)
  assert.deepEqual(parse('[]').entries, [])
  assert.equal(parse('[{"snapshot":{"x":{"content":"ok"}}}]', false).entries.length, 1)
  for (const corrupt of [
    '', '{"x":', '{"x":01}', '{"x":1,}', '{"x":[1,]}', '{"x":true false}', '{"x":"\\q"}',
    '{"x":"\\uD800"}', '{"x":"\n"}', '{"x":NaN}', '{"x":{}} garbage', '[{"x":1}]',
    '{"x":['.repeat(520) + '0' + ']}'.repeat(520),
  ]) assert.ok(parse(corrupt).error, `Must reject: ${corrupt.slice(0, 40)}`)
  assert.ok(parse(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125])).error)
})

async function append(output, text) {
  if (!output.write(text)) await once(output, 'drain')
}

async function hashStream(stream) {
  const hash = createHash('sha256')
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest('hex')
}

test('3640 pages and five large backups save, migrate, restore and load below 256 MiB', { timeout: 180000 }, async () => {
  const fixture = await mkdtemp(join(root, 'tests/.city-memory-'))
  const publicDir = join(fixture, 'public')
  const api = join(publicDir, 'api')
  const storage = join(publicDir, 'storage-data')
  const key = 'paradise_city_pages'
  const pagesPath = join(storage, `${key}.json`)
  const backupsPath = join(storage, `${key}_backup.json`)
  const peaksPath = join(fixture, 'peaks.jsonl')
  let server
  try {
    await mkdir(api, { recursive: true })
    await mkdir(storage, { recursive: true })
    for (const name of ['city-page-storage.php', 'city-json-stream.php', 'storage.php', 'site-guard.php', 'site-controls.php']) {
      await cp(join(root, 'public/api', name), join(api, name))
    }
    const memoryHook = join(fixture, 'memory.php')
    await writeFile(memoryHook, `<?php register_shutdown_function(function () {
      file_put_contents(${JSON.stringify(peaksPath)}, json_encode(['uri' => $_SERVER['REQUEST_URI'], 'peak' => memory_get_peak_usage(true)]) . "\\n", FILE_APPEND);
    });`)
    const output = createWriteStream(pagesPath)
    await append(output, '{')
    const content = 'Contenu de mariage conservé. '.repeat(650)
    for (let i = 0; i < 3640; i++) {
      await append(output, `${i ? ',' : ''}${JSON.stringify(`ville-${i}`)}:${JSON.stringify({
        content: `${i} ${content}`, generatedAt: '2026-01-01T00:00:00Z',
        custom: { accent: 'é', escaped: '" \\ \n', reviews: [{ text: 'Conservé' }] },
      })}`)
    }
    await append(output, '}')
    output.end()
    await once(output, 'close')
    const originalHash = await hashStream(createReadStream(pagesPath))
    const archives = createWriteStream(backupsPath)
    await append(archives, '[')
    for (let i = 0; i < 5; i++) {
      await append(archives, `${i ? ',' : ''}{"snapshot":`)
      for await (const chunk of createReadStream(pagesPath)) await append(archives, chunk)
      await append(archives, `,"backedUpAt":"2026-01-0${i + 1}T00:00:00Z"}`)
    }
    await append(archives, ']')
    archives.end()
    await once(archives, 'close')
    assert.throws(() => execFileSync('php', ['-d', 'xdebug.mode=off', '-d', 'memory_limit=256M', '-r', `
      $pages = json_decode(file_get_contents(${JSON.stringify(pagesPath)}));
      $backups = json_decode(file_get_contents(${JSON.stringify(backupsPath)}));
      array_unshift($backups, ['snapshot' => $pages, 'backedUpAt' => gmdate('c')]);
      echo strlen(json_encode(array_slice($backups, 0, 5)));
    `], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), (error) => {
      assert.match(error.stderr, /Allowed memory size of 268435456 bytes exhausted/)
      return true
    })

    const probe = createServer()
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const port = probe.address().port
    await new Promise((resolve) => probe.close(resolve))
    const origin = `http://127.0.0.1:${port}`
    let diagnostics = ''
    server = spawn('php', ['-d', 'xdebug.mode=off', '-d', 'memory_limit=256M', '-d', `auto_prepend_file=${memoryHook}`, '-S', `127.0.0.1:${port}`, '-t', publicDir], { stdio: ['ignore', 'ignore', 'pipe'] })
    server.stderr.on('data', (chunk) => { diagnostics += chunk })
    let ready = false
    for (let i = 0; i < 100; i++) {
      try { await fetch(`${origin}/api/storage.php?key=nonexistent`); ready = true; break } catch { await new Promise((resolve) => setTimeout(resolve, 25)) }
    }
    assert.ok(ready, diagnostics)
    async function operation(action, body) {
      const response = await fetch(`${origin}/api/city-page-storage.php?key=${key}&action=${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      assert.equal(response.status, 200, `${await response.clone().text()}\n${diagnostics}`)
      assert.deepEqual(await response.json(), { ok: true })
    }
    await operation('backup-pages', {})
    assert.equal(await hashStream(createReadStream(pagesPath)), originalHash)
    const summary = JSON.parse(execFileSync('php', ['-d', 'xdebug.mode=off', '-d', 'memory_limit=256M', '-r', `
      require ${JSON.stringify(helper)};
      $file = fopen(${JSON.stringify(backupsPath)}, 'rb');
      $entries = cityJsonEntries($file, false);
      $dates = [];
      foreach ($entries as $entry) {
        fseek($file, $entry['offset'] + $entry['length'] - 64);
        $tail = fread($file, 64);
        preg_match('/"backedUpAt":"([^"]+)"/', $tail, $match);
        $dates[] = $match[1];
      }
      fseek($file, $entries[0]['offset'] + strlen('{"snapshot":'));
      $hash = hash_init('sha256');
      hash_update_stream($hash, $file, filesize(${JSON.stringify(pagesPath)}));
      echo json_encode(['count' => count($entries), 'snapshotHash' => hash_final($hash), 'dates' => $dates, 'bytes' => filesize(${JSON.stringify(backupsPath)}), 'peak' => memory_get_peak_usage(true)]);
    `], { encoding: 'utf8' }))
    assert.equal(summary.count, 5)
    assert.equal(summary.snapshotHash, originalHash)
    assert.ok(summary.bytes > 256 * 1024 * 1024, 'Backup fixture must exceed the server memory limit')
    assert.deepEqual(summary.dates.slice(1), ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z', '2026-01-04T00:00:00Z'])
    assert.ok(summary.peak < 32 * 1024 * 1024)

    const page = { content: 'Page ajoutée', generatedAt: '2026-11-08T00:00:00Z' }
    await operation('save-page', { slug: 'meaux-77100', page })
    await operation('migrate-pages', { aliases: { 'ville-0': 'ville-0-75001', 'ville-1': 'ville-1-75002' } })
    const migrated = JSON.parse(execFileSync('php', ['-d', 'xdebug.mode=off', '-d', 'memory_limit=256M', '-r', `
      require ${JSON.stringify(helper)};
      $file = fopen(${JSON.stringify(pagesPath)}, 'rb');
      $entries = cityJsonEntries($file, true);
      $values = [];
      foreach (['meaux-77100', 'ville-0-75001', 'ville-1-75002', 'ville-2'] as $key) {
        fseek($file, $entries[$key]['offset']);
        $values[$key] = json_decode(fread($file, $entries[$key]['length']), true);
      }
      echo json_encode(['count' => count($entries), 'oldPresent' => isset($entries['ville-0']) || isset($entries['ville-1']), 'values' => $values]);
    `], { encoding: 'utf8' }))
    assert.equal(migrated.count, 3641)
    assert.equal(migrated.oldPresent, false)
    assert.deepEqual(migrated.values['meaux-77100'], page)
    for (const [key, i] of [['ville-0-75001', 0], ['ville-1-75002', 1], ['ville-2', 2]]) {
      assert.equal(migrated.values[key].content, `${i} ${content}`)
      assert.deepEqual(migrated.values[key].custom, { accent: 'é', escaped: '" \\ \n', reviews: [{ text: 'Conservé' }] })
    }
    const loaded = await fetch(`${origin}/api/storage.php?key=${key}`)
    assert.equal(loaded.status, 200)
    const savedHash = await hashStream(createReadStream(pagesPath))
    assert.equal(await hashStream(loaded.body), savedHash)
    const restored = await fetch(`${origin}/api/storage.php?key=${key}`, {
      method: 'POST', body: createReadStream(pagesPath), duplex: 'half', headers: { 'Content-Type': 'application/json' },
    })
    assert.equal(restored.status, 200, await restored.text())
    assert.equal(await hashStream(createReadStream(pagesPath)), savedHash)
    const backups = await fetch(`${origin}/api/storage.php?key=${key}_backup`)
    assert.equal(backups.status, 200)
    assert.equal(await hashStream(backups.body), await hashStream(createReadStream(backupsPath)))
    const restoreBackups = await fetch(`${origin}/api/storage.php?key=${key}_backup`, {
      method: 'POST', body: createReadStream(backupsPath), duplex: 'half', headers: { 'Content-Type': 'application/json' },
    })
    assert.equal(restoreBackups.status, 200, await restoreBackups.text())
    const peaks = (await readFile(peaksPath, 'utf8')).trim().split('\n').map(JSON.parse)
    assert.ok(peaks.length >= 8)
    assert.ok(peaks.every(({ peak }) => peak < 32 * 1024 * 1024), JSON.stringify(peaks))

    await writeFile(backupsPath, '[{"snapshot":invalid}]')
    const denied = await fetch(`${origin}/api/city-page-storage.php?key=${key}&action=backup-pages`, { method: 'POST', body: '{}' })
    assert.equal(denied.status, 409)
    assert.equal(await readFile(backupsPath, 'utf8'), '[{"snapshot":invalid}]')
    assert.equal(await hashStream(createReadStream(pagesPath)), savedHash)
  } finally {
    if (server && server.exitCode === null) {
      server.kill()
      await once(server, 'exit')
    }
    await rm(fixture, { recursive: true, force: true })
  }
})
