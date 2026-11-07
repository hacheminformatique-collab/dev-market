<?php
// Publish only wedding HTML files and SEO files, using the saved admin PIN.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function failPublication(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function writePublication(string $path, string $content): void {
    $tmp = tempnam(dirname($path), '.publication-');
    if ($tmp === false) {
        failPublication(500, 'Impossible de créer un fichier temporaire. Vérifiez les droits du serveur.');
    }
    if (file_put_contents($tmp, $content, LOCK_EX) === false || !chmod($tmp, 0644) || !rename($tmp, $path)) {
        unlink($tmp);
        failPublication(500, 'Écriture impossible. Vérifiez les droits du dossier de publication.');
    }
}

function writeIfChanged(string $path, string $content): void {
    if (is_link($path)) failPublication(409, 'Un fichier de publication est un lien symbolique.');
    if (is_file($path)) {
        $existing = file_get_contents($path);
        if ($existing === false) failPublication(500, 'Impossible de lire un fichier publié. Aucun remplacement n’a été effectué.');
        if ($existing === $content) return;
    }
    writePublication($path, $content);
}

function validCitySlug($slug): bool {
    return is_string($slug) && strlen($slug) <= 120 && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) === 1;
}

function cityAliases($value): array {
    if (!is_array($value) || count($value) > 6000) failPublication(400, 'Correspondances des villes invalides.');
    foreach ($value as $old => $new) {
        if (!validCitySlug($old) || !validCitySlug($new)
            || !preg_match('/^' . preg_quote($old, '/') . '-[0-9]{5}$/D', $new)) {
            failPublication(400, 'Identifiant ville-code postal invalide.');
        }
    }
    return $value;
}

function cityFile(string $root, string $slug): string {
    return $root . '/locationsalledemariage/' . $slug . '.html';
}

function weddingDepartmentCodes(): array {
    return ['75', '77', '78', '91', '92', '93', '94', '95', '02', '27', '28', '45', '51', '60', '76', '89'];
}

function departmentFolder(string $root): string {
    $parent = $root . '/locationsalledemariage';
    $folder = $parent . '/departements';
    foreach ([$parent, $folder] as $path) {
        if (is_link($path) || (file_exists($path) && !is_dir($path))) failPublication(409, 'Dossier des départements invalide.');
    }
    return $folder;
}

function readCityFile(string $path) {
    if (is_link($path)) failPublication(409, 'Un fichier de page est un lien symbolique ; publication arrêtée.');
    if (!file_exists($path)) return false;
    $html = file_get_contents($path);
    if ($html === false) failPublication(500, 'Impossible de lire un fichier de page publié.');
    return $html;
}

function snapshotFingerprint(string $html) {
    if (!preg_match('~<script id="city-page-data" type="application/json">(.*?)</script>~s', $html, $matches)) return false;
    $snapshot = json_decode($matches[1]);
    if (!is_object($snapshot) || !isset($snapshot->page, $snapshot->config, $snapshot->gallery, $snapshot->blogArticles)) return false;
    $value = [
        'page' => $snapshot->page,
        'config' => $snapshot->config,
        'gallery' => $snapshot->gallery,
        'blogArticles' => $snapshot->blogArticles,
    ];
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
    return $json === false ? false : hash('sha256', $json);
}

function assertUnchangedFile($html, $expected): void {
    $actual = $html === false ? 'missing' : hash('sha256', $html);
    if (!is_string($expected) || !hash_equals($actual, $expected)) {
        failPublication(409, 'La page a changé depuis la vérification. Relancez la publication pour protéger le fichier.');
    }
}

function cityDirectoryHash(string $html) {
    $start = '<!-- CITY_DIRECTORY_START -->';
    $end = '<!-- CITY_DIRECTORY_END -->';
    if (substr_count($html, $start) !== 1 || substr_count($html, $end) !== 1
        || strpos($html, $end) < strpos($html, $start)
        || strpos($html, 'src="/shared-wedding-directory-v1.js"') !== false) return null;
    $from = strpos($html, $start) + strlen($start);
    return hash('sha256', substr($html, $from, strpos($html, $end) - $from));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    failPublication(405, 'Méthode non autorisée.');
}

$root = realpath(__DIR__ . '/..');
$settingsFile = $root . '/storage-data/paradise_settings.json';
if (!is_readable($settingsFile)) {
    failPublication(403, 'Enregistrez Mes Infos sur le serveur avant de publier.');
}
$settings = json_decode(file_get_contents($settingsFile), true);
$savedPin = $settings['pin'] ?? null;
$providedPin = $_SERVER['HTTP_X_ADMIN_PIN'] ?? '';
if (!is_string($savedPin) || $savedPin === '' || !hash_equals($savedPin, $providedPin)) {
    failPublication(403, 'Publication non autorisée. Reconnectez-vous avec le code PIN enregistré.');
}

