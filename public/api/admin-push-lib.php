<?php
// No request exits here: push failures must never change business responses.
require_once __DIR__ . '/site-controls.php';

function adminPushDirectory(): string {
    $base = dirname(__DIR__) . '/storage-data';
    $dir = $base . '/admin-push';
    foreach ([$base, $dir] as $path) {
        if (is_link($path) || (!is_dir($path) && !@mkdir($path, 0700, true) && !is_dir($path))) {
            throw new RuntimeException('Push storage unavailable');
        }
    }
    $deny = $dir . '/.htaccess';
    if (is_link($deny) || (is_file($deny) && trim((string) file_get_contents($deny)) !== 'Require all denied')) {
        throw new RuntimeException('Push storage protection invalid');
    }
    if (!is_file($deny) && file_put_contents($deny, "Require all denied\n", LOCK_EX) === false) {
        throw new RuntimeException('Push storage protection unavailable');
    }
    return $dir;
}

function adminPushLocked(callable $action): mixed {
    $dir = adminPushDirectory();
    $path = $dir . '/state.lock';
    if (is_link($path)) throw new RuntimeException('Push lock invalid');
    $lock = fopen($path, 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Push lock unavailable');
    try { return $action($dir); }
    finally { flock($lock, LOCK_UN); fclose($lock); }
}

function adminPushRead(string $dir, string $name, array $default = []): array {
    $path = $dir . '/' . $name . '.json';
    if (is_link($path)) throw new RuntimeException('Push state invalid');
    if (!is_file($path)) return $default;
    $data = json_decode((string) file_get_contents($path), true);
    if (!is_array($data)) throw new RuntimeException('Push state unreadable');
    return $data;
}

function adminPushWrite(string $dir, string $name, array $data): void {
    $path = $dir . '/' . $name . '.json';
    if (is_link($path)) throw new RuntimeException('Push state invalid');
    $scratch = $dir . '/.write-' . bin2hex(random_bytes(12));
    try {
        $json = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($scratch, $json, LOCK_EX) !== strlen($json)
            || !chmod($scratch, 0600) || !rename($scratch, $path)) {
            throw new RuntimeException('Push state write failed');
        }
    } finally { if (is_file($scratch)) unlink($scratch); }
}

function adminPushRuntime(): void {
    if (PHP_VERSION_ID < 80200 || !extension_loaded('curl') || !extension_loaded('openssl') || !extension_loaded('mbstring')) {
        throw new RuntimeException('Push requires PHP 8.2+, curl, openssl and mbstring');
    }
    require_once __DIR__ . '/push-runtime/vendor/autoload.php';
}

function adminPushVapid(): array {
    adminPushRuntime();
    return adminPushLocked(function ($dir) {
        $keys = adminPushRead($dir, 'vapid');
        if (!$keys) {
            $keys = \Minishlink\WebPush\VAPID::createVapidKeys();
            adminPushWrite($dir, 'vapid', $keys);
        }
        if (!is_string($keys['publicKey'] ?? null) || !is_string($keys['privateKey'] ?? null)) {
            throw new RuntimeException('VAPID keys invalid; do not silently rotate keys');
        }
        return $keys;
    });
}

function adminPushEndpoint(mixed $endpoint): array {
    if (!is_string($endpoint) || strlen($endpoint) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $endpoint)) {
        throw new InvalidArgumentException('Invalid push endpoint');
    }
    $url = parse_url($endpoint);
    $host = strtolower($url['host'] ?? '');
    if (!$url || ($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass'])
        || isset($url['fragment']) || (isset($url['port']) && $url['port'] !== 443)
        || !preg_match('~^(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)?push\.apple\.com)$~D', $host)
        || empty($url['path']) || $url['path'] === '/') {
        throw new InvalidArgumentException('Unsupported push provider or endpoint');
    }
    return $url;
}

