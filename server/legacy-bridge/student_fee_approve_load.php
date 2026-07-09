<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['groupId'])) {
    echo json_encode(['error' => 'groupId is required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['slip_group'] = $input['groupId'];

ob_start();
include $legacyRoot . '/student_fee_add_new.php';
$full = ob_get_clean();

$result = [
    'html' => '',
    'studentName' => '',
    'groupId' => $input['groupId'],
    'registerNo' => '',
];

if (preg_match('/<h3 class="student_name">([^<]*)<\/h3>/', $full, $m)) {
    $result['studentName'] = trim(html_entity_decode($m[1], ENT_QUOTES));
}

if (preg_match('/name="a_no"[^>]*value="([^"]*)"/', $full, $m)) {
    $result['registerNo'] = $m[1];
}

if (preg_match('/<div class="col-sm-12 student_container2">(.*?)<div class="col-sm-3 student_container3"/s', $full, $m)) {
    $result['html'] = trim($m[1]);
    echo json_encode($result);
    exit(0);
}

if (stripos($full, 'Invalid Roll') !== false || stripos($full, 'Paid amount not mached') !== false) {
    echo json_encode(['error' => 'Slip cannot be approved — amounts may have changed']);
    exit(1);
}

echo json_encode(['error' => 'Approval sheet not available for this slip']);
