<?php
ini_set('display_errors', '0');
ini_set('log_errors', '1');
$type = $_GET['type'] ?? null;
$slug = $_GET['slug'] ?? null;
if (!is_string($type) || !in_array($type, ['locationsalledemariage', 'locationsalledereception', 'locationsalleanniversaire', 'locationsallebapteme', 'locationsallefiancaille', 'locationsalleseminaire'], true)
    || !is_string($slug) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug)) {
    http_response_code(404);
    exit;
}
$root = dirname(__DIR__);
$file = $root . '/wedding-city-aliases.json';
$aliases = is_file($file) ? json_decode(file_get_contents($file), true) : [];
if (!is_array($aliases)) {
    error_log('[city-redirect] Registre des anciennes URL invalide.');
    http_response_code(500);
    exit;
}
$target = $aliases[$slug] ?? null;
if (!is_string($target) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{5}$/D', $target)) {
    http_response_code(404);
    exit;
}
header('Location: /' . $type . '/' . $target, true, 301);
exit;
