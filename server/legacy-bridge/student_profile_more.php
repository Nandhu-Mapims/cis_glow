<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['sid'])) {
    echo '';
    exit(1);
}

legacy_bridge_bootstrap($input);

$_GET['flag'] = 3;
$_GET['sid'] = $input['sid'];
$_REQUEST = $_GET;

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
ob_start();
include $legacyRoot . '/student_profile_edit_more.php';
echo ob_get_clean();
