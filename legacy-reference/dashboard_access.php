<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
$a_username=$_SESSION['empusername_login'];
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
include('widget.php');

if($_SERVER['REQUEST_METHOD']=='POST')
{
  $form_reset=$_POST['form_reset'];
  if($_SESSION['check_form_submit']!=$form_reset)
  {
  $_SESSION['check_form_submit']=$form_reset;
  if($_POST['Submit']=='Update')
  {

    $user_id=$_POST['a_id'];
    $enable_disable=$_POST['enable_disable'];
    $box_order=$_POST['box_order'];
    $dashboard_list=$_POST['dashboard_list'];
    $row_id=$_POST['row_id'];

    if($user_id){
    $sql_query=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'UPDATE dashboard_access SET
    del= "0",
    updated_by= "'.$a_username.'",
    updated_ip= "'.$a_user_ip.'",
    updated_dt = "'.$a_user_dt.'"
    where user_id= "'.$user_id.'" AND del ="1"');
    $option_details='';
    for($i=0;$i<sizeof($dashboard_list);$i++)
    {
      $dashboard_list[$i]=addslashes($dashboard_list[$i]);
      $box_order[$i]=addslashes($box_order[$i]);
      $enable_disable[$i]=addslashes($enable_disable[$i]);

    if($row_id[$i]=='' && $enable_disable[$i])
    {
    $sql_query="INSERT INTO dashboard_access (  user_id, widget_name, widget_order, status, created_dt, created_ip, created_by) VALUES ( '$user_id', '$dashboard_list[$i]', '$box_order[$i]', '$enable_disable[$i]', '$a_user_dt', '$a_user_ip', '$a_username')";
    $result=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_query);
    }
    else if($row_id[$i])
    {
    $sql_query='UPDATE dashboard_access SET
    widget_name= "'.$dashboard_list[$i].'",
    widget_order= "'.$box_order[$i].'",
    status= "'.$enable_disable[$i].'",
    del= "1",
    updated_by= "'.$a_username.'",
    updated_ip= "'.$a_user_ip.'",
    updated_dt = "'.$a_user_dt.'"
    where id ="'.$row_id[$i].'" AND  user_id= "'.$user_id.'"';
    $result=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_query);
    }

    }
  }
  if($result)
  {
   ////////////Update Log///////////////
  $log_object=array($url_ref,'Update','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
  insert_log($log_object);
  $report='<div class="alert alert-success fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Success!</strong> Your details are Updated...</div>';
  }
  }


}
}
else
{
$bs_post_data = print_r($_REQUEST, true);
$bs_post_data =addslashes($bs_post_data);
///////////////Update Log////////////////
$log_object=array($url_ref,'View','Successful',$bs_post_data,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);
}



