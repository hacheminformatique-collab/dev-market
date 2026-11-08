<?php
require_once __DIR__ . '/site-guard.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') siteControlFail(405, 'Méthode non autorisée.');
quoteMaintenanceGuard();
echo json_encode(['ok' => true, 'quoteMaintenance' => false]);
