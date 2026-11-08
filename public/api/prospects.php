<?php
require_once __DIR__ . '/site-guard.php';
siteMaintenanceGuard('prospects');
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function failProspects(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) failProspects(405, 'Méthode non autorisée.');
$root = dirname(__DIR__);
if (!siteAdminAuthenticated(false)) failProspects(403, 'Accès aux prospects refusé. Reconnectez-vous.');
$csrf = siteAdminCsrf();
if ($_SERVER['REQUEST_METHOD'] === 'POST') siteRequireAdminCsrf();
session_write_close();
$directory = $root . '/storage-data/quote-followups';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    if (strlen($body) > 40000) failProspects(413, 'Notes trop volumineuses.');
    $data = json_decode($body, true);
    if (!is_array($data) || !is_string($data['flowId'] ?? null)
        || !preg_match('/^[a-f0-9]{32}$/D', $data['flowId'])
        || !in_array($data['action'] ?? '', ['notes', 'delete'], true)) failProspects(400, 'Action prospect invalide.');
    if ($data['action'] === 'notes' && (!is_string($data['internalNotes'] ?? null)
        || strlen($data['internalNotes']) > 10000)) failProspects(400, 'Notes invalides (10 000 octets maximum).');
    $path = $directory . '/flow-' . $data['flowId'] . '.json';
    if (!is_file($path) || is_link($path)) failProspects(404, 'Prospect introuvable.');
    $lock = fopen($path . '.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) failProspects(503, 'Verrou du prospect indisponible.');
    $record = json_decode(file_get_contents($path), true);
    if (!is_array($record) || ($record['flowId'] ?? '') !== $data['flowId']) failProspects(500, 'Dossier prospect illisible.');
    if (!empty($record['deletedAt'])) failProspects(404, 'Prospect supprimé.');
    if ($data['action'] === 'delete') {
        // Keep only a tombstone: the client may finish its quote without regenerating this prospect.
        $record = ['flowId' => $data['flowId'], 'deletedAt' => gmdate('c')];
    } else {
        $record['internalNotes'] = $data['internalNotes'];
        $record['notesUpdatedAt'] = gmdate('c');
    }
    siteAtomicWrite($path, json_encode($record, JSON_UNESCAPED_UNICODE));
    flock($lock, LOCK_UN);
    fclose($lock);
    echo json_encode(['ok' => true, 'prospect' => $record], JSON_UNESCAPED_UNICODE);
    exit;
}

$clientsPath = $root . '/storage-data/paradise_clients.json';
$clients = is_file($clientsPath) ? json_decode(file_get_contents($clientsPath), true) : [];
if (!is_array($clients)) failProspects(500, 'Liste des devis illisible.');
$paths = is_dir($directory) ? glob($directory . '/flow-*.json') : [];
if ($paths === false) failProspects(500, 'Lecture des prospects impossible.');
$prospects = [];
foreach ($paths as $path) {
    $record = json_decode(file_get_contents($path), true);
    if (is_array($record) && !empty($record['deletedAt'])) continue;
    if (!is_array($record) || !isset($record['flowId'], $record['stage'], $record['summary'])) {
        failProspects(500, 'Un dossier de suivi est illisible.');
    }
    if ($record['stage'] !== 2) continue;
    $submitted = false;
    foreach ($clients as $client) {
        if (($client['quoteFlowId'] ?? null) === $record['flowId']
            || (empty($client['quoteFlowId'])
                && strtolower(trim($client['email'] ?? '')) === strtolower($record['summary']['email'])
                && ($client['dateEvenement'] ?? '') === $record['summary']['dateEvenement'])) {
            $submitted = true;
            break;
        }
    }
    if (!$submitted) $prospects[] = $record;
}
usort($prospects, function ($a, $b) { return strcmp($b['updatedAt'], $a['updatedAt']); });
echo json_encode(['ok' => true, 'prospects' => $prospects, 'csrf' => $csrf], JSON_UNESCAPED_UNICODE);
