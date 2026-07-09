<?PHP 
session_start();
if($_SESSION['empusername_login']){
$a_username=$_SESSION['empusername_login'];
}
else
$a_username='Cron';
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
$a_username=$_SESSION['empusername_login'];
//////////////Log////////////
include('config.php');
include('log.php');
$a_user_ip_v=$_SERVER['REMOTE_ADDR'];
if($a_user_ip_v=='103.137.138.94')
$a_user_ip='150.168.147.26';
$a_user_os=$_SERVER['HTTP_USER_AGENT'];
$url_ref=$_SERVER['REQUEST_URI'];
//////////////Set Time Zone/////////////////

date_default_timezone_set(ADMIN_TIME_ZONE);
$a_user_dt=date("Y-m-d H:i:s");
//////////////Set USer True Name/////////////////
$sql_log="SELECT member_name , id, photo from  web_account_setup where member_id ='$a_username' AND del=1";
$result_log=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_log);
if($result_log)
{
$rows_log = mysqli_fetch_array($result_log);
$bs_client_name = $rows_log[0];
$bs_username_id=$rows_log[1];
$bs_member_photo=$rows_log[2];
}
$bs_path='img/member/'.$bs_member_photo;
if(file_exists($bs_path) && $bs_member_photo)
$bs_member_photo=$bs_path;
else
$bs_member_photo='img/profile-avatar.jpg';









$basic_style_details_array=array();
$basic_js_details_array=array();
$style_cache='?v='.date('ymdHis');
//<link href="assets/font-awesome/css/font-awesome.css" rel="stylesheet" />
$basic_style_details_array['basic']='
<meta http-equiv="cache-control" content="private">
<meta http-equiv="X-UA-Compatible" content="IE=edge, chrome=1" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!-- Bootstrap core CSS -->
<link href="css/bootstrap.min.css" rel="stylesheet">
<link href="css/bootstrap-reset.css" rel="stylesheet">
<!--external css-->
<link href="assets/font-awesome/css/font-awesome.css" rel="stylesheet" />
<link href="assets/simple-line-icons/css/simple-line-icons.css" rel="stylesheet" />
<!-- Custom styles for this template -->
<link href="css/style.css'.$style_cache.'" rel="stylesheet">
<link href="css/style-responsive.css'.$style_cache.'" rel="stylesheet" />
<link href="css/menu.css" rel="stylesheet">';
$basic_style_details_array['color_picker']='
<link rel="stylesheet" type="text/css" href="assets/bootstrap-colorpicker/css/colorpicker.css" />';
$basic_style_details_array['date_picker']='
<link rel="stylesheet" type="text/css" href="assets/bootstrap-datepicker/css/datepicker.css" />';
$basic_style_details_array['time_picker']='
<link rel="stylesheet" type="text/css" href="assets/timepicker/css/timepicker.min.css" />';

$basic_style_details_array['date_range']='
<link rel="stylesheet" type="text/css" href="assets/bootstrap-daterangepicker/daterangepicker.css" />';
$basic_style_details_array['drop_down']='
<link rel="stylesheet" type="text/css" href="assets/dropdown/multiple-select.css" />';
$basic_js_details_array['basic']='
<!-- js placed at the end of the document so the pages load faster -->
<script src="js/jquery.js"></script>
<script src="js/bootstrap.min.js"></script>
<script src="log.js'.$style_cache.'"></script>
<script src="js/jquery.scrollTo.min.js"></script>
<script src="js/jquery.nicescroll.js" type="text/javascript"></script>
<script type="text/javascript" src="js/jquery.validate.min.js"></script>
<script src="js/jquery-ui-1.9.2.custom.min.js"></script>
<!--custom switch-->
<script src="js/bootstrap-switch.js"></script>
<!--custom tagsinput-->
<script src="js/jquery.tagsinput.js"></script>
<!--common script for all pages-->
<script src="js/common-scripts.js"></script>
<!--script for this page-->
<script src="js/form-validation-script.js'.$style_cache.'"></script>
<script src="email_notification.js'.$style_cache.'" type="text/javascript"></script>
<script src="image_uploader.js'.$style_cache.'" language="javascript"> </script>
';

