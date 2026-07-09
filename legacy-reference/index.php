<?PHP 
session_start();
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
$from_webpage=$_SESSION['empusername_login'];
$_SESSION['empusername_login']='';
$_SESSION['empuserid_login']='';
$_SESSION['empuserauth_login']='';
$_SESSION['accessid_login']='';
$_SESSION['access_type']='';
ob_start();
include_once('config.php');
include_once('log.php');
include_once('password.php');
$wrongusername='';



//////////////Set Time Zone/////////////////
$query_time_zone="SELECT * FROM basic_setup_tb Where del = 1" ;
$result_time_zone=mysqli_query($GLOBALS["__CIS_MYSQLI"], $query_time_zone);
if($result_time_zone)
{
$rows_time_zone = mysqli_fetch_array($result_time_zone);
$time_zone = $rows_time_zone['time_zone']; 
$bs_site_url=$rows_time_zone['site_url'];
}
date_default_timezone_set($time_zone);
$a_user_dt=date("Y-m-d H:i:s");
$a_user_ip=$_SERVER['REMOTE_ADDR'];
$a_user_os=$_SERVER['HTTP_USER_AGENT'];

if(!isset($_SERVER["HTTPS"]) || $_SERVER["HTTPS"] !="on")
{
    //Tell the browser to redirect to the HTTPS URL.
    //header("Location: welcome.php");
    //Prevent the rest of the script from executing.
    exit;
}

$past_fivemin=date('Y-m-d H:i:s', strtotime('-5 minutes', strtotime(date('d-m-Y H:i:s'))));
$sql_1=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT log_timestamp FROM log_tb WHERE log_ipaddress='$a_user_ip' AND log_page='index' AND log_status!='Successful'  AND log_timestamp>='$past_fivemin'");
if(mysqli_num_rows($sql_1)<5)
{

if(trim($from_webpage)!='')
{
//$from_webpage = mysqli_real_escape_string($from_webpage);
$from_webpage = strtoupper(strtolower($from_webpage));
$sql="SELECT * FROM web_account_setup WHERE member_id='$from_webpage' AND del=1";

$result=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql);
if($result)
{
$rows = mysqli_fetch_array($result);
$a_username = $rows['member_id'];
$a_address_email = $rows['address_email'];
$a_password = $rows['password'];
$re_password = $rows['reset_password'];
$user_id=$rows['id'];
$auth_type=$rows['access_type'];

if($a_password!=NULL  && $a_username!=NULL   && $from_webpage!=NULL)
{
if(strtolower($a_username)==strtolower($from_webpage))
{

$results=access_check($user_id,$a_username,$auth_type,$a_username,$a_user_dt,$a_user_ip,$a_user_os);
if($results[0]==1)
{
$_SESSION['empusername_login'] = $a_username;
$_SESSION['empuserid_login'] = trim($user_id);
$_SESSION['empuserauth_login'] = $auth_type;
$_SESSION['accessid_login'] =$a_username;
$_SESSION['access_type']= 'admin';
 if($re_password==''){
header("location:dashboard.php");
}else{
  header("location:otp_request.php");  
}

}
}
}
}
}

