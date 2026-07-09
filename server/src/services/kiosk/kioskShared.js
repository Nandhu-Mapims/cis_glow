import { prisma } from '../../config/prisma.js';

export const KIOSK_MENU_CATEGORIES = [
  { value: 'staff', label: 'Staff' },
  { value: 'student', label: 'Student' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'material', label: 'Material' },
];

export const KIOSK_MENU_ACCESS_CATEGORIES = [
  { value: 'staff', label: 'Staff' },
  { value: 'student', label: 'Student' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'material', label: 'Material' },
];

export const ATT_STATEMENT_OPTIONS = [
  { key: 'periods_attended_allocated', label: 'Periods Attended/Allocated' },
  { key: 'deputation_periods', label: 'Deputation Periods' },
  { key: 'od', label: 'OD' },
  { key: 'non_fp_punch', label: 'Non FP Punch - Modified (days)' },
  { key: 'pre_approval', label: 'Pre Approval Leave/Permission' },
  { key: 'post_approval', label: 'Post Approval Leave/Permission' },
  { key: 'total_working', label: 'No. of Working Days' },
  { key: 'present', label: 'Present' },
  { key: 'leave', label: 'Total Leave' },
  { key: 'late', label: 'Late' },
  { key: 'permission', label: 'Permission' },
  { key: 'lop', label: 'LOP Deduction' },
];

export const RECEIPT_TYPES = [
  { value: 'material_request', label: 'Material Request' },
];

export function randomPin(length = 4) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min)));
}

export async function loadJobCategories() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT B.id, B.category_name
    FROM staff_profile_tb AS A
    INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
    WHERE A.del=1 AND B.category='Category'
    ORDER BY B.category_name ASC
  `);
  return rows.map((r) => ({ id: Number(r.id), name: r.category_name }));
}
