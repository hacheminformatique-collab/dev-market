<?php
/**
 * blog-autopublish.php – Server-side cron trigger for automatic blog publishing.
 *
 * USAGE
 *   Configure an external cron (e.g. cron-job.org) to call this URL every day:
 *     GET https://yoursite.com/api/blog-autopublish.php?token=YOUR_CRON_SECRET
 *
 *   This script will check whether the configured interval has elapsed since the
 *   last auto-publish and, if so, pick a pending topic and generate an article
 *   via the GitHub Models API (same endpoint used by the JS frontend).
 *
 * SECURITY
 *   Protected by a shared secret stored in paradise_blog_config.json.
 *   Set `cronSecret` in the Dashboard → Blog → Configuration tab first.
 *
 * DATA FILES (relative to this api/ directory, inside storage-data/)
 *   paradise_blog_config.json   – Blog configuration (token, interval, etc.)
 *   paradise_blog_articles.json – All blog articles { [slug]: Article }
 *   paradise_blog_autolog.json  – Execution log (last 50 entries)
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// ── Helpers ─────────────────────────────────────────────────────────────────

$dataDir = realpath(__DIR__ . '/..') . '/storage-data';

function readJson(string $key): mixed {
    global $dataDir;
    $file = $dataDir . '/' . $key . '.json';
    if (!is_file($file) || !is_readable($file)) return null;
    $raw = file_get_contents($file);
    $data = json_decode($raw, true);
    return (json_last_error() === JSON_ERROR_NONE) ? $data : null;
}

function writeJson(string $key, mixed $data): bool {
    global $dataDir;
    if (!is_dir($dataDir)) @mkdir($dataDir, 0750, true);
    $file = $dataDir . '/' . $key . '.json';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $json, LOCK_EX) === false) return false;
    return rename($tmp, $file);
}

function slugify(string $title): string {
    $slug = mb_strtolower($title, 'UTF-8');
    $slug = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $slug);
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    return trim(substr($slug, 0, 80), '-');
}

function appendLog(array $entry): void {
    $log = readJson('paradise_blog_autolog') ?? [];
    array_unshift($log, $entry);
    $log = array_slice($log, 0, 50);
    writeJson('paradise_blog_autolog', $log);
}

function respond(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Token validation ─────────────────────────────────────────────────────────

$token = isset($_GET['token']) ? trim((string) $_GET['token']) : '';

$config = readJson('paradise_blog_config');
$cronSecret = $config['cronSecret'] ?? '';

if ($cronSecret === '' || $token === '') {
    appendLog(['at' => date('c'), 'status' => 'error', 'source' => 'cron-php', 'error' => 'Cron secret not configured or token missing']);
    respond(401, ['error' => 'Unauthorized: configure cronSecret in Blog settings first']);
}

if (!hash_equals($cronSecret, $token)) {
    appendLog(['at' => date('c'), 'status' => 'error', 'source' => 'cron-php', 'error' => 'Invalid token']);
    respond(403, ['error' => 'Forbidden: invalid token']);
}

// ── Check interval ───────────────────────────────────────────────────────────

$intervalDays = (int) ($config['autoPublishIntervalDays'] ?? 5);
$lastPublish  = $config['lastAutoPublish'] ?? null;

if ($lastPublish !== null) {
    $lastTs   = strtotime($lastPublish);
    $daysSince = (time() - $lastTs) / 86400;
    if ($daysSince < $intervalDays) {
        respond(200, [
            'ran'     => false,
            'message' => "Next publish in " . round($intervalDays - $daysSince, 1) . " days",
        ]);
    }
}

// ── Pick a pending topic ─────────────────────────────────────────────────────

$articles   = readJson('paradise_blog_articles') ?? [];
$usedSlugs  = array_keys($articles);

/*
 * Embedded topic pool (subset of the full JS BLOG_TOPICS list).
 * This avoids a JSON import dependency and covers all 16 clusters.
 */
