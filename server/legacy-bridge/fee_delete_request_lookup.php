<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['receiptNo'])) {
    echo json_encode(['error' => 'memberId and receiptNo required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_GET['receipt_no'] = $input['receiptNo'];
$_GET['flag'] = '1';

ob_start();
include $legacyRoot . '/fee_delete_request_more.php';
$raw = ob_get_clean();

$parts = explode('^^^^^', $raw, 2);
$html = trim($parts[0] ?? '');
$allow = trim($parts[1] ?? '') === 'allow';

if (!$allow) {
    echo json_encode(['error' => strip_tags($html) ?: 'Receipt not found', 'html' => $html]);
    exit(1);
}

echo json_encode(['html' => $html, 'allowed' => true]);
exit(0);
