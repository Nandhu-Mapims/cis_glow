<?php

function fee_config_screen_map(): array
{
    return [
        'label' => 'fee_label_config.php',
        'type' => 'fee_type_config.php',
        'bank' => 'fee_bank_config.php',
        'fine' => 'fee_fine_config.php',
        'name' => 'fee_name_config.php',
    ];
}

function fee_config_apply_post(array $fields): void
{
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
}

function fee_config_extract(string $full): array
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
                || stripos($chunk, 'fee_addRow') !== false
                || stripos($chunk, '.datepicker') !== false
                || stripos($chunk, 'multipleSelect') !== false
                || stripos($chunk, 'checkFeeScholar') !== false
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
