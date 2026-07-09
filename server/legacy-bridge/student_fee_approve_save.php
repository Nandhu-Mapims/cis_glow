<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['groupId']) || empty($input['meta']) || empty($input['entries'])) {
    echo json_encode(['success' => false, 'error' => 'groupId, meta and entries are required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$formReset = $input['formReset'] ?? uniqid('feeap_', true);
$_SESSION['check_form_submit'] = $formReset;

$meta = $input['meta'];
$entries = $input['entries'];
$feeTypes = $input['feeTypes'] ?? [];
$totals = $input['totals'] ?? [];
$payment = $input['payment'] ?? [];

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['form_reset'] = $formReset;
$_POST['Submit'] = $input['submitAction'] ?? 'Submit';
$_POST['slip_group'] = $input['groupId'];
$_POST['a_no'] = $meta['registerNo'] ?? '';
$_POST['course_id'] = $meta['courseId'] ?? '';
$_POST['admission_year'] = $meta['admissionYear'] ?? '';
$_POST['paid_date'] = $input['paidDate'] ?? date('d-m-Y');
$_POST['fee_counter'] = (string) ($meta['feeCounter'] ?? count($entries));
$_POST['amount_type'] = $payment['amountType'] ?? 'Bank';
$_POST['bank_ref_no'] = $payment['bankRefNo'] ?? '';
$_POST['bank_date'] = $payment['bankDate'] ?? '';
$_POST['bank_amount'] = $payment['bankAmount'] ?? '';
$_POST['otherte'] = $payment['otherte'] ?? '';
$_POST['fivete'] = $payment['fivete'] ?? '';
$_POST['onehu'] = $payment['onehu'] ?? '';
$_POST['fivehu'] = $payment['fivehu'] ?? '';
$_POST['oneth'] = $payment['oneth'] ?? '';
$_POST['cheque_no'] = $payment['chequeNo'] ?? '';
$_POST['cheque_date'] = $payment['chequeDate'] ?? '';
$_POST['cheque_bank_name'] = $payment['chequeBankName'] ?? '';
$_POST['amount'] = $payment['chequeAmount'] ?? '';

$_POST['fee_paid'] = [];
$_POST['fee_class_year'] = [];
$_POST['fee_academic_year'] = [];
$_POST['fee_academic_batch'] = [];
$_POST['fee_id'] = [];
$_POST['fee_type'] = [];
$_POST['payment_no'] = [];
$_POST['fee_name'] = [];
$_POST['slip_id'] = [];
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
    $_POST['slip_id'][$i] = '';
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
    $_POST['slip_id'][$i] = $entry['slipId'] ?? $input['groupId'];
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
include $legacyRoot . '/student_fee_add_new.php';
$full = ob_get_clean();

$result = [
    'success' => false,
    'message' => 'Approval failed',
    'receiptHtml' => '',
];

if (stripos($full, 'Added Successfully') !== false || stripos($full, 'Success!</strong> Added') !== false) {
    $result['success'] = true;
    $result['message'] = 'Fee posted to student account';
}

if (preg_match('/id="final_print_content"[^>]*>([\s\S]*?)<\/div>/', $full, $m)) {
    $receipt = trim($m[1]);
    if (strlen($receipt) > 50) {
        $result['receiptHtml'] = $receipt;
        if ($result['success']) {
            $result['message'] = 'Fee posted and receipt ready';
        }
    }
}

if (stripos($full, 'Paid amount not mached') !== false) {
    $result['success'] = false;
    $result['message'] = 'Paid amount does not match slip — regenerate slip';
}

echo json_encode($result);
