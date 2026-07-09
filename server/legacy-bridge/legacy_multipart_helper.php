<?php

function legacy_apply_uploaded_files(array $files): void
{
    if (empty($files)) {
        return;
    }

    foreach ($files as $spec) {
        $field = $spec['field'] ?? '';
        if ($field === '' || empty($spec['content'])) {
            continue;
        }

        $isArray = str_ends_with($field, '[]');
        $fieldName = $isArray ? substr($field, 0, -2) : $field;
        $tmp = tempnam(sys_get_temp_dir(), 'cisup_');
        $binary = base64_decode($spec['content'], true);
        if ($binary === false) {
            continue;
        }
        file_put_contents($tmp, $binary);

        $fileMeta = [
            'name' => $spec['filename'] ?? 'upload.bin',
            'type' => $spec['type'] ?? 'application/octet-stream',
            'tmp_name' => $tmp,
            'error' => 0,
            'size' => strlen($binary),
        ];

        if ($isArray) {
            $index = isset($spec['index']) ? (int) $spec['index'] : 0;
            foreach (['name', 'type', 'tmp_name', 'error', 'size'] as $key) {
                if (!isset($_FILES[$fieldName][$key]) || !is_array($_FILES[$fieldName][$key])) {
                    $_FILES[$fieldName][$key] = [];
                }
                $_FILES[$fieldName][$key][$index] = $fileMeta[$key];
            }
        } else {
            $_FILES[$fieldName] = $fileMeta;
        }
    }
}
