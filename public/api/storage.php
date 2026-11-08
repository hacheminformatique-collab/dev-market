<?php
require_once __DIR__ . '/site-guard.php';
siteMaintenanceGuard('storage');
/**
 * storage.php – Shared JSON key-value store for the Paradise application.
 *
 * GET  /api/storage.php?key=<key>  → returns the stored JSON (or null)
 * POST /api/storage.php?key=<key>  → writes the JSON body and returns {"ok":true}
 *
 * Data files are written to ../storage-data/<key>.json (one level up from this
 * script, i.e. alongside the api/ folder in the deployed output).
 * That directory is protected from direct browser access by its own .htaccess.
 */

header('Content-Type: application/json; charset=utf-8');

// ── CORS headers (same-origin requests only in production) ──────────────────
// Uncomment and adjust the line below only if you host the API on a different
// origin than the front-end (not needed for standard deployments).
// header('Access-Control-Allow-Origin: https://yourdomain.com');

// ── Key validation ───────────────────────────────────────────────────────────
$key = isset($_GET['key']) ? (string) $_GET['key'] : '';
if (!preg_match('/^[a-zA-Z0-9_]{1,120}$/', $key)) {
    http_response_code(400);
    echo json_encode(null);
    exit;
}

// ── Data directory ───────────────────────────────────────────────────────────
$dataDir = realpath(__DIR__ . '/..') . '/storage-data';

// Create directory if it doesn't exist yet (chmod 0750: owner rwx, group rx)
if (!is_dir($dataDir)) {
    if (!mkdir($dataDir, 0750, true)) {
        http_response_code(500);
        echo json_encode(null);
        exit;
    }
    // Drop a protective .htaccess so Apache blocks direct HTTP access
    file_put_contents($dataDir . '/.htaccess', "Require all denied\n");
}

$file = $dataDir . '/' . $key . '.json';
$cityCollection = preg_match('/^paradise_city_pages(?:_backup)?(?:_(?:reception|anniversaire|bapteme|fiancaille|fiancailles|seminaire))?$/D', $key) === 1;
if ($cityCollection) require_once __DIR__ . '/city-json-stream.php';

// ── GET ──────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($cityCollection && is_file($file)) {
        $input = null;
        $failure = null;
        try {
            if (is_link($file)) throw new UnexpectedValueException('Lien de stockage interdit.');
            $input = fopen($file, 'rb');
            if (!$input) throw new RuntimeException('Lecture du stockage impossible.');
            cityJsonEntries($input, strpos($key, '_backup') === false);
            if (!rewind($input)) throw new RuntimeException('Lecture du stockage impossible.');
        } catch (JsonException | UnexpectedValueException $error) {
            $failure = [409, 'Le stockage existant est invalide. Aucun fichier ne sera remplacé.'];
        } catch (LengthException $error) {
            $failure = [413, $error->getMessage()];
        } catch (RuntimeException $error) {
            $failure = [500, $error->getMessage()];
        }
        if ($failure !== null) {
            if (is_resource($input)) fclose($input);
            siteControlFail($failure[0], $failure[1]);
        }
        while (!feof($input)) {
            $chunk = fread($input, 65536);
            if ($chunk === false) {
                fclose($input);
                error_log('[CityPagesStorage] Lecture de la réponse interrompue.');
                siteControlFail(500, 'Lecture du stockage impossible.');
            }
            echo $chunk;
        }
        fclose($input);
        exit;
    }
    if (is_file($file) && is_readable($file)) {
        $raw = file_get_contents($file);
        // Validate the stored content is still valid JSON before sending it
        json_decode($raw);
        if (json_last_error() === JSON_ERROR_NONE) {
            if ($key === 'paradise_settings' && !siteAdminAuthenticated(false)) {
                $settings = json_decode($raw, true);
                if (is_array($settings)) unset($settings['pin']);
                echo json_encode($settings, JSON_UNESCAPED_UNICODE);
            } else {
                echo $raw;
            }
        } else {
            echo json_encode(null);
        }
    } else {
        echo json_encode(null);
    }
    exit;
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($key === 'paradise_settings' && is_file($file) && !siteAdminAuthenticated(false)) {
        siteControlFail(403, 'Modification des réglages refusée. Reconnectez-vous.');
    }
    if ($cityCollection && (is_link($file) || is_link($file . '.lock'))) siteControlFail(409, 'Lien de stockage interdit.');
    $lock = fopen($file . '.lock', 'c+');
    if (!$lock || !flock($lock, LOCK_EX)) {
        http_response_code(500);
        echo json_encode(['error' => 'Storage lock failed']);
        exit;
    }
    if ($cityCollection) {
        $tmp = tempnam($dataDir, '.city-pages-');
        $input = null;
        $output = null;
        $failure = null;
        try {
            if ($tmp === false) throw new RuntimeException('Fichier temporaire impossible. Vérifiez les droits et l’espace disque.');
            $input = fopen('php://input', 'rb');
            $output = fopen($tmp, 'w+b');
            if (!$input || !$output || stream_copy_to_stream($input, $output) === false || !fflush($output)) {
                throw new RuntimeException('Écriture du stockage impossible.');
            }
            cityJsonEntries($output, strpos($key, '_backup') === false);
            fclose($output);
            $output = null;
            if (!chmod($tmp, 0644) || !rename($tmp, $file)) throw new RuntimeException('Écriture du stockage impossible.');
        } catch (JsonException | UnexpectedValueException $error) {
            $failure = [400, 'Requête JSON invalide. Aucun fichier ne sera remplacé.'];
        } catch (LengthException $error) {
            $failure = [413, $error->getMessage()];
        } catch (RuntimeException $error) {
            $failure = [500, $error->getMessage()];
        } finally {
            if (is_resource($input)) fclose($input);
            if (is_resource($output)) fclose($output);
            if ($tmp !== false && is_file($tmp) && !unlink($tmp)) error_log('[CityPagesStorage] Nettoyage du fichier temporaire impossible.');
            flock($lock, LOCK_UN);
            fclose($lock);
        }
        if ($failure !== null) siteControlFail($failure[0], $failure[1]);
        echo json_encode(['ok' => true]);
        exit;
    }
    $body = file_get_contents('php://input');

    // Validate incoming payload is well-formed JSON
    json_decode($body);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }
    if ($key === 'paradise_clients' && siteControls()['quoteMaintenance']) {
        $incoming = json_decode($body, true);
        $existing = is_file($file) ? json_decode(file_get_contents($file), true) : [];
        if (!is_array($incoming) || !is_array($existing)) siteControlFail(503, 'Liste des devis illisible.');
        $ids = array_column($existing, 'id');
        foreach ($incoming as $client) {
            if (!is_array($client) || !isset($client['id']) || !in_array($client['id'], $ids, true)) quoteMaintenanceGuard();
        }
    }

    // Atomic write: write to a temp file then rename to avoid partial reads
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $body, LOCK_EX) !== strlen($body)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['error' => 'Write failed']);
        exit;
    }
    if (!rename($tmp, $file)) {
        @unlink($tmp);
        http_response_code(500);
        echo json_encode(['error' => 'Rename failed']);
        exit;
    }

    if ($key === 'paradise_settings' && session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['siteAdmin'])) {
        $saved = json_decode($body, true);
        if (is_string($saved['pin'] ?? null)) $_SESSION['siteAdmin'] = hash('sha256', $saved['pin']);
    }
    echo json_encode(['ok' => true]);
    exit;
}

// ── Unsupported method ────────────────────────────────────────────────────────
http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['error' => 'Method not allowed']);
