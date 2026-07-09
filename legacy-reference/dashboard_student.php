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

$sql_c_academic='SELECT * FROM basic_setup_tb WHERE del=1 AND id=1';
$result_c_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_c_academic);
$row_c_academic=mysqli_fetch_array($result_c_academic);
$academic_year_array1['U.G']['regular']=$row_c_academic['ug_academic_year'];
$academic_year_array1['U.G']['additional']=$row_c_academic['uga_academic_year'];
$academic_year_array1['P.G']['regular']=$row_c_academic['pg_academic_year']; 



$acd_year=$_POST['acad_year'];

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
     
     <div class="row">
<?PHP echo   $pageloader ?>
	 <aside class="profile-info container col-lg-12 page_container">

                  <div class="col-lg-12">
<div class="row">
             <div class="col-lg-6"></div>
          <div class="col-lg-6">
            <div class="input-group input-group-md">
                <span class="input-group-addon" id="sizing-addon1">U.G(R)</span>
                <select class="form-control" name="ug_regular" id="ug_regular" aria-describedby="sizing-addon1">
                    <?PHP 
                        $year_list=array('2017','2018','2018');
                        $academic_year_array=$academic_year_array1;
                        for($i=substr($academic_year_array1['U.G']['regular'],0,4);$i>=$year_list[0];$i--){
                            $ac_year=($i+1).'-'.($i+2);
                            if($ac_year==$_POST['ug_regular']){
                             $academic_year_array['U.G']['regular']=$ac_year;
                             echo '<option value="'.$ac_year.'" selected>'.$ac_year.'</option>';
                            }
                            else
                            echo '<option value="'.$ac_year.'">'.$ac_year.'</option>';
                        }
                    ?>
                </select>
                <span class="input-group-addon" id="sizing-addon2">U.G(A)</span>
                <select class="form-control" name="ug_additional" id="ug_additional" aria-describedby="sizing-addon2">
                    <?PHP 
                        for($i=substr($academic_year_array1['U.G']['additional'],0,4);$i>=$year_list[1];$i--){
                            $ac_year=($i).'-'.($i+1);
                            if($ac_year==$_POST['ug_additional']){
                             $academic_year_array['U.G']['additional']=$ac_year;
                             echo '<option value="'.$ac_year.'" selected>'.$ac_year.'</option>';
                            }
                            else
                            echo '<option value="'.$ac_year.'">'.$ac_year.'</option>';
                        }
                    ?>
                </select>
                <span class="input-group-addon" id="sizing-addon3">P.G</span>
                <select class="form-control" name="pg_regular" id="pg_regular" aria-describedby="sizing-addon3">
                    <?PHP 
                        for($i=substr($academic_year_array1['P.G']['regular'],0,4);$i>=$year_list[1];$i--){
                            $ac_year=($i).'-'.($i+1);
                            if($ac_year==$_POST['pg_regular']){
                             $academic_year_array['P.G']['regular']=$ac_year;
                             echo '<option value="'.$ac_year.'" selected>'.$ac_year.'</option>';
                            }
                            else
                            echo '<option value="'.$ac_year.'">'.$ac_year.'</option>';
                        }
                    ?>
                </select>
                
              <span class="input-group-btn">
                <button class="btn btn-info" type="submit" >Go</button>
              </span>
            </div><!-- /input-group -->
              <br>
          </div>
         </div>
<?

