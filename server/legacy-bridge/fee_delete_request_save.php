<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['receiptNo'])) {
    echo json_encode(['success' => false, 'error' => 'memberId and receiptNo required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$formReset = $input['formReset'] ?? uniqid('fdel_', true);
$_SESSION['check_form_submit'] = '';

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['form_reset'] = $formReset;
$_POST['Submit'] = 'Update';
$_POST['receipt_no'] = $input['receiptNo'];
$_POST['remarks'] = $input['remarks'] ?? '';

ob_start();
include $legacyRoot . '/fee_delete_request.php';
$full = ob_get_clean();

$success = stripos($full, 'Your details are added') !== false;
echo json_encode([
    'success' => $success,
    'message' => $success ? 'Delete request submitted' : 'Unable to submit delete request',
]);
exit(0);
