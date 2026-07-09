<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['courses']) || empty($input['subjects'])) {
    echo json_encode(['error' => 'courses and subjects are required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['Submit'] = 'Generate';
$_POST['academic_year'] = $input['academicYear'] ?? '';
$_POST['course_name'] = is_array($input['courses']) ? $input['courses'] : explode(',', $input['courses']);
$_POST['search_subject'] = is_array($input['subjects']) ? $input['subjects'] : explode(',', $input['subjects']);
$_POST['from_date'] = $input['fromDate'] ?? date('d-m-Y', strtotime('-1 month +1 day'));
$_POST['to_date'] = $input['toDate'] ?? date('d-m-Y');
$_POST['report_type'] = $input['reportType'] ?? 'Monthly';
$from_date_ref = $_POST['from_date'];
$to_date_ref = $_POST['to_date'];
$report_type = $_POST['report_type'];
$search_category = $_POST['search_category'] ?? [];

ob_start();
include $legacyRoot . '/attendance_report.php';
$full = ob_get_clean();

$result = [
    'headerHtml' => '',
    'jobs' => [],
    'meta' => [],
];

if (preg_match('/id="fmonth"[^>]*value="([^"]*)"/', $full, $m)) {
    $result['meta']['fmonth'] = $m[1];
}
if (preg_match('/id="tmonth"[^>]*value="([^"]*)"/', $full, $m)) {
    $result['meta']['tmonth'] = $m[1];
}
if (preg_match('/id="rtype"[^>]*value="([^"]*)"/', $full, $m)) {
    $result['meta']['rtype'] = $m[1];
}

if (preg_match('/id="att_report_span"[^>]*>(.*?)<input type="hidden" id="fmonth"/s', $full, $m)) {
    $result['headerHtml'] = trim($m[1]);
}

preg_match_all('/name="s_student\[\]" value="([^"]*)"/', $full, $students);
preg_match_all('/name="s_flag\[\]" value="([^"]*)"/', $full, $flags);
preg_match_all('/name="s_count\[\]" value="([^"]*)"/', $full, $counts);

$jobCount = isset($students[1]) ? count($students[1]) : 0;
for ($i = 0; $i < $jobCount; $i++) {
    $flag = $flags[1][$i] ?? '0';
    $rcourse = '';
    $rsubject = '';
    if (preg_match('/id="rcourse_' . preg_quote($flag, '/') . '"[^>]*value="([^"]*)"/', $full, $rm)) {
        $rcourse = $rm[1];
    }
    if (preg_match('/id="rsubject_' . preg_quote($flag, '/') . '"[^>]*value="([^"]*)"/', $full, $rm)) {
        $rsubject = $rm[1];
    }
    $result['jobs'][] = [
        'registerNo' => $students[1][$i],
        'flag' => $flag,
        'count' => $counts[1][$i] ?? (string) $i,
        'rcourse' => $rcourse,
        'rsubject' => $rsubject,
    ];
}

if (!$result['headerHtml'] && !$jobCount) {
    echo json_encode(['error' => 'No students found for the selected filters']);
    exit(1);
}

echo json_encode($result);
