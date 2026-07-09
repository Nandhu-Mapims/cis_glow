<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
include_once('widget.php');
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
if($_SERVER['REQUEST_METHOD']=='GET')
{
$search_str=$_GET['search_str'];
$flag=$_GET['flag'];
$sql_c_academic='SELECT * FROM basic_setup_tb WHERE del=1 AND del=1';
$result_c_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_c_academic);
$row_c_academic=mysqli_fetch_array($result_c_academic);
$academic_year_array['U.G']=$row_c_academic['ug_academic_year'];
$academic_year_array['P.G']=$row_c_academic['pg_academic_year'];
if($flag==1)
{
echo searchByRollNo($search_str, 1,  $student_id);
}
else if($flag==2)
{
echo searchByRollNo($search_str, 2,  $student_id);
}
else if($flag==3)
{
$s_id=$_GET['sid'];
$student_subject_details=call_exam_subject_details($s_id);
if($student_subject_details=='')
$student_subject_details="<p class='wrong'>No details found...</p>";
echo $student_subject_details;
}
}

function searchByRollNo($search_input, $soption, $student_id)
{
  $sql_sub='';
  if($soption==1 && $search_input)
  {
  $search_input_temp=explode(',',$search_input);
  for($i=0;$i<sizeof($search_input_temp);$i++)
  {
  $search_input_temp[$i]=trim($search_input_temp[$i]);
  if($search_input_temp[$i]!='')
  {
  $search_input_list.= ' register_no="'.$search_input_temp[$i].'" OR';
  }
  }
  if($search_input_list)
  {
  $search_input_list=substr($search_input_list,0,-2);
  $search_input_list=" AND ( $search_input_list ) ";
  $sql_sub="SELECT * FROM student_profile_tb WHERE del=1  $search_input_list ORDER BY student_name ASC, student_initial ASC";
  }
  }
  else if($soption==2 && $search_input)
  {
    $ref_search_course_temp=explode('___',$search_input);
    $search_course=$ref_search_course_temp[0];
    $s_admission_year=$ref_search_course_temp[1];
    if($search_course && $search_course)
    {
      $sql_sub="SELECT * FROM student_profile_tb WHERE del=1 AND course_id='$search_course' AND academic_year='$s_admission_year' ORDER BY   student_name ASC, student_initial ASC";
    }
  }
  $student_subject_details='';
  if($sql_sub)
  {
  $result_sub=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_sub);
  $counter=0;
  while(($row_section=mysqli_fetch_array($result_sub))!=false)
    {
        $s_id=$row_section['id'];
  			$admission_no=$row_section['admission_no'];
  			$academic_year=$row_section['academic_year'];
  			$register_no=$row_section['register_no'];
  			$student_name=$row_section['student_name'];
  			$student_initial=$row_section['student_initial'];
  			$student_name=stripslashes($student_name);
  			$student_initial=stripslashes($student_initial);
        $st_color='';
  			if(($counter==0 && $student_id=='') || ($student_id==$s_id))
  			{
  			$student_subject_details=call_exam_subject_details($s_id);
        $st_color=' style="color:#7AB12C;"';
  			}
  			$subject_details.='<button type="button" onclick="getStudent(\''.$s_id.'\')" id="st_'.$s_id.'" class="btn_result" '.$st_color.'>'.$register_no.' - '.$student_name.' '.$student_initial.'</button>';
  			$counter++;
    }
  }

  if($student_subject_details=='')
  $student_subject_details="<p class='text-danger'>No details found...</p>";
  return $subject_details."^^^^^".$student_subject_details;
}


function call_exam_subject_details($s_id)
{
$sql_stu="SELECT * FROM student_profile_tb WHERE del=1 and id='$s_id' ";
$result_stu=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_stu);

