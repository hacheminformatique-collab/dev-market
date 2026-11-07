<?php
require_once __DIR__ . '/site-controls.php';
function siteMaintenanceGuard(string $endpoint): void {
    $controls = siteControls();
    $homeSettings = $endpoint === 'storage' && $_SERVER['REQUEST_METHOD'] === 'GET'
        && ($_GET['key'] ?? '') === 'paradise_settings';
    if (($controls['maintenance'] || is_file(dirname(__DIR__) . '/site-maintenance.flag'))
        && !$homeSettings && !siteAdminAuthenticated()) {
        header('Retry-After: 3600');
        siteControlFail(503, 'Site en maintenance. Seule la page d’accueil reste accessible.');
    }
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
}