$basic_js_details_array['advance']='
<!--script for this page-->
<script src="js/form-component.js"></script>  ';
$basic_js_details_array['color_picker']='
<script type="text/javascript" src="assets/bootstrap-colorpicker/js/bootstrap-colorpicker.js"></script>';
$basic_js_details_array['date_picker']='
<script type="text/javascript" src="assets/bootstrap-datepicker/js/bootstrap-datepicker.js"></script>';
$basic_js_details_array['date_range']='
<script type="text/javascript" src="assets/bootstrap-daterangepicker/date.js"></script>
<script type="text/javascript" src="assets/bootstrap-daterangepicker/daterangepicker.js"></script>';

$basic_js_details_array['text_editor']='
<script type="text/javascript" src="assets/texteditor/jquery.tinymce.min.js"></script>
<script type="text/javascript" src="assets/texteditor/texteditor.min.js"></script>
<script type="text/javascript" src="assets/texteditor/texteditor.js"></script>';

$basic_js_details_array['text_editor_full']='
<script type="text/javascript" src="assets/texteditor/jquery.tinymce.min.js"></script>
<script type="text/javascript" src="assets/texteditor/rte_script.js"></script>
<script type="text/javascript" src="assets/texteditor/texteditor.min.js"></script>
<script type="text/javascript" src="assets/texteditor/full_texteditor.js"></script>';

$basic_js_details_array['drop_down']='
<script src="assets/dropdown/multiple-select.js"></script>';
$basic_js_details_array['date_time_picker']='
<link rel="stylesheet" type="text/css" href="assets/datetimepicker/css/bootstrap-datetimepicker.css" />
<script src="assets/datetimepicker/js/moment.js"></script>
<script src="assets/datetimepicker/js/bootstrap-datetimepicker.min.js"></script>';


$basic_js_details_array['date_time_picker_1']='
<link rel="stylesheet" type="text/css" href="assets/bootstrap-datetimepicker/css/bootstrap-datetimepicker.css" />
<script src="assets/bootstrap-datetimepicker/js/bootstrap-datetimepicker.js"></script>';

$basic_js_details_array['time_picker']='
<script src="assets/timepicker/js/timepicker.min.js"></script>';


$basic_js_details_array['jcolor']='
<script src="assets/jscolor/jscolor.js"></script>';


$basic_js_details_array['printelement']='
<script src="js/jquery.printElement.js"></script>
<script src="js/jquery-migrate-1.0.0.js"></script>';

