<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['meta']) || empty($input['entries'])) {
    echo json_encode(['success' => false, 'error' => 'meta and entries are required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$formReset = $input['formReset'] ?? uniqid('fee_', true);
$_SESSION['check_form_submit'] = $formReset;

$meta = $input['meta'];
$entries = $input['entries'];
$feeTypes = $input['feeTypes'] ?? [];
$totals = $input['totals'] ?? [];

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['form_reset'] = $formReset;
$_POST['Submit'] = $input['submitAction'] ?? 'Submit';
$_POST['admission_no'] = $meta['registerNo'] ?? '';
$_POST['a_no'] = $meta['registerNo'] ?? '';
$_POST['course_id'] = $meta['courseId'] ?? '';
$_POST['admission_year'] = $meta['admissionYear'] ?? '';
$_POST['paid_date'] = $input['paidDate'] ?? date('d-m-Y');
$_POST['pay_bank'] = $input['payBank'] ?? 'cbi';
$_POST['fee_counter'] = (string) ($meta['feeCounter'] ?? count($entries));

$_POST['fee_paid'] = [];
$_POST['fee_class_year'] = [];
$_POST['fee_academic_year'] = [];
$_POST['fee_academic_batch'] = [];
$_POST['fee_id'] = [];
$_POST['fee_type'] = [];
$_POST['payment_no'] = [];
$_POST['fee_name'] = [];
$_POST['fee_bank'] = [];
$_POST['tfee_amount'] = [];
$_POST['balance_amount'] = [];
$_POST['fee_fine'] = [];
$_POST['fee_amount'] = [];

$maxIndex = (int) $_POST['fee_counter'];
for ($i = 0; $i < $maxIndex; $i++) {
    $_POST['fee_paid'][$i] = '';
    $_POST['fee_class_year'][$i] = '';
    $_POST['fee_academic_year'][$i] = '';
    $_POST['fee_academic_batch'][$i] = '';
    $_POST['fee_id'][$i] = '';
    $_POST['fee_type'][$i] = '';
    $_POST['payment_no'][$i] = '';
    $_POST['fee_name'][$i] = '';
    $_POST['fee_bank'][$i] = '';
    $_POST['tfee_amount'][$i] = '';
    $_POST['balance_amount'][$i] = '';
    $_POST['fee_fine'][$i] = '';
    $_POST['fee_amount'][$i] = '';
}

foreach ($entries as $entry) {
    if (empty($entry['selected'])) {
        continue;
    }
    $i = (int) ($entry['index'] ?? 0);
    $_POST['fee_paid'][$i] = '1';
    $_POST['fee_class_year'][$i] = $entry['classYear'] ?? '';
    $_POST['fee_academic_year'][$i] = $entry['academicYear'] ?? '';
    $_POST['fee_academic_batch'][$i] = $entry['academicBatch'] ?? '';
    $_POST['fee_id'][$i] = $entry['feeId'] ?? '';
    $_POST['fee_type'][$i] = $entry['feeType'] ?? '';
    $_POST['payment_no'][$i] = $entry['paymentNo'] ?? '';
    $_POST['fee_name'][$i] = $entry['feeName'] ?? '';
    $_POST['fee_bank'][$i] = $entry['feeBank'] ?? '';
    $_POST['tfee_amount'][$i] = $entry['tfeeAmount'] ?? '';
    $_POST['balance_amount'][$i] = $entry['balanceAmount'] ?? '';
    $_POST['fee_fine'][$i] = $entry['feeFine'] ?? '';
    $_POST['fee_amount'][$i] = $entry['feeAmount'] ?? '';
}

foreach ($feeTypes as $feeTypeId) {
    $t = $totals[$feeTypeId] ?? [];
    $_POST['fine_amount_' . $feeTypeId] = $t['fine'] ?? '0';
    $_POST['total_fee_amount_' . $feeTypeId] = $t['fee'] ?? '0';
    $_POST['total_amount_' . $feeTypeId] = $t['total'] ?? '0';
    $_POST['discount_amount_' . $feeTypeId] = $t['discount'] ?? '0';
    $_POST['discount_details_' . $feeTypeId] = $t['discountDetails'] ?? '';
}

ob_start();
include $legacyRoot . '/student_fee_slip_new.php';
$full = ob_get_clean();

$result = [
    'success' => false,
    'message' => 'Slip generation failed',
    'receiptHtml' => '',
];

if (preg_match('/id="final_print_content"[^>]*>([\s\S]*?)<\/div>/', $full, $m)) {
    $receipt = trim($m[1]);
    if (strlen($receipt) > 50) {
        $result['success'] = true;
        $result['message'] = 'Fee slip generated';
        $result['receiptHtml'] = $receipt;
    }
}

if (!$result['success'] && stripos($full, 'Receipt Generate') !== false) {
    $result['success'] = true;
    $result['message'] = 'Fee slip generated';
}

if (stripos($full, 'Invalid Roll') !== false) {
    $result['success'] = false;
    $result['message'] = 'Invalid roll number';
}

echo json_encode($result);
