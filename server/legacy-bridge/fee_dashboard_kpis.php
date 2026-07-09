<?php
/**
 * Return fee dashboard KPI totals from legacy callYear() logic.
 * stdin JSON: { memberId, attendanceDate }
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

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['attendance_date'] = $input['attendanceDate'] ?? '';
$_POST['cRefresh'] = '1';

ob_start();
include $legacyRoot . '/fee_dashboard_v2.php';
$html = ob_get_clean();

if ($html === '') {
    echo json_encode(['error' => 'Legacy fee dashboard returned empty output']);
    exit(1);
}

function fee_dashboard_parse_money(string $value): float
{
    return (float) preg_replace('/[^0-9.]/', '', $value);
}

preg_match_all(
    '/Academic Year : ([0-9-]+).*?<div class="row" id="feedetail_\d+"[^>]*>(.*?)<\/div>\s*<div class="row" id="fee_detail_/s',
    $html,
    $yearBlocks,
    PREG_SET_ORDER,
);

$labels = ['feeAmount', 'feePaid', 'feeUnpaid', 'scholarship', 'dme', 'acmec'];
$years = [];

foreach ($yearBlocks as $block) {
    preg_match_all('/library_count_h"> <i class="icon-inr"><\/i>\s*([0-9,\.]+)/', $block[2], $kpiMatches);
    $row = ['academicYear' => $block[1]];
    for ($k = 0; $k < 6; $k += 1) {
        $row[$labels[$k]] = fee_dashboard_parse_money($kpiMatches[1][$k] ?? '0');
    }
    $years[] = $row;
}

$overall = null;
if (preg_match(
    '/<strong>Overall<\/strong>.*?<div class="row" id="feedetail_\d+"[^>]*>(.*?)<\/div>\s*<\/aside>/s',
    $html,
    $overallBlock,
)) {
    preg_match_all('/library_count_h"> <i class="icon-inr"><\/i>\s*([0-9,\.]+)/', $overallBlock[1], $overallKpis);
    $overallLabels = [
        'unpaidCollege',
        'unpaidHostel',
        'unpaidExam',
        'unpaidStationary',
        'scholarship',
        'dme',
    ];
    $overall = [];
    for ($k = 0; $k < 6; $k += 1) {
        $overall[$overallLabels[$k]] = fee_dashboard_parse_money($overallKpis[1][$k] ?? '0');
    }
}

echo json_encode([
    'years' => $years,
    'overall' => $overall,
]);
exit(0);
