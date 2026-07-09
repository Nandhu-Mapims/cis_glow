<?php

function payroll_config_screen_map(): array
{
    return [
        'individual-setup' => 'payroll_individual_setup.php',
        'cron-setup' => 'payroll_cron_setup.php',
        'stipend-amount-setup' => 'stipend_amount_setup.php',
        'stipend-deduction-add' => 'stipend_deduction_add.php',
        'stipend-payroll-close' => 'stipend_payroll_close.php',
    ];
}

function payroll_config_apply_post(array $fields): void
{
    $_POST = $fields;
    $_REQUEST = array_merge($_GET ?? [], $_POST);
}

function payroll_config_rewrite_asset_paths(string $html): string
{
    return str_replace(['src="img/', "src='img/"], ['src="/legacy/img/', "src='/legacy/img/"], $html);
}

function payroll_config_extract(string $full): array
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

    $html = payroll_config_rewrite_asset_paths($html);

    if (preg_match_all('/<script>(.*?)<\/script>/s', $full, $scriptMatches)) {
        $chunks = [];
        foreach ($scriptMatches[1] as $chunk) {
            $chunk = trim($chunk);
            if ($chunk === '') {
                continue;
            }
            if (stripos($chunk, 'subject_addRow') !== false
                || stripos($chunk, 'callClear') !== false
                || stripos($chunk, 'validateamount') !== false
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
