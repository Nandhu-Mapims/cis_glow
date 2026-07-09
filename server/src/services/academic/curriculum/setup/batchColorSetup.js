import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { auditFields, logAcademicSetup } from '../../setup/setupAudit.js';

const PAGE = 'batch_color_setup.php';
const BATCH_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export async function loadBatchColor(memberId, _fields = {}, audit = {}) {
  const batchRow = await prisma.$queryRawUnsafe(
    'SELECT batch_no FROM basic_subject_batch_tb WHERE del = 1 ORDER BY batch_no+0 DESC LIMIT 1',
  );
  const totalBatch = Number(batchRow[0]?.batch_no) || 0;

  const colorRows = await prisma.$queryRawUnsafe(
    'SELECT id, batch_no, back_color, fore_color FROM batch_color_tb WHERE del = 1',
  );
  const colorMap = Object.fromEntries(colorRows.map((r) => [String(r.batch_no), r]));

  const rows = [];
  for (let b = 1; b <= totalBatch; b += 1) {
    const existing = colorMap[String(b)];
    rows.push({
      id: existing?.id ? Number(existing.id) : null,
      batchNo: b,
      batchLabel: BATCH_LABELS[b - 1] || String(b),
      backColor: String(existing?.back_color || '').replace(/^#/, ''),
      foreColor: String(existing?.fore_color || '').replace(/^#/, ''),
    });
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', String(totalBatch), memberId, audit);
  return { rows, totalBatch };
}

export async function saveBatchColor(payload, memberId, audit = {}) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe('UPDATE batch_color_tb SET del = 0, updated_by = ?, updated_ip = ?, updated_dt = NOW() WHERE del = 1', memberId, update.updated_ip);

  for (const row of rows) {
    const batchNo = String(row.batchNo || '').trim();
    const backColor = String(row.backColor || '').replace(/^#/, '').trim();
    const foreColor = String(row.foreColor || '').replace(/^#/, '').trim();
    if (!batchNo) continue;

    if (row.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE batch_color_tb SET batch_no='${escapeSql(batchNo)}', back_color='${escapeSql(backColor)}',
         fore_color='${escapeSql(foreColor)}', del=1, updated_by='${escapeSql(memberId)}',
         updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${Number(row.id)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO batch_color_tb (batch_no, back_color, fore_color, created_dt, created_ip, created_by, del)
         VALUES ('${escapeSql(batchNo)}', '${escapeSql(backColor)}', '${escapeSql(foreColor)}', NOW(),
         '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', String(rows.length), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadBatchColor(memberId, {}, { ...audit, skipLog: true })),
  };
}
