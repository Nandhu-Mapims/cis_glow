<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/student_bridge_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    echo json_encode(['error' => 'memberId required']);
    exit(1);
}
if (empty($input['registerNo'])) {
    echo json_encode(['error' => 'registerNo required']);
    exit(1);
}

student_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';

$fields = $input['fields'] ?? [];
if (!empty($fields)) {
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
} else {
    $_SERVER['REQUEST_METHOD'] = 'GET';
}

ob_start();
include $legacyRoot . '/student/exam_statement.php';
$full = ob_get_clean();

$html = '';
if (preg_match('/<div class="profile-nav col-sm-3">.*?(?=<\/aside>)/s', $full, $matches)) {
    $html = trim($matches[0]);
}

if ($html === '') {
    echo json_encode(['error' => 'Unable to parse student exam statement', 'raw' => substr($full, 0, 500)]);
    exit(1);
}

echo json_encode(['html' => $html, 'scripts' => '']);
exit(0);
