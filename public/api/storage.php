<?php
require_once __DIR__ . '/site-guard.php';
siteMaintenanceGuard('storage');
/**
 * storage.php – Shared JSON key-value store for the Paradise application.
 *
 * GET  /api/storage.php?key=<key>  → returns the stored JSON (or null)
 * POST /api/storage.php?key=<key>  → writes the JSON body and returns {"ok":true}
 *
 * Data files are written to ../storage-data/<key>.json (one level up from this
 * script, i.e. alongside the api/ folder in the deployed output).
 * That directory is protected from direct browser access by its own .htaccess.
 */

header('Content-Type: application/json; charset=utf-8');

// ── CORS headers (same-origin requests only in production) ──────────────────
// Uncomment and adjust the line below only if you host the API on a different
// origin than the front-end (not needed for standard deployments).
// header('Access-Control-Allow-Origin: https://yourdomain.com');

// ── Key validation ───────────────────────────────────────────────────────────
$key = isset($_GET['key']) ? (string) $_GET['key'] : '';
if (!preg_match('/^[a-zA-Z0-9_]{1,120}$/', $key)) {
    http_response_code(400);
    echo json_encode(null);
    exit;
}

// ── Data directory ───────────────────────────────────────────────────────────
$dataDir = realpath(__DIR__ . '/..') . '/storage-data';

// Create directory if it doesn't exist yet (chmod 0750: owner rwx, group rx)
if (!is_dir($dataDir)) {
    if (!mkdir($dataDir, 0750, true)) {
        http_response_code(500);
        echo json_encode(null);
        exit;
    }
    // Drop a protective .htaccess so Apache blocks direct HTTP access
    file_put_contents($dataDir . '/.htaccess', "Require all denied\n");
}

$file = $dataDir . '/' . $key . '.json';

// ── GET ──────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (is_file($file) && is_readable($file)) {
        $raw = file_get_contents($file);
        // Validate the stored content is still valid JSON before sending it
        json_decode($raw);
        if (json_last_error() === JSON_ERROR_NONE) {
            if ($key === 'paradise_settings' && !siteAdminAuthenticated(false)) {
                $settings = json_decode($raw, true);
                if (is_array($settings)) unset($settings['pin']);
                echo json_encode($settings, JSON_UNESCAPED_UNICODE);
            } else {
                echo $raw;
            }
        } else {
            echo json_encode(null);
        }
    } else {
        echo json_encode(null);
    }
    exit;
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($key === 'paradise_settings' && is_file($file) && !siteAdminAuthenticated(false)) {
        siteControlFail(403, 'Modification des réglages refusée. Reconnectez-vous.');
    }
    $lock = fopen($file . '.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) {
        http_response_code(500);
        echo json_encode(['error' => 'Storage lock failed']);
        exit;
    }
    $body = file_get_contents('php://input');

    // Validate incoming payload is well-formed JSON
    json_decode($body);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }

    // Atomic write: write to a temp file then rename to avoid partial reads
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $body, LOCK_EX) !== strlen($body)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['error' => 'Write failed']);
        exit;
    }
    if (!rename($tmp, $file)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['error' => 'Rename failed']);
        exit;
    }

    if ($key === 'paradise_settings' && session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['siteAdmin'])) {
        $saved = json_decode($body, true);
        if (is_string($saved['pin'] ?? null)) $_SESSION['siteAdmin'] = hash('sha256', $saved['pin']);
    }
    echo json_encode(['ok' => true]);
    exit;
}

// ── Unsupported method ────────────────────────────────────────────────────────
http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['error' => 'Method not allowed']);