$allTopics = [
    ['theme'=>'Budget & Financement','title'=>'Comment établir le budget de son mariage ?','keywords'=>['budget mariage','financement mariage']],
    ['theme'=>'Budget & Financement','title'=>'Prix moyen d\'un mariage en France en 2025','keywords'=>['prix mariage','coût mariage']],
    ['theme'=>'Budget & Financement','title'=>'Mariage pas cher : astuces et idées pour se marier à petit budget','keywords'=>['mariage pas cher','petit budget mariage']],
    ['theme'=>'Organisation & Planning','title'=>'Rétroplanning mariage : le guide complet mois par mois','keywords'=>['rétroplanning mariage','planning mariage']],
    ['theme'=>'Organisation & Planning','title'=>'Par où commencer quand on organise son mariage ?','keywords'=>['organiser mariage','premières étapes mariage']],
    ['theme'=>'Organisation & Planning','title'=>'La checklist ultime de l\'organisation de mariage','keywords'=>['checklist mariage','liste organisation']],
    ['theme'=>'Organisation & Planning','title'=>'Comment choisir sa date de mariage ?','keywords'=>['date mariage','choisir date mariage']],
    ['theme'=>'Organisation & Planning','title'=>'Les 10 erreurs à éviter quand on organise son mariage','keywords'=>['erreurs organisation mariage','pièges mariage']],
    ['theme'=>'Salle de réception','title'=>'Comment choisir sa salle de mariage ?','keywords'=>['choisir salle mariage','critères salle mariage']],
    ['theme'=>'Salle de réception','title'=>'Quand réserver sa salle de mariage ? Les bons délais à respecter','keywords'=>['réserver salle mariage','délai réservation mariage']],
    ['theme'=>'Salle de réception','title'=>'Louer une salle pour 100, 200 ou 300 personnes : ce qu\'il faut savoir','keywords'=>['salle 100 personnes','grande salle mariage']],
    ['theme'=>'Traiteur & Restauration','title'=>'Comment choisir son traiteur de mariage ?','keywords'=>['choisir traiteur mariage','sélectionner traiteur']],
    ['theme'=>'Traiteur & Restauration','title'=>'Menu de mariage : comment le composer pour satisfaire tous vos invités ?','keywords'=>['menu mariage','composer menu']],
    ['theme'=>'Traiteur & Restauration','title'=>'Mariage halal : comment trouver le bon traiteur ?','keywords'=>['mariage halal','traiteur halal']],
    ['theme'=>'Traiteur & Restauration','title'=>'Pièce montée ou wedding cake : que choisir pour votre mariage ?','keywords'=>['pièce montée mariage','wedding cake']],
    ['theme'=>'Cérémonie civile','title'=>'Comment préparer sa cérémonie civile en mairie ?','keywords'=>['cérémonie civile','mariage civil mairie']],
    ['theme'=>'Cérémonie civile','title'=>'Documents nécessaires pour se marier en France','keywords'=>['documents mariage','pièces justificatives mariage']],
    ['theme'=>'Cérémonie religieuse & Laïque','title'=>'Cérémonie laïque de mariage : comment l\'organiser ?','keywords'=>['cérémonie laïque','mariage laïc']],
    ['theme'=>'Cérémonie religieuse & Laïque','title'=>'Écrire ses vœux de mariage : conseils et exemples inspirants','keywords'=>['vœux mariage','discours vœux mariage']],
    ['theme'=>'Décoration & Fleurs','title'=>'Décoration de mariage : comment créer son thème de A à Z ?','keywords'=>['décoration mariage','thème mariage']],
    ['theme'=>'Décoration & Fleurs','title'=>'Choisir ses fleurs de mariage : le guide complet','keywords'=>['fleurs mariage','bouquet mariée']],
    ['theme'=>'Décoration & Fleurs','title'=>'Centres de table pour mariage : idées et inspirations 2025','keywords'=>['centres de table mariage','décoration table']],
    ['theme'=>'Décoration & Fleurs','title'=>'Thèmes de mariage les plus tendance pour 2024-2025','keywords'=>['tendances mariage 2025','thèmes mariage']],
    ['theme'=>'Tenues & Beauté','title'=>'Comment choisir sa robe de mariée ? Le guide complet','keywords'=>['choisir robe mariée','guide robe mariage']],
    ['theme'=>'Tenues & Beauté','title'=>'Les grandes tendances de la robe de mariée en 2025','keywords'=>['tendances robe mariée','mode mariage 2025']],
    ['theme'=>'Photo & Vidéo','title'=>'Comment choisir son photographe de mariage ?','keywords'=>['photographe mariage','choisir photographe']],
    ['theme'=>'Photo & Vidéo','title'=>'Les photos de mariage qu\'on regrette de ne pas avoir prises','keywords'=>['photos oubliées mariage','liste photos mariage']],
    ['theme'=>'Animations & Musique','title'=>'Comment choisir son DJ de mariage ?','keywords'=>['choisir DJ mariage','DJ réception']],
    ['theme'=>'Animations & Musique','title'=>'Playlist mariage : les incontournables pour faire danser vos invités','keywords'=>['playlist mariage','musique danse mariage']],
    ['theme'=>'Invités & Logistique','title'=>'Comment établir sa liste d\'invités pour le mariage ?','keywords'=>['liste invités mariage','combien invités']],
    ['theme'=>'Invités & Logistique','title'=>'RSVP mariage : comment gérer les réponses efficacement ?','keywords'=>['RSVP mariage','réponses invités']],
    ['theme'=>'Faire-part & Papeterie','title'=>'Comment choisir ses faire-part de mariage en 2025 ?','keywords'=>['faire-part mariage','choisir faire-part']],
    ['theme'=>'Faire-part & Papeterie','title'=>'Save the date mariage : pourquoi c\'est indispensable ?','keywords'=>['save the date mariage','pré-invitation mariage']],
    ['theme'=>'Jour J & Programme','title'=>'Planning du jour J : de la préparation matinale à la fin de la soirée','keywords'=>['planning jour J','programme mariage']],
    ['theme'=>'Jour J & Programme','title'=>'Traditions françaises du mariage : les incontournables à connaître','keywords'=>['traditions mariage français','coutumes mariage France']],
    ['theme'=>'Lune de miel','title'=>'Comment choisir sa destination de lune de miel ?','keywords'=>['lune de miel','voyage de noces']],
    ['theme'=>'Lune de miel','title'=>'Budget lune de miel : combien prévoir pour le voyage de noces ?','keywords'=>['budget lune miel','coût voyage noces']],
    ['theme'=>'Mariage thématique','title'=>'Mariage champêtre-chic : idées, inspirations et organisation','keywords'=>['mariage champêtre','mariage rustique chic']],
    ['theme'=>'Mariage thématique','title'=>'Mariage bohème : comment créer une ambiance free spirit ?','keywords'=>['mariage bohème','thème boho mariage']],
    ['theme'=>'Mariage en Île-de-France','title'=>'Pourquoi organiser son mariage en Seine-et-Marne ?','keywords'=>['mariage Seine-et-Marne','salle mariage 77']],
    ['theme'=>'Mariage en Île-de-France','title'=>'Accessibilité depuis Paris pour un mariage en Seine-et-Marne','keywords'=>['accès Paris Seine-et-Marne','transport mariage 77']],
];

