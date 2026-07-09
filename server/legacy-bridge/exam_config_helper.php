<?php

function exam_config_screen_map(): array
{
    return [
        'exam-names' => 'exam_name_config.php',
        'exam-setup' => 'term_exam_setup.php',
        'mark-entry' => 'term_mark_entry.php',
        'exam-batch' => 'exam_batch.php',
        'term-report' => 'term_report.php',
        'term-statement' => 'term_report_statement.php',
        'progress-card' => 'term_progress_card.php',
        'mark-sheet' => 'term_mark_sheet.php',
        'exam-schedule' => 'term_exam_schedule.php',
        'marks-upload' => 'term_marks_upload.php',
        'schedule-print' => 'term_exam_sch_print.php',
        'invigilator-print' => 'term_exam_Inviliga_sch_print.php',
        'report-analysis' => 'term_report_analysis.php',
        'omr-config' => 'omr_style_config.php',
    ];
}

function exam_config_apply_post(array $fields): void
{
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
}

function exam_config_extract(string $full): array
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
                || stripos($chunk, 'exam_addRow') !== false
                || stripos($chunk, '.datepicker') !== false
                || stripos($chunk, 'multipleSelect') !== false
                || stripos($chunk, 'callPrintContent') !== false
                || stripos($chunk, 'callPrintHeader') !== false
                || stripos($chunk, 'validatenumber') !== false
                || stripos($chunk, 'calculate') !== false
                || stripos($chunk, 'callPrint') !== false
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
