<?php
/**
 * Shared CLI bootstrap for legacy PHP includes.
 */
function legacy_bridge_bootstrap(array $input): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SESSION['empusername_login'] = $input['memberId'] ?? '';

    $legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
    chdir($legacyRoot);
}
