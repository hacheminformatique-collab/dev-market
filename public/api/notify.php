<?php
/**
 * notify.php – Receives a new-devis notification, logs it, and sends e-mails.
 *
 * POST /api/notify.php  → accepts a JSON body describing the new devis
 */

header('Content-Type: application/json; charset=utf-8');

function notify_log($logFile, $message)
{
    if (!$logFile) return;
    @file_put_contents($logFile, date('Y-m-d H:i:s') . ' [notify] ' . $message . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function smtp_read_response($socket)
{
    $response = '';
    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) break;
        $response .= $line;
        if (preg_match('/^\d{3}\s/', $line)) break;
    }
    return $response;
}

function smtp_expect($socket, $allowedCodes)
{
    $response = smtp_read_response($socket);
    if ($response === '') return false;
    $code = (int) substr($response, 0, 3);
    return in_array($code, $allowedCodes, true);
}

function smtp_send_line($socket, $line)
{
    return fwrite($socket, $line . "\r\n") !== false;
}

function encode_header_utf8($text)
{
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

function smtp_send_mail($config, $fromEmail, $fromName, $toEmail, $subject, $body, $replyTo)
{
    if (empty($config['host']) || empty($config['port'])) return false;
    $host = (string) $config['host'];
    $port = (int) $config['port'];
    $encryption = strtolower((string) ($config['encryption'] ?? 'none'));
    $username = isset($config['username']) ? (string) $config['username'] : '';
    $password = isset($config['password']) ? (string) $config['password'] : '';

    $remote = ($encryption === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 10, STREAM_CLIENT_CONNECT);
    if (!$socket) return false;

    stream_set_timeout($socket, 12);
    $localHost = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-zA-Z0-9.-]/', '', (string) $_SERVER['HTTP_HOST']) : 'localhost';

    if (!smtp_expect($socket, [220])) { fclose($socket); return false; }
    if (!smtp_send_line($socket, 'EHLO ' . $localHost) || !smtp_expect($socket, [250])) { fclose($socket); return false; }

    if ($encryption === 'tls') {
        if (!smtp_send_line($socket, 'STARTTLS') || !smtp_expect($socket, [220])) { fclose($socket); return false; }
        if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($socket); return false; }
        if (!smtp_send_line($socket, 'EHLO ' . $localHost) || !smtp_expect($socket, [250])) { fclose($socket); return false; }
    }

    if ($username !== '' || $password !== '') {
        if (!smtp_send_line($socket, 'AUTH LOGIN') || !smtp_expect($socket, [334])) { fclose($socket); return false; }
        if (!smtp_send_line($socket, base64_encode($username)) || !smtp_expect($socket, [334])) { fclose($socket); return false; }
        if (!smtp_send_line($socket, base64_encode($password)) || !smtp_expect($socket, [235])) { fclose($socket); return false; }
    }

    if (!smtp_send_line($socket, 'MAIL FROM:<' . $fromEmail . '>') || !smtp_expect($socket, [250])) { fclose($socket); return false; }
    if (!smtp_send_line($socket, 'RCPT TO:<' . $toEmail . '>') || !smtp_expect($socket, [250, 251])) { fclose($socket); return false; }
    if (!smtp_send_line($socket, 'DATA') || !smtp_expect($socket, [354])) { fclose($socket); return false; }

    $headers = [];
    $headers[] = 'From: ' . encode_header_utf8($fromName) . ' <' . $fromEmail . '>';
    $headers[] = 'To: <' . $toEmail . '>';
    $headers[] = 'Subject: ' . encode_header_utf8($subject);
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    if ($replyTo) $headers[] = 'Reply-To: ' . $replyTo;

    $normalizedBody = str_replace(["\r\n", "\r"], "\n", (string) $body);
    $normalizedBody = str_replace("\n.", "\n..", $normalizedBody);
    $messageData = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $normalizedBody) . "\r\n.";

    if (!smtp_send_line($socket, $messageData) || !smtp_expect($socket, [250])) { fclose($socket); return false; }
    smtp_send_line($socket, 'QUIT');
    fclose($socket);
    return true;
}

