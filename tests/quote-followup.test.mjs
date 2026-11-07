import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const phpHelper = path.join(root, 'public/api/quote_followup.php')
const php = (payload) => JSON.parse(execFileSync('php', [
  '-r',
  `require ${JSON.stringify(phpHelper)}; $payload = json_decode(stream_get_contents(STDIN), true); echo json_encode(quote_followup_validate($payload));`,
], { input: JSON.stringify(payload), encoding: 'utf8' }))

function basePayload(overrides = {}) {
  const { summary, ...payloadOverrides } = overrides
  return {
    notificationType: 'quote_followup',
    flowId: '0123456789abcdef0123456789abcdef',
    stage: 1,
    acceptedConditions: true,
    summary: {
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice@example.fr',
      telephone: '0601020304',
      ...summary,
    },
    ...payloadOverrides,
  }
}

test('validates accepted contact information and removes markup/control characters', () => {
  const result = php(basePayload({
    summary: { prenom: '<b>Alice</b>\n<script>', nom: 'Martin' },
  }))
  assert.equal(result.summary.prenom, 'Alice')
  assert.equal(result.stage, 1)
  assert.equal(php(basePayload({ acceptedConditions: false })), false)
  assert.equal(php(basePayload({ summary: { email: 'not-an-email' } })), false)
})

test('allows twenty complete six-stage flows per IP per hour, then releases the limit', async () => {
  const rateFile = path.join(root, `tests/.quote-followup-rate-${process.pid}.json`)
  const script = `require ${JSON.stringify(phpHelper)}; $file = stream_get_contents(STDIN); $results = []; for ($i = 0; $i < 121; $i++) $results[] = quote_followup_rate_allowed($file, 10000); $results[] = quote_followup_retry_after($file, 10000); $results[] = quote_followup_rate_allowed($file, 13601); echo json_encode($results);`
  try {
    const results = JSON.parse(execFileSync('php', ['-r', script], { input: rateFile, encoding: 'utf8' }))
    assert.equal(results.slice(0, 120).every(Boolean), true)
    assert.equal(results[120], false)
    assert.equal(results[121], 3600)
    assert.equal(results[122], true)
  } finally {
    await rm(rateFile, { force: true })
  }
})

