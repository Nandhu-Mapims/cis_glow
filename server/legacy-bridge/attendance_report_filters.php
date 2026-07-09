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

include_once $legacyRoot . '/widget.php';

$academicYears = [];
$sql = "SELECT DISTINCT(academic_year) FROM basic_setup_subject_tb WHERE del=1 ORDER BY academic_year ASC";
$result = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sql);
while (($row = mysqli_fetch_array($result)) !== false) {
    $academicYears[] = $row[0];
}

$sqlSetup = mysqli_query($GLOBALS['__CIS_MYSQLI'], "SELECT ug_academic_year FROM basic_setup_tb WHERE del=1 LIMIT 1");
$setup = mysqli_fetch_array($sqlSetup);
$defaultYear = $setup['ug_academic_year'] ?? ($academicYears[0] ?? '');

$academicYear = $input['academicYear'] ?? $defaultYear;
$courses = [];

$sql_section = 'SELECT * FROM basic_setup_course_tb WHERE del=1 AND course_name="U.G" ORDER BY c_order ASC';
$result_section = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sql_section);
while (($row_section = mysqli_fetch_array($result_section)) !== false) {
    $c_id = $row_section['id'];
    $degree_name = stripslashes($row_section['degree_name']);
    $department_name = stripslashes($row_section['department_name']);
    if (trim($department_name) !== '' && trim($department_name) !== '-') {
        $department_name = ' - ' . $department_name;
    } else {
        $department_name = '';
    }
    $course_duration = stripslashes($row_section['course_duration']);
    $course_duration--;

    $groupLabel = $degree_name . $department_name . ' | ' . $academicYear;
    $options = [];
    for ($i = 1; $i <= $course_duration; $i++) {
        $cyear_label = convertNYear($i, 'U.G');
        $options[] = [
            'value' => $c_id . '___' . $academicYear . '___' . $i . '___regular',
            'label' => $cyear_label . ' Year',
        ];
        $options[] = [
            'value' => $c_id . '___' . $academicYear . '___' . $i . '___additional',
            'label' => $cyear_label . ' Year (Additional)',
        ];
    }
    $courses[] = [
        'groupLabel' => $groupLabel,
        'options' => $options,
    ];
}

$subjects = [];
if (!empty($input['courses']) && is_array($input['courses'])) {
    $subject_subcat_array = [];
    $result_dept = mysqli_query($GLOBALS['__CIS_MYSQLI'], "SELECT * FROM subject_master WHERE del=1 AND category='Timetable' ORDER BY category_order ASC");
    while (($row_dept = mysqli_fetch_array($result_dept)) !== false) {
        $subject_subcat_array[$row_dept['id']] = stripslashes($row_dept['category_name']);
    }

    foreach ($input['courses'] as $cstr) {
        $tmp = explode('___', $cstr);
        if (count($tmp) < 4) {
            continue;
        }
        $ref_course_id = $tmp[0];
        $ref_academic_year = $tmp[1];
        $ref_current_year = $tmp[2];
        $ref_academic_type = $tmp[3];

        $sql_sub = "SELECT DISTINCT(A.subject_id), B.subject_name, B.subject_code, B.department
          FROM timetable_tb AS A
          INNER JOIN basic_setup_subject_tb AS B ON A.subject_id=B.id
          WHERE A.del=1 AND B.del=1
            AND A.course_id='$ref_course_id'
            AND A.academic_year='$ref_academic_year'
            AND A.current_year='$ref_current_year'
            AND A.academic_type='$ref_academic_type'
          ORDER BY B.subject_name ASC";
        $result_sub = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sql_sub);
        while (($row_sub = mysqli_fetch_array($result_sub)) !== false) {
            $sid = $row_sub['subject_id'];
            $sname = stripslashes($row_sub['subject_name']);
            $scode = stripslashes($row_sub['subject_code']);
            $dept = $subject_subcat_array[$row_sub['department']] ?? '';
            $subjects[] = [
                'value' => $cstr . '___' . $sid,
                'label' => trim($sname . ' (' . $scode . ')' . ($dept ? ' - ' . $dept : '')),
            ];
        }
    }
}

echo json_encode([
    'academicYears' => $academicYears,
    'defaultAcademicYear' => $defaultYear,
    'courses' => $courses,
    'subjects' => $subjects,
]);
