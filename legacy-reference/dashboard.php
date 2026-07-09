<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
error_reporting(E_ALL ^ E_NOTICE);
$a_username=$_SESSION['empusername_login'];
require('widget.php');

$bs_post_data = print_r($_REQUEST, true);
$bs_post_data =addslashes($bs_post_data);
///////////////Update Log////////////////
$log_object=array($url_ref,'View','Successful',$bs_post_data,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
insert_log($log_object);



$cRefresh=$_POST['cRefresh'];
$academic_date=$_POST['attendance_date'];
if($academic_date=='')
$academic_date=date('d-m-Y');
else
$academic_date=date('d-m-Y',strtotime($academic_date));

?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<?PHP  echo $basic_style_details_array['basic'].$basic_style_details_array['date_picker'] ?>
  <style>
  .table td, .table th{ padding:5px 10px 0px 5px !important; border-color:rgba(120, 47, 47, 0.1) !important;}
 .table td p{ margin: 6px 0px 3px !important; }
.att_in_header{ background: #DA0000; color:#FFF; text-align:center;}
.att_in_body{ background: #F80000; color:#FFF; text-align:right; }
.att_out_header{ background: #FCB322; color:#000; text-align:center;}
.att_out_body{ background: #F8D347; color:#000; text-align:right; }
.att_work_header{ background: #EF410A; text-align:right; }
.att_work_body{ background: #EF5829; text-align:right; }
.att_in_header.ar, .att_out_header.ar{ text-align:right;}
.att_in_body.trans{background:rgba(255, 24, 24, 0.9);}
.att_out_body.trans{background: rgba(248,211,71,0.7); }
  </style>

  </head>

  <body>

  <section id="container" class="">
      <!--header start-->
      <?PHP  require('header.php'); ?>
      <!--header end-->
      <!--sidebar start-->
         <?PHP  require('sidebar.php'); ?>
      <!--sidebar end-->
      <!--main content start-->
      <section id="main-content">
      <section class=" wrapper">
      <form class="cmxform form-horizontal tasi-form" id="signupForm" method="post" >
		   <?PHP   echo $breadcrumb_details ?>
     </form>
     <div class="row">
<?PHP echo   $pageloader ?>
	 <aside class="profile-info container col-lg-12 page_container">

                  <div class="col-lg-12">

<?php

$dashboard_list=array(
"staff_attendance" =>"Staff Attendance" ,
"staff_attendance_incampus" => "Staff Attendance (Incampus)" ,
"staff_leave_absent" => "Staff Leave/Absent" ,
"staff_permission" => "Staff Permission" ,
"staff_details" => "Staff Details" ,
"staff_current" => "Staff Current" );

$academic_date=strtotime($academic_date);


$sql_check='SELECT * FROM  web_account_setup WHERE member_id="'.$a_username.'"  AND del=1';
$result_check=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_check);
$row_check=mysqli_fetch_array($result_check);
$a_username_id=$row_check['id'];

$widget_call_details=array();
$widget_url_string='';
$widget_content_string='';
$sql_select="SELECT * FROM dashboard_access WHERE del=1 AND status=1 AND user_id='$a_username_id' ORDER BY widget_order ASC";
$result_select=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_select);
while(($row_select=mysqli_fetch_array($result_select))!=false)
{
  $cat_name=$row_select['widget_name'];
if($dashboard_list[$cat_name]){
  $widget_content_string.='<div id="'.$cat_name.'" class="widget_container"><div class="col-sm-4 dashboard-container" style="opacity: 0.2;">
    <section class="panel">
    <div class="revenue-head">
        <span>

        </span>
        <h3>'.$dashboard_list[$cat_name].'</h3>
    </div>
    <div class="dashboard-panel no-padding text-center">
     </div>
    </section>
  </div></div>';

  if($cat_name=='student_details' || $cat_name=='student_scholarship' || $cat_name=='student_firstgraduate')
    $widget_call_details['student'][]=$cat_name;
  else if($cat_name=='student_attendance' || $cat_name=='internship_attendance' || $cat_name=='internship_attendance_batch' || $cat_name=='internship_leave_absent' || $cat_name=='internship_permission')
    $widget_call_details['student_att'][]=$cat_name;
  else if($cat_name=='staff_attendance' || $cat_name=='staff_attendance_incampus' || $cat_name=='staff_leave_absent')
    $widget_call_details['staff_att'][]=$cat_name;
  else if($cat_name=='student_hostel' || $cat_name=='gents_hostel_attendance' || $cat_name=='ladies_hostel_attendance')
    $widget_call_details['student_hostel'][]=$cat_name;
  else
    $widget_call_details[$cat_name][]=$cat_name;
}
}

foreach($widget_call_details as $wcat => $warray)
$widget_url_string.='
$.ajax({
  type: "GET",
  url: "dashboard_more.php?w='.implode(',',$warray).'&d='.$academic_date.'&cRefresh='.$cRefresh.'&flag=1",
  cache:true,
  success:function(responseText)
  {
  var obj = JSON.parse(responseText);
  var len=obj[0];
  for(var i=0;i<len;i++)
  {
    var w_id=obj[1][i];
    var w_content=obj[2][i];
    if(w_id)
    $("#"+w_id).hide().html(w_content).fadeIn("slow");
  }
  },

    beforeSend: function(jqXHR) {
        $.xhrPool.push(jqXHR);
    },
    complete: function(jqXHR) {
        var index = $.xhrPool.indexOf(jqXHR);
        if (index > -1) {
            $.xhrPool.splice(index, 1);
        }
    }
})';



if($widget_content_string)
{

echo '<section class="panel" id="loading_message">

<div class="panel-body">
 Dashboard Loading start from <span id="dload">10</span> sec...
 &nbsp; &nbsp; <a href="#" class="btn btn-primary" onclick="callSkip()"> Skip </a>



</div>
</section>';
echo $widget_content_string;
}

$current_date=date('Y-m-d');

  $sql_desig=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.dept_staff FROM  dept_authentication AS A INNER JOIN web_account_setup AS B ON A.user_id=B.id WHERE A.del=1 AND B.del=1 AND B.member_id="'.$a_username.'" '));
  $sql_staff_list=explode(',', $sql_desig[0]);
  $staff_id_search_str='';
  foreach($sql_staff_list as $a_sid)
  {
    $a_sid=trim($a_sid);
    if($a_sid){
      $staff_id_search_str.=' A.id="'.$a_sid.'" OR';
    }
  }
  if($staff_id_search_str)
    $staff_id_search_str=' AND ('.substr($staff_id_search_str,0,-2).') ';

// Get the current date
$currentDate = new DateTime();

// Create an array to store the last 6 months' dates
$lastSixMonths = array();

// Loop through the last 6 months and add to the array
for ($i = 1; $i <= 6; $i++) {
    $from_date=$currentDate->format('Y-m-01');
    $lastSixMonths[$from_date] = $currentDate->format('Y-m-31');
    $currentDate->modify('-1 month');
}

$final_info_temp='<tr class="td_head_color">
      <th width="190" rowspan="2" style="background-color:white"><p class="staff_period">Month</p></th>
      <th colspan="3" style="background-color:#F0F8FF"><p class="staff_period">Overall</p></th>';
      
$nj_re_t_col='';

$staff_cat_arr=array();

$cat_sel=mysqli_query($GLOBALS["__CIS_MYSQLI"],"SELECT A.id,B.category_name,B.category_sname FROM staff_profile_tb AS A INNER JOIN edu_setup_tb AS B ON A.job_category = B.id WHERE A.del=1 AND B.del=1 AND B.category='Category' $staff_id_search_str GROUP BY B.id ORDER BY B.category_order ASC");
$colors_array = array(
    '#FAEBD7',
    '#FFE4C4',
    '#F5F5DC',
    '#F0FFF0',
    '#D8F8E8',
    '#F0E68C',
    '#FFEFD5',
    '#FFF5EE',
    '#F5F5F5'
);

$j=0;
while(($cat_res=mysqli_fetch_array($cat_sel))!=false)
{
    $cat_name=$cat_res[1];
    $cat_sname=$cat_res[2];
    $staff_cat_arr[]=$cat_name;
    
    $bg_color=$colors_array[$j];
    
    $final_info_temp.='<th align="right" width="100" colspan="3" style="background-color:'.$bg_color.'"><p class="staff_period">'.$cat_sname.'</p></th>';
    $nj_re_t_col.='<th align="right" width="100" style="background-color:'.$bg_color.'"><p class="staff_period">#T</p></th><th align="right" width="100" style="background-color:'.$bg_color.'"><p class="staff_period">#NJ</p></th><th align="right" width="100" style="background-color:'.$bg_color.'"><p class="staff_period">#RE</p></th>';
    $j++;
}
 
$final_info_temp.='</tr><tr><th align="right" width="100" style="background-color:#F0F8FF"><p class="staff_period">#T</p></th><th align="right" width="100" style="background-color:#F0F8FF"><p class="staff_period">#NJ</p></th><th align="right" width="100" style="background-color:#F0F8FF"><p class="staff_period">#RE</p></th>'.$nj_re_t_col.'</tr>';

$last_6months_data='';
$i=0;

foreach($lastSixMonths as $payroll_month_start=>$payroll_month_ending)
{
    $i++;
    
    if($current_date>=$payroll_month_start && $current_date>=$payroll_month_ending && $i==1)
    {
        $payroll_month_ending=$current_date;
    }
    $final_info_temp.='<tr class="td_bottom_border"><th>'.strtoupper(substr(date('F', strtotime($payroll_month_start)),0,3)).'</th>';
         
    $tot_staff_tot_count=$tot_staff_nj_count=$tot_staff_re_count=0;
    
    $j=0;
    
    $final_info_temp1='';
    foreach($staff_cat_arr as $staff_cat)
    {
        $bg_color=$colors_array[$j];
        
        $sql_staff=mysqli_query($GLOBALS["__CIS_MYSQLI"],"SELECT A.id FROM staff_profile_tb AS A INNER JOIN edu_setup_tb AS B ON A.job_category = B.id WHERE A.del=1 AND B.del=1 AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$payroll_month_ending') AND B.category='Category' $staff_id_search_str AND B.category_name='$staff_cat'");
    
        $staff_tot_count=mysqli_num_rows($sql_staff);
        $tot_staff_tot_count+=$staff_tot_count;
        
        $staff_nj_count=mysqli_num_rows(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.id FROM staff_profile_tb AS A INNER JOIN edu_setup_tb AS B ON A.job_category = B.id WHERE A.del=1 AND B.del=1 AND A.joined_date>='$payroll_month_start' AND A.joined_date<='$payroll_month_ending' AND A.joined_date!='0000-00-00' AND B.category='Category' $staff_id_search_str AND B.category_name='$staff_cat'"));
        
        $tot_staff_nj_count+=$staff_nj_count;
        
        $staff_re_count=mysqli_num_rows(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.id FROM staff_profile_tb AS A INNER JOIN edu_setup_tb AS B ON A.job_category = B.id WHERE A.del=1 AND B.del=1 AND A.releaving_date>='$payroll_month_start' AND A.releaving_date<='$payroll_month_ending' AND A.releaving_date!='0000-00-00' AND B.category='Category' $staff_id_search_str AND B.category_name='$staff_cat'"));
        
        $tot_staff_re_count+=$staff_re_count;
        
        $final_info_temp1.='<td style="background-color:'.$bg_color.'"><p class="class_name" style="padding-left:10px;">'.$staff_tot_count.'</p></td><td style="text-align:right; padding-right:15px;background-color:'.$bg_color.'"><p class="class_name cinfo">'.$staff_nj_count.'</p></td><td style="text-align:right; padding-right:15px;background-color:'.$bg_color.'"><p class="class_name cinfo">'.$staff_re_count.'</p></td>';
      
        $j++;
    }
    
    $final_info_temp.='<td style="background-color:#F0F8FF"><p class="class_name" style="padding-left:10px;">'.$tot_staff_tot_count.'</p></td><td style="text-align:right; padding-right:15px;background-color:#F0F8FF"><p class="class_name cinfo">'.$tot_staff_nj_count.'</p></td><td style="text-align:right; padding-right:15px;background-color:#F0F8FF"><p class="class_name cinfo">'.$tot_staff_re_count.'</p></td>'.$final_info_temp1.'</tr>';
}

$final_course_details='
<div class="col-sm-12 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-users"></i>
      </span>
      <h3>New Joined &amp; Resigned Staff Details</h3>
  </div>
  <div class="dashboard-panel" style="height:auto">
    <table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
      '.$final_info_temp.'
    </table>
    <p><strong>Note : </strong> T -Total, NJ -New Joined, RE - Resigned Employees</p>
  </div>
  </section>
</div>';

?>

                  </div>
                  
                  </aside>
                  
                  </div>
                  <div class="row container" style="margin:0px auto">
                      <?php  echo $final_course_details;?>
                  </div>
          </section>
      </section>
      <!--main content end-->
  </section>
<input type="hidden" id="setSkip" value="0" />
  <?PHP   echo $basic_js_details_array['basic'] . $basic_js_details_array['color_picker'] . $basic_js_details_array['date_picker']; ?>
 <script>
 $(document).ready(function(){

$.xhrPool = [];
$( "#signupForm .navbar a" ).on( "click", function() {
$.xhrPool.abortAll = function() {
    $(this).each(function(idx, jqXHR) {
        jqXHR.abort();
    });
    $.xhrPool = [];
return false;
}
});


 $( "#attendance_date" ).datepicker({ format: "dd-mm-yyyy",	weekStart: 1,  autoclose: 1, todayHighlight: 0, startView: 0, endDate:"<?PHP echo date('d-m-Y'); ?>"   });
 callBRGenrate(2);
});
function callreport()
{
     if($("#setSkip").val()==0)
     {
        <?PHP echo $widget_url_string ?>
     }
}
function callBRGenrate(id)
{
     $("#dload").html(id);
     id--;
     if($("#setSkip").val()==0)
     {
     if(id==0)
     {
     $("#loading_message").css('display','none');
     $(".widget_container").css('display','block');
     callreport()
     }
     else {
          $("#loading_message").css('display','block');
          $(".widget_container").css('display','none');
          setTimeout("callBRGenrate("+id+")", 999);
     }
     }

}

function callSkip()
{
     $("#setSkip").val(1);
     $("#loading_message").css('display','none');
     $(".widget_container").css('display','none');
}
function callattendance(course,ayear,cdate,rtype)
{
	var url="dashboard_report.php?course="+course+"&ayear="+ayear+"&cdate="+cdate+"&rtype="+rtype+"&flag=1";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callstudent(course,ayear,cdate,rtype,rcat)
{
	var url="dashboard_report.php?course="+course+"&ayear="+ayear+"&cdate="+cdate+"&rtype="+rtype+"&rcat="+rcat+"&flag=2";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callstudent1(course,ayear,cdate,rtype,ropt,tcat)
{
	var url="dashboard_report.php?course="+course+"&ayear="+ayear+"&cdate="+cdate+"&rtype="+rtype+"&ropt="+ropt+"&tcat="+tcat+"&flag=3";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callstaff(cat,cdate)
{
	var url="dashboard_report_v1.php?cat="+cat+"&cdate="+cdate+"&flag=4";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callstaffatt(cat,cdate,atype)
{
	var url="dashboard_report.php?cat="+cat+"&cdate="+cdate+"&atype="+atype+"&flag=5";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callstaffpermission(cat,cdate,atype)
{
	var url="dashboard_report.php?cat="+cat+"&cdate="+cdate+"&atype="+encodeURIComponent(atype)+"&flag=6";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}

function  call_stuattendance( c_id, a_year, cx, c_date, period)
{
	var url = "dashboard_report.php?c_id="+c_id+"&a_year="+a_year+"&cx="+cx+"&c_date="+c_date+"&period="+period+"&flag=7";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}

function  call_internatt(dept, c_date, c_type)
{
  var url = "dashboard_report.php?c_date="+c_date+"&c_type="+encodeURIComponent(c_type)+"&dept="+dept+"&flag=8";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}

function callstudentH(course,ayear,cdate,rtype,rcat)
{
	var url="dashboard_report.php?course="+course+"&ayear="+ayear+"&cdate="+cdate+"&rtype="+rtype+"&rcat="+rcat+"&flag=9";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}

function callhostelatt(course,cdate,cat,gen)
{
	var url="dashboard_report.php?cat="+cat+"&gen="+gen+"&cdate="+cdate+"&flag=10";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callinternpermission(cat,cdate,atype)
{
	var url="dashboard_report.php?cat="+cat+"&cdate="+cdate+"&atype="+encodeURIComponent(atype)+"&flag=11";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callStaffCurrent()
{
  var attendance_date=document.getElementById('attendance_date').value;
  var attendance_time=document.getElementById('attendance_time').value;
  if(attendance_time && attendance_date)
  {
  $.ajax({
    type: "GET",
    url: "dashboard_more.php?w=staff_current&d="+encodeURIComponent(attendance_date)+"&t="+encodeURIComponent(attendance_time)+"&c=1&flag=1",
    cache:true,
    success:function(responseText)
    {
    var obj = JSON.parse(responseText);
    var len=obj[0];
    for(var i=0;i<len;i++)
    {
      var w_id=obj[1][i];
      var w_content=obj[2][i];
      if(w_id)
      $("#"+w_id).hide().html(w_content).fadeIn("slow");
    }
    },

      beforeSend: function(jqXHR) {
          $.xhrPool.push(jqXHR);
      },
      complete: function(jqXHR) {
          var index = $.xhrPool.indexOf(jqXHR);
          if (index > -1) {
              $.xhrPool.splice(index, 1);
          }
      }
  });
  }

}

</script>
  </body>
</html>