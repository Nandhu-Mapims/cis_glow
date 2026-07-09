<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/fee_config_helper.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    echo json_encode(['error' => 'memberId required']);
    exit(1);
}

$screens = fee_config_screen_map();
$screen = $input['screen'] ?? '';
if (!isset($screens[$screen])) {
    echo json_encode(['error' => 'Unknown fee setup screen']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$fields = $input['fields'] ?? [];
if (!empty($fields)) {
    $_SERVER['REQUEST_METHOD'] = 'POST';
    fee_config_apply_post($fields);
} else {
    $_SERVER['REQUEST_METHOD'] = 'GET';
}

ob_start();
include $legacyRoot . '/' . $screens[$screen];
$full = ob_get_clean();

$result = fee_config_extract($full);
if ($result['html'] === '') {
    echo json_encode(['error' => 'Unable to parse fee setup form', 'raw' => substr($full, 0, 500)]);
    exit(1);
}

echo json_encode($result);
exit(0);