test('notify HTTP sends one accepted step, deduplicates retry, and sends cumulative next section', async () => {
  const fixture = path.join(root, `tests/.quote-followup-http-${process.pid}`)
  const webroot = path.join(fixture, 'public')
  const api = path.join(webroot, 'api')
  const storage = path.join(webroot, 'storage-data')
  const mailCapture = path.join(fixture, 'delivered.eml')
  const mailAttempts = path.join(fixture, 'mail-attempts.log')
  const failMarker = path.join(fixture, 'mail-failure')
  const fakeSendmail = path.join(fixture, 'fake-sendmail.cjs')
  const settingsFile = path.join(storage, 'paradise_settings.json')
  let phpServer
  try {
    await rm(fixture, { recursive: true, force: true })
    await mkdir(api, { recursive: true })
    await mkdir(storage, { recursive: true })
    await cp(path.join(root, 'public/api/notify.php'), path.join(api, 'notify.php'))
    await cp(phpHelper, path.join(api, 'quote_followup.php'))
    await cp(path.join(root, 'public/api/prospects.php'), path.join(api, 'prospects.php'))
    await writeFile(fakeSendmail, `#!/usr/bin/env node
const fs = require('node:fs')
let message = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => { message += chunk })
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.QUOTE_MAIL_ATTEMPTS, 'attempt\\n')
  if (fs.existsSync(process.env.QUOTE_MAIL_FAIL)) process.exit(1)
  fs.appendFileSync(process.env.QUOTE_MAIL_CAPTURE, message + '\\n---MAIL---\\n')
})
`)
    await chmod(fakeSendmail, 0o755)
    await writeFile(failMarker, 'fail')
    const settings = {
      pin: 'test-prospects-pin',
      legalInfo: { email: 'owner@example.test' },
    }
    await writeFile(settingsFile, JSON.stringify(settings))

    const httpPort = await new Promise((resolve, reject) => {
      const probe = createServer()
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', () => {
        const port = probe.address().port
        probe.close(() => resolve(port))
      })
    })
    phpServer = spawn('php', ['-d', `sendmail_path=${process.execPath} ${fakeSendmail}`, '-S', `127.0.0.1:${httpPort}`, '-t', webroot], {
      stdio: 'ignore',
      env: {
        ...process.env,
        QUOTE_MAIL_CAPTURE: mailCapture,
        QUOTE_MAIL_ATTEMPTS: mailAttempts,
        QUOTE_MAIL_FAIL: failMarker,
      },
    })
    const endpoint = `http://127.0.0.1:${httpPort}/api/notify.php`
    let ready = false
    for (let attempt = 0; attempt < 40 && !ready; attempt++) {
      try {
        const response = await fetch(endpoint)
        ready = response.status === 405
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
    assert.equal(ready, true, 'PHP test server should start')

    const post = (payload) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const initial = basePayload()
    await writeFile(settingsFile, JSON.stringify({}))
    const unavailable = await post(initial)
    assert.equal(unavailable.status, 503)
    assert.equal((await unavailable.json()).ok, false)
    assert.equal(await readFile(mailAttempts, 'utf8').catch(() => ''), '')
    await writeFile(settingsFile, JSON.stringify(settings))

    const failed = await post(initial)
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { ok: false, error: 'L’envoi du récapitulatif a échoué. Veuillez réessayer.' })
    assert.equal(await readFile(mailCapture, 'utf8').catch(() => ''), '')
    assert.equal((await readFile(mailAttempts, 'utf8')).trim().split('\n').length, 1)

    await rm(failMarker)
    const sent = await post(initial)
    assert.deepEqual(await sent.json(), { ok: true, duplicate: false })
    const retry = await post(initial)
    assert.deepEqual(await retry.json(), { ok: true, duplicate: true })
    let delivered = await readFile(mailCapture, 'utf8')
    assert.equal(delivered.split('---MAIL---').length - 1, 1)
    assert.match(delivered, /To: owner@example\.test/)
    assert.match(delivered, /Coordonnées : Alice Martin/)
    assert.match(delivered, /E-mail : alice@example\.fr/)

    const nextSection = basePayload({
      stage: 2,
      summary: {
        typeEvenement: 'Mariage',
        dateEvenement: '2099-06-12',
        nbAdultes: 120,
        nbEnfants: 20,
      },
    })
    const nextSent = await post(nextSection)
    assert.deepEqual(await nextSent.json(), { ok: true, duplicate: false })
    delivered = await readFile(mailCapture, 'utf8')
    assert.equal(delivered.split('---MAIL---').length - 1, 2)
    assert.match(delivered, /Événement : Mariage/)
    assert.match(delivered, /Participants : 140 \(120 adultes, 20 enfants\)/)
    const prospectEndpoint = `http://127.0.0.1:${httpPort}/api/prospects.php`
    const getProspects = () => fetch(prospectEndpoint, { headers: { 'X-Admin-Pin': settings.pin } }).then((response) => response.json())
    assert.equal((await fetch(prospectEndpoint)).status, 403)
    assert.equal((await fetch(prospectEndpoint, { headers: { 'X-Admin-Pin': 'wrong' } })).status, 403)
    let prospects = await getProspects()
    assert.equal(prospects.prospects.length, 1)
    assert.equal(prospects.prospects[0].flowId, nextSection.flowId)
    assert.equal(prospects.prospects[0].summary.email, 'alice@example.fr')
    assert.equal(prospects.prospects[0].stage, 2)
    // Returning to coordinates must not lower the highest validated section.
    await post(initial)
    assert.equal((await getProspects()).prospects.length, 1)
    await writeFile(path.join(storage, 'paradise_clients.json'), JSON.stringify([{ quoteFlowId: nextSection.flowId, email: 'alice@example.fr', dateEvenement: '2099-06-12' }]))
    assert.equal((await getProspects()).prospects.length, 0, 'Finalized quotes are excluded')
    await writeFile(path.join(storage, 'paradise_clients.json'), '[]')
    const progressed = basePayload({ stage: 3, summary: { ...nextSection.summary, formule: 'Location sèche' } })
    assert.equal((await post(progressed)).status, 200)
    assert.equal((await getProspects()).prospects.length, 0, 'Validating the formula removes the prospect')
    await post(nextSection)
    assert.equal((await getProspects()).prospects.length, 0, 'Back navigation cannot reclassify an advanced quote')

    const rejectedConsent = await post(basePayload({ acceptedConditions: false }))
    assert.equal(rejectedConsent.status, 400)
    assert.equal((await rejectedConsent.json()).ok, false)
    const rejectedData = await post(basePayload({ summary: { email: 'invalid' } }))
    assert.equal(rejectedData.status, 400)
    assert.equal((await rejectedData.json()).ok, false)
    assert.equal((await readFile(mailCapture, 'utf8')).split('---MAIL---').length - 1, 3)

    await writeFile(failMarker, 'fail')
    const newFlow = basePayload({ flowId: 'abcdef0123456789abcdef0123456789' })
    const failedDelivery = await post(newFlow)
    assert.equal(failedDelivery.status, 503)
    assert.equal((await failedDelivery.json()).ok, false)
    await rm(failMarker)
    const retryAfterFailure = await post(newFlow)
    assert.deepEqual(await retryAfterFailure.json(), { ok: true, duplicate: false })
    assert.equal((await readFile(mailCapture, 'utf8')).split('---MAIL---').length - 1, 4)
  } finally {
    if (phpServer) {
      const exited = once(phpServer, 'exit')
      phpServer.kill()
      await exited
    }
    await rm(fixture, { recursive: true, force: true })
  }
})

