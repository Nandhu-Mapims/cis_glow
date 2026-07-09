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

ob_start();
include $legacyRoot . '/fee_delete_report.php';
$full = ob_get_clean();

$html = '';
if (preg_match('/id="form_details_panel">\s*(.*?)\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/s', $full, $m)) {
    $html = trim($m[1]);
}

if ($html === '') {
    echo json_encode(['html' => '<p class="text-muted">No deleted receipts for the selected period.</p>']);
    exit(0);
}

echo json_encode(['html' => $html]);
exit(0);
