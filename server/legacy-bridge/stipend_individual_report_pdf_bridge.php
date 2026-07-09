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

$fields = $input['fields'] ?? [];
$payrollMonth = trim((string)($fields['payroll_month'] ?? ''));
if ($payrollMonth === '') {
    echo json_encode(['error' => 'payroll_month required']);
    exit(1);
}

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = $fields;
$_REQUEST = $fields;

include $legacyRoot . '/widget.php';

$payrollMonthRef = date('Y-m-d', strtotime($payrollMonth));
$refCopyType = (string)($fields['copy_type'] ?? 'Original Copy');
if ($refCopyType === 'Default Copy') {
    $refCopyType = '';
} elseif ($refCopyType === 'Duplicate Copy') {
    $refCopyType = 'Duplicate Copy';
} else {
    $refCopyType = 'Original Copy';
}

include $legacyRoot . '/stipend_payroll_pdf_widget.php';

ob_start();
generatePayroll($payrollMonthRef, $refCopyType, 'pdf');
$captured = ob_get_clean();

$pdfStart = strpos($captured, '%PDF');
if ($pdfStart === false) {
    echo json_encode([
        'error' => 'PDF generation failed',
        'debug' => substr($captured, 0, 500),
    ]);
    exit(1);
}

$pdfBinary = substr($captured, $pdfStart);
$reportsDir = $legacyRoot . '/files/payroll_reports';
if (!is_dir($reportsDir)) {
    mkdir($reportsDir, 0755, true);
}

$filename = 'stipend_payroll_' . date('YmdHis') . '.pdf';
file_put_contents($reportsDir . '/' . $filename, $pdfBinary);

echo json_encode([
    'filename' => $filename,
    'downloadUrl' => '/legacy/files/payroll_reports/' . rawurlencode($filename),
    'passwordHint' => strtolower(date('M', strtotime($payrollMonthRef))) . date('Y', strtotime($payrollMonthRef)),
]);
exit(0);
