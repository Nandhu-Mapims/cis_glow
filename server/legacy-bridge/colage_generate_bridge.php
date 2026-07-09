<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/colage_generate_core.inc.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId'])) {
    echo json_encode(['error' => 'memberId required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);
include $legacyRoot . '/widget.php';

$fields = $input['fields'] ?? [];
$result = colage_generate_output($fields);

if (!empty($result['error'])) {
    echo json_encode($result);
    exit(1);
}

echo json_encode($result);
exit(0);
