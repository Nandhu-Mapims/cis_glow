<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['attendanceDate']) || empty($input['entries'])) {
    echo json_encode(['success' => false, 'error' => 'attendanceDate and entries are required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$formReset = $input['formReset'] ?? uniqid('att_', true);
$_SESSION['check_form_submit'] = $formReset;

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['form_reset'] = $formReset;
$_POST['Submit'] = 'Update';
$_POST['attendance_date'] = date('d-m-Y', strtotime($input['attendanceDate']));
$_POST['present_list'] = [];
$_POST['att_course_id'] = [];
$_POST['att_c_year'] = [];
$_POST['att_a_type'] = [];
$_POST['att_a_year'] = [];
$_POST['att_period'] = [];

foreach ($input['entries'] as $entry) {
    $_POST['present_list'][] = $entry['presentList'] ?? '';
    $_POST['att_course_id'][] = $entry['courseId'] ?? '';
    $_POST['att_c_year'][] = $entry['currentYear'] ?? '';
    $_POST['att_a_type'][] = $entry['academicType'] ?? '';
    $_POST['att_a_year'][] = $entry['academicYear'] ?? '';
    $_POST['att_period'][] = $entry['period'] ?? '';

    $courseId = $entry['courseId'] ?? '';
    $currentYear = $entry['currentYear'] ?? '';
    if ($courseId && $currentYear && !empty($entry['studentList'])) {
        $_POST['att_slist_' . $courseId . '_' . $currentYear] = $entry['studentList'];
    }
}

ob_start();
include $legacyRoot . '/student_mattendance.php';
$html = ob_get_clean();

$success = stripos($html, 'Success') !== false;
echo json_encode([
    'success' => $success,
    'message' => $success ? 'Attendance updated' : 'Update failed or no changes saved',
]);
