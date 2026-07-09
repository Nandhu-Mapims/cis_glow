import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';
import { buildTaskManageReportSection } from './committeeTaskManageReportSections.js';

const REPORT_PAGE = 'task_manage_report.php';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateOnly(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function deptFilterSql(column, departments = []) {
  if (!Array.isArray(departments) || !departments.length) return '';
  const parts = departments.map((id) => {
    const d = escapeSql(String(id).trim());
    if (!d) return '';
    return `(${column}='${d}' OR ${column} LIKE '${d},%' OR ${column} LIKE '%,${d}' OR ${column} LIKE '%,${d},%')`;
  }).filter(Boolean);
  if (!parts.length) return '';
  return ` AND (${parts.join(' OR ')})`;
}

function formatProgramDate(fromValue, toValue) {
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;
  if (!from || Number.isNaN(from.getTime())) return '';
  const fmt = (d, withDate = true) => d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: withDate ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!to || Number.isNaN(to.getTime())) return fmt(from);
  const sameDay = from.toDateString() === to.toDateString();
  return sameDay
    ? `${fmt(from)} - ${to.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : `${fmt(from)} - ${fmt(to)}`;
}

function formatLegacyDate(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatLegacyCardDate(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function cardRowLabel(topic, createdOn) {
  const date = formatLegacyCardDate(createdOn);
  if (date) return `${topic} Created On: ${date}`;
  return topic;
}

function formatLegacyDateTime(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function eventStatusCheck(eStatus) {
  if (Number(eStatus) === 1) return '1';
  if (Number(eStatus) === 2) return '2';
  return '3';
}

function taskStatusCheck(taskRow, eventStatus) {
  if (Number(eventStatus) === 1 && (!taskRow?.task_id || !taskRow?.task_ref_id)) {
    return 'Not Yet Started';
  }
  return taskRow?.task_status || '';
}

function formatDeptLabel(rawDept, deptMap, committeeMap) {
  const ids = String(rawDept || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!ids.length) return '';
  const allDeptIds = Object.keys(deptMap);
  if (ids.length >= allDeptIds.length) return 'All Departments';
  const labels = ids.map((id) => {
    if (deptMap[id]) return deptMap[id];
    if (id.startsWith('c_') && committeeMap[id.slice(2)]) return committeeMap[id.slice(2)];
    return '';
  }).filter(Boolean);
  return labels.join(', ');
}

function buildStatusBadges(eventStatus, taskRow) {
  const badges = [];
  const eStatus = Number(eventStatus);
  const taskStatus = taskStatusCheck(taskRow, eventStatus);

  if (eStatus === 1) {
    badges.push({ label: 'Approved', tone: 'approved' });
    if (taskStatus === 'Open') badges.push({ label: 'Open', tone: 'open' });
    else if (taskStatus === 'Not Yet Started') badges.push({ label: 'Process not yet started', tone: 'pending' });
    else if (taskStatus) badges.push({ label: taskStatus, tone: 'closed' });
  } else if (eStatus === 0) {
    badges.push({ label: 'Pending', tone: 'pending' });
  } else if (eStatus === 2) {
    badges.push({ label: 'Rejected', tone: 'rejected' });
  }

  return badges;
}

async function loadLookups() {
  const [deptRows, committeeRows, clientRows, eventTypeRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT id, name FROM staff_dept_master WHERE del=1 ORDER BY d_order ASC`),
    prisma.$queryRawUnsafe(`SELECT id, title FROM t_committee WHERE del=1 ORDER BY title ASC`),
    prisma.$queryRawUnsafe(`SELECT id, client_name FROM t_client_master WHERE del=1 ORDER BY client_name ASC`),
    prisma.$queryRawUnsafe(`SELECT id, category_name FROM master_setup WHERE category='Event Type' AND del!=0 ORDER BY category_order ASC`),
  ]);

  const deptMap = Object.fromEntries(deptRows.map((r) => [String(r.id), r.name || '']));
  const committeeMap = Object.fromEntries(committeeRows.map((r) => [String(r.id), r.title || '']));
  const clientMap = Object.fromEntries(clientRows.map((r) => [Number(r.id), r.client_name || '']));
  const eventTypes = eventTypeRows.map((r) => ({ id: String(r.id), name: r.category_name || '' }));
  const eventTypeMap = Object.fromEntries(eventTypes.map((r) => [r.id, r.name]));

  return { deptMap, committeeMap, clientMap, eventTypeMap, eventTypes, departmentsList: deptRows.map((r) => ({ id: String(r.id), name: r.name || '' })) };
}

