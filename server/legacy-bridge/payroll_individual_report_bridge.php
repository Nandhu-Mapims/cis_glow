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
include $legacyRoot . '/payroll_individual_report.php';
$full = ob_get_clean();

$html = '';
if (preg_match('/<form[^>]*id="signupForm"[^>]*>.*?<\/form>/s', $full, $matches)) {
    $html .= trim($matches[0]);
}
if (preg_match('/<div class="col-sm-12" id="att_report_span">(.*?)<\/div>\s*<\?/s', $full, $matches)) {
    $html .= '<div class="col-sm-12" id="att_report_span">' . trim($matches[1]) . '</div>';
}

$styles = '';
if (preg_match('/<textarea id="salary_style_id"[^>]*>(.*?)<\/textarea>/s', $full, $styleMatch)) {
    $styles = html_entity_decode(trim($styleMatch[1]), ENT_QUOTES);
}

$scripts = '';
if (preg_match_all('/<script>(.*?)<\/script>/s', $full, $scriptMatches)) {
    $chunks = [];
    foreach ($scriptMatches[1] as $chunk) {
        $chunk = trim($chunk);
        if ($chunk === '') {
            continue;
        }
        if (stripos($chunk, 'multipleSelect') !== false || stripos($chunk, 'callClear') !== false) {
            $chunks[] = $chunk;
        }
    }
    $scripts = implode("\n\n", $chunks);
}

$exportMeta = null;
if (preg_match('/var payroll_month = "([^"]*)"/', $full, $monthMatch)) {
    $exportMeta = [
        'payroll_month' => $monthMatch[1],
        'title' => '',
        'transfer_ref' => '',
        'search_category' => '',
    ];
    if (preg_match("/var title ='([^']*)'/", $full, $titleMatch)) {
        $exportMeta['title'] = $titleMatch[1];
    }
    if (preg_match('/var transfer_ref = "([^"]*)"/', $full, $transferMatch)) {
        $exportMeta['transfer_ref'] = $transferMatch[1];
    }
    if (preg_match('/var search_category="([^"]*)"/', $full, $categoryMatch)) {
        $exportMeta['search_category'] = $categoryMatch[1];
    }
}

if ($html === '') {
    echo json_encode(['error' => 'Unable to parse payroll individual report HTML', 'raw' => substr($full, 0, 500)]);
    exit(1);
}

echo json_encode([
    'html' => $html,
    'scripts' => $scripts,
    'styles' => $styles,
    'exportMeta' => $exportMeta,
]);
exit(0);