$dashboard_list=array( 
"ug_attendance" => "U.G Attendance (Reg.)" ,
"ug_attendance_add" => "U.G Attendance (Add.)" ,
"pg_attendance" => "P.G Attendance" ,
"internship_attendance" => "Internship Attendance" ,
"internship_attendance_batch" => "Internship Attendance (Batch)" ,
"internship_leave_absent" => "Internship Leave/Absent" ,
"internship_permission" => "Internship Permission" , 
"pg_attendance_dept" => "P.G Attendance (Dept)" ,
"pg_leave_absent" => "P.G Leave/Absent" ,
"pg_permission" => "P.G Permission" , 
"student_details" => "Student Details (Reg.)" , 
"student_hostel" => "Hostel" ,
"gents_hostel_attendance" => "Gents Hostel Attendance" ,
"ladies_hostel_attendance" => "Ladies Hostel Attendance" ,
"student_ghostel" => "Gents Hostel Att." ,
"student_lhostel" => "Ladies Hostel Att." ,
"student_scholarship" => "Scholarship" ,
"student_add_details" => "Student Details (Add.)" ,
"feedback_analyasis" => "Feedback Analysis");

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
  else if($cat_name=='ug_attendance' || $cat_name=='pg_attendance' || $cat_name=='internship_attendance' || $cat_name=='internship_attendance_batch' || $cat_name=='internship_leave_absent' || $cat_name=='internship_permission' || $w_name=='pg_attendance_dept' || $w_name=='pg_leave_absent' || $w_name=='pg_permission')
    $widget_call_details['student_att'][]=$cat_name;
  else if($cat_name=='staff_attendance' || $cat_name=='staff_attendance_incampus' || $cat_name=='staff_leave_absent')
    $widget_call_details['staff_att'][]=$cat_name;
  else if($cat_name=='student_hostel' || $cat_name=='gents_hostel_attendance' || $cat_name=='ladies_hostel_attendance')
    $widget_call_details['student_hostel'][]=$cat_name;
  else
    $widget_call_details[$cat_name][]=$cat_name;
}
}

$ug_regular=$_POST['ug_regular'];
foreach($widget_call_details as $wcat => $warray)
$widget_url_string.='
$.ajax({
  type: "GET",
  url: "dashboard_more_v5.php?w='.implode(',',$warray).'&ugr='.$ug_regular.'&uga='.$_POST['ug_additional'].'&pgr='.$_POST['pg_regular'].'&d='.$academic_date.'&flag=1",
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


?>




                  </div> </aside></div>
                  </form>
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
 callBRGenrate(1);
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
function callstudent1(course,ayear,cdate,rtype)
{
	var url="dashboard_report.php?course="+course+"&ayear="+ayear+"&cdate="+cdate+"&rtype="+rtype+"&flag=3";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callstaff(cat,cdate)
{
	var url="dashboard_report.php?cat="+cat+"&cdate="+cdate+"&flag=4";
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

function  call_stuattendance( c_id, a_year, cx, c_date, period,abatch)
{
	var url = "dashboard_report.php?c_id="+c_id+"&a_year="+a_year+"&cx="+cx+"&c_date="+c_date+"&period="+period+"&abatch="+abatch+"&flag=7";
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
function callstudentHA(course,ayear,cdate,rcat,rtype)
{
    
    
	var url="dashboard_report.php?course="+course+"&ayear="+ayear+"&cdate="+cdate+"&rtype="+rtype+"&rcat="+rcat+"&flag=16";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callhostelatt(course,cdate,cat,gen)
{
  var url="dashboard_report.php?cat="+cat+"&gen="+gen+"&cdate="+cdate+"&flag=10";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}


function callhostelatt_overall(course,cdate,cat,gen)
{
  var url="dashboard_report.php?cat="+cat+"&gen="+gen+"&cdate="+cdate+"&flag=15";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callinternpermission(cat,cdate,atype)
{
  var url="dashboard_report.php?cat="+cat+"&cdate="+cdate+"&atype="+encodeURIComponent(atype)+"&flag=11";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();
}
function callscourse(cat,cdate,atype)
{
  var url="dashboard_report.php?cat="+cat+"&cdate="+cdate+"&atype="+encodeURIComponent(atype)+"&flag=12";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();  
}
function callfeedbackfill(fid,cdate,atype,cstr)
{
  var url="dashboard_report.php?fid="+fid+"&cdate="+encodeURIComponent(cdate)+"&atype="+atype+"&cstr="+encodeURIComponent(cstr)+"&flag=13";
  var pwin=window.open(url,'Report','scrollbars=1');
  pwin.focus();   
}
function call_pgatt(dept, c_date, c_type)
{
  var url="dashboard_report.php?c_date="+c_date+"&c_type="+encodeURIComponent(c_type)+"&dept="+dept+"&flag=14";
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
