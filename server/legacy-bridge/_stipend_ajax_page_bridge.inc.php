<?php

function stipend_ajax_page_bridge_run(string $legacyPhpFile): void
{
    $input = json_decode(file_get_contents('php://stdin'), true);
    if (!$input || empty($input['memberId'])) {
        echo json_encode(['error' => 'memberId required']);
        exit(1);
    }

    legacy_bridge_bootstrap($input);

    $legacyRoot = getenv('LEGACY_CIS_PATH') ?: '/home/mapims/cis/cis';
    chdir($legacyRoot);

    $fields = $input['fields'] ?? [];
    if (!empty($fields)) {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = $fields;
        $_REQUEST = array_merge($_GET ?? [], $_POST);
    } else {
        $_SERVER['REQUEST_METHOD'] = 'GET';
    }

    ob_start();
    include $legacyRoot . '/' . $legacyPhpFile;
    $full = ob_get_clean();

    $html = '';
    if (preg_match('/<form[^>]*id="signupForm"[^>]*>.*?<\/form>/s', $full, $matches)) {
        $html = trim($matches[0]);
    }

    $pageStyles = '';
    if (preg_match('/<style>(.*?)<\/style>/s', $full, $styleMatch)) {
        $pageStyles = trim($styleMatch[1]);
    }

    $styles = '';
    if (preg_match('/<textarea id="salary_style_id"[^>]*>(.*?)<\/textarea>/s', $full, $salaryStyleMatch)) {
        $styles = html_entity_decode(trim($salaryStyleMatch[1]), ENT_QUOTES);
    }

    $scripts = '';
    if (preg_match_all('/<script>(.*?)<\/script>/s', $full, $scriptMatches)) {
        $chunks = [];
        foreach ($scriptMatches[1] as $chunk) {
            $chunk = trim($chunk);
            if ($chunk === '') {
                continue;
            }
            if (stripos($chunk, 'multipleSelect') !== false
                || stripos($chunk, 'generatePayroll') !== false
                || stripos($chunk, 'callCupdate') !== false
            ) {
                $chunks[] = $chunk;
            }
        }
        $scripts = implode("\n\n", $chunks);
    }

    if ($html === '') {
        echo json_encode([
            'error' => 'Unable to parse stipend page HTML',
            'page' => $legacyPhpFile,
            'raw' => substr($full, 0, 500),
        ]);
        exit(1);
    }

    echo json_encode([
        'html' => $html,
        'scripts' => $scripts,
        'pageStyles' => $pageStyles,
        'styles' => $styles,
    ]);
    exit(0);
}
