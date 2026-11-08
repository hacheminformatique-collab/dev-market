<?php

function siteControlFail(int $status, string $message): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function siteControls(): array {
    $path = dirname(__DIR__) . '/storage-data/site-controls.json';
    if (!is_file($path)) return ['maintenance' => false, 'quoteMaintenance' => false, 'adminSlug' => ''];
    $data = json_decode(file_get_contents($path), true);
    if (!is_array($data) || !is_bool($data['maintenance'] ?? null) || !is_string($data['adminSlug'] ?? null)) {
        siteControlFail(503, 'Configuration du site illisible. Vérifiez le stockage serveur.');
    }
    if (array_key_exists('quoteMaintenance', $data) && !is_bool($data['quoteMaintenance'])) {
        siteControlFail(503, 'Configuration de maintenance des devis illisible.');
    }
    return $data + ['quoteMaintenance' => false];
}

function siteAdminCsrf(): string {
    if (empty($_SESSION['siteAdminCsrf'])) $_SESSION['siteAdminCsrf'] = bin2hex(random_bytes(32));
    return $_SESSION['siteAdminCsrf'];
}

function siteRequireAdminCsrf(): void {
    if (!hash_equals(siteAdminCsrf(), $_SERVER['HTTP_X_ADMIN_CSRF'] ?? '')) {
        siteControlFail(403, 'Jeton de sécurité invalide. Rechargez la page.');
    }
}

function siteAdminPaths(array $controls): array {
    return $controls['adminSlug'] === '' ? ['/admin', '/dashboard']
        : ['/' . $controls['adminSlug'], '/' . $controls['adminSlug'] . '/dashboard'];
}

function siteAdminAuthenticated(bool $acceptPin = true): bool {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Strict',
            'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    }
    $settings = json_decode(@file_get_contents(dirname(__DIR__) . '/storage-data/paradise_settings.json'), true);
    $pin = is_array($settings) ? ($settings['pin'] ?? '') : '';
    if (!is_string($pin) || $pin === '') return false;
    $provided = $_SERVER['HTTP_X_ADMIN_PIN'] ?? '';
    return ($acceptPin && is_string($provided) && $provided !== '' && hash_equals($pin, $provided))
        || hash_equals(hash('sha256', $pin), $_SESSION['siteAdmin'] ?? '');
}

function siteAtomicWrite(string $path, string $contents, int $mode = 0640): void {
    if (is_link($path)) siteControlFail(409, 'Lien de stockage interdit.');
    $tmp = tempnam(dirname($path), '.site-');
    if ($tmp === false) siteControlFail(500, 'Fichier temporaire indisponible.');
    if (file_put_contents($tmp, $contents) !== strlen($contents) || !chmod($tmp, $mode) || !rename($tmp, $path)) {
        if (is_file($tmp)) unlink($tmp);
        siteControlFail(500, 'Écriture serveur impossible.');
    }
}
