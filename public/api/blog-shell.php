<?php
require_once __DIR__ . '/site-guard.php';
siteMaintenanceGuard('blog-shell');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

function failBlogShell(string $message): void {
    error_log('[blog-shell] ' . $message);
    http_response_code(500);
    echo 'Chargement du blog impossible. Vérifiez le déploiement du site.';
    exit;
}

$root = dirname(__DIR__);
$index = file_get_contents($root . '/index.html');
if ($index === false) failBlogShell('index.html inaccessible.');
$path = $root . '/wedding-directory-idf.html';
$directory = is_file($path) ? file_get_contents($path) : '';
if ($directory === false) failBlogShell('Annuaire Île-de-France inaccessible.');
$start = '<!-- WEDDING_DIRECTORY_START -->';
$end = '<!-- WEDDING_DIRECTORY_END -->';
if (substr_count($index, $start) !== 1 || substr_count($index, $end) !== 1
    || strpos($index, $end) < strpos($index, $start)) {
    failBlogShell('Marqueurs de l’annuaire absents ou invalides.');
}
echo substr($index, 0, strpos($index, $start)) . $start
    . "\n<div id=\"public-wedding-directory\">" . $directory . "</div>\n"
    . substr($index, strpos($index, $end));
