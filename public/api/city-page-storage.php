<?php
// Small, incremental requests; existing JSON page files remain compatible.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function failCityStorage(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function lockCityStorage(string $path) {
    if (is_link($path . '.lock')) failCityStorage(409, 'Verrou de stockage invalide.');
    $lock = @fopen($path . '.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) failCityStorage(500, 'Verrouillage impossible. Vérifiez les droits de storage-data.');
    return $lock;
}

function readCityStorage(string $path, bool $pages) {
    if (is_link($path)) failCityStorage(409, 'Fichier de stockage invalide.');
    if (!file_exists($path)) return $pages ? new stdClass() : [];
    $raw = file_get_contents($path);
    if ($raw === false) failCityStorage(500, 'Lecture du stockage impossible. Vérifiez les droits de storage-data.');
    $value = json_decode($raw);
    // Older versions represented an empty page map as [].
    if ($pages && $value === []) return new stdClass();
    if (json_last_error() !== JSON_ERROR_NONE || ($pages ? !is_object($value) : !is_array($value))) {
        failCityStorage(409, 'Le stockage existant est invalide. Aucun fichier ne sera remplacé.');
    }
    return $value;
}

function writeCityStorage(string $path, $value): void {
    if (is_link($path)) failCityStorage(409, 'Fichier de stockage invalide.');
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) failCityStorage(500, 'Encodage du stockage impossible.');
    $tmp = tempnam(dirname($path), '.city-pages-');
    if ($tmp === false) failCityStorage(500, 'Fichier temporaire impossible. Vérifiez les droits et l’espace disque.');
    $written = file_put_contents($tmp, $json, LOCK_EX);
    if ($written !== strlen($json) || !chmod($tmp, 0644) || !rename($tmp, $path)) {
        unlink($tmp);
        failCityStorage(500, 'Écriture du stockage impossible. Vérifiez les droits et l’espace disque.');
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    failCityStorage(405, 'Méthode non autorisée.');
}
$key = $_GET['key'] ?? '';
$action = $_GET['action'] ?? '';
if (!is_string($key) || !preg_match('/^paradise_city_pages(?:_(?:reception|anniversaire|bapteme|fiancaille|fiancailles|seminaire))?$/D', $key)
    || !in_array($action, ['save-page', 'backup-pages', 'migrate-pages'], true)) {
    failCityStorage(400, 'Opération de stockage invalide.');
}
$body = file_get_contents('php://input');
if ($body === false || $body === '') failCityStorage(413, 'Corps de requête absent. Vérifiez la limite PHP post_max_size.');
if (strlen($body) > 1024 * 1024) failCityStorage(413, 'Une page dépasse la limite de 1 Mo.');
$input = json_decode($body);
if (json_last_error() !== JSON_ERROR_NONE || !is_object($input)) failCityStorage(400, 'Requête JSON invalide.');
if ($action === 'save-page') {
    $slug = $input->slug ?? null;
    $page = $input->page ?? null;
    if (!is_string($slug) || strlen($slug) > 120 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{5}$/D', $slug)
        || !is_object($page) || !is_string($page->content ?? null) || trim($page->content) === ''
        || !is_string($page->generatedAt ?? null) || strtotime($page->generatedAt) === false) {
        failCityStorage(400, 'Page ou identifiant de ville invalide.');
    }
    $travel = $page->travel ?? null;
    if ($travel !== null && (!is_object($travel) || !is_int($travel->km ?? null) || $travel->km < 0 || $travel->km > 500
        || !is_int($travel->minutes ?? null) || $travel->minutes < 1 || $travel->minutes > 600
        || !is_string($travel->source ?? null) || trim($travel->source) === ''
        || !is_string($travel->computedAt ?? null) || strtotime($travel->computedAt) === false)) {
        failCityStorage(400, 'Trajet de la page invalide.');
    }
}
$dataDir = realpath(__DIR__ . '/..') . '/storage-data';
if (is_link($dataDir)) failCityStorage(409, 'Dossier de stockage invalide.');
if (!is_dir($dataDir)) {
    if (!mkdir($dataDir, 0750, true)
        || file_put_contents($dataDir . '/.htaccess', "Require all denied\n") === false) {
        failCityStorage(500, 'Création du stockage impossible. Vérifiez les droits du serveur.');
    }
}
$path = $dataDir . '/' . $key . '.json';
$lock = lockCityStorage($path);
$pages = readCityStorage($path, true);
if ($action === 'migrate-pages') {
    $aliases = $input->aliases ?? null;
    if (!is_object($aliases) || count(get_object_vars($aliases)) > 250) failCityStorage(400, 'Migration de villes invalide.');
    foreach ($aliases as $old => $new) {
        if (!is_string($new) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $old)
            || !preg_match('/^' . preg_quote($old, '/') . '-[0-9]{5}$/D', $new)) {
            failCityStorage(400, 'Identifiant ville-code postal invalide.');
        }
        if (isset($pages->{$old})) {
            if (!isset($pages->{$new})) $pages->{$new} = $pages->{$old};
            unset($pages->{$old});
        }
    }
    writeCityStorage($path, $pages);
} elseif ($action === 'save-page') {
    $legacySlug = $input->legacySlug ?? null;
    if ($legacySlug !== null && (!is_string($legacySlug)
        || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $legacySlug)
        || !preg_match('/^' . preg_quote($legacySlug, '/') . '-[0-9]{5}$/D', $slug))) {
        failCityStorage(400, 'Ancien identifiant de ville invalide.');
    }
    if ($legacySlug !== null && $legacySlug !== $slug) unset($pages->{$legacySlug});
    $pages->{$slug} = $page;
    writeCityStorage($path, $pages);
} elseif (count(get_object_vars($pages)) > 0) {
    $suffix = substr($key, strlen('paradise_city_pages'));
    $backupPath = $dataDir . '/paradise_city_pages_backup' . $suffix . '.json';
    $backupLock = lockCityStorage($backupPath);
    $backups = readCityStorage($backupPath, false);
    array_unshift($backups, ['snapshot' => $pages, 'backedUpAt' => gmdate('c')]);
    writeCityStorage($backupPath, array_slice($backups, 0, 5));
}
echo json_encode(['ok' => true]);
