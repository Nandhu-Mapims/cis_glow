import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { isGlobalAccessType } from '../utils/accessType.js';

const MODULE_MENU_PATTERNS = {
  students: ['student_%'],
  staff: ['staff_%', 'org_%', 'inspection_%', 'dci_%', 'tnmgr%'],
  fees: ['%fee%'],
  attendance: [
    '%attendance%',
    'student_mattendance%',
    'individual_calendar%',
    'staff_att%',
    'staff_calendar%',
    'staff_leave%',
    'staff_permission%',
    'staff_defaulter%',
    'biomertic%',
    'teaching_staff%',
    'staff_yearly%',
    'staff_att_chart%',
    'staff_academic%',
    'staff_att_time%',
    'staff_cl_el%',
    'staff_att_transport%',
    'available_leave%',
    'clear_icache%',
    'staff_daily%',
    'staff_compensation%',
    'staff_holiday%',
    'staff_lpd%',
  ],
  academic: [
    'course_%',
    'subject_%',
    'academic%',
    'master_setup%',
    'tt_config%',
    'class_time%',
    'timetable%',
  ],
  exam: ['term_%', 'exam_%', 'omr_%', '%exam_statement%', 'camp_activity_%'],
  admin: [
    'account_%',
    'access.php',
    'change_password%',
    'otp_account%',
    'committee_access%',
    'department_%',
    'authentication_%',
    'staff_authentication%',
    'staff_page_authentication%',
    'dashboard_access%',
    'log_%',
  ],
  payroll: [
    'payroll_%',
    'salary_%',
    'stipend_%',
    'staff_%',
    'generate_payroll%',
    'security_deposit%',
    'staff_tax%',
    'staff_pfesi%',
    'staff_salary%',
    'salary_advance%',
    'salary_arrear%',
    'staff_deduction%',
    'staff_lop%',
    'staff_cheque%',
    'payroll_close%',
    'payroll_monthly%',
    'payroll_report.php%',
  ],
  library: ['library_%', 'dashboard_library%', 'lib_attendance%', 'transaction_%', 'supplier_%', 'resources_%', 'resource_transfer%'],
  hostel: ['hostel_%', 'student_hostel%', 'dashboard_hostel%', 'staff_rental_hostel%', 'block_%', 'room_%', 'transport_%'],
  circular: ['circular_%'],
  sms: ['student_sms%', 'staff_sms%', 'group_%', 'sms_template%', 'parent_meeting_sms%', 'general_sms%'],
  web: ['web_%', 'home_slider%', 'photos_%', 'events_%', 'website_doc%', 'staff_web_display%'],
  tv: ['tv_%', 'tv/%'],
  kiosk: ['machine_%', 'att_menu%', 'att_instruction%', 'slider_widget%', 'student_machine%', 'staff_machine%', 'staff_mpassword%', 'student_mpassword%', 'announcement_%', 'm_recepit%', 'm_att_%'],
  committee: ['committee_%', 'event_committee_%', 'task_%', 'st_task_%', 'approve_event%', 'approve_reschedule%', 't_client_%', 'tv_academic_%'],
  certificates: ['certificate_%', 'tc_%', 'create_crequest%', 'student_internship%', 'internship_%', 'aaadar_%', 'dashboard_certificate%'],
  naac: ['naac_%'],
  portfolio: ['student_portfolio%', 'student_portfolia%'],
  elearning: ['elearn_%', 'subject_test%', 'subject_report%'],
  adminOffice: [
    'student_activities_%',
    'staff_activities_%',
    'courier_%',
    'incident_%',
    'events_group_%',
  ],
  settings: [
    'staff_dept%',
    'staff_desg%',
    'staff_profile_setup%',
    'staff_edu%',
    'approval_setup%',
    'sms_%',
    'print_%',
    'lession%',
    'salary_signature%',
    'payroll_cron%',
    'sms_cron%',
    'master_setup%',
    'academic.php%',
    'course_%',
    'subject_master%',
    'dashboard_access%',
  ],
};

async function userHasModuleAccess(userId, patterns) {
  // Single query covering all patterns instead of one round-trip per pattern
  // (some modules have 20-30 patterns; that was 20-30 sequential DB calls per request).
  const likeConditions = Prisma.join(
    patterns.map((pattern) => Prisma.sql`TRIM(M.sub_menu_link) LIKE ${pattern}`),
    ' OR ',
  );
  const rows = await prisma.$queryRaw`
    SELECT EXISTS(
      SELECT 1
      FROM authentication_tb AS A
      INNER JOIN basic_admin_menu_tb AS M ON A.menu_id = M.id
      WHERE A.del = 1 AND A.authentication = 1
        AND M.del = 1 AND M.menu_enable = 1
        AND A.user_id = ${userId}
        AND (${likeConditions})
    ) AS allowed
  `;
  return Number(rows[0]?.allowed || 0) > 0;
}

export function menuAuthForModule(moduleKey) {
  const patterns = MODULE_MENU_PATTERNS[moduleKey];
  if (!patterns) {
    throw new Error(`Unknown menu auth module: ${moduleKey}`);
  }

  return async (req, res, next) => {
    try {
      if (isGlobalAccessType(req.user?.accessType)) {
        return next();
      }
      const allowed = await userHasModuleAccess(req.user.id, patterns);
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to access this module' });
      }
      return next();
    } catch (error) {
      console.error('Menu auth error:', error);
      return res.status(500).json({ message: 'Unable to verify menu permissions' });
    }
  };
}