// Filter out already-generated topics
$pending = array_filter($allTopics, function(array $topic) use ($usedSlugs): bool {
    return !in_array(slugify($topic['title']), $usedSlugs, true);
});
$pending = array_values($pending);

if (count($pending) === 0) {
    respond(200, ['ran' => false, 'message' => 'All topics already generated']);
}

// Pick one at random
$topic = $pending[array_rand($pending)];

// ── Generate content via GitHub Models API ────────────────────────────────────

$githubToken = $config['githubToken'] ?? '';
if ($githubToken === '') {
    appendLog(['at' => date('c'), 'status' => 'error', 'source' => 'cron-php', 'error' => 'No GitHub token configured']);
    respond(500, ['error' => 'No GitHub token configured — set it in Blog settings']);
}

$businessName = $config['businessName'] ?? 'Le Paradise 77';
$tone         = $config['tone'] ?? 'chaleureux, expert, rassurant';
$lengthKey    = $config['articleLength'] ?? 'medium';
$wordTarget   = match($lengthKey) { 'short' => 600, 'long' => 1500, default => 1000 };
$maxTokens    = match($lengthKey) { 'short' => 1100, 'long' => 2800, default => 1900 };
$kws          = implode(', ', $topic['keywords'] ?? []);

$prompt = <<<EOT
Tu es un expert en rédaction de blog pour des futurs mariés en France.
Rédige un article de blog ORIGINAL, INFORMATIF et UNIQUE pour le blog d'une salle de mariage de prestige.
L'établissement s'appelle "{$businessName}" (salle de réception en Seine-et-Marne 77).