function smtp_config_from($settings)
{
    $smtp = [];
    if (isset($settings['smtp']) && is_array($settings['smtp'])) $smtp = $settings['smtp'];
    if (isset($settings['mail']) && is_array($settings['mail']) && isset($settings['mail']['smtp']) && is_array($settings['mail']['smtp'])) {
        $smtp = array_merge($smtp, $settings['mail']['smtp']);
    }

    $host = getenv('PARADISE_SMTP_HOST') ?: ($smtp['host'] ?? '');
    $port = getenv('PARADISE_SMTP_PORT') ?: ($smtp['port'] ?? '');
    $username = getenv('PARADISE_SMTP_USER') ?: ($smtp['username'] ?? '');
    $password = getenv('PARADISE_SMTP_PASS') ?: ($smtp['password'] ?? '');
    $encryption = getenv('PARADISE_SMTP_ENCRYPTION') ?: ($smtp['encryption'] ?? 'none');
    $fromEmail = getenv('PARADISE_SMTP_FROM_EMAIL') ?: ($smtp['fromEmail'] ?? '');
    $fromName = getenv('PARADISE_SMTP_FROM_NAME') ?: ($smtp['fromName'] ?? 'LE PARADISE');

    return [
        'host' => trim((string) $host),
        'port' => (int) $port,
        'username' => (string) $username,
        'password' => (string) $password,
        'encryption' => strtolower(trim((string) $encryption)),
        'fromEmail' => trim((string) $fromEmail),
        'fromName' => trim((string) $fromName) ?: 'LE PARADISE',
        'configured' => trim((string) $host) !== '' && (int) $port > 0,
    ];
}

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
$eventDateTs = $eventDateRaw !== '' ? strtotime($eventDateRaw) : false;
$eventDate = $eventDateTs ? date('d/m/Y', $eventDateTs) : 'Non renseignée';
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
$smtpConfig = smtp_config_from($settings);
if (isset($smtpConfig['fromEmail']) && $smtpConfig['fromEmail'] !== '') {
    $smtpFromValidated = filter_var($smtpConfig['fromEmail'], FILTER_VALIDATE_EMAIL);
    if ($smtpFromValidated) {
        $fromEmail = $smtpFromValidated;
    }
}
$fromName = $smtpConfig['fromName'] ?? 'LE PARADISE';
$commonHeaders = "MIME-Version: 1.0\r\n";
$commonHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$commonHeaders .= "From: {$fromName} <{$fromEmail}>\r\n";
if ($ownerEmail) {
    $commonHeaders .= "Reply-To: {$ownerEmail}\r\n";
}

function send_with_fallback($to, $subject, $message, $headers, $smtpConfig, $fromEmail, $fromName, $replyTo, $logFile)
{
    $mailSent = @mail($to, $subject, $message, $headers);
    if ($mailSent) return ['sent' => true, 'via' => 'mail'];
    if (empty($smtpConfig['configured'])) {
        notify_log($logFile, 'mail() failed and SMTP is not configured');
        return ['sent' => false, 'via' => 'none'];
    }
    $smtpSent = smtp_send_mail($smtpConfig, $fromEmail, $fromName, $to, $subject, $message, $replyTo);
    if (!$smtpSent) notify_log($logFile, 'mail() failed and SMTP fallback failed');
    return ['sent' => $smtpSent, 'via' => $smtpSent ? 'smtp' : 'none'];
}

$adminSent = false;
$adminVia = 'none';
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
    $adminResult = send_with_fallback(
        $ownerEmail,
        $adminSubject,
        $adminMessage,
        $commonHeaders,
        $smtpConfig,
        $fromEmail,
        $fromName,
        $ownerEmail,
        $logFile
    );
    $adminSent = $adminResult['sent'];
    $adminVia = $adminResult['via'];
}

$clientSent = false;
$clientVia = 'none';
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
    $clientResult = send_with_fallback(
        $clientEmail,
        $clientSubject,
        $clientMessage,
        $commonHeaders,
        $smtpConfig,
        $fromEmail,
        $fromName,
        $ownerEmail ?: null,
        $logFile
    );
    $clientSent = $clientResult['sent'];
    $clientVia = $clientResult['via'];
}

echo json_encode([
    'ok' => true,
    'mail' => [
        'adminSent' => $adminSent,
        'clientSent' => $clientSent,
        'adminVia' => $adminVia,
        'clientVia' => $clientVia,
    ],
]);
