<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['groupId'])) {
    echo json_encode(['success' => false, 'error' => 'memberId and groupId are required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['delete'] = 'Confirm';
$_POST['confirm'] = $input['groupId'];

ob_start();
include $legacyRoot . '/student_fee_delete.php';
$full = ob_get_clean();

$result = [
    'success' => stripos($full, 'Your details are deleted') !== false,
    'message' => stripos($full, 'Your details are deleted') !== false
        ? 'Approved slip and fee entries deleted'
        : 'Delete failed',
];

echo json_encode($result);
exit(0);