if(mysqli_num_rows($result_stu)>0)
{
  $row_stu=mysqli_fetch_array($result_stu);
  $u_sid=$row_stu['id'];
  $u_admission_no=$row_stu['admission_no'];
  $u_admission_date=$row_stu['admission_date'];
  $u_academic_year=$row_stu['academic_year'];
  $u_admission_source=$row_stu['admission_source'];
  $u_course_id=$row_stu['course_id'];
  $u_uregister_no=$row_stu['uregister_no'];
  $u_bregister_no=$row_stu['bregister_no'];
  $u_register_no=$row_stu['register_no'];
  $u_student_title=$row_stu['student_title'];
  $u_student_name=$row_stu['student_name'];
  $u_student_initial=$row_stu['student_initial'];
  $u_father_name=$row_stu['father_name'];
  $u_father_occupation=$row_stu['father_occupation'];
  $u_father_income=$row_stu['father_income'];
  $u_mother_name=$row_stu['mother_name'];
  $u_mother_occupation=$row_stu['mother_occupation'];
  $u_mother_income=$row_stu['mother_income'];
  $u_student_gender=$row_stu['student_gender'];
  $u_student_dob=$row_stu['student_dob'];
  $u_student_bg=$row_stu['student_bg'];
  $u_student_religion=$row_stu['student_religion'];
  $u_student_caste=$row_stu['student_caste'];
  $u_student_community=$row_stu['student_community'];
  $u_student_nationality=$row_stu['student_nationality'];
  $u_door_no=$row_stu['door_no'];
  $u_street=$row_stu['street'];
  $u_post=$row_stu['post'];
  $u_taluk=$row_stu['taluk'];
  $u_district=$row_stu['district'];
  $u_state=$row_stu['state'];
  $u_pincode=$row_stu['pincode'];
  $u_mobile_no=$row_stu['mobile_no'];
  $u_contact_no=$row_stu['contact_no'];
  $u_father_mobile_1=$row_stu['father_mobile_1'];
  $u_institution_email=$row_stu['institution_email'];
  $u_personal_email=$row_stu['personal_email'];
  $u_guardian_name=$row_stu['guardian_name'];
  $u_guardian_no=$row_stu['guardian_no'];
  $u_guardian_email=$row_stu['guardian_email'];
  $u_guardian_address=$row_stu['guardian_address'];
  $u_guardian_city=$row_stu['guardian_city'];
  $u_first_graduate=$row_stu['first_graduate'];
  $u_acmec_trust=$row_stu['acmec_trust'];
  $u_student_photo =$row_stu['student_photo'];
  $u_acmec_scholorship=$row_stu['acmec_scholorship'];
  $u_scholar_ship=$row_stu['scholar_ship'];
  $u_caste_scholar_ship=$row_stu['caste_scholar_ship'];

  $u_application_no=$row_stu['application_no'];
  $u_father_title=$row_stu['father_title'];
  $u_mother_title=$row_stu['mother_title'];
  $u_donate_blood=$row_stu['donate_blood'];
  $u_staying_with=$row_stu['staying_with'];
  $u_guardian_relation=$row_stu['guardian_relation'];
  $u_guardian_pincode=$row_stu['guardian_pincode'];
  $u_mother_mobile=$row_stu['mother_mobile'];
  $u_father_email=$row_stu['father_email'];

  $persional_identification=$row_stu['persional_identification'];
  $persional_identification_1=$row_stu['persional_identification_1'];

  $u_c_door_no=$row_stu['c_door_no'];
  $u_c_street=$row_stu['c_street'];
  $u_c_post=$row_stu['c_post'];
  $u_c_taluk=$row_stu['c_taluk'];
  $u_c_district=$row_stu['c_district'];
  $u_c_state=$row_stu['c_state'];
  $u_c_pincode=$row_stu['c_pincode'];

  $tc_apply_date=$row_stu['tc_apply_date'];
  $tc_issue_date=$row_stu['tc_issue_date'];
  $releaving_date=$row_stu['releaving_date'];
  $releaving_info=$row_stu['releaving_info'];
  $releaving_year=$row_stu['releaving_year'];
  $cri_status=$row_stu['cri_status'];

  $u_tf_receipt_date=$row_stu['tf_receipt_date']; 
  $u_tf_receipt_no=$row_stu['tf_receipt_no']; 
  $u_tf_amount=$row_stu['tf_amount'];
  $u_acmec_amount=$row_stu['acmec_amount'];
  $u_acmec_approved=$row_stu['acmec_approved'];
  $u_aadhar_no=$row_stu['aadhar_no'];
  $u_ar_number=$row_stu['ar_number'];
  $u_ar_rank=$row_stu['ar_rank'];
  $u_neet_roll_no=$row_stu['neet_roll_no'];
  $u_neet_score=$row_stu['neet_score'];
  $u_pan_no=$row_stu['pan_no'];
  $u_pan_name=$row_stu['pan_name'];
  
  $b_ac_no=$row_stu['b_ac_no'];
$b_ac_name =$row_stu['b_ac_name'];
$b_name =$row_stu['b_name'];
$b_branch=$row_stu['b_branch'];
$b_ifsc=$row_stu['b_ifsc'];

$u_emis_no=$row_stu['emis_no'];
$u_umis_no=$row_stu['umis_no'];

  $persional_identification=stripslashes($persional_identification);
  $persional_identification_1=stripslashes($persional_identification_1);
  
  $u_tf_receipt_no=stripslashes($u_tf_receipt_no);
  $u_tf_amount=stripslashes($u_tf_amount);
  if($u_tf_receipt_date  && $u_tf_receipt_date!='0000-00-00')
  $u_tf_receipt_date=date('d-m-Y',strtotime($u_tf_receipt_date));
  else
  $u_tf_receipt_date='';
    

  if($u_student_dob  && $u_student_dob!='0000-00-00')
  $u_student_dob=date('d-m-Y',strtotime($u_student_dob));
  else
  $u_student_dob='';

  if($u_admission_date  && $u_admission_date!='0000-00-00')
  $u_admission_date=date('d-m-Y',strtotime($u_admission_date));
  else
  $u_admission_date='';

  if($tc_issue_date  && $tc_issue_date!='0000-00-00')
  $tc_issue_date=date('d-m-Y',strtotime($tc_issue_date));
  else
  $tc_issue_date='';

  if($releaving_date  && $releaving_date!='0000-00-00')
  $releaving_date=date('d-m-Y',strtotime($releaving_date));
  else
  $releaving_date='';

  if($tc_apply_date  && $tc_apply_date!='0000-00-00')
  $tc_apply_date=date('d-m-Y',strtotime($tc_apply_date));
  else
  $tc_apply_date='';


  if(strtolower($releaving_info)=="discontinued")
  {
  $leaving_reason_details='<label><input name="leaving_reason" type="radio" id="leaving_reason" value="completed"  onclick="document.getElementById(\'discontinued_year\').style.visibility=\'hidden\'"> Comp. </label> <label> <input name="leaving_reason" type="radio" id="leaving_reason" value="discontinued" checked="checked" onclick="document.getElementById(\'discontinued_year\').style.visibility=\'visible\'"> Disc. </label>';
  $releaving_year_style='visible';
  }
  else
  {
  $leaving_reason_details='<label><input name="leaving_reason" type="radio" id="leaving_reason" value="completed" checked="checked" onclick="document.getElementById(\'discontinued_year\').style.visibility=\'hidden\'"> Comp. </label> <label> <input name="leaving_reason" type="radio" id="leaving_reason" value="discontinued" onclick="document.getElementById(\'discontinued_year\').style.visibility=\'visible\'"> Disc. </label>';
  $releaving_year='';
  $releaving_year_style='hidden';
  }

  $releaving_year_details='<select name="discontinued_year"  id="discontinued_year" class="form-control" style="visibility:'.$releaving_year_style.';">';
  for($y=1;$y<5;$y++)
  {
  if($y==$releaving_year)
  {
  $releaving_year_details.='<option value="'.$y.'" selected="selected">'.$y.'</option>';
  }
  else
  {
  $releaving_year_details.='<option value="'.$y.'">'.$y.'</option>';
  }
  }
  $releaving_year_details.='</select>';


  $u_sid=stripslashes($u_sid);
  $u_admission_no=stripslashes($u_admission_no);
  $u_academic_year=stripslashes($u_academic_year);
  $u_admission_source=stripslashes($u_admission_source);
  $u_course_id=stripslashes($u_course_id);
  $u_uregister_no=stripslashes($u_uregister_no);
  $u_bregister_no=stripslashes($u_bregister_no);
  $u_register_no=stripslashes($u_register_no);
  $u_student_title=stripslashes($u_student_title);
  $u_student_name=stripslashes($u_student_name);
  $u_student_initial=stripslashes($u_student_initial);
  $u_father_name=stripslashes($u_father_name);
  $u_father_occupation=stripslashes($u_father_occupation);
  $u_father_income=stripslashes($u_father_income);
  $u_mother_name=stripslashes($u_mother_name);
  $u_mother_occupation=stripslashes($u_mother_occupation);
  $u_mother_income=stripslashes($u_mother_income);
  $u_student_gender=stripslashes($u_student_gender);
  $u_student_bg=stripslashes($u_student_bg);
  $u_student_religion=stripslashes($u_student_religion);
  $u_student_caste=stripslashes($u_student_caste);
  $u_student_community=stripslashes($u_student_community);
  $u_student_nationality=stripslashes($u_student_nationality);
  $u_door_no=stripslashes($u_door_no);
  $u_street=stripslashes($u_street);
  $u_post=stripslashes($u_post);
  $u_taluk=stripslashes($u_taluk);
  $u_district=stripslashes($u_district);
  $u_state=stripslashes($u_state);
  $u_pincode=stripslashes($u_pincode);
  $u_mobile_no=stripslashes($u_mobile_no);
  $u_contact_no=stripslashes($u_contact_no);
  $u_father_mobile_1=stripslashes($u_father_mobile_1);
  $u_institution_email=stripslashes($u_institution_email);
  $u_personal_email=stripslashes($u_personal_email);
  $u_guardian_name=stripslashes($u_guardian_name);
  $u_guardian_no=stripslashes($u_guardian_no);
  $u_guardian_email=stripslashes($u_guardian_email);
  $u_guardian_address=stripslashes($u_guardian_address);
  $u_guardian_city=stripslashes($u_guardian_city);
  $u_first_graduate=stripslashes($u_first_graduate);
  $u_acmec_trust=stripslashes($u_acmec_trust);
  $u_student_photo=stripslashes($u_student_photo);
  $u_acmec_scholorship=stripslashes($u_acmec_scholorship);
  $u_scholar_ship=stripslashes($u_scholar_ship);
  $u_caste_scholar_ship=stripslashes($u_caste_scholar_ship);


  $u_c_door_no=stripslashes($u_c_door_no);
  $u_c_street=stripslashes($u_c_street);
  $u_c_post=stripslashes($u_c_post);
  $u_c_taluk=stripslashes($u_c_taluk);
  $u_c_district=stripslashes($u_c_district);
  $u_c_state=stripslashes($u_c_state);
  $u_c_pincode=stripslashes($u_c_pincode);

  $u_application_no=stripslashes($u_application_no);
  $u_father_title=stripslashes($u_father_title);
  $u_mother_title=stripslashes($u_mother_title);
  $u_donate_blood=stripslashes($u_donate_blood);
  $u_staying_with=stripslashes($u_staying_with);
  $u_guardian_relation=stripslashes($u_guardian_relation);
  $u_guardian_pincode=stripslashes($u_guardian_pincode);
  $u_mother_mobile=stripslashes($u_mother_mobile);
  $u_father_email=stripslashes($u_father_email);
  $u_ar_number=stripslashes($u_ar_number);
  $u_ar_rank=stripslashes($u_ar_rank);
  $u_neet_roll_no=stripslashes($u_neet_roll_no);
  $u_neet_score=stripslashes($u_neet_score);
  
  $b_ac_no=stripslashes($b_ac_no);
$b_ac_name=stripslashes($b_ac_name);
$b_name=stripslashes($b_name);
$b_branch=stripslashes($b_branch);
$b_ifsc=stripslashes($b_ifsc);
$staff_caste=stripslashes($staff_caste);


  $sql_section='SELECT * FROM basic_setup_course_tb WHERE id="'.$u_course_id.'" ';
 $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
 $row_section=mysqli_fetch_array($result_section);
 $bs_course_name=$row_section['course_name'];

$path1="student_idcard/".$u_register_no.".png";
if(file_exists($path1))
$student_photo_link="<img src='$path1' width=100 height=120 />";



$final_student_profile='
<div class="row">
<input id="student_id" name="student_id" type="hidden" value="'.$u_sid.'" />';
////////////////////////////////Admission //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container">
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
  <input class="form-control" id="application_no" name="application_no" maxlength="20"  type="text" value="'.$u_application_no.'"  />
</div>
</div>

<div class="form-group ">
<label for="admission_no" class="control-label col-sm-4">
    Admission No <span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <input class="form-control" id="admission_no" name="admission_no" maxlength="20"   type="text" required value="'.$u_admission_no.'"  />
</div>
</div>
<div class="form-group ">
<label for="joined_date" class="control-label col-sm-4">
  Admission Date<span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <input class="calendar form-control" id="joined_date" name="joined_date" maxlength="10" value="'.$u_admission_date.'"  type="text" required />
</div>
</div>

<div class="form-group ">
<label  class="control-label col-sm-4">
  Source
</label>
<div class="col-sm-8">';

    $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Quota"  AND del!=0 AND id!=115 AND id!=116 ORDER BY category_order ASC');

    while(($row_section=mysqli_fetch_array($sql_section))!=false)
   {
    $s_id=$row_section['id'];
    $category_name=$row_section['category_name'];
    $category_sname=$row_section['category_sname'];
    $fchecked='';
    if($u_admission_source==$s_id || $u_admission_source=='')
    {
      $u_admission_source=$s_id;
      $fchecked=' checked ';
    }
    $final_student_profile.="<label><input type='radio' name='admission_source' $fchecked value='$s_id'> ".stripslashes($category_sname)." </label>";
   }

$final_student_profile.='</div>
</div>

<div class="form-group ">
<label for="a_year" class="control-label col-sm-4">
  Batch <span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
<input type="hidden" name="hd_adm_year" value="'.$u_academic_year.'"/>
  <select name="a_year" id="a_year" onchange="call_course_name()" class="form-control">
<option value="">--Select one--</option>';
      $sql_academic='SELECT * FROM basic_setup_course_tb ORDER BY year_of_start ASC';
      $result_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_academic);
      $row_academic=mysqli_fetch_array($result_academic);
      $e_year=$row_academic['year_of_start'];
      for($i=date('Y');$i>=$e_year;$i--)
      {
      $a_year=$i.'-'.($i+1);
      if($u_academic_year==$a_year)
      $final_student_profile.='<option value="'.$a_year.'" selected="selected" >'.$a_year.'</option>';
      else
      $final_student_profile.='<option value="'.$a_year.'">'.$a_year.'</option>';
      }
  $final_student_profile.='</select>
