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

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['Submit'] = 'Search';
$_POST['from_date'] = $input['fromDate'] ?? date('d-m-Y');
$_POST['to_date'] = $input['toDate'] ?? '';
$_POST['student_id'] = $input['studentId'] ?? '';
$_POST['amount_type'] = $input['amountType'] ?? '';
$_POST['r_fee_type'] = $input['feeType'] ?? '';

ob_start();
include $legacyRoot . '/student_fee_report.php';
$full = ob_get_clean();

if (preg_match('/<div class="col-sm-12" id="form_details_panel">(.*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/s', $full, $matches)) {
    echo json_encode(['html' => trim($matches[1])]);
    exit(0);
}

if (stripos($full, 'No data') !== false) {
    echo json_encode(['html' => '<p class="text-muted">No fee collection data for the selected filters.</p>']);
    exit(0);
}

echo json_encode(['html' => $full]);
