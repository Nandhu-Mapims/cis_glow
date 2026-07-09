<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    http_response_code(400);
    echo 'memberId required';
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = $input['query'] ?? [];
$_REQUEST = $_GET;

ob_start();
include $legacyRoot . '/term_mark_sheet_print.php';
echo ob_get_clean();
exit(0);
