import { prisma } from '../../../config/prisma.js';
import { ciaExamNameSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';

const PAGE = 'exam_name_config.php';

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((m) => ({ value: m, label: m }));

function mapRow(row) {
  return {
    id: row.id,
    order: row.exam_order,
    name: row.exam_name,
    month: row.exam_month,
  };
}

async function fetchRows() {
  const rows = await prisma.cia_exam_name.findMany({
    where: { del: 1 },
    orderBy: { exam_order: 'asc' },
    select: ciaExamNameSelect,
  });
  return rows.map(mapRow);
}

export async function loadExamNameSetup(memberId, _fields = {}, audit = {}) {
  const rows = await fetchRows();
  await logExamSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    monthOptions: MONTH_OPTIONS,
    rows: rows.length ? rows : [{ order: 1, name: '', month: '' }],
  };
}

export async function saveExamNameSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.cia_exam_name.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logExamSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadExamNameSetup(memberId, {}, { ...audit, skipLog: true })),
      };
    } catch {
      await logExamSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.cia_exam_name.updateMany({
    where: { del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    const month = String(row.month || '').trim();

    if (!row.id) {
      if (!name) continue;
      await prisma.cia_exam_name.create({
        data: {
          exam_name: name,
          exam_order: order,
          exam_month: month,
          ...create,
        },
      });
    } else {
      await prisma.cia_exam_name.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          exam_name: name,
          exam_order: order,
          exam_month: month,
          ...update,
        },
      });
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadExamNameSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