if(!function_exists('call_pagenation'))
{
function call_pagenation($total_pages,$first_link_ref,$page,$news_link_details,$limit)
{
				$adjacents = 3;
				/* Setup vars for query. */
				$targetpage = $first_link_ref ; 	//your file name  (the name of this file)
				$limit = $limit; 								//how many items to show per page
				$page = $page;
				if($page)
				$start = ($page - 1) * $limit; 			//first item to display on this page
				else
				$start = 0;
				if($start>$total_pages)
				{
				$start = 0;
				$page=0;
				}							//if no page var is given, set start to 0

				/* Setup page vars for display. */
				if ($page == 0) $page = 1;					//if no page var is given, default to 1.
				$prev = $page - 1;							//previous page is page - 1
				$next = $page + 1;							//next page is page + 1
				$lastpage = ceil($total_pages/$limit);		//lastpage is = total pages / items per page, rounded up.
				$lpm1 = $lastpage - 1;						//last page minus 1

				/*
				Now we apply our rules and draw the pagination object.
				We're actually saving the code to a variable in case we want to draw it more than once.
				*/
				$pagination = "";
				if($lastpage > 1)
				{
				$pagination .= "<ul class='pagination'>";
				//previous button
				if ($page > 1)
				$pagination.= "<li><a href='$targetpage?".$news_link_details."page=$prev'><</a></li>";
				else
				$pagination.= "<li><a href='#'><</a></li>";

				//pages
				if ($lastpage < 7 + ($adjacents * 2))	//not enough pages to bother breaking it up
				{
				for ($counter = 1; $counter <= $lastpage; $counter++)
				{
				if ($counter == $page)
				$pagination.= "<li class='active'><a href='#'>$counter</a></li>";
				else
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$counter\">$counter</a></li>";
				}
				}
				elseif($lastpage > 5 + ($adjacents * 2))	//enough pages to hide some
				{
				//close to beginning; only hide later pages
				if($page < 1 + ($adjacents * 2))
				{
				for ($counter = 1; $counter < 4 + ($adjacents * 2); $counter++)
				{
				if ($counter == $page)
				$pagination.= "<li class='active'><a href='#'>$counter</a></li>";
				else
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$counter\">$counter</a></li>";
				}
				$pagination.= "<li><a href='#'>...</a></li>";
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$lpm1\">$lpm1</a></li>";
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$lastpage\">$lastpage</a></li>";
				}
				//in middle; hide some front and some back
				elseif($lastpage - ($adjacents * 2) > $page && $page > ($adjacents * 2))
				{
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=1\">1</a></li>";
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=2\">2</a></li>";
				$pagination.= "<li><a href='#'>...</a></li>";
				for ($counter = $page - $adjacents; $counter <= $page + $adjacents; $counter++)
				{
				if ($counter == $page)
				$pagination.= "<li class='active'><a href='#'>$counter</a></li>";
				else
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$counter\">$counter</a></li>";
				}
				$pagination.= "<li><a href='#'>...</a></li>";
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$lpm1\">$lpm1</a></li>";
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$lastpage\">$lastpage</a></li>";
				}
				//close to end; only hide early pages
				else
				{
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=1\">1</a></li>";
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=2\">2</a></li>";
				$pagination.= "<li><a href='#'>...</a></li>";
				for ($counter = $lastpage - (2 + ($adjacents * 2)); $counter <= $lastpage; $counter++)
				{
				if ($counter == $page)
				$pagination.= "<li class='active'><a href='#'>$counter</a></li>";
				else
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$counter\">$counter</a></li>";
				}
				}
				}

				//next button
				if ($page < $counter - 1)
				$pagination.= "<li><a href=\"$targetpage?".$news_link_details."page=$next\">></a></li>";
				else
				$pagination.= "<li><a href='#'>></a></li>";
				$pagination.= "</ul>";
				}
				$results[0]=$pagination;
				$results[1]=$start;
				return $results;
			}
}




if(!function_exists('parseString'))
{

function parseString($str,$minChars)
{
$m_menu_name_link=strtolower(trim($str));
$m_menu_name_link=preg_replace('/\s/', '_', $m_menu_name_link);
$m_menu_name_link=mb_convert_encoding($m_menu_name_link, 'HTML-ENTITIES', 'UTF-8');
$h_link= preg_replace('/[^A-Z\_a-z\_0-9]/', '', $m_menu_name_link);
$h_link_2=str_replace('_','',$h_link);
if(is_numeric($h_link_2))
$minChars+=30;

        $charCount=0;
        $prev_char_count=0;
        $output="";
        $token = explode(" ", $str);
        for( $i=0,$limit=count($token); $i<$limit; ++$i)
        {
                if($charCount < $minChars)
                {
                        $output.=$token[$i] . " " ;
                        $charCount += strlen($token[$i]);
                        $prev_char_count= strlen($token[$i])+1;
                }
                else
                {
                        $output =trim(substr($output,0,-($prev_char_count)))."...";
                        break;
                }
        }
if($output=='')
$output=$token[0];
return $output;
}
}




if(!function_exists('parseurlString'))
{
function parseurlString($str)
{
$output="";
$m_menu_name_link=strtolower(trim($str));
$m_menu_name_link=preg_replace('/\s/', '_', $m_menu_name_link);
$m_menu_name_link=mb_convert_encoding($m_menu_name_link, 'HTML-ENTITIES', 'UTF-8');
$h_link= preg_replace('/[^A-Z\_a-z\_0-9]/', '', $m_menu_name_link);
$output=str_replace('__','_',$h_link);
if(strlen($output)>100)
$output=substr($output,0,100);
return $output;
}
}



