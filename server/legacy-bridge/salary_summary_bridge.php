<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_payroll_form_bridge.inc.php';

payroll_form_bridge_run('salary_summary.php');
