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
$_POST['attendance_date'] = $input['attendanceDate'] ?? '';
$_POST['cRefresh'] = '1';

ob_start();
include $legacyRoot . '/fee_dashboard_v2.php';
$full = ob_get_clean();

$styles = '';
if (preg_match('/<style>(.*?)<\/style>/s', $full, $styleMatch)) {
    $styles = trim($styleMatch[1]);
}

$html = '';
if (preg_match('/<div class="col-lg-12">\s*(.*?)\s*<\/div>\s*<\/aside>/s', $full, $matches)) {
    $html = trim($matches[1]);
}

if ($html === '') {
    echo json_encode(['error' => 'Unable to parse fee dashboard HTML', 'styles' => $styles]);
    exit(1);
}

echo json_encode(['html' => $html, 'styles' => $styles]);
exit(0);