$_SESSION['empusername_session_id']=date('dmyHis').rand(1000,9999);
if($_SERVER['REQUEST_METHOD'] == "POST")
{
$button = $_POST['btnSubmit'];
if($button=="Sign in")
{
// Define $myusername and $mypassword
$myusername_login=$_POST['a_username'];
$mypassword_login=$_POST['a_password'];
// To protect mysqli injection (more detail about mysqli injection)
$myusername_login = trim(addslashes($myusername_login));
$mypassword_login = trim(addslashes($mypassword_login));
//$myusername_login = mysqli_real_escape_string($myusername_login);
//$mypassword_login = mysqli_real_escape_string($mypassword_login);
$myusername_login = strtoupper(strtolower($myusername_login));
$sql="SELECT * FROM web_account_setup WHERE (member_id='$myusername_login' OR address_email='$myusername_login') AND del=1";
$result=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql);
if($result)
{
$rows = mysqli_fetch_array($result);
$a_username = $rows['member_id'];
$a_address_email = $rows['address_email'];
$a_password = $rows['password'];
$re_password = $rows['reset_password'];
$user_id=$rows['id'];
$auth_type=$rows['access_type'];
$a_username=strtoupper(strtolower($a_username));
//$auth_type=$rows['authentication_type'];
//$access_type=$rows['access_type'];
}
// mysqli_num_row is counting table row
// If result matched $myusername and $mypassword, table row must be 1 row
$a_password=decrypt($a_password);
$a_password=trim($a_password);
if($a_password!=NULL && $mypassword_login!=NULL && ($a_username!=NULL || $a_address_email!=NULL) && $myusername_login!=NULL)
{
if($a_password==$mypassword_login && (strtolower($a_username)==strtolower($myusername_login) || strtolower($a_address_email)==strtolower($myusername_login)) )
{ 
$results=access_check($user_id,$a_username,$auth_type,$a_username,$a_user_dt,$a_user_ip,$a_user_os);
if($results[0]==1)
{
$_SESSION['empusername_login'] = $a_username;
$_SESSION['empuserid_login'] = trim($user_id);
$_SESSION['empuserauth_login'] = $auth_type;
$_SESSION['accessid_login'] =$a_username;
$_SESSION['access_type'] = 'admin';

    if($re_password==''){
        
if($auth_type=='Global')
{
  header("location:dashboard.php");
}
else {
$sql_menu=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.sub_menu_link FROM basic_admin_menu_tb AS A INNER JOIN admin_menu_category_tb AS B ON A.category_id=B.id INNER JOIN authentication_tb AS C ON A.id=C.menu_id  WHERE A.del=1 AND A.menu_enable=1 AND B.del=1 AND C.del=1 AND C.user_id='$user_id' AND C.authentication=1 ORDER BY B.category_order+0 ASC, A.mian_menu_order+0 ASC LIMIT 0,1");
if(mysqli_num_rows($sql_menu)>0)
{
$row_menu=mysqli_fetch_array($sql_menu);
$menu_link=$row_menu[0];
header("location:".$menu_link);
}
else
header("location:dashboard.php");
}

}else{
 header("location:otp_request.php");
}//reset_password
}
else
{
$wrongusername =$results[1];
}
}
else
{
 $wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> Username or Password.</div>';
 $log_object=array('index','login','Unsuccessful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
}
else
{
 $wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> Username or Password.</div>';
 $log_object=array('index','login','Unsuccessful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
}
else
{
$bs_post_data = print_r($_REQUEST, true);
$bs_post_data =addslashes($bs_post_data);
///////////////Update Log////////////////
$log_object=array('index','View','Successful',$bs_post_data,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
}
else
{
$bs_post_data = print_r($_REQUEST, true);
$bs_post_data =addslashes($bs_post_data);
///////////////Update Log////////////////
$log_object=array('index','View','Successful',$bs_post_data,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
}
else
{
 $wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> Your login has been temporarily disabled due to excessive login failures. Please try again in 5 minutes...</div>';
 $log_object=array('index','View','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
ob_end_flush();


function access_check($user_id,$ig_access_id,$auth_type,$a_username,$a_user_dt,$a_user_ip,$a_user_os)
{
$ig_access_id=1;
$ig_access_allow=1;
$access_success=0;
/*if($ig_access_id)
{
$string = file_get_contents("http://igrapix.org/attendance/igaccess.php?id=$ig_access_id&app=iGA001");
$json=json_decode($string,true);
$ig_access_allow=$json['allow_flag'];
}*/

if($auth_type=='admin' || $auth_type=='Global')
{
$access_success=1;
$log_object=array('index','login','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
else
{
if($ig_access_allow==1)
{

$sql_access_1="SELECT * FROM  access_tb where user_id='$user_id' AND del=1";

$result_access_1=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_access_1);
if(mysqli_num_rows($result_access_1)==1)
{
$row_access=mysqli_fetch_array($result_access_1);
$access_id=$row_access['id'];
$user_id=$row_access['user_id'];
$local_access=$row_access['local_access'];
$random_id=$row_access['random_id'];
$random_id_1=$row_access['random_id_1'];
$random_id_2=$row_access['random_id_2'];
$random_id_3=$row_access['random_id_3'];
$random_id_4=$row_access['random_id_4'];
$date_base=$row_access['date_base'];
$from_date_ref=$row_access['from_date'];
$to_date_ref=$row_access['to_date'];
$day_base=$row_access['day_base'];
$allow_day=$row_access['allow_day'];
$allow_from_time_ref =$row_access['allow_from_time'];
$allow_to_time_ref=$row_access['allow_to_time'];

$allow_flag=0;
if($day_base==0 && $date_base==0)
{
$allow_flag=1;
}
else if($day_base==1)
{
$c_day_ref=date('N');
$allow_day_temp=explode(',',$allow_day);
$allow_from_time =strtotime($allow_from_time_ref);
$allow_to_time=strtotime($allow_to_time_ref);
$allow_current_time=strtotime(date('H:i'));
for($i=0;$i<sizeof($allow_day_temp);$i++)
{
if(($allow_day_temp[$i]==$c_day_ref)&&($allow_current_time>=$allow_from_time)&&($allow_current_time<=$allow_to_time))
{
$allow_flag=1;
break;
}
}
}
else if($date_base==1)
{
$from_date_ref=strtotime($from_date_ref);
$to_date_ref=strtotime($to_date_ref);
$c_date_ref=strtotime($a_user_dt);
if(($from_date_ref<=$c_date_ref)&&($to_date_ref>=$c_date_ref))
{
$allow_flag=1;
}
} 
if($allow_flag==1 && $local_access==0)
{
$access_success=1;
$log_object=array('index','login','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}
else if($allow_flag==1 && $local_access==1)
{

	$login_random_id='login_random_id_'.$user_id;
	$login_user_id='login_user_id_'.$user_id;

	if((isset($_COOKIE[$login_user_id]))&&(isset($_COOKIE[$login_random_id])))
	{
		$random_id_temp = $_COOKIE[$login_random_id];
		$user_id_temp = $_COOKIE[$login_user_id];
	}
	$empty_input=0;
	$user_id_check=md5($user_id);

	if($random_id>=1)
	{
	$random_id_1_check=md5($random_id_1);
	if(($user_id_temp==$user_id_check) && ($random_id_temp==$random_id_1_check))
	{
	$access_success=1;
	}
	if($random_id_1=='')
	{
	$empty_input=1;
	}
	}

	if($random_id>=2 && $access_success==0)
	{
	$random_id_2_check=md5($random_id_2);
	if(($user_id_temp==$user_id_check) && ($random_id_temp==$random_id_2_check))
	{
	$access_success=1;
	}
	if($random_id_2=='' && $empty_input==0)
	{
	$empty_input=2;
	}
	}

	if($random_id>=3 && $access_success==0)
	{
	$random_id_3_check=md5($random_id_3);
	if(($user_id_temp==$user_id_check) && ($random_id_temp==$random_id_3_check))
	{
	$access_success=1;
	}
	if($random_id_3=='' && $empty_input==0)
	{
	$empty_input=3;
	}
	}

	if($random_id>=4 && $access_success==0)
	{
	$random_id_4_check=md5($random_id_4);
	if(($user_id_temp==$user_id_check) && ($random_id_temp==$random_id_4_check))
	{
	$access_success=1;
	}
	if($random_id_4=='' && $empty_input==0)
	{
	$empty_input=4;
	}
	}

	if($empty_input>0)
	{
	$char="abxdefghijklmnopqrstuvwxyz0987654321";
	for($i=0;$i<8;$i++)
	{
	$char_c.=$char[rand(0,35)];
	}
	$random_id=$char_c;
	$inOneYear = 60 * 60 * 24 * 365 + time();

	$random_id_ref=md5($random_id);
	$user_id_ref=md5($user_id);

	setcookie($login_random_id, $random_id_ref, $inOneYear);
	setcookie($login_user_id, $user_id_ref, $inOneYear);

	$random_label='random_id_'.$empty_input.'="'.$random_id.'",';

	$sql_access='UPDATE  access_tb SET
'.$random_label.'
updated_by= "'.$a_username.'",
updated_ip= "'.$a_user_ip.'",
updated_dt = "'.$a_user_dt.'"
where id ="'.$access_id.'"';
$sql_update=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_access);

if($sql_update)
{
$access_success=1;
$log_object=array('index','login','Successful','set cookies and login',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}

	}
	else if($access_success==1)
	{
	$log_object=array('index','login','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
	insert_log($log_object);
	}
	else
	{
$wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> You are not an autherised user...</div>';

	$log_object=array('index','login','Unsuccessful','Unknown device',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
	insert_log($log_object);
	$access_success=0;
	}
	}
	else
	{
	$wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> You are not an autherised user...</div>';
	$log_object=array('index','login','Unsuccessful','Not an autherised at this time',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
	insert_log($log_object);
	}
	}
	else
	{
	$wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> You are not an autherised user...</div>';
	$log_object=array('index','login','Unsuccessful','Not an autherised',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
	insert_log($log_object);
	}
}
else
{
if($json['err_msg'])
$wrongusername =$json['err_msg'];
else
$wrongusername='Please Check your attendance...';

$log_object=array('index','login','Unsuccessful',$wrongusername,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);

$wrongusername ='<div class="alert alert-block alert-danger fade in"> <button data-dismiss="alert" class="close close-sm" type="button"> <i class="icon-remove"></i> </button> <strong>Wrong!</strong> '.$wrongusername.'</div>';

}
}

if($access_success==1)
{
if($keep_sign==1)
{
$inOneYear=60*60*24*365+time();
setcookie("icusername_login", $a_username,$inOneYear, "/","igrapix.org");
}

}
$res[0] =$access_success;
$res[1] =$wrongusername;

return $res;
}






?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
    <title>APDCH-Central Login</title>
    <link rel="stylesheet" href="assets_index/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="assets_index/css/-Login-form-Page-BS4-.css">
    <link rel="stylesheet" href="assets_index/css/styles.css">
</head>

<body>
    <div class="container-fluid">
        <div class="row mh-100vh">
            <div class="col-lg-6 d-flex align-items-end" id="bg-block" style="background: url(&quot;assets_index/img/login_bg.jpg&quot;) center center / cover;">

            </div>
            <div class="col-10 col-sm-8 col-md-6 col-lg-6 offset-1 offset-sm-2 offset-md-3 offset-lg-0 align-self-center d-lg-flex align-items-lg-center align-self-lg-stretch bg-white p-5 rounded rounded-lg-0 my-5 my-lg-0" id="login-block">
                <div class="text-primary m-auto w-lg-75 w-xl-50">
                    <h2  title="Employee Login" class="form-signin-heading"><img src="<?PHP  echo ADMIN_PATH.'/img/global_images/'.ADMIN_IMAGE ?>" width="100%"/>   </h2>
                    <p style="font-size:25px;color:#000">APDCH Central Login</p>
                    <form class="cmxform form-signin"  method="post">
                        <div class="form-group"><label class="text-secondary">Username</label><input type="text" name="a_username" class="form-control"  autofocus autocomplete="off" onkeyup="validateCharNum(this)" maxlength="20"></div>
                        <div class="form-group"><label class="text-secondary">Password</label><input type="password" name="a_password" class="form-control" maxlength="12" ></div>
                         <button class="btn btn-primary mt-2" type="submit" name="btnSubmit" value="Sign in">Log In</button>
                    

                    </form>
                     <?PHP    echo $wrongusername ?>   
                    <p class="mt-3 mb-0" style="display:none;"><a class="text-info small" href="forgot_password">Forgot your password?</a></p>
                </div>
            </div>
        </div>
    </div>
    <script src="assets_index/js/jquery.min.js"></script>
    <script src="assets_index/bootstrap/js/bootstrap.min.js"></script>
    <script>
        /**************** Validation only Alpha-Numeric**********/
function validateCharNum(xxxxx) {
     var maintainplus = '';
    var numval = xxxxx.value
    if ( numval.charAt(0)=='+' ){ var maintainplus = '+';}
    curphonevar = numval.replace(/[\\!"$%^&+*_={};:'@#~,\(\)\-\/<>?|`\]\[]/g,'');
    xxxxx.value = maintainplus + curphonevar;
    var maintainplus = '';
    xxxxx.focus;
}
    </script>
</body>
</html>
