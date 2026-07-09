<?php

function colage_hex2rgb($color)
{
    $color = str_pad(preg_replace('/[^0-9A-Fa-f]/', '', (string)$color), 6, '0', STR_PAD_RIGHT);
    return [
        hexdec(substr($color, 0, 2)),
        hexdec(substr($color, 2, 2)),
        hexdec(substr($color, 4, 2)),
    ];
}

function colage_get_student($a_no)
{
    $rows_student = [];
    if (!$a_no) {
        return $rows_student;
    }

    $a_no = addslashes(trim($a_no));
    $sql_student = "SELECT register_no, student_name, student_initial, student_title, course_id, 'student_idcard'
        FROM student_profile_tb WHERE register_no='$a_no' AND del=1";
    $result_student = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sql_student);
    if ($result_student && mysqli_num_rows($result_student) > 0) {
        return mysqli_fetch_array($result_student);
    }

    $sql_student = "SELECT staff_id, staff_name, staff_initial, staff_title, job_category, 'staff_idcard'
        FROM staff_profile_tb WHERE staff_id='$a_no' AND del=1";
    $result_student = mysqli_query($GLOBALS['__CIS_MYSQLI'], $sql_student);
    if ($result_student) {
        return mysqli_fetch_array($result_student) ?: [];
    }

    return $rows_student;
}

function colage_merge_dimensions($merge_box, $column_count, $photo_width, $photo_height, $photo_margin)
{
    if (!$merge_box || $column_count < 1) {
        return [0, 0];
    }
    if (!preg_match('/\(([^)]+)\)/', $merge_box, $match)) {
        return [0, 0];
    }
    $cells = array_map('intval', explode(',', $match[1]));
    $cells = array_filter($cells, static fn($cell) => $cell > 0);
    if (!$cells) {
        return [0, 0];
    }

    $rows = [];
    $cols = [];
    foreach ($cells as $cell) {
        $rows[] = (int)ceil($cell / $column_count) - 1;
        $cols[] = ($cell - 1) % $column_count;
    }

    $merge_rows = max($rows) - min($rows) + 1;
    $merge_cols = max($cols) - min($cols) + 1;
    $width = ($merge_cols * $photo_width) + ($merge_cols * $photo_margin * 2);
    $height = ($merge_rows * $photo_height) + ($merge_rows * $photo_margin * 2);

    return [$width, $height];
}

