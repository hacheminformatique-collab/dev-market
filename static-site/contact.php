<?php
declare(strict_types=1);
date_default_timezone_set('Europe/Paris');

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, string $message): never
{
    http_response_code($status);
    if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $status === 200, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Votre demande — Le Paradise</title><link rel="stylesheet" href="assets/site.css"></head><body><main class="section"><h1>Votre demande</h1><p>' . $safe . '</p><a class="button" href="contact.html">Retour au formulaire</a><p><a href="tel:+33782821582">07 82 82 15 82</a></p></main></body></html>';
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, 'Utilisez le formulaire pour envoyer votre demande.');
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 20000) {
    respond(413, 'Votre message est trop volumineux.');
}

function field(string $name, int $max, bool $required = true): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value) || strlen($value) > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        respond(422, 'Un champ est invalide. Vérifiez votre formulaire.');
    }
    $value = trim($value);
    if ($required && $value === '') respond(422, 'Veuillez remplir tous les champs obligatoires.');
    return $value;
}

if (field('website', 200, false) !== '') respond(422, 'Votre demande a été refusée par la protection contre les abus.');
$name = field('name', 480);
$email = field('email', 254);
$phone = field('phone', 30);
$event = field('event', 60);
$date = field('date', 10);
$guests = field('guests', 4);
$message = field('message', 15000);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email)) respond(422, 'Adresse e-mail invalide.');
if (!preg_match('/^[+0-9().\s-]{6,30}$/', $phone)) respond(422, 'Numéro de téléphone invalide.');
if (!in_array($event, ['Mariage', 'Fiançailles', 'Anniversaire', 'Baptême', 'Réception', 'Séminaire'], true)) respond(422, 'Type de réception invalide.');
$parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
if (!$parsed || $parsed->format('Y-m-d') !== $date || $parsed < new DateTimeImmutable('today', new DateTimeZone('Europe/Paris'))) {
    respond(422, 'Indiquez une date valide, aujourd’hui ou dans le futur.');
}
if (!ctype_digit($guests) || (int) $guests < 1 || (int) $guests > 9999) respond(422, 'Nombre d’invités invalide.');
if (field('consent', 3) !== 'yes') respond(422, 'Votre accord est nécessaire pour traiter cette demande.');

// Private temporary files contain only an IP fingerprint and timestamps.
$limitDir = sys_get_temp_dir() . '/paradise-contact-' . substr(hash('sha256', __DIR__), 0, 16);
if (!is_dir($limitDir) && !mkdir($limitDir, 0700, true) && !is_dir($limitDir)) {
    error_log('[paradise-contact] Rate-limit directory unavailable');
    respond(503, 'Envoi indisponible. Contactez-nous au 07 82 82 15 82.');
}
$now = time();
foreach (glob($limitDir . '/*.limit') ?: [] as $oldFile) {
    if (filemtime($oldFile) < $now - 7200) {
        $oldHandle = fopen($oldFile, 'c+');
        if ($oldHandle !== false) {
            if (flock($oldHandle, LOCK_EX | LOCK_NB)) {
                if (filemtime($oldFile) < $now - 7200 && !unlink($oldFile)) error_log('[paradise-contact] Unable to expire rate-limit file');
                flock($oldHandle, LOCK_UN);
            }
            fclose($oldHandle);
        }
    }
}
$limitFile = $limitDir . '/' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown') . '.limit';
$handle = fopen($limitFile, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    error_log('[paradise-contact] Rate-limit lock unavailable');
    respond(503, 'Envoi indisponible. Contactez-nous par téléphone.');
}
$raw = stream_get_contents($handle);
$attempts = $raw === '' ? [] : json_decode($raw, true);
if (!is_array($attempts)) {
    fclose($handle);
    error_log('[paradise-contact] Invalid rate-limit data');
    respond(503, 'Envoi indisponible. Contactez-nous par téléphone.');
}
$attempts = array_values(array_filter($attempts, fn ($t) => is_int($t) && $t > $now - 3600));
if (count($attempts) >= 5) {
    fclose($handle);
    header('Retry-After: 3600');
    respond(429, 'Trop de demandes. Réessayez dans une heure ou appelez-nous.');
}
$attempts[] = $now;
rewind($handle);
$saved = ftruncate($handle, 0) && fwrite($handle, json_encode($attempts)) !== false && fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);
if (!$saved) {
    error_log('[paradise-contact] Unable to save rate-limit counter');
    respond(503, 'Envoi indisponible. Contactez-nous par téléphone.');
}

$configFile = __DIR__ . '/contact-config.json';
$config = is_readable($configFile) ? json_decode(file_get_contents($configFile), true) : null;
$recipient = is_array($config) ? ($config['email'] ?? '') : '';
$sender = getenv('PARADISE_CONTACT_FROM') ?: '';
if (!is_string($recipient) || !filter_var($recipient, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $recipient)
    || !filter_var($sender, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $sender)) {
    error_log('[paradise-contact] Missing or invalid recipient / PARADISE_CONTACT_FROM');
    respond(503, 'Le formulaire n’est pas encore configuré pour l’envoi. Appelez-nous au 07 82 82 15 82.');
}
$subject = '=?UTF-8?B?' . base64_encode('Nouvelle demande de réception — Le Paradise') . '?=';
$body = "Nom : $name\nE-mail : $email\nTéléphone : $phone\nÉvénement : $event\nDate : $date\nInvités : $guests\n\n$message\n";
$headers = ['From' => $sender, 'Reply-To' => $email, 'MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8'];
if (!mail($recipient, $subject, $body, $headers)) {
    error_log('[paradise-contact] Mail transport rejected the message');
    respond(503, 'L’envoi a échoué. Votre demande n’est pas confirmée ; appelez-nous au 07 82 82 15 82.');
}
respond(200, 'Votre demande a été transmise au service de messagerie. Notre équipe vous répondra pour confirmer les disponibilités ; ceci ne constitue pas une réservation.');