$lock = @fopen($root . '/storage-data/.publication.lock', 'c+');
if (!$lock || !flock($lock, LOCK_EX)) {
    if ($lock) fclose($lock);
    failPublication(500, 'Impossible de verrouiller la publication. Vérifiez les droits du stockage serveur.');
}

$body = file_get_contents('php://input');
if (strlen($body) > 15 * 1024 * 1024) {
    failPublication(413, 'Page trop volumineuse (maximum 15 Mo). Réduisez la taille de la galerie.');
}
$data = json_decode($body, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    failPublication(400, 'Requête JSON invalide. Vérifiez aussi la limite PHP post_max_size.');
}

$cityDirectory = $root . '/locationsalledemariage';
if (is_link($cityDirectory) || (file_exists($cityDirectory) && !is_dir($cityDirectory))) {
    failPublication(500, 'Le dossier de publication est invalide.');
}

if (($data['action'] ?? '') === 'inspect') {
    if (!array_key_exists('aliases', $data)) failPublication(409, 'Rechargez le dashboard pour utiliser les identifiants ville-code postal.');
    $aliases = cityAliases($data['aliases'] ?? []);
    $slugs = $data['slugs'] ?? null;
    if (!is_array($slugs) || count($slugs) > 6000) failPublication(400, 'Liste de villes invalide.');
    $registryFile = $root . '/wedding-pages.json';
    $previous = [];
    $registryHash = 'missing';
    if (is_link($registryFile)) failPublication(409, 'Registre des pages publiées invalide.');
    if (is_file($registryFile)) {
        $registryContent = file_get_contents($registryFile);
        if ($registryContent === false) failPublication(500, 'Impossible de lire le registre des pages publiées.');
        $registryHash = hash('sha256', $registryContent);
        $previous = json_decode($registryContent, true);
        if (!is_array($previous) || array_values($previous) !== $previous || count($previous) > 6000) {
            failPublication(409, 'Registre des pages publiées invalide. Aucun fichier ne sera remplacé.');
        }
    }
    foreach (array_merge($previous, $slugs) as $slug) {
        if (!validCitySlug($slug)) failPublication(400, 'Identifiant de ville invalide.');
    }
    $legacyPages = [];
    foreach ($previous as $slug) {
        if (isset($aliases[$slug])) {
            $legacyPages[$aliases[$slug]] = $slug;
        }
    }
    $previous = array_values(array_unique(array_map(function ($slug) use ($aliases) { return $aliases[$slug] ?? $slug; }, $previous)));
    $result = [];
    foreach (array_unique(array_merge($previous, $slugs)) as $slug) {
        if (!validCitySlug($slug)) failPublication(400, 'Identifiant de ville invalide.');
        $html = readCityFile(cityFile($root, $slug));
        if ($html === false) {
            if (isset($legacyPages[$slug])) {
                $legacyHtml = readCityFile(cityFile($root, $legacyPages[$slug]));
                if ($legacyHtml === false || snapshotFingerprint($legacyHtml) === false) failPublication(409, 'Ancienne page publiée absente ou invalide : ' . $slug);
                preg_match('~<script id="city-page-data" type="application/json">(.*?)</script>~s', $legacyHtml, $matches);
                $saved = json_decode($matches[1]);
                $result[$slug] = ['fileHash' => 'missing', 'fingerprint' => null, 'directoryHash' => null,
                    'legacySlug' => $legacyPages[$slug], 'legacyHash' => hash('sha256', $legacyHtml),
                    'businessName' => $saved->config->businessName ?? 'Le Paradise 77', 'generatedAt' => $saved->page->generatedAt ?? null];
                continue;
            }
            if (in_array($slug, $previous, true)) failPublication(409, 'Une page du registre est absente : ' . $slug . '. Vérifiez les fichiers publiés.');
            $result[$slug] = ['fileHash' => 'missing', 'fingerprint' => null, 'directoryHash' => null];
        } else {
            $fingerprint = snapshotFingerprint($html);
            if ($fingerprint === false) failPublication(409, 'Une page existante ne contient pas de données de publication reconnues : ' . $slug . '. Aucun fichier ne sera remplacé.');
            preg_match('~<script id="city-page-data" type="application/json">(.*?)</script>~s', $html, $snapshotMatch);
            $savedSnapshot = json_decode($snapshotMatch[1] ?? '');
            $result[$slug] = [
                'fileHash' => hash('sha256', $html),
                'fingerprint' => $fingerprint,
                'directoryHash' => cityDirectoryHash($html),
                'businessName' => !empty($savedSnapshot->config->businessName) ? $savedSnapshot->config->businessName : 'Le Paradise 77',
                'generatedAt' => $savedSnapshot->page->generatedAt ?? null,
            ];
        }
    }
    $departments = [];
    $departmentFolder = departmentFolder($root);
    foreach (weddingDepartmentCodes() as $code) {
        $html = readCityFile($departmentFolder . '/' . $code . '.html');
        $departments[$code] = $html === false ? 'missing' : hash('sha256', $html);
    }
    echo json_encode(['ok' => true, 'pages' => $result, 'departments' => (object)$departments, 'publishedSlugs' => $previous, 'registryHash' => $registryHash]);
    exit;
} elseif (($data['action'] ?? '') === 'city-directory') {
    $slug = $data['slug'] ?? '';
    if (!validCitySlug($slug)) failPublication(400, 'Identifiant de ville invalide.');
    $directoryHtml = $data['directory'] ?? null;
    $styles = $data['styles'] ?? null;
    if (!is_string($directoryHtml) || strpos($directoryHtml, '<section class="wedding-directory"') !== 0
        || substr($directoryHtml, -10) !== '</section>' || !is_string($styles)
        || strpos($styles, '.wedding-directory') === false || stripos($styles, '</style') !== false) {
        failPublication(400, 'Annuaire ou styles de ville invalides.');
    }
    preg_match_all('~href="/locationsalledemariage/([a-z0-9-]+)"~', $directoryHtml, $links);
    if (!in_array($slug, $links[1], true)) failPublication(400, 'La ville est absente de son annuaire.');
    $path = cityFile($root, $slug);
    $html = readCityFile($path);
    assertUnchangedFile($html, $data['expectedHash'] ?? null);
    if ($html === false || snapshotFingerprint($html) === false) failPublication(409, 'Page existante non reconnue.');
    $start = '<!-- CITY_DIRECTORY_START -->';
    $end = '<!-- CITY_DIRECTORY_END -->';
    $block = $start . $directoryHtml . $end;
    if (substr_count($html, $start) === 1 && substr_count($html, $end) === 1
        && strpos($html, $end) > strpos($html, $start)) {
        $from = strpos($html, $start);
        $html = substr($html, 0, $from) . $block . substr($html, strpos($html, $end) + strlen($end));
    } elseif (strpos($html, $start) === false && strpos($html, $end) === false) {
        $anchor = '<script id="city-page-data" type="application/json">';
        if (substr_count($html, $anchor) !== 1) failPublication(409, 'Page incompatible avec l’annuaire HTML.');
        // Keep legacy React markup intact so its original bundle can still hydrate.
        $legacyStyle = '<style id="legacy-wedding-directory-style">' . $styles
            . (strpos($html, '<section class="wedding-directory"') !== false ? "\n#root .wedding-directory{display:none!important}" : '')
            . "</style>\n";
        $html = str_replace($anchor, $legacyStyle . $block . "\n" . $anchor, $html);
    } else {
        failPublication(409, 'Balises de l’annuaire HTML invalides.');
    }
    $html = str_replace("<script defer src=\"/shared-wedding-directory-v1.js\"></script>\n", '', $html);
    if (strpos($html, 'src="/shared-wedding-directory-v1.js"') !== false) failPublication(409, 'Ancien script d’annuaire non reconnu.');
    writeIfChanged($path, $html);
    if (readCityFile($path) !== $html) failPublication(500, 'Impossible de vérifier l’annuaire écrit sur le serveur.');
    echo json_encode(['ok' => true, 'directoryHash' => cityDirectoryHash($html)]);
    exit;
} elseif (($data['action'] ?? '') === 'city-migrate') {
    $slug = $data['slug'] ?? null;
    $legacy = $data['legacySlug'] ?? null;
    cityAliases([$legacy ?? '' => $slug]);
    $oldHtml = readCityFile(cityFile($root, $legacy));
    assertUnchangedFile($oldHtml, $data['expectedHash'] ?? null);
    if ($oldHtml === false) failPublication(409, 'Ancienne page introuvable.');
    $path = cityFile($root, $slug);
    if (readCityFile($path) !== false) failPublication(409, 'La nouvelle adresse existe déjà. Relancez la publication.');
    preg_match('~<script id="city-page-data" type="application/json">(.*?)</script>~s', $oldHtml, $matches);
    $snapshot = json_decode($matches[1] ?? '', true);
    if (!is_array($snapshot) || ($snapshot['citySlug'] ?? '') !== $legacy) failPublication(409, 'Identité de l’ancienne page invalide.');
    $snapshot['citySlug'] = $slug;
    if (isset($snapshot['page']['city'])) $snapshot['page']['city']['slug'] = $slug;
    foreach (($snapshot['allTypePages'] ?? []) as $type => $pages) {
        if (isset($pages[$legacy])) {
            $snapshot['allTypePages'][$type][$slug] = $pages[$legacy];
            unset($snapshot['allTypePages'][$type][$legacy]);
        }
    }
    $json = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
    if ($json === false) failPublication(500, 'Migration des données de page impossible.');
    $html = str_replace($matches[0], '<script id="city-page-data" type="application/json">' . $json . '</script>', $oldHtml);
    $html = preg_replace('~(/locationsalledemariage/)' . preg_quote($legacy, '~') . '(?=["<])~', '$1' . $slug, $html);
    writeIfChanged($path, $html);
    echo json_encode(['ok' => true, 'fileHash' => hash('sha256', $html), 'directoryHash' => cityDirectoryHash($html)]);
    exit;
} elseif (($data['action'] ?? '') === 'department') {
    $code = $data['code'] ?? null;
    $html = $data['html'] ?? null;
    if (!is_string($code) || !in_array($code, weddingDepartmentCodes(), true)
        || !is_string($html) || stripos(ltrim($html), '<!doctype html>') !== 0
        || strpos($html, 'id="city-page-data"') === false
        || !preg_match('~<link rel="canonical" href="https?://[^/"]+/locationsalledemariage/departements/' . preg_quote($code, '~') . '"\s*/?>~', $html)) {
        failPublication(400, 'Département, document HTML ou canonical invalide.');
    }
    $folder = departmentFolder($root);
    if (!is_dir($folder) && !mkdir($folder, 0755, true)) failPublication(500, 'Création du dossier des départements impossible.');
    $path = $folder . '/' . $code . '.html';
    assertUnchangedFile(readCityFile($path), $data['expectedHash'] ?? null);
    writeIfChanged($path, $html);
} elseif (($data['action'] ?? '') === 'page') {
    $slug = $data['slug'] ?? '';
    $html = $data['html'] ?? '';
    if (!validCitySlug($slug)) {
        failPublication(400, 'Identifiant de ville invalide.');
    }
    if (!is_string($html) || stripos(ltrim($html), '<!doctype html>') !== 0
        || strpos($html, 'id="city-page-data"') === false
        || !preg_match('~<link rel="canonical" href="https?://[^/"]+/locationsalledemariage/' . preg_quote($slug, '~') . '"\s*/?>~', $html)) {
        failPublication(400, 'Document HTML ou canonical invalide.');
    }
    $directory = $root . '/locationsalledemariage';
    if (is_link($directory) || (file_exists($directory) && !is_dir($directory))) {
        failPublication(500, 'Le dossier de publication est invalide.');
    }
    if (!is_dir($directory) && !mkdir($directory, 0755)) {
        failPublication(500, 'Impossible de créer le dossier locationsalledemariage. Vérifiez les droits du serveur.');
    }
    $path = $directory . '/' . $slug . '.html';
    if (!array_key_exists('expectedHash', $data)) failPublication(409, 'Rechargez le dashboard : la version de publication est trop ancienne.');
    assertUnchangedFile(readCityFile($path), $data['expectedHash']);
    writeIfChanged($path, $html);
} elseif (($data['action'] ?? '') === 'seo') {
    if (!array_key_exists('aliases', $data)) failPublication(409, 'Rechargez le dashboard pour conserver les redirections des anciennes villes.');
    $aliases = cityAliases($data['aliases'] ?? []);
    if (!array_key_exists('expectedRegistryHash', $data)) failPublication(409, 'Rechargez le dashboard : la version de publication est trop ancienne.');
    assertUnchangedFile(readCityFile($root . '/wedding-pages.json'), $data['expectedRegistryHash']);
    $sitemap = $data['sitemap'] ?? null;
    $robots = $data['robots'] ?? null;
    if (!is_string($sitemap) || strpos(ltrim($sitemap), '<?xml') !== 0
        || !is_string($robots) || strpos($robots, 'User-agent:') !== 0) {
        failPublication(400, 'Sitemap ou robots.txt invalide.');
    }
    $directory = $data['directory'] ?? null;
    $idfDirectory = $data['idfDirectory'] ?? null;
    if (!is_string($idfDirectory) || ($idfDirectory !== '' && strpos($idfDirectory, '<section class="wedding-directory"') !== 0)) {
        failPublication(400, 'Annuaire Île-de-France invalide.');
    }
    $slugs = $data['slugs'] ?? null;
    $homeSeo = $data['homeSeo'] ?? null;
    $departmentCodes = $data['departmentCodes'] ?? [];
    if (!is_array($departmentCodes) || count($departmentCodes) > 16) failPublication(400, 'Liste des départements invalide.');
    foreach ($departmentCodes as $code) {
        if (!is_string($code) || !in_array($code, weddingDepartmentCodes(), true)
            || readCityFile(departmentFolder($root) . '/' . $code . '.html') === false) {
            failPublication(400, 'Département non publié.');
        }
    }
    $indexFile = $root . '/index.html';
    $index = is_readable($indexFile) ? file_get_contents($indexFile) : false;
    if (!is_string($directory) || strpos($directory, '<section class="wedding-directory"') !== 0
        || !is_array($slugs) || count($slugs) === 0 || !is_string($homeSeo)
        || strpos($homeSeo, '<title>') !== 0 || strpos($homeSeo, 'rel="canonical"') === false) {
        failPublication(400, 'Annuaire ou liste des pages publiées invalide.');
    }
    foreach ($slugs as $slug) {
        if (!is_string($slug) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug)
            || !is_file($root . '/locationsalledemariage/' . $slug . '.html')) {
            failPublication(400, 'L’annuaire contient une page qui n’a pas été publiée.');
        }
    }
    preg_match_all('~href="/locationsalledemariage/([a-z0-9-]+)"~', $directory, $links);
    $linkedSlugs = $links[1];
    $publishedSlugs = array_values(array_unique($slugs));
    sort($linkedSlugs);
    sort($publishedSlugs);
    if ($linkedSlugs !== $publishedSlugs) {
        failPublication(400, 'Les liens de l’annuaire ne correspondent pas aux pages publiées.');
    }
    preg_match_all('~href="/locationsalledemariage/([a-z0-9-]+)"~', $idfDirectory, $idfLinks);
    if (array_diff($idfLinks[1], $publishedSlugs)) failPublication(400, 'L’annuaire Île-de-France contient une ville non publiée.');
    preg_match_all('~href="/locationsalledemariage/departements/([^"]+)"~', $idfDirectory, $idfDepartments);
    if (array_diff($idfDepartments[1], ['75', '77', '78', '91', '92', '93', '94', '95'])) {
        failPublication(400, 'L’annuaire du blog contient un département hors Île-de-France.');
    }
    $start = '<!-- WEDDING_DIRECTORY_START -->';
    $end = '<!-- WEDDING_DIRECTORY_END -->';
    $seoStart = '<!-- HOME_SEO_START -->';
    $seoEnd = '<!-- HOME_SEO_END -->';
    if ($index === false || substr_count($index, $start) !== 1 || substr_count($index, $end) !== 1
        || strpos($index, $end) < strpos($index, $start)
        || substr_count($index, $seoStart) !== 1 || substr_count($index, $seoEnd) !== 1
        || strpos($index, $seoEnd) < strpos($index, $seoStart)) {
        failPublication(500, 'Modèle index.html incompatible. Déployez le dossier dist complet avant de republier.');
    }
    $index = substr($index, 0, strpos($index, $start)) . $start
        . "\n<div id=\"public-wedding-directory\">" . $directory . "</div>\n"
        . substr($index, strpos($index, $end));
    $index = substr($index, 0, strpos($index, $seoStart)) . $seoStart . "\n" . $homeSeo . "\n"
        . substr($index, strpos($index, $seoEnd));
    writeIfChanged($root . '/wedding-directory.html', $directory);
    writeIfChanged($root . '/wedding-directory-idf.html', $idfDirectory);
    writeIfChanged($root . '/wedding-pages.json', json_encode(array_values(array_unique($slugs))));
    writeIfChanged($root . '/wedding-city-aliases.json', json_encode((object)$aliases, JSON_UNESCAPED_SLASHES));
    writeIfChanged($root . '/wedding-departments.json', json_encode(array_values(array_unique($departmentCodes))));
    writeIfChanged($indexFile, $index);
    writeIfChanged($root . '/sitemap.xml', $sitemap);
    writeIfChanged($root . '/robots.txt', $robots);
} else {
    failPublication(400, 'Action de publication invalide.');
}

echo json_encode(['ok' => true]);