function buildTaskJoin(taskStatus) {
  const status = taskStatus || 'Open';
  if (status === 'all') {
    return {
      join: 'LEFT JOIN t_task_allocation t ON t.ref_id=e.id AND t.del=1',
      where: '',
    };
  }
  if (status === 'Not Yet Started') {
    return {
      join: 'LEFT JOIN t_task_allocation t ON t.ref_id=e.id AND t.del=1',
      where: ' AND t.id IS NULL',
    };
  }
  return {
    join: `INNER JOIN t_task_allocation t ON t.ref_id=e.id AND t.del=1 AND t.status='${escapeSql(status)}'`,
    where: '',
  };
}

function buildEventWhere(fields) {
  let where = 'e.del=1 AND e.e_task=1';
  const eventStatus = fields.eventStatus || '1';
  if (eventStatus !== 'all') {
    if (eventStatus === '3') where += ' AND e.e_status=0';
    else where += ` AND e.e_status=${Number(eventStatus)}`;
  }

  const eventType = fields.eventType || '0';
  if (eventType && eventType !== '0') where += ` AND e.e_type='${escapeSql(eventType)}'`;

  const departments = Array.isArray(fields.departments) ? fields.departments.map(String) : [];
  where += deptFilterSql('e.e_department', departments);

  const fromDate = fields.fromDate ? String(fields.fromDate).slice(0, 10) : '';
  const toDate = fields.toDate ? String(fields.toDate).slice(0, 10) : '';
  if (fromDate && toDate) {
    where += ` AND DATE(e.from_date)>='${escapeSql(fromDate)}' AND DATE(e.from_date)<='${escapeSql(toDate)}'`;
  } else if (fromDate) {
    where += ` AND DATE(e.from_date)>='${escapeSql(fromDate)}'`;
  }

  return where;
}

