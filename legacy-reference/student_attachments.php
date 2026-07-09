<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
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
    $s_id=$_POST['student_id'];
    $att_id=$_POST['att_id'];
    $a_id=$_POST['a_id'];
    $attached_file=$_POST['attached_file'];
	$attached_no=$_POST['attached_no'];
    $s_id=addslashes($s_id);
    for($i=0;$i<sizeof($a_id);$i++)
    {
      $f_a_id=addslashes($a_id[$i]);
      $f_att_id=addslashes($att_id[$i]);
      $f_attached_file=addslashes($attached_file[$i]);
      $f_attached_no=addslashes($attached_no[$i]);
      if($f_a_id && ($f_attached_file || $attached_no) && $f_att_id=='')
      {
        $result=mysqli_query($GLOBALS["__CIS_MYSQLI"], "INSERT INTO student_attachment_tb(s_id, attach_id, attach_no, attach_file,  created_dt, created_ip, created_by)values('$s_id', '$f_a_id', '$f_attached_no', '$f_attached_file', '$a_user_dt', '$a_user_ip', '$a_username')");
      }
      else if($f_att_id) {
        $result=mysqli_query($GLOBALS["__CIS_MYSQLI"], "UPDATE student_attachment_tb SET
		attach_no='$f_attached_no',
        attach_file='$f_attached_file',
        del=1,
        updated_dt='$a_user_dt',
        updated_ip='$a_user_ip',
        updated_by='$a_username'
        where
        id='$f_att_id' ");
      }
    }

    if($result)
    {
    ////////////Update Log///////////////
    $log_object=array($url_ref,'Update','Successful',$s_id,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
    insert_log($log_object);
    $report='<div class="alert alert-success fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Success!</strong> Your details are updated...</div>';


    }
    else
    {
     ////////////Update Log///////////////
    $log_object=array($url_ref,'Update','Unsuccessful',$s_id,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
    insert_log($log_object);
    $report='<div class="alert alert-danger fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Oops!</strong> Please Try later...</div>';

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

$sql_c_academic='SELECT * FROM basic_setup_tb WHERE del=1 AND del=1';
$result_c_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_c_academic);
$row_c_academic=mysqli_fetch_array($result_c_academic);
$academic_year_array['U.G']=$row_c_academic['ug_academic_year'];
$academic_year_array['P.G']=$row_c_academic['pg_academic_year'];
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
    <form class="cmxform form-horizontal tasi-form" enctype="multipart/form-data" id="signupForm" method="post" >
    <div class="col-sm-3">
      <?
        $search_by_ref=$_POST['search_by'];
        $c1=$c2='';
        if($search_by_ref=='batch')
        $c2='checked';
        else
        $c1='checked';
      ?>
      <section class="panel">
      <header class="panel-heading">
      Filter
      </header>
      <div class="col-sm-12">
      <div class="form">
      <div class="form-group ">
      <label  class="control-label col-sm-12">
      Search By
      </label>
      <div class="col-sm-12">
        <label>    <input name="search_by" type="radio" value="roll_no" <?PHP echo $c1 ?> onclick="callSearchOption()"/>
           Roll No</label>
        <label>  <input name="search_by" type="radio" value="batch" <?PHP echo $c2 ?> onclick="callSearchOption()"/>
            Batch </label>
      </div>
      </div>
      <div class="form-group ">
      <?
      $hide_1=$hide_2=' style="display:none;" ';
      if($search_by_ref=='batch')
      $hide_2='';
      else
      $hide_1='';

          $final_result_details='<div  id="rollno_search" '.$hide_1.'> <div class="col-xs-10"><input name="search_input" type="text" class="form-control" id="search_input" placeholder="Roll No. seperated by ," value="'.$_POST['search_input'].'"/></div>      <div class="col-xs-2"><input name="Submit" type="button" class="btn btn-info btn-sm pull-right" value="Go" onclick="callstudentDetails()"  /></div></div>';

          $final_result_details.='<div class="col-sm-12" id="batch_search" '.$hide_2.'> <select name="search_course" id="search_course" class="form-control" onchange="callstudentDetails()">
          <option value="">--Select--</option>';
          $sql_section='SELECT * FROM basic_setup_course_tb WHERE  del=1  ORDER BY c_order ASC';
          $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
          while(($row_section=mysqli_fetch_array($result_section))!=false)
          {
          $c_id=$row_section['id'];
          $ref_course_name=$row_section['course_name'];
          $full_part_time=$row_section['full_part_time'];
          $degree_name=$row_section['degree_name'];
          $degree_short_name=$row_section['degree_short_name'];
          $department_name=$row_section['department_name'];
          $department_short_name=$row_section['department_short_name'];
          $year_of_start=$row_section['year_of_start'];
          $course_duration=$row_section['course_duration'];
          if($full_part_time=='Full Time')
          $full_part_time='FT';
          else
          $full_part_time='PT';
          $degree_name=stripslashes($degree_name);
          $course_duration=stripslashes($course_duration);
          $department_name=stripslashes($department_name);
          $full_part_time=stripslashes($full_part_time);
          if(trim($department_name)!='' && trim($department_name)!='-')
          $department_name=' - '.$department_name;
          else
          $department_name='';
          $a_year_temp1=explode('-',$academic_year_array[$ref_course_name]);
          $a_year_1=$a_year_temp1[0];
          $final_result_details.='<optgroup label="'.$ref_course_name.' | '.$degree_name.$r_section_name.$department_name.' | '.$full_part_time.'">';
          for($i=$a_year_1;$i>=$year_of_start;$i--)
          {
          $ac_year=$i.'-'.($i+1);
          if($_POST['search_course']==$c_id.'___'.$ac_year)
          $final_result_details.='<option value="'.$c_id.'___'.$ac_year.'" selected>'.$degree_name.$department_name.' |  '.$ac_year.' </option>';
          else
          $final_result_details.='<option value="'.$c_id.'___'.$ac_year.'">'.$degree_name.$department_name.' |  '.$ac_year.' </option>';
          }
          $final_result_details.='</optgroup>';
          }
          $final_result_details.='</select></div>';



          echo $final_result_details;


      ?>
      </div>
      <div class="form-group" id="sResult_pane">
      <?
      $final_search_result=array();
        if($_SERVER['REQUEST_METHOD']=='POST')
        {
          $search_opt=0;
          $student_id=$_POST['student_id'];
          if($search_by_ref=='batch')
          {
            $search_string=$_POST['search_course'];
            $search_opt=2;
          }
          else
          {
            $search_string=$_POST['search_input'];
            $search_opt=1;
          }
          if($search_string && $search_opt)
          {
            include_once("student_attachments_more.php");
            $temp_result=searchByRollNo($search_string, $search_opt,  $student_id);
            $final_search_result=explode('^^^^^',$temp_result);
          }
          echo $final_search_result[0];
        }
      ?>
      </div>

      </div>
      </div>
      </section>
    </div>
      <div class="col-sm-9" id="form_details_pane">
    <?PHP   if($final_search_result[1])echo $final_search_result[1];
    echo $report; ?>
      </div>
    </form>
  </aside>
  </div>
  </section>
  </section>
  <!--main content end-->
  </section>
  <span id="update_script">  </span>
   <?PHP   echo $basic_js_details_array['basic']; ?>

   <script src="student_attachments.js" type="text/javascript"></script>
   <?PHP if($final_search_result[1]) echo '<script>$(document).ready(function() { add_listner() });</script>'; ?>
  </body>
</html>
