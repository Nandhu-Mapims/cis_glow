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

$fields = $input['fields'] ?? [];
if (!empty($fields)) {
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
} else {
    $_SERVER['REQUEST_METHOD'] = 'GET';
}

ob_start();
include $legacyRoot . '/log_details.php';
$full = ob_get_clean();

$html = '';
if (preg_match('/<div class="panel-body">\s*(.*?)\s*<\/div>\s*<\/section>/s', $full, $matches)) {
    $html = trim($matches[1]);
}

$scripts = '';
if (preg_match_all('/<script>(.*?)<\/script>/s', $full, $scriptMatches)) {
    $chunks = [];
    foreach ($scriptMatches[1] as $chunk) {
        $chunk = trim($chunk);
        if ($chunk === '') {
            continue;
        }
        if (stripos($chunk, 'daterangepicker') !== false
            || stripos($chunk, 'print_log_details') !== false
            || stripos($chunk, 'call_log_details') !== false
        ) {
            $chunks[] = $chunk;
        }
    }
    $scripts = implode("\n\n", $chunks);
}

if ($html === '') {
    echo json_encode(['error' => 'Unable to parse log details HTML', 'raw' => substr($full, 0, 500)]);
    exit(1);
}

echo json_encode(['html' => $html, 'scripts' => $scripts]);
exit(0);
