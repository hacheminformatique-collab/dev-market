<?php
require_once __DIR__ . '/site-controls.php';
$controls = siteControls();
$route = $_GET['route'] ?? '';
if (!is_string($route)) siteControlFail(400, 'Adresse invalide.');
$path = '/' . $route;
[$login, $dashboard] = siteAdminPaths($controls);
$isAdmin = $path === $login || $path === $dashboard;
header('Cache-Control: no-store');
if ($controls['quoteMaintenance'] && rtrim($path, '/') === '/devis') {
    http_response_code(503);
    header('Retry-After: 3600');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Maintenance devis</title><h1>Maintenance devis</h1><p>Les nouvelles demandes sont temporairement suspendues. Vos devis existants et leur signature restent accessibles.</p><a href="/">Accueil</a> <a href="/espace-client">Espace client</a></html>';
    exit;
}
if (($controls['maintenance'] || is_file(dirname(__DIR__) . '/site-maintenance.flag'))
    && $path !== '/' && !$isAdmin) {
    http_response_code(503);
    header('Retry-After: 3600');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Maintenance — Le Paradise</title><h1>Site en maintenance</h1><p>Cette page est momentanément indisponible.</p><a href="/">Retour à l’accueil</a></html>';
    exit;
}
if ($controls['adminSlug'] !== '' && in_array(rtrim($path, '/'), ['/admin', '/dashboard'], true)) {
    http_response_code(404);
    echo 'Page introuvable.';
    exit;
}
if (preg_match('~^/locationsalledemariage/[a-z0-9-]+(?:\.html|/)?$~D', $path)) {
    http_response_code(404);
    echo 'Page non publiée.';
    exit;
}
$root = dirname(__DIR__);
$html = file_get_contents($root . '/index.html');
if ($html === false) siteControlFail(503, 'Page d’accueil indisponible.');
if ($isAdmin) {
    header('X-Robots-Tag: noindex, nofollow, noarchive');
    $html = preg_replace('/<meta name="robots" content="[^"]*"[^>]*>/', '<meta name="robots" content="noindex, nofollow, noarchive">', $html);
    $config = json_encode(['login' => $login, 'dashboard' => $dashboard], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES);
    $html = str_replace('</head>', '<script id="admin-route" type="application/json">' . $config . '</script></head>', $html);
}
if ($controls['maintenance']) $html = str_replace('</head>', '<script id="site-maintenance" type="application/json">true</script></head>', $html);
header('Content-Type: text/html; charset=utf-8');
echo $html;