</div>
</div>

<div class="form-group ">
<label for="course_name" class="control-label col-sm-4">
  Degree<span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <select name="course_name" id="course_name" class="form-control" onchange="call_course_name()" disabled>
    <option value="">--Select one--</option>';

  $sql_academic='SELECT DISTINCT(course_name) FROM basic_setup_course_tb WHERE del=1  ORDER BY c_order ASC';
  $result_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_academic);
  while(($row_academic=mysqli_fetch_array($result_academic))!=false)
  {
  $course_name=$row_academic['course_name'];
  if($bs_course_name==$course_name)
  $final_student_profile.='<option value="'.$course_name.'" selected>'.$course_name.'</option>';
  else
  $final_student_profile.='<option value="'.$course_name.'">'.$course_name.'</option>';
  }
  $final_student_profile.='</select>
</div>
</div>
<div class="form-group ">
<label for="degree_name" class="control-label col-sm-4">
  Course <span class="text-danger" >*</span>
</label>
<div class="col-sm-7" id="degree_span">
<select name="degree_name" id="degree_name" class="form-control" disabled>
<option value="" >--Select one--</option>';

$sql_section='SELECT * FROM basic_setup_course_tb WHERE  course_name="'.$bs_course_name.'" AND del=1 ORDER BY c_order ASC';
  $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
  while(($row_section=mysqli_fetch_array($result_section))!=false)
    {
     $c_id=$row_section['id'];
     $full_part_time=$row_section['full_part_time'];
     $degree_name=$row_section['degree_name'];
     $degree_short_name=$row_section['degree_short_name'];
     $department_name=$row_section['department_name'];
     $department_short_name=$row_section['department_short_name'];
     $year_of_start=$row_section['year_of_start'];
     $course_duration=$row_section['course_duration'];


     $degree_name=stripslashes($degree_name);
     $course_duration=stripslashes($course_duration);
     $department_name=stripslashes($department_name);
     $full_part_time=stripslashes($full_part_time);

     if(trim($department_name)!='' && trim($department_name)!='-')
     $department_name=' - '.$department_name;
     else
     $department_name='';
if($u_course_id==$c_id)
$final_student_profile.='<option value="'.$c_id.'" selected>'.$degree_name.$department_name.' | '.$full_part_time.' ('.$course_duration.' Years)</option>';
else
$final_student_profile.='<option value="'.$c_id.'" >'.$degree_name.$department_name.' | '.$full_part_time.' ('.$course_duration.' Years)</option>';

    }
$final_student_profile.='
</select>
</div>
</div>

<div class="form-group ">
<label for="ar_number" class="control-label col-sm-4">
    AR No 
</label>
<div class="col-sm-7">
  <input class="form-control" id="ar_number" name="ar_number" maxlength="20"   type="text"  value="'.$u_ar_number.'"  />
</div>
</div>
<div class="form-group ">
<label for="ar_rank" class="control-label col-sm-4">
  Rank
