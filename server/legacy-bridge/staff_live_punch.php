<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['staffId'])) {
    echo json_encode(['error' => 'staffId is required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['staff_id'] = strtoupper(strtolower(trim($input['staffId'])));
$_GET['flag'] = 1;
$_GET['msg'] = $input['photoMsg'] ?? '-';
$_REQUEST = $_GET;

ob_start();
include $legacyRoot . '/staff_live_attendance_more.php';
$raw = trim(ob_get_clean());

echo $raw;