Titre de l'article : "{$topic['title']}"
Thème / catégorie : {$topic['theme']}
Mots-clés principaux : {$kws}
Ton éditorial : {$tone}
Longueur cible : environ {$wordTarget} mots

RÈGLES :
- Contenu 100% ORIGINAL et utile pour les futurs mariés français
- Cite "{$businessName}" de façon naturelle 1-2 fois maximum
- Inclure UNE mention vers /devis quand pertinent
- Format Markdown : ## pour H2, ### pour H3
- Commence directement par le premier ## sans introduction
- Au minimum 4 sections avec H2
- Style : {$tone}, pratique et concret
- Termine par un paragraphe renvoyant vers {$businessName} et /devis
EOT;

$payload = json_encode([
    'model'      => 'gpt-4o',
    'messages'   => [['role' => 'user', 'content' => $prompt]],
    'max_tokens' => $maxTokens,
    'temperature'=> 0.85,
], JSON_UNESCAPED_UNICODE);

$ctx = stream_context_create([
    'http' => [
        'method'        => 'POST',
        'header'        => "Authorization: Bearer " . $githubToken . "\r\nContent-Type: application/json\r\n",
        'content'       => $payload,
        'timeout'       => 60,
        'ignore_errors' => true,
    ],
    'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
]);

$response = @file_get_contents('https://models.inference.ai.azure.com/chat/completions', false, $ctx);

if ($response === false || $response === '') {
    appendLog(['at' => date('c'), 'status' => 'error', 'source' => 'cron-php', 'error' => 'API request failed']);
    respond(502, ['error' => 'GitHub Models API request failed']);
}

$json    = json_decode($response, true);
$content = $json['choices'][0]['message']['content'] ?? '';
$content = trim($content);

// Strip code-fence wrappers
$lines   = explode("\n", $content);
$lines   = array_filter($lines, fn($l) => !preg_match('/^```/', trim($l)));
$content = trim(implode("\n", array_values($lines)));

if ($content === '') {
    appendLog(['at' => date('c'), 'status' => 'error', 'source' => 'cron-php', 'error' => 'Empty content from API']);
    respond(502, ['error' => 'Empty content returned from API']);
}

// ── Build article ─────────────────────────────────────────────────────────────

$slug = slugify($topic['title']);
// Make unique if slug already taken
$base = $slug;
$n = 2;
while (isset($articles[$slug])) {
    $slug = $base . '-' . $n;
    $n++;
}

// Extract excerpt: first meaningful paragraph (not a heading, not a bullet)
$excerpt = '';
foreach (explode("\n", $content) as $line) {
    $t = trim($line);
    if ($t === '' || str_starts_with($t, '#') || str_starts_with($t, '-') || str_starts_with($t, '•') || str_starts_with($t, '[')) continue;
    $clean = preg_replace('/\*\*/', '', $t);
    if (mb_strlen($clean) > 40) { $excerpt = mb_substr($clean, 0, 180) . '…'; break; }
}

$now = date('c');
$article = [
    'slug'           => $slug,
    'title'          => $topic['title'],
    'excerpt'        => $excerpt,
    'content'        => $content,
    'theme'          => $topic['theme'],
    'keywords'       => $topic['keywords'] ?? [],
    'status'         => 'published',
    'createdAt'      => $now,
    'publishedAt'    => $now,
    'updatedAt'      => $now,
    'seoTitle'       => "{$topic['title']} — {$businessName}",
    'seoDescription' => mb_substr($excerpt, 0, 155),
    'relatedSlugs'   => [],
    'internalLinks'  => [
        ['href' => '/devis', 'label' => "Demander un devis gratuit — {$businessName}"],
        ['href' => '/blog',  'label' => 'Tous nos articles mariage'],
    ],
];

$articles[$slug] = $article;
writeJson('paradise_blog_articles', $articles);

// ── Update config ─────────────────────────────────────────────────────────────

$config['lastAutoPublish'] = $now;
writeJson('paradise_blog_config', $config);

// ── Log success ───────────────────────────────────────────────────────────────

appendLog([
    'at'     => $now,
    'slug'   => $slug,
    'title'  => $topic['title'],
    'theme'  => $topic['theme'],
    'status' => 'success',
    'source' => 'cron-php',
]);

respond(200, [
    'ran'   => true,
    'slug'  => $slug,
    'title' => $topic['title'],
    'theme' => $topic['theme'],
]);
