<?php
/**
 * favicon-write.php – Generate and write favicon files to the document root.
 *
 * POST /api/favicon-write.php
 *   Body (JSON): { "favicon32": "<base64-png>", "favicon64": "<base64-png>" }
 *   Response:    { "ok": true }  or  { "error": "..." }
 *
 * Writes favicon.ico (32×32 PNG) and favicon-64.png (64×64 PNG) directly to
 * the document root (one level up from this script).
 * Only these two filenames are allowed; no other paths are accepted.
 */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$b32 = isset($data['favicon32']) ? (string) $data['favicon32'] : null;
$b64 = isset($data['favicon64']) ? (string) $data['favicon64'] : null;

if ($b32 === null && $b64 === null) {
    http_response_code(400);
    echo json_encode(['error' => 'No favicon data provided']);
    exit;
}

// Document root = one level up from the api/ directory
$rootDir = realpath(__DIR__ . '/..');
if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Cannot resolve document root']);
    exit;
}

/**
 * Atomically write binary $content to $path using a temp file + rename.
 * Returns true on success, false on failure.
 */
function atomicWriteBinary(string $path, string $content): bool {
    $tmp = $path . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $content, LOCK_EX) === false) {
        return false;
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

// PNG magic bytes
define('PNG_MAGIC', "\x89PNG\r\n\x1a\n");

$errors = [];

if ($b32 !== null) {
    $bin32 = base64_decode($b32, true);
    if ($bin32 === false || substr($bin32, 0, 8) !== PNG_MAGIC) {
        $errors[] = 'favicon32 is not a valid PNG';
    } elseif (!atomicWriteBinary($rootDir . '/favicon.ico', $bin32)) {
        $errors[] = 'favicon.ico write failed';
    }
}

if ($b64 !== null) {
    $bin64 = base64_decode($b64, true);
    if ($bin64 === false || substr($bin64, 0, 8) !== PNG_MAGIC) {
        $errors[] = 'favicon64 is not a valid PNG';
    } elseif (!atomicWriteBinary($rootDir . '/favicon-64.png', $bin64)) {
        $errors[] = 'favicon-64.png write failed';
    }
}

if (!empty($errors)) {
    http_response_code(500);
    echo json_encode(['error' => implode('; ', $errors)]);
    exit;
}

echo json_encode(['ok' => true]);
