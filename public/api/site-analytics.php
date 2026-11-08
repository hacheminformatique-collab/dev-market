<?php
require_once __DIR__ . '/site-controls.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function analyticsFail(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function analyticsDirectory(): string {
    $storage = dirname(__DIR__) . '/storage-data';
    if (is_link($storage) || (!is_dir($storage) && !@mkdir($storage, 0750, true) && !is_dir($storage))) {
        analyticsFail(503, 'Stockage des statistiques indisponible.');
    }
    $directory = $storage . '/site-analytics';
    if (is_link($directory) || (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory))) {
        analyticsFail(503, 'Stockage des statistiques indisponible.');
    }
    $protect = $directory . '/.htaccess';
    if (is_link($protect)) analyticsFail(409, 'Protection des statistiques invalide.');
    if (!is_file($protect) && @file_put_contents($protect, "Require all denied\n", LOCK_EX) === false) {
        analyticsFail(503, 'Protection des statistiques impossible.');
    }
    return $directory;
}

function analyticsReadDay(string $directory, string $date): array {
    $path = $directory . '/' . $date . '.json';
    if (!is_file($path)) return ['date' => $date, 'visitors' => [], 'pages' => []];
    if (is_link($path)) analyticsFail(409, 'Fichier de statistiques invalide.');
    $data = json_decode((string) file_get_contents($path), true);
    if (!is_array($data) || ($data['date'] ?? null) !== $date
        || !is_array($data['visitors'] ?? null) || !is_array($data['pages'] ?? null)) {
        analyticsFail(500, 'Un fichier de statistiques est illisible.');
    }
    return $data;
}

function analyticsCleanOldFiles(string $directory, string $today): void {
    $cutoff = (new DateTimeImmutable($today, new DateTimeZone('Europe/Paris')))->modify('-400 days')->format('Y-m-d');
    $files = glob($directory . '/????-??-??.json');
    if ($files === false) analyticsFail(500, 'Inventaire des statistiques impossible.');
    foreach ($files as $file) {
        if (preg_match('/\/(\d{4}-\d{2}-\d{2})\.json$/D', $file, $match)
            && $match[1] < $cutoff && !is_link($file)) {
            if (!unlink($file)) analyticsFail(500, 'Purge des anciennes statistiques impossible.');
        }
    }
}

