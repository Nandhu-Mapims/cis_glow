export const DASHBOARD_WIDGET_LABELS = {
  staff_attendance: 'Staff Attendance',
  staff_attendance_incampus: 'Staff Attendance (Incampus)',
  staff_leave_absent: 'Staff Leave/Absent',
  staff_permission: 'Staff Permission',
  staff_details: 'Staff Details',
  staff_current: 'Staff Current',
  staff_unit: 'Faculty Structure',
  staff_unit_1: 'Faculty - Unit I',
  staff_unit_2: 'Faculty - Unit II',
  ug_attendance: 'U.G Attendance (Reg.)',
  ug_attendance_add: 'U.G Attendance (Add.)',
  pg_attendance: 'P.G Attendance',
  pg_attendance_dept: 'P.G Attendance (Dept)',
  pg_leave_absent: 'P.G Leave/Absent',
  pg_permission: 'P.G Permission',
  internship_attendance: 'Internship Attendance',
  internship_attendance_batch: 'Internship Attendance (Batch)',
  internship_leave_absent: 'Internship Leave/Absent',
  internship_permission: 'Internship Permission',
  student_details: 'Student Details (Reg.)',
  student_add_details: 'Student Details (Add.)',
  student_scholarship: 'Scholarship',
  student_firstgraduate: 'Student First Graduate',
  student_attendance: 'Student Attendance',
  student_hostel: 'Hostel',
  gents_hostel_attendance: 'Gents Hostel Attendance',
  ladies_hostel_attendance: 'Ladies Hostel Attendance',
  student_ghostel: 'Gents Hostel Att.',
  student_lhostel: 'Ladies Hostel Att.',
  feedback_analyasis: 'Feedback Analysis',
};

const STUDENT_INFO_WIDGETS = new Set([
  'student_details', 'student_scholarship', 'student_firstgraduate', 'student_add_details',
]);

const STUDENT_ATT_WIDGETS = new Set([
  'student_attendance', 'ug_attendance', 'ug_attendance_add', 'pg_attendance', 'pg_attendance_dept',
  'pg_leave_absent', 'pg_permission', 'internship_attendance', 'internship_attendance_batch',
  'internship_leave_absent', 'internship_permission',
]);

const STAFF_ATT_WIDGETS = new Set([
  'staff_attendance', 'staff_attendance_incampus', 'staff_leave_absent',
]);

const HOSTEL_WIDGETS = new Set([
  'student_hostel', 'gents_hostel_attendance', 'ladies_hostel_attendance', 'student_ghostel', 'student_lhostel',
]);

export function groupWidgets(widgetNames) {
  const groups = {};
  widgetNames.forEach((name) => {
    if (STUDENT_INFO_WIDGETS.has(name)) {
      groups.student = groups.student || [];
      groups.student.push(name);
    } else if (STUDENT_ATT_WIDGETS.has(name)) {
      groups.student_att = groups.student_att || [];
      groups.student_att.push(name);
    } else if (STAFF_ATT_WIDGETS.has(name)) {
      groups.staff_att = groups.staff_att || [];
      groups.staff_att.push(name);
    } else if (HOSTEL_WIDGETS.has(name)) {
      groups.student_hostel = groups.student_hostel || [];
      groups.student_hostel.push(name);
    } else {
      groups[name] = [name];
    }
  });
  return groups;
}
