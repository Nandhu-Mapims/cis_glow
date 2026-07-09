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

$_SERVER['REQUEST_METHOD'] = 'GET';

ob_start();
include $legacyRoot . '/exam_dashboard.php';
$full = ob_get_clean();

$html = '';
if (preg_match('/<div class="col-lg-12" id="exam_report_span"[^>]*>(.*?)<\/div>\s*<\/aside>/s', $full, $matches)) {
    $html = trim($matches[1]);
}

if ($html === '' && preg_match('/id="exam_report_span"[^>]*>(.*?)<\/div>/s', $full, $matches)) {
    $html = trim($matches[1]);
}

if ($html === '') {
    echo json_encode(['error' => 'Unable to parse exam dashboard HTML']);
    exit(1);
}

echo json_encode(['html' => $html]);
exit(0);
