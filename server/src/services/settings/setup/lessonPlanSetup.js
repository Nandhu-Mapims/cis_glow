import { prisma } from '../../../config/prisma.js';
import { lessonPlanSetupSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'lession_plan_setup.php';

function mapTypeRow(row) {
  return {
    id: row.id,
    order: row.l_order,
    name: row.name,
    enableTopic: row.l_type === '1' || row.l_type === 1,
  };
}

export async function loadLessonPlanSetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();

  let mode = null;
  let rows = [];
  let limitValue = '';
  let limitId = null;

  if (category === 'Type') {
    mode = 'grid';
    const data = await prisma.lesson_plan_setup.findMany({
      where: { category, del: { not: 0 } },
      orderBy: { l_order: 'asc' },
      select: lessonPlanSetupSelect,
    });
    rows = data.map(mapTypeRow);
  } else if (category === 'Limit') {
    mode = 'limit';
    const row = await prisma.lesson_plan_setup.findFirst({
      where: { category, del: { not: 0 } },
      orderBy: { l_order: 'asc' },
      select: lessonPlanSetupSelect,
    });
    if (row) {
      limitId = row.id;
      limitValue = row.name;
    }
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    category,
    mode,
    rows: rows.length ? rows : (mode === 'grid' ? [{ order: 1, name: '', enableTopic: false }] : []),
    limitId,
    limitValue,
  };
}

export async function saveLessonPlanSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.lesson_plan_setup.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logSettingsSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadLessonPlanSetup(memberId, { category: payload.category }, { ...audit, skipLog: true })),
      };
    } catch {
      await logSettingsSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const category = String(payload.category || '').trim();
  if (!category) return { success: false, message: 'Category is required' };

  const { create, update } = auditFields(memberId, audit);

  if (category === 'Limit') {
    const value = String(payload.limitValue || '').trim();
    if (payload.limitId) {
      await prisma.lesson_plan_setup.update({
        where: { id: Number(payload.limitId) },
        data: { name: value, del: 1, category, l_type: '', l_order: 1, ...update },
      });
    } else if (value) {
      await prisma.lesson_plan_setup.create({
        data: { category, name: value, l_type: '', l_order: 1, ...create },
      });
    }
  } else {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    await prisma.lesson_plan_setup.updateMany({
      where: { category, del: 1 },
      data: { del: 0, ...update },
    });

    for (const row of rows) {
      const name = String(row.name || '').trim();
      const order = Number(row.order) || 0;
      const lType = row.enableTopic ? '1' : '0';
      if (!row.id) {
        if (!name) continue;
        await prisma.lesson_plan_setup.create({
          data: { category, name, l_type: lType, l_order: order, ...create },
        });
      } else {
        await prisma.lesson_plan_setup.update({
          where: { id: Number(row.id) },
          data: { del: 1, category, name, l_type: lType, l_order: order, ...update },
        });
      }
    }
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadLessonPlanSetup(memberId, { category }, { ...audit, skipLog: true })),
  };
}
