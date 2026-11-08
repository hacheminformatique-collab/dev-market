<?php
require_once __DIR__ . '/admin-push-lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (!siteAdminAuthenticated(false)) siteControlFail(403, 'Reconnectez-vous à l’administration pour gérer les notifications.');
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) siteControlFail(405, 'Méthode non autorisée.');
$_SESSION['adminPushCsrf'] ??= bin2hex(random_bytes(32));
try {
    if ($method === 'GET') {
        $keys = adminPushVapid();
        echo json_encode(['ok' => true, 'publicKey' => $keys['publicKey'], 'csrf' => $_SESSION['adminPushCsrf'],
            'preferences' => ['prospect' => true, 'draft' => true, 'signed' => true, 'visit' => false]]);
        exit;
    }
    if (!hash_equals($_SESSION['adminPushCsrf'], $_SERVER['HTTP_X_PUSH_CSRF'] ?? '')) {
        siteControlFail(403, 'Vérification de sécurité échouée. Rechargez cette page.');
    }
    $raw = (string) file_get_contents('php://input');
    if (strlen($raw) > 8192) siteControlFail(413, 'Requête trop volumineuse.');
    $data = json_decode($raw, true);
    if (!is_array($data)) throw new InvalidArgumentException('Invalid request');
    $action = $data['action'] ?? '';
    if (!in_array($action, ['subscribe', 'status', 'unsubscribe'], true)) throw new InvalidArgumentException('Invalid action');
    adminPushEndpoint($data['endpoint'] ?? null);
    $id = hash('sha256', $data['endpoint']);
    $subscription = $action === 'subscribe' ? adminPushSubscription($data['subscription'] ?? null) : null;
    if ($subscription && $subscription['endpoint'] !== $data['endpoint']) throw new InvalidArgumentException('Endpoint mismatch');
    $preferences = $action === 'subscribe' ? adminPushPreferences($data['preferences'] ?? null) : null;
    $result = adminPushLocked(function ($dir) use ($action, $id, $subscription, $preferences) {
        $all = adminPushRead($dir, 'subscriptions');
        if ($action === 'subscribe') {
            if (!isset($all[$id]) && count($all) >= 10) throw new RuntimeException('Maximum ten subscribed devices');
            $all[$id] = ['subscription' => $subscription, 'preferences' => $preferences,
                'updatedAt' => bin2hex(random_bytes(16))];
        } elseif ($action === 'unsubscribe') unset($all[$id]);
        if ($action !== 'status') adminPushWrite($dir, 'subscriptions', $all);
        return ['ok' => true, 'subscribed' => isset($all[$id]), 'preferences' => $all[$id]['preferences'] ?? null];
    });
    echo json_encode($result);
} catch (InvalidArgumentException $error) {
    siteControlFail(400, 'Abonnement ou préférences invalides. Services Apple, Google et Mozilla uniquement.');
} catch (Throwable $error) {
    error_log('[admin-push] Configuration unavailable (' . get_class($error) . ').');
    siteControlFail(503, 'Notifications indisponibles : vérifiez PHP 8.2+, curl, openssl, mbstring, le stockage protégé et la limite de dix appareils.');
}
