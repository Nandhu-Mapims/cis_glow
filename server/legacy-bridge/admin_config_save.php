<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/admin_config_helper.php';
require __DIR__ . '/legacy_multipart_helper.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    echo json_encode(['error' => 'memberId required']);
    exit(1);
}

$screens = admin_config_screen_map();
$screen = $input['screen'] ?? '';
if (!isset($screens[$screen])) {
    echo json_encode(['error' => 'Unknown admin screen']);
    exit(1);
}

$fields = $input['fields'] ?? [];
if (empty($fields)) {
    echo json_encode(['error' => 'fields required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'POST';
admin_config_apply_post($fields);
legacy_apply_uploaded_files($input['files'] ?? []);

ob_start();
include $legacyRoot . '/' . $screens[$screen];
$full = ob_get_clean();

$result = admin_config_extract($full);
$result['success'] = $result['success'] || stripos($full, 'Your details are Updated') !== false
    || stripos($full, 'Your details are updated') !== false
    || stripos($full, 'Your details are added') !== false
    || stripos($full, 'Your details are deleted') !== false;

if (!$result['success'] && $result['message'] === '') {
    $result['message'] = 'Save failed — please verify the form and try again.';
}

echo json_encode($result);
exit(0);
