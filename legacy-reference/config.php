<?
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING ^ E_DEPRECATED);
$host="localhost"; // Host name
$username_db="apdchedu_cisapp"; // mysqli username
$password_db="Qw4)u[cdgTSE"; // mysqli password
$db_name="apdchedu_cisapp"; // Database name
($GLOBALS["__CIS_MYSQLI"] = mysqli_connect($host,  $username_db,  $password_db))or die("cannot connect to server");
mysqli_select_db($GLOBALS["__CIS_MYSQLI"], $db_name)or die("cannot select DB");


/*mysqli_connect($host, $username_db, $password_db)or die("cannot connect to server");
mysqli_select_db($db_name)or die("cannot select DB");*/

$query_time_zone="SELECT * FROM basic_setup_tb Where del = 1" ;
$result_time_zone=mysqli_query($GLOBALS["__CIS_MYSQLI"], $query_time_zone);
if($result_time_zone)
{
$rows_time_zone = mysqli_fetch_array($result_time_zone);
$bs_time_zone = $rows_time_zone['time_zone'];
$bs_site_url = $rows_time_zone['site_url'];
$bs_institution_name = $rows_time_zone['institution_name'];
$bs_institution_name_2 = $rows_time_zone['institution_name_2'];
$bs_institution_short_name = $rows_time_zone['institution_short_name'];
$bs_c_email_id= $rows_time_zone['instution_email'];
$bs_c_logo_url= $rows_time_zone['institution_logo'];
$bs_logo_c_name=stripslashes($bs_logo_c_name);
mysqli_query($GLOBALS["__CIS_MYSQLI"], "SET SESSION group_concat_max_len = 1000000");
}
if(strtolower($_SESSION['empusername_login'])=='igrapix'){
    
define('ADMIN_TITLE',"iGraCIS");
define('ADMIN_LARGE_TITLE',"iGraCIS");
define('ADMIN_TITLE1',"iGraCIS");
define('ADMIN_TITLE2',"iGraCIS");
}
else{
define('ADMIN_TITLE',$bs_institution_short_name);
define('ADMIN_LARGE_TITLE',trim($bs_institution_name.' '.$bs_institution_name_2));
define('ADMIN_TITLE1',$bs_institution_name);
define('ADMIN_TITLE2',$bs_institution_name_2);
}
define('ADMIN_PATH',$bs_site_url);
define('ADMIN_EMAIL',$bs_c_email_id);
define('ADMIN_TIME_ZONE',$bs_time_zone);
define('ADMIN_IMAGE',$bs_c_logo_url);
define('ATT_MONTH_SHOW','1');
define('ATT_MONTH_FROM','2017-02-01');
define('ATT_EOS',2016);
define('EXAM_EOS',2015);
define('IDCARD_YEAR','APDS');
define('IDCARD_LEN','4');
define('STU_IDCARD_YEAR','APS');
define('STU_IDCARD_LEN','3');


?>
