<?php
require_once __DIR__ . '/site-controls.php';
header('Cache-Control: no-store');
if (!siteAdminAuthenticated(false)) siteControlFail(403, 'Accès administrateur requis.');
$manifest = json_decode(file_get_contents(dirname(__DIR__) . '/admin-push.webmanifest'), true);
$manifest['start_url'] = siteAdminPaths(siteControls())[1];
header('Content-Type: application/manifest+json; charset=utf-8');
echo json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