if(!function_exists('callPrintHeader'))
{
function callPrintHeader($header_content, $pArr, $htype='large', $type='print')
{
$sql_c_academic='SELECT * FROM basic_banner_tb WHERE del=1 AND id=1';
$result_c_academic=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_c_academic);
$row_c_academic=mysqli_fetch_array($result_c_academic);
$banner_image=$row_c_academic['banner_image'];
if(!$_SESSION['empusername_login'])
{
if($banner_image && $htype='large')
$i_logo_link="<img src='/home/apdchedu/public_html/cis/img/global_images/$banner_image'  />";
else if($banner_image)
$i_logo_link="<img src='/home/apdchedu/public_html/cis/img/global_images/$banner_image'   />";

if(strtolower($_SESSION['empusername_login'])=='igrapix1') 
$i_logo_link="<img src='/home/apdchedu/public_html/cis/img/global_images/igracis.jpg'   />";
}
else
{
if($banner_image && $htype='large')
$i_logo_link="<img src='img/global_images/$banner_image'  />";
else if($banner_image)
$i_logo_link="<img src='img/global_images/$banner_image'   />";


if(strtolower($_SESSION['empusername_login'])=='igrapix1') 
$i_logo_link="<img src='img/global_images/igracis.jpg'   />";
}

$header_string='';
$header_string1='';
$header_vertical_string='';
if(is_array($header_content))
{
	if($header_content[0])
	{
		$header_vertical_string=$header_content[0].' | ';
		$header_string='<p class="pc_title title">'.$header_content[0].'</p>';
	}
	if($header_content[1])
	{
		$header_vertical_string.=$header_content[1].' | ';
		$header_string.='<p class="pc_sub-title sub-title">'.$header_content[1].'</p>';
	}
	if($header_content[2])
	{
		$header_vertical_string.=$header_content[2].' | ';
		$header_string1='<div class="pc_sub-title-1 sub-title-1">'.$header_content[2].'</div>';
	}
	$header_vertical_string=substr($header_vertical_string,0,-3);
}
else {
	if($header_content)
	{
		$header_vertical_string=$header_content;
		$header_string='<p class="pc_title title">'.$header_content.'</p>';
	}
}
$verticalString='';
if($pArr['right_text']==1 )
$verticalString='<div class="right_container"><div class="vertical_container">'.$header_vertical_string.'</div></div>';



if($pArr['home_header']==1 && $pArr['inner_header']==1)
{
$headerContent=($type=='print'?'<div id="printingHeader" style="display:none;">':'').
'<div id="printHeaderpanel">
<table class="header_table"  border="0" cellpadding="0" cellspacing="0" width="100%" >
    <tbody>
<tr> <td align="center" height="5" colspan="2"><small>omsakthi</small></td></tr>
<tr>
      <td height="70"  valign="middle" width="30%">'.$i_logo_link.'</td>
      <td nowrap="" align="right" valign="top" width="70%"><div class="promote_card"> '.$header_string.($pArr['hstr_inner']==1?$header_string1:'').'</div></td>
    </tr>
  </tbody></table> '.($pArr['hstr_inner']==1?'':$header_string1).'
 </div>
'.($type=='print'?'</div>':'');
}
else if(($pArr['home_header']==1 && $pArr['inner_header']==0) || sizeof($pArr)==0)
{
$headerContent=($type=='print'?'<div id="printingHeader" style="display:none;">':'').
'<div id="printHeaderpanel" class="first-page">
<table class="header_table"  border="0" cellpadding="0" cellspacing="0" width="100%" >
    <tbody>
<tr> <td align="center" height="5" colspan="2"><small>omsakthi</small></td></tr>
<tr>
      <td height="70" valign="middle" width="30%">'.$i_logo_link.'</td>
      <td nowrap="" align="right" valign="top" width="70%"><div class="promote_card"> '.$header_string.''.($pArr['hstr_inner']==1?$header_string1:'').'</div></td>
    </tr>
  </tbody></table> '.($pArr['hstr_inner']==1?'':$header_string1).'
 </div>
'.($type=='print'?'</div>':'');
}
else
{
$headerContent=($type=='print'?'<div id="printingHeader" style="display:none;"></div>':'');
}



///////////////////Generated By String//////////////
$footerContent='';
if($pArr['footer']==1)
{
$gBy='';
if($pArr['generated_by']==1)
{
$gBy=($header_content['generated_by']?$header_content['generated_by']:'Generated by '.$_SESSION['empusername_login'].' on '.date('d M Y h:i a').' at '.date('h:i a'));
}
$gBy.=$pArr['approved'];
if($gBy)
$gBy='<p id="generated_by">'.$gBy.'</p>';

$footerContent=($type=='print'?'<div id="printingFooter" style="display:none;">':'').
'
<div id="printFooterpanel">
'.$verticalString.'
'.$gBy.'
<table class="footer_table" border="0" cellpadding="0" cellspacing="0" width="100%" >
<tbody>
<tr>
 <td nowrap="" valign="top" width="90%"><p class="footer_sign_note">'.stripslashes($pArr['page_note']).'</p></td>
 <td height="40" align="right" valign="top" width="10%">'.
 ($pArr['page_no']=='css'?'<p id="print_page_no"></p>':'').$pArr['c_page_no'].'</td>
 </tr>
 </tbody></table>
 </div>
'.($type=='print'?'</div>':'');
}
else
$footerContent=($type=='print'?'<div id="printingFooter" style="display:none;"></div>':'');


if($type=='pass')
{
 $fresult=array($headerContent, $footerContent);
 return $fresult;
}
else
echo $headerContent.$footerContent;


}
}

