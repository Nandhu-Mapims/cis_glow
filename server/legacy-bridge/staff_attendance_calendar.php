<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['staffId'])) {
    echo '';
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$staff_id_ref = trim($input['staffId']);
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['staff_id'] = $staff_id_ref;
$_POST['Submit'] = 'Go';
$_REQUEST['staff_id'] = $staff_id_ref;
if (!empty($input['fromDate'])) {
    $_REQUEST['m1'] = $input['fromDate'];
}
if (!empty($input['toDate'])) {
    $_REQUEST['m2'] = $input['toDate'];
}

ob_start();
include $legacyRoot . '/individual_calendar.php';
$full = ob_get_clean();

if (preg_match('/<div class="form-group p-load" id="session_ref">(.*?)<\/form>/s', $full, $matches)) {
    echo trim($matches[1]);
    exit(0);
}

if (preg_match('/<table[^>]*class="table table-bordered"/s', $full, $tableMatch, PREG_OFFSET_CAPTURE)) {
    $start = $tableMatch[0][1];
    echo substr($full, $start);
    exit(0);
}

echo $full;