function adminPushAddresses(string $host): array {
    $records = dns_get_record($host, DNS_A | DNS_AAAA);
    $addresses = [];
    foreach ($records ?: [] as $record) {
        $ip = $record['ip'] ?? $record['ipv6'] ?? '';
        if ($ip === '') continue;
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)
            || str_starts_with(strtolower($ip), '::ffff:')) {
            throw new RuntimeException('Push DNS resolved a non-public address');
        }
        $addresses[] = $ip;
    }
    if (!$addresses) throw new RuntimeException('Push provider DNS unavailable');
    return array_unique($addresses);
}

function adminPushDecode(mixed $value, int $length): string {
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]+={0,2}$/D', $value)) {
        throw new InvalidArgumentException('Invalid subscription key');
    }
    $bytes = base64_decode(strtr($value, '-_', '+/'), true);
    if ($bytes === false || strlen($bytes) !== $length) throw new InvalidArgumentException('Invalid subscription key size');
    return $bytes;
}

function adminPushSubscription(mixed $input): array {
    if (!is_array($input) || !is_array($input['keys'] ?? null)) throw new InvalidArgumentException('Subscription required');
    adminPushEndpoint($input['endpoint'] ?? null);
    $point = adminPushDecode($input['keys']['p256dh'] ?? null, 65);
    adminPushDecode($input['keys']['auth'] ?? null, 16);
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(
        hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $point
    ), 64, "\n") . "-----END PUBLIC KEY-----\n";
    if ($point[0] !== "\x04" || !openssl_pkey_get_public($pem)) throw new InvalidArgumentException('Invalid P-256 key');
    return ['endpoint' => $input['endpoint'], 'keys' => [
        'p256dh' => rtrim($input['keys']['p256dh'], '='), 'auth' => rtrim($input['keys']['auth'], '='),
    ], 'contentEncoding' => 'aes128gcm'];
}

function adminPushPreferences(mixed $input): array {
    $defaults = ['prospect' => true, 'draft' => true, 'signed' => true, 'visit' => false];
    if (!is_array($input)) throw new InvalidArgumentException('Preferences required');
    foreach ($defaults as $key => $_) {
        if (!is_bool($input[$key] ?? null)) throw new InvalidArgumentException('Invalid push preference');
        $defaults[$key] = $input[$key];
    }
    return $defaults;
}

