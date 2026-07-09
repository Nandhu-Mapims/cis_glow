<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
$a_username=$_SESSION['empusername_login'];
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
date_default_timezone_set('Asia/Kolkata');
include('widget.php');

$flag=$_REQUEST['flag'];
$c_flag=$_REQUEST['c'];
$cRefresh=$_REQUEST['cRefresh'];
define('CACHE_REFRESH',$cRefresh+0);
$final_result[0]=0;
$counter=0;
if($flag==1)
{

 /*
  $sql_c_academic='SELECT * FROM basic_setup_tb WHERE del=1 AND del=1';
  $result_c_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_c_academic);
  $row_c_academic=mysqli_fetch_array($result_c_academic);
  $academic_year_ref['U.G']['regular']=$row_c_academic['ug_academic_year'];
  $academic_year_ref['U.G']['additional']=$row_c_academic['uga_academic_year'];
  $academic_year_ref['P.G']['regular']=$row_c_academic['pg_academic_year'];
  */
  
  
  $ugr=$_REQUEST['ugr'];
  $uga=$_REQUEST['uga'];
  $pgr=$_REQUEST['pgr'];
///  echo "^&^&^".$ugr;

  $academic_year_ref['U.G']['regular']=$ugr;
  $academic_year_ref['U.G']['additional']=$uga;
  $academic_year_ref['P.G']['regular']=$pgr;
  $w_list_tmp=$_REQUEST['w'];
  $r_date=$_REQUEST['d'];
  if($c_flag==1)
  {
    $academic_time=$_REQUEST['t'];
    if($academic_time=='')
    $academic_time=date('H:i');
    $academic_date=date('Y-m-d',strtotime($r_date));
  }
  else
  {
    $academic_date=date('Y-m-d',$r_date);
    $academic_time=date('H:i');
  }
  $w_list=explode(',',$w_list_tmp);
  $student_info=array();
  $student_att=array();
  $staff_att=array();
  $student_hostel=array();
 
  foreach($w_list as $w_name)
  {
    if(($w_name=='staff_attendance' || $w_name=='staff_attendance_incampus' || $w_name=='staff_leave_absent') && sizeof($staff_att)==0)
      $staff_att=staff_attendance($academic_date);
    else if(($w_name=='ug_attendance' || $w_name=='ug_attendance_add' || $w_name=='pg_attendance' || $w_name=='internship_attendance'  || $w_name=='internship_attendance_batch' || $w_name=='internship_leave_absent' || $w_name=='internship_permission'  || $w_name=='pg_attendance_dept' || $w_name=='pg_leave_absent' || $w_name=='pg_permission') && sizeof($student_att)==0)
      $student_att=attendance_details($academic_date,$academic_year_ref);
    else if(($w_name=='student_details' || $w_name=='student_add_details') && sizeof($student_info)==0)
      $student_info=student_details($academic_date,$academic_year_ref);
    else if(($w_name=='student_hostel' || $w_name=='gents_hostel_attendance' || $w_name=='ladies_hostel_attendance' || $w_name=='student_ghostel' || $w_name=='student_lhostel') && sizeof($student_hostel)==0)
      $student_hostel=student_hostel_details($academic_date,$academic_year_ref);


      if($w_name=='staff_attendance'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$staff_att[0];
      }
      else if($w_name=='staff_attendance_incampus'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$staff_att[1];
      }
      else if($w_name=='staff_leave_absent'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$staff_att[2];
      }
      else if($w_name=='internship_attendance') {
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[0];
      }
      else if($w_name=='internship_attendance_batch') {
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[1];
      }
      else if($w_name=='internship_leave_absent'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[3];
      }
      else if($w_name=='internship_permission'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[4];
      }
      else if($w_name=='ug_attendance'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[2];
      }
      else if($w_name=='ug_attendance_add'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[9];
      }
      else if($w_name=='pg_attendance'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[5];
      } 
      else if($w_name=='pg_attendance_dept') {
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[6];
      }
      else if($w_name=='pg_leave_absent'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[7];
      }
      else if($w_name=='pg_permission'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_att[8];
      } 
      else if($w_name=='student_details'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_info[0];
      }
      else if($w_name=='student_add_details'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_info[1];
      }
      else if($w_name=='student_hostel'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=$student_hostel[0];
      }
      else if($w_name=='gents_hostel_attendance'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=student_hostel_att_details($academic_date,$academic_year_ref,'male',$student_hostel[1]);
      }
      else if($w_name=='ladies_hostel_attendance'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=student_hostel_att_details($academic_date,$academic_year_ref,'female',$student_hostel[2]);
      }
      else if($w_name=='student_ghostel'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=student_hostel_details_att($academic_date,$academic_year_ref,'male',$student_hostel[1]);
      }
      else if($w_name=='student_lhostel'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=student_hostel_details_att($academic_date,$academic_year_ref,'female',$student_hostel[2]);
      }
      else if($w_name=='student_scholarship'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=student_academic($academic_date,$academic_year_ref);
      } 
      else if($w_name=='staff_details'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=staff_details($academic_date);
      }
      else if($w_name=='staff_permission'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=staff_permission($academic_date);
      }
      else if($w_name=='staff_current'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=staff_current($academic_date,$academic_year_ref,$academic_time);
      }
      else if($w_name=='feedback_analyasis'){
        $final_result[1][$counter]=$w_name; $final_result[2][$counter]=student_feedback($academic_date,$academic_year_ref);
      }
      if($final_result[1][$counter])
      $counter++;
  }
  $final_result[0]=$counter;
  echo json_encode($final_result);
}

function attendance_details($current_date,$academic_year_array)
{
  $period_day=date('l',strtotime($current_date));
  $tbl_name='punchtimedetails_'.date('Y',strtotime($current_date)).ceil(date('m',strtotime($current_date))/4);
  $period_day_string=' AND (p_days="'.$period_day.'" OR p_days LIKE "'.$period_day.',%" OR p_days LIKE "%,'.$period_day.'" OR p_days LIKE "%,'.$period_day.',%")';

  $sql_period=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT DISTINCT(period_no), course_name, academic_year, academic_type, from_time, to_time FROM  period_set_up WHERE del!=0 AND period_no!="Break" '.$period_day_string.' ORDER BY  period_no+0 ASC');
  
   $session_details=array();
  $period_details=array();
  while(($row_period=mysqli_fetch_array($sql_period))!=false)
  {
  $period_no=$row_period[0];
  $course_name=$row_period[1];
  $academic_year=$row_period[2];
  $academic_type=strtolower($row_period[3]);
  $from_time=$row_period[4];
  $to_time=$row_period[5];

  $session_details[$course_name][$academic_year][$academic_type][$period_no]['from']=$from_time;
  $session_details[$course_name][$academic_year][$academic_type][$period_no]['to']=$to_time;
  $period_details[$period_no]=$period_no;
  }
  $total_present_details=array();

  $sql_query=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT id, machine_id, room_name from  rooms_tb where del=1");
  $machine_array=array();
  $room_array=array();
  while(($row_room=mysqli_fetch_array($sql_query))!=false)
  {
    $room_id=$row_room[0];
    $machine_id=$row_room[1];
    $room_name=$row_room[2];
    $machine_array_string='';
    if($room_id && $machine_id)
    {
      $machine_id_list=explode(',',$machine_id);
      foreach($machine_id_list as $mid)
      {
        $mid=trim($mid);
        if($mid)
        $machine_array_string.=" flag='$mid' OR";
      }
    }
    if($room_id && $room_name)
    {
      $machine_id_list=explode(',',$room_name);
      foreach($machine_id_list as $mid)
      {
        $mid=trim($mid);
        if($mid)
        $machine_array_string.=" flag='$mid' OR";
      }
    }
    if($machine_array_string)
    {
      $machine_array_string=" AND ( ".substr($machine_array_string,0,-2)." )";
      $machine_array[$room_id]=$machine_array_string;
    }

  }

  $result_dept=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT * FROM  subject_master WHERE del=1 AND category='Timetable' ORDER BY category_order ASC");
  while(($row_dept=mysqli_fetch_array($result_dept))!=false)
  {
    $r_department_name=$row_dept['category_name'];
    $r_id=$row_dept['id'];
    $r_department_name=stripslashes($r_department_name);
    $subject_subcat_array[$r_id]=strtolower($r_department_name);
  }

    
   $sql_cat='SELECT * FROM basic_setup_stuatt WHERE id="1" ';
   $late_permission = mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_cat));

   $l_permission_time=t_to_m($late_permission['permission_time']);
   $l_late_time=t_to_m($late_permission['late_time']);
   $l_sat_time=$late_permission['sat_time'];
   $pg_late_permission=array();
    
    $pdepartment_array=array();
    $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Department"  AND del!=0 ORDER BY category_order ASC');
    while(($row_section=mysqli_fetch_array($sql_section))!=false)
    {
    $a_id=$row_section['id'];
    $category_name=$row_section['category_sname'];
    $pdepartment_array[$a_id]=$category_name;
    }
    
   $pg_authetication_str=pgAuthentication('department'); 
   $student_authetication_str=studAuthentication('B.department');
   $row_academic_aca=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT academic_events, comments, course_type FROM  academic_calender_tb where  academic_date='$current_date'   AND del=1"));
   $a_academic_events =strtolower($row_academic_aca['academic_events']);
   $academic_comments =$row_academic_aca['comments'];
   $academic_class_list=$row_academic_aca['course_type'];
   $academic_class_array=explode(',,,',$academic_class_list);

