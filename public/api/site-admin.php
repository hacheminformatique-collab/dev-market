<?php
require_once __DIR__ . '/site-controls.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'POST' ? json_decode(file_get_contents('php://input'), true) : [];
if ($method === 'POST' && !is_array($data)) siteControlFail(400, 'Requête invalide.');
$directory = dirname(__DIR__) . '/storage-data';
if (!is_dir($directory) && !mkdir($directory, 0750, true)) siteControlFail(500, 'Stockage indisponible.');
if (!is_file($directory . '/.htaccess')) siteAtomicWrite($directory . '/.htaccess', "Require all denied\n");

if ($method === 'POST' && ($data['action'] ?? '') === 'login') {
    siteAdminAuthenticated();
    $settings = json_decode(@file_get_contents($directory . '/paradise_settings.json'), true);
    $pin = $settings['pin'] ?? '';
    $attemptPath = $directory . '/admin-attempt-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '') . '.json';
    $lock = fopen($attemptPath . '.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) siteControlFail(503, 'Vérification des accès indisponible.');
    $attempt = is_file($attemptPath) ? json_decode(file_get_contents($attemptPath), true) : ['count' => 0, 'until' => 0];
    if (!is_array($attempt)) siteControlFail(503, 'Historique des accès illisible.');
    if (($attempt['until'] ?? 0) > time()) {
        header('X-RateLimit-Scope: admin-login');
        siteControlFail(429, 'Trop de tentatives. Réessayez dans dix minutes.');
    }
    if (!is_string($data['pin'] ?? null) || !is_string($pin) || $pin === '' || !hash_equals($pin, $data['pin'])) {
        $count = ($attempt['count'] ?? 0) + 1;
        siteAtomicWrite($attemptPath, json_encode(['count' => $count >= 3 ? 0 : $count, 'until' => $count >= 3 ? time() + 600 : 0]));
        siteControlFail(403, 'Code PIN incorrect.');
    }
    siteAtomicWrite($attemptPath, json_encode(['count' => 0, 'until' => 0]));
    session_regenerate_id(true);
    $_SESSION['siteAdmin'] = hash('sha256', $pin);
    echo json_encode(['ok' => true]);
    exit;
}

if (!siteAdminAuthenticated(false)) siteControlFail(403, 'Accès administrateur refusé. Reconnectez-vous.');
if ($method === 'GET') {
    echo json_encode(['ok' => true, 'controls' => siteControls()]);
    exit;
}
if ($method !== 'POST') siteControlFail(405, 'Méthode non autorisée.');
if (($data['action'] ?? '') === 'logout') {
    unset($_SESSION['siteAdmin']);
    echo json_encode(['ok' => true]);
    exit;
}
if (($data['action'] ?? '') !== 'save') siteControlFail(400, 'Action inconnue.');
$lock = fopen($directory . '/site-controls.json.lock', 'c+');
if (!$lock || !flock($lock, LOCK_EX)) siteControlFail(503, 'Verrou des réglages indisponible.');
$controls = siteControls();
if (array_key_exists('maintenance', $data)) {
    if (!is_bool($data['maintenance'])) siteControlFail(400, 'État de maintenance invalide.');
    $controls['maintenance'] = $data['maintenance'];
}
if (array_key_exists('adminSlug', $data)) {
    $slug = $data['adminSlug'];
    if (!is_string($slug) || !preg_match('/^[a-z][a-z0-9-]{7,79}$/D', $slug)
        || preg_match('/^(?:admin|dashboard|api|assets|media|storage|blog|devis|espace|locationsalle|villes|mentions|conditions|politique|favicon|static|wedding|index|robots|sitemap)(?:-|$)/', $slug)
        || file_exists(dirname(__DIR__) . '/' . $slug)) {
        siteControlFail(400, 'Choisissez une adresse de 8 à 80 caractères : lettres minuscules, chiffres et tirets, hors chemins réservés.');
    }
    $controls['adminSlug'] = $slug;
}
// The flag enables Apache's gate for static HTML as well as SPA routes.
$flag = dirname(__DIR__) . '/site-maintenance.flag';
if ($controls['maintenance']) siteAtomicWrite($flag, 'maintenance', 0644);
siteAtomicWrite($directory . '/site-controls.json', json_encode($controls));
if (!$controls['maintenance'] && is_file($flag) && !unlink($flag)) siteControlFail(500, 'Désactivation de la maintenance impossible.');
echo json_encode(['ok' => true, 'controls' => $controls]);