async function loadSectionMeta(taskIds) {
  if (!taskIds.length) {
    return {
      subTasks: {},
      documents: {},
      participants: {},
      partners: {},
      budgets: {},
      agendas: {},
      media: {},
      photos: {},
      participantDates: {},
      partnerDates: {},
      budgetDates: {},
      agendaDates: {},
      mediaDates: {},
      photoDates: {},
      socialFlags: {},
    };
  }
  const idList = taskIds.map((id) => Number(id)).filter(Boolean).join(',');
  const dateExpr = (col) => `IF(${col}='0000-00-00 00:00:00' OR ${col}='0000-00-00', NULL, ${col})`;

  const [
    subTasks, documents, participants, partners, budgets, agendas, media, photos,
  ] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT task_id, COUNT(*) AS c FROM t_task_sub_allocation WHERE del=1 AND task_id IN (${idList}) GROUP BY task_id`),
    prisma.$queryRawUnsafe(`SELECT t_id, COUNT(*) AS c FROM t_document WHERE del=1 AND t_id IN (${idList}) GROUP BY t_id`),
    prisma.$queryRawUnsafe(`
      SELECT t_task_allocation_id, COUNT(*) AS c, MIN(${dateExpr('created_dt')}) AS created_dt
      FROM t_task_allocation_participator WHERE del=1 AND t_task_allocation_id IN (${idList}) GROUP BY t_task_allocation_id
    `),
    prisma.$queryRawUnsafe(`
      SELECT t_task_allocation_id, COUNT(*) AS c, MIN(${dateExpr('created_dt')}) AS created_dt
      FROM t_task_allocation_organization WHERE del=1 AND t_task_allocation_id IN (${idList}) GROUP BY t_task_allocation_id
    `),
    prisma.$queryRawUnsafe(`
      SELECT task_allocation_id, COUNT(*) AS c, MIN(${dateExpr('created_dt')}) AS created_dt
      FROM t_budget WHERE del=1 AND task_allocation_id IN (${idList}) GROUP BY task_allocation_id
    `),
    prisma.$queryRawUnsafe(`
      SELECT t_task_allocation_id, COUNT(*) AS c, MIN(${dateExpr('created_dt')}) AS created_dt
      FROM t_task_allocation_agenda WHERE del=1 AND t_task_allocation_id IN (${idList}) GROUP BY t_task_allocation_id
    `),
    prisma.$queryRawUnsafe(`
      SELECT t_task_allocation_id, COUNT(*) AS c, ${dateExpr('created_dt')} AS created_dt,
        web_facebook, web_twitter, web_instagram, web_youtube
      FROM t_task_allocation_media WHERE del=1 AND t_task_allocation_id IN (${idList})
    `),
    prisma.$queryRawUnsafe(`
      SELECT t_task_allocation_id, COUNT(*) AS c, MIN(${dateExpr('created_dt')}) AS created_dt
      FROM t_task_allocation_photo WHERE del=1 AND t_task_allocation_id IN (${idList}) GROUP BY t_task_allocation_id
    `),
  ]);

  const toCountMap = (rows, key) => Object.fromEntries(rows.map((r) => [String(r[key]), Number(r.c) || 0]));
  const toDateMap = (rows, key) => Object.fromEntries(rows.map((r) => [String(r[key]), r.created_dt || null]));
  const socialFlags = Object.fromEntries(media.map((r) => [
    String(r.t_task_allocation_id),
    !!(r.web_facebook || r.web_twitter || r.web_instagram || r.web_youtube),
  ]));

  return {
    subTasks: toCountMap(subTasks, 'task_id'),
    documents: toCountMap(documents, 't_id'),
    participants: toCountMap(participants, 't_task_allocation_id'),
    partners: toCountMap(partners, 't_task_allocation_id'),
    budgets: toCountMap(budgets, 'task_allocation_id'),
    agendas: toCountMap(agendas, 't_task_allocation_id'),
    media: toCountMap(media, 't_task_allocation_id'),
    photos: toCountMap(photos, 't_task_allocation_id'),
    participantDates: toDateMap(participants, 't_task_allocation_id'),
    partnerDates: toDateMap(partners, 't_task_allocation_id'),
    budgetDates: toDateMap(budgets, 'task_allocation_id'),
    agendaDates: toDateMap(agendas, 't_task_allocation_id'),
    mediaDates: toDateMap(media, 't_task_allocation_id'),
    photoDates: toDateMap(photos, 't_task_allocation_id'),
    socialFlags,
  };
}

function buildSections(row, meta) {
  const taskId = row.task_id ? String(row.task_id) : '';
  const sections = [];

  if (Number(row.e_task) === 1) {
    sections.push({
      key: 'event',
      label: 'Event Information',
      detail: cardRowLabel('Event Information', row.e_task_created),
      available: true,
    });
  }

  if (row.reschedule_date) {
    sections.push({
      key: 'reschedule',
      label: 'Reschedule',
      detail: `Rescheduled On: ${formatLegacyCardDate(row.reschedule_date)}`,
      available: true,
    });
  }

  if (taskId && meta.participants[taskId] > 0) {
    sections.push({
      key: 'participants',
      label: 'Participants',
      detail: cardRowLabel('Particpants', meta.participantDates[taskId]),
      available: true,
    });
  }
  if (taskId && meta.partners[taskId] > 0) {
    sections.push({
      key: 'partners',
      label: 'Partners',
      detail: cardRowLabel('Partners', meta.partnerDates[taskId]),
      available: true,
    });
  }
  if (taskId && meta.budgets[taskId] > 0) {
    sections.push({
      key: 'budget',
      label: 'Budget',
      detail: cardRowLabel('Budget', meta.budgetDates[taskId]),
      available: true,
    });
  }
  if (taskId && meta.subTasks[taskId] > 0) {
    sections.push({
      key: 'todo',
      label: 'To-Do List',
      detail: cardRowLabel('To-Do List', row.task_created_dt),
      available: true,
    });
  }
  if (taskId && row.circular_created) {
    sections.push({
      key: 'circular',
      label: 'Circular',
      detail: cardRowLabel('Circular', row.circular_created),
      available: true,
    });
  }
  if (taskId && meta.agendas[taskId] > 0) {
    sections.push({
      key: 'agenda',
      label: 'Agenda',
      detail: cardRowLabel('Agenda', meta.agendaDates[taskId]),
      available: true,
    });
  }
  if (taskId && row.minutes_meeting) {
    sections.push({
      key: 'minutes',
      label: 'Minutes of Meeting',
      detail: cardRowLabel('Minutes of Meeting', row.minutes_created),
      available: true,
    });
  }
  if (taskId && meta.documents[taskId] > 0) {
    sections.push({
      key: 'documents',
      label: 'Task Document',
      detail: 'Task Document',
      available: true,
    });
  }
  if (taskId && meta.socialFlags[taskId]) {
    sections.push({
      key: 'social',
      label: 'Social Content',
      detail: cardRowLabel('Social Content', meta.mediaDates[taskId]),
      available: true,
    });
  }
  if (taskId && meta.media[taskId] > 0) {
    sections.push({
      key: 'media',
      label: 'Media Content',
      detail: cardRowLabel('Media Content', meta.mediaDates[taskId]),
      available: true,
    });
  }
  if (taskId && meta.photos[taskId] > 0) {
    sections.push({
      key: 'photos',
      label: 'Photos',
      detail: cardRowLabel('Photos', meta.photoDates[taskId]),
      available: true,
    });
  }
  if (taskId && Number(row.e_task) === 1) {
    sections.push({
      key: 'consolidate',
      label: 'ConsolidatePDF',
      detail: 'ConsolidatePDF',
      available: true,
      pdfUrl: `/legacy/task_manage_pdf_report.php?id=${taskId}&type=pdf`,
    });
  }

  return sections;
}

async function loadReportList(memberId, fields, audit) {
  const eventStatus = fields.eventStatus || '1';
  const taskStatus = fields.taskStatus || 'Open';
  const eventType = fields.eventType || '0';
  const fromDate = fields.fromDate ? String(fields.fromDate).slice(0, 10) : '';
  const toDate = fields.toDate ? String(fields.toDate).slice(0, 10) : '';
  const departments = Array.isArray(fields.departments) ? fields.departments.map(String) : [];

  const lookups = await loadLookups();
  const { join, where: taskWhere } = buildTaskJoin(taskStatus);
  const eventWhere = buildEventWhere(fields);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      e.id AS event_id,
      e.title,
      e.event_date,
      e.e_category,
      e.e_type,
      e.e_department,
      e.e_status,
      e.e_task,
      IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
      IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date,
      IF(e.approved_date='0000-00-00 00:00:00', NULL, e.approved_date) AS approved_date,
      IF(e.e_task_created='0000-00-00 00:00:00', NULL, e.e_task_created) AS e_task_created,
      IF(e.reschedule_date='0000-00-00', NULL, e.reschedule_date) AS reschedule_date,
      t.id AS task_id,
      t.task_name,
      t.status AS task_status,
      t.ref_id AS task_ref_id,
      IF(t.created_dt='0000-00-00 00:00:00', NULL, t.created_dt) AS task_created_dt,
      IF(t.circular_created='0000-00-00' OR t.circular_created='0000-00-00 00:00:00', NULL, t.circular_created) AS circular_created,
      IF(t.minutes_created='0000-00-00' OR t.minutes_created='0000-00-00 00:00:00', NULL, t.minutes_created) AS minutes_created,
      t.minutes_meeting
    FROM tv_academic_event e
    ${join}
    WHERE ${eventWhere}${taskWhere}
    ORDER BY e.event_date DESC
    LIMIT 200
  `);

  const filtered = rows.filter((row) => {
    const eCheck = eventStatus === 'all' ? null : eventStatus;
    const tCheck = taskStatus === 'all' ? null : taskStatus;
    const typeCheck = eventType === '0' ? null : eventType;
    if (eCheck && eventStatusCheck(row.e_status) !== eCheck) return false;
    const derivedTaskStatus = taskStatusCheck(row, row.e_status);
    if (tCheck && derivedTaskStatus !== tCheck) return false;
    if (typeCheck && String(row.e_type) !== typeCheck) return false;
    return true;
  });

  const taskIds = filtered.map((r) => r.task_id).filter(Boolean);
  const counts = await loadSectionMeta(taskIds);

  const items = filtered.map((row) => {
    const scheduleLabel = formatProgramDate(row.from_date, row.to_date);
    let statusDetail = '';
    if (Number(row.e_status) === 1 && row.approved_date) {
      statusDetail = `Approved On: ${formatLegacyDateTime(row.approved_date)}`;
    } else if (Number(row.e_status) === 0 && row.e_task_created) {
      statusDetail = `Waiting From: ${formatLegacyDateTime(row.e_task_created)}`;
    }

    return {
      eventId: Number(row.event_id),
      taskId: row.task_id ? Number(row.task_id) : 0,
      categoryName: lookups.clientMap[Number(row.e_category)] || '',
      eventTypeName: lookups.eventTypeMap[String(row.e_type)] || '',
      title: row.title || '',
      eventDate: formatLegacyDate(row.event_date),
      deptLabel: formatDeptLabel(row.e_department, lookups.deptMap, lookups.committeeMap),
      scheduleLabel,
      rescheduleLabel: row.reschedule_date ? 'Reschedule' : 'Schedule',
      statusBadges: buildStatusBadges(row.e_status, row),
      statusDetail,
      sections: buildSections(row, counts),
    };
  });

  if (!audit.skipLog) {
    await logModulePage(REPORT_PAGE, 'View', 'Successful', 'list', memberId, audit);
  }

  return {
    success: true,
    view: 'list',
    eventStatus,
    taskStatus,
    eventType,
    fromDate,
    toDate,
    departments,
    departmentsList: lookups.departmentsList,
    eventTypes: lookups.eventTypes,
    items,
  };
}

