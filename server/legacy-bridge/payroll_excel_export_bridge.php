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

$query = $input['query'] ?? [];
$_GET = $query;
$_REQUEST = array_merge($_GET, $_POST ?? []);

ob_start();
include $legacyRoot . '/payroll_individual_report_excel_report.php';
$binary = ob_get_clean();

if ($binary === '' || strlen($binary) < 100) {
    echo json_encode(['error' => 'Excel export returned empty output']);
    exit(1);
}

$flag = (string)($query['flag'] ?? '1');
$prefixMap = ['1' => 'BANK', '2' => 'PF', '3' => 'ESI'];
$prefix = $prefixMap[$flag] ?? 'Payroll';
$filename = $prefix . '_copy_' . date('YmdHis') . '.xlsx';

echo json_encode([
    'contentBase64' => base64_encode($binary),
    'filename' => $filename,
    'contentType' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
exit(0);
