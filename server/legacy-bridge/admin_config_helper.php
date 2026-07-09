<?php

function admin_config_screen_map(): array
{
    return [
        'account-add' => 'account_add.php',
        'account-edit' => 'account_edit.php',
        'access-restriction' => 'access.php',
        'dept-auth' => 'department_authentication.php',
        'menu-auth' => 'authentication_add.php',
        'dashboard-access' => 'dashboard_access.php',
    ];
}

function admin_config_apply_post(array $fields): void
{
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
}

function admin_config_extract(string $full): array
{
    $html = '';
    $scripts = '';

    if (preg_match(
        '/<aside class="profile-info[^"]*page_container">\s*<div id="top_notification">.*?<div class="col-lg-12">\s*<section class="panel">\s*<div class="panel-body">(.*?)<\/div>\s*<\/section>\s*<\/div>\s*<\/aside>/s',
        $full,
        $matches
    )) {
        $html = trim($matches[1]);
    } elseif (preg_match('/<form[^>]*id="fm_validation"[^>]*>.*?<\/form>/s', $full, $matches)) {
        $html = trim($matches[0]);
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
            if (stripos($chunk, 'generatepass') !== false
                || stripos($chunk, 'populateform') !== false
                || stripos($chunk, 'dodacheckalphanum') !== false
                || stripos($chunk, 'validatenumber') !== false
                || stripos($chunk, 'call_day') !== false
                || stripos($chunk, 'call_loginkey') !== false
                || stripos($chunk, 'multipleSelect') !== false
                || stripos($chunk, 'datetimepicker') !== false
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
