<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['registerNo'])) {
    echo json_encode(['error' => 'registerNo is required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['admission_no'] = strtoupper(trim($input['registerNo']));
$_POST['go'] = 'Go';

ob_start();
include $legacyRoot . '/student_fee_slip_new.php';
$full = ob_get_clean();

$result = [
    'html' => '',
    'studentName' => '',
    'registerNo' => $_POST['admission_no'],
];

if (preg_match('/<h3 class="student_name">([^<]*)<\/h3>/', $full, $m)) {
    $result['studentName'] = trim(html_entity_decode($m[1], ENT_QUOTES));
}

if (preg_match('/<div class="col-sm-12 student_container2">(.*?)<div class="col-sm-3 student_container3"/s', $full, $m)) {
    $result['html'] = trim($m[1]);
    echo json_encode($result);
    exit(0);
}

if (stripos($full, 'text-danger') !== false && preg_match('/<p class="text-danger">([^<]*)<\/p>/', $full, $err)) {
    echo json_encode(['error' => trim(html_entity_decode($err[1], ENT_QUOTES))]);
    exit(1);
}

if (!$result['studentName']) {
    echo json_encode(['error' => 'Student not found or fee sheet unavailable']);
    exit(1);
}

$result['html'] = $result['html'] ?: '<p class="text-muted">No pending fee rows for this student.</p>';
echo json_encode($result);