</label>
<div class="col-sm-7">
  <input class="form-control" id="ar_rank" name="ar_rank" maxlength="20" value="'.$u_ar_rank.'"  type="text"  />
</div>
</div>
<div class="form-group ">
<label for="neet_roll_no" class="control-label col-sm-4">
  NEET Roll No
</label>
<div class="col-sm-7">
  <input class="form-control" id="neet_roll_no" name="neet_roll_no" maxlength="20" value="'.$u_neet_roll_no.'"  type="text"  />
</div>
</div>
<div class="form-group ">
<label for="neet_score" class="control-label col-sm-4">
  NEET Score
</label>
<div class="col-sm-7">
  <input class="form-control" id="neet_score" name="neet_score" maxlength="20" value="'.$u_neet_score.'"  type="text"  />
</div>
</div>






</div>
</div>
</section>
</div>';

 ////////////////////////////////Register //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container">
<section class="panel r1">
<header class="panel-heading">
Personal 1
</header>
  <div class="col-sm-12">
<div class="form">
<div class="form-group ">
<label  class="control-label col-sm-4">
  Student  Title
</label>
<div class="col-sm-7">';

    $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Student Title"  AND del!=0 ORDER BY category_order ASC');
    while(($row_section=mysqli_fetch_array($sql_section))!=false)
   {
    $s_id=$row_section['id'];
    $category_name=$row_section['category_name'];
    $category_sname=$row_section['category_sname'];
    $fchecked='';
    if(strtolower($u_student_title)==strtolower($category_name))
    $fchecked=' checked ';
    $final_student_profile.="<label><input type='radio'  name='student_title' $fchecked value='$category_name'> ".stripslashes($category_name)."  </label> ";
   }
$final_student_profile.='</div>
</div>

<div class="form-group ">
<label for="student_name" class="control-label col-sm-4">
  Student  Name <span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <input class="form-control" id="student_name" name="student_name" maxlength="155"   type="text" value="'.$u_student_name.'" required />
</div>
</div>
<div class="form-group ">
<label for="student_initial" class="control-label col-sm-4">
Student  Initial
</label>
<div class="col-sm-7">
  <input class="form-control" id="student_initial" name="student_initial" maxlength="20" type="text" value="'.$u_student_initial.'" />
</div>
</div>

<div class="form-group ">
<label  class="control-label col-sm-4">
  Father\'s Name Title
</label>
<div class="col-sm-7">';

    $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Parent Title"  AND del!=0 ORDER BY category_order ASC');
    $fchecked=' checked ';
    $mother_title_str='';
    while(($row_section=mysqli_fetch_array($sql_section))!=false)
   {
    $s_id=$row_section['id'];
    $category_name=$row_section['category_name'];
    $category_sname=$row_section['category_sname'];
    $fchecked='';
    if(strtolower($u_father_title)==strtolower($category_name))
    $fchecked=' checked ';
    $final_student_profile.="<label><input type='radio'  name='father_title' $fchecked value='$category_name'> ".stripslashes($category_name)."  </label> ";

    $fchecked='';
    if(strtolower($u_mother_title)==strtolower($category_name))
    $fchecked=' checked ';
    $mother_title_str.="<label><input type='radio'  name='mother_title' $fchecked value='$category_name'>  ".stripslashes($category_name)." </label> ";
   }

$final_student_profile.='</div>
</div>
<div class="form-group ">
<label for="father_name" class="control-label col-sm-4">
  Father\'s Name
</label>
<div class="col-sm-7">
    <input class="form-control" id="father_name" name="father_name" maxlength="155"   type="text" value="'.$u_father_name.'"   />
</div>
</div>

<div class="form-group ">
<label  class="control-label col-sm-4">
  Mother\'s Name Title
</label>
<div class="col-sm-7">
'.$mother_title_str.'

</div>
</div>

<div class="form-group ">
<label for="mother_name" class="control-label col-sm-4">
  Mother\'s Name
</label>
<div class="col-sm-7">
    <input class="form-control" id="mother_name" name="mother_name" maxlength="155"   type="text"  value="'.$u_mother_name.'"  />
</div>
</div>

<div class="form-group ">
<label for="aadhar_no" class="control-label col-sm-4">
  Aadhar No. <span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
    <input class="form-control" id="aadhar_no" name="aadhar_no" maxlength="12" value="'.$u_aadhar_no.'"  type="text"    />
</div>
</div>
<div class="form-group ">
<label for="roll_no" class="control-label col-sm-4">
    Roll No.<span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <input class="form-control" id="roll_no" name="roll_no" maxlength="20"  type="text" value="'.$u_register_no.'" readonly="true"  required />
</div>
</div>


<div class="form-group ">
<label for="register_no" class="control-label col-sm-4">
    Biometric R.No.
</label>
<div class="col-sm-7">
  <input class="form-control" id="bregister_no" name="bregister_no" maxlength="20"   type="text" value="'.$u_bregister_no.'"  />
</div>
</div>

<div class="form-group ">
<label for="register_no" class="control-label col-sm-4">
    Register No.
</label>
<div class="col-sm-7">
  <input class="form-control" id="register_no" name="register_no" maxlength="20"   type="text" value="'.$u_uregister_no.'" />
</div>
</div>

<div class="form-group ">
            <label for="ar_number" class="control-label col-sm-4">
                EMIS No. 
            </label>
            <div class="col-sm-7">
              <input class="form-control" id="emis_number" name="emis_number" maxlength="20"   type="text" value="'.$u_emis_no.'"  />
            </div>
        </div>
        
        <div class="form-group ">
            <label for="ar_number" class="control-label col-sm-4">
                UMIS No. 
            </label>
            <div class="col-sm-7">
              <input class="form-control" id="umis_number" name="umis_number" maxlength="20"   type="text" value="'.$u_umis_no.'" />
            </div>
        </div>


</div>
</div>
</section>
</div></div>
<div class="row">';
////////////////////////////////Personal 2//////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container1">
<section class="panel">
<header class="panel-heading">
Personal 2
</header>
  <div class="col-sm-12">
<div class="form">
<div class="form-group ">
<label class="control-label col-sm-4">
    Gender
</label>
<div class="col-sm-7">';
$g1=$g2=$g3='';
if(strtolower($u_student_gender)=='transgender')
$g3=' checked ';
else if(strtolower($u_student_gender)=='female')
$g2=' checked ';
else
$g1=' checked ';

$final_student_profile.='
  <label>    <input name="student_gender" type="radio" value="Male" '.$g1.' />
     Male</label>
  <label>  <input name="student_gender" type="radio" value="Female" '.$g2.' />
      Female </label>
   <label>  <input name="student_gender" type="radio" value="Transgender" '.$g3.' />
       Trans </label>
</div>
</div>

<div class="form-group ">
<label for="d_o_b" class="control-label col-sm-4">
    DOB
</label>
<div class="col-sm-7">
  <input class="form-control calendar" id="d_o_b" name="d_o_b" maxlength="20" value="'.$u_student_dob.'"  type="text"  />
</div>
</div>
<div class="form-group ">
<label for="blood_group" class="control-label col-sm-4">
  BG
