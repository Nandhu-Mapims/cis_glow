<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['w'])) {
    echo json_encode([0]);
    exit(1);
}

legacy_bridge_bootstrap($input);

$_REQUEST['flag'] = 1;
$_REQUEST['w'] = $input['w'];
$_REQUEST['d'] = $input['d'];
$_REQUEST['c'] = $input['c'] ?? '';
$_REQUEST['t'] = $input['t'] ?? '';
$_REQUEST['cRefresh'] = $input['cRefresh'] ?? 0;
$_REQUEST['ugr'] = $input['ugr'] ?? '';
$_REQUEST['uga'] = $input['uga'] ?? '';
$_REQUEST['pgr'] = $input['pgr'] ?? '';

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
ob_start();
include $legacyRoot . '/dashboard_more.php';
$output = ob_get_clean();
if ($output !== '') {
    echo $output;
}
