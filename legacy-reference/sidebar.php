<?PHP 
session_start();
if(!$_SESSION['empusername_login']){
header("location:logout");
}
error_reporting(E_ALL ^ E_NOTICE ^ E_WARNING);
$url_ref=$_SERVER['REQUEST_URI'];
$url_1=explode('?',$url_ref);
$url_tref=explode('/',$url_1[0]);
$url1=$url_tref[sizeof($url_tref)-1];
if(substr($url1,strlen($url1)-4,4)!='.php')
$url=$url1.'.php';
else
$url=$url1;

if (!file_exists($url))
$url='dashboard.php';




$title='';
$authentication_allow=1;
?>
<style>#main-content {
	margin-left:0px;
}
</style>
<aside  style="display:none;">
<div id="sidebar"  class="nav-collapse ">
<!-- sidebar menu start-->
<ul class="sidebar-menu">
<?PHP 




$url_check=$url;
$query1="SELECT DISTINCT id,category_name,menu_icon FROM admin_menu_category_tb WHERE del = 1 ORDER BY category_order ASC" ;
$result1=mysqli_query($GLOBALS["__CIS_MYSQLI"], $query1);
$counter1 = 0;
$counter=1;
$breadcrumb_details='';
$breadcrumb_details_1='';
$gallery_bar_id='';
$total_menu_category=mysqli_num_rows($result1);
while(($rows1 = mysqli_fetch_array($result1)) != false)
{
$category= $rows1["category_name"];
$category_id= $rows1["id"];
$bs_menu_icon=$rows1["menu_icon"];
$highligh_level_1='';
$highligh_level_3='';

$sql_main_menu="SELECT DISTINCT(main_menu_name) FROM basic_admin_menu_tb WHERE del=1 AND menu_enable=1 AND category_id='$category_id' ORDER BY main_menu_order ASC";
$access_limit=0;
$access_details='';
$m_access_details='';
$n_access_details='';
$result_main_menu=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_main_menu);
while(($row_main_menu=mysqli_fetch_array($result_main_menu))!=false)
{
$b_main_menu_name=$row_main_menu['main_menu_name'];
$access_details_temp='';
$access_details_temp1='';
$highligh_level_2='';
$sql_sub_menu="SELECT * FROM basic_admin_menu_tb WHERE main_menu_name='$b_main_menu_name' AND del=1 AND menu_enable=1 ORDER BY sub_menu_order ASC";
$result_sub_menu=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_sub_menu);
$sub_menu_counter=mysqli_num_rows($result_sub_menu);
$sub_counter=0;
$bs_sidebar_details_temp='';
while(($row_sub_menu=mysqli_fetch_array($result_sub_menu))!=false)
{
$m_id =$row_sub_menu['id'];
$sub_menu_name =$row_sub_menu['sub_menu_name'];
$sub_menu_link =$row_sub_menu['sub_menu_link'];
$menu_icon=$row_sub_menu['menu_icon'];
if($sub_menu_link!='' && $fauthentication_allow==0 )
{
  if($_SESSION['empuserauth_login']=='Global')
  {
  $a_authentication=1;
  }
  else
  {
  $sql_check='SELECT * FROM `authentication_tb` WHERE menu_id="'.$m_id.'"  AND del=1 AND  user_id="'.$_SESSION['empuserid_login'].'"  ORDER BY authentication DESC';

  $result_check=mysqli_query($GLOBALS["__CIS_MYSQLI"], $sql_check);
  $row_check=mysqli_fetch_array($result_check);
  $auth_id=$row_check['id'];
  $a_authentication=$row_check['authentication'];
  }
if($url_check==$sub_menu_link && $a_authentication==0 && $url_check!='welcome.php')
{
$authentication_allow=0;
}

if($a_authentication==1)
{

if($access_details_temp1=='')
{
if($sub_menu_link!='#')
{
$access_details_temp1=$sub_menu_link;
$m_access_details=$sub_menu_link;
}
}

if($url_check==$sub_menu_link)
{
$gallery_bar_id=$m_id;
if($sub_menu_name!='')
$title=$sub_menu_name;// subtitle $b_main_menu_name.' - '.$sub_menu_name;
else
{
$title=$b_main_menu_name;
}
if($sub_menu_counter>0)
{
//$breadcrumb_icon_details='<i class="'.$bs_menu_icon.'"></i>';
if($category!=$title && $category!=$b_main_menu_name)
$breadcrumb_details='<li><a href="'.$access_details_temp1.'">'.$category.'</a></li>';
}
if($b_main_menu_name && $b_main_menu_name!=$title)
$breadcrumb_details_1='<li><a href="#">'.$b_main_menu_name.'</a></li>';
/////////breadcrumb old///////////
/*
if($sub_menu_counter>0)
$breadcrumb_details='<li><a href="'.$access_details_temp1.'"><i class="'.$bs_menu_icon.'"></i> '.$category.'</a></li>';
$breadcrumb_details_1='<li class="active"><i class="'.$menu_icon.'"></i> '.$title.'</li>'; */
//Left Submenu
//$bs_sidebar_details_temp.='<li class="active"><a href="'.$sub_menu_link.'"> <i class="'.$menu_icon.'"></i> '.stripslashes($sub_menu_name).'</a></li>';
//Top Submenu
$bs_sidebar_details_temp.='<a href="'.$sub_menu_link.'" class="btn btn-info"> '.stripslashes($sub_menu_name).' </a>';
$highligh_level_1=' active';
$highligh_level_2=' active';
$highligh_level_3=' open';
}
else
{
//Top Submenu
$bs_sidebar_details_temp.='<a href="'.$sub_menu_link.'"  class="btn btn-white"> '.stripslashes($sub_menu_name).' </a>';
//Left Submenu
//$bs_sidebar_details_temp.='<li><a href="'.$sub_menu_link.'"> <i class="'.$menu_icon.'"></i> '.stripslashes($sub_menu_name).'</a></li>';
}
$sub_counter++;
}
}
}