function adminPushPayload(string $event, string $dashboard): string {
    $text = ['prospect' => 'Un nouveau prospect est disponible.', 'draft' => 'Un nouveau devis non signé est disponible.',
        'signed' => 'Un devis a été signé.', 'visit' => 'Une nouvelle visite a été enregistrée.'];
    if (!isset($text[$event])) throw new InvalidArgumentException('Unknown push event');
    return json_encode(['title' => 'Le Paradise — Administration', 'body' => $text[$event],
        'url' => $dashboard, 'tag' => 'paradise-' . $event], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
}

// The injectable transport is used only by PHP tests, never selected through HTTP or environment input.
function adminPushDispatch(string $event, string $eventId, ?callable $transport = null): void {
    try {
        $textEvents = ['prospect', 'draft', 'signed', 'visit'];
        if (!in_array($event, $textEvents, true)) throw new InvalidArgumentException('Unknown push event');
        $batch = adminPushLocked(function ($dir) use ($event, $eventId) {
            $subscriptions = adminPushRead($dir, 'subscriptions');
            $eligible = array_filter($subscriptions, fn ($s) => ($s['preferences'][$event] ?? false) === true);
            if (!$eligible) return [];
            $events = adminPushRead($dir, 'events');
            $now = time();
            $events = array_filter($events, fn ($expiry) => is_int($expiry) && $expiry > $now);
            $id = hash('sha256', $event . ':' . $eventId);
            if (isset($events[$id])) return [];
            // Claim before delivery: at most one attempt even on provider failure or concurrent requests.
            $events[$id] = $now + ($event === 'visit' ? 172800 : 604800);
            if (count($events) > 60000) throw new RuntimeException('Push daily event capacity exceeded');
            adminPushWrite($dir, 'events', $events);
            return $eligible;
        });
        if (!$batch) return;
        // Read directly rather than siteControls(), whose error handler exits the business request.
        $path = dirname(__DIR__) . '/storage-data/site-controls.json';
        $controls = is_file($path) ? json_decode((string) file_get_contents($path), true) : ['adminSlug' => ''];
        if (!is_array($controls) || !is_string($controls['adminSlug'] ?? null)
            || ($controls['adminSlug'] !== '' && !preg_match('/^[a-z][a-z0-9-]{7,79}$/D', $controls['adminSlug']))) {
            throw new RuntimeException('Push dashboard configuration invalid');
        }
        $dashboard = $controls['adminSlug'] === '' ? '/dashboard' : '/' . $controls['adminSlug'] . '/dashboard';
        $payload = adminPushPayload($event, $dashboard);
        $expired = [];
        if ($transport) {
            foreach ($batch as $id => $entry) {
                $status = $transport($entry['subscription'], $payload);
                if (in_array($status, [404, 410], true)) $expired[] = $id;
                if ($status < 200 || $status >= 300) error_log('[admin-push] Delivery failed; HTTP ' . (int) $status);
            }
        } else {
            $keys = adminPushVapid();
            $resolve = [];
            foreach ($batch as $entry) {
                $url = adminPushEndpoint($entry['subscription']['endpoint'] ?? null);
                $host = strtolower($url['host']);
                foreach (adminPushAddresses($host) as $ip) {
                    $resolve[$host] = $host . ':443:' . (str_contains($ip, ':') ? '[' . $ip . ']' : $ip);
                    break;
                }
            }
            $settings = json_decode((string) @file_get_contents(dirname(__DIR__) . '/storage-data/paradise_settings.json'), true);
            $email = $settings['legalInfo']['email'] ?? $settings['email'] ?? '';
            $site = $settings['siteUrl'] ?? '';
            $subject = filter_var($email, FILTER_VALIDATE_EMAIL) ? 'mailto:' . $email
                : (is_string($site) && str_starts_with($site, 'https://') ? $site : '');
            if ($subject === '') throw new RuntimeException('Set a valid contact email or HTTPS site URL for VAPID');
            $sender = new \Minishlink\WebPush\WebPush(['VAPID' => $keys + ['subject' => $subject]],
                ['TTL' => 3600, 'urgency' => 'normal', 'batchSize' => 10], 4,
                ['connect_timeout' => 2, 'allow_redirects' => false, 'proxy' => '',
                    'curl' => [CURLOPT_RESOLVE => array_values($resolve)]]);
            $requestIds = [];
            foreach ($batch as $id => $entry) {
                $requestIds[(string) new \GuzzleHttp\Psr7\Uri($entry['subscription']['endpoint'])] = $id;
                $sender->queueNotification(\Minishlink\WebPush\Subscription::create($entry['subscription']), $payload);
            }
            foreach ($sender->flush() as $report) {
                if ($report->isSubscriptionExpired()) {
                    $expired[] = $requestIds[$report->getEndpoint()] ?? hash('sha256', $report->getEndpoint());
                }
                if (!$report->isSuccess()) {
                    error_log('[admin-push] Delivery failed; HTTP ' . ($report->getResponse()?->getStatusCode() ?? 'transport'));
                }
            }
        }
        if ($expired) adminPushLocked(function ($dir) use ($expired, $batch) {
            $current = adminPushRead($dir, 'subscriptions');
            foreach ($expired as $id) {
                if (($current[$id]['updatedAt'] ?? null) === ($batch[$id]['updatedAt'] ?? null)) unset($current[$id]);
            }
            adminPushWrite($dir, 'subscriptions', $current);
        });
    } catch (Throwable $error) {
        // Do not log endpoints, payloads, key material or provider response bodies.
        error_log('[admin-push] Delivery unavailable (' . get_class($error) . '). Check PHP extensions, denied storage, VAPID contact and outbound HTTPS.');
    }
}
