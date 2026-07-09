import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import { loadDeptDesignationLookups } from '../staffShared.js';

const PAGE = 'org_chart_config.php';

function toDescKey(deptId, desgId) {
  return `${deptId}___${desgId}`;
}

function buildDesignationLabel(deptName, desgName) {
  return `${deptName} | ${desgName}`;
}

function buildDesignationGroups(departments, designations, { includeKeys = null, excludeKeys = [] } = {}) {
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const exclude = new Set(excludeKeys);
  const include = includeKeys ? new Set(includeKeys) : null;
  const byDept = {};
  for (const desg of designations) {
    const value = toDescKey(desg.departmentId, desg.id);
    const allowed = include ? include.has(value) : !exclude.has(value);
    if (!allowed) continue;
    const deptName = deptById[desg.departmentId];
    if (!deptName) continue;
    if (!byDept[desg.departmentId]) byDept[desg.departmentId] = [];
    byDept[desg.departmentId].push({
      value,
      label: buildDesignationLabel(deptName, desg.name),
    });
  }
  return departments
    .filter((dept) => byDept[dept.id]?.length)
    .map((dept) => ({
      departmentName: dept.name,
      options: byDept[dept.id],
    }));
}

function buildDesignationLabelMap(departments, designations) {
  const deptById = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const map = {};
  for (const desg of designations) {
    const deptName = deptById[desg.departmentId];
    if (!deptName) continue;
    map[toDescKey(desg.departmentId, desg.id)] = buildDesignationLabel(deptName, desg.name);
  }
  return map;
}

async function loadLowerLevelDesignationKeys(currentLevelOrder) {
  if (!currentLevelOrder) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.level_order, B.level_desc
     FROM web_positions_level AS A
     INNER JOIN web_positions_dlevel AS B ON A.id = B.level_id
     WHERE A.del = 1 AND B.del = 1`,
  );
  return rows
    .filter((r) => Number(r.level_order) < currentLevelOrder)
    .map((r) => String(r.level_desc || '').trim())
    .filter(Boolean);
}

export async function loadOrgChartConfigSetup(memberId, fields = {}, audit = {}) {
  const lookups = await loadDeptDesignationLookups();
  const levels = await prisma.$queryRawUnsafe(
    'SELECT id, level_title, level_order FROM web_positions_level WHERE del = 1 ORDER BY level_order ASC',
  );
  const isAddNew = fields.levelId === 'add_new';
  const levelId = isAddNew ? null : (fields.levelId ? parseId(fields.levelId) : (levels[0]?.id || null));
  let positions = [];
  if (levelId) {
    try {
      positions = await prisma.$queryRawUnsafe(
        `SELECT id, level_desc, level_head
         FROM web_positions_dlevel
         WHERE del = 1 AND level_id = ${levelId}
         ORDER BY id ASC`,
      );
    } catch {
      positions = [];
    }
  }
  const selected = levels.find((l) => l.id === levelId);
  const maxOrder = levels.reduce((max, l) => Math.max(max, Number(l.level_order) || 0), 0);
  const currentLevelOrder = selected ? Number(selected.level_order) : (isAddNew ? maxOrder + 1 : 1);
  const lowerLevelKeys = await loadLowerLevelDesignationKeys(currentLevelOrder);
  const designationLabelMap = buildDesignationLabelMap(lookups.departments, lookups.designations);
  const designationGroups = buildDesignationGroups(lookups.departments, lookups.designations, {
    excludeKeys: lowerLevelKeys,
  });
  const reportsToGroups = buildDesignationGroups(lookups.departments, lookups.designations, {
    includeKeys: lowerLevelKeys,
  });

  await logStaffModule(PAGE, 'View', 'Successful', String(levelId || 'add_new'), memberId, audit);
  return {
    ...lookups,
    levels: levels.map((l) => ({
      id: l.id,
      title: l.level_title,
      order: l.level_order,
      label: `${String(l.level_order).padStart(2, '0')}: ${l.level_title}`,
    })),
    selectedLevelId: isAddNew ? 'add_new' : levelId,
    levelTitle: fields.levelTitle ?? selected?.level_title ?? '',
    levelOrder: fields.levelOrder ?? (selected ? Number(selected.level_order) : maxOrder + 1),
    levelOrderReadonly: !!levelId,
    designationGroups,
    reportsToGroups,
    designationLabelMap,
    positions: positions.length
      ? positions.map((p) => ({
          id: Number(p.id),
          designationKey: p.level_desc || '',
          reportsTo: p.level_head || '',
        }))
      : [{ designationKey: '', reportsTo: '' }],
  };
}

export async function saveOrgChartConfigSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const selectedLevelId = payload.selectedLevelId ?? payload.levelId;
  let levelId = selectedLevelId === 'add_new' ? null : (selectedLevelId ? parseId(selectedLevelId) : null);
  const title = String(payload.levelTitle || '').trim();
  const order = Number(payload.levelOrder) || 1;

  if (!levelId && title) {
    const created = await prisma.web_positions_level.create({
      data: { level_title: title, level_order: order, ...create },
    });
    levelId = created.id;
  } else if (levelId) {
    await prisma.web_positions_level.update({
      where: { id: levelId },
      data: { level_title: title, level_order: order, ...update },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE web_positions_dlevel SET del = 0, updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
       WHERE level_id = ${levelId} AND del = 1`,
    ).catch(() => {});
  }
  if (!levelId) return { success: false, message: 'Level is required' };

  const rows = Array.isArray(payload.positions) ? payload.positions : [];
  for (const row of rows) {
    const desc = String(row.designationKey || '').trim();
    const head = String(row.reportsTo || '').trim();
    try {
      if (!row.id && desc) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO web_positions_dlevel (level_id, level_desc, level_head, created_dt, created_ip, created_by, del)
           VALUES (${levelId}, '${escapeSql(desc)}', '${escapeSql(head)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
        );
      } else if (row.id) {
        await prisma.$executeRawUnsafe(
          `UPDATE web_positions_dlevel SET level_desc = '${escapeSql(desc)}', level_head = '${escapeSql(head)}',
           del = 1, updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}', updated_by = '${escapeSql(memberId)}'
           WHERE id = ${Number(row.id)}`,
        );
      }
    } catch {
      // table may not exist in this deployment
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', String(levelId), memberId, audit);
  return {
    success: true,
    message: 'Your details are added successfully...',
    ...(await loadOrgChartConfigSetup(memberId, { levelId }, { ...audit, skipLog: true })),
  };
}
