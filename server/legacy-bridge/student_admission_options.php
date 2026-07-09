<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['a_year']) || empty($input['courseName'])) {
    echo json_encode(['options' => []]);
    exit(1);
}

legacy_bridge_bootstrap($input);

$_GET['flag'] = 1;
$_GET['a_year'] = $input['a_year'];
$_GET['course_name'] = $input['courseName'];
$_REQUEST = $_GET;

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
ob_start();
include $legacyRoot . '/student_profile_add_more.php';
$html = ob_get_clean();

preg_match_all('/<option value="([^"]*)">([^<]*)<\/option>/', $html, $matches, PREG_SET_ORDER);
$options = [];
foreach ($matches as $m) {
    if ($m[1] === '') continue;
    $options[] = ['id' => $m[1], 'label' => html_entity_decode(strip_tags($m[2]))];
}

echo json_encode(['options' => $options]);
