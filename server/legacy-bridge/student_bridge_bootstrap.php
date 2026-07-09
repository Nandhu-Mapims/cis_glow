<?php

function student_bridge_bootstrap(array $input): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
    chdir($legacyRoot . '/student');

    $_SESSION['suclgusername_login'] = $input['registerNo'] ?? '';
    if (!empty($input['memberId'])) {
        $_SESSION['empusername_login'] = $input['memberId'];
    }
}
