<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    echo json_encode(['error' => 'memberId required']);
    exit(1);
}

$receiptNo = trim($input['receiptNo'] ?? '');
$groupId = trim($input['groupId'] ?? '');
if ($receiptNo === '' && $groupId === '') {
    echo json_encode(['error' => 'receiptNo or groupId required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);
include $legacyRoot . '/widget.php';

$feeLabels = [];
$sql = "SELECT id, fee_name FROM fee_label_master WHERE del=1 ORDER BY fee_order ASC";
$result = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sql);
while ($result && ($row = mysqli_fetch_array($result))) {
    $feeLabels[$row['id']] = stripslashes($row['fee_name']);
}

$banner = '';
$rowBanner = mysqli_fetch_array(mysqli_query($GLOBALS['__CIS_MYSQLI'], 'SELECT banner_image FROM basic_banner_tb WHERE del=1 AND id=1'));
if (!empty($rowBanner['banner_image'])) {
    $banner = "<img src='img/global_images/{$rowBanner['banner_image']}' width='350' />";
}

$where = 'del=1';
if ($receiptNo !== '') {
    $receiptNo = addslashes($receiptNo);
    $where .= " AND receipt_no='$receiptNo'";
} else {
    $groupId = addslashes($groupId);
    $where .= " AND slip_id='$groupId'";
}

$sqlFee = "SELECT * FROM student_fee WHERE $where ORDER BY receipt_no ASC, id ASC";
$resultFee = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sqlFee);
if (!$resultFee || mysqli_num_rows($resultFee) === 0) {
    echo json_encode(['error' => 'No fee receipt found']);
    exit(1);
}

$receipts = [];
while (($row = mysqli_fetch_array($resultFee)) !== false) {
    $key = $row['receipt_no'];
    if (!isset($receipts[$key])) {
        $receipts[$key] = [
            'receiptNo' => $row['receipt_no'],
            'paidDate' => $row['paid_date'],
            'registerNo' => $row['register_no'],
            'amountType' => $row['amount_type'],
            'amountDetails' => $row['amount_details'],
            'paymentNo' => $row['payment_no'],
            'lines' => [],
            'total' => 0,
            'fine' => 0,
            'discount' => 0,
        ];
    }
    $label = $feeLabels[$row['fee_name']] ?? $row['fee_name'];
    $lineAmount = (float) ($row['total_amount'] ?: $row['fee_amount']);
    $receipts[$key]['lines'][] = $label;
    $receipts[$key]['total'] += $lineAmount;
    $receipts[$key]['fine'] += (float) $row['fine_amount'];
    $receipts[$key]['discount'] += (float) $row['discount_amount'];
}

$htmlParts = [];
foreach ($receipts as $receipt) {
    $stu = mysqli_fetch_array(mysqli_query(
        $GLOBALS['__CIS_MYSQLI'],
        "SELECT A.student_name, A.student_initial, B.degree_name, B.department_name
         FROM student_profile_tb AS A
         INNER JOIN basic_setup_course_tb AS B ON A.course_id=B.id
         WHERE A.del=1 AND B.del=1 AND A.register_no='" . addslashes($receipt['registerNo']) . "' LIMIT 1"
    ));
    $studentName = trim(ucwords(stripslashes($stu['student_name'] ?? '')) . ' ' . strtoupper(stripslashes($stu['student_initial'] ?? '')));
    $degree = trim(ucwords(stripslashes($stu['degree_name'] ?? '')) . ' ' . strtoupper(stripslashes($stu['department_name'] ?? '')));

    $particulars = implode(' & ', array_unique($receipt['lines']));
    if ($receipt['fine'] > 0) {
        $particulars .= '<br>Fine : <strong>' . IND_money_format($receipt['fine']) . '</strong>';
    }
    if ($receipt['discount'] > 0) {
        $particulars .= '<br>Concession : <strong>' . IND_money_format($receipt['discount']) . '</strong>';
    }

    $total = $receipt['total'];
    $paidDate = date('d-m-Y', strtotime($receipt['paidDate']));
    $receiptDisplay = $receipt['receiptNo'];
    $paymentLabel = $receipt['amountType'];
    if ($receipt['paymentNo'] > 1) {
        $paymentLabel .= ' (Part payment)';
    }

    $htmlParts[] = '<div id="container" style="min-height:512px;width:100%;height:auto;">
<table align="center" border="0" cellpadding="2" cellspacing="2" width="100%">
<tbody>
<tr><td colspan="2"><div id="top"><table border="0" width="100%"><tr>
<td valign="middle"><h2>' . $banner . '</h2></td>
<td colspan="3" align="center"><p style="font-size:16px;"><strong>FEE RECEIPT</strong></p></td>
</tr></table></div></td></tr>
<tr><td colspan="2"><table border="0" width="85%" align="center">
<tr><td><strong>Receipt No:</strong> ' . htmlspecialchars($receiptDisplay) . '</td>
<td><strong>Date:</strong> ' . $paidDate . '</td></tr>
<tr><td colspan="2"><strong>Student Name:</strong> ' . htmlspecialchars($studentName) . '</td></tr>
<tr><td colspan="2">' . htmlspecialchars($receipt['registerNo']) . ' | ' . htmlspecialchars($degree) . '</td></tr>
</table></td></tr>
<tr><td colspan="2"><table class="fees_table" border="0" width="85%" align="center">
<tr bgcolor="#F0F0F0"><td width="70%"><strong>Particulars</strong></td><td align="center"><strong>Amount (Rs.)</strong></td></tr>
<tr><td style="padding:12px;"> For ' . $particulars . '</td><td align="center"><strong>' . IND_money_format($total) . '</strong></td></tr>
<tr><td colspan="2">In words: ' . ucwords(convertNumberToWords($total)) . ' Rupees only.</td></tr>
</table></td></tr>
<tr><td colspan="2"><strong>Received by:</strong> ' . htmlspecialchars($paymentLabel) . '<br>' . htmlspecialchars($receipt['amountDetails']) . '</td></tr>
</tbody></table></div>';
}

echo json_encode([
    'html' => implode('<div style="page-break-after:always;height:16px;"></div>', $htmlParts),
    'receiptCount' => count($htmlParts),
]);
exit(0);
