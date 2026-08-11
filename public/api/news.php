<?php
/**
 * news.php – Server-side Google News RSS proxy.
 *
 * GET /api/news.php?city=<city name>
 *   → Returns a JSON array of up to 5 recent news items for the given city:
 *     [{ "title": "...", "link": "...", "pubDate": "...", "source": "...", "desc": "..." }, ...]
 *
 * Fetching RSS on the server avoids all browser CORS restrictions.
 * Results are cached for 30 minutes in storage-data/ to reduce upstream requests.
 */

header('Content-Type: application/json; charset=utf-8');

// ── Input validation ──────────────────────────────────────────────────────────
$city = isset($_GET['city']) ? trim((string) $_GET['city']) : '';
if ($city === '' || mb_strlen($city) > 120) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid city parameter']);
    exit;
}

// ── Cache setup ───────────────────────────────────────────────────────────────
$cacheDir  = realpath(__DIR__ . '/..') . '/storage-data';
$cacheKey  = 'news_' . preg_replace('/[^a-z0-9]+/', '_', strtolower($city));
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';
$cacheTtl  = 1800; // 30 minutes

if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0750, true);
}

// Serve from cache if fresh enough
if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false) {
        echo $cached;
        exit;
    }
}

// ── Fetch RSS from Google News ────────────────────────────────────────────────
$rssUrl = 'https://news.google.com/rss/search?q=' . urlencode($city) . '&hl=fr&gl=FR&ceid=FR:fr';

$ctx = stream_context_create([
    'http' => [
        'timeout'          => 8,
        'follow_location'  => 1,
        'max_redirects'    => 5,
        'user_agent'       => 'Mozilla/5.0 (compatible; NewsProxy/1.0)',
        'ignore_errors'    => true,
    ],
    'ssl' => [
        'verify_peer'       => true,
        'verify_peer_name'  => true,
    ],
]);

$xml = @file_get_contents($rssUrl, false, $ctx);

if ($xml === false || $xml === '') {
    http_response_code(502);
    echo json_encode(['error' => 'Could not fetch RSS feed']);
    exit;
}

// ── Parse XML ─────────────────────────────────────────────────────────────────
libxml_use_internal_errors(true);
$doc = simplexml_load_string($xml);
libxml_clear_errors();

if ($doc === false || !isset($doc->channel->item)) {
    http_response_code(502);
    echo json_encode(['error' => 'Could not parse RSS feed']);
    exit;
}

$items  = [];
$count  = 0;

foreach ($doc->channel->item as $item) {
    if ($count >= 5) break;

    $rawTitle = trim((string) $item->title);
    // Google News appends "– Source Name" to titles; strip it for cleaner display
    $title = preg_replace('/\s*[-–]\s+[^\-–]{2,60}$/', '', $rawTitle);

    $link    = trim((string) $item->link);
    $pubDate = trim((string) $item->pubDate);
    $source  = trim((string) ($item->source ?? ''));

    // description may contain HTML entities and tags
    $rawDesc   = trim((string) $item->description);
    $cleanDesc = html_entity_decode(strip_tags($rawDesc), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $desc      = mb_substr($cleanDesc, 0, 180);

    if ($title === '') continue;

    $items[] = [
        'title'   => $title,
        'link'    => $link,
        'pubDate' => $pubDate,
        'source'  => $source,
        'desc'    => $desc,
    ];
    $count++;
}

if (count($items) === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'No items found in feed']);
    exit;
}

$json = json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Write to cache
@file_put_contents($cacheFile, $json, LOCK_EX);

echo $json;