if($a_academic_events=='working')
$academic_events=$a_academic_events;
else
$academic_events='holiday';
    
   $c_counter=0;
   $year_label_array=array('I','II','III','IV','V','VI','VII','VIII');
   $sql_section='SELECT * FROM basic_setup_course_tb WHERE  del=1   ORDER BY degree_name ASC';
   $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
   $final_att_counter=0;
   $pg_details_comb=array();
   $pg_max_prd=0;
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
         $semester_per_year=$row_section['semester_per_year'];
         $c_department=$row_section['course_department'];
        $degree_name=stripslashes($degree_name);
        $course_duration=stripslashes($course_duration);
        $department_name=stripslashes($department_name);
        $full_part_time=stripslashes($full_part_time);
       
        
        $class_contain=0;
        if($academic_class_list=='' || in_array($ref_course_name,$academic_class_array)==true)
        $class_contain=1;
        if(($academic_events=='working' && $class_contain==1) || ($academic_events=='holiday' && $class_contain==0))
        $class_contain=1;
        else
        $class_contain=0;
       


        if(trim($department_short_name)!='' && trim($department_short_name)!='-')
        $department_short_name=' - '.$department_short_name;
        else
        $department_short_name='';
        $academic_year_ref=$academic_year_array[$ref_course_name]['regular'];
        if($ref_course_name=='U.G' && $class_contain==1){
            $course_duration=$course_duration-1;
          foreach($academic_year_array[$ref_course_name] as $abatch => $acad_year_ref){  
            
            for($cx=1;$cx<=$course_duration;$cx++)
            {
            ///    if($cx==4)$academic_year_ref='2022-2023';
            ///    else $academic_year_ref=$acad_year_ref;
              $reg_no_list=array();
              $reg_no_count=array();
              $f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id), GROUP_CONCAT( A.register_no SEPARATOR ',') FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$c_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date')  AND B.del=1 AND B.academic_year='$academic_year_ref' AND B.current_year='$cx' AND B.academic_batch='$abatch' "));
             
              $stu_count=$f_result_stu[0];
              $student_regno=$f_result_stu[1];
              if($student_regno)
              {
              $student_regno_list=explode(',',$student_regno);
              $reg_no_tmp=implode("' OR tktno='",$student_regno_list);
              if(trim(str_replace("' OR tktno='",'',$reg_no_tmp)))
              $reg_no_list['all']=" AND (tktno='$reg_no_tmp') ";
              $reg_no_count['all']=sizeof($student_regno_list);
              }
              $sql_batch='SELECT * FROM basic_subject_batch_tb WHERE course_id="'.$c_id.'" AND academic_year="'.$academic_year_ref.'" AND current_year="'.$cx.'" AND academic_type="'.$abatch.'" AND del=1';
              $result_batch=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_batch);
              while(($row_batch=mysqli_fetch_array($result_batch))!=false)
              {
                $roll_no=$row_batch['roll_no'];
                $batch_no=$row_batch['batch_no'];
                if($roll_no)
                {
                $student_regno_list=explode(',',$roll_no);
                $reg_no_tmp=implode("' OR tktno='",$student_regno_list);
                if(trim(str_replace("' OR tktno='",'',$reg_no_tmp)))
                $reg_no_list[$batch_no]=" AND (tktno='$reg_no_tmp') ";
                 $reg_no_count[$batch_no]=sizeof($student_regno_list);
                }
              }

              /*
              $sql_batch='SELECT * FROM basic_subject_batch_tb WHERE course_id="'.$c_id.'" AND academic_year="'.$academic_year_ref.'" AND current_year="'.$cx.'" AND academic_type="Additional" AND del=1';
              $result_batch=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_batch);
              while(($row_batch=mysqli_fetch_array($result_batch))!=false)
              {
                $roll_no=$row_batch['roll_no'];
                $batch_no=$row_batch['batch_no'];
                if($roll_no)
                {
                $student_regno_list=explode(',',$roll_no);
                $reg_no_tmp=implode("' OR tktno='",$student_regno_list);
                if(trim(str_replace("' OR tktno='",'',$reg_no_tmp)))
                $reg_no_list[$batch_no]=" AND (tktno='$reg_no_tmp') ";
                }
              } */

 
                $class_attendance_details[$abatch].='<tr> <td ><p class="class_name">'.convertNYear($cx, $ref_course_name).' '.$degree_name.$department_short_name.'</p></td> ';
                if($student_authetication_str=='')
                $class_attendance_details[$abatch].='<td ><p class="class_name">'.$stu_count.'</p></td>';
              
              $allocated_periods=array(); 
              foreach($period_details as $period)
              {

                $sql_tsub="SELECT A.id, A.subject_id, A.batch_no, A.staff_id, B.room_no, B.subject_id, B.subject_name, B.s_batch, B.subject_category, B.department FROM timetable_tb_new AS A INNER JOIN basic_subject_tt_tb AS B ON A.subject_id=B.id WHERE A.del=1 AND A.course_id='$c_id' AND A.academic_year='$academic_year_ref' AND A.current_year='$cx' AND A.academic_type='$abatch' AND A.t_day='$period_day' AND A.period='$period' AND (A.from_date<='$current_date' AND (A.to_date>='$current_date' OR A.to_date='0000-00-00' )) AND A.academic_type='$abatch' AND B.del=1 $student_authetication_str ORDER BY A.id ASC";
                
               // echo $sql_tsub;
                $result_tsub=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_tsub);
                $total_attended='-';
                $total_stu_count='0';
                if(mysqli_num_rows($result_tsub)>0)
                {
                  $total_attended=0;
                while(($row_tt=mysqli_fetch_array($result_tsub))!=false)
                {
                  $tt_id=$row_tt[0];
                  $tt_subid=$row_tt[1];
                  $tt_batch_temp=$row_tt[2];
                  $tt_staff_id=$row_tt[3];
                  $tt_room_no=$row_tt[4];
                  $tt_subject_id=$row_tt[5];
                  $tt_subject_name=$row_tt[6];
                  $tt_subject_batch=$row_tt[7];
                  $tt_scat=$row_tt[8];
                  $tt_subject_cat=$subject_subcat_array[$tt_scat];

                  $from_time=$current_date.' '.$session_details[$ref_course_name][$cx][$abatch][$period]['from'];
                  $to_time=$current_date.' '.$session_details[$ref_course_name][$cx][$abatch][$period]['to'];
                  $from_time=date('Y-m-d H:i:s',strtotime($from_time." -10 minutes"));
                  $tt_batch_no_list=explode(',',$tt_batch_temp);
                  foreach($tt_batch_no_list as $tt_batch_no){
                  $btch_info.=$period.':'.$from_time.' '.$to_time.'<br>';
                  $reg_search_str=$reg_no_list['all'];
                  if($tt_subject_batch==1)
                  {  
                    $reg_search_str=$reg_no_list[$tt_batch_no];
                    $total_stu_count+=$reg_no_count[$tt_batch_no];
                  }
                  else
                  {
                    $total_stu_count=$reg_no_count['all'];
                  }
                  $machine_id=$machine_array[$tt_room_no];
                  if(in_array($reg_search_str,$allocated_periods[$period])==false)
                  {
                    $tt_exam_id='';
                    if($tt_subject_cat=='e-learning'){ 
                      $in_sql=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT id  FROM activity_task_tb WHERE 
                      exam_date='$current_date' AND
                      academic_year ='$academic_year_ref' AND
                      course_type ='$abatch' AND 
                      course_id ='$c_id'  AND
                      current_year = '$cx' AND
                      exam_period='$period' AND
                      subject_id='$tt_subid'
                      ")); 
                     $tt_exam_id=$in_sql[0];
                    } 

                  $allocated_periods[$period][]=$reg_search_str;

                  
                  if($tt_exam_id){
                    $rnolist=str_replace('tktno=', 'register_no=',$reg_search_str);
                    $total_attended+=mysqli_num_rows(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT id FROM activity_answer_tb WHERE del=1  AND exam_id='$tt_exam_id' ".$rnolist)); 
                  }
                 if($machine_id)
                  $total_attended+=mysqli_num_rows(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(tktno)  FROM $tbl_name WHERE date(p_date)='$current_date' AND p_date>='$from_time' AND p_date<='$to_time' $machine_id $reg_search_str "));
                  //echo "SELECT DISTINCT(tktno)  FROM $tbl_name WHERE date(p_date)='$current_date' AND p_date>='$from_time' AND p_date<='$to_time' $machine_id $reg_search_str ";
                  }
    //echo $period."<br>SELECT DISTINCT(tktno)  FROM $tbl_name WHERE  p_date>='$from_time' AND p_date<='$to_time' $machine_id $reg_search_str <br>";
                  }



                }
              }

               

                if($total_attended=='-')
                  $class_attendance_details[$abatch].='<td><p class="no_right">'.$total_attended.'</p></td>';
                  else
                  {

                    if($student_authetication_str)
                    {
                      if($total_stu_count>$reg_no_count['all'])
                      $total_stu_count=$reg_no_count['all'];
                      $total_stu_count='<small> /'.$total_stu_count.'<small>';
                    }
                    else
                      $total_stu_count='';

                    $class_attendance_details[$abatch].='<td nowrap><p class="no_right cinfo" onclick="call_stuattendance(\''.$c_id.'\',\''.$academic_year_ref.'\',\''.$cx.'\',\''.strtotime($current_date).'\',\''.$period.'\' ,\''.$abatch.'\' )">'.$total_attended.$total_stu_count.'</p></td>';
                  }

               

              }
               
               
              $class_attendance_details[$abatch].='</tr>';
            }
          }
        }
        else if($ref_course_name=='P.G' && $c_department && $class_contain==1){ 
            if($pg_authetication_str[0]=='' || in_array($c_department,$pg_authetication_str[1])==true ){
                for($cx=1;$cx<=$course_duration;$cx++){
              $reg_no_list=array();
              $reg_no_count=array();
              $f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id), GROUP_CONCAT( A.register_no SEPARATOR ',') FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$c_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date')  AND B.del=1 AND B.academic_year='$academic_year_ref' AND B.current_year='$cx' "));
              $stu_count=$f_result_stu[0];
              $student_regno=$f_result_stu[1];
              $student_regno_list=array();
              if($student_regno)
              {
                  $student_regno_list=explode(',',$student_regno);
                  $reg_no_tmp=implode("' OR tktno='",$student_regno_list);
                  if(trim(str_replace("' OR tktno='",'',$reg_no_tmp)))
                  $reg_no_list['all']=" AND (tktno='$reg_no_tmp') ";
                  $reg_no_count['all']=sizeof($student_regno_list);
              }
           
                
   
              $sql_hr=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT from_time, to_time, room_no  FROM student_pgatt_time WHERE del=1  AND  course_id='$c_id' AND  academic_year='$academic_year_ref' AND  current_year='$cx' AND  academic_type='regular' AND  days='$period_day' AND  from_date<='$current_date' AND to_date>='$current_date' GROUP BY att_group ORDER BY att_group ASC");
                
                 
              if(mysqli_num_rows($sql_hr)>0)
              { 
                $row_hr=mysqli_fetch_array($sql_hr);
                $from_time=$row_hr[0];
                $to_time=$row_hr[1];
                $att_room_no=$row_hr[2];
                  
                  
                $machine_id=$machine_array[$att_room_no]; 
                $student_regno=$reg_no_list['all'];

                if($student_regno && $machine_id)
                {
                $from_time=$current_date.' '.$from_time;
                $to_time=$current_date.' '.$to_time;
                   
                $f_present_time=strtotime($from_time);
                $f_late_time=strtotime($from_time." +".$l_late_time." minutes");
                $f_permission_time=strtotime($from_time." +".$l_permission_time." minutes");

                $t_present_time=strtotime($to_time);
                $t_late_time=strtotime($to_time." -".$l_late_time." minutes");
                $t_permission_time=strtotime($to_time." -".$l_permission_time." minutes");

                $pg_in_from=date('Y-m-d H:i:s',$f_permission_time);
                $pg_in_to=date('Y-m-d H:i:s',$t_permission_time);
                  
                  
                  
                   
                $pg_in=0;
                $pg_out=0; 
                $fill_reg_no=array();
                $pg_lp=array();
                   $intern_in_sql=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(tktno),p_date  FROM $tbl_name WHERE DATE(p_date)='$current_date' AND p_date<='$pg_in_from' $machine_id $student_regno ORDER BY p_date ASC");
                while(($irow=mysqli_fetch_array($intern_in_sql))!=false)
                {
                    $tktno=$irow[0];
                    $tdate=strtotime($irow[1]);
                    if(in_array($tktno,$fill_reg_no['m'])==false){
                    $pg_in++;
                      $fill_reg_no['m'][]=$tktno;
                    if($tdate<=$f_present_time)
                    $pg_lp['mp']++;
                    else if($tdate<=$f_late_time)
                    $pg_lp['mla']++;
                    else if($tdate<=$f_permission_time)
                    $pg_lp['mpe']++;
                    }
                }

                $intern_out_sql=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(tktno),p_date  FROM $tbl_name WHERE  DATE(p_date)='$current_date' AND p_date>='$pg_in_to' $machine_id $student_regno ORDER BY p_date ASC");
                while(($irow=mysqli_fetch_array($intern_out_sql))!=false)
                {
                    $tktno=$irow[0];
                    $tdate=strtotime($irow[1]);
                    if(in_array($tktno,$fill_reg_no['e'])==false){
                      $fill_reg_no['e'][]=$tktno;
                    $pg_out++;


                    if($tdate>=$t_present_time)
                    $pg_lp['ep']++;
                    else if($tdate>=$t_late_time)
                    $pg_lp['ela']++;
                    else if($tdate>=$t_permission_time)
                    $pg_lp['epe']++;
                    }
                }  
                    
                /////////////////////Leave Apply//////////////////

                $reg_no_list1=str_replace("tktno='", "B.register_no='",$student_regno);
             
                $row_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status,A.id FROM stu_leave_request_more AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id WHERE A.del=1 AND A.req_date='$current_date' AND (A.r_session='fullday' OR A.r_session='forenoon') AND A.status<=1 AND B.del=1 $reg_no_list1");
                while(($irow=mysqli_fetch_array($row_l))!=false)
                {
                $pg_lp['m_l_ap']++;
                if($irow[0]==1)
                $pg_lp['m_l_apr']++;
                }

                $row_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status,A.id FROM stu_leave_request_more AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id WHERE A.del=1 AND A.req_date='$current_date' AND (A.r_session='fullday' OR A.r_session='afternoon') AND A.status<=1 AND B.del=1 $reg_no_list1");
                while(($irow=mysqli_fetch_array($row_l))!=false)
                {
                $pg_lp['e_l_ap']++;
                if($irow[0]==1)
                $pg_lp['e_l_apr']++;
                }

                $sql_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status, A.p_type FROM stu_permission_request AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id WHERE A.del=1 AND DATE(A.from_date)='$current_date' AND A.status<=1 AND B.del=1 $reg_no_list1");
                while(($row_l=mysqli_fetch_array($sql_l))!=false)
                {
                  if($row_l[1]){
                  $pg_lp['pr'][$row_l[1]]['apply']++;
                  if($row_l[0]==1)
                  $pg_lp['pr'][$row_l[1]]['approve']++;
                }
                }  

                $pg_tot=sizeof($student_regno_list)+0;
                $pg_late_permission['tot']+=$pg_tot;
                $pg_late_permission['in']+=$pg_in;
                $pg_late_permission['out']+=$pg_out;
                    
                    
                $total_pg_lp['mla']+=$pg_lp['mla'];
                $total_pg_lp['mpe']+=$pg_lp['mpe'];
                $total_pg_lp['mab']+=($pg_tot-$pg_in);
                $total_pg_lp['m_l_ap']+=$pg_lp['m_l_ap'];
                $total_pg_lp['m_l_apr']+=$pg_lp['m_l_apr'];

                $total_pg_lp['ela']+=$pg_lp['ela'];
                $total_pg_lp['epe']+=$pg_lp['epe'];
                $total_pg_lp['eab']+=($pg_tot-$pg_out);
                $total_pg_lp['e_l_ap']+=$pg_lp['e_l_ap'];
                $total_pg_lp['e_l_apr']+=$pg_lp['e_l_apr'];

                $total_pg_lp['pr_tot']+=$pg_lp['pr']['personal']['apply']+$pg_lp['pr']['official']['apply']+0;
                $total_pg_lp['pe_tot_apply']+=$pg_lp['pr']['personal']['apply'];
                $total_pg_lp['pe_tot_approve']+=$pg_lp['pr']['personal']['approve'];
                $total_pg_lp['of_tot_apply']+=$pg_lp['pr']['official']['apply'];
                $total_pg_lp['of_tot_approve']+=$pg_lp['pr']['official']['approve'];
                    
                    
                    
                    
                $total_pg[$c_department]['in']+=$pg_in;
                $total_pg[$c_department]['out']+=$pg_out;
                $total_pg[$c_department]['total']+=$pg_tot;
                $total_pg[$c_department]['mla']+=$pg_lp['mla'];
                $total_pg[$c_department]['mpe']+=$pg_lp['mpe'];
                $total_pg[$c_department]['mab']+=($pg_tot-$pg_in);
                $total_pg[$c_department]['m_l_ap']+=$pg_lp['m_l_ap'];
                $total_pg[$c_department]['m_l_apr']+=$pg_lp['m_l_apr'];

                $total_pg[$c_department]['ela']+=$pg_lp['ela'];
                $total_pg[$c_department]['epe']+=$pg_lp['epe'];
                $total_pg[$c_department]['eab']+=($pg_tot-$pg_out);
                $total_pg[$c_department]['e_l_ap']+=$pg_lp['e_l_ap'];
                $total_pg[$c_department]['e_l_apr']+=$pg_lp['e_l_apr'];

                $total_pg[$c_department]['pr_tot']+=$pg_lp['pr']['personal']['apply']+$pg_lp['pr']['official']['apply']+0;
                $total_pg[$c_department]['pe_tot_apply']+=$pg_lp['pr']['personal']['apply'];
                $total_pg[$c_department]['pe_tot_approve']+=$pg_lp['pr']['personal']['approve'];
                $total_pg[$c_department]['of_tot_apply']+=$pg_lp['pr']['official']['apply'];
                $total_pg[$c_department]['of_tot_approve']+=$pg_lp['pr']['official']['approve'];
                    
                  
 
               
              }
                
                

            } 
              }
            }
        }
  /*  $a_year_temp1=explode('-',$academic_year_ref);
      $a_year_1=$a_year_temp1[0];
      $end_year=$a_year_temp1[0]-$course_duration;
  if($year_of_start>$end_year)
  $end_year=$year_of_start-1;
  $year_count=0;
  $mperiod=$session_details[$ref_course_name]['morning'];
  $eperiod=$session_details[$ref_course_name]['evening'];
  if($mperiod)
  $mperiod=" AND (".substr($mperiod,0,-2).")";
  if($eperiod)
  $eperiod=" AND (".substr($eperiod,0,-2).")"; 
  for($acy=$a_year_1;$acy>$end_year;$acy--)
  {
  $ac_year=$acy.'-'.($acy+1);
  $year_diff=$a_year_1-$acy; 
  $row_class=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(id), GROUP_CONCAT( register_no SEPARATOR ',') FROM student_profile_tb WHERE academic_year='$ac_year' AND course_id='$c_id' AND (releaving_date='0000-00-00' OR releaving_date>'$current_date')  AND del=1 "));
  $number_of_student=$row_class[0];
  $student_regno=$row_class[1];

  $student_regno_list=explode(',',$student_regno);
  $m_absent=0;
  $e_absent=0;
  if($mperiod)
  {
    $row_class=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(id), GROUP_CONCAT( att_absent SEPARATOR ',') FROM student_att_tb WHERE academic_year='$academic_year_ref' AND academic_date='$current_date'  AND course_id ='$c_id'  AND admission_year = '$ac_year'  AND del=1 $mperiod "));
    $mcount=$row_class[0];
    $mabsent=$row_class[1];
    if($mcount>0){
      $mabsent_list=explode(',',$mabsent);
      $mabsent_list=array_unique($mabsent_list);
      for($i=0;$i<sizeof($mabsent_list);$i++)
      {
        $mabsent_list[$i]=trim($mabsent_list[$i]);
        if(in_array($mabsent_list[$i],$student_regno_list)==true)
          $m_absent++;
      }
    }
  }
  if($eperiod)
  {
    $row_class=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(id), GROUP_CONCAT( att_absent SEPARATOR ',') FROM student_att_tb WHERE academic_year='$academic_year_ref' AND academic_date='$current_date'  AND course_id ='$c_id'  AND admission_year = '$ac_year'  AND del=1 $eperiod "));
    $ecount=$row_class[0];
    $eabsent=$row_class[1];
    if($ecount>0){
      $eabsent_list=explode(',',$eabsent);
      $eabsent_list=array_unique($eabsent_list);
      for($i=0;$i<sizeof($eabsent_list);$i++)
      {
        $eabsent_list[$i]=trim($eabsent_list[$i]);
        if(in_array($eabsent_list[$i],$student_regno_list)==true)
          $e_absent++;
      }
    }
  } 
  $total_present_details['t']+=$number_of_student;
  if($mcount>0 || $ecount>0)
  {
    $mpresent=$number_of_student-$m_absent;
    $epresent=$number_of_student-$e_absent;

    $total_present_details['m']+=$mpresent;
    $total_present_details['e']+=$epresent;

    $clsname=' class="td_bottom_border_color" ';
    if($c_counter%2==0)
    $clsname=' class="td_bottom_border" ';
    $c_counter++; 
//onclick="call_attendance_details('.$m_att_id.','.$e_att_id.')" title="Click and View Details.."  style="cursor:pointer;"
  $class_attendance_details.='<tr '.$clsname.'>
          <td  width="113"><p class="class_name">'.$year_label_array[$year_count].' '.$degree_name.$department_short_name.'</p></td>
          <td  width="40" bgcolor="#E5E5E5"><p class="no_right cinfo"  onclick="callattendance(\''.$c_id.'\',\''.$ac_year.'\',\''.$current_date.'\',\'t\')">'.$number_of_student.'</p></td>
          <td  width="40"><p class="no_right cinfo" onclick="callattendance(\''.$c_id.'\',\''.$ac_year.'\',\''.$current_date.'\',\'m\')">'.$mpresent.'</p></td>
          <td  width="40"><p class="no_right cinfo" onclick="callattendance(\''.$c_id.'\',\''.$ac_year.'\',\''.$current_date.'\',\'e\')">'.$epresent.'</p></td>
        </tr>';
  } 
  $year_count++;
  }
  */

   }
    
     $pg_attendance_details=$pg_attendance_details1=$pg_attendance_details2='';
    if($pg_late_permission['tot']>0){
  foreach($pdepartment_array as $idept => $idpt_name)
  {
    if($total_pg[$idept]['total']>0){
    $pg_attendance_details.='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; '.$idpt_name.' </p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($total_pg[$idept]['total']+0).'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'in\')"><strong>'.($total_pg[$idept]['in']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'in late\')"><strong>'.($total_pg[$idept]['mla']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'in permission\')"><strong>'.($total_pg[$idept]['mpe']+0).'</strong></p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'out\')"><strong>'.($total_pg[$idept]['out']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'out late\')"><strong>'.($total_pg[$idept]['ela']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'out permission\')"><strong>'.($total_pg[$idept]['epe']+0).'</strong></p></td>
    </tr>';

    $pg_attendance_details1.='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; '.$idpt_name.' </p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($total_pg[$idept]['total']+0).'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Forenoon Not Showing\')"><strong>'.($total_pg[$idept]['mab']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Forenoon Leave\')">'.($total_pg[$idept]['m_l_ap']+0).'</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Forenoon Leave Approval\')">'.($total_pg[$idept]['m_l_apr']+0).'</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Afternoon Not Showing\')"><strong>'.($total_pg[$idept]['eab']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Afternoon Leave\')">'.($total_pg[$idept]['e_l_ap']+0).'</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_pgatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Afternoon Leave Approval\')">'.($total_pg[$idept]['e_l_apr']+0).'</p></td>
    </tr>';

    $pg_attendance_details2.='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; '.$idpt_name.' </p></td><td class="att_work_body"><p class="class_name cinfo" onclick="callpgpermission(\''.$idept.'\',\''.$current_date.'\',\'Personal & Official\')"><strong>'.($total_pg[$idept]['pr_tot']+0).'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="callpgpermission(\''.$idept.'\',\''.$current_date.'\',\'Personal\')"><strong>'.($total_pg[$idept]['pe_tot_apply']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callpgpermission(\''.$idept.'\',\''.$current_date.'\',\'Personal Approve\')">'.($total_pg[$idept]['pe_tot_approve']+0).'</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="callpgpermission(\''.$idept.'\',\''.$current_date.'\',\'Official\')"><strong>'.($total_pg[$idept]['of_tot_apply']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callpgpermission(\''.$idept.'\',\''.$current_date.'\',\'Official Approve\')">'.($total_pg[$idept]['of_tot_approve']+0).'</p></td>
    </tr>';

  }
  }
    }
  if($pg_attendance_details)
  $pg_attendance_details='<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="100" rowspan="2" valign="bottom"> &nbsp; Dept.</th>
    <th width="60" rowspan="2" title="Working" class="att_work_header" valign="bottom">#W</th>
    <th width="60" colspan="3" class="text-center att_in_header" height="30" >Clock In</th>
    <th width="60" colspan="3" class="text-center att_out_header" nowrap>Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="IN" class="att_in_header">I</th>
    <th width="20" title="Late" class="att_in_header">L</th>
    <th width="20" title="Premission" class="att_in_header">P</th>
    <th width="20" title="Out" class="att_out_header">O</th>
    <th width="20" title="Late" class="att_out_header">L</th>
    <th width="20" title="Premission" class="att_out_header">P</th>
    </tr>
    '.$pg_attendance_details.'<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td ><p class="class_name"> &nbsp; &nbsp; Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($pg_late_permission['tot']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'in\')"><strong>'.($pg_late_permission['in']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'in late\')"><strong>'.($total_pg_lp['mla']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'in permission\')"><strong>'.($total_pg_lp['mpe']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'out\')"><strong>'.($pg_late_permission['out']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'out late\')"><strong>'.($total_pg_lp['ela']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'out permission\')"><strong>'.($total_pg_lp['epe']+0).'</strong></p></td>
    </tr></table>';

if($pg_attendance_details1)
{
  $pg_attendance_details1='<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2"> &nbsp; Dept.</th>
    <th width="30" rowspan="2" title="Working" class="att_work_header">#W</th>
    <th colspan="3" class="text-center att_in_header" height="10" >Clock In</th>
    <th colspan="3" class="text-center att_out_header">Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="Not Showing" class="att_in_header">N</th>
    <th width="20" title="Leave" class="att_in_header">L</th>
    <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
    <th width="20" title="Not Showing" class="att_out_header">N</th>
    <th width="20" title="Leave" class="att_out_header">L</th>
    <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
    </tr>'.$pg_attendance_details1.'<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td ><p class="class_name"> Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo"onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($pg_late_permission['tot']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'Forenoon Not Showing\')"><strong>'.($total_pg_lp['mab']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'Forenoon Leave\')"><strong>'.($total_pg_lp['m_l_ap']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'Forenoon Leave Approval\')"><strong>'.($total_pg_lp['m_l_apr']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'Afternoon Not Showing\')"><strong>'.($total_pg_lp['eab']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'Afternoon Leave\')"><strong>'.($total_pg_lp['e_l_ap']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'Afternoon Leave Approval\')"><strong>'.($total_pg_lp['e_l_apr']+0).'</strong></p></td>
    </tr>
     </table>';
}
if($pg_attendance_details2)
{
$pg_attendance_details2='<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
<tr class="td_head_color">
  <th width="40" rowspan="2"> &nbsp; Dept.</th>
  <th width="30" rowspan="2" title="Total" class="att_work_header">#T</th>
  <th colspan="2" class="text-center att_in_header" height="10" >Personal</th>
  <th colspan="2" class="text-center att_out_header">Official</th>
  </tr>
  <tr class="td_head_color">
  <th width="20" height="10" title="Apply" class="att_in_header">A</th>
  <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
  <th width="20" title="Apply" class="att_out_header">A</th>
  <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
  </tr>'.$pg_attendance_details2.'
  <tr class="td_bottom_border" bgcolor="#F4F4F4">
<td nowrap><p class="class_name" > Total </p></td>
<td class="att_work_header"><p class="class_name cinfo" onclick="callpgpermission(\'\',\''.$current_date.'\',\'Personal & Official\')"><strong>'.($total_pg_lp['pr_tot']+0).'</strong></p></td>
<td class="att_in_header ar"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Personal\')"><strong>'.($total_pg_lp['pe_tot_apply']+0).'</strong></p></td>
<td class="att_in_header ar"><p class="class_name cinfo" onclick="callpgpermission(\'\',\''.$current_date.'\',\'Personal Approve\')">'.($total_pg_lp['pe_tot_approve']+0).'</p></td>
<td class="att_out_header ar"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Official\')"><strong>'.($total_pg_lp['of_tot_apply']+0).'</strong></p></td>
<td class="att_out_header ar"><p class="class_name cinfo" onclick="callpgpermission(\'\',\''.$current_date.'\',\'Official Approve\')">'.($total_pg_lp['of_tot_approve']+0).'</p></td>
</tr>
</table>';
}
    

   /*****************PG in LIST*****************
   foreach($pg_details_comb as $pg_year => $pg_details)
   {
      $class_attendance_details.=$pg_details['head']; 
          if($student_authetication_str=='')
            $class_attendance_details.='<td ><p class="class_name">'.$pg_details['tot'].'</p></td>'; 
      for($p=1;$p<=$pg_max_prd;$p++)
      {
         $tatt=$pg_details['p'][$p]; 
         $class_attendance_details.='<td><p class="no_right" >'.($tatt>=0?$tatt:'-').'</p></td>'; 
      } 
      $class_attendance_details.='</tr>';
   }
   */
    
   /*****************PG First & Last Period*****************
   $pg_attendance_details=array();

   foreach($pg_details_comb as $pg_year => $pg_details)
   { 
      $pg_in=0;
      $pg_out=0;
      $pg_tot=0;
      $pcount=0;
      for($p=1;$p<=$pg_max_prd;$p++)
      {
        $tatt=$pg_details['p'][$p];

        if($pg_tot==0) 
          $pg_in=$tatt; 
        else
          $pg_out=$tatt; 

        if($pg_details['ptot'][$p]>$pg_tot)
        $pg_tot=$pg_details['ptot'][$p];
         
        $pcount++;
        if($pcount==2)break; 
      } 
      $pg_attendance_details['tot']+=$pg_tot;
      $pg_attendance_details['in']+=$pg_in;
      $pg_attendance_details['out']+=$pg_out; 
   }
   */
    

//////////////////////////Internship Details/////////////////////////////// 
$idepartment_array=array();
$sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  master_setup WHERE category="Internship Department"  AND del!=0 ORDER BY category_order ASC');
while(($row_section=mysqli_fetch_array($sql_section))!=false)
{
$a_id=$row_section['id'];
$category_name=$row_section['category_sname'];
$idepartment_array[$a_id]=$category_name;
}


  $intern_search_str=internAuthentication('department'); 
 
  $sql_query=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  internship_timetable WHERE del=1 AND  from_date<="'.$current_date.'" AND to_date>="'.$current_date.'" '.$intern_search_str.' ORDER BY academic_year ASC');
 $total_intern_student=0;
  $total_intern_in=0;
  $total_intern_out=0;
  $total_intern_lp=array();
  $intern_attendance_details='';
  $total_intern=array();
  $fill_reg_no=array();
$class_contain=0;
if($academic_class_list=='' || in_array('Int',$academic_class_array)==true)
$class_contain=1;
if(($academic_events=='working' && $class_contain==1) || ($academic_events=='holiday' && $class_contain==0))
{
   
  while(($row_query=mysqli_fetch_array($sql_query))!=false)
  {
    $i_course_id=$row_query['course_id'];
    $i_academic_year=$row_query['academic_year'];
    $i_current_year=$row_query['current_year'];
    $i_academic_type=$row_query['academic_type'];
    $i_batch_no=$row_query['batch_no'];
    $i_department=$row_query['department'];
    $i_from_time=$row_query['from_time'];
    $i_to_time=$row_query['to_time'];
    $i_room_no=$row_query['room_no'];

    if(strtolower(date('l',strtotime($current_date)))=='saturday')
    $i_to_time=$l_sat_time;


    $machine_id=$machine_array[$i_room_no];

    $sql_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT roll_no FROM  basic_subject_batch_tb WHERE del=1 AND  course_id="'.$i_course_id.'" AND academic_year="'.$i_academic_year.'" AND current_year="'.$i_current_year.'" AND academic_type="'.$i_academic_type.'" AND batch_no="'.$i_batch_no.'"'));
    $student_regno=$sql_stu[0];
    
   

    if($student_regno && $machine_id)
    {

      $i_ftime=$current_date.' '.$i_from_time;
      $i_ttime=$current_date.' '.$i_to_time;

      $f_present_time=strtotime($i_ftime);
      $f_late_time=strtotime($i_ftime." +".$l_late_time." minutes");
      $f_permission_time=strtotime($i_ftime." +".$l_permission_time." minutes");

      $t_present_time=strtotime($i_ttime);
      $t_late_time=strtotime($i_ttime." -".$l_late_time." minutes");
      $t_permission_time=strtotime($i_ttime." -".$l_permission_time." minutes");

      $intern_in_from=date('Y-m-d H:i:s',$f_permission_time);
      $intern_in_to=date('Y-m-d H:i:s',$t_permission_time);


    $student_regno_list=explode(',',$student_regno);
    $reg_no_tmp=implode("' OR tktno='",$student_regno_list);
    if(trim(str_replace("' OR tktno='",'',$reg_no_tmp)))
    $reg_no_list=" AND (tktno='$reg_no_tmp') ";
    $reg_no_list1=str_replace("tktno='", "B.register_no='",$reg_no_list);


    $in_tot=sizeof($student_regno_list)+0;
    $intern_in=0;
    $intern_out=0;
    $intern_lp=array();
    $intern_in_sql=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(tktno),p_date  FROM $tbl_name WHERE DATE(p_date)='$current_date' AND p_date<='$intern_in_from' $machine_id $reg_no_list ORDER BY p_date ASC");
    while(($irow=mysqli_fetch_array($intern_in_sql))!=false)
    {
        $tktno=$irow[0];
        $tdate=strtotime($irow[1]);
        if(in_array($tktno,$fill_reg_no['m'])==false){
        $intern_in++;
          $fill_reg_no['m'][]=$tktno;
        if($tdate<=$f_present_time)
        $intern_lp['mp']++;
        else if($tdate<=$f_late_time)
        $intern_lp['mla']++;
        else if($tdate<=$f_permission_time)
        $intern_lp['mpe']++;
        }
    }

    $intern_out_sql=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(tktno),p_date  FROM $tbl_name WHERE  DATE(p_date)='$current_date' AND p_date>='$intern_in_to' $machine_id $reg_no_list ORDER BY p_date ASC");
    while(($irow=mysqli_fetch_array($intern_out_sql))!=false)
    {
        $tktno=$irow[0];
        $tdate=strtotime($irow[1]);
        if(in_array($tktno,$fill_reg_no['e'])==false){
          $fill_reg_no['e'][]=$tktno;
        $intern_out++;


        if($tdate>=$t_present_time)
        $intern_lp['ep']++;
        else if($tdate>=$t_late_time)
        $intern_lp['ela']++;
        else if($tdate>=$t_permission_time)
        $intern_lp['epe']++;
        }
    }
    /////////////////////Leave Apply//////////////////

    $row_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status,A.id FROM stu_leave_request_more AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id WHERE A.del=1 AND A.req_date='$current_date' AND (A.r_session='fullday' OR A.r_session='forenoon') AND A.status<=1 AND B.del=1 $reg_no_list1");
    while(($irow=mysqli_fetch_array($row_l))!=false)
    {
    $intern_lp['m_l_ap']++;
    if($irow[0]==1)
    $intern_lp['m_l_apr']++;
    }

    $row_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status,A.id FROM stu_leave_request_more AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id WHERE A.del=1 AND A.req_date='$current_date' AND (A.r_session='fullday' OR A.r_session='afternoon') AND A.status<=1 AND B.del=1 $reg_no_list1");
    while(($irow=mysqli_fetch_array($row_l))!=false)
    {
    $intern_lp['e_l_ap']++;
    if($irow[0]==1)
    $intern_lp['e_l_apr']++;
    }

    $sql_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status, A.p_type FROM stu_permission_request AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id WHERE A.del=1 AND DATE(A.from_date)='$current_date' AND A.status<=1 AND B.del=1 $reg_no_list1");
    while(($row_l=mysqli_fetch_array($sql_l))!=false)
    {
      if($row_l[1]){
      $intern_lp['pr'][$row_l[1]]['apply']++;
      if($row_l[0]==1)
      $intern_lp['pr'][$row_l[1]]['approve']++;
    }
    }



    $total_intern_student+=$in_tot;
    $total_intern_in+=$intern_in;
    $total_intern_out+=$intern_out;
    $total_intern_lp['mla']+=$intern_lp['mla'];
    $total_intern_lp['mpe']+=$intern_lp['mpe'];
    $total_intern_lp['mab']+=($in_tot-$intern_in);
    $total_intern_lp['m_l_ap']+=$intern_lp['m_l_ap'];
    $total_intern_lp['m_l_apr']+=$intern_lp['m_l_apr'];

    $total_intern_lp['ela']+=$intern_lp['ela'];
    $total_intern_lp['epe']+=$intern_lp['epe'];
    $total_intern_lp['eab']+=($in_tot-$intern_out);
    $total_intern_lp['e_l_ap']+=$intern_lp['e_l_ap'];
    $total_intern_lp['e_l_apr']+=$intern_lp['e_l_apr'];

    $total_intern_lp['pr_tot']+=$intern_lp['pr']['personal']['apply']+$intern_lp['pr']['official']['apply']+0;
    $total_intern_lp['pe_tot_apply']+=$intern_lp['pr']['personal']['apply'];
    $total_intern_lp['pe_tot_approve']+=$intern_lp['pr']['personal']['approve'];
    $total_intern_lp['of_tot_apply']+=$intern_lp['pr']['official']['apply'];
    $total_intern_lp['of_tot_approve']+=$intern_lp['pr']['official']['approve'];




    $total_intern[$i_department]['in']+=$intern_in;
    $total_intern[$i_department]['out']+=$intern_out;
    $total_intern[$i_department]['total']+=$in_tot;
    $total_intern[$i_department]['mla']+=$intern_lp['mla'];
    $total_intern[$i_department]['mpe']+=$intern_lp['mpe'];
    $total_intern[$i_department]['mab']+=($in_tot-$intern_in);
    $total_intern[$i_department]['m_l_ap']+=$intern_lp['m_l_ap'];
    $total_intern[$i_department]['m_l_apr']+=$intern_lp['m_l_apr'];

    $total_intern[$i_department]['ela']+=$intern_lp['ela'];
    $total_intern[$i_department]['epe']+=$intern_lp['epe'];
    $total_intern[$i_department]['eab']+=($in_tot-$intern_out);
    $total_intern[$i_department]['e_l_ap']+=$intern_lp['e_l_ap'];
    $total_intern[$i_department]['e_l_apr']+=$intern_lp['e_l_apr'];

    $total_intern[$i_department]['pr_tot']+=$intern_lp['pr']['personal']['apply']+$intern_lp['pr']['official']['apply']+0;
    $total_intern[$i_department]['pe_tot_apply']+=$intern_lp['pr']['personal']['apply'];
    $total_intern[$i_department]['pe_tot_approve']+=$intern_lp['pr']['personal']['approve'];
    $total_intern[$i_department]['of_tot_apply']+=$intern_lp['pr']['official']['apply'];
    $total_intern[$i_department]['of_tot_approve']+=$intern_lp['pr']['official']['approve'];

    }
  }
}
  $intern_attendance_details=$intern_attendance_details1=$intern_attendance_details2='';
  foreach($idepartment_array as $idept => $idpt_name)
  {
    if($total_intern[$idept]['total']>0){
    $intern_attendance_details.='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; '.$idpt_name.' </p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($total_intern[$idept]['total']+0).'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'in\')"><strong>'.($total_intern[$idept]['in']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'in late\')"><strong>'.($total_intern[$idept]['mla']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'in permission\')"><strong>'.($total_intern[$idept]['mpe']+0).'</strong></p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'out\')"><strong>'.($total_intern[$idept]['out']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'out late\')"><strong>'.($total_intern[$idept]['ela']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'out permission\')"><strong>'.($total_intern[$idept]['epe']+0).'</strong></p></td>
    </tr>';

    $intern_attendance_details1.='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; '.$idpt_name.' </p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($total_intern[$idept]['total']+0).'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Forenoon Not Showing\')"><strong>'.($total_intern[$idept]['mab']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Forenoon Leave\')">'.($total_intern[$idept]['m_l_ap']+0).'</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Forenoon Leave Approval\')">'.($total_intern[$idept]['m_l_apr']+0).'</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Afternoon Not Showing\')"><strong>'.($total_intern[$idept]['eab']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Afternoon Leave\')">'.($total_intern[$idept]['e_l_ap']+0).'</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="call_internatt(\''.$idept.'\',\''.strtotime($current_date).'\',\'Afternoon Leave Approval\')">'.($total_intern[$idept]['e_l_apr']+0).'</p></td>
    </tr>';

    $intern_attendance_details2.='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; '.$idpt_name.' </p></td><td class="att_work_body"><p class="class_name cinfo" onclick="callinternpermission(\''.$idept.'\',\''.$current_date.'\',\'Personal & Official\')"><strong>'.($total_intern[$idept]['pr_tot']+0).'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="callinternpermission(\''.$idept.'\',\''.$current_date.'\',\'Personal\')"><strong>'.($total_intern[$idept]['pe_tot_apply']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callinternpermission(\''.$idept.'\',\''.$current_date.'\',\'Personal Approve\')">'.($total_intern[$idept]['pe_tot_approve']+0).'</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="callinternpermission(\''.$idept.'\',\''.$current_date.'\',\'Official\')"><strong>'.($total_intern[$idept]['of_tot_apply']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callinternpermission(\''.$idept.'\',\''.$current_date.'\',\'Official Approve\')">'.($total_intern[$idept]['of_tot_approve']+0).'</p></td>
    </tr>';

  }
  }
  if($intern_attendance_details)
  $intern_attendance_details='<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="100" rowspan="2" valign="bottom"> &nbsp; Dept.</th>
    <th width="60" rowspan="2" title="Working" class="att_work_header" valign="bottom">#W</th>
    <th width="60" colspan="3" class="text-center att_in_header" height="30" >Clock In</th>
    <th width="60" colspan="3" class="text-center att_out_header" nowrap>Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="IN" class="att_in_header">I</th>
    <th width="20" title="Late" class="att_in_header">L</th>
    <th width="20" title="Premission" class="att_in_header">P</th>
    <th width="20" title="Out" class="att_out_header">O</th>
    <th width="20" title="Late" class="att_out_header">L</th>
    <th width="20" title="Premission" class="att_out_header">P</th>
    </tr>
    '.$intern_attendance_details.'<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td ><p class="class_name"> &nbsp; &nbsp; Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($total_intern_student+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'in\')"><strong>'.($total_intern_in+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'in late\')"><strong>'.($total_intern_lp['mla']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'in permission\')"><strong>'.($total_intern_lp['mpe']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'out\')"><strong>'.($total_intern_out+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'out late\')"><strong>'.($total_intern_lp['ela']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'out permission\')"><strong>'.($total_intern_lp['epe']+0).'</strong></p></td>
    </tr></table>';

if($intern_attendance_details1)
{
  $intern_attendance_details1='<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2"> &nbsp; Dept.</th>
    <th width="30" rowspan="2" title="Working" class="att_work_header">#W</th>
    <th colspan="3" class="text-center att_in_header" height="10" >Clock In</th>
    <th colspan="3" class="text-center att_out_header">Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="Not Showing" class="att_in_header">N</th>
    <th width="20" title="Leave" class="att_in_header">L</th>
    <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
    <th width="20" title="Not Showing" class="att_out_header">N</th>
    <th width="20" title="Leave" class="att_out_header">L</th>
    <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
    </tr>'.$intern_attendance_details1.'<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td ><p class="class_name"> Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo"onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'all\')"><strong>'.($total_intern_student+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'Forenoon Not Showing\')"><strong>'.($total_intern_lp['mab']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'Forenoon Leave\')"><strong>'.($total_intern_lp['m_l_ap']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'Forenoon Leave Approval\')"><strong>'.($total_intern_lp['m_l_apr']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'Afternoon Not Showing\')"><strong>'.($total_intern_lp['eab']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'Afternoon Leave\')"><strong>'.($total_intern_lp['e_l_ap']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'Afternoon Leave Approval\')"><strong>'.($total_intern_lp['e_l_apr']+0).'</strong></p></td>
    </tr>
     </table>';
}
if($intern_attendance_details2)
{
$intern_attendance_details2='<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
<tr class="td_head_color">
  <th width="40" rowspan="2"> &nbsp; Dept.</th>
  <th width="30" rowspan="2" title="Total" class="att_work_header">#T</th>
  <th colspan="2" class="text-center att_in_header" height="10" >Personal</th>
  <th colspan="2" class="text-center att_out_header">Official</th>
  </tr>
  <tr class="td_head_color">
  <th width="20" height="10" title="Apply" class="att_in_header">A</th>
  <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
  <th width="20" title="Apply" class="att_out_header">A</th>
  <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
  </tr>'.$intern_attendance_details2.'
  <tr class="td_bottom_border" bgcolor="#F4F4F4">
<td nowrap><p class="class_name" > Total </p></td>
<td class="att_work_header"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Personal & Official\')"><strong>'.($total_intern_lp['pr_tot']+0).'</strong></p></td>
<td class="att_in_header ar"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Personal\')"><strong>'.($total_intern_lp['pe_tot_apply']+0).'</strong></p></td>
<td class="att_in_header ar"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Personal Approve\')">'.($total_intern_lp['pe_tot_approve']+0).'</p></td>
<td class="att_out_header ar"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Official\')"><strong>'.($total_intern_lp['of_tot_apply']+0).'</strong></p></td>
<td class="att_out_header ar"><p class="class_name cinfo" onclick="callinternpermission(\'\',\''.$current_date.'\',\'Official Approve\')">'.($total_intern_lp['of_tot_approve']+0).'</p></td>
</tr>
</table>';
}


//$last_atime=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT log_timestamp FROM log_tb WHERE log_page='cron' AND log_operation='Sync' ORDER BY log_timestamp DESC LIMIT 0,1"));
$last_atime=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT upload_dt FROM $tbl_name  ORDER BY upload_dt DESC LIMIT 0,1"));




$attendance_details[0]= '  <div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-bar-chart"></i>
      </span>
      <h3>Internship Attendance</h3>
  </div>
  <div class="dashboard-panel no-padding">
  <div class="weather-bg">
      <div class="panel-body">
          <div class="row">
              <div class="col-xs-6">
                Clock IN
                <div class="degree cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'in\')">
                      '.($total_intern_in+0).'
                </div>
              </div>
              <div class="col-xs-6 border-left">
                Clock Out
                <div class="degree cinfo" onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'out\')">
                      '.($total_intern_out+0).'
                </div>
              </div>
          </div>
      </div>
  </div>
  
 <footer class="weather-category cinfo"  onclick="call_internatt(\'\',\''.strtotime($current_date).'\',\'all\')">
      <ul>
          <li>
              of '.($total_intern_student+0).'
              <small style="font-size:11px; color:#333; line-height:30px;"> <br> Last sync: '.date('d-m-Y h:i a',strtotime($last_atime[0])).'</small>
          </li>
      </ul>
  </footer>
   </div>
  </section>
</div>';

   $attendance_details[1]='<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-calendar"></i>
      </span>
      <h3>Internship Attendance (Batch)</h3>
  </div>
  <div class="dashboard-panel no-padding">
  '.$intern_attendance_details.'

   </div>
  </section>
</div>';

$attendance_details[3]='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>Internship Leave/Absent</h3>
      </div>
<div class="dashboard-panel no-padding">'.$intern_attendance_details1.'</div></section> </div>';


$attendance_details[4]='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>Internship Permission</h3>
      </div>
<div class="dashboard-panel no-padding">'.$intern_attendance_details2.'</div></section> </div>';

$attendance_details[2]='<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-user-following"></i>
      </span>
      <h3>U.G Attendance (Reg.)</h3>
  </div>


  <div class="dashboard-panel">
  <table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="100" ><p class="staff_period">Course</p></th>';
if($student_authetication_str=='')
  $attendance_details[2].='<th width="25" ><p class="staff_period">#T</p></th>';

foreach($period_details as $period)
$attendance_details[2].='<th width="25" ><p class="staff_period">'.$period.'</p></th>';

$attendance_details[2].='
    </tr>
    '.$class_attendance_details['regular'].'
  </table></div></section>
</div>';
    
$attendance_details[9]='<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-user-following"></i>
      </span>
      <h3>U.G Attendance (Add.)</h3>
  </div>


  <div class="dashboard-panel">
  <table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="100" ><p class="staff_period">Course</p></th>';
if($student_authetication_str=='')
  $attendance_details[9].='<th width="25" ><p class="staff_period">#T</p></th>';

foreach($period_details as $period)
$attendance_details[9].='<th width="25" ><p class="staff_period">'.$period.'</p></th>';

$attendance_details[9].='
    </tr>
    '.$class_attendance_details['additional'].'
  </table></div></section>
</div>';


$attendance_details[5]= '  <div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-bar-chart"></i>
      </span>
      <h3>P.G Attendance</h3>
  </div>
  <div class="dashboard-panel no-padding">
  <div class="weather-bg">
      <div class="panel-body">
          <div class="row">
              <div class="col-xs-6">
                Clock IN
                <div class="degree cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'in\')">
                      '.($pg_late_permission['in']+0).'
                </div>
              </div>
              <div class="col-xs-6 border-left">
                Clock Out
                <div class="degree cinfo" onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'out\')">
                      '.($pg_late_permission['out']+0).'
                </div>
              </div>
          </div>
      </div>
  </div>
  <footer class="weather-category cinfo"  onclick="call_pgatt(\'\',\''.strtotime($current_date).'\',\'all\')">
      <ul>
          <li>
              of '.($pg_late_permission['tot']+0).' 
          </li>
      </ul>
  </footer>
   </div>
  </section>
</div>';
    
$attendance_details[6]='<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-calendar"></i>
      </span>
      <h3>P.G Attendance (Dept.)</h3>
  </div>
  <div class="dashboard-panel no-padding">
  '.$pg_attendance_details.'

   </div>
  </section>
</div>';

$attendance_details[7]='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>P.G Leave/Absent</h3>
      </div>
<div class="dashboard-panel no-padding">'.$pg_attendance_details1.'</div></section> </div>';


$attendance_details[8]='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>P.G Permission</h3>
      </div>
<div class="dashboard-panel no-padding">'.$pg_attendance_details2.'</div></section> </div>';
 
return $attendance_details;
}

function student_details($current_date,$academic_year_array)
{
$final_course_list=array(); 
$final_course_details=array();;
$year_str=array('0'=>'','1'=>'I - ','2'=>'II - ','3'=>'III - ','4'=>'IV - ','5'=>'Int. - ','6'=>'VI - ','7'=>'VII - ','8'=>'VIII - ','9'=>'IX - ','10'=>'X - '); 
 

$sql_course=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(course_name) FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC");
while(($row_course=mysqli_fetch_array($sql_course))!=false)
{
$ref_course_name=$row_course[0];
$acyear_search=array();
if($ref_course_name=='U.G'){
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular']; 
    $academic_year_ref1=$academic_year_array[$ref_course_name]['additional'];  ; 
    
    $acyear_search=array('regular' => $academic_year_ref, 'additional' => $academic_year_ref1);
}
else{
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular'];   
    $acyear_search=array('regular' => $academic_year_ref);
} 
 

$sql_degree=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM basic_setup_course_tb WHERE course_name="'.$ref_course_name.'"   AND del=1 ORDER BY course_name ASC');
if(mysqli_num_rows($sql_degree)>0)
{
 
$total_student_year=array();
while(($row_degree=mysqli_fetch_array($sql_degree))!=false)
{
$course_id=$row_degree['id']; 
$course_duration=$row_degree['course_duration'];
   
foreach($acyear_search as $abatch => $ayear){
for($cx=1;$cx<=$course_duration;$cx++)
{
 
$m_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$course_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='Male' AND B.del=1  AND B.academic_year='$ayear'AND B.academic_batch='$abatch'  AND B.current_year='$cx' "));
$f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$course_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='Female' AND B.del=1 AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' "));

$f_count=$f_result_stu[0];
$m_count=$m_result_stu[0];
    
$total_student_year[$abatch][$cx]['m']+=$m_count;
$total_student_year[$abatch][$cx]['f']+=$f_count;
$total_student_year[$abatch][$cx]['t']+=$m_count+$f_count;
     
 
}   
}
}

$final_ctemp1=array();
$course_total=array();
foreach($total_student_year as $ctype => $cdetails){
  foreach($cdetails as $cx => $cstrength){
    $final_ctemp1[$ctype].='<tr class="td_bottom_border">
        <td height="20"><small>'.$year_str[$cx].' Year</small></td>
        <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><span class="cinfo"  onclick="callstudent(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'t\',\''.$ctype.'\')">'.($cstrength['t']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'m\',\''.$ctype.'\')">'.($cstrength['m']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'f\',\''.$ctype.'\')">'.($cstrength['f']+0).'</span></td>
        </tr>';
      
        $course_total[$ctype]['m']+=$cstrength['m'];
        $course_total[$ctype]['f']+=$cstrength['f'];
        $course_total[$ctype]['t']+=$cstrength['t'];
      
        $total_student[$ctype]['m']+=$cstrength['m'];
        $total_student[$ctype]['f']+=$cstrength['f'];
        $total_student[$ctype]['t']+=$cstrength['t']; 
      
  }
}
    
foreach($total_student_year as $ctype => $cdetails){ 
    $final_course_details[$ctype].='<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">'.$ref_course_name.'</p></td> 
    <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><p class="class_name cinfo"  onclick="callstudent(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'t\',\''.$ctype.'\')"><strong>'.($course_total[$ctype]['t']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'m\',\''.$ctype.'\')"><strong>'.($course_total[$ctype]['m']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'f\',\''.$ctype.'\')"><strong>'.($course_total[$ctype]['f']+0).'</strong></p></td>
    </tr>'.$final_ctemp1[$ctype];
}
  
}
}
    
 
    

$final_reg_course_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-users"></i>
          </span>
          <h3>Student Details (Reg.)</h3>
          <span class="rev-combo pull-right">
            '.($total_student['t']).'
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130"  ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" title="Boys">#B</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Girls">#G</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td  ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['regular']['t'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['regular']['m'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['regular']['f'].'</strong></p></td>
      </tr>
        '.$final_course_details['regular'].' </table></div></section>
</div>';
    
    
$final_add_course_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-users"></i>
          </span>
          <h3>Student Details (Add.)</h3>
          <span class="rev-combo pull-right">
            '.($total_student['t']).'
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130" ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" title="Boys">#B</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Girls">#G</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['additional']['t'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['additional']['m'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['additional']['f'].'</strong></p></td>
      </tr>
        '.$final_course_details['additional'].' </table></div></section>
</div>';
 


return  array($final_reg_course_details,$final_add_course_details);
}

function staff_details($current_date)
{

  $staff_id_search_str=staffAuthentication('A.');

$sql_staff="SELECT COUNT( A.id ) , B.category_name, B.id
FROM staff_profile_tb AS A
INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
WHERE A.del =1 AND B.del=1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date')
AND B.category = 'Category' $staff_id_search_str
GROUP BY B.id
ORDER BY B.category_order ASC ";
 
$final_info_temp='<tr class="td_head_color">
      <th width="190" ><p class="staff_period">Category</p></th>
      <th  align="right" width="100" ><p class="staff_period" >#T</p></th>
      </th>';
$result_staff=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_staff);
$total_staff=0;
while(($row_staff=mysqli_fetch_array($result_staff))!=false)
{
  $category_count=$row_staff[0];
  $category_name=$row_staff[1];
  $category_id=$row_staff[2];

  $final_info_temp.='<tr class="td_bottom_border">
  <td ><p class="class_name" style="padding-left:10px;">'.stripslashes($category_name).'</p></td><td width="'.$col_width.'"  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstaff(\''.$category_id.'\',\''.$current_date.'\')">'.$category_count.'</p></td></tr>';
  $total_staff+=$category_count;
}

$final_course_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-users"></i>
      </span>
      <h3>Staff Details</h3>
      <span class="rev-combo pull-right">
        '.($total_staff).'
      </span>
  </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">

        '.$final_info_temp.' </table></div></section>
</div>';

return $final_course_details;
}

function staff_attendance($current_date)
{
  $total_staff_count=0;
  $total_in_count=0;
  $total_out_count=0;
  include_once('staff_attendance.php');
 

  $attendance_details[1]='
  <div class="col-sm-4 dashboard-container">
    <section class="panel">
        <div class="revenue-head">
            <span>
                <i class="icon-user-following"></i>
            </span>
            <h3>Staff Attendance (Incampus)</h3>
        </div>
  <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2">Cat.</th>
    <th width="30" rowspan="2" title="Total">#T</th>
    <th width="30" rowspan="2" title="Working" class="att_work_header">#W</th>
    <th colspan="3" class="text-center att_in_header" height="10" >Clock In</th>
    <th colspan="3" class="text-center att_out_header">Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="IN" class="att_in_header">I</th>
    <th width="20" title="Late" class="att_in_header">L</th>
    <th width="20" title="Premission" class="att_in_header">P</th>
    <th width="20" title="Out" class="att_out_header">O</th>
    <th width="20" title="Late" class="att_out_header">L</th>
    <th width="20" title="Premission" class="att_out_header">P</th>
    </tr>';

    $attendance_details[2]='
    <div class="col-sm-4 dashboard-container">
      <section class="panel">
          <div class="revenue-head">
              <span>
                  <i class="icon-user-unfollow"></i>
              </span>
              <h3>Staff Leave/Absent</h3>
          </div>
    <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
    <tr class="td_head_color">
      <th width="40" rowspan="2">Cat.</th>
      <th width="30" rowspan="2" title="Total">#T</th>
      <th width="30" rowspan="2" title="Working" class="att_work_header">#W</th>
      <th colspan="3" class="text-center att_in_header" height="10" >Clock In</th>
      <th colspan="3" class="text-center att_out_header">Clock Out</th>
      </tr>
      <tr class="td_head_color">
      <th width="20" height="10" title="Not Showing" class="att_in_header">N</th>
      <th width="20" title="Leave" class="att_in_header">L</th>
      <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
      <th width="20" title="Not Showing" class="att_out_header">N</th>
      <th width="20" title="Leave" class="att_out_header">L</th>
      <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
      </tr>';
  $category_wise_att=array();
  $total_att_array=array();
  $staff_id_search_str=staffAuthentication('A.');
  $sql_staff=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT  A.id , A.staff_id, A.att_category, B.category_sname, B.id
  FROM staff_profile_tb AS A
  INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
  WHERE A.del =1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date')
  AND B.category = 'Category'
  AND B.category_name!='hostel'
  AND B.category_name!='Teaching Basic Science'
  AND B.category_name!='College Support' $staff_id_search_str ORDER BY B.category_order ASC ");
  while(($row_staff=mysqli_fetch_array($sql_staff))!=false)
  {
    $st_id=$row_staff[0];
    $staff_id=$row_staff[1];
    $att_category=$row_staff[2];
    $category_name=$row_staff[3];
    $cat_id=$row_staff[4];

    $late_permission=getLPTime($att_category);
    $attendance_status=getAttendance($st_id,$staff_id,$current_date,$late_permission,'actual');

    $category_wise_att[$cat_id]['name']=$category_name;
    $category_wise_att[$cat_id]['total']++;
    $l_apply=0;
    if($attendance_status['s']!='H')
    {
      $category_wise_att[$cat_id]['w']++;
      $row_l=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT status,id FROM att_leave_request_more WHERE del=1 AND req_date='$current_date' AND staff_id='$st_id' AND (r_session='fullday' OR r_session='forenoon') AND status<=1"));
      if($row_l[1])
      {
      $category_wise_att[$cat_id]['f_leave']++;
      if($row_l[0]==1)
      $category_wise_att[$cat_id]['f_approve']++;
      $l_apply++;
      }

      $row_l=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT status,id FROM att_leave_request_more WHERE del=1 AND req_date='$current_date' AND staff_id='$st_id' AND (r_session='fullday' OR r_session='afternoon') AND status<=1"));
      if($row_l[1])
      {
      $category_wise_att[$cat_id]['a_leave']++;
      if($row_l[0]==1)
      $category_wise_att[$cat_id]['a_approve']++;
      $l_apply++;
      }
      if($l_apply==0)$category_wise_att[$cat_id]['la_total']++;
    }
    if($attendance_status['mt'])$category_wise_att[$cat_id]['in']++;
    if($attendance_status['et'])$category_wise_att[$cat_id]['out']++;
    if($attendance_status['m']=='la')$category_wise_att[$cat_id]['late']++;
    if($attendance_status['m']=='pe')$category_wise_att[$cat_id]['permission']++;
    if($attendance_status['e']=='la')$category_wise_att[$cat_id]['o_late']++;
    if($attendance_status['e']=='pe')$category_wise_att[$cat_id]['o_permission']++;
    if($attendance_status['m']=='a')$category_wise_att[$cat_id]['f_absent']++;
    if($attendance_status['e']=='a')$category_wise_att[$cat_id]['a_absent']++;



  }

  foreach($category_wise_att as $cid => $c_details)
  {
    $total_att_array['total']+=$c_details['total'];
    $total_att_array['la_total']+=$c_details['la_total'];
    $total_att_array['w']+=$c_details['w'];
    $total_att_array['in']+=$c_details['in'];
    $total_att_array['out']+=$c_details['out'];
    $total_att_array['late']+=$c_details['late'];
    $total_att_array['permission']+=$c_details['permission'];
    $total_att_array['o_late']+=$c_details['o_late'];
    $total_att_array['o_permission']+=$c_details['o_permission'];
    $total_att_array['f_approve']+=$c_details['f_approve'];
    $total_att_array['a_approve']+=$c_details['a_approve'];
    $total_att_array['f_leave']+=$c_details['f_leave'];
    $total_att_array['a_leave']+=$c_details['a_leave'];

    $attendance_details[1].='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > '.$c_details['name'].' </p></td>
    <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>'.$c_details['total'].'</strong></p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'working\')"><strong>'.$c_details['w'].'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'in\')"><strong>'.($c_details['in']+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'late\')">'.($c_details['late']+0).'</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'permission\')">'.($c_details['permission']+0).'</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'out\')"><strong>'.($c_details['out']+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'out late\')">'.($c_details['o_late']+0).'</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'out permission\')">'.($c_details['o_permission']+0).'</p></td>
    </tr>';

    $attendance_details[2].='<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > '.$c_details['name'].' </p></td>
    <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>'.$c_details['total'].'</strong></p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'working\')"><strong>'.$c_details['w'].'</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'Forenoon Not Showing\')"><strong>'.($c_details['w']-($c_details['in']+0)+0).'</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'Forenoon Leave\')">'.($c_details['f_leave']+0).'</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'Forenoon Leave Approval\')">'.($c_details['f_approve']+0).'</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'Afternoon Not Showing\')"><strong>'.($c_details['w']-($c_details['out']+0)+0).'</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'Afternoon Leave\')">'.($c_details['a_leave']+0).'</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt(\''.$cid.'\',\''.$current_date.'\',\'Afternoon Leave Approval\')">'.($c_details['a_approve']+0).'</p></td>
    </tr>';

  }
  $attendance_details[1].='<tr class="td_bottom_border" bgcolor="#F4F4F4">
  <td ><p class="class_name"> Total </p></td>
  <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>'.$total_att_array['total'].'</strong></p></td>
  <td class="att_work_header"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'working\')"><strong>'.$total_att_array['w'].'</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'in\')"><strong>'.($total_att_array['in']+0).'</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'late\')"><strong>'.($total_att_array['late']+0).'</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'permission\')"><strong>'.($total_att_array['permission']+0).'</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'out\')"><strong>'.($total_att_array['out']+0).'</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'out late\')"><strong>'.($total_att_array['o_late']+0).'</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'out permission\')"><strong>'.($total_att_array['o_permission']+0).'</strong></p></td>
  </tr>';


  $attendance_details[2].='<tr class="td_bottom_border" bgcolor="#F4F4F4">
  <td ><p class="class_name"> Total </p></td>
  <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>'.$total_att_array['total'].'</strong></p></td>
  <td class="att_work_header"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'working\')"><strong>'.$total_att_array['w'].'</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'Forenoon Not Showing\')"><strong>'.($total_att_array['w']-($total_att_array['in']+0)+0).'</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'Forenoon Leave\')"><strong>'.($total_att_array['f_leave']+0).'</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'Forenoon Leave Approval\')"><strong>'.($total_att_array['f_approve']+0).'</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'Afternoon Not Showing\')"><strong>'.($total_att_array['w']-($total_att_array['out']+0)+0).'</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'Afternoon Leave\')"><strong>'.($total_att_array['a_leave']+0).'</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'Afternoon Leave Approval\')"><strong>'.($total_att_array['a_approve']+0).'</strong></p></td>
  </tr>';

  $attendance_details[1].=' </table></div></section> </div>';
    $attendance_details[2].=' </table></div></section> </div>';

    //$last_atime=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT log_timestamp FROM log_tb WHERE log_page='cron' AND log_operation='Sync' ORDER BY log_timestamp DESC LIMIT 0,1"));
$tbl_name='punchtimedetails_'.date('Y',strtotime($current_date)).ceil(date('m',strtotime($current_date))/4);
    $last_atime=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT upload_dt FROM $tbl_name  ORDER BY upload_dt DESC LIMIT 0,1"));
//echo "SELECT upload_dt FROM $tbl_name  ORDER BY upload_dt DESC LIMIT 0,1";
  $attendance_details[0]='  <div class="col-sm-4 dashboard-container">
    <section class="panel">
    <div class="revenue-head">
        <span>
            <i class="icon-speedometer"></i>
        </span>
        <h3>Staff Attendance</h3>
    </div>
    <div class="dashboard-panel no-padding">
    <div class="weather-bg">
        <div class="panel-body">
            <div class="row">
                <div class="col-xs-6">
                    Clock In
                    <div class="degree cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'in\')">
                        '.($total_att_array['in']).'
                    </div>
                </div>
                <div class="col-xs-6 border-left">
                  Clock Out
                    <div class="degree cinfo" onclick="callstaffatt(\'\',\''.$current_date.'\',\'out\')">
                        '.($total_att_array['out']).'
                    </div>
                </div>
            </div>
        </div>
    </div>
    <footer class="weather-category">
        <ul>
            <li>
                <span style="font-size:26px; line-height:50px;">of '.($total_att_array['w']+0).' | '.($total_att_array['la_total']+0).'</span>
                <small style="font-size:11px; color:#333; line-height:30px;"> <br> Last sync: '.date('d-m-Y h:i a',strtotime($last_atime[0])).'</small>
            </li>
        </ul>
    </footer>
     </div>
    </section>
  </div>';
return $attendance_details;
}

function staff_permission($current_date)
{
  $total_staff_count=0;
  $total_in_count=0;
  $total_out_count=0;
  include_once('staff_attendance.php');

  $attendance_details='
  <div class="col-sm-4 dashboard-container">
    <section class="panel">
        <div class="revenue-head">
            <span>
                <i class="icon-user-follow"></i>
            </span>
            <h3>Staff Permission </h3>
        </div>
  <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2">Cat.</th>
    <th width="30" rowspan="2" title="Total" class="att_work_header">#T</th>
    <th colspan="2" class="text-center att_in_header" height="10" >Personal</th>
    <th colspan="2" class="text-center att_out_header">Official</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="Apply" class="att_in_header">A</th>
    <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
    <th width="20" title="Apply" class="att_out_header">A</th>
    <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
    </tr>';
    $category_wise_att=array();
    $total_att_array=array();
  $staff_id_search_str=staffAuthentication('A.');
  $staff_id_search_str1=str_replace('A.', 'B.', $staff_id_search_str);
    $sql_c_academic="Select DISTINCT(B.id),B.category_sname from staff_profile_tb AS A INNER JOIN edu_setup_tb AS B ON A.job_category = B.id where A.del=1 AND (A.releaving_date > '$current_date' OR A.releaving_date='0000-00-00') AND B.category='Category'  AND B.category_name!='hostel'
    AND B.category_name!='Teaching Basic Science'
    AND B.category_name!='College Support' '.$staff_id_search_str.' ORDER BY A.job_category ASC ";
    $result_c_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_c_academic);
    while(($row_c_academic=mysqli_fetch_array($result_c_academic))!=false)
    {
      $cid=$row_c_academic[0];
      $category_name=$row_c_academic[1];
      $category_wise_att=array();
    $sql_l=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.status, A.p_type FROM att_permission_request AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id WHERE A.del=1 AND DATE(A.from_date)='$current_date' AND A.status<=1 AND B.del=1 AND B.job_category='$cid' $staff_id_search_str1 AND (B.releaving_date > '$current_date' OR B.releaving_date='0000-00-00')");
      while(($row_l=mysqli_fetch_array($sql_l))!=false)
      {
      if($row_l[1]){
      $category_wise_att[$row_l[1]]['apply']++;
      if($row_l[0]==1)
      $category_wise_att[$row_l[1]]['approve']++;
      }
      }
      $tapply=$category_wise_att['personal']['apply']+$category_wise_att['official']['apply']+0;
      $total_att_array['personal']['apply']+=$category_wise_att['personal']['apply'];
      $total_att_array['personal']['approve']+=$category_wise_att['personal']['approve'];
      $total_att_array['official']['apply']+=$category_wise_att['official']['apply'];
      $total_att_array['official']['approve']+=$category_wise_att['official']['approve'];
      $total_att_array['total']+=$tapply;
      if($tapply>0){
      $attendance_details.='<tr class="td_bottom_border">
      <td nowrap><p class="class_name" > '.$category_name.' </p></td>
      <td class="att_work_body"><p class="class_name cinfo" onclick="callstaffpermission(\''.$cid.'\',\''.$current_date.'\',\'Personal & Official\')"><strong>'.$tapply.'</strong></p></td>
      <td class="att_in_body"><p class="class_name cinfo" onclick="callstaffpermission(\''.$cid.'\',\''.$current_date.'\',\'Personal\')"><strong>'.($category_wise_att['personal']['apply']+0).'</strong></p></td>
      <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffpermission(\''.$cid.'\',\''.$current_date.'\',\'Personal Approve\')">'.($category_wise_att['personal']['approve']+0).'</p></td>
      <td class="att_out_body"><p class="class_name cinfo" onclick="callstaffpermission(\''.$cid.'\',\''.$current_date.'\',\'Official\')"><strong>'.($category_wise_att['official']['apply']+0).'</strong></p></td>
      <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffpermission(\''.$cid.'\',\''.$current_date.'\',\'Official Approve\')">'.($category_wise_att['official']['approve']+0).'</p></td>
      </tr>';
      }
    }

    if($total_att_array['total']>0){
    $attendance_details.='<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td nowrap><p class="class_name" > Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo" onclick="callstaffpermission(\'\',\''.$current_date.'\',\'Personal & Official\')"><strong>'.$total_att_array['total'].'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffpermission(\'\',\''.$current_date.'\',\'Personal\')"><strong>'.($total_att_array['personal']['apply']+0).'</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffpermission(\'\',\''.$current_date.'\',\'Personal Approve\')">'.($total_att_array['personal']['approve']+0).'</p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffpermission(\'\',\''.$current_date.'\',\'Official\')"><strong>'.($total_att_array['official']['apply']+0).'</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffpermission(\'\',\''.$current_date.'\',\'Official Approve\')">'.($total_att_array['official']['approve']+0).'</p></td>
    </tr>';
    }
   $attendance_details.='</table></div></section> </div>';

return $attendance_details;
}

 

function student_academic($current_date,$academic_year_array)
{
$final_course_list=array(); 
$final_course_details='';
$year_str=array('0'=>'','1'=>'I - ','2'=>'II - ','3'=>'III - ','4'=>'IV - ','5'=>'Int. - ','6'=>'VI - ','7'=>'VII - ','8'=>'VIII - ','9'=>'IX - ','10'=>'X - '); 
 

$sql_course=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(course_name) FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC");
while(($row_course=mysqli_fetch_array($sql_course))!=false)
{
$ref_course_name=$row_course[0];
$acyear_search=array();
if($ref_course_name=='U.G'){
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular']; 
    $academic_year_ref1=$academic_year_array[$ref_course_name]['additional'];  ; 
    
    $acyear_search=array('regular' => $academic_year_ref, 'additional' => $academic_year_ref1);
}
else{
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular'];   
    $acyear_search=array('regular' => $academic_year_ref);
} 
 

$sql_degree=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM basic_setup_course_tb WHERE course_name="'.$ref_course_name.'"   AND del=1 ORDER BY course_name ASC');
if(mysqli_num_rows($sql_degree)>0)
{
 
$total_student_year=array();
while(($row_degree=mysqli_fetch_array($sql_degree))!=false)
{
$course_id=$row_degree['id']; 
$course_duration=$row_degree['course_duration'];
   
foreach($acyear_search as $abatch => $ayear){
for($cx=1;$cx<=$course_duration;$cx++)
{
$result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$course_id'  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND B.del=1 AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' AND A.scholar_ship='1' AND A.caste_scholar_ship='scst'"));
$scst_count=$result_stu[0]+0;
$result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$course_id'  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND B.del=1 AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' AND A.scholar_ship='1' AND A.caste_scholar_ship='bc'"));
$bc_count=$result_stu[0]+0;
$result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$course_id'  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND B.del=1 AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' AND A.scholar_ship='1' AND A.caste_scholar_ship='mbc'"));
$mbc_count=$result_stu[0]+0;
    
$result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$course_id'  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND B.del=1 AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' AND A.first_graduate='1'"));
$fg_count=$result_stu[0]+0;
    
   
    
$total_student_year[$cx]['s']+=$scst_count;
$total_student_year[$cx]['b']+=$bc_count;
$total_student_year[$cx]['m']+=$mbc_count;
$total_student_year[$cx]['f']+=$fg_count;
$total_student_year[$cx]['t']+=$scst_count+$bc_count+$mbc_count+$fg_count;
     
 
}   
}
}

$final_ctemp1='';
$course_total=array(); 
  foreach($total_student_year as $cx => $cstrength){
    $final_ctemp1.='<tr class="td_bottom_border">
        <td height="20"><small>'.$year_str[$cx].' Year</small></td>
        <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><span class="cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'t\')">'.($cstrength['t']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'s\')">'.($cstrength['s']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'b\')">'.($cstrength['b']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'m\')">'.($cstrength['m']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'f\')">'.($cstrength['f']+0).'</span></td>
        </tr>';
      
        $course_total['s']+=$cstrength['s'];
        $course_total['b']+=$cstrength['b'];
        $course_total['m']+=$cstrength['m'];
        $course_total['f']+=$cstrength['f'];
        $course_total['t']+=$cstrength['t'];
       
        $total_student['s']+=$cstrength['s'];
        $total_student['b']+=$cstrength['b'];
        $total_student['m']+=$cstrength['m'];
        $total_student['f']+=$cstrength['f'];
        $total_student['t']+=$cstrength['t'];
      
  } 
    
 
    $final_course_details.='<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">'.$ref_course_name.'</p></td> 
    <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><p class="class_name cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'t\')"><strong>'.($course_total['t']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'s\')"><strong>'.($course_total['s']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'b\')"><strong>'.($course_total['b']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'m\')"><strong>'.($course_total['m']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'f\')"><strong>'.($course_total['f']+0).'</strong></p></td>
    </tr>'.$final_ctemp1;
 
  
}
}
    
 
    

$final_reg_course_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-bar-chart"></i>
          </span>
          <h3>Scholarship</h3> 
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130"  ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" >#SC/ST</p></th>
  <th width="55"  align="center" ><p class="staff_period"  >#BC</p></th>
  <th width="55"  align="center" ><p class="staff_period" >#MBC</p></th>
  <th width="55"  align="center" ><p class="staff_period" >#1<sup>st</sup>Grad.</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td  ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['t'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['s'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['b'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['m'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['f'].'</strong></p></td> 
      </tr>
        '.$final_course_details.' </table></div></section>
</div>';
    
     

return   $final_reg_course_details  ;
}

function student_hostel_details($current_date,$academic_year_array)
{
$final_course_list=array(); 
$final_course_details='';
$year_str=array('0'=>'','1'=>'I - ','2'=>'II - ','3'=>'III - ','4'=>'IV - ','5'=>'Int. - ','6'=>'VI - ','7'=>'VII - ','8'=>'VIII - ','9'=>'IX - ','10'=>'X - '); 
 

$sql_course=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(course_name) FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC");
while(($row_course=mysqli_fetch_array($sql_course))!=false)
{
$ref_course_name=$row_course[0];
$acyear_search=array();
if($ref_course_name=='U.G'){
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular']; 
    $academic_year_ref1=$academic_year_array[$ref_course_name]['additional'];  ; 
    
    $acyear_search=array('regular' => $academic_year_ref, 'additional' => $academic_year_ref1);
}
else{
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular'];   
    $acyear_search=array('regular' => $academic_year_ref);
} 
 

$sql_degree=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM basic_setup_course_tb WHERE course_name="'.$ref_course_name.'"   AND del=1 ORDER BY course_name ASC');
if(mysqli_num_rows($sql_degree)>0)
{
 
$total_student_year=array();
while(($row_degree=mysqli_fetch_array($sql_degree))!=false)
{
$course_id=$row_degree['id']; 
$course_duration=$row_degree['course_duration'];
   
foreach($acyear_search as $abatch => $ayear){
for($cx=1;$cx<=$course_duration;$cx++)
{

$m_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id INNER JOIN student_hostel_tb AS C ON A.id=C.s_id WHERE A.del=1 AND A.course_id='$course_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='Male' AND B.del=1  AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' AND C.del=1 AND (C.to_month='0000-00-00' OR C.to_month>'$current_date') $ft_str"));
$f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)) FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id INNER JOIN student_hostel_tb AS C ON A.id=C.s_id WHERE A.del=1 AND A.course_id='$course_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='Female' AND B.del=1  AND B.academic_year='$ayear'AND B.academic_batch='$abatch' AND B.current_year='$cx' AND C.del=1 AND (C.to_month='0000-00-00' OR C.to_month>'$current_date') $ft_str"));
    
 

$f_count=$f_result_stu[0];
$m_count=$m_result_stu[0];
    
$total_student_year[$cx]['m']+=$m_count;
$total_student_year[$cx]['f']+=$f_count;
$total_student_year[$cx]['t']+=$m_count+$f_count;
     
 
}   
}
}

$final_ctemp1='';
$course_total=array(); 
  foreach($total_student_year as $cx => $cstrength){
    $final_ctemp1.='<tr class="td_bottom_border">
        <td height="20"><small>'.$year_str[$cx].' Year</small></td>
        <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><span class="cinfo"  onclick="callstudentH(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'t\',\'\')">'.($cstrength['t']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentH(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'m\',\'\')">'.($cstrength['m']+0).'</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentH(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'f\',\'\')">'.($cstrength['f']+0).'</span></td>
        </tr>';
      
        $course_total['m']+=$cstrength['m'];
        $course_total['f']+=$cstrength['f'];
        $course_total['t']+=$cstrength['t'];
      
        $total_student['m']+=$cstrength['m'];
        $total_student['f']+=$cstrength['f'];
        $total_student['t']+=$cstrength['t']; 
      
  } 
    
 
    $final_course_details.='<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">'.$ref_course_name.'</p></td> 
    <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><p class="class_name cinfo"  onclick="callstudentH(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'t\',\'\')"><strong>'.($course_total['t']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudentH(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'m\',\'\')"><strong>'.($course_total['m']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudentH(\''.$ref_course_name.'\',\'\',\''.$current_date.'\',\'f\',\'\')"><strong>'.($course_total['f']+0).'</strong></p></td>
    </tr>'.$final_ctemp1;
 
  
}
}
    
 
    

$final_reg_course_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-home"></i>
          </span>
          <h3>Hostel</h3>
          <span class="rev-combo pull-right">
            '.($total_student['t']).'
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130"  ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" title="Boys">#B</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Girls">#G</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td  ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['t'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['m'].'</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>'.$total_student['f'].'</strong></p></td>
      </tr>
        '.$final_course_details.' </table></div></section>
</div>';
    
     

return  array($final_reg_course_details,$total_student['m'],$total_student['f']);
}

/////////Ladies & Gents Hostel/////////////////////
function student_hostel_details_att($current_date,$academic_year_array,$gender,$total_student)
{
    
$chart_title="Ladies Hostel Att.";
if($gender=='male')
$chart_title="Gents Hostel Att.";


$sql_cat='SELECT * FROM basic_setup_hostelatt WHERE del=1 AND  id="1" ';
$result_cat = mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_cat);
$rows_cat = mysqli_fetch_array($result_cat);
$p_out_from=$rows_cat['out_from'];
$p_out_to=$rows_cat['out_to'];
$p_in_from=$rows_cat['in_from'];
$p_in_to=$rows_cat['in_to'];
$mout_count=0;
$ein_count=0;
$hostel_count=0;


$final_course_list=array(); 
$final_course_details='';
$year_str=array('0'=>'','1'=>'I - ','2'=>'II - ','3'=>'III - ','4'=>'IV - ','5'=>'Int. - ','6'=>'VI - ','7'=>'VII - ','8'=>'VIII - ','9'=>'IX - ','10'=>'X - '); 
 

$sql_course=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT DISTINCT(course_name) FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC");
while(($row_course=mysqli_fetch_array($sql_course))!=false)
{
$ref_course_name=$row_course[0];
$acyear_search=array();
if($ref_course_name=='U.G'){
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular']; 
    $academic_year_ref1=$academic_year_array[$ref_course_name]['additional'];  ; 
    
    $acyear_search=array('regular' => $academic_year_ref, 'additional' => $academic_year_ref1);
}
else{
    $academic_year_ref=$academic_year_array[$ref_course_name]['regular'];   
    $acyear_search=array('regular' => $academic_year_ref);
} 
 

$sql_degree=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM basic_setup_course_tb WHERE course_name="'.$ref_course_name.'"   AND del=1 ORDER BY course_name ASC');
if(mysqli_num_rows($sql_degree)>0)
{
 

while(($row_degree=mysqli_fetch_array($sql_degree))!=false)
{
$course_id=$row_degree['id']; 
$course_duration=$row_degree['course_duration'];
  $total_student_years=array(); 
   $o_count_ab=$o_count=$i_count_ab=$i_count=0;
foreach($acyear_search as $abatch => $ayear){
for($cx=1;$cx<=$course_duration;$cx++)
{
    $ug_pg="";
    if($course_id==1)
    $ug_pg=" AND A.course_id='$course_id'";
    else
    $ug_pg=" AND A.course_id>1";
    
 $hostel_count=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)), A.course_id,  A.register_no, A.student_name, A.student_initial,  A.bregister_no FROM student_profile_tb AS A  INNER JOIN student_hostel_tb AS B ON A.id=B.s_id  INNER JOIN student_academic_tb AS D ON A.id=D.s_id WHERE A.del=1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='$gender'  AND B.del=1 AND (B.to_month='0000-00-00' OR B.to_month>'$current_date')  AND D.del=1  AND D.academic_year='$ayear' AND D.academic_batch='$abatch' AND D.current_year='$cx' $ug_pg "));

     $h_count=$hostel_count[0];

if($p_out_from && $p_out_to && $p_out_from!='00:00:00' && $p_out_to!='00:00:00')
{
  $i_ftime=$current_date.' '.$p_out_from;
  $i_ttime=$current_date.' '.$p_out_to;
  $mout_count=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)), A.course_id,  A.register_no, A.student_name, A.student_initial,  A.bregister_no, C.p_date FROM student_profile_tb AS A  INNER JOIN student_hostel_tb AS B ON A.id=B.s_id INNER JOIN hostel_att AS C ON TRIM(LEADING '0' FROM A.register_no)=TRIM(LEADING '0' FROM C.tktno) INNER JOIN student_academic_tb AS D ON A.id=D.s_id WHERE A.del=1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='$gender'  AND B.del=1 AND (B.to_month='0000-00-00' OR B.to_month>'$current_date') AND C.p_date>='$i_ftime' AND C.p_date<='$i_ttime' AND D.del=1  AND D.academic_year='$ayear' AND D.academic_batch='$abatch' AND D.current_year='$cx' AND A.course_id='$course_id' "));
   $o_count=$mout_count[0];
   $o_count_ab=$hostel_count[0]-$o_count[0];
   
}

if($p_in_from && $p_in_to && $p_in_from!='00:00:00' && $p_in_to!='00:00:00')
{
  $i_ftime=$current_date.' '.$p_in_from;
  $i_ttime=$current_date.' '.$p_in_to;
  $ein_count=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)), A.course_id,  A.register_no, A.student_name, A.student_initial,  A.bregister_no, C.p_date FROM student_profile_tb AS A  INNER JOIN student_hostel_tb AS B ON A.id=B.s_id INNER JOIN hostel_att AS C ON TRIM(LEADING '0' FROM A.register_no)=TRIM(LEADING '0' FROM C.tktno) INNER JOIN student_academic_tb AS D ON A.id=D.s_id WHERE A.del=1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='$gender'  AND B.del=1 AND (B.to_month='0000-00-00' OR B.to_month>'$current_date') AND C.p_date>='$i_ftime' AND C.p_date<='$i_ttime' AND D.del=1  AND D.academic_year='$ayear'AND D.academic_batch='$abatch' AND D.current_year='$cx' AND A.course_id='$course_id'"));
     $i_count=$ein_count[0];
     
     
}

     
$total_student_years[$cx]['h']+=$h_count; 
$total_student_years[$cx]['i']+=$i_count;
$total_student_years[$cx]['o']+=$o_count;
$total_student_years[$cx]['ia']+=$h_count-$i_count;
$total_student_years[$cx]['oa']+=$h_count-$o_count;
$total_student_years[$cx]['t']+=$i_count+$o_count;
    
 
}  //for 
} // foreach
}

$final_ctemp1='';
$course_totals=array(); 
$total_students=array(); 
  foreach($total_student_years as $cx => $cstrength){
    $final_ctemp1.='<tr class="td_bottom_border">
        <td height="20"><small>'.$year_str[$cx].' Year</small></td>
       <td class="att_work_body" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'h\',\''.$gender.'\')">'.($cstrength['h']+0).'</span></td>
        <td class="att_in_body" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'o\',\''.$gender.'\')">'.($cstrength['o']+0).'</span></td>
         <td class="att_in_body trans" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'oa\',\''.$gender.'\')">'.($cstrength['oa']+0).'</span></td>
        <td class="att_out_body" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'i\',\''.$gender.'\')">'.($cstrength['i']+0).'</span></td>
         <td class="att_out_body trans" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA(\''.$ref_course_name.'\',\''.$cx.'\',\''.$current_date.'\',\'ia\',\''.$gender.'\')">'.($cstrength['ia']+0).'</span></td>
        </tr>';
        $course_totals['h']+=$cstrength['h'];
        $course_totals['o']+=$cstrength['o'];
        $course_totals['i']+=$cstrength['i'];
        $course_totals['oa']+=$cstrength['oa'];
        $course_totals['ia']+=$cstrength['ia'];
        $course_totals['t']+=$cstrength['t'];
      
        $total_students['h']+=$cstrength['h'];
        $total_students['o']+=$cstrength['o'];
        $total_students['i']+=$cstrength['i'];
        $total_students['t']+=$cstrength['t']; 
      
  } 
    
 
    $final_course_details.='<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">'.$ref_course_name.'</p></td> 
   <td  style="text-align:right; padding-right:15px;" class="att_work_body"><p class="class_name "  ><strong>'.($course_totals['h']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_in_body"><p class="class_name " ><strong>'.($course_totals['o']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_in_body trans"><p class="class_name "  ><strong>'.($course_totals['oa']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_out_body"><p class="class_name "  ><strong>'.($course_totals['i']+0).'</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_out_body trans"><p class="class_name "  ><strong>'.($course_totals['ia']+0).'</strong></p></td>
    </tr>'.$final_ctemp1;
 
  
}
}
    
 
    

$final_reg_course_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-home"></i>
          </span>
          <h3>'.$chart_title.' </h3>
          <span class="rev-combo pull-right" style="display:none">
            '.($total_students['t']).'
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130" rowspan="2" ><p class="staff_period">Year</p></th>
   <th  class="att_work_header" width="55" rowspan="2" align="right"><p class="staff_period" title="Total">#Total</p></th>
      <th class="att_in_header" width="55" colspan="2" align="right"><p class="staff_period" title="Out">#Out</p></th>
  <th class="att_out_header" width="55" colspan="2"   align="right" ><p class="staff_period" title="In">#In</p></th>
      </tr>
      <tr class="td_head_color">
  <th width="20" height="10" title="Out Punch" class="att_in_header">Pre</th>
  <th width="20" title="Out NoPunch" class="att_in_header">Ab</th>
  <th width="20" title="In Punch" class="att_out_header">Pre</th>
  <th width="20" title="In NoPunch" class="att_out_header">Ab</th>
  </tr>
     
        '.$final_course_details.' </table></div></section>
</div>';
    
     

return  array($final_reg_course_details,$total_student['o'],$total_student['i']);
}

/////////////////////////////
function student_hostel_att_details($current_date,$academic_year_array,$gender,$total_student)
{


$chart_title="Ladies Hostel Attendance";
if($gender=='male')
$chart_title="Gents Hostel Attendance";




$sql_cat='SELECT * FROM basic_setup_hostelatt WHERE del=1 AND  id="1" ';
$result_cat = mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_cat);
$rows_cat = mysqli_fetch_array($result_cat);
$p_out_from=$rows_cat['out_from'];
$p_out_to=$rows_cat['out_to'];
$p_in_from=$rows_cat['in_from'];
$p_in_to=$rows_cat['in_to'];
$mout_count=0;
$ein_count=0;
if($p_out_from && $p_out_to && $p_out_from!='00:00:00' && $p_out_to!='00:00:00')
{
  $i_ftime=$current_date.' '.$p_out_from;
  $i_ttime=$current_date.' '.$p_out_to;
  $f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)), A.course_id,  A.register_no, A.student_name, A.student_initial,  A.bregister_no, C.p_date FROM student_profile_tb AS A  INNER JOIN student_hostel_tb AS B ON A.id=B.s_id INNER JOIN hostel_att AS C ON TRIM(LEADING '0' FROM A.register_no)=TRIM(LEADING '0' FROM C.tktno) WHERE A.del=1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='$gender'  AND B.del=1 AND (B.to_month='0000-00-00' OR B.to_month>'$current_date') AND C.p_date>='$i_ftime' AND C.p_date<='$i_ttime' "));
  $mout_count=$f_result_stu[0];
}

if($p_in_from && $p_in_to && $p_in_from!='00:00:00' && $p_in_to!='00:00:00')
{
  $i_ftime=$current_date.' '.$p_in_from;
  $i_ttime=$current_date.' '.$p_in_to;
  $f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(DISTINCT(A.id)), A.course_id,  A.register_no, A.student_name, A.student_initial,  A.bregister_no, C.p_date FROM student_profile_tb AS A  INNER JOIN student_hostel_tb AS B ON A.id=B.s_id INNER JOIN hostel_att AS C ON TRIM(LEADING '0' FROM A.register_no)=TRIM(LEADING '0' FROM C.tktno) WHERE A.del=1  AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$current_date') AND A.student_gender='$gender'  AND B.del=1 AND (B.to_month='0000-00-00' OR B.to_month>'$current_date') AND C.p_date>='$i_ftime' AND C.p_date<='$i_ttime' "));
  $ein_count=$f_result_stu[0];
}

//$last_atime=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT log_timestamp FROM log_tb WHERE log_page='cron_hostel' AND log_operation='Sync' ORDER BY log_timestamp DESC LIMIT 0,1"));
$last_atime=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT upload_dt FROM $tbl_name  ORDER BY upload_dt DESC LIMIT 0,1"));

$final_hostel_details='  <div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-speedometer"></i>
      </span>
      <h3>'.$chart_title.'</h3>
  </div>
  <div class="dashboard-panel no-padding">
  <div class="weather-bg">
      <div class="panel-body">
          <div class="row">
              <div class="col-xs-6">
                 Out
                  <div class="degree cinfo" onclick="callhostelatt(\'\',\''.$current_date.'\',\'out\',\''.$gender.'\')">
                      '.($mout_count+0).'
                  </div>
              </div>
              <div class="col-xs-6 border-left">
                IN
                  <div class="degree cinfo" onclick="callhostelatt(\'\',\''.$current_date.'\',\'in\',\''.$gender.'\')">
                      '.($ein_count+0).'
                  </div>
              </div>
          </div>
      </div>
  </div>
  <footer class="weather-category">
      <ul>
          <li>
              <span style="font-size:26px; line-height:50px;">of <a class="degree cinfo" onclick="callhostelatt_overall(\'\',\''.$current_date.'\',\'all\',\''.$gender.'\')">'.($total_student+0).'</a> </span>
<small style="font-size:11px; color:#333; line-height:30px;"> <br> Last sync: '.date('d-m-Y h:i a',strtotime($last_atime[0])).'</small>
          </li>
      </ul>
  </footer>
   </div>
  </section>
</div>';



return  $final_hostel_details;
}
function staff_current($current_date,$academic_year_array,$current_time)
{
  include_once('staff_attendance.php');
  $period_day=date('l',strtotime($current_date));
  $period_day_string=' AND (p_days="'.$period_day.'" OR p_days LIKE "'.$period_day.',%" OR p_days LIKE "%,'.$period_day.'" OR p_days LIKE "%,'.$period_day.',%")';


  $staff_id_search_str=staffAuthentication('');

  $sql_period=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT DISTINCT(period_no), course_name, academic_year, academic_type, from_time, to_time FROM  period_set_up WHERE del!=0 AND period_no!="Break" AND p_combined="0" '.$period_day_string.' AND from_time!="00:00:00" AND to_time!="00:00:00" AND from_time<="'.$current_time.'" AND to_time>="'.$current_time.'" ORDER BY  academic_year+0 ASC, period_no+0 ASC');
  $session_details=array();
  while(($row_period=mysqli_fetch_array($sql_period))!=false)
  {
  $period_no=$row_period[0];
  $course_name=$row_period[1];
  $academic_year=$row_period[2];
  $academic_type=$row_period[3];
  $from_time=$row_period[4];
  $to_time=$row_period[5];

  $session_details[$course_name][$academic_year][$academic_type][$period_no]['time']=substr($from_time,0,-3).' - '.substr($to_time,0,-3);
  $session_details[$course_name][$academic_year][$academic_type]['prd'].=" A.period='".$period_no."' OR ";
  }

  $total_staff_count=0;
  $total_in_count=0;
  $total_out_count=0;

  $current_staff_details=array();
  $f_staff_att=array();
  foreach($session_details as $course_name => $course_sub)
  {
      $sql_course=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM basic_setup_course_tb WHERE course_name="'.$course_name.'"  AND del=1 ORDER BY c_order ASC');
      while(($row_course=mysqli_fetch_array($sql_course))!=false)
       {
        $course_id=$row_course['id'];
        $degree_name=$row_course['degree_name'];
        $department_name=$row_course['department_short_name'];
        $degree_name=stripslashes($degree_name);
        $department_name=stripslashes($department_name);
        $academic_year_ref=$academic_year_array[$course_name]['regular'];
        if(trim($department_name)!='' && trim($department_name)!='-')
        $department_name='<br>'.$department_name;
        else
        $department_name='';
        foreach($course_sub as $current_year => $academic_sub)
        {
          $degree_name_str='<strong>'.convertNYear($current_year, $course_name).' '.$degree_name.'</strong>'.$department_name;
          foreach($academic_sub as $academic_type => $academic_period)
          {
            if($academic_period['prd'])
            {
              $prd_str=" AND (".substr($academic_period['prd'],0,-3).")";
             $sql_time=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT A.staff_id, A.batch_no, A.period, B.subject_id, B.subject_name, B.subject_category, B.s_batch, B.room_no FROM timetable_tb_new AS A INNER JOIN basic_subject_tt_tb AS B ON A.subject_id=B.id  WHERE A.del=1 AND B.del=1 AND A.course_id='$course_id' AND A.academic_year='$academic_year_ref' AND A.current_year='$current_year' AND A.academic_type='$academic_type' AND A.t_day='$period_day' AND A.from_date<='$current_date' AND A.from_date!='0000-00-00' AND (A.to_date>='$current_date' OR A.to_date='0000-00-00') $prd_str  ORDER BY B.subject_id ASC");

               while(($row_time=mysqli_fetch_array($sql_time))!=false)
              {
                  $t_staff_id=$row_time[0];
                  $t_batch_no=$row_time[1];
                  $t_period=$row_time[2];
                  $t_subject_id=$row_time[3];
                  $t_subject_name=$row_time[4];
                  $t_subject_category=$row_time[5];
                  $t_s_batch=$row_time[6];
                  $t_room_no=$row_time[7];
                  if($block_details_array[$t_room_no]=='')
                  {
                    $sql_sroom=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.room_name, B.block_name FROM rooms_tb AS A INNER JOIN blocks_tb AS B ON A.block_id=B.id WHERE  A.del=1  AND B.del=1  AND A.id="'.$t_room_no.'"'));
                    $block_details_array[$t_room_no]='<strong>'.$sql_sroom[0].'</strong> | '.$sql_sroom[1];
                  }
                  $t_room_no=$block_details_array[$t_room_no];
                  $prd_time=$academic_period[$t_period]['time'];

                  $staff_id_list=explode(',',$t_staff_id);
                  $staff_id_tmp=implode("' OR id='",$staff_id_list);
                  if(trim(str_replace("' OR id='",'',$staff_id_tmp)))
                  {
                    $staff_id_str=" AND (id='$staff_id_tmp') ";

                    $sql_staff="SELECT id, staff_id, staff_title, staff_name,  staff_initial, att_category FROM staff_profile_tb  WHERE del=1 $staff_id_str $staff_id_search_str ORDER BY staff_id ASC";
                    $result_staff=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_staff);
                    while(($row_staff=mysqli_fetch_array($result_staff))!=false)
                    {
                      $st_id=$row_staff['id'];
                      $staff_id=$row_staff['staff_id'];
                      $name_title=$row_staff['staff_title'];
                      $staff_name=$row_staff['staff_name'];
                      $staff_initial=$row_staff['staff_initial'];
                      $att_category=$row_section['att_category'];
                      $st_label=stripslashes(trim('<small><strong>'.$staff_initial.' '.$staff_name.'</strong><br>'.$staff_id.'</small>'));
                      if($f_staff_att[$st_id]==''){
                      $late_permission=getLPTime($att_category);
                      $attendance_status1=getAttendance($st_id,$staff_id,$current_date,$late_permission);
                      if(strtolower($attendance_status1['s'])=='h')
                      {
                      $attendance_status1['m']="h";
                      $attendance_status1['e']="h";
                      }
                      $attendance_status=modifiedAttendance($st_id,$staff_id,$current_date,$late_permission,$attendance_status1,0);
                      if($attendance_status['m']=='h')
                         $f_staff_att[$st_id]='h';
                      else if($attendance_status['m']=='le' || ($attendance_status['m']=='p' && $attendance_status['attopt']['m']=='od') || ($attendance_status['m']=='a' && ($attendance_status['msrc']=='lr' || $attendance_status['msrc']=='dr')))
                         $f_staff_att[$st_id]='le';
                      elseif($attendance_status['m']!='a')
                         $f_staff_att[$st_id]='p';
                      }
                      $txt_color='';
                      if($f_staff_att[$st_id]=='le')
                      $txt_color=' style="color:#5D9800;" ';
                      else if($f_staff_att[$st_id]!='p')
                      $txt_color=' style="color:#9F050F;" ';
                      $sa_type=$f_staff_att[$st_id];
                      if($sa_type=='')
                      $sa_type='a';

                      if($sa_type!='h'){
                           $alternative_staff='';
                           if($sa_type=='le')
                           {
                                $sql_task=mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT 
                                  DISTINCT(A.staff_id),  A.staff_initial, A.staff_name, A.staff_title FROM staff_profile_tb AS A INNER JOIN att_leave_task AS B ON A.id=B.allocated_to WHERE A.del=1 AND B.del=1 AND B.staff_id='$st_id'
                                AND B.req_date='$current_date' AND B.from_time<='$current_time' AND B.to_time>='$current_time' ");
                                while(($row_task=mysqli_fetch_array($sql_task))!=false)
                                {
                                   $tmp_name=stripslashes(trim('<small><strong>'.$row_task[1].' '.$row_task[2].'</strong><br>'.$row_task[0].'</small>'));
                                   $alternative_staff.='<br>'.$tmp_name;
                                }
                                if($alternative_staff)
                                $st_label='<s>'.$st_label.'</s>'.$alternative_staff;
                           }
                      $current_staff_details[$sa_type][$staff_id].='
                      <tr >
                        <td '.$txt_color.'>'.$st_label.'</th>
                        <td '.$txt_color.' nowrap><small>'.$degree_name_str.'</small></th>
                        <td '.$txt_color.'><small>'.$t_subject_name.'</small>
                        <br><small>'.$t_room_no.'</small> </th>
                        </tr>';
                      }

                    }


                  }


              }



            }

          }
        }
      }
  }
if(sizeof($current_staff_details['a'])>0)
ksort($current_staff_details['a']);
if(sizeof($current_staff_details['le'])>0)
ksort($current_staff_details['le']);
if(sizeof($current_staff_details['p'])>0)
ksort($current_staff_details['p']);

  $attendance_details='
  <div class="col-sm-4 dashboard-container">
    <section class="panel">
        <div class="revenue-head">
            <span>
                <i class="icon-user-follow"></i>
            </span>
            <h3>Staff Current
            <div class="input-group m-bot15 pull-right col-sm-4" >
                <input class="form-control input-md" type="text"  value="'.$current_time.'" id="attendance_time" style="width:60px; font-size:12px; margin-top:10px" placeholder="HH:MM">
                <span class="input-group-btn" style="padding:10px 0px;" >
                  <button class="btn btn-info" type="button" onclick="callStaffCurrent()">Go</button>
                </span>
            </div></h3>
        </div>
  <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr bgcolor="#F4F4F4">
    <th width="35%" height="30">Staff</th>
    <th width="10%" >Class</th>
    <th width="55%" >Subject & Class Room</th>
    </tr> '.implode('',$current_staff_details['a']).implode('',$current_staff_details['le']).implode('',$current_staff_details['p']).'
   </table></div></section> </div>';

return $attendance_details;
}

function student_feedback($academic_date,$academic_year_ref)
{
  $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  feedback_master WHERE   del=1 AND from_date<="'.$academic_date.'" AND to_date>="'.$academic_date.'" ');
  if(mysqli_num_rows($sql_section)==0)
  $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT * FROM  feedback_master WHERE   del=1 ORDER BY to_date DESC ');
    $row_section=mysqli_fetch_array($sql_section);
  $final_feedback_id=$row_section['id'];
  $final_feedback_title=$row_section['title']; 
  if($final_feedback_id)
  { 
    $selected_course=array();
        $sql_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT DISTINCT(course_id) FROM feedback_subject WHERE  del=1 AND f_id="'.$final_feedback_id.'"');
    while(($row_section=mysqli_fetch_array($sql_section))!=false)
        {
      $selected_course[]=$row_section[0];
    }
    $final_course_list_array=array();
        $sql_section='SELECT * FROM basic_setup_course_tb WHERE  del=1 ORDER BY c_order ASC';
        $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section); 
        while(($row_section=mysqli_fetch_array($result_section))!=false)
        {
      $c_id=$row_section['id'];
      $course_name=$row_section['course_name'];
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

      if($course_name=='U.G')
        $course_duration--; 
      $ac_year=$academic_year_ref[$course_name]['regular'];  
      for($i=1;$i<=$course_duration;$i++)
      {
        $cyear=$i;
        $cyear_label=convertNYear($cyear, $course_name); 
        if(in_array($c_id.'___'.$ac_year.'___'.$cyear,$selected_course)==true)
        {
          $final_course_list_array[]=array($c_id,$ac_year,$cyear,$c_id.'___'.$ac_year.'___'.$cyear,$cyear_label.' Year '.$degree_name ); 
        }
      } 
        }
    
    
    if(sizeof($final_course_list_array)>0){
      
  
      foreach($final_course_list_array as $cid => $cdetails)
      {
        $final_course_id=$cdetails[0];
        $final_academic_year=$cdetails[1];
        $final_current_year=$cdetails[2];
        $final_cid_str=$cdetails[3];
        $course_name_str=$cdetails[4];
        
        $f_result_stu=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT count(A.id), GROUP_CONCAT( A.register_no SEPARATOR ',') FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id WHERE A.del=1 AND A.course_id='$final_course_id' AND (A.releaving_date='0000-00-00' OR A.releaving_date>'$academic_date')  AND B.del=1 AND B.academic_year='$final_academic_year' AND B.current_year='$final_current_year' "));
        $final_total_student=$f_result_stu[0];
        $final_student_list=explode(',',$f_result_stu[1]);
        $student_fill_status=array();
        
        
        $sql_sub="SELECT A.subject_id, A.subject_name, B.id, B.subject_id, B.subject_name, B.subject_category, B.s_batch, B.department, C.id, C.staff_id FROM basic_setup_subject_tb AS A INNER JOIN basic_subject_tt_tb AS B ON A.id=B.rid INNER JOIN feedback_subject AS C ON B.id=C.subject_id WHERE A.del=1 AND A.academic_year='$final_academic_year' AND A.course_id='$final_course_id' AND A.semester_no='$final_current_year' AND B.del=1 AND C.del=1 AND C.f_id='$final_feedback_id' AND C.course_id='$final_cid_str' AND C.staff_id!='' ORDER BY B.subject_category ASC, A.subject_order ASC"; 
       
        $result_sub=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_sub);
        $total_sub_count=0;
        while(($row_tsection=mysqli_fetch_array($result_sub))!=false)
        {
          $subject_id=$row_tsection[0];
          $subject_name=$row_tsection[1];
          $t_sid=$row_tsection[2];
          $t_subject_id=$row_tsection[3];
          $t_subject_name=$row_tsection[4];
          $t_subject_cat=$row_tsection[5];
          $t_batch=$row_tsection[6];
          $t_dept=$row_tsection[7];
          $t_fbrow=$row_tsection[8];
          $t_fbstaff=$row_tsection[9];
          
          $t_subject_id=stripslashes($t_subject_id);
          $t_subject_name=stripslashes($t_subject_name); 
          
     
           $final_subject_type='Practical';
           if(strtolower($t_subject_category)=='theory' || strtolower($t_subject_category)=='lecture' )
           $final_subject_type='Theory'; 
           $stype_str=strtolower($final_subject_type); 
           
          $staff_list=explode(',',$t_fbstaff); 
          foreach($staff_list as $stf_id)
          {
            $stf_id=trim($stf_id);
            if($stf_id)
            { 
              $total_sub_count++;
              $sql_rate=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT GROUP_CONCAT(student_id SEPARATOR ",")   FROM  feedback_tb WHERE  feedback_id="'.$final_feedback_id.'" AND course_id="'.$final_cid_str.'" AND  subject_id="'.$t_sid.'" AND staff_id="'.$stf_id.'" AND  del=1  '));
             
              if($sql_rate[0]){ 
                $student_id_list=explode(',',$sql_rate[0]); 
                foreach($student_id_list as $stuid)
                $student_fill_status[$stuid][$stf_id]=$stf_id; 
              }
            }
          }  
        }
        
        $filled_student=0;
        $unfilled_student=0;
        $unfilled_list=array();
        foreach($final_student_list as $stuid)
        {
          if(sizeof($student_fill_status[$stuid])==$total_sub_count)
          $filled_student++;  
          else{
          $unfilled_student++;  
          $unfilled_list[$stuid]=sizeof($student_fill_status[$stuid]);
          }
        }
         $feedback_cat_body.='<tr>
        <td height="30" >'.$course_name_str.'</td>
        <td align="right" class="cinfo" onclick="callfeedbackfill(\''.$final_feedback_id.'\',\''.$academic_date.'\',\'all\',\''.$final_cid_str.'\')">'.($filled_student+$unfilled_student).'</td>
        <td align="right" class="cinfo" onclick="callfeedbackfill(\''.$final_feedback_id.'\',\''.$academic_date.'\',\'completed\',\''.$final_cid_str.'\')">'.$filled_student.'</td>
        <td align="right" class="cinfo" onclick="callfeedbackfill(\''.$final_feedback_id.'\',\''.$academic_date.'\',\'pending\',\''.$final_cid_str.'\')">'.$unfilled_student.'</td>
        </tr>';
         
    
        
      }   
     } 
  }
  
  $attendance_details='
<div class="col-sm-4 dashboard-container">
  <section class="panel">
    <div class="revenue-head">
      <span>
      <i class="icon-user-follow"></i>
      </span>
      <h3>Feedback <span style="color:#CCC; font-size:14px; font-weight:normal; "> '.$final_feedback_title.'</span></h3>
    </div>
    <div class="dashboard-panel">
      
      <table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
      <tr bgcolor="#F4F4F4" class="td_head_color">
      <th width="40%" height="30" >Course</th>
      <th width="20%" >#T</th>
      <th width="20%" >Completed</th>
      <th width="20%" >Pending</th>
      </tr> '.$feedback_cat_body.'
      </table>
    </div>
  </section> 
</div>';
   
  return $attendance_details; 
}

function t_to_m($time)
{
  $time_array=explode(':',$time);
  return (($time_array[0]*60)+$time_array[1])+0;
}

function staffAuthentication($preTxt)
{
  $a_username=$_SESSION['empusername_login'];
  $sql_desig=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.dept_staff FROM  dept_authentication AS A INNER JOIN web_account_setup AS B ON A.user_id=B.id WHERE A.del=1 AND B.del=1 AND B.member_id="'.$a_username.'" '));
  $sql_staff_list=explode(',', $sql_desig[0]);
  $staff_id_search_str='';
  foreach($sql_staff_list as $a_sid)
  {
    $a_sid=trim($a_sid);
    if($a_sid){
      $staff_id_search_str.=' '.$preTxt.'id="'.$a_sid.'" OR';
    }
  }
  if($staff_id_search_str)
    $staff_id_search_str=' AND ('.substr($staff_id_search_str,0,-2).') ';
  return $staff_id_search_str;
}
function internAuthentication($preTxt)
{
  $staff_id_search_str='';
  if($preTxt){
  $a_username=$_SESSION['empusername_login'];
  $sql_desig=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.dept_intern FROM  dept_authentication AS A INNER JOIN web_account_setup AS B ON A.user_id=B.id WHERE A.del=1 AND B.del=1 AND B.member_id="'.$a_username.'" '));
  $sql_staff_list=explode(',', $sql_desig[0]);
  foreach($sql_staff_list as $a_sid)
  {
    $a_sid=trim($a_sid);
    if($a_sid){
      $staff_id_search_str.=' '.$preTxt.'="'.$a_sid.'" OR';
    }
  }
  if($staff_id_search_str)
    $staff_id_search_str=' AND ('.substr($staff_id_search_str,0,-2).') ';
  }
  return $staff_id_search_str;
}

function pgAuthentication($preTxt)
{
  $staff_id_search_str='';
  
  $a_username=$_SESSION['empusername_login'];
  $sql_desig=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.dept_pg FROM  dept_authentication AS A INNER JOIN web_account_setup AS B ON A.user_id=B.id WHERE A.del=1 AND B.del=1 AND B.member_id="'.$a_username.'" '));
  $sql_staff_list=explode(',', $sql_desig[0]);
 
   
  return array($sql_desig[0], $sql_staff_list);
}


function studAuthentication($preTxt)
{
  $staff_id_search_str='';
  if($preTxt){
  $a_username=$_SESSION['empusername_login'];
  $sql_desig=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.dept_student FROM  dept_authentication AS A INNER JOIN web_account_setup AS B ON A.user_id=B.id WHERE A.del=1 AND B.del=1 AND B.member_id="'.$a_username.'" '));
  $sql_staff_list=explode(',', $sql_desig[0]);
  foreach($sql_staff_list as $a_sid)
  {
    $a_sid=trim($a_sid);
    if($a_sid){
      $staff_id_search_str.=' '.$preTxt.'="'.$a_sid.'" OR '.$preTxt.' LIKE "'.$a_sid.',%" OR '.$preTxt.' LIKE "%,'.$a_sid.'" OR '.$preTxt.' LIKE "%,'.$a_sid.',%" OR';
    }
  }
  if($staff_id_search_str)
    $staff_id_search_str=' AND ('.substr($staff_id_search_str,0,-2).') ';
  }
  return $staff_id_search_str;
}