</label>
<div class="col-sm-7">
  <select name="blood_group" class="form-control" id="blood_group">
    <option value="">-- Select one --</option>';

    $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="BloodGroup"  AND del!=0 ORDER BY category_order ASC');
    while(($row_section=mysqli_fetch_array($sql_section))!=false)
   {
    $s_id=$row_section['id'];
    $category_name=$row_section['category_name'];
    $category_sname=$row_section['category_sname'];
 if($u_student_bg==$s_id)
  $final_student_profile.="<option value='$s_id' selected>".stripslashes($category_name)."</option>";
  else
    $final_student_profile.="<option value='$s_id'>".stripslashes($category_name)."</option>";
   }
$final_student_profile.='
  </select>
</div>
</div>

<div class="form-group ">
  <label for="donate_blood" class="control-label col-sm-4">
    Willingness to donate Blood
  </label>
  <div class="col-sm-7">
    <label>  <input name="donate_blood" id="donate_blood" type="checkbox" value="1" '.($u_donate_blood==1?'checked':'').' />
  Yes</label>
</div>
</div>

<div class="form-group ">
<label for="religion" class="control-label col-sm-4">
  Religion
</label>
<div class="col-sm-7">
  <select name="religion" class="form-control" id="religion">
    <option value="">-- Select one --</option>';

      $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Religion"  AND del!=0 ORDER BY category_order ASC');
      while(($row_section=mysqli_fetch_array($sql_section))!=false)
     {
      $s_id=$row_section['id'];
      $category_name=$row_section['category_name'];
      $category_sname=$row_section['category_sname'];
      if($u_student_religion==$s_id)
    $final_student_profile.="<option value='$s_id' selected>".stripslashes($category_name)."</option>";
    else
  $final_student_profile.="<option value='$s_id'>".stripslashes($category_name)."</option>";
     }
$final_student_profile.='
  </select>
</div>
</div>

<div class="form-group ">
<label for="community" class="control-label col-sm-4">
  Community
</label>
<div class="col-sm-7">
  <select name="community" class="form-control" id="community">
    <option value="">-- Select one --</option>';

      $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Community"  AND del!=0 ORDER BY category_order ASC');
      while(($row_section=mysqli_fetch_array($sql_section))!=false)
     {
      $s_id=$row_section['id'];
      $category_name=$row_section['category_name'];
      $category_sname=$row_section['category_sname'];
      if($u_student_community==$s_id)
    $final_student_profile.="<option value='$s_id' selected>".stripslashes($category_name)."</option>";
    else
  $final_student_profile.="<option value='$s_id'>".stripslashes($category_name)."</option>";
     }
$final_student_profile.='
  </select>
</div>
</div>

<div class="form-group ">
<label for="caste" class="control-label col-sm-4">
  Caste
</label>
<div class="col-sm-7">
  <input name="caste" type="text" class="form-control" id="caste" maxlength="70" onKeyUp="dodacheck(this);"   value="'.$u_student_caste.'"/>
</div>
</div>

<div class="form-group ">
<label for="caste" class="control-label col-sm-4">
  Nationality
</label>
<div class="col-sm-7">
  <input name="nationality" type="text" class="form-control" id="nationality" maxlength="70" onKeyUp="dodacheck(this);" value="'.$u_student_nationality.'" />
</div>
</div>


</div>
</div>
</section>


</div>

';
////////////////////////////////Scholarship //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container1">
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
          <input class="form-control calendar" id="tf_receipt_date" name="tf_receipt_date" maxlength="10" type="text"  value="'.$u_tf_receipt_date.'" />
        </div>
        </div> 
            
            <div class="form-group ">
        <label for="tf_receipt_no" class="control-label col-sm-4">
            Receipt No.
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="tf_receipt_no" name="tf_receipt_no" maxlength="30" type="text" value="'.$u_tf_receipt_no.'" />
        </div>
        </div>

        <div class="form-group ">
        <label for="tf_amount" class="control-label col-sm-4">
            Amount
        </label>
        <div class="col-sm-7">
          <input class="form-control" id="tf_amount" name="tf_amount" maxlength="20" type="text" value="'.$u_tf_amount.'"  />
        </div>
        </div>
        
<div class="form-group ">
<label for="scholar_ship" class="control-label col-sm-4">
  Scholarship
</label>
<div class="col-sm-7">
  <label>  <input name="scholar_ship" id="scholar_ship" type="checkbox" value="1" '.($u_scholar_ship==1?"checked":"").' onclick="call_scholarship_type()"/>
Yes</label>
</div>
</div>


<div class="form-group " id="sc_type" '.($u_scholar_ship==1?"":'style="display:none;"').'>
  <label for="first_graduate" class="control-label col-sm-4">
    Scholarship Type
  </label>
  <div class="col-sm-7">
  <label> <input name="c_sship" id="c_sship1" type="radio" value="scst" onclick="call_scholarship_type()" '.($u_caste_scholar_ship=='scst'?"checked":"").'/>
  SC/ST</label>
  <label> <input name="c_sship" id="c_sship2" type="radio" value="sca" onclick="call_scholarship_type()" '.($u_caste_scholar_ship=='sca'?"checked":"").'/>
  SCA</label> 
  <label> <input name="c_sship" id="c_sship3" type="radio" value="bc" onclick="call_scholarship_type()" '.($u_caste_scholar_ship=='bc'?"checked":"").'/>
  BC</label>
  <label> <input name="c_sship" id="c_sship4" type="radio" value="mbc" onclick="call_scholarship_type()" '.($u_caste_scholar_ship=='mbc'?"checked":"").'/>
  MBC</label> <br>
   <label> <input name="first_graduate" id="first_graduate" type="checkbox" value="1" '.($u_first_graduate==1?"checked":"").' onclick="call_scholarship_type()"/>
  First Graduate</label>
  
</div>
</div>

<div class="form-group ">
<label for="acmec_scholorship" class="control-label col-sm-4">
  ACMEC Scholorship
</label>
<div class="col-sm-7">
  <label>    <input name="acmec_scholorship" id="acmec_scholorship" type="checkbox" value="1" onclick="call_acmec_sship()" '.($u_acmec_scholorship==1?'checked':'').'  />
     Yes </label>
</div>
</div>
<div id="acmecsch" '.($u_acmec_scholorship==1?'':'style="display:none;"').' >
<div class="form-group ">
<label for="acmec_amount" class="control-label col-sm-4">
    Amount:
</label>
<div class="col-sm-7">
  <input name="acmec_amount" type="text" class="form-control" id="acmec_amount"  maxlength="70" value="'.$u_acmec_amount.'" />
</div>
</div>
<div class="form-group ">
<label for="acmec_approved" class="control-label col-sm-4">
    Approved by:
</label>
<div class="col-sm-7">
  <input name="acmec_approved" type="text" class="form-control" id="acmec_approved"  maxlength="70" value="'.$u_acmec_approved.'" />
</div>
</div>
</div>
        

</div>
</div>
</section>
</div></div>
<div class="row">';


////////////////////////////////Identification Mark //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container1">
<section class="panel">
<header class="panel-heading">
Parent
</header>
  <div class="col-sm-12">
<div class="form">
<div class="form-group ">
<label for="father_occupation" class="control-label col-sm-5">
    Father\'s Occupation
</label>
<div class="col-sm-7">
  <input name="father_occupation" type="text" class="form-control" id="father_occupation" maxlength="155" value="'.$u_father_occupation.'"/>
