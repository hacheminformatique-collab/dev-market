<?php
// Publish only wedding HTML files and SEO files, using the saved admin PIN.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function failPublication(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function writePublication(string $path, string $content): void {
    $tmp = tempnam(dirname($path), '.publication-');
    if ($tmp === false) {
        failPublication(500, 'Impossible de créer un fichier temporaire. Vérifiez les droits du serveur.');
    }
    if (file_put_contents($tmp, $content, LOCK_EX) === false || !chmod($tmp, 0644) || !rename($tmp, $path)) {
        unlink($tmp);
        failPublication(500, 'Écriture impossible. Vérifiez les droits du dossier de publication.');
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    failPublication(405, 'Méthode non autorisée.');
}

$root = realpath(__DIR__ . '/..');
$settingsFile = $root . '/storage-data/paradise_settings.json';
if (!is_readable($settingsFile)) {
    failPublication(403, 'Enregistrez Mes Infos sur le serveur avant de publier.');
}
$settings = json_decode(file_get_contents($settingsFile), true);
$savedPin = $settings['pin'] ?? null;
$providedPin = $_SERVER['HTTP_X_ADMIN_PIN'] ?? '';
if (!is_string($savedPin) || $savedPin === '' || !hash_equals($savedPin, $providedPin)) {
    failPublication(403, 'Publication non autorisée. Reconnectez-vous avec le code PIN enregistré.');
}

$body = file_get_contents('php://input');
if (strlen($body) > 15 * 1024 * 1024) {
    failPublication(413, 'Page trop volumineuse (maximum 15 Mo). Réduisez la taille de la galerie.');
}
$data = json_decode($body, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    failPublication(400, 'Requête JSON invalide. Vérifiez aussi la limite PHP post_max_size.');
}

if (($data['action'] ?? '') === 'page') {
    $slug = $data['slug'] ?? '';
    $html = $data['html'] ?? '';
    if (!is_string($slug) || strlen($slug) > 120 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug)) {
        failPublication(400, 'Identifiant de ville invalide.');
    }
    if (!is_string($html) || stripos(ltrim($html), '<!doctype html>') !== 0
        || strpos($html, 'id="city-page-data"') === false
        || !preg_match('~<link rel="canonical" href="https?://[^/"]+/locationsalledemariage/' . preg_quote($slug, '~') . '"\s*/?>~', $html)) {
        failPublication(400, 'Document HTML ou canonical invalide.');
    }
    $directory = $root . '/locationsalledemariage';
    if (is_link($directory) || (file_exists($directory) && !is_dir($directory))) {
        failPublication(500, 'Le dossier de publication est invalide.');
    }
    if (!is_dir($directory) && !mkdir($directory, 0755)) {
        failPublication(500, 'Impossible de créer le dossier locationsalledemariage. Vérifiez les droits du serveur.');
    }
    writePublication($directory . '/' . $slug . '.html', $html);
} elseif (($data['action'] ?? '') === 'seo') {
    $sitemap = $data['sitemap'] ?? null;
    $robots = $data['robots'] ?? null;
    if (!is_string($sitemap) || strpos(ltrim($sitemap), '<?xml') !== 0
        || !is_string($robots) || strpos($robots, 'User-agent:') !== 0) {
        failPublication(400, 'Sitemap ou robots.txt invalide.');
    }
    writePublication($root . '/sitemap.xml', $sitemap);
    writePublication($root . '/robots.txt', $robots);
} else {
    failPublication(400, 'Action de publication invalide.');
}

echo json_encode(['ok' => true]);