test('validates each section before accepting a cumulative summary', () => {
  const eventSummary = {
    typeEvenement: 'Mariage',
    dateEvenement: '2099-06-12',
    nbAdultes: 120,
    nbEnfants: 20,
  }
  assert.equal(php(basePayload({ stage: 2, summary: eventSummary })).stage, 2)
  assert.equal(php(basePayload({ stage: 2, summary: { ...eventSummary, nbAdultes: 300 } })), false)
  assert.equal(php(basePayload({ stage: 3, summary: { ...eventSummary, formule: 'Location avec prestation' } })).stage, 3)
  assert.equal(php(basePayload({
    stage: 4,
    summary: {
      ...eventSummary,
      formule: 'Location avec prestation',
      menus: [{ section: 'Entrée', name: 'Salade' }, { section: 'Plats', name: 'Poulet' }],
    },
  })), false)
  assert.equal(php(basePayload({
    stage: 5,
    summary: {
      ...eventSummary,
      formule: 'Location avec prestation',
      menus: [
        { section: 'Entrée', name: 'Salade' },
        { section: 'Plats', name: 'Poulet' },
        { section: 'Desserts', name: 'Fruits' },
      ],
      gateau: 'Gâteau',
    },
  })).summary.gateau, 'Gâteau')
})

test('allows dry-location progression to options without skipped menu and cake steps', () => {
  const result = php(basePayload({
    stage: 6,
    summary: {
      typeEvenement: 'Mariage',
      dateEvenement: '2099-06-12',
      nbAdultes: 80,
      nbEnfants: 0,
      formule: 'Location sèche',
      prestations: ['DJ'],
    },
  }))
  assert.equal(result.summary.prestations[0], 'DJ')
  assert.equal('menus' in result.summary, false)
  assert.equal('gateau' in result.summary, false)
})

test('wizard requires explicit conditions acceptance and sends only on validated progression', async () => {
  const wizard = await readFile(path.join(root, 'src/components/Wizard/WizardForm.jsx'), 'utf8')
  const firstStep = await readFile(path.join(root, 'src/components/Wizard/steps/Step1Client.jsx'), 'utf8')
  const conditions = await readFile(path.join(root, 'src/components/Legal/CGU.jsx'), 'utf8')
  const notify = await readFile(path.join(root, 'public/api/notify.php'), 'utf8')
  assert.match(wizard, /const \[conditionsAccepted, setConditionsAccepted\] = useState\(false\)/)
  assert.match(wizard, /if \(!conditionsAccepted\)/)
  assert.match(wizard, /conditionsAcceptedAt/)
  assert.match(wizard, /siteFetch\('\/api\/notify\.php'/)
  assert.match(wizard, /paced: true/)
  assert.match(wizard, /Réessayer l’envoi/)
  assert.match(wizard, /Continuer sans envoyer le récapitulatif/)
  assert.match(wizard, /setStep\(pendingFollowup\.targetStep\)/)
  assert.match(wizard, /QUOTE_STORAGE_NAMES/)
  assert.match(firstStep, /J’accepte les <a href="\/conditions-generales"/)
  assert.match(conditions, /même si vous ne terminez pas le devis/)
  assert.match(notify, /flock\(\$recordHandle, LOCK_EX\)/)
  assert.match(notify, /quote_followup_rate_allowed\(\$rateFile\)/)
  assert.match(notify, /header\('X-RateLimit-Scope: quote-followup'\)/)
  assert.match(notify, /header\('Retry-After: ' \. quote_followup_retry_after\(\$rateFile\)\)/)
  assert.match(notify, /is_dir\(\$logDir\) && \$notificationType !== 'quote_followup'/)
})