?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<?PHP   echo $basic_style_details_array['basic']; ?>

  </head>

  <body>

  <section id="container" >

      <!--header start-->
      <?PHP   require('header.php'); ?>
      <!--header end-->
      <!--sidebar start-->
         <?PHP   require('sidebar.php'); ?>
      <!--sidebar end-->
      <!--main content start-->
      <section id="main-content">
          <section class=" wrapper">
		  <?PHP   echo $breadcrumb_details ?>
              <div class="row">
				<?PHP 
			  if($bs_sidebar_details !='')
			  echo $bs_sidebar_details.$pageloader.'<aside class="profile-info col-lg-9 page_container">';
			  else
			  echo $pageloader.'<aside class="profile-info col-lg-12 page_container">';
			   ?>
         <div id="top_notification"><div class="top_notification_message"><?PHP echo $report; ?></div></div>

                  <div class="col-lg-12"><section class="panel">
                       <div class="panel-body">

						  <div class="form">
                                  <form class="cmxform form-horizontal tasi-form" enctype="multipart/form-data" id="signupForm" method="post" >



          <div class="form-group ">
              <label for="a_id" class="control-label col-sm-3">Select User <span class="text-danger" >*</span></label>
              <div class="col-sm-3">
                <select name="a_id"  id="a_id" class="form-control" onchange="this.form.submit()">
                <option value="">--Select One--</option>
                <?
                $sql_check='SELECT access_type FROM  web_account_setup WHERE member_id="'.$a_username.'"  AND del=1';
                $result_check=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_check);
                $row_check=mysqli_fetch_array($result_check);
                $hd_account=$row_check['access_type'];
                
                $user_id=$_POST['a_id'];
				if($user_id=='')$user_id=$_REQUEST['uid'];
				
				$f_user_list=array(); 
                $sql_query=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT GROUP_CONCAT( DISTINCT(user_id) SEPARATOR ',')  FROM dashboard_access WHERE  del=1"));
                $f_user_list=explode(',',$sql_query[0]);

                
                if(strtolower($hd_account)=='global')
                $sql_academic='SELECT * FROM web_account_setup WHERE del=1  ORDER BY member_id ASC';
                else
              	  $sql_academic='SELECT * FROM web_account_setup WHERE del=1 AND access_type!="global"  ORDER BY member_id ASC';
              	  $result_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_academic);
              	  while(($row_academic=mysqli_fetch_array($result_academic))!=false)
              	  {
              	    $a_id=$row_academic['id'];
              	    $a_user_id=$row_academic['member_id'];
               	    $a_user=$row_academic['member_name'];
               	    $f_status='';
                    if(in_array($a_id,$f_user_list)==true)
                    $f_status=' *';
                            
                   if($a_id==$user_id)
              	  echo  '<option value="'.$a_id.'" selected>'.$a_user_id.' - '.$a_user.$f_status.'</option>';
                  else
                 echo  '<option value="'.$a_id.'">'.$a_user_id.' - '.$a_user.$f_status.'</option>';
              	  }
              	?>
              </select>
              </div>
          </div>


    <?
    
    if($user_id)
    {

    ?>
    <div class="form-group ">
    <div class="col-sm-10">
<?

$dashboard_list=array(
"staff_attendance" =>"Staff Attendance" ,
"staff_attendance_incampus" => "Staff Attendance (Incampus)" ,
"staff_leave_absent" => "Staff Leave/Absent" ,
"staff_permission" => "Staff Permission" ,
"ug_attendance" => "U.G Attendance (Reg.)" ,
"ug_attendance_add" => "U.G Attendance (Add.)" ,
"pg_attendance" => "P.G Attendance" ,
"pg_attendance_dept" => "P.G Attendance (Dept)" ,
"pg_leave_absent" => "P.G Leave/Absent" ,
"pg_permission" => "P.G Permission" , 
"internship_attendance" => "Internship Attendance" ,
"internship_attendance_batch" => "Internship Attendance (Batch)" ,
"internship_leave_absent" => "Internship Leave/Absent" ,
"internship_permission" => "Internship Permission" ,
"staff_details" => "Staff Details" ,
"staff_unit" => "Faculty Structure" ,
"staff_unit_1" => "Faculty - Unit I" ,
"staff_unit_2" => "Faculty - Unit II" ,
"student_details" => "Student Details (Reg.)" ,
"student_add_details" => "Student Details (Add.)" ,
"staff_current" => "Staff Current" ,
"student_hostel" => "Hostel" ,
"gents_hostel_attendance" => "Gents Hostel Attendance" ,
"ladies_hostel_attendance" => "Ladies Hostel Attendance" ,
"student_scholarship" => "Scholarship" ,
"feedback_analyasis" => "Feedback Analysis",
"student_ghostel" => "Gents Hostel Att." ,
"student_lhostel" => "Ladies Hostel Att." );



     $authentication_list_details='<table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered" id="mySampleTable">
     <tr  bgcolor="#CCCCCC">
      <td height="30" colspan="4" >
       <input name="row_id" name="row_id" class="input" type="hidden"  value="'.$row_id.'">
       <input type="checkbox" name="check_all" id="check_all" value="1" onclick="call_check_all()"> Check All
      <input type="checkbox" name="fill_all" id="fill_all" value="1" onclick="call_fill_all()"> Fill Default
       </td></tr>';
       $i=0;
       $filled_list=array();
       $sql_select="SELECT * FROM dashboard_access WHERE del=1 and user_id='$user_id' ORDER BY widget_order ASC";
       $result_select=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_select);
       while(($row_select=mysqli_fetch_array($result_select))!=false)
       {
         $wid=$row_select['id'];
         $wname=$row_select['widget_name'];
         $worder=$row_select['widget_order'];
         $wstatus=$row_select['status'];

         $filled_list[]=$wname;

         if($dashboard_list[$wname])
         {
         if($wstatus==1)
         {
         $authentication_list_details.='<td nowrap="nowrap">
         <table border="0" cellspacing="0" cellpadding="0"><tr><td  style="border:none;">
         <input type="checkbox" name="enable_disable['.$i.']" id="enable_disable['.$i.']" value="1" checked="checked"></td><td  style="border:none;">
         <input name="box_order['.$i.']" id="box_order['.$i.']"  class="form-control" type="text" size="3" style="width:50px;" value="'.$worder.'">
         <input name="dashboard_list['.$i.']" id="dashboard_list['.$i.']" class="input" type="hidden"  value="'.$wname.'"><input name="row_id['.$i.']" id="row_id['.$i.']" type="hidden"  value="'.$wid.'"> </td><td  style="border:none;">'.$dashboard_list[$wname].'</td></tr></table> </td>';

         }
         else
         {
           $authentication_list_details.='<td nowrap="nowrap">
           <table border="0" cellspacing="0" cellpadding="0"><tr><td  style="border:none;">
           <input type="checkbox" name="enable_disable['.$i.']" id="enable_disable['.$i.']" value="1" ></td><td  style="border:none;">
           <input name="box_order['.$i.']" id="box_order['.$i.']"  class="form-control" type="text" size="3" style="width:50px;" value="'.$worder.'" >
           <input name="dashboard_list['.$i.']" id="dashboard_list['.$i.']" class="input" type="hidden"  value="'.$wname.'"><input name="row_id['.$i.']" id="row_id['.$i.']" type="hidden" value="'.$wid.'"> </td><td  style="border:none;">'.$dashboard_list[$wname].'</td></tr></table> </td>';

         }
         if($i%4==3)
         {
         $authentication_list_details.='</tr><tr>';
         }
         $i++;
         }


       }

       foreach($dashboard_list as $list_name => $list_label)
       {
       if(in_array($list_name,$filled_list)==false){
       $authentication_list_details.='<td nowrap="nowrap">
       <table border="0" cellspacing="0" cellpadding="0" style="border:none;"><tr><td  style="border:none;">
       <input type="checkbox" name="enable_disable['.$i.']" id="enable_disable['.$i.']" value="1" > </td><td  style="border:none;"> <input name="box_order['.$i.']" id="box_order['.$i.']"  class="form-control" type="text" size="3" style="width:50px;" > <input name="dashboard_list['.$i.']" name="dashboard_list['.$i.']" type="hidden"  value="'.$list_name.'"> </td><td  style="border:none;"><input name="row_id['.$i.']" id="row_id['.$i.']" type="hidden" >'.$list_label.'</td></tr></table>  </td>';
       if($i%4==3)
       $authentication_list_details.='</tr><tr>';
       $i++;
       }
       }
     $authentication_list_details.='</table>
     <input type="hidden" id="tcount" value="'.$i.'" />';



    echo $authentication_list_details;
