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
  $roll_no=$_POST['roll_no'];
  $s_id=$_POST['student_id'];
  $roll_no=addslashes($roll_no);
  $s_id=addslashes($s_id);
  if($roll_no  && $s_id)
  {
  $sql_validate="SELECT * FROM student_profile_tb WHERE del=1 AND register_no='$roll_no' AND id!='$s_id'  ORDER BY created_dt DESC";
  $result_validate=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_validate);
  if(mysqli_num_rows($result_validate)==0)
  {
    $joined_date=$_POST['joined_date'];
    $admission_no=$_POST['admission_no'];
    $student_name=$_POST['student_name'];
    $student_initial=$_POST['student_initial'];
    $a_year=$_POST['a_year'];
    $admission_source=$_POST['admission_source'];
    $course_name=$_POST['course_name'];
    $degree_name=$_POST['degree_name'];
    $register_no=$_POST['register_no'];
    $bregister_no=$_POST['bregister_no'];
    $roll_no=$_POST['roll_no'];
    $student_photo=$_POST['student_photo'];
    $student_boarding=$_POST['student_boarding'];
    $student_transport=$_POST['student_transport'];
    $scholar_ship=$_POST['scholar_ship'];
    $acmec_scholorship=$_POST['acmec_scholorship'];
    $c_sship=$_POST['c_sship'];
    $first_graduate=$_POST['first_graduate'];
    $acmec_trust=$_POST['acmec_trust'];
    $medical_history=$_POST['medical_history'];
    $student_gender=$_POST['student_gender'];
    $d_o_b=$_POST['d_o_b'];
    $blood_group=$_POST['blood_group'];
    $religion=$_POST['religion'];
    $community=$_POST['community'];
    $caste=$_POST['caste'];
    $nationality=$_POST['nationality'];
    $father_name=$_POST['father_name'];
    $father_occupation=$_POST['father_occupation'];
    $father_mincome=$_POST['father_mincome'];
    $mother_name=$_POST['mother_name'];
    $mother_occupation=$_POST['mother_occupation'];
    $mother_mincome=$_POST['mother_mincome'];
    $door_no=$_POST['door_no'];
    $street=$_POST['street'];
    $post=$_POST['post'];
    $taluk=$_POST['taluk'];
    $district=$_POST['district'];
    $state=$_POST['state'];
    $pincode=$_POST['pincode'];
    $mobile_no=$_POST['mobile_no'];
    $contact_no=$_POST['contact_no'];
    $personal_email=$_POST['personal_email'];
    $father_mobile=$_POST['father_mobile'];
    $guardian_name=$_POST['guardian_name'];
    $guardian_no=$_POST['guardian_no'];
    $guardian_email=$_POST['guardian_email'];
    $guardian_address=$_POST['guardian_address'];
    $guardian_city=$_POST['guardian_city'];
   $activity=$_POST['activity'];


   $c_door_no=$_POST['c_door_no'];
   $c_street=$_POST['c_street'];
   $c_post=$_POST['c_post'];
   $c_taluk=$_POST['c_taluk'];
   $c_district=$_POST['c_district'];
   $c_state=$_POST['c_state'];
   $c_pincode=$_POST['c_pincode'];
   $student_title=$_POST['student_title'];

    $application_no=$_POST['application_no'];
    $father_title=$_POST['father_title'];
    $mother_title=$_POST['mother_title'];
    $donate_blood=$_POST['donate_blood'];
    $staying_with=$_POST['staying_with'];
    $guardian_relation=$_POST['guardian_relation'];
    $guardian_pincode=$_POST['guardian_pincode'];
    $mother_mobile=$_POST['mother_mobile'];
    $father_email=$_POST['father_email'];

    $pi_mark1=$_POST['pi_mark1'];
    $pi_mark2=$_POST['pi_mark2'];
  	$s_id=$_POST['student_id'];

    $leaving_date=$_POST['leaving_date'];
    $tc_apply_date=$_POST['tc_apply_date'];
    $tc_issue_date=$_POST['tc_issue_date'];
    $cri_status=$_POST['cri_status'];
    $leaving_reason=$_POST['leaving_reason'];
    $discontinued_year=$_POST['discontinued_year'];
      
    $tf_receipt_date=$_POST['tf_receipt_date']; 
    $tf_receipt_no=$_POST['tf_receipt_no'];
    $tf_amount=$_POST['tf_amount'];
    $acmec_amount=$_POST['acmec_amount'];
    $acmec_approved=$_POST['acmec_approved'];
    $aadhar_no=$_POST['aadhar_no'];
    $ar_number=$_POST['ar_number'];
    $ar_rank=$_POST['ar_rank'];
    $neet_roll_no=$_POST['neet_roll_no'];
    $neet_score=$_POST['neet_score'];
    $pan_no=$_POST['pan_no'];
    $pan_name=$_POST['pan_name'];
    
     $b_ac_no=$_POST['b_ac_no'];
  $b_ac_name=$_POST['b_ac_name'];
  $b_name=$_POST['b_name'];
  $b_branch=$_POST['b_branch'];
  $b_ifsc=$_POST['b_ifsc'];
    
    
    
    
    
    
    
    
    

    if($leaving_date!='')
    $leaving_date=date('Y-m-d',strtotime($leaving_date));
    if($tc_issue_date!='')
    $tc_issue_date=date('Y-m-d',strtotime($tc_issue_date));
    if($tc_apply_date!='')
    $tc_apply_date=date('Y-m-d',strtotime($tc_apply_date));

    $cri_status=addslashes($cri_status);
    $leaving_reason=addslashes($leaving_reason);
    $discontinued_year=addslashes($discontinued_year);
    if(strtolower($leaving_reason)=='completed')
    $discontinued_year='';

    $application_no=addslashes($application_no);
    $father_title=addslashes($father_title);
    $mother_title=addslashes($mother_title);
    $donate_blood=addslashes($donate_blood);
    $staying_with=addslashes($staying_with);
    $guardian_relation=addslashes($guardian_relation);
    $guardian_pincode=addslashes($guardian_pincode);
    $mother_mobile=addslashes($mother_mobile);
    $father_email=addslashes($father_email);
    $pi_mark1=addslashes($pi_mark1);
    $pi_mark2=addslashes($pi_mark2);




    $admission_no=addslashes($admission_no);
    $student_title=addslashes($student_title);
    $student_name=addslashes($student_name);
    $student_initial=addslashes($student_initial);
    $a_year=addslashes($a_year);
    $admission_source=addslashes($admission_source);
    $course_name=addslashes($course_name);
    $degree_name=addslashes($degree_name);
    $register_no=addslashes($register_no);
    $bregister_no=addslashes($bregister_no);
    $roll_no=addslashes($roll_no);
    $student_photo=addslashes($student_photo);
    $student_boarding=addslashes($student_boarding);
    $student_transport=addslashes($student_transport);
    $scholar_ship=addslashes($scholar_ship);
    $acmec_scholorship=addslashes($acmec_scholorship);
    $c_sship=addslashes($c_sship);
    $first_graduate=addslashes($first_graduate);
    $acmec_trust=addslashes($acmec_trust);
    $medical_history=addslashes($medical_history);
    $student_gender=addslashes($student_gender);
    $blood_group=addslashes($blood_group);
    $religion=addslashes($religion);
    $community=addslashes($community);
    $caste=addslashes($caste);
    $nationality=addslashes($nationality);
    $father_name=addslashes($father_name);
    $father_occupation=addslashes($father_occupation);
    $father_mincome=addslashes($father_mincome);
    $mother_name=addslashes($mother_name);
    $mother_occupation=addslashes($mother_occupation);
    $mother_mincome=addslashes($mother_mincome);
    $door_no=addslashes($door_no);
    $street=addslashes($street);
    $post=addslashes($post);
    $taluk=addslashes($taluk);
    $district=addslashes($district);
    $state=addslashes($state);
    $pincode=addslashes($pincode);
    $mobile_no=addslashes($mobile_no);
    $contact_no=addslashes($contact_no);
    $personal_email=addslashes($personal_email);
    $father_mobile=addslashes($father_mobile);
    $guardian_name=addslashes($guardian_name);
    $guardian_no=addslashes($guardian_no);
    $guardian_email=addslashes($guardian_email);
    $guardian_address=addslashes($guardian_address);
    $guardian_city=addslashes($guardian_city);
    $student_activity=implode(',',$activity);
    $student_activity=addslashes($student_activity);


    $c_door_no=addslashes($c_door_no);
    $c_street=addslashes($c_street);
    $c_post=addslashes($c_post);
    $c_taluk=addslashes($c_taluk);
    $c_district=addslashes($c_district);
    $c_state=addslashes($c_state);
    $c_pincode=addslashes($c_pincode);
      
    $tf_receipt_no=addslashes($tf_receipt_no);
    $tf_amount=addslashes($tf_amount);
    $acmec_amount=addslashes($acmec_amount);     
    $acmec_approved=addslashes($acmec_approved);     
    $aadhar_no=addslashes($aadhar_no);
    $ar_number=addslashes($ar_number); 
    $ar_rank=addslashes($ar_rank);
    $neet_roll_no=addslashes($neet_roll_no);
    $neet_score=addslashes($neet_score);
    
    $b_ac_no=addslashes($b_ac_no);
  $b_ac_name=addslashes($b_ac_name);
  $b_name=addslashes($b_name);
  $b_branch=addslashes($b_branch);
  $b_ifsc=addslashes($b_ifsc);
    
    
  if($tf_receipt_date!='')
  $tf_receipt_date=date('Y-m-d',strtotime($tf_receipt_date));
      

  if($d_o_b!='')
  $d_o_b=date('Y-m-d',strtotime($d_o_b));

  if($joined_date!='')
  $joined_date=date('Y-m-d',strtotime($joined_date));
  if($scholar_ship!=1)
  {
  $c_sship='';
  $acmec_trust=0;
  $first_graduate=0;
  }
//  register_no=	'$roll_no',
  //academic_year=	'$a_year',
  //course_id=	'$degree_name',
  //tc_apply_date=	'$tc_apply_date',
  
  $umis_no=$_POST['umis_number'];
    $emis_no=$_POST['emis_number'];
          
    $umis_no=addslashes($umis_no);
    $emis_no=addslashes($emis_no);

  $insert_query="UPDATE student_profile_tb SET
  admission_no=	'$admission_no',
admission_date=	'$joined_date',
admission_source=	'$admission_source',
uregister_no=	'$register_no',
bregister_no=	'$bregister_no',
student_title=	'$student_title',
student_name=	'$student_name',
student_initial=	'$student_initial',
father_name=	'$father_name',
father_occupation=	'$father_occupation',
father_income=	'$father_mincome',
mother_name=	'$mother_name',
mother_occupation=	'$mother_occupation',
mother_income=	'$mother_mincome',
student_gender=	'$student_gender',
student_dob=	'$d_o_b',
student_bg=	'$blood_group',
student_religion=	'$religion',
student_caste=	'$caste',
student_community=	'$community',
student_nationality=	'$nationality',
door_no=	'$door_no',
street=	'$street',
post=	'$post',
taluk=	'$taluk',
district=	'$district',
state=	'$state',
pincode=	'$pincode',
c_door_no=	'$c_door_no',
c_street=	'$c_street',
c_post=	'$c_post',
c_taluk=	'$c_taluk',
c_district=	'$c_district',
c_state=	'$c_state',
c_pincode=	'$c_pincode',
mobile_no=	'$mobile_no',
contact_no=	'$contact_no',
father_mobile_1=	'$father_mobile',
personal_email=	'$personal_email',
guardian_name=	'$guardian_name',
guardian_no=	'$guardian_no',
guardian_email=	'$guardian_email',
guardian_address=	'$guardian_address',
guardian_city=	'$guardian_city',
first_graduate=	'$first_graduate',
acmec_trust=	'$acmec_trust',
scholar_ship=	'$scholar_ship',
caste_scholar_ship=	'$c_sship',
application_no=	'$application_no',
father_title=	'$father_title',
mother_title=	'$mother_title',
donate_blood=	'$donate_blood',
staying_with=	'$staying_with',
guardian_relation=	'$guardian_relation',
guardian_pincode=	'$guardian_pincode',
mother_mobile=	'$mother_mobile',
father_email=	'$father_email',
persional_identification=	'$pi_mark1',
persional_identification_1=	'$pi_mark2',
releaving_date=	'$leaving_date',
releaving_info=	'$leaving_reason',
releaving_year=	'$discontinued_year',
tc_issue_date=	'$tc_issue_date',
cri_status=	'$cri_status',
tf_receipt_date= '$tf_receipt_date', 
tf_receipt_no= '$tf_receipt_no', 
tf_amount= '$tf_amount',
acmec_scholorship= '$acmec_scholorship',
acmec_amount= '$acmec_amount', 
acmec_approved= '$acmec_approved', 
aadhar_no= '$aadhar_no', 
ar_number= '$ar_number', 
ar_rank= '$ar_rank', 
neet_roll_no= '$neet_roll_no', 
neet_score= '$neet_score', 
pan_no= '$pan_no', 
pan_name= '$pan_name', 
b_ac_no ='$b_ac_no',
b_ac_name ='$b_ac_name',
b_name ='$b_name',
b_branch ='$b_branch',
b_ifsc ='$b_ifsc',
umis_no='$umis_no',
emis_no='$emis_no',
updated_dt=	'$a_user_dt',
updated_ip=	'$a_user_ip',
updated_by=	'$a_username'
where id='$s_id'
";
 
  $result=mysqli_query($GLOBALS["__CIS_MYSQLI"], $insert_query);
  if($result)
  {

  ////////////Update Log///////////////
  $log_object=array($url_ref,'Update','Successful',$s_id,$a_user_dt,$a_user_ip,$a_user_os,$a_username);
  insert_log($log_object);
  $report='<div class="alert alert-success fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Success!</strong> Your details are updated...</div>';


  if($s_id)
  {

  $prgm_name=$_POST['prgm_name'];
  $creg_no=$_POST['creg_no'];
  $passed_out=$_POST['passed_out'];
  $ctotal=$_POST['ctotal'];
  $pgm_board=$_POST['pgm_board'];
  $mid=$_POST['mid'];
  mysqli_query($GLOBALS["__CIS_MYSQLI"], "UPDATE student_certificate SET del=0, updated_dt='$a_user_dt', updated_ip='$a_user_ip', updated_by='$a_username' where s_id='$s_id' AND del=1 ");

  for($x=0;$x<sizeof($prgm_name);$x++)
  {
  $prgm_name[$x]=addslashes($prgm_name[$x]);
  $passed_out[$x]=addslashes($passed_out[$x]);
  $pgm_board[$x]=addslashes($pgm_board[$x]);
  $creg_no[$x]=addslashes($creg_no[$x]);
  $ctotal[$x]=addslashes($ctotal[$x]);
  if(($prgm_name[$x] || $passed_out[$x] || $ctotal[$x]) && $mid[$x]=='')
  {
    mysqli_query($GLOBALS["__CIS_MYSQLI"], "INSERT INTO student_certificate(s_id, cregister_no, course_name, board, year_of_passing,   total_marks,  created_dt, created_ip, created_by)values('$s_id', '$creg_no[$x]', '$prgm_name[$x]', '$pgm_board[$x]', '$passed_out[$x]', '$ctotal[$x]', '$a_user_dt', '$a_user_ip', '$a_username')");
  }
  else {
  	mysqli_query($GLOBALS["__CIS_MYSQLI"], "UPDATE student_certificate SET
  	cregister_no='$creg_no[$x]',
  	course_name='$prgm_name[$x]',
  	board='$pgm_board[$x]',
  	year_of_passing='$passed_out[$x]',
  	total_marks='$ctotal[$x]',
  	del=1,
  	updated_dt='$a_user_dt',
  	updated_ip='$a_user_ip',
  	updated_by='$a_username'
  	where
  	id='$mid[$x]' ");
  }
  }
  }



  }
  }
  else
  {

   ////////////Update Log///////////////
  $log_object=array($url_ref,'Add','Unsuccessful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
  insert_log($log_object);
  $report='<div class="alert alert-danger fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Oops!</strong> Roll number Already Exist...</div>';

  }
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
	<?PHP   echo $basic_style_details_array['basic'].$basic_style_details_array['date_picker']; ?>
	<style>
      .student_container > .panel.r1 {
    min-height: 640px;
}
      </style>
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
            include_once("student_profile_edit_more.php");
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
   <?PHP   echo $basic_js_details_array['basic'].$basic_js_details_array['color_picker'].$basic_js_details_array['date_picker'];?>

   <script src="student_profile.js?v=4" type="text/javascript"></script>
  </body>
</html>