</div>
</div>

<div class="form-group ">
<label for="father_mincome" class="control-label col-sm-5">
    Father\'s Y.Income <span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <input name="father_mincome" type="text" class="form-control" id="father_mincome"  maxlength="10" onKeyUp="validatephone(this)" value="'.$u_father_income.'"/>
</div>
</div><div class="form-group ">
<label for="mother_occupation" class="control-label col-sm-5">
    Mother\'s Occupation
</label>
<div class="col-sm-7">
  <input name="mother_occupation" type="text" class="form-control" id="mother_occupation" maxlength="155" value="'.$u_mother_occupation.'"/>
</div>
</div>

<div class="form-group ">
<label for="mother_mincome" class="control-label col-sm-5">
    Mother\'s Y.Income <span class="text-danger" >*</span>
</label>
<div class="col-sm-7">
  <input name="mother_mincome" type="text" class="form-control" id="mother_mincome" maxlength="10" onKeyUp="validatephone(this)" value="'.$u_mother_income.'"/>
</div>
</div>





</div>
</div>
</section>
</div>



';
    /*<div class="form-group ">
<label for="pi_mark1" class="control-label col-sm-5">
    PI Mark1
</label>
<div class="col-sm-12">
  <textarea name="pi_mark1" class="form-control" id="pi_mark1">'.$persional_identification.'</textarea>
</div>
</div>
<div class="form-group ">
<label for="pi_mark2" class="control-label col-sm-5">
    PI Mark1
</label>
<div class="col-sm-12">
  <textarea name="pi_mark2" class="form-control" id="pi_mark2">'.$persional_identification_1.'</textarea>
</div>
</div>*/


 ////////////////////////////////Parent //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container2">
<section class="panel">
<header class="panel-heading">
TC Details
</header>
  <div class="col-sm-12">
<div class="form">

<div class="form-group ">
<label for="leaving_date" class="control-label col-sm-3">
    Leaving Date
</label>
<div class="col-sm-5">
  <input name="leaving_date" type="text" class="form-control calendar rcal" id="leaving_date" maxlength="10" autocomplete="off" value="'.$releaving_date.'"/>
</div>
</div>

<div class="form-group ">
<label class="control-label col-sm-3">
    Reason
</label>
<div class="col-sm-4"> '.$leaving_reason_details.'</div>
<div class="col-sm-3"> '.$releaving_year_details.'</div>
</div>

<div class="form-group " style="display:none;">
<label for="tc_apply_date" class="control-label col-sm-3">
    TC Apply  Date
</label>
<div class="col-sm-3"><input name="tc_apply_date" type="text" class="form-control calendar rcal" id="tc_apply_date" maxlength="10" autocomplete="off" value="'.$tc_apply_date.'"/></div>
</div>

<div class="form-group ">
<label for="tc_issue_date" class="control-label col-sm-3">
    TC Issue  Date
</label>
<div class="col-sm-3"><input name="tc_issue_date" type="text" class="form-control calendar rcal" id="tc_issue_date" maxlength="10" autocomplete="off" value="'.$tc_issue_date.'"/></div>
</div>

<div class="form-group ">
<label for="cri_status" class="control-label col-sm-3">
    CRI Completed
</label>
<div class="col-sm-3"><label><input name="cri_status" type="checkbox"  id="cri_status" value="1" '.($cri_status==1?'checked':'').' /> Yes <label></div>
</div>

 
<div class="form-group ">
<label  class="control-label col-sm-5">
</label>
</div>
</div>
</div>
</section>
</div>


<div class="col-sm-6 student_container2">
<section class="panel">
<header class="panel-heading">
PAN Details
</header>
  <div class="col-sm-12">
<div class="form">

<div class="form-group ">
<label for="leaving_date" class="control-label col-sm-3">
    PAN No.
</label>
<div class="col-sm-5">
  <input name="" type="text" class="form-control" id="pan_no" maxlength="12" autocomplete="off" value="'.$u_pan_no.'"/>
</div>
</div>

<div class="form-group ">
<label class="control-label col-sm-3">
    Name
</label>
<div class="col-sm-5"><input name="pan_name" type="text" class="form-control" id="pan_name" maxlength="50" autocomplete="off" value="'.$u_pan_name.'"/></div>

</div>
<div class="form-group ">
<label  class="control-label col-sm-5">
</label>
</div>
</div>
</div>
</section>
</div>




</div>
<div class="row">';

////////////////////////////////Guardian  //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container1">
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
  <label>    <input name="staying_with" id="staying_with" type="checkbox" value="1" onclick="callStayWithG()" '.($u_staying_with==1?'checked':'').'  />
     Yes </label>
</div>
</div>
<div id="styg" '.($u_staying_with==1?'':'style="display:none;"').' >
<div class="form-group ">
<label for="guardian_relation" class="control-label col-sm-4">
    Relationship
</label>
<div class="col-sm-7">
  <input name="guardian_relation" type="text" class="form-control" id="guardian_relation"  maxlength="70" onKeyUp="dodacheck(this)" value="'.$u_guardian_relation.'" />
</div>
</div>
<div class="form-group ">
<label for="guardian_name" class="control-label col-sm-4">
    Guardian Name
</label>
<div class="col-sm-7">
  <input name="guardian_name" type="text" class="form-control" id="guardian_name"  maxlength="100" onKeyUp="dodacheck(this)" value="'.$u_guardian_name.'" />
</div>
</div>
<div class="form-group ">
<label for="guardian_no" class="control-label col-sm-4">
  Mobile No.
</label>
<div class="col-sm-7">
  <input name="guardian_no" type="text" class="form-control" id="guardian_no" maxlength="15" onKeyUp="validatephone(this)"  value="'.$u_guardian_no.'"/>
</div>
</div>

<div class="form-group ">
  <label for="guardian_email" class="control-label col-sm-4">
    Email
  </label>
  <div class="col-sm-7">
  <input name="guardian_email" type="email" class="form-control" id="guardian_email" maxlength="100" value="'.$u_guardian_email.'"  />
</div>
</div>

<div class="form-group ">
<label for="guardian_address" class="control-label col-sm-4">
  Address
</label>
<div class="col-sm-7">
  <textarea name="guardian_address" class="form-control" id="guardian_address">'.$u_guardian_address.'</textarea>
</div>
</div>

<div class="form-group ">
<label for="guardian_city" class="control-label col-sm-4">
  City
</label>
<div class="col-sm-7">
  <input name="guardian_city" type="text" class="form-control" id="guardian_city" maxlength="70" onKeyUp="dodacheck(this)"  value="'.$u_guardian_city.'"/>
</div>
</div>

<div class="form-group ">
<label for="guardian_pincode" class="control-label col-sm-4">
  Pincode
</label>
<div class="col-sm-7">
  <input name="guardian_pincode" type="text" class="form-control" id="guardian_pincode" maxlength="6" onKeyUp="validatephone(this)"  value="'.$u_guardian_pincode.'"/>
</div>
</div>
</div>

</div>
</div>
</section>
</div>

