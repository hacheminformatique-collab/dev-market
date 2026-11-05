<?php
namespace Paradise\AI;

ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function failGeneration(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    failGeneration(405, 'Méthode non autorisée.');
}
$root = realpath(__DIR__ . '/..');
$settingsFile = $root . '/storage-data/paradise_settings.json';
if (!is_readable($settingsFile)) {
    failGeneration(403, 'Enregistrez Mes Infos sur le serveur avant de générer.');
}
$settings = json_decode(file_get_contents($settingsFile), true);
$pin = $settings['pin'] ?? null;
if (!is_string($pin) || $pin === '' || !hash_equals($pin, $_SERVER['HTTP_X_ADMIN_PIN'] ?? '')) {
    failGeneration(403, 'Génération non autorisée. Reconnectez-vous avec le PIN enregistré.');
}
$body = file_get_contents('php://input');
if (strlen($body) > 32 * 1024) {
    failGeneration(413, 'Consignes trop volumineuses (maximum 32 Ko).');
}
$data = json_decode($body, true);
$prompt = $data['prompt'] ?? null;
if (!is_string($prompt) || trim($prompt) === '' || strlen($prompt) > 30000) {
    failGeneration(400, 'Consignes de génération invalides.');
}
$key = trim(getenv('OPENAI_API_KEY') ?: '');
if ($key === '') {
    failGeneration(503, 'Clé OpenAI absente du serveur. Configurez OPENAI_API_KEY dans l’environnement PHP de votre hébergement.');
}
if (!function_exists('curl_init')) {
    failGeneration(503, 'L’extension PHP cURL est requise pour OpenAI.');
}
// Serialize paid calls; never silently retry a request that might be billed.
$lock = fopen($root . '/storage-data/.openai-generation.lock', 'c');
if ($lock === false) {
    error_log('[OpenAI] Impossible de créer le verrou de génération.');
    failGeneration(500, 'Impossible de démarrer la génération. Vérifiez les droits de storage-data.');
}
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    fclose($lock);
    failGeneration(409, 'Une génération est déjà en cours. Attendez sa fin avant de relancer.');
}
$curl = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
    CURLOPT_POSTFIELDS => json_encode([
        'model' => 'gpt-4o-mini',
        'messages' => [['role' => 'user', 'content' => $prompt]],
        'max_completion_tokens' => 4096,
        'temperature' => 1.0,
    ], JSON_UNESCAPED_UNICODE),
]);
$response = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$networkError = curl_errno($curl);
curl_close($curl);
flock($lock, LOCK_UN);
fclose($lock);
if ($response === false) {
    error_log('[OpenAI] Erreur réseau cURL ' . $networkError);
    failGeneration(502, 'OpenAI est injoignable depuis l’hébergement ou le délai est dépassé. La requête a peut-être été facturée ; aucune relance automatique.');
}
$result = json_decode($response, true);
if ($status < 200 || $status >= 300) {
    error_log('[OpenAI] Réponse HTTP ' . $status);
    if ($status === 401 || $status === 403) {
        failGeneration(502, 'Clé OpenAI invalide ou accès refusé. Vérifiez la clé et les autorisations du projet sur le serveur.');
    }
    if ($status === 429) {
        $code = $result['error']['code'] ?? '';
        failGeneration(429, $code === 'insufficient_quota'
            ? 'Crédit ou quota OpenAI épuisé. Vérifiez la facturation et les limites du projet API.'
            : 'Limite de requêtes OpenAI atteinte. Attendez avant de relancer les pages restantes.');
    }
    failGeneration(502, 'OpenAI a refusé la génération (HTTP ' . $status . '). Vérifiez le projet API ou réessayez plus tard.');
}
$choice = $result['choices'][0] ?? [];
$text = $choice['message']['content'] ?? null;
if (($choice['finish_reason'] ?? '') === 'length') {
    failGeneration(502, 'OpenAI a renvoyé un texte tronqué. Réduisez les consignes avant de relancer.');
}
if (!is_string($text) || trim($text) === '') {
    failGeneration(502, 'OpenAI a renvoyé une réponse vide ou invalide.');
}
echo json_encode(['content' => trim($text)], JSON_UNESCAPED_UNICODE);
