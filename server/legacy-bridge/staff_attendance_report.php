<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['categories'])) {
    echo json_encode(['error' => 'categories are required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$fromDate = $input['fromDate'] ?? date('d-m-Y', strtotime('-1 month +1 day'));
$toDate = $input['toDate'] ?? date('d-m-Y');
$categories = is_array($input['categories']) ? $input['categories'] : explode(',', $input['categories']);

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['Submit'] = 'Generate';
$_POST['search_category'] = array_values(array_filter($categories));
$_POST['from_date'] = $fromDate;
$_POST['to_date'] = $toDate;
$search_category = $_POST['search_category'];
$from_date_ref = $fromDate;
$to_date_ref = $toDate;
$report_type = '';

ob_start();
include $legacyRoot . '/staff_attendance_report.php';
$full = ob_get_clean();

if (preg_match('/<div id="form_details_panel">(.*?)<\/div>\s*<\/form>/s', $full, $matches)) {
    echo json_encode(['html' => trim($matches[1])]);
    exit(0);
}

echo json_encode(['html' => $full]);
