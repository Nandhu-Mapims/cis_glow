import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logWebSetup } from './webAudit.js';

const PAGE = 'staff_web_display_order_setup.php';

export async function loadWebStaffDisplaySetup(_memberId, fields, _query, audit) {
  const deptId = fields.deptId ? parseId(fields.deptId) : null;
  const deptRows = await prisma.$queryRawUnsafe(`
    SELECT id, name, d_order
    FROM staff_dept_master
    WHERE del=1
    ORDER BY d_order ASC, name ASC
  `);

  let staffRows = [];
  if (deptId) {
    staffRows = await prisma.$queryRawUnsafe(`
      SELECT A.id AS staff_id, A.staff_name, A.staff_initial, A.staff_id AS staff_code,
             B.id AS desg_id, B.name AS desg_name,
             COALESCE(W.id, 0) AS row_id, COALESCE(W.d_order, 0) AS d_order
      FROM staff_designation_tb AS C
      INNER JOIN staff_profile_tb AS A ON A.id = C.staff_id
      INNER JOIN staff_desg_master AS B ON B.id = C.designation
      LEFT JOIN staff_web_desg_order AS W
        ON W.del=1 AND W.dept_id=${deptId}
        AND W.desg_id=B.id AND W.staff_id=CAST(A.id AS CHAR)
      WHERE A.del=1 AND B.del=1 AND C.del=1
        AND C.department='${escapeSql(String(deptId))}'
        AND A.is_academic=1
        AND (A.job_category='255' OR A.job_category='257')
        AND (A.releaving_date > DATE(NOW()) OR A.releaving_date='0000-00-00')
      ORDER BY B.d_order ASC, A.staff_name ASC
    `);
  }

  await logWebSetup(_memberId, audit, PAGE, 'load');
  return {
    success: true,
    departments: deptRows.map((r) => ({
      id: r.id,
      name: r.name,
      order: r.d_order,
    })),
    deptId,
    staffRows: staffRows.map((r) => ({
      rowId: r.row_id,
      staffId: r.staff_id,
      staffLabel: `${r.staff_code} - ${r.staff_initial || ''} ${r.staff_name}`.trim(),
      desgId: r.desg_id,
      desgName: r.desg_name,
      order: r.d_order,
    })),
  };
}

export async function saveWebStaffDisplaySetup(memberId, fields, _query, audit) {
  const deptId = parseId(fields.deptId);
  if (!deptId) {
    return { success: false, message: 'Select a department.' };
  }
  const rows = Array.isArray(fields.rows) ? fields.rows : [];
  const auditCtx = auditFields(memberId, audit);
  const deptStr = Number(deptId);

  for (const row of rows) {
    const staffId = parseId(row.staffId);
    const desgId = parseId(row.desgId);
    const order = Number(row.order) || 0;
    const rowId = row.rowId ? parseId(row.rowId) : null;

    if (rowId) {
      await prisma.$executeRawUnsafe(`
        UPDATE staff_web_desg_order SET
          d_order=${order},
          updated_dt=NOW(),
          updated_ip='${escapeSql(auditCtx.ip)}',
          updated_by='${escapeSql(auditCtx.by)}'
        WHERE id=${rowId} AND del=1
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO staff_web_desg_order
          (dept_id, staff_id, desg_id, d_order, created_dt, created_ip, created_by, del)
        VALUES
          (${deptStr}, '${escapeSql(String(staffId))}', ${desgId},
           ${order}, NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
      `);
    }
  }

  await logWebSetup(memberId, audit, PAGE, 'save');
  return { success: true, message: 'Staff display order saved.' };
}
