<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
include_once('widget.php');
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
if($_SERVER['REQUEST_METHOD']=='POST')
{
$flag=$_REQUEST['flag'];
if($flag==7)
{
  $filename_temp=$_REQUEST['filename'];
  $file_array=array("jpg","jpeg","png","gif","doc","docx","pdf");
  $fname=explode('.',$filename_temp);

  if(in_array(strtolower($fname[1]),$file_array)==true)
  {
 // $imageData=$GLOBALS['HTTP_RAW_POST_DATA'];
 $imageData=file_get_contents("php://input");
  $imageData1=explode('base64,',$imageData);
  $data = base64_decode($imageData1[1]);
  $file_name='';
  $replace_string=array("(",")","[", "]", " ");
  $filename=str_replace($replace_string,'_',$filename_temp);
  $file_name='files/student_attachment/'.$filename;

  if(file_exists($file_name))
  {
  $filename=rand(1000,9999).$filename;
  $file_name='files/student_attachment/'.$filename;
  }
  file_put_contents($file_name, $data);
  echo $filename;
}
else
echo 0;
}
}
else if($_SERVER['REQUEST_METHOD']=='GET')
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
  $u_register_no=$row_stu['register_no'];
  $u_student_photo =$row_stu['student_photo'];
  $u_student_name=$row_stu['student_name'];
  $u_student_initial=$row_stu['student_initial'];



  $hd_input_value='
  <input type="hidden" name="student_id"  class="input" value="'.$s_id.'"/>
  <input type="hidden" name="ac_course"  class="input" value="'.$u_course_id.'"/>
  <input type="hidden" name="acd_year"  class="input" value="'.$academic_year_ref.'"/>
  <input type="hidden" name="acd_reg_no"  class="input" value="'.$u_register_no.'"/>
  ';


  $sql_course=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT degree_name, department_name, course_duration, course_name FROM basic_setup_course_tb WHERE  del=1 AND id="'.$u_course_id.'"');
  $row_course=mysqli_fetch_array($sql_course);
  $degree_name=$row_course['degree_name'];
  $department_name=$row_course['department_name'];
  $course_duration=$row_course['course_duration'];
  $degree_name=stripslashes($degree_name);
  $department_name=stripslashes($department_name);
  if(trim($department_name)!='' && trim($department_name)!='-')
  $department_name=' - '.$department_name;
  else
  $department_name='';
  $u_course_name=$degree_name.$department_name;
  
  $course_name=$row_course['course_name'];
  
  $ugpg_course=0;
  if($course_name=="U.G")
  {
      $ugpg_course=1;
  }
  
  if($course_name=="P.G")
  {
      $ugpg_course=2;
  }


  $path1="files/student_idcard/".$u_register_no.".png";
  if(file_exists($path1))
  $student_photo_link="<img src='$path1' width=80 height=100 />";


  ////////////////////////////////Admission //////////////////////////////
  $final_student_profile='  <div class="row"><div class="col-sm-12 student_container2">
'.$hd_input_value.'
<section class="panel">
  <header class="panel-heading">
  Student
  </header>
  <div class="row col-sm-12">
  <div class="form">
     <div class="col-sm-6">
     <div class="form-group ">
    <label class="control-label col-sm-4">
      Name
    </label>
    <div class="col-sm-7">
       '.$u_student_name.' '.$u_student_initial.'
    </div>
    </div>

    <div class="form-group ">
    <label class="control-label col-sm-4">
      Roll No
    </label>
    <div class="col-sm-7">
      '.$u_register_no.'
    </div>
    </div>

    <div class="form-group ">
    <label  class="control-label col-sm-4">
      Course <br><br>
    </label>
    <div class="col-sm-8">'.$u_academic_year.' | '.$u_course_name.' </div>
    </div>
    </div>



    <div class="col-sm-6 text-center">
      '.$student_photo_link.'

    </div>
        </div>

  </div>
  </section>
  </div></div>';

  ////////////////////////////////Register //////////////////////////////
 $final_student_profile.='<div class="row"><div class="col-sm-12 student_container">
 <section class="panel">
 <header class="panel-heading">
 Attachments
 </header>
   <div class="col-sm-12">
 <div class="form">


 ';
 $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Attachment"  AND del!=0 ORDER BY category_order ASC');
 $act=0;
 $attachment_counter=0;
 while(($row_section=mysqli_fetch_array($sql_section))!=false)
 {
 $a_id=$row_section['id'];
 $category_name=$row_section['category_name'];
 $category_sname=$row_section['category_sname'];
 $ug_val=$row_section['ug'];
 $pg_val=$row_section['pg'];
    if($ug_val==$ugpg_course || $pg_val==$ugpg_course)
    {
     if($act%2==0)
     $bgc=' class="inner_content_bg2" ';
     else
     $bgc='';
     $act++;
    
    
     $sql_att=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  student_attachment_tb WHERE del=1 AND attach_id="'.$a_id.'"  AND  s_id="'.$s_id.'"');
     $row_att=mysqli_fetch_array($sql_att);
     $att_id=$row_att['id'];
     $attach_file=$row_att['attach_file'];
     $attach_no=$row_att['attach_no'];
     $attach_link='';
     $attach_del='';
     if($att_id && $attach_file)
     {
       $attach_del="<input type='button' name='Submit' class='btn btn-sm btn-danger' value='Del' onclick='callDelete(".$attachment_counter.")'/>";
       $attach_link="<a href='files/student_attachment/$attach_file' target='_blank'>View</a>";
     }
    
     $final_student_profile.=' <div class="form-group ">
     <label   class="control-label col-sm-2">'.$category_name.'
     <input name="a_id[]" type="hidden" value="'.$a_id.'" />
     <input name="att_id[]" type="hidden" value="'.$att_id.'" />
     <input name="attached_file[]" type="hidden" id="attached_file_'.$attachment_counter.'" value="'.$attach_file.'" />
     </label>
     
     <div class="col-sm-3">
     <input name="attached_no[]" type="text" id="attached_no_'.$attachment_counter.'" class="form-control" value="'.$attach_no.'" autocomplete="off"/>
     </div>
     <div class="col-sm-2">
     <input name="attachment[]" type="file" id="fattach_'.$attachment_counter.'" class="form-control" />
     </div>
     <div class="col-sm-1 no-padding-center">
     <progress id="progress_'.$attachment_counter.'" value="0" style="display:none; width:100%;"></progress>
     <p id="attachf_'.$attachment_counter.'"><strong>'.$attach_link.'</strong></p>
     </div>
     <div class="col-sm-1 ">
     <span id="attachi_'.$attachment_counter.'" >'.$attach_del.'</span>
     <span id="attachd_'.$attachment_counter.'" ></span></div>
      </div> ';
     $attachment_counter++;
     
    }
 
 }

 $final_student_profile.='
 <p class="text-danger">Note: Support jpg, png, gif, doc, docx, pdf only </p>
 </div>
 </div>
 </section>
 </div>


 </div>

 <div class="row">

   <div class="col-sm-12">
   <section class="panel">  <div class="form">
     <div class="form-group ">
   <div class="col-sm-offset-2 col-sm-10 padding-tb15">
         <button class="btn btn-lg btn-danger" name="Submit" type="submit" value="Update">Save</button>
         <input type="hidden" name="form_reset" value="'.date('His').rand(0000,1111).'" />
   </div>  </div>  </div>
   </section>
   </div>
 </div>

 ';

return $final_student_profile;

}



return  '';
}








?>