if($highligh_level_2==' active' && $sub_counter>1)
{
//Top Submenu
$bs_sidebar_details='<div class="btn-group" style="float:right; margin:10px 15px;">'.$bs_sidebar_details_temp.'</div>';
//Left Submenu
//$bs_sidebar_details='<aside class="profile-nav col-lg-3"> <div class="col-lg-12" style="padding-left:30px;"><section class="panel"> <ul class="nav nav-pills nav-stacked">'.$bs_sidebar_details_temp.'</ul> </section></div>  </aside>';
}

if($access_details_temp1!='')
{
$access_details.='<li class="sub-menu1'.$highligh_level_2.'"><a href="'.$access_details_temp1.'" class=""> <i class="'.$menu_icon.'"></i> <span>'.$b_main_menu_name.'</span></a> </li>';

$n_access_details.='<li class="'.$highligh_level_2.'"><a href="'.$access_details_temp1.'" class=""> <i class="'.$menu_icon.'"></i> <span class="pl8">'.$b_main_menu_name.'</span></a> </li>';

$access_limit++;
}
/*else if($access_details_temp!='')
{
$access_details.='<li class="sub-menu1'.$highligh_level_2.'"><a href="javascript:;" class=""> <i class="'.$menu_icon.'"></i> <span>'.$b_main_menu_name.'</span><span class="arrow"></span> </a><ul class="sub">'.$access_details_temp.'</ul> </li>';
$access_limit++;
}*/
}
/*if($access_limit>0)
{*/
if($access_limit<=1 && $m_access_details!='')
{
/*if($sub_counter>1)
{
echo '<li class="sub-menu'.$highligh_level_1.'"><a href="javascript:;" class=""> <i class="'.$bs_menu_icon.'"></i> <span>'.$category.'</span><span class="arrow"></span> </a><ul class="sub">';
echo '<div id="sidebar'.$counter.'" class="sub1">'.$access_details.'</div>';
echo '</ul> </li>';
}
else
{*/
echo '<li class="sub-menu'.$highligh_level_1.'"><a href="'.$m_access_details.'" class=""> <i class="'.$bs_menu_icon.'"></i> <span>'.$category.'</span></a></li>';
$dash_active='';
if($m_access_details=='edashboard.php' && $url=='dashboard.php')
$dash_active=' active';
$top_nav_details.='<li  id="menu'.$category_id.'" class="'.$highligh_level_1.$dash_active.'"><a href="'.$m_access_details.'" class="text-center"><i class="'.$bs_menu_icon.' nav_menu_icon" ></i> <p class="nav_menu_title">'.$category.'</p></a></li>';
//}
}
else if($access_limit>1)
{

echo '<li class="sub-menu'.$highligh_level_1.'"><a href="javascript:;" class=""> <i class="'.$bs_menu_icon.'"></i> <span>'.$category.'</span><span class="arrow'.$highligh_level_3.'"></span> </a><ul class="sub">';
echo '<div id="sidebar'.$counter.'" class="sub1">'.$access_details.'</div>';
echo '</ul> </li>';

if($counter1>5 && $counter1>($total_menu_category-2))
$ddstyle=' style="left:auto; right: 0px;" ';


$top_nav_details.='<li id="menu'.$category_id.'" class="dropdown'.$highligh_level_1.'">
                <a href="#" class="dropdown-toggle text-center" data-toggle="dropdown" role="button" aria-expanded="false"><i class="'.$bs_menu_icon.' nav_menu_icon" ></i> <p class="nav_menu_title">'.$category.' <i class="icon-caret-down"></i></p></a>
                <ul class="dropdown-menu" role="menu" '.$ddstyle.'>
				'.$n_access_details.'
                </ul>
              </li>';


}
$counter++;
//}
++$counter1;
}// Menu