function analyticsStoreVisit(string $directory, string $date, string $visitorId, string $page): void {
    $path = $directory . '/' . $date . '.json';
    if (is_link($path)) analyticsFail(409, 'Fichier de statistiques invalide.');
    $handle = @fopen($path, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if ($handle) fclose($handle);
        analyticsFail(503, 'Enregistrement des statistiques indisponible.');
    }
    rewind($handle);
    $raw = stream_get_contents($handle);
    if ($raw === false) {
        flock($handle, LOCK_UN);
        fclose($handle);
        analyticsFail(500, 'Lecture des statistiques impossible.');
    }
    if ($raw === '') {
        $data = ['date' => $date, 'visitors' => [], 'pages' => []];
    } else {
        $data = json_decode($raw, true);
        if (!is_array($data) || ($data['date'] ?? null) !== $date
            || !is_array($data['visitors'] ?? null) || !is_array($data['pages'] ?? null)) {
            flock($handle, LOCK_UN);
            fclose($handle);
            analyticsFail(500, 'Un fichier de statistiques est illisible.');
        }
    }
    $visitorHash = hash('sha256', $date . ':' . $visitorId);
    if (!isset($data['visitors'][$visitorHash]) && count($data['visitors']) >= 50000) {
        flock($handle, LOCK_UN);
        fclose($handle);
        analyticsFail(429, 'La limite quotidienne de statistiques est atteinte.');
    }
    if (!isset($data['pages'][$page]) && count($data['pages']) >= 2000) {
        flock($handle, LOCK_UN);
        fclose($handle);
        analyticsFail(429, 'La limite quotidienne de pages est atteinte.');
    }
    $data['visitors'][$visitorHash] = 1;
    $data['pages'][$page] = ($data['pages'][$page] ?? 0) + 1;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    rewind($handle);
    $written = $json !== false && ftruncate($handle, 0) && fwrite($handle, $json) === strlen($json)
        && fflush($handle) && chmod($path, 0640);
    flock($handle, LOCK_UN);
    fclose($handle);
    if (!$written) analyticsFail(500, 'Écriture des statistiques impossible.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = (string) file_get_contents('php://input');
    if (strlen($body) > 2048) analyticsFail(413, 'Requête de statistiques trop volumineuse.');
    $payload = json_decode($body, true);
    if (!is_array($payload) || ($payload['action'] ?? '') !== 'track') {
        analyticsFail(400, 'Requête de statistiques invalide.');
    }
    $date = $payload['date'] ?? '';
    $today = (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    if (!is_string($date) || $date !== $today
        || !is_string($payload['visitorId'] ?? null)
        || !preg_match('/^[a-f0-9]{32}$/D', $payload['visitorId'])
        || !is_string($payload['path'] ?? null)
        || strlen($payload['path']) > 255 || !str_starts_with($payload['path'], '/')
        || preg_match('/[\x00-\x20\x7f?#]/', $payload['path'])) {
        analyticsFail(400, 'Informations de visite invalides.');
    }
    $controls = siteControls();
    $agent = strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if (in_array($payload['path'], siteAdminPaths($controls), true)
        || preg_match('/(?:bot|crawl|spider|slurp|headless|facebookexternalhit|preview)/', $agent)
        || preg_match('~^/(?:espace-client|espace-staff)(?:/|$)~', $payload['path'])) {
        echo json_encode(['ok' => true, 'ignored' => true]);
        exit;
    }
    $directory = analyticsDirectory();
    analyticsStoreVisit($directory, $date, $payload['visitorId'], $payload['path']);
    analyticsCleanOldFiles($directory, $today);
    if (is_file(__DIR__ . '/admin-push-lib.php')) {
        require_once __DIR__ . '/admin-push-lib.php';
        adminPushDispatch('visit', $date . ':' . $payload['visitorId']);
    }
    echo json_encode(['ok' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET, POST');
    analyticsFail(405, 'Méthode non autorisée.');
}
if (!siteAdminAuthenticated()) analyticsFail(403, 'Accès aux statistiques refusé.');

$directory = analyticsDirectory();
$today = new DateTimeImmutable('today', new DateTimeZone('Europe/Paris'));
analyticsCleanOldFiles($directory, $today->format('Y-m-d'));
$daily = [];
$periods = [];
$totalsByPage = [];
foreach ([7, 30, 90] as $days) {
    $periods[$days] = ['visitors' => 0, 'pageViews' => 0, 'days' => $days];
}
for ($offset = 89; $offset >= 0; $offset--) {
    $day = $today->modify('-' . $offset . ' days');
    $record = analyticsReadDay($directory, $day->format('Y-m-d'));
    $visitorCount = count($record['visitors']);
    $pageViews = array_sum(array_map('intval', $record['pages']));
    if ($offset < 90) {
        foreach ([7, 30, 90] as $days) {
            if ($offset < $days) {
                $periods[$days]['visitors'] += $visitorCount;
                $periods[$days]['pageViews'] += $pageViews;
            }
        }
    }
    if ($offset < 30) {
        foreach ($record['pages'] as $page => $views) {
            $totalsByPage[$page] = ($totalsByPage[$page] ?? 0) + (int) $views;
        }
        $daily[] = [
            'date' => $day->format('Y-m-d'),
            'visitors' => $visitorCount,
            'pageViews' => $pageViews,
        ];
    }
}
foreach ($periods as &$period) {
    $period['averageVisitorsPerDay'] = round($period['visitors'] / $period['days'], 1);
    $period['averagePageViewsPerDay'] = round($period['pageViews'] / $period['days'], 1);
}
unset($period);
arsort($totalsByPage);
$topPages = [];
foreach (array_slice($totalsByPage, 0, 20, true) as $page => $views) {
    $topPages[] = ['path' => $page, 'pageViews' => $views];
}
echo json_encode([
    'ok' => true,
    'updatedAt' => (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format(DateTimeInterface::ATOM),
    'daily' => $daily,
    'periods' => $periods,
    'topPages' => $topPages,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