if(!function_exists('callPrintSetup'))
{
function callPrintSetup($print_id)
{
	$sql_section='SELECT * FROM print_setup_tb WHERE  del=1  AND id="'.$print_id.'"';
	$result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
	$row_section=mysqli_fetch_array($result_section);
	$pArr['id']=$row_section['id'];
	$pArr['title']=$row_section['title'];
	$pArr['sub_title']=$row_section['sub_title'];
	$pArr['body_title']=$row_section['body_title'];
	$pArr['page_note']=$row_section['page_note'];
	$pArr['generated_by']=$row_section['generated_by'];
	$pArr['page_no']=$row_section['page_no'];
	$pArr['row_count']=$row_section['row_count'];
	$pArr['footer']=$row_section['footer'];
	$pArr['right_text']=$row_section['right_text'];

	$pArr['home_header']=$row_section['home_header'];
	$pArr['inner_header']=$row_section['inner_header'];
	$pArr['home_height']=$row_section['home_height'];
	$pArr['inner_height']=$row_section['inner_height'];

	$p_approved_by=$row_section['approved_by'];
	$p_checked_by=$row_section['checked_by'];
	$p_verified_by=$row_section['verified_by'];
	$p_signature=$row_section['signature'];
	$app_str=$p_approved_by+$p_checked_by+$p_verified_by;
	$approved_table='';
	if($app_str>0 && $pArr['footer']==1)
	{

		$approved_table='';
		$tot_width=round((100/$app_str),2);

		$sql_section='SELECT * FROM  print_signature_tb WHERE print_id="'.$pArr['id'].'" AND category!="signature"  AND del!=0 ORDER BY staff_order ASC';
		 $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
		 $aBy=array();
		 while(($row_section=mysqli_fetch_array($result_section))!=false)
		 {
			   $staff_category=$row_section['category'];
			   $aBy[$staff_category]['name']=$row_section['staff_name'];
			   $aBy[$staff_category]['desig']=$row_section['staff_designation'];
		 }
		 if($p_approved_by==1)
		 {
			 $approved_table.=' | Approved by';
			 if(trim($aBy['approved']['name']))
			 $approved_table.=' '.$aBy['approved']['name'];
			 if(trim($aBy['approved']['desig']))
			 $approved_table.=' '.$aBy['approved']['desig'];
		 }
		 if($p_checked_by==1)
		 {
			 $approved_table.=' | Checked by';
			 if(trim($aBy['checked']['name']))
			 $approved_table.=' '.$aBy['checked']['name'];
			 if(trim($aBy['checked']['desig']))
			 $approved_table.=' '.$aBy['checked']['desig'];
		 }
		 if($p_verified_by==1)
		 {
			 $approved_table.=' | Verified by';
			 if(trim($aBy['verified']['name']))
			 $approved_table.=' '.$aBy['verified']['name'];
			 if(trim($aBy['verified']['desig']))
			 $approved_table.=' '.$aBy['verified']['desig'];
		 }
	}

	if($p_signature==1)
	{
		$sql_section='SELECT * FROM  print_signature_tb WHERE print_id="'.$pArr['id'].'" AND category="signature"  AND del!=0 ORDER BY staff_order ASC';
	     $result_section=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_section);
	     $tot_sign=mysqli_num_rows($result_section);
	     if($tot_sign>0)
	     {
                $align_text=' align="center" ';
                if($tot_sign==1) $app_str='';
	     $signature_table='';
	     $tot_width=round((100/$tot_sign),2);
	     $small_font='';
	     while(($row_section=mysqli_fetch_array($result_section))!=false)
	     {
	            $staff_name=$row_section['staff_name'];
	            $staff_designation=$row_section['staff_designation'];
			  $print_format=$row_section['print_format'];
			  if($print_format){ $print_format='_'.$print_format;  $small_font=$print_format; }

	            $signature_table.='
	            <td valign="top" nowrap width="'.$tot_width.'%" '.$align_text.'>
			  <p class="footer_sign_name'.$print_format.'">'.$staff_name.'</p>';
			if(trim($staff_designation))
			$signature_table.='<p class="footer_sign_desig'.$print_format.'">'.$staff_designation.'</p>';
			$signature_table.='</td>';
	     }
  $signature_table='<table border="0" cellpadding="3" cellspacing="0" width="100%" class="signature_table'.$small_font.'">
	     <tr>'.$signature_table.'</tr></table>';
	     }
	}



	$pArr['approved']=$approved_table;
	$pArr['signature']=$signature_table;

	return $pArr;
}
}