$top_nav_details='<nav class="navbar navbar-default">
        <div class="container-fluid">
          <div class="navbar-header">
            <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
              <span class="sr-only">Toggle navigation</span>
              <span class="icon-bar"></span>
              <span class="icon-bar"></span>
              <span class="icon-bar"></span>
            </button>
          </div>
          <div id="navbar" class="navbar-collapse collapse">
            <ul class="nav navbar-nav">'.$top_nav_details.'</ul>
          </div>
        </div>
      </nav>';


if($title=='')
{
$title='Dashboard';
$breadcrumb_details='<ul class="breadcrumb"><li class="active">Home</li></ul>';
}
else
{
$breadcrumb_details='<ul class="breadcrumb">'.$breadcrumb_details.$breadcrumb_details_1.'</ul>';
}
//Top Nav
if(($title=='Dashboard' && $url=='dashboard.php') || 
($title=='Staff Pattern' && $url=='dashboard_v5.php') || 
($title=='Student Dashboard' && $url=='dashboard_student.php') || 
($title=='Library Dashboard' && $url=='dashboard_library.php') || 
($title=='Fee Dashboard' && $url=='fee_dashboard_v2.php') || 
($title=='Patient Dashboard' && $url=='dashboard_patient.php') || 
$url=='elearn_dashboard.php'
)
{
$bs_sidebar_details.='<button type="submit" name="cRefresh" value="1" class="btn btn-lg btn-info pull-right" style="border-radius: 0px; padding-bottom: 8px;"><i class="icon-refresh"></i></button><input name="attendance_date" type="text" class="form-control calendar pull-right" id="attendance_date" style="font-size: 23px; width: 180px;" value="'.($_POST['attendance_date']?$_POST['attendance_date']:date('d-m-Y')).'" onchange="this.form.submit()" readonly />';

$breadcrumb_details='<div class="row"><div class="col-sm-12 no-padding">'.$top_nav_details.'</div><div class="profile-info"><div class="col-sm-12  header_panel" ><div class="col-xs-6 no-padding-left">'.$breadcrumb_details.'<h3 class="title_h3"  >'.$title.'</h3></div><div class="col-xs-6 no-padding">'.$bs_sidebar_details.'</div></div></div></div> ';
}
else
{

$breadcrumb_details='<div class="row"><div class="col-sm-12 no-padding">'.$top_nav_details.'</div><div class="profile-info"><div class="col-sm-12  header_panel" ><div class="col-sm-6 no-padding-left">'.$breadcrumb_details.'<h3 class="title_h3">'.$title.'</h3></div><div class="col-sm-6">'.$bs_sidebar_details.'</div></div></div></div> ';

}
// LEft NAv
//$breadcrumb_details='<div class="row"><div class="col-lg-12 no-padding">'.$top_nav_details.'</div></div><div class="profile-info"><div class="col-lg-12  header_panel" ><div class="col-lg-12 no-padding-left">'.$breadcrumb_details.'<h3 class="title_h3">'.$title.'</h3></div> </div></div> ';

/*if($title=='')
{
$title='Dashboard';//Breadcrumb
//$breadcrumb_details='<div class="row"><div class="col-lg-12"><!--breadcrumbs start --><ul class="breadcrumb"><li class="active"><i class="icon-dashboard"></i> Dashboard</li></ul><!--breadcrumbs end --></div></div>';
if($bs_sidebar_details !='')
$breadcrumb_details.='<div class="row  header_panel"><div class="col-lg-12 no-padding-left"> <h3 class="drg-event-title title_h3">'.$title.'</h3></div></div>';
}
else
{
//Breadcrumb
//$breadcrumb_details='<div class="row"><div class="col-lg-12"><!--breadcrumbs start --><ul class="breadcrumb"><li><a href="dashboard.php"><i class="icon-dashboard"></i> Dashboard</a></li>'.$breadcrumb_details.$breadcrumb_details_1.'</ul><!--breadcrumbs end --></div></div>';
if($bs_sidebar_details !='')
$breadcrumb_details.='<div class="row  header_panel"><div class="col-lg-12 no-padding-left" ><div class="col-lg-6"><h3 class="title_h3">'.$title.'</h3></div><div class="col-lg-6">'.$bs_sidebar_details.'</div></div></div>';
//$breadcrumb_details.='<div class="row"><div class="col-lg-12  header_panel"><h3 class="drg-event-title" style="padding-left:15px;">'.$title.'</h3></div></div>';
}*/
//Top Nav
$bs_sidebar_details='';
$pageloader='<div style="margin-top:23%; text-align:center;" class="pageloader"><img src="img/loading.gif" width="40"> </div>';
?>
<li>
<a class="" href="logout">
<i class="icon-off"></i>
<span>Logout</span>
</a>
</li>
</ul>
<!-- sidebar menu end-->
</div>
</aside>

<?

 if($authentication_allow==0)
{
echo '<script>window.location="welcome.php";</script>';
header("location:welcome.php");
exit;
}
if($fauthentication_allow==1)
{
echo '<script>window.location="dashboard.php";</script>';
header("location:dashboard.php");
exit;
}
?>
<title><?PHP   echo $title ?></title>
