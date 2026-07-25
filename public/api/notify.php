<?php
/**
 * notify.php – Receives a new-devis notification and logs it.
 *
 * POST /api/notify.php  → accepts a JSON body describing the new devis
 *
 * To send real notifications (e-mail, WhatsApp via a gateway, etc.) add your
 * logic in the "Send notification" section below.
 */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

// ── Log to file ───────────────────────────────────────────────────────────────
$logDir  = realpath(__DIR__ . '/..') . '/storage-data';
$logFile = $logDir . '/notify.log';

if (is_dir($logDir)) {
    $line = date('Y-m-d H:i:s') . ' ' . json_encode($data, JSON_UNESCAPED_UNICODE) . PHP_EOL;
    file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
}

// ── Send notification (configure below) ──────────────────────────────────────
// Example: send an e-mail
// $to      = 'contact@leparadise77.fr';
// $subject = 'Nouveau devis : ' . ($data['devisNumber'] ?? 'N/A');
// $message = 'Client : ' . ($data['nomClient'] ?? '') . "\n"
//          . 'Devis  : ' . ($data['devisNumber'] ?? '') . "\n"
//          . 'Total  : ' . ($data['totalTTC'] ?? '') . ' €';
// mail($to, $subject, $message);

echo json_encode(['ok' => true]);
