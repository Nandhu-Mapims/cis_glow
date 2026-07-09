import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export const TV_DASHBOARD_WIDGETS = {
  staff_attendance: 'Staff Attendance',
  staff_details: 'Staff Details',
  staff_current: 'Staff Current',
  student_attendance: 'Student Attendance',
  internship_attendance: 'Internship Attendance',
  student_details: 'Student Details',
  gents_hostel_attendance: 'Gents Hostel Attendance',
  ladies_hostel_attendance: 'Ladies Hostel Attendance',
  staff_birthday: 'Staff Birthday',
  student_birthday: 'Student Birthday',
  announcement: 'Announcements',
  fee_collection: 'Fee Collection',
  log_details: 'Activity Report',
  image_gallery: 'Image Gallery',
  video_gallery: 'Video Gallery',
  circulars: 'Circulars',
  kiosk_activity: 'KIOSK Activity',
  staff_prerequest: 'Staff Leave',
  staff_prepermission: 'Staff Permission',
  staff_defaulter: 'Staff Defaulter',
  student_prerequest: 'Student Leave',
  student_prepermission: 'Student Permission',
  student_defaulter: 'Student Defaulter',
  student_certificate: 'Student Certificate',
  events: 'Events',
};

export async function loadTvUserOptions(memberId) {
  const currentRows = await prisma.$queryRawUnsafe(`
    SELECT access_type FROM web_account_setup
    WHERE member_id='${escapeSql(memberId)}' AND del=1 LIMIT 1
  `);
  const isGlobal = String(currentRows[0]?.access_type || '').toLowerCase() === 'global';
  const filter = isGlobal ? '' : ` AND access_type!='global'`;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, member_id, member_name
    FROM web_account_setup
    WHERE del=1 ${filter}
    ORDER BY member_id ASC
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    label: `${r.member_id} - ${r.member_name}`,
  }));
}

export function widgetOptionsList() {
  return Object.entries(TV_DASHBOARD_WIDGETS).map(([value, label]) => ({ value, label }));
}
