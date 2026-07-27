<?php
/**
 * seo-write.php – Write sitemap.xml and robots.txt directly to the document root.
 *
 * POST /api/seo-write.php
 *   Body (JSON): { "sitemap": "<xml content>", "robots": "<robots content>" }
 *   Response:    { "ok": true }  or  { "error": "..." }
 *
 * Files are written one level up from this script (i.e. the public / document
 * root): sitemap.xml and robots.txt.
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

$sitemap = isset($data['sitemap']) ? (string) $data['sitemap'] : null;
$robots  = isset($data['robots'])  ? (string) $data['robots']  : null;

if ($sitemap === null && $robots === null) {
    http_response_code(400);
    echo json_encode(['error' => 'No file content provided']);
    exit;
}

// Basic content validation
if ($sitemap !== null && strpos(ltrim($sitemap), '<?xml') !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid sitemap content (must start with <?xml)']);
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
 * Atomically write $content to $path using a temp file + rename.
 * Returns true on success, false on failure.
 */
function atomicWrite(string $path, string $content): bool {
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

$errors = [];

if ($sitemap !== null) {
    if (!atomicWrite($rootDir . '/sitemap.xml', $sitemap)) {
        $errors[] = 'sitemap.xml write failed';
    }
}

if ($robots !== null) {
    if (!atomicWrite($rootDir . '/robots.txt', $robots)) {
        $errors[] = 'robots.txt write failed';
    }
}

if (!empty($errors)) {
    http_response_code(500);
    echo json_encode(['error' => implode('; ', $errors)]);
    exit;
}

echo json_encode(['ok' => true]);
