<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['listText'])) {
    echo '';
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
$format = $input['format'] ?? 'html';

$getParams = [
    'course_name' => $input['courseName'] ?? 'All---All',
    'search_by' => $input['searchBy'] ?? 'batch',
    'academic_year' => $input['academicYear'] ?? 'All',
    'list_text' => $input['listText'],
    'report_title' => $input['reportTitle'] ?? '',
    's_no' => !empty($input['showSerialNo']) ? 1 : 0,
    'header' => !empty($input['showHeader']) ? 1 : 0,
    'discontinued' => $input['discontinued'] ?? 'Regular',
    'flag' => 1,
];

$_GET = $getParams;
$_REQUEST = $_GET;

if ($format === 'xls') {
    $excelDir = $legacyRoot . '/files/excel';
    if (!is_dir($excelDir)) {
        mkdir($excelDir, 0775, true);
    }
    $before = glob($excelDir . '/student_profile_report_*.xlsx') ?: [];
    $beforeTimes = array_map('filemtime', $before);

    ob_start();
    include $legacyRoot . '/student_profile_export_xls.php';
    ob_end_clean();

    $after = glob($excelDir . '/student_profile_report_*.xlsx') ?: [];
    $newFile = null;
    foreach ($after as $file) {
        $mtime = filemtime($file);
        if (!in_array($mtime, $beforeTimes, true)) {
            $newFile = $file;
            break;
        }
    }
    if (!$newFile && count($after) > 0) {
        usort($after, static function ($a, $b) {
            return filemtime($b) <=> filemtime($a);
        });
        $newFile = $after[0];
    }

    if (!$newFile) {
        echo json_encode(['error' => 'Excel file was not generated']);
        exit(1);
    }

    echo json_encode([
        'downloadUrl' => '/legacy/files/excel/' . basename($newFile),
        'filename' => basename($newFile),
    ]);
    exit(0);
}

ob_start();
include $legacyRoot . '/student_profile_export_more.php';
echo ob_get_clean();
