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
  $sql_validate="SELECT * FROM student_profile_tb WHERE del=1 AND register_no='$roll_no'  ORDER BY created_dt DESC";
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
    $c_sship=$_POST['c_sship'];
//    $acmec_trust=$_POST['acmec_trust'];
    $first_graduate=$_POST['first_graduate'];
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
    $ar_number=$_POST['ar_number'];
    $ar_rank=$_POST['ar_rank'];
    $neet_roll_no=$_POST['neet_roll_no'];
    $neet_score=$_POST['neet_score'];


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
      
    $tf_receipt_date=$_POST['tf_receipt_date']; 
    $tf_receipt_no=$_POST['tf_receipt_no'];
    $tf_amount=$_POST['tf_amount'];
    $aadhar_no=$_POST['aadhar_no'];
    $acmec_scholorship=$_POST['acmec_scholorship'];
    $acmec_approved=$_POST['acmec_approved'];
    $acmec_amount=$_POST['acmec_amount'];
    
    $b_ac_no=$_POST['b_ac_no'];
$b_ac_name=$_POST['b_ac_name'];
$b_name=$_POST['b_name'];
$b_branch=$_POST['b_branch'];
$b_ifsc=$_POST['b_ifsc'];
      
    $umis_no=$_POST['umis_number'];
    $emis_no=$_POST['emis_number'];
          
    $umis_no=addslashes($umis_no);
    $emis_no=addslashes($emis_no);
    
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
    $c_sship=addslashes($c_sship);
