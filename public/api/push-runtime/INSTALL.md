# Admin Web Push runtime

This directory vendors **minishlink/web-push 10** and its runtime dependencies.
Encryption (RFC 8291 `aes128gcm`) and VAPID signing are performed by the maintained
library, not by application cryptographic code. Package licenses are retained
inside `vendor/`; `composer.lock` pins the installed versions.

## Build/update on a development computer

From this directory, with Composer and PHP available:

```sh
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
composer audit --no-dev
```

For an intentional dependency update use `composer update --no-dev` and rerun the
audit and repository `tests/admin-push.test.mjs`. Never run updates automatically
on shared hosting. The host **does not need Composer**: upload the complete built
`dist/`, including `api/push-runtime/vendor/` and its `.htaccess`. Vite copies the
runtime from `public/` into `dist/`.

## Hosting requirements and first activation

* PHP **8.2+**, extensions **curl, openssl, mbstring**, normal session support and
  OpenSSL P-256/ECDH capability. Verified development CLI: PHP 8.5.12 with these
  extensions; the shared host has not been probed.
* HTTPS with a valid certificate, Apache `AllowOverride` for `Require all denied`,
  `mod_headers`, `mod_rewrite` and the service worker cache exception in the root
  `.htaccess`. Denial of `storage-data/admin-push/` and `api/push-runtime/` must
  return **403**, including directly addressed JSON/vendor files. Do not use PHP's
  development server publicly: it does not enforce `.htaccess`.
* Writable `public/storage-data/admin-push/` (the deployed directory is
  `storage-data/admin-push/`), owned by the PHP user. JSON key/subscription/event
  files are mode 0600, excluded from Git and must never be served or copied into
  an unprotected backup. VAPID private keys are generated and persisted only here
  on the first authenticated configuration request. Keep the same keys across
  redeployments: deleting/rotating them requires re-subscribing every device.
* A valid contact email in Mes infos (general or legal email), or a valid HTTPS
  site URL, is required for VAPID delivery. Outbound DNS and HTTPS port 443 to
  Apple (`push.apple.com` or one subdomain), `fcm.googleapis.com`, and
  `updates.push.services.mozilla.com`. Other providers are intentionally rejected.
  Validated public DNS addresses are pinned for cURL delivery, HTTPS redirects
  and proxies are disabled. Maximum ten devices, four-second batch HTTP timeout.
* iPhone/iPad **iOS/iPadOS 16.4+**: log in in Safari, go to **Mes infos**, then
  Share → **Add to Home Screen**. Open the installed app, log in again if needed,
  return to Mes infos, press **Activer** and accept the OS permission dialog.
  Permission is requested directly from the button gesture, not on page load.
  Desktop Chromium/Firefox also support activation. Each installed device has
  independent server-side preferences. Visits default off.

The authenticated manifest loaded in Mes infos has the current private dashboard
as `start_url`; the public fallback manifest starts at `/` and reveals no private
path. Notifications contain only generic text and the private dashboard URL;
the URL never includes a client identity, quote number or access token. Existing
dashboard/session authorization remains required on opening.

## Delivery and limitations

Prospect alerts follow persisted stage-2 quote progress; draft/signed alerts
follow existing notification requests; optional visits follow accepted analytics
records. No cron, polling, background delivery process or page-open requirement.
The service worker handles real encrypted pushes while the app is closed and has
**no fetch handler/cache**. Delivery is synchronous, bounded and best effort.
Failures are explicitly written to the PHP error log with generic status, never
private payloads/endpoints. They do not alter quote/email/analytics results.
404/410 subscriptions are removed. Events are claimed before sending to prevent
duplicate attempts (one per pseudonymous visitor per Paris date for visits);
failed attempts are not retried automatically. Quote/prospect deduplication lasts
seven days. Expired event markers are cleaned lazily on incoming events.

After changing the private admin address, reinstall/update the Home Screen app
to refresh its launch URL. New push messages always use the current dashboard
path; previously delivered notifications may still point to the old path.
OS permission revocation, app removal, Focus/Do Not Disturb, offline devices or
provider throttling can prevent/delay delivery. A push subscription is not revoked
by logging out (opt-in remains until disabled); notifications remain generic and
opening private data still requires admin authentication.

Targeted tests use HTTP sessions/CSRF, validate subscription keys/URLs, verify
real library-generated encrypted requests and VAPID headers through Guzzle's
mock HTTP transport, and exercise provider errors/expiry/deduplication.
**No live push subscription or iPhone has been used to verify real delivery.**
The deployment acceptance test is to activate on an installed iPhone, close the
app, create a prospect/draft/signature, verify the OS alert and authenticated
dashboard click, then disable and verify no subsequent delivery.
