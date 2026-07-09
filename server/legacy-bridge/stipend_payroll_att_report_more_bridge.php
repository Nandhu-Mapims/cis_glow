<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    echo json_encode(['error' => 'memberId required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$query = $input['query'] ?? [];
$_GET = $query;
$_REQUEST = array_merge($_GET, $_POST ?? []);

ob_start();
include $legacyRoot . '/stipend_payroll_att_report_more.php';
$body = ob_get_clean();

echo json_encode(['body' => $body]);
exit(0);