if(!function_exists('convertNYear'))
{
function convertNYear($year, $ctype='1')
{
if(strtolower($ctype)=="u.g")
$year_label_array=array('','I','II','III','IV','Int.','VI','VII','VIII','IX','X');
else if(strtolower($ctype)=="p.g")
$year_label_array=array('','I','II','III','IV','V','VI','VII','VIII','IX','X');
else
$year_label_array=array('','I','II','III','IV','V','VI','VII','VIII','IX','X');

return $year_label_array[$year];
}
}

if(!function_exists('convertNSem'))
{
function convertNSem($year, $ctype='1')
{
if(strtolower($ctype)=="u.g")
$year_label_array=array('','I-Sem','II-Sem','III-Sem','IV-Sem');
else if(strtolower($ctype)=="p.g")
$year_label_array=array('','I-Sem','II-Sem','III-Sem','IV-Sem');
else
$year_label_array=array('','I-Sem','II-Sem','III-Sem','IV-Sem');

return $year_label_array[$year];
}
}

if(!function_exists('convertNumberToWords'))
{
function convertNumberToWords($number){
        $words = array(
        '0'=> '' ,'1'=> 'one' ,'2'=> 'two' ,'3' => 'three','4' => 'four','5' => 'five',
        '6' => 'six','7' => 'seven','8' => 'eight','9' => 'nine','10' => 'ten',
        '11' => 'eleven','12' => 'twelve','13' => 'thirteen','14' => 'fourteen','15' => 'fifteen',
        '16' => 'sixteen','17' => 'seventeen','18' => 'eighteen','19' => 'nineteen','20' => 'twenty',
        '30' => 'thirty','40' => 'forty','50' => 'fifty','60' => 'sixty','70' => 'seventy',
        '80' => 'eighty','90' => 'ninety');
        $number_length = strlen($number);
        $number_array = array(0,0,0,0,0,0,0,0,0);
        $received_number_array = array();
        for($i=0;$i<$number_length;$i++){    $received_number_array[$i] = substr($number,$i,1);    }
        for($i=9-$number_length,$j=0;$i<9;$i++,$j++){ $number_array[$i] = $received_number_array[$j]; }
        $number_to_words_string = "";
        for($i=0,$j=1;$i<9;$i++,$j++){
            if($i==0 || $i==2 || $i==4 || $i==7){
                if($number_array[$i]=="1"){
                    $number_array[$j] = 10+$number_array[$j];
                    $number_array[$i] = 0;
                }
            }
        }
        
        $value = "";
        for($i=0;$i<9;$i++){
            if($i==0 || $i==2 || $i==4 || $i==7){    $value = $number_array[$i]*10; }
            else{ $value = $number_array[$i];    }
            if($value!=0){ $number_to_words_string.= $words["$value"]." "; }
            if(($i==1 && $value!=0)||($i==0 && $value!=0 && $number_array[$i+1]==0)){    $number_to_words_string.= "Crore "; }
            if(($i==3 && $value!=0)||($i==2 && $value!=0 && $number_array[$i+1]==0)){    $number_to_words_string.= "Lakh ";    } 
            if(($i==5 && $value!=0)||($i==4 && $value!=0 && $number_array[$i+1]==0)){    $number_to_words_string.= "Thousand "; }
            if(($i==6 && $value!=0) && ($number_array[$i+1]!=0 && $number_array[$i+2]!=0)){    $number_to_words_string.= "Hundred and "; }
            else if($i==6 && $value!=0){  $number_to_words_string.= "Hundred "; }
            
        }
        if($number_length>9){ $number_to_words_string = ""; }
		if(substr($number_to_words_string,-5)==' and ')
		$number_to_words_string=substr($number_to_words_string,0,-5);

        return ucwords(strtolower($number_to_words_string)." Only");
}
}
if(!function_exists('convertNumberFormat'))
{
function convertNumberFormat($amount){

    if($amount)
    {
    setlocale(LC_MONETARY, 'en_IN');
    if (ctype_digit($amount) ) {
         // is whole number
         // if not required any numbers after decimal use this format
	    if(function_exists('money_format'))
         $amount = money_format('%!.0n', $amount);
    }
    else {
         // is not whole number
	    if(function_exists('money_format'))
         $amount = money_format('%!i', $amount);
    }
    }

      return $amount;

}
}
if(!function_exists('IND_money_format'))
{
function IND_money_format($number){    	
        $decimal = (string)($number - floor($number));
        $money = floor($number);
        $length = strlen($money);
        $delimiter = '';
        $money = strrev($money);
 
        for($i=0;$i<$length;$i++){
            if(( $i==3 || ($i>3 && ($i-1)%2==0) )&& $i!=$length){
                $delimiter .=',';
            }
            $delimiter .=$money[$i];
        }
 
        $result = strrev($delimiter);
        $decimal = preg_replace("/0\./i", ".", $decimal);
        $decimal = substr($decimal, 0, 3);
 
        if( $decimal != '0'){
            $result = $result.$decimal;
        }
 
        return $result;
    }
}
function committeeAuthentication($preTxt='e_department', $preSch='c_')
{
  $staff_id_search_str='';
  if($preTxt){
  $a_username=$_SESSION['empusername_login'];
  $sql_desig=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], 'SELECT A.event_committee FROM  dept_authentication AS A 
  INNER JOIN web_account_setup AS B ON A.user_id=B.id WHERE A.del=1 AND B.del=1 AND B.member_id="'.$a_username.'" '));
  $sql_staff_list=explode(',', $sql_desig[0]);
  foreach($sql_staff_list as $a_sid)
  {
    $a_sid=trim($a_sid);
    if($a_sid){
        $a_sid=$preSch.$a_sid;
        $staff_id_search_str.=' '.$preTxt.'="'.$a_sid.'" OR '.$preTxt.' LIKE "'.$a_sid.',%" OR '.$preTxt.' LIKE "%,'.$a_sid.'" OR '.$preTxt.' LIKE "%,'.$a_sid.',%" OR';
    }
  }
  if($staff_id_search_str)
    $staff_id_search_str=' AND ('.substr($staff_id_search_str,0,-2).') ';
  }
  return $staff_id_search_str;
}





function getstaffOrder()
{
 $staff_order=mysqli_fetch_array(mysqli_query($GLOBALS["__CIS_MYSQLI"], "SELECT GROUP_CONCAT( s_order SEPARATOR ', ') FROM staff_order "));
 $result=trim($staff_order[0]);
 if(substr($result,-1)==',')
 $result=substr($result,0,-1);
 return $result;
}
    



?>
