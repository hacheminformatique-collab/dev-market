<?php
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function failProspects(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') failProspects(405, 'Méthode non autorisée.');
$root = dirname(__DIR__);
$settings = json_decode(@file_get_contents($root . '/storage-data/paradise_settings.json'), true);
$pin = $_SERVER['HTTP_X_ADMIN_PIN'] ?? '';
if (!is_string($pin) || $pin === '' || !is_array($settings) || empty($settings['pin'])
    || !hash_equals((string)$settings['pin'], $pin)) failProspects(403, 'Accès aux prospects refusé.');

$clientsPath = $root . '/storage-data/paradise_clients.json';
$clients = is_file($clientsPath) ? json_decode(file_get_contents($clientsPath), true) : [];
if (!is_array($clients)) failProspects(500, 'Liste des devis illisible.');
$directory = $root . '/storage-data/quote-followups';
$paths = is_dir($directory) ? glob($directory . '/flow-*.json') : [];
if ($paths === false) failProspects(500, 'Lecture des prospects impossible.');
$prospects = [];
foreach ($paths as $path) {
    $record = json_decode(file_get_contents($path), true);
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
echo json_encode(['ok' => true, 'prospects' => $prospects], JSON_UNESCAPED_UNICODE);