?>

                                          </div>
                                      </div>


								   <div class="form-group"  id="f_status">
                                          <div class="col-sm-offset-2 col-sm-10">
                                              <button class="btn btn-danger" name="Submit" type="submit" value="Update">Save</button>
											  <input type="hidden" name="form_reset" value="<?PHP echo date('His').rand(0000,1111);?>" />
                                          </div>
                                      </div>
<?PHP } ?>
                                  </form>
                              </div>
						  <?PHP   echo $report ?>
						   </div>
                      </section></div>    </aside>
			 </div>
		 </section>
      </section>
      <!--main content end-->
  </section>
<span id="update_script">  </span>



   <?PHP   echo $basic_js_details_array['basic']; ?>
<script>
function call_check_all()
{

if(document.getElementById('check_all').checked==true)
var checks=true;
else
var checks=false;
var chks = document.getElementById('tcount').value;
var labels='';
for(var i=0;i<chks;i++)
{
labels='enable_disable['+i+']';
document.getElementById(labels).checked=checks;
}


}

function call_fill_all()
{

var chks = document.getElementById('tcount').value;
if(document.getElementById('fill_all').checked==true)
{
for(var i=0;i<chks;i++)
{
document.getElementById('box_order['+i+']').value=i+1;
}
}
else
{
for(var i=0;i<chks;i++)
{
document.getElementById('box_order['+i+']').value='';
}
}
}
</script>
  </body>
</html>
