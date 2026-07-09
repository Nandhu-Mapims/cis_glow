<?php

function academic_config_screen_map(): array
{
    return [
        'subject-master' => 'subject_master.php',
        'course-add' => 'course_add.php',
        'course-edit' => 'course_edit.php',
        'academic-years' => 'academic.php',
        'subject-setup' => 'subject_setup.php',
        'subject-batch' => 'subject_batch.php',
        'academic-calendar' => 'academic_calendar.php',
        'subject-schedule' => 'subject_schedule.php',
        'subject-unit' => 'subject_unit_setup_v2.php',
        'admission-exam' => 'academic_admission_setup.php',
        'master-setup' => 'master_setup.php',
        'subject-report' => 'subject_report.php',
        'timetable-report' => 'timetable_class_report.php',
        'batch-timetable-report' => 'class_time_table_batch_report.php',
        'tt-config' => 'tt_config.php',
    ];
}

function academic_config_apply_post(array $fields): void
{
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
}

function academic_config_extract(string $full): array
{
    $html = '';
    $scripts = '';

    if (preg_match(
        '/<div class="panel-body">\s*<div class="form">(.*?)<\/div>\s*(?:<\?PHP\s+echo \$report\s+\?>\s*)?<\/div>/s',
        $full,
        $matches
    )) {
        $html = trim($matches[1]);
    } elseif (preg_match('/<form[^>]*id="signupForm"[^>]*>.*?<\/form>/s', $full, $matches)) {
        $html = trim($matches[0]);
    }

    if (preg_match_all('/<script>(.*?)<\/script>/s', $full, $scriptMatches)) {
        $chunks = [];
        foreach ($scriptMatches[1] as $chunk) {
            $chunk = trim($chunk);
            if ($chunk === '') {
                continue;
            }
            if (stripos($chunk, 'subject_addRow') !== false
                || stripos($chunk, 'tsubject_addRow') !== false
                || stripos($chunk, 'fee_addRow') !== false
                || stripos($chunk, 'unit_addRow') !== false
                || stripos($chunk, 'callPrintContent') !== false
                || stripos($chunk, 'callPrintHeader') !== false
                || stripos($chunk, 'saveTimetable') !== false
                || stripos($chunk, 'tt_config_more') !== false
                || stripos($chunk, 'tsubject_addRow') !== false
                || stripos($chunk, 'create_batch') !== false
                || stripos($chunk, '.datepicker') !== false
                || stripos($chunk, 'multipleSelect') !== false
                || stripos($chunk, 'dodacheckalphanum') !== false
                || stripos($chunk, 'validatenumber') !== false
                || stripos($chunk, 'validatephone') !== false
            ) {
                $chunks[] = $chunk;
            }
        }
        $scripts = implode("\n\n", $chunks);
    }

    $message = '';
    if (preg_match('/class="alert[^"]*">.*?<strong>([^<]+)<\/strong>\s*([^<]*)/s', $full, $alertMatch)) {
        $message = trim($alertMatch[1] . ' ' . strip_tags($alertMatch[2]));
    }

    $success = stripos($full, 'alert-success') !== false;

    return [
        'html' => $html,
        'scripts' => $scripts,
        'message' => $message,
        'success' => $success,
    ];
}
