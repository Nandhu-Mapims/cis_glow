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
include $legacyRoot . '/payroll_consolidated_report.php';
$full = ob_get_clean();

$html = '';
if (preg_match('/<form[^>]*id="signupForm"[^>]*>.*?<\/form>/s', $full, $matches)) {
    $html = trim($matches[0]);
}

$styles = '';
if (preg_match('/<textarea id="salary_style_id"[^>]*>(.*?)<\/textarea>/s', $full, $styleMatch)) {
    $styles = html_entity_decode(trim($styleMatch[1]), ENT_QUOTES);
}

$scripts = '';
if (preg_match('/<script>\s*\$\(document\)\.ready\(function\(\)\s*\{.*?<\/script>/s', $full, $scriptMatch)) {
    $scripts = trim($scriptMatch[0]);
    $scripts = preg_replace('/^<script>|<\/script>$/s', '', $scripts);
}

if ($html === '') {
    echo json_encode(['error' => 'Unable to parse payroll consolidated report HTML', 'raw' => substr($full, 0, 500)]);
    exit(1);
}

echo json_encode(['html' => $html, 'scripts' => $scripts, 'styles' => $styles]);
exit(0);
