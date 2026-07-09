import { prisma } from '../../config/prisma.js';

/**
 * Job categories used in staff search (legacy staff_profile_edit.php dropdown).
 */
export async function getStaffCategoryOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.category_name
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1 AND B.category = 'Category'
     ORDER BY A.job_category ASC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.category_name,
  }));
}
