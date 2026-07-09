<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_stipend_ajax_page_bridge.inc.php';

stipend_ajax_page_bridge_run('stipend_payroll_att_report.php');
