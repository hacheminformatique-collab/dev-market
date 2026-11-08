<?php
require_once __DIR__ . '/site-controls.php';
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') siteControlFail(405, 'Méthode non autorisée.');
if (!siteAdminAuthenticated(false)) siteControlFail(403, 'Purge non autorisée. Reconnectez-vous.');
$data = json_decode(file_get_contents('php://input'), true);
$groups = [
    'clients' => ['paradise_clients' => [], 'paradise_cal_staff' => (object)[]],
    'calendar' => ['paradise_cal_overrides' => (object)[], 'paradise_cal_staff' => (object)[], 'paradise_cal_manual_events' => []],
    'compta' => [],
    'staff' => ['paradise_staff' => [], 'paradise_cal_staff' => (object)[]],
    'stock' => ['paradise_stock_sec' => [], 'paradise_stock_matiere' => [], 'paradise_stock_boisson' => []],
    'matieres' => ['paradise_ingredients' => [], 'paradise_matieres_recettes' => []],
    'formules' => ['paradise_formules' => []],
    'menus' => ['paradise_menus' => []],
    'gateaux' => ['paradise_gateaux' => []],
    'prestations' => ['paradise_prestations' => []],
    'pages-mariage' => ['paradise_city_pages' => (object)[], 'paradise_city_pages_backup' => [],
        'paradise_city_pages_config' => (object)[], 'paradise_city_gallery' => []],
];
$type = $data['type'] ?? '';
if (!is_string($type) || ($type !== 'all' && !isset($groups[$type])) || ($data['confirmation'] ?? '') !== 'PURGER') {
    siteControlFail(400, 'Type ou confirmation de purge invalide.');
}
$root = dirname(__DIR__);
$directory = $root . '/storage-data';
if (is_link($directory) || is_link($directory . '/quote-followups')) siteControlFail(409, 'Dossier de stockage invalide.');
function purgeFiles(string $pattern): array {
    $paths = glob($pattern);
    if ($paths === false) siteControlFail(500, 'Inventaire des fichiers de purge impossible.');
    return $paths;
}
$publicationLock = fopen($directory . '/.publication.lock', 'c+');
if (!$publicationLock || !flock($publicationLock, LOCK_EX)) siteControlFail(503, 'Publication en cours ou verrou indisponible.');
$writes = $type === 'all' ? array_merge(...array_values($groups)) : $groups[$type];
$purgePages = $type === 'all' || $type === 'pages-mariage';
$purgeClients = $type === 'all' || $type === 'clients';
if ($purgePages) $writes['wedding-publication-checkpoints'] = (object)[];
if ($type === 'all') {
    foreach (['reception', 'anniversaire', 'bapteme', 'fiancaille', 'fiancailles', 'seminaire'] as $pageType) {
        $writes['paradise_city_pages_' . $pageType] = (object)[];
        $writes['paradise_city_pages_backup_' . $pageType] = [];
        $writes['paradise_city_pages_config_' . $pageType] = (object)[];
    }
    foreach (['paradise_blog_articles' => (object)[], 'paradise_blog_backup' => [],
        'paradise_blog_config' => (object)[], 'paradise_blog_autolog' => []] as $key => $empty) $writes[$key] = $empty;
}
$deletes = [];
$extraWrites = [];
foreach (purgeFiles($directory . '/*.json') as $path) {
    $key = basename($path, '.json');
    if (($purgeClients && preg_match('/^paradise_(?:docs|receipts)_/', $key))
        || ($type === 'compta' && strpos($key, 'paradise_receipts_') === 0)) $writes[$key] = (object)[];
}
if ($purgeClients) {
    foreach (purgeFiles($directory . '/quote-followups/*.json') as $path) $deletes[] = $path;
    if (is_file($directory . '/notify.log')) $deletes[] = $directory . '/notify.log';
}
if ($type === 'calendar' || $type === 'compta' || $type === 'staff') $writes['paradise_clients'] = null;
ksort($writes);
$locks = [];
foreach ($writes as $key => $value) {
    $path = $directory . '/' . $key . '.json';
    if (is_link($path)) siteControlFail(409, 'Lien de stockage interdit.');
    $lock = fopen($path . '.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) siteControlFail(503, 'Verrou de purge indisponible.');
    $locks[] = $lock;
    if ($value === null) {
        $clients = is_file($path) ? json_decode(file_get_contents($path), true) : [];
        if (!is_array($clients)) siteControlFail(409, 'Devis illisibles : purge interrompue sans remplacement.');
        foreach ($clients as &$client) {
            if (!is_array($client)) siteControlFail(409, 'Devis invalide.');
            if ($type === 'calendar') { $client['calendarExcluded'] = true; $client['assignedStaff'] = []; }
            if ($type === 'compta') { $client['payments'] = []; $client['paymentReceipts'] = []; $client['accountingExcluded'] = true; }
            if ($type === 'staff') $client['assignedStaff'] = [];
        }
        unset($client);
        $writes[$key] = $clients;
    }
}
if ($purgePages) {
    $folder = $root . '/locationsalledemariage';
    $folders = [$folder, $folder . '/departements'];
    if ($type === 'all') {
        foreach (['locationsalledereception', 'locationsalleanniversaire', 'locationsallebapteme',
            'locationsallefiancaille', 'locationsalleseminaire'] as $name) $folders[] = $root . '/' . $name;
    }
    foreach ($folders as $target) {
        if (is_link($target)) siteControlFail(409, 'Dossier de pages invalide.');
        foreach (purgeFiles($target . '/*.html') as $path) {
            if (!preg_match('/^[a-z0-9-]+\.html$/D', basename($path))) siteControlFail(409, 'Nom de page invalide.');
            $deletes[] = $path;
        }
    }
    $extraWrites = ['wedding-pages.json' => '[]', 'wedding-departments.json' => '[]',
        'wedding-city-aliases.json' => '{}', 'wedding-directory.html' => '', 'wedding-directory-idf.html' => ''];
    $index = file_get_contents($root . '/index.html');
    if ($index === false || substr_count($index, '<!-- WEDDING_DIRECTORY_START -->') !== 1
        || substr_count($index, '<!-- WEDDING_DIRECTORY_END -->') !== 1) siteControlFail(409, 'Modèle d’accueil incompatible avec la purge.');
    $extraWrites['index.html'] = preg_replace('/(<!-- WEDDING_DIRECTORY_START -->).*?(<!-- WEDDING_DIRECTORY_END -->)/s', '$1$2', $index);
    if (is_file($root . '/sitemap.xml')) {
        $sitemap = file_get_contents($root . '/sitemap.xml');
        $extraWrites['sitemap.xml'] = preg_replace('~<url>\s*<loc>[^<]*/locationsalledemariage/.*?</url>~s', '', $sitemap);
        if ($type === 'all') $extraWrites['sitemap.xml'] = preg_replace('~<url>\s*<loc>[^<]*/(?:locationsalle[^/]+|blog)/.*?</url>~s', '', $extraWrites['sitemap.xml']);
    }
}
foreach ($deletes as $path) {
    if (is_link($path) || !is_file($path) || !is_writable(dirname($path))) siteControlFail(409, 'Fichier de purge invalide ou non supprimable.');
}
foreach ($extraWrites as $name => $value) {
    if (is_link($root . '/' . $name) || !is_writable($root)) siteControlFail(409, 'Publication non modifiable.');
}
// All inputs are validated before changing the first record. Files use atomic writes.
foreach ($writes as $key => $value) siteAtomicWrite($directory . '/' . $key . '.json', json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
foreach ($extraWrites as $name => $value) siteAtomicWrite($root . '/' . $name, $value, 0644);
foreach ($deletes as $path) {
    if (!unlink($path)) siteControlFail(500, 'Purge partielle : un fichier n’a pas pu être supprimé. Vérifiez le serveur avant de continuer.');
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => true, 'keys' => array_keys($writes), 'deleted' => count($deletes)]);