function colage_generate_output(array $fields)
{
    $search_by_a_no = trim((string)($fields['search_by_a_no'] ?? ''));
    if ($search_by_a_no === '') {
        return ['error' => 'Enter register / staff numbers (comma separated).'];
    }

    $photo_width = (int)($fields['photo_width'] ?? 250);
    $photo_height = (int)($fields['photo_height'] ?? 240);
    $photo_bgcolor = (string)($fields['photo_bgcolor'] ?? 'FFFFFF');
    $photo_margin = (int)($fields['photo_margin'] ?? 5);
    $template_id = (string)($fields['template_id'] ?? '');
    $row_count = max(1, (int)($fields['row_count'] ?? 6));
    $column_count = max(1, (int)($fields['column_count'] ?? 6));

    $merge_a_no = (string)($fields['merge_a_no'] ?? '');
    $merge_box = (string)($fields['merge_box'] ?? '');
    $m_width = (int)($fields['m_width'] ?? 0);
    $m_height = (int)($fields['m_height'] ?? 0);
    $m_bgcolor = (string)($fields['m_bgcolor'] ?? 'FFFFFF');
    $m_template_id = (string)($fields['m_template_id'] ?? '');

    if ($merge_box && ($m_width <= 0 || $m_height <= 0)) {
        [$autoWidth, $autoHeight] = colage_merge_dimensions(
            $merge_box,
            $column_count,
            $photo_width,
            $photo_height,
            $photo_margin,
        );
        if ($m_width <= 0) {
            $m_width = $autoWidth;
        }
        if ($m_height <= 0) {
            $m_height = $autoHeight;
        }
    }

    $name_enable = !empty($fields['name_enable']) && $fields['name_enable'] !== '0';
    $name_size = (int)($fields['name_size'] ?? 14);
    $name_height = (int)($fields['name_height'] ?? 25);
    $name_color = (string)($fields['name_color'] ?? '333333');

    $m_name_enable = !empty($fields['m_name_enable']) && $fields['m_name_enable'] !== '0';
    $m_name_size = (int)($fields['m_name_size'] ?? 25);
    $m_name_height = (int)($fields['m_name_height'] ?? 30);
    $m_name_color = (string)($fields['m_name_color'] ?? '333333');

    $extended_height = 0;
    if ($name_enable) {
        $extended_height = $name_height;
    }
    if ($m_name_enable && $extended_height < $m_name_height) {
        $extended_height = $m_name_height;
    }

    $merge_box_list = [];
    $merge_position = [];
    if ($merge_box) {
        $admin_no_list = explode(',', $merge_a_no);
        $merge_box_tmp = explode(')', $merge_box);
        $r = 1;
        for ($m = 0; $m < count($merge_box_tmp); $m++) {
            $mb = substr($merge_box_tmp[$m], 1);
            if ($mb) {
                $mb_list = explode(',', $mb);
                foreach ($mb_list as $m_cell) {
                    $merge_position[(int)$m_cell] = $r;
                }
                $merge_box_list[$r] = [
                    'box' => $mb_list,
                    'ano' => $admin_no_list[($r - 1)] ?? '',
                    'status' => '',
                ];
                $r++;
            }
        }
    }

    $pbg = colage_hex2rgb($photo_bgcolor);
    $mbg = colage_hex2rgb($m_bgcolor);

    $template_img = 0;
    $t_output = null;
    if ($template_id) {
        $sql_t = mysqli_fetch_array(mysqli_query(
            $GLOBALS['__CIS_MYSQLI'],
            "SELECT image_filename FROM colage_image_tb WHERE id='" . addslashes($template_id) . "'"
        ));
        $template_image = $sql_t[0] ?? '';
        $template_path = 'files/cage/cimg/' . $template_image;
        if (file_exists($template_path) && $template_image) {
            $size = getimagesize($template_path);
            $s_width = $size[0];
            $s_height = $size[1];
            $s_type = $size[2];
            if ($s_type == 1) {
                $t_source = imagecreatefromgif($template_path);
            } elseif ($s_type == 2) {
                $t_source = imagecreatefromjpeg($template_path);
            } elseif ($s_type == 3) {
                $t_source = imagecreatefrompng($template_path);
            } else {
                $t_source = null;
            }
            if ($t_source) {
                $t_output = imagecreatetruecolor($photo_width, $photo_height);
                imagesavealpha($t_output, true);
                $transparent = imagecolorallocatealpha($t_output, 0, 0, 0, 127);
                imagefill($t_output, 0, 0, $transparent);
                imagecopyresized($t_output, $t_source, 0, 0, 0, 0, $photo_width, $photo_height, $s_width, $s_height);
                imagedestroy($t_source);
                $template_img = 1;
            }
        }
    }

    $template_mimg = 0;
    $tm_output = null;
    if ($m_template_id && $m_width > 0 && $m_height > 0) {
        $sql_t = mysqli_fetch_array(mysqli_query(
            $GLOBALS['__CIS_MYSQLI'],
            "SELECT image_filename FROM colage_image_tb WHERE id='" . addslashes($m_template_id) . "'"
        ));
        $template_image = $sql_t[0] ?? '';
        $template_path = 'files/cage/cimg/' . $template_image;
        if (file_exists($template_path) && $template_image) {
            $size = getimagesize($template_path);
            $s_width = $size[0];
            $s_height = $size[1];
            $s_type = $size[2];
            if ($s_type == 1) {
                $t_source = imagecreatefromgif($template_path);
            } elseif ($s_type == 2) {
                $t_source = imagecreatefromjpeg($template_path);
            } elseif ($s_type == 3) {
                $t_source = imagecreatefrompng($template_path);
            } else {
                $t_source = null;
            }
            if ($t_source) {
                $tm_output = imagecreatetruecolor($m_width, $m_height);
                imagesavealpha($tm_output, true);
                $transparent = imagecolorallocatealpha($tm_output, 0, 0, 0, 127);
                imagefill($tm_output, 0, 0, $transparent);
                imagecopyresized($tm_output, $t_source, 0, 0, 0, 0, $m_width, $m_height, $s_width, $s_height);
                imagedestroy($t_source);
                $template_mimg = 1;
            }
        }
    }

    $total_width = ($column_count * $photo_width) + ($column_count * $photo_margin * 2);
    $total_height = ($row_count * $photo_height) + ($row_count * $photo_margin * 2) + ($row_count * $extended_height);

    $out_x = $photo_margin;
    $out_y = $photo_margin;
    $r_count = 0;
    $s_count = 0;
    $total_cell = $column_count * $row_count;

    $output = imagecreatetruecolor($total_width, $total_height);
    imagesavealpha($output, true);
    $transparent = imagecolorallocatealpha($output, 255, 255, 255, 0);
    imagefill($output, 0, 0, $transparent);

    $name_color_alloc = imagecolorallocate($output, 0, 0, 0);
    $m_name_color_alloc = imagecolorallocate($output, 0, 0, 0);
    $font_name = 'FreeSansBold.ttf';
    $font_exists = file_exists($font_name);

    $a_no_temp = explode(',', $search_by_a_no);
    for ($c = 0; $c < $total_cell; $c++) {
        $row_increment = 0;
        $fill_status = 0;
        $ref_r = $merge_position[($r_count + 1)] ?? 0;
        if ($ref_r) {
            $mb_info = $merge_box_list[$ref_r];
            $fill_status = 1;
            if ($mb_info['status'] === '') {
                $merge_box_list[$ref_r]['status'] = 'fill';
                $row_increment = 1;
                $rows_student = colage_get_student($mb_info['ano']);
                $s_no = $rows_student[0] ?? '';
                $s_name = trim(($rows_student[1] ?? '') . ' ' . ($rows_student[2] ?? ''));
                $s_type = $rows_student[5] ?? 'student_idcard';
                $s_path = 'files/' . $s_type . '/' . $s_no . '.png';
                if ($s_no && file_exists($s_path) && $m_width > 0 && $m_height > 0) {
                    $size = getimagesize($s_path);
                    $stu_isrc = imagecreatefrompng($s_path);
                    $stu_iout = imagecreatetruecolor($m_width, $m_height);
                    imagesavealpha($stu_iout, true);
                    $transparent = imagecolorallocatealpha($stu_iout, $mbg[0], $mbg[1], $mbg[2], 0);
                    imagefill($stu_iout, 0, 0, $transparent);
                    imagecopyresized($stu_iout, $stu_isrc, 0, 0, 0, 0, $m_width, $m_height, $size[0], $size[1]);
                    if ($template_mimg == 1 && $tm_output) {
                        imagecopyresized($stu_iout, $tm_output, 0, 0, 0, 0, $m_width, $m_height, $m_width, $m_height);
                    }
                    imagecopymerge($output, $stu_iout, $out_x, $out_y, 0, 0, $m_width, $m_height, 100);
                    if ($m_name_enable && $font_exists) {
                        $text_box = imagettfbbox($m_name_size, 0, $font_name, $s_name);
                        $text_width = $text_box[2] - $text_box[0];
                        $t_x = $m_width > $text_width ? $out_x + floor(($m_width - $text_width) / 2) : $out_x;
                        $t_y = $out_y + $m_height + $m_name_height;
                        imagettftext($output, $m_name_size, 0, $t_x, $t_y, $m_name_color_alloc, $font_name, $s_name);
                    }
                    imagedestroy($stu_isrc);
                    imagedestroy($stu_iout);
                }
            }
        }

        if ($fill_status == 0) {
            $a_no = trim($a_no_temp[$s_count] ?? '');
            $rows_student = colage_get_student($a_no);
            $s_no = $rows_student[0] ?? '';
            $s_name = trim(($rows_student[1] ?? '') . ' ' . ($rows_student[2] ?? ''));
            $s_type = $rows_student[5] ?? 'student_idcard';
            $s_path = 'files/' . $s_type . '/' . $s_no . '.png';
            if ($s_no && file_exists($s_path)) {
                $row_increment = 1;
                $size = getimagesize($s_path);
                $stu_isrc = imagecreatefrompng($s_path);
                $stu_iout = imagecreatetruecolor($photo_width, $photo_height);
                imagesavealpha($stu_iout, true);
                $transparent = imagecolorallocatealpha($stu_iout, $pbg[0], $pbg[1], $pbg[2], 0);
                imagefill($stu_iout, 0, 0, $transparent);
                imagecopyresized($stu_iout, $stu_isrc, 0, 0, 0, 0, $photo_width, $photo_height, $size[0], $size[1]);
                if ($template_img == 1 && $t_output) {
                    imagecopyresized($stu_iout, $t_output, 0, 0, 0, 0, $photo_width, $photo_height, $photo_width, $photo_height);
                }
                imagecopymerge($output, $stu_iout, $out_x, $out_y, 0, 0, $photo_width, $photo_height, 100);
                if ($name_enable && $font_exists) {
                    $text_box = imagettfbbox($name_size, 0, $font_name, $s_name);
                    $text_width = $text_box[2] - $text_box[0];
                    $t_x = $photo_width > $text_width ? $out_x + floor(($photo_width - $text_width) / 2) : $out_x;
                    $t_y = $out_y + $photo_height + $name_height;
                    imagettftext($output, $name_size, 0, $t_x, $t_y, $name_color_alloc, $font_name, $s_name);
                }
                imagedestroy($stu_isrc);
                imagedestroy($stu_iout);
            }
            $s_count++;
        } else {
            $row_increment = 1;
        }

        if ($row_increment == 1) {
            $out_x += $photo_width + ($photo_margin * 2);
            $r_count++;
            if ($r_count % $column_count == 0) {
                $out_x = $photo_margin;
                $out_y += $photo_height + $name_height + ($photo_margin * 2);
            }
        }
    }

    if ($t_output) {
        imagedestroy($t_output);
    }
    if ($tm_output) {
        imagedestroy($tm_output);
    }

    $output_dir = 'files/cage/output';
    if (!is_dir($output_dir)) {
        mkdir($output_dir, 0755, true);
    }
    $filename = 'col' . date('dmyHis') . '.jpg';
    $final_output = $output_dir . '/' . $filename;
    imagejpeg($output, $final_output, 99);
    imagedestroy($output);

    return [
        'filename' => $filename,
        'outputUrl' => '/legacy/files/cage/output/' . rawurlencode($filename),
        'relativePath' => $final_output,
    ];
}