async function loadReportSectionPreview(memberId, fields, audit) {
  const section = String(fields.section || '');
  const taskId = fields.taskId ? String(fields.taskId) : '';
  const eventId = fields.eventId ? Number(fields.eventId) : 0;
  const deptLabel = fields.deptLabel ? String(fields.deptLabel) : '';

  const preview = await buildTaskManageReportSection({
    section,
    taskId,
    eventId,
    deptLabel,
  });

  const list = await loadReportList(memberId, { ...fields, section: '', taskId: '' }, { ...audit, skipLog: true });

  if (!audit.skipLog) {
    await logModulePage(REPORT_PAGE, 'View', 'Successful', `${section}:${taskId || eventId}`, memberId, audit);
  }

  return {
    ...list,
    view: 'preview',
    previewSection: section,
    previewTitle: preview.title,
    previewHtml: preview.html,
    previewUseCircularCss: !!preview.useCircularCss,
    previewUseTaskManagePrint: !!preview.useTaskManagePrint,
    taskId,
    eventId,
  };
}

export async function loadCommitteeTaskManageReport(memberId, fields = {}, audit = {}) {
  if (fields.section) return loadReportSectionPreview(memberId, fields, audit);
  return loadReportList(memberId, fields, audit);
}

export async function saveCommitteeTaskManageReport() {
  return { success: false, message: 'Report is read-only.' };
}
