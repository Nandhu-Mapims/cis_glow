<?php
/**
 * List pending fee slips using legacy student_fee_add_new.php rendering.
 * stdin JSON: { memberId, registerNo? }
 */
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

$_SERVER['REQUEST_METHOD'] = 'GET';
if (!empty($input['registerNo'])) {
    $_REQUEST['search'] = $input['registerNo'];
    $_GET['search'] = $input['registerNo'];
}

ob_start();
include $legacyRoot . '/student_fee_add_new.php';
$html = ob_get_clean();

function fee_pending_parse_money(string $value): string
{
    return preg_replace('/[^0-9.]/', '', $value);
}

$slips = [];
if (preg_match_all(
    '/<div class="col-sm-3">.*?<h4><a href="#">([^<]*)<\/a>.*?<p>([^<]*)<\/p>.*?icon-inr.*?<h4[^>]*>([^<]*)<\/h4>.*?icon-calendar.*?<td>([^<]*)<\/td>.*?icon-building.*?<td>([^<]*)<\/td>.*?icon-file-text-alt.*?<td>([^<]*)<\/td>.*?name="slip_group"[^>]*value="([^"]*)"/s',
    $html,
    $matches,
    PREG_SET_ORDER,
)) {
    foreach ($matches as $match) {
        $slips[] = [
            'groupId' => $match[7],
            'registerNo' => trim($match[1]),
            'studentLabel' => trim(html_entity_decode($match[2], ENT_QUOTES)),
            'amount' => fee_pending_parse_money($match[3]),
            'paidDate' => trim($match[4]),
            'payBank' => trim($match[5]),
            'receipts' => trim($match[6]),
        ];
    }
}

$total = 0;
if (preg_match('/Showing (\d+) to (\d+) of (\d+) entries/', $html, $countMatch)) {
    $total = (int) $countMatch[3];
} elseif (preg_match('/Showing 0 to 0 of 0 entries/', $html)) {
    $total = 0;
}

echo json_encode([
    'slips' => $slips,
    'total' => $total,
]);
exit(0);