';
  ////////////////////////////////Contact  //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container">
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
    <input name="mobile_no" type="text" class="form-control" id="mobile_no" maxlength="15" onKeyUp="validatephone(this)" value="'.$u_mobile_no.'" />
  </div>
  </div>

  <div class="form-group ">
  <label for="father_mobile" class="control-label col-sm-4">
      Father\'s Mobile No.
  </label>
  <div class="col-sm-7">
    <input name="father_mobile" type="text" class="form-control" id="father_mobile" maxlength="15" onKeyUp="validatephone(this)" value="'.$u_father_mobile_1.'"  />
  </div>
  </div>
  <div class="form-group ">
  <label for="mother_mobile" class="control-label col-sm-4">
    Mother\'s Mobile No.
  </label>
  <div class="col-sm-7">
    <input name="mother_mobile" type="text" class="form-control" id="mother_mobile" maxlength="15" onKeyUp="validatephone(this)" value="'.$u_mother_mobile.'"  />
  </div>
  </div>

  <div class="form-group ">
    <label for="contact_no" class="control-label col-sm-4">
      Telephone No
    </label>
    <div class="col-sm-7">
      <input name="contact_no" type="text" class="form-control" id="contact_no"  maxlength="15" onKeyUp="validatephone(this)" value="'.$u_contact_no.'" />
  </div>
  </div>

  <div class="form-group ">
  <label for="personal_email" class="control-label col-sm-4">
    Student Email
  </label>
  <div class="col-sm-7">
    <input name="personal_email" type="email" class="form-control" id="personal_email" maxlength="100" value="'.$u_personal_email.'" />
  </div>
  </div>

  <div class="form-group ">
  <label for="" class="control-label col-sm-4">
    Father\'s Email
  </label>
  <div class="col-sm-7">
    <input name="father_email" type="email" class="form-control" id="father_email" maxlength="100" value="'.$u_father_email.'" />
  </div>
  </div>



  </div>
  </div>
  </section>
  </div>
  </div>
  <div class="row">';

 ////////////////////////////////Permanent Address //////////////////////////////
$final_student_profile.='<div class="col-sm-6 student_container">
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
    <input name="door_no" type="text" class="form-control" id="door_no" size="20" maxlength="155" value="'.$u_door_no.'" />
  </div>
  </div>

  <div class="form-group ">
  <label for="street" class="control-label col-sm-4">
      Street
  </label>
  <div class="col-sm-7">
    <input name="street" type="text" class="form-control" id="street" maxlength="255" value="'.$u_street.'" />
  </div>
  </div>
  <div class="form-group ">
  <label for="post" class="control-label col-sm-4">
    Post
  </label>
  <div class="col-sm-7">
  <input name="post" type="text" class="form-control" id="post" maxlength="70" value="'.$u_post.'" />
  </div>
  </div>

  <div class="form-group ">
    <label for="taluk" class="control-label col-sm-4">
      Taluk
    </label>
    <div class="col-sm-7">
      <input name="taluk" type="text" class="form-control" id="taluk" maxlength="70" onKeyUp="dodacheck(this);" value="'.$u_taluk.'" />
  </div>
  </div>

  <div class="form-group ">
  <label for="district" class="control-label col-sm-4">
    District
  </label>
  <div class="col-sm-7">
    <input name="district" type="text" class="form-control" id="district" maxlength="70" onKeyUp="dodacheck(this);" value="'.$u_district.'" />
  </div>
  </div>

  <div class="form-group ">
  <label for="state" class="control-label col-sm-4">
    State
  </label>
  <div class="col-sm-7">
    <select name="state" class="form-control" id="state" >
      <option value="">-- Select one --</option>';
      $dist_array=array( "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal");
      foreach($dist_array as $dist)
      {
        if(strtolower(trim($u_state))==strtolower(trim($dist)))
        $final_student_profile.="<option value='".trim($dist)."' selected>".trim($dist)."</option>";
        else
        $final_student_profile.="<option value='".trim($dist)."'>".trim($dist)."</option>";
      }
    $final_student_profile.='</select>
  </div>
  </div>

  <div class="form-group ">
  <label for="pincode" class="control-label col-sm-4">
    Pincode
  </label>
  <div class="col-sm-7">
    <input name="pincode" type="text" class="form-control" id="pincode" maxlength="6" onKeyUp="validatephone(this)" value="'.$u_pincode.'" />
  </div>
  </div>

  </div>
  </div>
  </section>
  </div>';

   ////////////////////////////////Communication  Address //////////////////////////////
  $final_student_profile.='<div class="col-sm-6 student_container">
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
    <input name="c_door_no" type="text" class="form-control" id="c_door_no" size="20" maxlength="155" value="'.$u_c_door_no.'"/>
  </div>
  </div>

  <div class="form-group ">
  <label for="c_street" class="control-label col-sm-4">
      Street
  </label>
  <div class="col-sm-7">
    <input name="c_street" type="text" class="form-control" id="c_street" maxlength="255" value="'.$u_c_street.'"/>
  </div>
  </div>
  <div class="form-group ">
  <label for="c_post" class="control-label col-sm-4">
    Post
  </label>
  <div class="col-sm-7">
  <input name="c_post" type="text" class="form-control" id="c_post" maxlength="70" value="'.$u_c_post.'"/>
  </div>
  </div>

  <div class="form-group ">
    <label for="c_taluk" class="control-label col-sm-4">
      Taluk
    </label>
    <div class="col-sm-7">
      <input name="c_taluk" type="text" class="form-control" id="c_taluk" maxlength="70" onKeyUp="dodacheck(this);" value="'.$u_c_taluk.'"/>
  </div>
  </div>

  <div class="form-group ">
  <label for="c_district" class="control-label col-sm-4">
    District
  </label>
  <div class="col-sm-7">
    <input name="c_district" type="text" class="form-control" id="c_district" maxlength="70" onKeyUp="dodacheck(this);" value="'.$u_c_district.'"/>
  </div>
  </div>

  <div class="form-group ">
  <label for="c_state" class="control-label col-sm-4">
    State
  </label>
  <div class="col-sm-7">
    <select name="c_state" class="form-control" id="c_state" >
      <option value="">-- Select one --</option>';
      foreach($dist_array as $dist)
      {
        if(strtolower(trim($u_c_state))==strtolower(trim($dist)))
        $final_student_profile.="<option value='".trim($dist)."' selected>".trim($dist)."</option>";
        else
        $final_student_profile.="<option value='".trim($dist)."'>".trim($dist)."</option>";
      }
    $final_student_profile.='
    </select>
  </div>
  </div>

  <div class="form-group ">
  <label for="c_pincode" class="control-label col-sm-4">
    Pincode
  </label>
  <div class="col-sm-7">
    <input name="c_pincode" type="text" class="form-control" id="c_pincode" maxlength="6" onKeyUp="validatephone(this)" value="'.$u_c_pincode.'"/>
  </div>
  </div>

  </div>
  </div>
  </section>
  </div></div>
  <div class="row">';
