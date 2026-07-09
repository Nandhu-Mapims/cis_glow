import { prisma } from '../../config/prisma.js';

/** Avoid Prisma choking on legacy 0000-00-00 datetime columns. */
export const SAFE_UPDATED_DT = `IF(CAST(updated_dt AS CHAR) LIKE '0000-00-00%', NULL, updated_dt) AS updated_dt`;

export async function loadNaacQuanSections() {
  return prisma.$queryRawUnsafe(`
    SELECT id, name, d_order, s_name, d_dept, ${SAFE_UPDATED_DT}
    FROM naac_quan_main
    WHERE del = 1
    ORDER BY d_order ASC
  `);
}

export async function loadNaacQuanItems(deptId) {
  if (!deptId) return [];
  return prisma.$queryRawUnsafe(`
    SELECT id, name, d_order, doc_number, doc_type, attachment, attachment_size, d_id, ${SAFE_UPDATED_DT}
    FROM naac_quan_sub
    WHERE del = 1 AND d_id = ${Number(deptId)}
    ORDER BY d_order ASC
  `);
}

export async function loadNaacQuanItemsFiltered({ deptRef = '', docType = '' } = {}) {
  const conditions = ['del = 1'];
  if (deptRef) conditions.push(`d_id = ${Number(deptRef)}`);
  if (docType) conditions.push(`doc_type = '${String(docType).replace(/'/g, "''")}'`);
  return prisma.$queryRawUnsafe(`
    SELECT id, name, d_order, doc_number, doc_type, attachment, attachment_size, d_id, ${SAFE_UPDATED_DT}
    FROM naac_quan_sub
    WHERE ${conditions.join(' AND ')}
    ORDER BY d_id ASC, name ASC
  `);
}

const SAFE_CREATED_DT = `IF(CAST(created_dt AS CHAR) LIKE '0000-00-00%', NULL, created_dt) AS created_dt`;

export async function loadNaacQuanItemsDetailed({ deptRef = '', docType = '' } = {}) {
  const conditions = ['del = 1'];
  if (deptRef) conditions.push(`d_id = ${Number(deptRef)}`);
  if (docType) conditions.push(`doc_type = '${String(docType).replace(/'/g, "''")}'`);
  return prisma.$queryRawUnsafe(`
    SELECT id, name, d_order, doc_number, doc_type, attachment, attachment_size, d_id,
      created_by, ${SAFE_CREATED_DT}, updated_by, ${SAFE_UPDATED_DT}
    FROM naac_quan_sub
    WHERE ${conditions.join(' AND ')}
    ORDER BY name ASC
  `);
}
