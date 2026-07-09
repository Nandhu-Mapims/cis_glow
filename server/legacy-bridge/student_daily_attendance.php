<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || empty($input['memberId']) || empty($input['attendanceDate'])) {
    echo json_encode(['error' => 'attendanceDate is required']);
    exit(1);
}

legacy_bridge_bootstrap($input);

$legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
chdir($legacyRoot);

$attendanceDate = $input['attendanceDate'];
$attCourse = $input['attCourse'] ?? 'U.G___regular';

$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['attendance_date'] = date('d-m-Y', strtotime($attendanceDate));
$_POST['att_course'] = $attCourse;
$_POST['att_course_ref'] = $attCourse;
$attendance_date = $_POST['attendance_date'];
$att_course_ref = $attCourse;
$att_course_ref_tmp = $attCourse;

ob_start();
include $legacyRoot . '/student_mattendance.php';
$full = ob_get_clean();

if (preg_match('/<table[^>]*border="0"[^>]*width="100%"/s', $full, $tableMatch, PREG_OFFSET_CAPTURE)) {
    $start = $tableMatch[0][1];
  $fragment = substr($full, $start);
  if (preg_match('/^(.*?<\/table>)/s', $fragment, $tableOnly)) {
    echo json_encode(['html' => $tableOnly[1]]);
    exit(0);
  }
  echo json_encode(['html' => $fragment]);
  exit(0);
}

if (stripos($full, 'Holiday') !== false || stripos($full, 'No ') !== false) {
  echo json_encode(['html' => $full, 'message' => 'No attendance sheet for this date']);
  exit(0);
}

echo json_encode(['html' => $full]);
