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
    $directory = $data['directory'] ?? null;
    $slugs = $data['slugs'] ?? null;
    $homeSeo = $data['homeSeo'] ?? null;
    $indexFile = $root . '/index.html';
    $index = is_readable($indexFile) ? file_get_contents($indexFile) : false;
    if (!is_string($directory) || strpos($directory, '<section class="wedding-directory"') !== 0
        || !is_array($slugs) || count($slugs) === 0 || !is_string($homeSeo)
        || strpos($homeSeo, '<title>') !== 0 || strpos($homeSeo, 'rel="canonical"') === false) {
        failPublication(400, 'Annuaire ou liste des pages publiées invalide.');
    }
    foreach ($slugs as $slug) {
        if (!is_string($slug) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug)
            || !is_file($root . '/locationsalledemariage/' . $slug . '.html')) {
            failPublication(400, 'L’annuaire contient une page qui n’a pas été publiée.');
        }
    }
    preg_match_all('~href="/locationsalledemariage/([a-z0-9-]+)"~', $directory, $links);
    $linkedSlugs = $links[1];
    $publishedSlugs = array_values(array_unique($slugs));
    sort($linkedSlugs);
    sort($publishedSlugs);
    if ($linkedSlugs !== $publishedSlugs) {
        failPublication(400, 'Les liens de l’annuaire ne correspondent pas aux pages publiées.');
    }
    $start = '<!-- WEDDING_DIRECTORY_START -->';
    $end = '<!-- WEDDING_DIRECTORY_END -->';
    $seoStart = '<!-- HOME_SEO_START -->';
    $seoEnd = '<!-- HOME_SEO_END -->';
    if ($index === false || substr_count($index, $start) !== 1 || substr_count($index, $end) !== 1
        || strpos($index, $end) < strpos($index, $start)
        || substr_count($index, $seoStart) !== 1 || substr_count($index, $seoEnd) !== 1
        || strpos($index, $seoEnd) < strpos($index, $seoStart)) {
        failPublication(500, 'Modèle index.html incompatible. Déployez le dossier dist complet avant de republier.');
    }
    $index = substr($index, 0, strpos($index, $start)) . $start
        . "\n<div id=\"public-wedding-directory\">" . $directory . "</div>\n"
        . substr($index, strpos($index, $end));
    $index = substr($index, 0, strpos($index, $seoStart)) . $seoStart . "\n" . $homeSeo . "\n"
        . substr($index, strpos($index, $seoEnd));
    writePublication($root . '/wedding-directory.html', $directory);
    writePublication($root . '/wedding-pages.json', json_encode(array_values(array_unique($slugs))));
    writePublication($indexFile, $index);
    writePublication($root . '/sitemap.xml', $sitemap);
    writePublication($root . '/robots.txt', $robots);
} else {
    failPublication(400, 'Action de publication invalide.');
}

echo json_encode(['ok' => true]);