////////////////////////////////Bank Details   //////////////////////////////
		 $final_student_profile.='<div class="col-sm-6 student_container1">
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
        <input name="b_ac_no" type="text"  class="form-control" id="b_ac_no"  maxlength="255"  value="'.$b_ac_no.'" />
        </div>
        </div>

        <div class="form-group ">
        <label for="b_ac_name" class="control-label col-sm-5">
         A/c Name
        </label>
        <div class="col-sm-7">
      <input name="b_ac_name" type="text" class="form-control" id="b_ac_name" maxlength="70" value="'.$b_ac_name.'" />
        </div>
        </div>
        <div class="form-group ">
        <label for="b_name" class="control-label col-sm-5">
      Bank Name
        </label>
        <div class="col-sm-7">
        <select name="b_name" id="b_name"  class="form-control"  ><option value=""  >--Select--</option>';

        $sql_b=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  edu_setup_tb WHERE category="Bank"  AND del=1 ORDER BY category_order ASC');
        while(($row_b=mysqli_fetch_array($sql_b))!=false)
        {
                  $b_id=$row_b['id'];
                  $b_category_name=$row_b['category_name'];
                  $b_category_sname=$row_b['category_sname'];
                  $b_sub_category=$row_b['sub_category'];
                  $b_category_name=stripslashes($b_category_name);
                  $b_category_sname=stripslashes($b_category_sname);
                  $b_sub_category=stripslashes($b_sub_category);

             if($b_name==$b_id)
             $final_student_profile.="<option value='$b_id'  selected>".htmlentities($b_category_name,ENT_QUOTES)."</option>";
             else
             $final_student_profile.="<option value='$b_id' >".htmlentities($b_category_name,ENT_QUOTES)."</option>";
        }

       $final_student_profile.=' </select>
        </div>
        </div>

        <div class="form-group ">
        <label  for="b_branch" class="control-label col-sm-5">
         Branch
        </label>
        <div class="col-sm-7">
          <input name="b_branch" type="text" class="form-control" id="b_branch" value="'.$b_branch.'"  maxlength="70" />
        </div>
        </div>

        <div class="form-group ">
        <label for="b_ifsc" class="control-label col-sm-5">
         IFSC Code
        </label>
        <div class="col-sm-7">
        <input name="b_ifsc" type="text" class="form-control" id="b_ifsc" value="'.$b_ifsc.'"  maxlength="70"/>
        </div>
        </div>

        </div>
        </div>
        </section>
        </div>
        <div>
 <div class="row">';
 ////////////////////////////////Mark Sheet //////////////////////////////
  $final_student_profile.='<div class="col-sm-6 student_container2">
  <section class="panel">
  <header class="panel-heading">
  Mark Sheet
  </header>
    <div class="col-sm-12">
  <div class="form">
  <div class="form-group ">
    <table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered" id="markSheetTable">
     <tr bgcolor="#CCCCCC">
     <td width="5%" >S.No.</td>
     <td width="20%" > Class/Program</td>
     <td width="25%" > Board/University</td>
     <td width="15%"  nowrap> Register No.</td>
     <td width="15%"  nowrap> Passed Out</td>
     <td width="10%"  nowrap> %</td>
     <td width="10%"  nowrap>  </td>
     </tr>
     ';


     $sql_section='SELECT * FROM student_certificate WHERE s_id="'.$u_sid.'"  AND  del=1 ORDER BY FIELD(course_name , "X","XII","U.G","P.G","Other"), id ASC';
     $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
     if(mysqli_num_rows($result_section)>0)
     {
     $hsec=0;
     $del_row='';
     $pgm_array=array('X'=>'10th','XII'=>'12th','NEET'=>'NEET','U.G'=>'U.G','P.G'=>'P.G','Other'=>'Other'); 
     while(($row_section=mysqli_fetch_array($result_section))!=false)
     {

     $m_id=$row_section['id'];
     $m_reg_no=$row_section['cregister_no'];
     $m_cname=$row_section['course_name'];
     $m_board=$row_section['board'];
     $m_yop=$row_section['year_of_passing'];
     $m_marks=$row_section['total_marks'];

     $m_reg_no=stripslashes($m_reg_no);
     $m_board=stripslashes($m_board);
     $m_yop=stripslashes($m_yop);
     $m_marks=stripslashes($m_marks);

     $pgm_list='';
     foreach($pgm_array as $pgm_sname => $pgm_name)
     {
     if($m_cname==$pgm_sname)
     $pgm_list.='<option value="'.$pgm_sname.'" selected>'.$pgm_name.'</option>';
     else
     $pgm_list.='<option value="'.$pgm_sname.'">'.$pgm_name.'</option>';
     }

     $final_student_profile.='

     <tr>
     <td height="30" valign="middle" nowrap="nowrap">'.($hsec+1).'
     <input name="mid[]" type="hidden"  value="'.$m_id.'"/></td>
     <td valign="middle" nowrap="nowrap"><select name="prgm_name[]" id="prgm_name[]" class="form-control"><option value="">--Select--</option>'.$pgm_list.'</select></td>
     <td valign="middle" nowrap="nowrap"><input name="pgm_board[]" id="pgm_board[]" class="form-control" type="text" maxlength="155" value="'.$m_board.'"/></td>
     <td valign="middle" nowrap="nowrap"><input name="creg_no[]" id="creg_no[]" class="form-control" type="text"  maxlength="70" value="'.$m_reg_no.'"/></td>
     <td valign="middle" nowrap="nowrap"><input name="passed_out[]" id="passed_out[]" class="form-control" type="text"  maxlength="4" placeholder="YYYY" value="'.$m_yop.'"/></td>
     <td valign="middle" nowrap="nowrap"><input name="ctotal[]" id="ctotal[]" class="form-control" type="text"   maxlength="5" value="'.$m_marks.'"/></td>
     <td valign="middle" nowrap="nowrap">'.$del_row.'</td>
       </tr>';

     $del_row='<input name="button3" class="btn btn-danger btn-sm" onclick="msRemoveRow('.($hsec+2).')" title="Del Row" value="Del" type="button">';
     	  $hsec++;
       }
}
else {
  $final_student_profile.=' 
  <tr>
  <td height="30" valign="middle" nowrap="nowrap">1</td>
  <td valign="middle" nowrap="nowrap"><select name="prgm_name[]" id="prgm_name[]" class="form-control"><option value="">--Select--</option><option value="X">10th</option><option value="XII">12th</option><option value="NEET">NEET</option><option value="U.G">U.G</option><option value="P.G">P.G</option><option value="Other">Other</option> </select></td>
  <td valign="middle" nowrap="nowrap"><input name="pgm_board[]" id="pgm_board[]" class="form-control" type="text" maxlength="155" /></td>
  <td valign="middle" nowrap="nowrap"><input name="creg_no[]" id="creg_no[]" class="form-control" type="text"  maxlength="70" /></td>
  <td valign="middle" nowrap="nowrap"><input name="passed_out[]" id="passed_out[]" class="form-control" type="text"  maxlength="4" placeholder="YYYY"/></td>
  <td valign="middle" nowrap="nowrap"><input name="ctotal[]" id="ctotal[]" class="form-control" type="text"   maxlength="5" /></td>
    </tr>';
}

       $final_student_profile.='
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
  </div>';

  $final_student_profile.='</div>
<div class="row">

  <div class="col-sm-12">
  <section class="panel">  <div class="form">
    <div class="form-group ">
  <div class="col-sm-offset-2 col-sm-10 padding-tb15">
        <button class="btn btn-lg btn-danger" name="Submit" type="submit" value="Update">Update Profile</button>
        <input type="hidden" name="form_reset" value="'.date('His').rand(0000,1111).'" />
  </div>  </div>  </div>
  </section>
  </div>
</div>

';


return  $final_student_profile;



}



return  '';
}








?>
