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

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['flag'] = 1;
$_GET['s_student'] = $input['registerNo'];
$_GET['fmonth'] = $input['fmonth'] ?? '';
$_GET['tmonth'] = $input['tmonth'] ?? '';
$_GET['rtype'] = $input['rtype'] ?? 'Monthly';
$_GET['rcourse'] = $input['rcourse'] ?? '';
$_GET['rsubject'] = $input['rsubject'] ?? '';
$_GET['id'] = isset($input['count']) ? ((int) $input['count']) : 0;
$_GET['icache'] = !empty($input['clearCache']) ? 1 : 0;
$_REQUEST = $_GET;

ob_start();
include $legacyRoot . '/attendance_report_quartely_more.php';
$raw = trim(ob_get_clean());

if ($raw === '') {
    echo json_encode(['error' => 'Empty chunk response']);
    exit(1);
}

echo $raw;