//    $acmec_trust=addslashes($acmec_trust);
    $first_graduate=addslashes($first_graduate);
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
    $aadhar_no=addslashes($aadhar_no);
    $ar_number=addslashes($ar_number);
    $ar_rank=addslashes($ar_rank);
    $neet_roll_no=addslashes($neet_roll_no);
    $neet_score=addslashes($neet_score);
    $acmec_scholorship=addslashes($acmec_scholorship);
    $acmec_amount=addslashes($acmec_amount);
    $acmec_approved=addslashes($acmec_approved);
    
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
//  $acmec_trust=0;
  $first_graduate=0;
  }
  $login_pin=substr($a_year,2,2).substr($a_year,-2);


  $insert_query="INSERT INTO student_profile_tb( admission_no, admission_date, academic_year, admission_source, course_id, uregister_no, register_no, bregister_no, student_title,  student_name, student_initial,  father_name, father_occupation, father_income, mother_name, mother_occupation, mother_income, student_gender, student_dob,  student_bg, student_religion, student_caste, student_community, student_nationality,  door_no, street, post, taluk, district, state, pincode, c_door_no, c_street, c_post, c_taluk, c_district, c_state, c_pincode, mobile_no, contact_no, father_mobile_1,  personal_email,  guardian_name, guardian_no, guardian_email, guardian_address, guardian_city, first_graduate, scholar_ship, caste_scholar_ship, application_no, father_title, mother_title, donate_blood, staying_with, guardian_relation, guardian_pincode, mother_mobile, father_email, persional_identification, persional_identification_1, a_pin, tf_receipt_date, tf_receipt_no, tf_amount, acmec_scholorship, acmec_amount, acmec_approved, aadhar_no, ar_number, ar_rank,sms_mobile,neet_roll_no,neet_score,b_ac_no, b_ac_name, b_name, b_branch, b_ifsc,umis_no,emis_no, created_dt, created_ip, created_by) VALUES ( '$admission_no', '$joined_date','$a_year', '$admission_source',  '$degree_name', '$register_no', '$roll_no', '$bregister_no', '$student_title', '$student_name', '$student_initial', '$father_name', '$father_occupation', '$father_mincome', '$mother_name', '$mother_occupation', '$mother_mincome',  '$student_gender', '$d_o_b',  '$blood_group', '$religion', '$caste', '$community',  '$nationality',  '$door_no', '$street', '$post', '$taluk', '$district', '$state', '$pincode',  '$c_door_no', '$c_street', '$c_post', '$c_taluk', '$c_district', '$c_state', '$c_pincode', '$mobile_no', '$contact_no', '$father_mobile', '$personal_email',  '$guardian_name', '$guardian_no', '$guardian_email', '$guardian_address', '$guardian_city', '$first_graduate',  '$scholar_ship', '$c_sship', '$application_no', '$father_title', '$mother_title', '$donate_blood', '$staying_with', '$guardian_relation', '$guardian_pincode', '$mother_mobile', '$father_email', '$pi_mark1', '$pi_mark2', '$login_pin', '$tf_receipt_date', '$tf_receipt_no', '$tf_amount', '$acmec_scholorship', '$acmec_amount', '$acmec_approved', '$aadhar_no', '$ar_number', '$ar_rank', '$father_mobile', '$neet_roll_no', '$neet_score', '$b_ac_no', '$b_ac_name', '$b_name', '$b_branch', '$b_ifsc','$umis_no','$emis_no', '$a_user_dt', '$a_user_ip', '$a_username')";

      
      
      
  $result=mysqli_query($GLOBALS["__CIS_MYSQLI"], $insert_query);
  if($result)
  {

  ////////////Update Log///////////////
  $log_object=array($url_ref,'Add','Successful','',$a_user_dt,$a_user_ip,$a_user_os,$a_username);
  insert_log($log_object);
  $report='<div class="alert alert-success fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Success!</strong> Your details are added...</div>';

  $sql_section='SELECT id FROM student_profile_tb WHERE register_no="'.$roll_no.'"  AND created_dt="'.$a_user_dt.'"  AND created_ip="'.$a_user_ip.'"  AND created_by="'.$a_username.'"  AND del=1';
  $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
  $row_section=mysqli_fetch_array($result_section);
  $r_id=$row_section['id'];

  if($r_id)
  {
  $sql_insert="INSERT INTO student_academic_tb( s_id, course_id, academic_year, academic_type, academic_batch,  register_no,  current_year,   student_activity, created_dt, created_ip, created_by) VALUES ( '$r_id',  '$degree_name',  '$a_year', 'regular', 'regular',  '$roll_no',  '1',  '$student_activity', '$a_user_dt', '$a_user_ip', '$a_username')";
  mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_insert);

  $prgm_name=$_POST['prgm_name'];
  $creg_no=$_POST['creg_no'];
  $passed_out=$_POST['passed_out'];
  $ctotal=$_POST['ctotal'];
  $pgm_board=$_POST['pgm_board'];

  for($x=0;$x<sizeof($prgm_name);$x++)
  {
  $prgm_name[$x]=addslashes($prgm_name[$x]);
  $passed_out[$x]=addslashes($passed_out[$x]);
  $pgm_board[$x]=addslashes($pgm_board[$x]);
  $creg_no[$x]=addslashes($creg_no[$x]);
  if($prgm_name[$x] || $passed_out[$x] || $ctotal[$x])
  {
  $sql_insert="INSERT INTO student_certificate(s_id, cregister_no, course_name, board, year_of_passing, total_marks,  created_dt, created_ip, created_by)values('$r_id', '$creg_no[$x]', '$prgm_name[$x]', '$pgm_board[$x]', '$passed_out[$x]', '$ctotal[$x]', '$a_user_dt', '$a_user_ip', '$a_username')";
  mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_insert);
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
  $report='<div class="alert alert-danger fade in"><button data-dismiss="alert" class="close close-sm" type="button"><i class="icon-remove"></i></button><strong>Oops!</strong> Register number Already Exist...</div>';

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

function generate_pin( $length = 4 ) {
$chars = "0123456789";
$password = substr( str_shuffle( $chars ), 0, $length );
if(strlen($password)==$length)
return $password;
else
generate_pin( $length );
}
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

                  <div class="col-sm-12">
        <form class="cmxform form-horizontal tasi-form" enctype="multipart/form-data" id="signupForm" method="post" >
        <div class="row">
        <?PHP ////////////////////////////////Admission ////////////////////////////// ?>
        <div class="col-sm-4 student_container">
        <section class="panel r1">
        <header class="panel-heading">
        Admission
        </header>
          <div class="col-sm-12">
        <div class="form">
        <div class="form-group ">
        <label for="application_no" class="control-label col-sm-4">
            Application No.
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="application_no" name="application_no" maxlength="20"  type="text"   />
        </div>
        </div>

        <div class="form-group ">
        <label for="admission_no" class="control-label col-sm-4">
            Admission No <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="admission_no" name="admission_no" maxlength="20"   type="text" required />
        </div>
        </div>
        <div class="form-group ">
        <label for="joined_date" class="control-label col-sm-4">
          Admission Date<span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <input class="calendar form-control" id="joined_date" name="joined_date" maxlength="10" value="<?PHP echo date('d-m-Y') ?>"  type="text" required />
        </div>
        </div>

        <div class="form-group ">
        <label  class="control-label col-sm-4">
          Source
        </label>
        <div class="col-sm-8">
          <?
            $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Quota"  AND del!=0 AND id!=115 AND id!=116 ORDER BY category_order ASC');
            $fchecked=' checked ';
            while(($row_section=mysqli_fetch_array($sql_section))!=false)
           {
            $s_id=$row_section['id'];
            $category_name=$row_section['category_name'];
            $category_sname=$row_section['category_sname'];

            echo "<label><input type='radio' name='admission_source' $fchecked value='$s_id'> ".stripslashes($category_sname). "   </label>";
            $fchecked='';
           }
           ?>
        </div>
        </div>

        <div class="form-group ">
        <label for="a_year" class="control-label col-sm-4">
          Batch <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <select name="a_year" id="a_year" onchange="call_course_name()" class="form-control" required>
       <option value="">--Select one--</option>
            <?
              $sql_academic='SELECT * FROM basic_setup_course_tb ORDER BY year_of_start ASC';
              $result_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_academic);
              $row_academic=mysqli_fetch_array($result_academic);
              $e_year=$row_academic['year_of_start'];
              for($i=date('Y');$i>=$e_year;$i--)
              {
              $a_year=$i.'-'.($i+1);
              if($academic_year_ref==$a_year)
              echo '<option value="'.$a_year.'" selected="selected" >'.$a_year.'</option>';
              else
              echo  '<option value="'.$a_year.'">'.$a_year.'</option>';
              }
            ?>
          </select>
        </div>
        </div>

        <div class="form-group ">
        <label for="course_name" class="control-label col-sm-4">
          Degree<span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <select name="course_name" id="course_name" class="form-control" onchange="call_course_name()" required>
            <option value="">--Select one--</option>
          <?
          $sql_academic='SELECT DISTINCT(course_name) FROM basic_setup_course_tb WHERE del=1  ORDER BY c_order ASC';
          $result_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_academic);
          while(($row_academic=mysqli_fetch_array($result_academic))!=false)
          {
          $course_name=$row_academic['course_name'];

          echo  '<option value="'.$course_name.'">'.$course_name.'</option>';
          }
          ?>
          </select>
        </div>
        </div>

        <div class="form-group ">
        <label for="degree_name" class="control-label col-sm-4">
          Course <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7" id="degree_span">
        <select name="degree_name" id="degree_name" class="form-control" required>
          <option value="">--Select one--</option>
        </select>
        </div>
        </div>
        
        
        
        
            <div class="form-group ">
        <label for="ar_number" class="control-label col-sm-4">
            AR No 
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="ar_number" name="ar_number" maxlength="20"   type="text"  />
        </div>
        </div>
        
        <div class="form-group ">
        <label for="ar_rank" class="control-label col-sm-4">
          Rank
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="ar_rank" name="ar_rank" maxlength="20"  type="text"  />
        </div>
        </div>
        <div class="form-group ">
        <label for="neet_roll_no" class="control-label col-sm-4">
          NEET Roll No
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="neet_roll_no" name="neet_roll_no" maxlength="10"  type="text"  />
        </div>
        </div>
        <div class="form-group ">
        <label for="neet_score" class="control-label col-sm-4">
          NEET Score
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="neet_score" name="neet_score" maxlength="3"  type="text"  />
        </div>
        </div>
  

        </div>
        </div>
        </section>
        </div>

        <?PHP ////////////////////////////////Personal 1 ////////////////////////////// ?>
        <div class="col-sm-4 student_container">
        <section class="panel r1">
        <header class="panel-heading">
        Personal 1
        </header>
          <div class="col-sm-12">
        <div class="form">
        <div class="form-group ">
        <label  class="control-label col-sm-5">
          Student  Title
        </label>
        <div class="col-sm-7">
          <?
            $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Student Title"  AND del!=0 ORDER BY category_order ASC');
            $fchecked=' checked ';
            while(($row_section=mysqli_fetch_array($sql_section))!=false)
           {
            $s_id=$row_section['id'];
            $category_name=$row_section['category_name'];
            $category_sname=$row_section['category_sname'];
            echo "<label><input type='radio'  name='student_title' $fchecked value='$category_name'> ".stripslashes($category_name)."  </label> ";
            $fchecked='';
           }
           ?>
        </div>
        </div>

        <div class="form-group ">
        <label for="student_name" class="control-label col-sm-5">
          Student  Name <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="student_name" name="student_name" maxlength="155"   type="text" required />
        </div>
        </div>
        <div class="form-group ">
        <label for="student_initial" class="control-label col-sm-5">
        Student  Initial
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="student_initial" name="student_initial" maxlength="20" type="text"  />
        </div>
        </div>

        <div class="form-group ">
        <label  class="control-label col-sm-5">
          Father's Name Title
        </label>
        <div class="col-sm-7">
          <?
            $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Parent Title"  AND del!=0 ORDER BY category_order ASC');
            $fchecked=' checked ';
            $mother_title_str='';
            while(($row_section=mysqli_fetch_array($sql_section))!=false)
           {
            $s_id=$row_section['id'];
            $category_name=$row_section['category_name'];
            $category_sname=$row_section['category_sname'];
            echo "<label><input type='radio'  name='father_title' $fchecked value='$category_name'> ".stripslashes($category_name)."  </label> ";
            $mother_title_str.="<label><input type='radio'  name='mother_title' $fchecked value='$category_name'>  ".stripslashes($category_name)." </label> ";
            $fchecked='';
           }
           ?>
        </div>
        </div>

        <div class="form-group ">
        <label for="father_name" class="control-label col-sm-5">
          Father's Name
        </label>
        <div class="col-sm-7">
            <input class="form-control" id="father_name" name="father_name" maxlength="155"   type="text"   />
        </div>
        </div>

        <div class="form-group ">
        <label  class="control-label col-sm-5">
          Mother's Name Title
        </label>
        <div class="col-sm-7">
          <?
            echo $mother_title_str;
           ?>
        </div>
        </div>

        <div class="form-group ">
        <label for="mother_name" class="control-label col-sm-5">
          Mother's Name
        </label>
        <div class="col-sm-7">
            <input class="form-control" id="mother_name" name="mother_name" maxlength="155"   type="text"   />
        </div>
        </div>

        <div class="form-group ">
        <label for="aadhar_no" class="control-label col-sm-5">
          Aadhar No. <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
            <input class="form-control" id="aadhar_no" name="aadhar_no" maxlength="12"   type="text" required  />
        </div>
        </div>
        
        
                <div class="form-group ">
        <label for="roll_no" class="control-label col-sm-5">
            Student ID<span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="roll_no" name="roll_no" maxlength="20"  type="text"  required />
        </div>
        </div>

        <div class="form-group ">
        <label for="register_no" class="control-label col-sm-5">
            Biometric ID.
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="bregister_no" name="bregister_no" maxlength="20"   type="text"  />
        </div>
        </div>

        <div class="form-group ">
        <label for="register_no" class="control-label col-sm-5">
            University Reg. No.
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="register_no" name="register_no" maxlength="20"   type="text"  />
        </div>
        </div>    
        
        <div class="form-group ">
            <label for="ar_number" class="control-label col-sm-5">
                EMIS No. 
            </label>
            <div class="col-sm-7">
              <input class="form-control" id="emis_number" name="emis_number" maxlength="20"   type="text"  />
            </div>
        </div>
        
        <div class="form-group ">
            <label for="ar_number" class="control-label col-sm-5">
                UMIS No. 
            </label>
            <div class="col-sm-7">
              <input class="form-control" id="umis_number" name="umis_number" maxlength="20"   type="text"  />
            </div>
        </div>
            
            

        </div>
        </div>
        </section>
        </div>


        <?PHP ////////////////////////////////Personal 2 ////////////////////////////// ?>
        <div class="col-sm-4 student_container">
        <section class="panel r1">
        <header class="panel-heading">
        Personal 2
        </header>
          <div class="col-sm-12">
        <div class="form">
        <div class="form-group ">
        <label class="control-label col-sm-4">
            Gender
        </label>
        <div class="col-sm-7">
          <label>    <input name="student_gender" type="radio" value="Male" checked="checked" />
             Male</label>
          <label>  <input name="student_gender" type="radio" value="Female"/>
              Female </label>
           <label>  <input name="student_gender" type="radio" value="Transgender"/>
               Trans </label>
        </div>
        </div>

        <div class="form-group ">
        <label for="d_o_b" class="control-label col-sm-4">
            DOB
        </label>
        <div class="col-sm-7">
          <input class="form-control calendar" id="d_o_b" name="d_o_b" maxlength="20"   type="text"  />
        </div>
        </div>
        <div class="form-group ">
        <label for="blood_group" class="control-label col-sm-4">
          BG
        </label>
        <div class="col-sm-7">
          <select name="blood_group" class="form-control" id="blood_group">
            <option value="">-- Select one --</option>
          <?
            $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="BloodGroup"  AND del!=0 ORDER BY category_order ASC');
            while(($row_section=mysqli_fetch_array($sql_section))!=false)
           {
            $s_id=$row_section['id'];
            $category_name=$row_section['category_name'];
            $category_sname=$row_section['category_sname'];

            echo "<option value='$s_id'>".stripslashes($category_name)."</option>";
           }
           ?>
          </select>
        </div>
        </div>

        <div class="form-group ">
          <label for="donate_blood" class="control-label col-sm-4">
            Willingness to donate Blood
          </label>
          <div class="col-sm-7">
            <label>  <input name="donate_blood" id="donate_blood" type="checkbox" value="1" />
          Yes</label>
        </div>
        </div>

        <div class="form-group ">
        <label for="religion" class="control-label col-sm-4">
          Religion
        </label>
        <div class="col-sm-7">
          <select name="religion" class="form-control" id="religion">
            <option value="">-- Select one --</option>
            <?
              $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Religion"  AND del!=0 ORDER BY category_order ASC');
              while(($row_section=mysqli_fetch_array($sql_section))!=false)
             {
              $s_id=$row_section['id'];
              $category_name=$row_section['category_name'];
              $category_sname=$row_section['category_sname'];

              echo "<option value='$s_id'>".stripslashes($category_name)."</option>";
             }
             ?>
          </select>
        </div>
        </div>

        <div class="form-group ">
        <label for="community" class="control-label col-sm-4">
          Community
        </label>
        <div class="col-sm-7">
          <select name="community" class="form-control" id="community">
            <option value="">-- Select one --</option>
            <?
              $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Community"  AND del!=0 ORDER BY category_order ASC');
              while(($row_section=mysqli_fetch_array($sql_section))!=false)
             {
              $s_id=$row_section['id'];
              $category_name=$row_section['category_name'];
              $category_sname=$row_section['category_sname'];
              echo "<option value='$s_id'>".stripslashes($category_name)."</option>";
             }
             ?>
          </select>
        </div>
        </div>

        <div class="form-group ">
        <label for="caste" class="control-label col-sm-4">
          Caste
        </label>
        <div class="col-sm-7">
          <input name="caste" type="text" class="form-control" id="caste" maxlength="70" onKeyUp="dodacheck(this);"   list="caste_list"/>
        </div>
        </div>

        <div class="form-group ">
        <label for="caste" class="control-label col-sm-4">
          Nationality
        </label>
        <div class="col-sm-7">
          <input name="nationality" type="text" class="form-control" id="nationality" maxlength="70" value="Indian" onKeyUp="dodacheck(this);"  />
        </div>
        </div>


        </div>
        </div>
        </section>
        </div>

        </div>
        <div class="row">

        <?PHP ////////////////////////////////Parent ////////////////////////////// ?>
        <div class="col-sm-4 student_container1">
        <section class="panel">
        <header class="panel-heading">
        Parent
        </header>
          <div class="col-sm-12">
        <div class="form">
        <div class="form-group ">
        <label for="father_occupation" class="control-label col-sm-5">
            Father's Occupation
        </label>
        <div class="col-sm-7">
          <input name="father_occupation" type="text" class="form-control" id="father_occupation" maxlength="155" />
        </div>
        </div>

        <div class="form-group ">
        <label for="father_mincome" class="control-label col-sm-5">
            Father's Y.Income <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <input name="father_mincome" type="text" class="form-control" id="father_mincome"  maxlength="10" onKeyUp="validatephone(this)" required/>
        </div>
        </div><div class="form-group ">
        <label for="mother_occupation" class="control-label col-sm-5">
            Mother's Occupation
        </label>
        <div class="col-sm-7">
          <input name="mother_occupation" type="text" class="form-control" id="mother_occupation" maxlength="155" />
        </div>
        </div>

        <div class="form-group ">
        <label for="mother_mincome" class="control-label col-sm-5">
            Mother's Y.Income <span class="text-danger" >*</span>
        </label>
        <div class="col-sm-7">
          <input name="mother_mincome" type="text" class="form-control" id="mother_mincome" maxlength="10" onKeyUp="validatephone(this)" required/>
        </div>
        </div>





        </div>
        </div>
        </section>
        </div>

        <?PHP ////////////////////////////////Guardian  ////////////////////////////// ?>
        <div class="col-sm-4 student_container1">
        <section class="panel">
        <header class="panel-heading">
        Guardian
        </header>
          <div class="col-sm-12">
        <div class="form">
        <div class="form-group ">
        <label for="staying_with" class="control-label col-sm-4">
          Staying With Guardian
        </label>
        <div class="col-sm-7">
          <label>    <input name="staying_with" id="staying_with" type="checkbox" value="1" onclick="callStayWithG()"  />
             Yes </label>
        </div>
        </div>
        <div id="styg" style="display:none;">
        <div class="form-group ">
        <label for="guardian_relation" class="control-label col-sm-4">
            Relationship
        </label>
        <div class="col-sm-7">
          <input name="guardian_relation" type="text" class="form-control" id="guardian_relation"  maxlength="70" onKeyUp="dodacheck(this)" />
        </div>
        </div>
        <div class="form-group ">
        <label for="guardian_name" class="control-label col-sm-4">
            Guardian Name
        </label>
        <div class="col-sm-7">
          <input name="guardian_name" type="text" class="form-control" id="guardian_name"  maxlength="100" onKeyUp="dodacheck(this)" />
        </div>
        </div>
        <div class="form-group ">
        <label for="guardian_no" class="control-label col-sm-4">
          Mobile No.
        </label>
        <div class="col-sm-7">
          <input name="guardian_no" type="text" class="form-control" id="guardian_no" maxlength="15" onKeyUp="validatephone(this)" />
        </div>
        </div>

        <div class="form-group ">
          <label for="guardian_email" class="control-label col-sm-4">
            Email
          </label>
          <div class="col-sm-7">
          <input name="guardian_email" type="email" class="form-control" id="guardian_email" maxlength="100"  />
        </div>
        </div>

        <div class="form-group ">
        <label for="guardian_address" class="control-label col-sm-4">
          Address
        </label>
        <div class="col-sm-7">
          <textarea name="guardian_address" class="form-control" id="guardian_address"></textarea>
        </div>
        </div>

        <div class="form-group ">
        <label for="guardian_city" class="control-label col-sm-4">
          City
        </label>
        <div class="col-sm-7">
          <input name="guardian_city" type="text" class="form-control" id="guardian_city" maxlength="70" onKeyUp="dodacheck(this)" />
        </div>
        </div>

        <div class="form-group ">
        <label for="guardian_pincode" class="control-label col-sm-4">
          Pincode
        </label>
        <div class="col-sm-7">
          <input name="guardian_pincode" type="text" class="form-control" id="guardian_pincode" maxlength="6" onKeyUp="validatephone(this)" />
        </div>
        </div>
      </div>

        </div>
        </div>
        </section>
        </div>
  
        <?PHP ////////////////////////////////Register ////////////////////////////// ?>
        <div class="col-sm-4 student_container1">
        <section class="panel r1">
        <header class="panel-heading">
        Scholorship
        </header>
          <div class="col-sm-12">
        <div class="form">

             <div class="form-group ">
        <label  class="control-label col-sm-4">
           DME Tuition Fees
        </label> 
        </div> 
            
           <div class="form-group ">
        <label for="tf_receipt_date" class="control-label col-sm-4">
           Date
        </label>
        <div class="col-sm-7">
          <input class="form-control calendar" id="tf_receipt_date" name="tf_receipt_date" maxlength="10"   type="text"  />
        </div>
        </div> 
            
            <div class="form-group ">
        <label for="tf_receipt_no" class="control-label col-sm-4">
            Receipt No.
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="tf_receipt_no" name="tf_receipt_no" maxlength="20"   type="text"  />
        </div>
        </div>

        <div class="form-group ">
        <label for="tf_amount" class="control-label col-sm-4">
            Amount
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="tf_amount" name="tf_amount" maxlength="20"   type="text"  />
        </div>
        </div>
            
            
        <div class="form-group ">
        <label for="scholar_ship" class="control-label col-sm-4">
          Scholarship
        </label>
        <div class="col-sm-7">
          <label>  <input name="scholar_ship" id="scholar_ship" type="checkbox" value="1" onclick="call_scholarship_type()"/>
        Yes</label>
        </div>
        </div>

        <div class="form-group " id="sc_type" style="display:none;">
          <label for="first_graduate" class="control-label col-sm-4">
            Scholarship Type
          </label>
          <div class="col-sm-7">
          <label> <input name="c_sship" id="c_sship1" type="radio" value="scst" onclick="call_scholarship_type()"/>
          SC/ST</label>
          <label> <input name="c_sship" id="c_sship2" type="radio" value="sca" onclick="call_scholarship_type()"/>
          SCA</label> 
          <label> <input name="c_sship" id="c_sship3" type="radio" value="bc" onclick="call_scholarship_type()"/>
          BC</label>
          <label> <input name="c_sship" id="c_sship4" type="radio" value="mbc" onclick="call_scholarship_type()"/>
          MBC</label> <br>
          <label>  <input name="first_graduate" id="first_graduate" type="checkbox" value="1" onclick="call_scholarship_type()"/>
          First Graduate</label> 
          <!--<label> <input name="c_sship" id="c_sship5" type="radio" value="gov_schl" onclick="call_scholarship_type()"/>
          GQ Spl %</label> <br> 
                     <label> <input name="acmec_trust" id="acmec_trust" type="checkbox" value="1" onclick="call_scholarship_type()"/>
          ACMEC Trust</label>   -->
          
        </div>
        </div>
      <div class="form-group ">
        <label for="acmec_scholorship" class="control-label col-sm-4">
          ACMEC Scholorship
        </label>
        <div class="col-sm-7">
          <label>    <input name="acmec_scholorship" id="acmec_scholorship" type="checkbox" value="1" onclick="call_acmec_sship()"  />
             Yes </label>
        </div>
        </div>
        <div id="acmecsch" style="display:none;">
        
        <div class="form-group ">
        <label for="acmec_amount" class="control-label col-sm-4">
            Amount:
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="acmec_amount" name="acmec_amount" maxlength="20"   type="text"  />
        </div>
        </div>

        <div class="form-group ">
        <label for="acmec_approved" class="control-label col-sm-4">
            Approved by
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="acmec_approved" name="acmec_approved" maxlength="20"   type="text"  />
        </div>
        </div>
        
        </div>
   
        </div>
        </div>
        </section>
        </div>

     </div>
        <div class="row">
          <?PHP ////////////////////////////////Contact  ////////////////////////////// ?>
          <div class="col-sm-4 student_container">
          <section class="panel">
          <header class="panel-heading">
          Contact
          </header>
            <div class="col-sm-12">
          <div class="form">
          <div class="form-group ">
          <label for="mobile_no" class="control-label col-sm-4">
              Student Mobile No
          </label>
          <div class="col-sm-7">
            <input name="mobile_no" type="text" class="form-control" id="mobile_no" maxlength="15" onKeyUp="validatephone(this)" />
          </div>
          </div>

          <div class="form-group ">
          <label for="father_mobile" class="control-label col-sm-4">
              Father's Mobile No.
          </label>
          <div class="col-sm-7">
            <input name="father_mobile" type="text" class="form-control" id="father_mobile" maxlength="15" onKeyUp="validatephone(this)" />
          </div>
          </div>
          <div class="form-group ">
          <label for="mother_mobile" class="control-label col-sm-4">
            Mother's Mobile No.
          </label>
          <div class="col-sm-7">
            <input name="mother_mobile" type="text" class="form-control" id="mother_mobile" maxlength="15" onKeyUp="validatephone(this)" />
          </div>
          </div>

          <div class="form-group ">
            <label for="contact_no" class="control-label col-sm-4">
              Telephone No
            </label>
            <div class="col-sm-7">
              <input name="contact_no" type="text" class="form-control" id="contact_no"  maxlength="15" onKeyUp="validatephone(this)" />
          </div>
          </div>

          <div class="form-group ">
          <label for="personal_email" class="control-label col-sm-4">
            Student Email
          </label>
          <div class="col-sm-7">
            <input name="personal_email" type="email" class="form-control" id="personal_email" maxlength="100" />
          </div>
          </div>

          <div class="form-group ">
          <label for="" class="control-label col-sm-4">
            Father's Email
          </label>
          <div class="col-sm-7">
            <input name="father_email" type="email" class="form-control" id="father_email" maxlength="100" />
          </div>
          </div>



          </div>
          </div>
          </section>
          </div>

          <?PHP ////////////////////////////////Permanent Address ////////////////////////////// ?>
          <div class="col-sm-4 student_container">
          <section class="panel">
          <header class="panel-heading">
          Permanent Address
          </header>
            <div class="col-sm-12">
          <div class="form">
          <div class="form-group ">
          <label for="door_no" class="control-label col-sm-4">
              Door No.
          </label>
          <div class="col-sm-7">
            <input name="door_no" type="text" class="form-control" id="door_no" size="20" maxlength="155" />
          </div>
          </div>

          <div class="form-group ">
          <label for="street" class="control-label col-sm-4">
              Street
          </label>
          <div class="col-sm-7">
            <input name="street" type="text" class="form-control" id="street" maxlength="255" />
          </div>
          </div>
          <div class="form-group ">
          <label for="post" class="control-label col-sm-4">
            Post
          </label>
          <div class="col-sm-7">
          <input name="post" type="text" class="form-control" id="post" maxlength="70" />
          </div>
          </div>

          <div class="form-group ">
            <label for="taluk" class="control-label col-sm-4">
              Taluk
            </label>
            <div class="col-sm-7">
              <input name="taluk" type="text" class="form-control" id="taluk" maxlength="70" onKeyUp="dodacheck(this);"/>
          </div>
          </div>

          <div class="form-group ">
          <label for="district" class="control-label col-sm-4">
            District
          </label>
          <div class="col-sm-7">
            <input name="district" type="text" class="form-control" id="district" maxlength="70" onKeyUp="dodacheck(this);"/>
          </div>
          </div>

          <div class="form-group ">
          <label for="state" class="control-label col-sm-4">
            State
          </label>
          <div class="col-sm-7">
            <select name="state" class="form-control" id="state" >
              <option value="">-- Select one --</option>
              <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
    <option value="Andhra Pradesh">Andhra Pradesh</option>
    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
    <option value="Assam">Assam</option>
    <option value="Bihar">Bihar</option>
    <option value="Chandigarh">Chandigarh</option>
    <option value="Chhattisgarh">Chhattisgarh</option>
    <option value="Dadra and Nagar Haveli">Dadra and Nagar Haveli</option>
    <option value="Daman and Diu">Daman and Diu</option>
    <option value="Delhi">Delhi</option>
    <option value="Goa">Goa</option>
    <option value="Gujarat">Gujarat</option>
    <option value="Haryana">Haryana</option>
    <option value="Himachal Pradesh">Himachal Pradesh</option>
    <option value="Jammu and Kashmir">Jammu and Kashmir</option>
    <option value="Jharkhand">Jharkhand</option>
    <option value="Karnataka">Karnataka</option>
    <option value="Kerala">Kerala</option>
    <option value="Lakshadweep">Lakshadweep</option>
    <option value="Madhya Pradesh">Madhya Pradesh</option>
    <option value="Maharashtra">Maharashtra</option>
    <option value="Manipur">Manipur</option>
    <option value="Meghalaya">Meghalaya</option>
    <option value="Mizoram">Mizoram</option>
    <option value="Nagaland">Nagaland</option>
    <option value="Odisha">Odisha</option>
    <option value="Puducherry">Puducherry</option>
    <option value="Punjab">Punjab</option>
    <option value="Rajasthan">Rajasthan</option>
    <option value="Sikkim">Sikkim</option>
    <option value="Tamil Nadu">Tamil Nadu</option>
    <option value="Telangana">Telangana</option>
    <option value="Tripura">Tripura</option>
    <option value="Uttar Pradesh">Uttar Pradesh</option>
    <option value="Uttarakhand">Uttarakhand</option>
    <option value="West Bengal">West Bengal</option>
            </select>
          </div>
          </div>

          <div class="form-group ">
          <label for="pincode" class="control-label col-sm-4">
            Pincode
          </label>
          <div class="col-sm-7">
            <input name="pincode" type="text" class="form-control" id="pincode" maxlength="6" onKeyUp="validatephone(this)"/>
          </div>
          </div>

          </div>
          </div>
          </section>
          </div>

          <?PHP ////////////////////////////////Communication  Address ////////////////////////////// ?>
          <div class="col-sm-4 student_container">
          <section class="panel">
          <header class="panel-heading">
          Communication  Address  <small>(<label title="Same as Permanent Address"><input type="checkbox" id="sameas_pa" value="1" onclick="callAddressCopy()"/> Same as P.Addr.</label>)</small>
          </header>
            <div class="col-sm-12">
          <div class="form">
          <div class="form-group ">
          <label for="c_door_no" class="control-label col-sm-4">
              Door No.
          </label>
          <div class="col-sm-7">
            <input name="c_door_no" type="text" class="form-control" id="c_door_no" size="20" maxlength="155" />
          </div>
          </div>

          <div class="form-group ">
          <label for="c_street" class="control-label col-sm-4">
              Street
          </label>
          <div class="col-sm-7">
            <input name="c_street" type="text" class="form-control" id="c_street" maxlength="255" />
          </div>
          </div>
          <div class="form-group ">
          <label for="c_post" class="control-label col-sm-4">
            Post
          </label>
          <div class="col-sm-7">
          <input name="c_post" type="text" class="form-control" id="c_post" maxlength="70" />
          </div>
          </div>

          <div class="form-group ">
            <label for="c_taluk" class="control-label col-sm-4">
              Taluk
            </label>
            <div class="col-sm-7">
              <input name="c_taluk" type="text" class="form-control" id="c_taluk" maxlength="70" onKeyUp="dodacheck(this);"/>
          </div>
          </div>

          <div class="form-group ">
          <label for="c_district" class="control-label col-sm-4">
            District
          </label>
          <div class="col-sm-7">
            <input name="c_district" type="text" class="form-control" id="c_district" maxlength="70" onKeyUp="dodacheck(this);"/>
          </div>
          </div>

          <div class="form-group ">
          <label for="c_state" class="control-label col-sm-4">
            State
          </label>
          <div class="col-sm-7">
            <select name="c_state" class="form-control" id="c_state" >
              <option value="">-- Select one --</option>
              <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
    <option value="Andhra Pradesh">Andhra Pradesh</option>
    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
    <option value="Assam">Assam</option>
    <option value="Bihar">Bihar</option>
    <option value="Chandigarh">Chandigarh</option>
    <option value="Chhattisgarh">Chhattisgarh</option>
    <option value="Dadra and Nagar Haveli">Dadra and Nagar Haveli</option>
    <option value="Daman and Diu">Daman and Diu</option>
    <option value="Delhi">Delhi</option>
    <option value="Goa">Goa</option>
    <option value="Gujarat">Gujarat</option>
    <option value="Haryana">Haryana</option>
    <option value="Himachal Pradesh">Himachal Pradesh</option>
    <option value="Jammu and Kashmir">Jammu and Kashmir</option>
    <option value="Jharkhand">Jharkhand</option>
    <option value="Karnataka">Karnataka</option>
    <option value="Kerala">Kerala</option>
    <option value="Lakshadweep">Lakshadweep</option>
    <option value="Madhya Pradesh">Madhya Pradesh</option>
    <option value="Maharashtra">Maharashtra</option>
    <option value="Manipur">Manipur</option>
    <option value="Meghalaya">Meghalaya</option>
    <option value="Mizoram">Mizoram</option>
    <option value="Nagaland">Nagaland</option>
    <option value="Odisha">Odisha</option>
    <option value="Puducherry">Puducherry</option>
    <option value="Punjab">Punjab</option>
    <option value="Rajasthan">Rajasthan</option>
    <option value="Sikkim">Sikkim</option>
    <option value="Tamil Nadu">Tamil Nadu</option>
    <option value="Telangana">Telangana</option>
    <option value="Tripura">Tripura</option>
    <option value="Uttar Pradesh">Uttar Pradesh</option>
    <option value="Uttarakhand">Uttarakhand</option>
    <option value="West Bengal">West Bengal</option>
            </select>
          </div>
          </div>

          <div class="form-group ">
          <label for="c_pincode" class="control-label col-sm-4">
            Pincode
          </label>
          <div class="col-sm-7">
            <input name="c_pincode" type="text" class="form-control" id="c_pincode" maxlength="6" onKeyUp="validatephone(this)"/>
          </div>
          </div>

          </div>
          </div>
          </section>
          </div>

        </div>
        <div class="row">
        	<div class="col-sm-4 student_container1">
        <section class="panel">
        <header class="panel-heading">
       Bank Details
        </header>
          <div class="col-sm-12">
        <div class="form">
        <div class="form-group ">
        <label for="b_ac_no"  class="control-label col-sm-5">
       A/c No.
        </label>
        <div class="col-sm-7">
        <input name="b_ac_no" type="text"  class="form-control" id="b_ac_no"  maxlength="255" />
        </div>
        </div>

        <div class="form-group ">
        <label for="b_ac_name" class="control-label col-sm-5">
         A/c Name
        </label>
        <div class="col-sm-7">
      <input name="b_ac_name" type="text" class="form-control" id="b_ac_name" maxlength="70"  />
        </div>
        </div>
        <div class="form-group ">
        <label for="b_name" class="control-label col-sm-5">
      Bank Name
        </label>
        <div class="col-sm-7">

             <select name="b_name" id="b_name"  class="form-control" >
                  <option value="" >--Select--</option>
    	  <?
    		$sql_section='SELECT * FROM  edu_setup_tb WHERE category="Bank"  AND del=1 ORDER BY category_order ASC';
    		$result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
    		while(($row_section=mysqli_fetch_array($result_section))!=false)
    		{
    				$s_id=$row_section['id'];
    				$category_name=$row_section['category_name'];
    				$category_sname=$row_section['category_sname'];
    				$category_name=stripslashes($category_name);
    				$category_sname=stripslashes($category_sname); 
    			echo "<option value='$s_id' >".htmlentities($category_name,ENT_QUOTES)."</option>";
    		}
    	?>
    	  </select>

        </div>
        </div>

        <div class="form-group ">
        <label  for="b_branch" class="control-label col-sm-5">
         Branch
        </label>
        <div class="col-sm-7">
          <input name="b_branch" type="text" class="form-control" id="b_branch"  maxlength="70" />
        </div>
        </div>

        <div class="form-group ">
        <label for="b_ifsc" class="control-label col-sm-5">
         IFSC Code
        </label>
        <div class="col-sm-7">
        <input name="b_ifsc" type="text" class="form-control" id="b_ifsc"  maxlength="70"/>
        </div>
        </div>

        <div class="form-group " style="display:none;">
        <label  for="pan_no" class="control-label col-sm-5">
         PAN No.
        </label>
        <div class="col-sm-7">
          <input name="pan_no" type="text" class="form-control" id="pan_no"  maxlength="70" />
        </div>
        </div>
        </div>
        </div>
        </section>
        </div>
          <?PHP ////////////////////////////////Mark Sheet ////////////////////////////// ?>
          <div class="col-sm-8 student_container2">
          <section class="panel">
          <header class="panel-heading">
          Mark Sheet
          </header>
            <div class="col-sm-12">
          <div class="form">
          <div class="form-group ">
            <table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered" id="markSheetTable">
             <tr bgcolor="#CCCCCC">
             <td width="10%" >S.No.</td>
             <td width="20%" > Class/Program</td>
             <td width="30%" > Board/University</td>
             <td width="15%"  nowrap> Register No.</td>
             <td width="15%"  nowrap> Passed Out</td>
             <td width="10%"  nowrap> %</td>
             </tr>
             <tr>
             <td height="30" valign="middle" nowrap="nowrap">1</td>
             <td valign="middle" nowrap="nowrap"><select name="prgm_name[]" id="prgm_name[]" class="form-control"><option value="">--Select--</option><option value="X">10th</option><option value="XII">12th</option><option value="NEET">NEET</option><option value="U.G">U.G</option><option value="P.G">P.G</option><option value="Other">Other</option> </select></td>
             <td valign="middle" nowrap="nowrap"><input name="pgm_board[]" id="pgm_board[]" class="form-control" type="text" maxlength="155" /></td>
             <td valign="middle" nowrap="nowrap"><input name="creg_no[]" id="creg_no[]" class="form-control" type="text"  maxlength="70" /></td>
             <td valign="middle" nowrap="nowrap"><input name="passed_out[]" id="passed_out[]" class="form-control" type="text"  maxlength="4" placeholder="YYYY" /></td>
             <td valign="middle" nowrap="nowrap"><input name="ctotal[]" id="ctotal[]" class="form-control" type="text"   maxlength="5" /></td>
               </tr>
           </table>

          <div class="col-sm-12 text-right">
            <input name="button3" type="button" class="btn btn-sm btn-info" onclick="addNewRow()" value="+" />
          </div>
          </div>



          <div class="form-group ">
          <label  class="control-label col-sm-5">
          </label>
          </div>

          </div>
          </div>
          </section>
          </div>
          <?PHP ////////////////////////////////Identification Mark /////////////////////////////
            /* 
          <div class="col-sm-4 student_container2" >
          <section class="panel">
          <header class="panel-heading">
          Identification Mark
          </header>
            <div class="col-sm-12">
          <div class="form">
          <div class="form-group ">
          <label for="pi_mark1" class="control-label col-sm-5">
              PI Mark1
          </label>
          <div class="col-sm-12">
            <textarea name="pi_mark1" class="form-control" id="pi_mark1"></textarea>
          </div>
          </div>
          <div class="form-group ">
          <label for="pi_mark2" class="control-label col-sm-5">
              PI Mark1
          </label>
          <div class="col-sm-12">
            <textarea name="pi_mark2" class="form-control" id="pi_mark2"></textarea>
          </div>
          </div>


          <div class="form-group ">
          <label  class="control-label col-sm-5">
          </label>
          </div>
          </div>
          </div>
          </section>
          </div>
            */  ?>
            
        </div>
        <div class="row">

          <div class="col-sm-12">
          <section class="panel">
          <div class="col-sm-offset-2 col-sm-10 padding-tb15">
                <button class="btn btn-lg btn-danger" name="Submit" type="submit" value="Update">Create New Profile</button>
                <input type="hidden" name="form_reset" value="<?PHP echo date('His').rand(0000,1111);?>" />
          </div>
          </section>
          </div>
        </div>
        </form>
  </div>
  <?PHP   echo $report ?>
  </aside>
  </div>
  </section>
  </section>
  <!--main content end-->
  </section>
  <span id="update_script">  </span>
   <?PHP   echo $basic_js_details_array['basic'].$basic_js_details_array['color_picker'].$basic_js_details_array['date_picker']; ?>

   <script src="student_profile.js?v=4" type="text/javascript"></script>
  </body>
</html>
