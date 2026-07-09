<?php
session_start();
$a_username=$_SESSION['empusername_login'];
if(!ADMIN_PATH)
include('config.php');
function insert_log($log_object)
{
$log_object[0]=addslashes($log_object[0]);
$log_object[1]=addslashes($log_object[1]);
$log_object[2]=addslashes($log_object[2]);
$log_object[3]=addslashes($log_object[3]);
$log_object[4]=addslashes($log_object[4]);
$log_object[5]=addslashes($log_object[5]);
$log_object[6]=addslashes($log_object[6]);
$log_object[7]=addslashes($log_object[7]);
$url_1=explode('?',$log_object[0]);
$url_2=explode('/',$url_1[0]);
$url_3=$url_2[sizeof($url_2)-1];
$a_session_id=$_SESSION['empusername_session_id'];

$sql="INSERT INTO log_tb(log_page, log_operation, log_status, log_description, log_timestamp, log_ipaddress, log_os, log_username, 	log_session) VALUES ('$url_3','$log_object[1]','$log_object[2]','$log_object[3]','$log_object[4]','$log_object[5]','$log_object[6]','$log_object[7]','$a_session_id')";
mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql);
}
if($_SERVER['REQUEST_METHOD']=='GET')
{
$flag=$_GET['flag'];
$p_k=$_GET['p_k'];
$url=$_GET['url'];
if($flag==1 && $p_k=='true')
{
//////////////Set Time Zone/////////////////
$query_time_zone="SELECT * FROM basic_setup_tb Where del = 1" ;
$result_time_zone=mysqli_query($GLOBALS["__CIS_MYSQLI"], $query_time_zone);
if($result_time_zone)
	{
	$rows_time_zone = mysqli_fetch_array($result_time_zone);
	$time_zone = $rows_time_zone['time_zone'];
	}
date_default_timezone_set($time_zone);
$a_user_dt=date("Y-m-d H:i:s");
$a_user_ip=$_SERVER['REMOTE_ADDR'];
$a_user_os=$_SERVER['HTTP_USER_AGENT'];

$url_1=explode('?',$url);
$url_2=explode('/',$url_1[0]);
$url_3=$url_2[sizeof($url_2)-1];

$log_object_1=array($url_3,'Print Screen','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);

insert_log($log_object_1);

echo $log_object_1[0];

}
}
?>
