<?php
/**
 * notify.php – Receives a new-devis notification, logs it, and sends e-mails.
 *
 * POST /api/notify.php  → accepts a JSON body describing the new devis
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

// ── Send e-mails ──────────────────────────────────────────────────────────────
$settingsFile = $logDir . '/paradise_settings.json';
$settings = [];
if (is_file($settingsFile) && is_readable($settingsFile)) {
    $settingsRaw = file_get_contents($settingsFile);
    $decoded = json_decode($settingsRaw, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $settings = $decoded;
    }
}

$devisNumber = isset($data['devisNumber']) ? (string) $data['devisNumber'] : 'N/A';
$prenom = isset($data['prenom']) ? trim((string) $data['prenom']) : '';
$nom = isset($data['nom']) ? trim((string) $data['nom']) : '';
$clientName = trim($prenom . ' ' . $nom);
$clientEmail = isset($data['email']) ? filter_var(trim((string) $data['email']), FILTER_VALIDATE_EMAIL) : false;
$phone = isset($data['telephone']) ? trim((string) $data['telephone']) : '';
$eventType = isset($data['typeEvenement']) ? trim((string) $data['typeEvenement']) : '';
$eventDateRaw = isset($data['dateEvenement']) ? trim((string) $data['dateEvenement']) : '';
$eventDate = $eventDateRaw !== '' ? date('d/m/Y', strtotime($eventDateRaw)) : 'Non renseignée';
$totalTTC = isset($data['totalTTC']) ? number_format((float) $data['totalTTC'], 2, ',', ' ') . ' €' : 'N/A';

$siteUrl = '';
if (isset($settings['siteUrl']) && is_string($settings['siteUrl'])) {
    $siteUrl = rtrim(trim($settings['siteUrl']), '/');
}
$espaceClientPath = '/espace-client/' . rawurlencode($devisNumber);
$espaceClientUrl = $siteUrl !== '' ? ($siteUrl . $espaceClientPath) : $espaceClientPath;

$ownerEmail = false;
if (isset($settings['legalInfo']['email'])) {
    $ownerEmail = filter_var(trim((string) $settings['legalInfo']['email']), FILTER_VALIDATE_EMAIL);
}
if (!$ownerEmail && isset($settings['email'])) {
    $ownerEmail = filter_var(trim((string) $settings['email']), FILTER_VALIDATE_EMAIL);
}

$host = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-zA-Z0-9.-]/', '', (string) $_SERVER['HTTP_HOST']) : 'localhost';
$fromEmail = $ownerEmail ?: ('no-reply@' . $host);
$commonHeaders = "MIME-Version: 1.0\r\n";
$commonHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$commonHeaders .= "From: LE PARADISE <{$fromEmail}>\r\n";
if ($ownerEmail) {
    $commonHeaders .= "Reply-To: {$ownerEmail}\r\n";
}

$adminSent = false;
if ($ownerEmail) {
    $adminSubject = 'Nouveau devis signé : ' . $devisNumber;
    $adminMessage = "Un nouveau devis vient d'être validé.\n\n"
        . "Devis : {$devisNumber}\n"
        . "Client : " . ($clientName !== '' ? $clientName : 'Non renseigné') . "\n"
        . "Email client : " . ($clientEmail ?: 'Non renseigné') . "\n"
        . "Téléphone : " . ($phone !== '' ? $phone : 'Non renseigné') . "\n"
        . "Événement : " . ($eventType !== '' ? $eventType : 'Non renseigné') . "\n"
        . "Date : {$eventDate}\n"
        . "Total TTC : {$totalTTC}\n\n"
        . "Espace client : {$espaceClientUrl}\n";
    $adminSent = @mail($ownerEmail, $adminSubject, $adminMessage, $commonHeaders);
}

$clientSent = false;
if ($clientEmail) {
    $clientSubject = 'Récapitulatif de votre devis ' . $devisNumber;
    $clientMessage = "Bonjour " . ($prenom !== '' ? $prenom : '') . ",\n\n"
        . "Merci pour votre demande. Votre devis a bien été enregistré.\n\n"
        . "Numéro de devis : {$devisNumber}\n"
        . "Type d'événement : " . ($eventType !== '' ? $eventType : 'Non renseigné') . "\n"
        . "Date de l'événement : {$eventDate}\n"
        . "Total TTC : {$totalTTC}\n\n"
        . "Vous pouvez suivre votre dossier ici :\n{$espaceClientUrl}\n\n"
        . "Documents à fournir dans votre espace client :\n"
        . "- Carte d'identité (recto)\n"
        . "- Carte d'identité (verso)\n"
        . "- Attestation d'assurance\n\n"
        . "Cordialement,\nLE PARADISE";
    $clientSent = @mail($clientEmail, $clientSubject, $clientMessage, $commonHeaders);
}

echo json_encode([
    'ok' => true,
    'mail' => [
        'adminSent' => $adminSent,
        'clientSent' => $clientSent,
    ],
]);
