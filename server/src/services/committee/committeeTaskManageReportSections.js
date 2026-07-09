import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  buildLegacyPrintShell,
  formatEventDateStr,
  formatReviewDate,
} from './committeeTaskManageReportPrint.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
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

function formatMoney(value) {
  return (Number(value) || 0).toLocaleString('en-IN');
}

function wrapReport(title, subtitle, body) {
  return `<div class="report-print task-manage-report-print">
<div class="report-header mb-3">
<h3 class="mb-1">${escapeHtml(title)}</h3>
${subtitle ? `<p class="text-muted mb-0">${escapeHtml(subtitle)}</p>` : ''}
</div>
${body}
</div>`;
}

async function loadStaffNamesByCodes(codes = []) {
  const list = codes.map((c) => String(c).trim()).filter(Boolean);
  if (!list.length) return {};
  const where = list.map((c) => `staff_id='${escapeSql(c)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT staff_id, staff_name, staff_title, staff_initial
    FROM staff_profile_tb WHERE del=1 AND (${where})
  `);
  return Object.fromEntries(rows.map((r) => [
    String(r.staff_id),
    [r.staff_title, r.staff_name, r.staff_initial].filter(Boolean).join(' ').trim(),
  ]));
}

async function loadEventContext(eventId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      e.id, e.title, e.e_category, e.e_department, e.e_status, e.e_description,
      e.e_towner, e.e_rowner, e.e_ilocation, e.e_olocation,
      IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
      IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date,
      IF(e.e_task_created='0000-00-00 00:00:00', NULL, e.e_task_created) AS e_task_created,
      IF(e.approved_date='0000-00-00 00:00:00', NULL, e.approved_date) AS approved_date,
      IF(e.reschedule_date='0000-00-00', NULL, e.reschedule_date) AS reschedule_date,
      C.client_name,
      loc.category_name AS location_name
    FROM tv_academic_event e
    LEFT JOIN t_client_master C ON C.id=e.e_category
    LEFT JOIN master_setup loc ON loc.id=e.e_ilocation AND loc.category='Event Location' AND loc.del!=0
    WHERE e.del=1 AND e.id=${Number(eventId)}
    LIMIT 1
  `);
  return rows[0] || null;
}

async function loadTaskContext(taskId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      A.id, A.task_name, A.task_id, A.client_id, A.ref_id, A.status, A.agenda,
      A.circular_notes, A.circular_agenda, A.circular_copyto, A.minutes_meeting, A.minutes_attach,
      A.staff_id, A.priority,
      IF(A.start_date='0000-00-00 00:00:00', NULL, A.start_date) AS start_date,
      IF(A.target_date='0000-00-00 00:00:00', NULL, A.target_date) AS target_date,
      IF(A.created_dt='0000-00-00 00:00:00', NULL, A.created_dt) AS created_dt,
      IF(A.circular_created='0000-00-00' OR A.circular_created='0000-00-00 00:00:00', NULL, A.circular_created) AS circular_created,
      IF(A.minutes_created='0000-00-00' OR A.minutes_created='0000-00-00 00:00:00', NULL, A.minutes_created) AS minutes_created,
      C.client_name
    FROM t_task_allocation A
    LEFT JOIN t_client_master C ON C.id=A.client_id
    WHERE A.del=1 AND A.id=${Number(taskId)}
    LIMIT 1
  `);
  return rows[0] || null;
}

async function buildEventSection(event, deptLabel) {
  const staffRows = await prisma.$queryRawUnsafe(`
    SELECT id, staff_id, staff_title, staff_name, staff_initial FROM staff_profile_tb WHERE del=1
  `);
  const staffById = Object.fromEntries(staffRows.map((r) => [
    String(r.id),
    `${r.staff_id || ''} - ${[r.staff_title, r.staff_name, r.staff_initial].filter(Boolean).join(' ')}`.trim(),
  ]));
  const requestOwner = staffById[String(event.e_rowner)] || '';
  const processOwner = staffById[String(event.e_towner)] || '';
  const body = `<table class="table table-bordered table-sm">
<tr><th width="30%">Task Owner</th><td>${escapeHtml(requestOwner)}</td></tr>
<tr><th>Request ID</th><td>${escapeHtml(event.id)}</td></tr>
<tr><th>Request Date</th><td>${escapeHtml(formatDate(event.e_task_created))}</td></tr>
<tr><th>Category</th><td>${escapeHtml(event.client_name || '')}</td></tr>
<tr><th>Assigned Process Owner</th><td>${escapeHtml(processOwner)}</td></tr>
<tr><th>Department</th><td>${escapeHtml(deptLabel || '')}</td></tr>
<tr><th>Schedule</th><td>${escapeHtml(formatDate(event.from_date))}${event.to_date ? ` - ${escapeHtml(formatDate(event.to_date))}` : ''}</td></tr>
</table>`;
  return wrapReport('Meeting/Event Information', event.title, body);
}

async function buildTodoSection(task) {
  const subTasks = await prisma.$queryRawUnsafe(`
    SELECT sub_task_name,
      IF(start_date='0000-00-00 00:00:00', NULL, start_date) AS start_date,
      IF(target_date='0000-00-00 00:00:00', NULL, target_date) AS target_date,
      staff_id, sub_task_details, task_type, report_type, staff_participant
    FROM t_task_sub_allocation
    WHERE del=1 AND task_id='${escapeSql(String(task.id))}'
    ORDER BY id ASC
  `);
  const staffCodes = [];
  for (const row of subTasks) {
    String(row.staff_id || '').split(',').forEach((c) => staffCodes.push(c));
    String(row.staff_participant || '').split(',').forEach((c) => staffCodes.push(c));
  }
  String(task.staff_id || '').split(',').forEach((c) => staffCodes.push(c));
  const staffMap = await loadStaffNamesByCodes([...new Set(staffCodes)]);

  const teamMembers = String(task.staff_id || '').split(',').map((c) => staffMap[c.trim()] || c.trim()).filter(Boolean).join(', ');
  let body = `<p><strong>Team Members:</strong> ${escapeHtml(teamMembers || '—')}</p>`;
  body += `<table class="table table-bordered table-sm"><thead><tr>
<th>#</th><th>Sub Task</th><th>Start</th><th>Target</th><th>Staff</th><th>Type</th><th>Details</th>
</tr></thead><tbody>`;
  subTasks.forEach((row, idx) => {
    const staff = String(row.staff_id || '').split(',').map((c) => staffMap[c.trim()] || c.trim()).filter(Boolean).join(', ');
    body += `<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(row.sub_task_name)}</td>
<td>${escapeHtml(formatDate(row.start_date))}</td>
<td>${escapeHtml(formatDate(row.target_date))}</td>
<td>${escapeHtml(staff)}</td>
<td>${escapeHtml(row.task_type)} / ${escapeHtml(row.report_type)}</td>
<td>${escapeHtml(row.sub_task_details)}</td>
</tr>`;
  });
  body += '</tbody></table>';
  return wrapReport('To-Do List', task.task_name, body);
}

async function buildCircularSection(task) {
  const deptRows = await prisma.$queryRawUnsafe(`SELECT id, name FROM staff_dept_master WHERE del=1`);
  const copyIds = String(task.circular_copyto || '').split(',').map((v) => v.trim()).filter(Boolean);
  const copyTo = deptRows.filter((d) => copyIds.includes(String(d.id))).map((d) => d.name).join(', ');
  const body = `<div class="container">
<div class="pheader"><div class="title_div">
<p class="top_heading">${escapeHtml(task.task_name)}</p>
<p class="top_content">${escapeHtml(task.client_name || '')}</p>
<p class="top_content">${escapeHtml(formatDate(task.circular_created))}</p>
</div></div>
<div class="pbody">${task.circular_notes || ''}</div>
${copyTo ? `<p class="mt-3"><strong>Copy To:</strong> ${escapeHtml(copyTo)}</p>` : ''}
</div>`;
  return { html: body, useCircularCss: true, title: 'Circular' };
}

async function buildMinutesSection(task, event, deptLabel = '') {
  let content = task.minutes_meeting || '';

  const prevRows = await prisma.$queryRawUnsafe(`
    SELECT minutes_meeting,
      IF(start_date='0000-00-00 00:00:00', NULL, start_date) AS start_date
    FROM t_task_allocation
    WHERE del=1
      AND task_name='${escapeSql(task.task_name || '')}'
      AND id!=${Number(task.id)}
      AND start_date < '${escapeSql(String(task.start_date || '1970-01-01'))}'
    ORDER BY start_date DESC
    LIMIT 1
  `);
  if (prevRows[0]?.minutes_meeting) {
    const reviewDate = formatReviewDate(prevRows[0].start_date);
    content += `<br><h3>Review Meeting ${reviewDate ? `(${reviewDate})` : ''}</h3>${prevRows[0].minutes_meeting}`;
  }

  const attachList = String(task.minutes_attach || '').split(',').map((f) => f.trim()).filter(Boolean);
  if (attachList.length) {
    let attachHtml = '';
    attachList.forEach((fname, idx) => {
      const url = `/legacy/files/task_document/${fname}`;
      attachHtml += `Attachment ${idx + 1}: <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(fname.slice(9) || fname)}</a><br>`;
    });
    content += `<br><h3>Attachment</h3>${attachHtml}`;
  }

  const dateStr = event ? formatEventDateStr(event.from_date, event.to_date) : '';
  const venue = event ? `${event.location_name || ''} ${event.e_olocation || ''}`.trim() : '';
  const headerParts = [
    event?.title || task.task_name || '',
    deptLabel,
    dateStr,
    venue,
  ].filter(Boolean);
  const headerLine = headerParts.map((part) => escapeHtml(part)).join(' | ');

  const html = buildLegacyPrintShell({
    headerLine,
    title: 'Minutes of Meeting',
    bodyHtml: content || '<p>No minutes recorded.</p>',
  });

  return {
    title: 'Minutes of Meeting',
    html,
    useTaskManagePrint: true,
  };
}

async function buildParticipantsSection(taskId) {
  const [rows, setupRows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT participator_id, participator_member, participator_count, participator_amount, participator_registration,
      IF(created_dt='0000-00-00 00:00:00', NULL, created_dt) AS created_dt
      FROM t_task_allocation_participator
      WHERE del=1 AND t_task_allocation_id=${Number(taskId)}
      ORDER BY id ASC
    `),
    prisma.$queryRawUnsafe(`SELECT id, title FROM t_participator_setup WHERE del=1 ORDER BY t_order ASC`),
  ]);
  const setupMap = Object.fromEntries(setupRows.map((r) => [String(r.id), r.title || '']));
  let total = 0;
  let body = `<table class="table table-bordered table-sm"><thead><tr>
<th>#</th><th>Participants</th><th>Details</th><th class="text-end">Amount (Rs.)</th>
</tr></thead><tbody>`;
  rows.forEach((row, idx) => {
    const amount = Number(row.participator_registration) === 1
      ? (Number(row.participator_amount) || 0) * (Number(row.participator_count) || 0)
      : 0;
    total += amount;
    const perPerson = Number(row.participator_registration) === 1 ? row.participator_amount : '-';
    body += `<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(setupMap[String(row.participator_id)] || '')}</td>
<td>${escapeHtml(row.participator_member)} (${row.participator_count} x Rs.${perPerson})</td>
<td class="text-end">${formatMoney(amount)}</td>
</tr>`;
  });
  body += `<tr><td colspan="3" class="text-end"><strong>Sub Total</strong></td><td class="text-end"><strong>${formatMoney(total)}</strong></td></tr></tbody></table>`;
  return wrapReport('Participants', '', body);
}

async function buildBudgetSection(taskId) {
  const [budgetRows, expenseRows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT budget_title, budget_details, budget_amount, budget_ramount, budget_rramount
      FROM t_budget WHERE del=1 AND task_allocation_id=${Number(taskId)}
      ORDER BY id ASC
    `),
    prisma.$queryRawUnsafe(`SELECT id, title FROM t_budget_expenses WHERE del=1 ORDER BY t_order ASC`),
  ]);
  const expenseMap = Object.fromEntries(expenseRows.map((r) => [Number(r.id), r.title || '']));
  let requestTotal = 0;
  let body = `<table class="table table-bordered table-sm"><thead><tr>
<th>#</th><th>Title</th><th>Detail</th><th class="text-end">Request</th><th class="text-end">Revised</th><th class="text-end">Final</th>
</tr></thead><tbody>`;
  budgetRows.forEach((row, idx) => {
    const request = Number(row.budget_amount) || 0;
    requestTotal += request;
    body += `<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(expenseMap[Number(row.budget_title)] || row.budget_title)}</td>
<td>${escapeHtml(row.budget_details)}</td>
<td class="text-end">${formatMoney(request)}</td>
<td class="text-end">${formatMoney(row.budget_ramount)}</td>
<td class="text-end">${formatMoney(row.budget_rramount)}</td>
</tr>`;
  });
  body += `<tr><td colspan="3" class="text-end"><strong>Total</strong></td><td class="text-end"><strong>${formatMoney(requestTotal)}</strong></td><td colspan="2"></td></tr></tbody></table>`;
  return wrapReport('Budget', '', body);
}

async function buildAgendaSection(taskId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT agenda_title, agenda_whom,
      IF(agenda_date='0000-00-00 00:00:00', NULL, agenda_date) AS agenda_date,
      agenda_duration
    FROM t_task_allocation_agenda
    WHERE del=1 AND t_task_allocation_id=${Number(taskId)}
    ORDER BY id ASC
  `);
  let body = `<table class="table table-bordered table-sm"><thead><tr><th>#</th><th>Agenda</th><th>Whom</th><th>Date</th><th>Duration</th></tr></thead><tbody>`;
  rows.forEach((row, idx) => {
    body += `<tr><td>${idx + 1}</td><td>${escapeHtml(row.agenda_title)}</td><td>${escapeHtml(row.agenda_whom)}</td><td>${escapeHtml(formatDate(row.agenda_date))}</td><td>${escapeHtml(row.agenda_duration)}</td></tr>`;
  });
  body += '</tbody></table>';
  return wrapReport('Agenda', '', body);
}

async function buildDocumentsSection(taskId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT d.title, d.d_attach, dt.title AS type_name
    FROM t_document d
    LEFT JOIN t_doc_type dt ON dt.id=d.d_type
    WHERE d.del=1 AND d.t_id=${Number(taskId)}
    ORDER BY d.d_order ASC
  `);
  let body = `<table class="table table-bordered table-sm"><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Attachment</th></tr></thead><tbody>`;
  rows.forEach((row, idx) => {
    const url = row.d_attach ? `/legacy/files/task_document/${row.d_attach}` : '';
    body += `<tr><td>${idx + 1}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.type_name)}</td><td>${url ? `<a href="${escapeHtml(url)}" target="_blank">View</a>` : '—'}</td></tr>`;
  });
  body += '</tbody></table>';
  return wrapReport('Task Documents', '', body);
}

async function buildPartnersSection(taskId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.organ_name, A.organ_amount, A.organ_aamount, B.title AS org_title
    FROM t_task_allocation_organization A
    LEFT JOIN t_organization_setup B ON B.id=A.organization_id
    WHERE A.del=1 AND A.t_task_allocation_id=${Number(taskId)}
    ORDER BY A.id ASC
  `);
  let body = `<table class="table table-bordered table-sm"><thead><tr>
<th>#</th><th>Partner</th><th>Name</th><th class="text-end">Planned</th><th class="text-end">Actual</th>
</tr></thead><tbody>`;
  rows.forEach((row, idx) => {
    body += `<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(row.org_title || '')}</td>
<td>${escapeHtml(row.organ_name)}</td>
<td class="text-end">${formatMoney(row.organ_amount)}</td>
<td class="text-end">${formatMoney(row.organ_aamount)}</td>
</tr>`;
  });
  body += '</tbody></table>';
  return wrapReport('Partners / Sponsors', '', body);
}

async function buildRescheduleSection(eventId) {
  const [event, logs] = await Promise.all([
    loadEventContext(eventId),
    prisma.$queryRawUnsafe(`
      SELECT
        IF(from_date='0000-00-00 00:00:00', NULL, from_date) AS from_date,
        IF(to_date='0000-00-00 00:00:00', NULL, to_date) AS to_date,
        IF(created_dt='0000-00-00 00:00:00', NULL, created_dt) AS created_dt,
        created_by
      FROM tv_academic_event_log
      WHERE del!=0 AND tv_academic_event_id=${Number(eventId)}
      ORDER BY id DESC
    `),
  ]);
  if (!event) return wrapReport('Reschedule', '', '<p>Event not found.</p>');
  let body = `<p><strong>Current schedule:</strong> ${escapeHtml(formatDate(event.from_date))}${event.to_date ? ` - ${escapeHtml(formatDate(event.to_date))}` : ''}</p>`;
  if (logs.length) {
    body += `<table class="table table-bordered table-sm"><thead><tr><th>#</th><th>From</th><th>To</th><th>Logged On</th></tr></thead><tbody>`;
    logs.forEach((row, idx) => {
      body += `<tr><td>${idx + 1}</td><td>${escapeHtml(formatDate(row.from_date))}</td><td>${escapeHtml(formatDate(row.to_date))}</td><td>${escapeHtml(formatDate(row.created_dt))}</td></tr>`;
    });
    body += '</tbody></table>';
  } else {
    body += '<p>No reschedule history recorded.</p>';
  }
  return wrapReport('Reschedule', event.title, body);
}

async function buildMediaSection(taskId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT web_content, web_facebook, web_twitter, web_instagram, web_youtube
    FROM t_task_allocation_media
    WHERE del=1 AND t_task_allocation_id=${Number(taskId)}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return wrapReport('Media Content', '', '<p>No media content recorded.</p>');
  const body = `<div class="pbody">${row.web_content || ''}</div>
<ul class="list-unstyled mt-3">
${row.web_facebook ? `<li>Facebook: ${escapeHtml(row.web_facebook)}</li>` : ''}
${row.web_twitter ? `<li>Twitter: ${escapeHtml(row.web_twitter)}</li>` : ''}
${row.web_instagram ? `<li>Instagram: ${escapeHtml(row.web_instagram)}</li>` : ''}
${row.web_youtube ? `<li>YouTube: ${escapeHtml(row.web_youtube)}</li>` : ''}
</ul>`;
  return wrapReport('Media Content', '', body);
}

async function buildPhotosSection(taskId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT photo_title, photo_pictures
    FROM t_task_allocation_photo
    WHERE del=1 AND t_task_allocation_id=${Number(taskId)}
    ORDER BY id ASC
  `);
  if (!rows.length) return wrapReport('Photos', '', '<p>No photos recorded.</p>');
  let body = '<div class="row g-2">';
  for (const row of rows) {
    const files = String(row.photo_pictures || '').split(',').map((f) => f.trim()).filter(Boolean);
    body += `<div class="col-12"><h6>${escapeHtml(row.photo_title || 'Photo')}</h6>`;
    for (const file of files) {
      const url = `/legacy/files/task_document/${file}`;
      body += `<div class="mb-2"><img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;" /></div>`;
    }
    body += '</div>';
  }
  body += '</div>';
  return wrapReport('Photos', '', body);
}

export async function buildTaskManageReportSection({
  section,
  taskId,
  eventId,
  deptLabel = '',
}) {
  const key = String(section || '').toLowerCase();
  const task = taskId ? await loadTaskContext(taskId) : null;
  const event = eventId ? await loadEventContext(eventId) : (task?.ref_id ? await loadEventContext(task.ref_id) : null);

  switch (key) {
    case 'event':
      if (!event) return { title: 'Event Information', html: wrapReport('Event Information', '', '<p>Event not found.</p>') };
      return { title: 'Event Information', html: await buildEventSection(event, deptLabel) };
    case 'reschedule':
      return { title: 'Reschedule', html: await buildRescheduleSection(eventId || event?.id) };
    case 'todo':
      if (!task) return { title: 'To-Do List', html: wrapReport('To-Do List', '', '<p>Task not found.</p>') };
      return { title: 'To-Do List', html: await buildTodoSection(task) };
    case 'circular':
      if (!task) return { title: 'Circular', html: wrapReport('Circular', '', '<p>Task not found.</p>') };
      return await buildCircularSection(task);
    case 'minutes':
      if (!task) return { title: 'Minutes of Meeting', html: wrapReport('Minutes', '', '<p>Task not found.</p>') };
      return buildMinutesSection(task, event, deptLabel);
    case 'participants':
      return { title: 'Participants', html: await buildParticipantsSection(taskId) };
    case 'budget':
      return { title: 'Budget', html: await buildBudgetSection(taskId) };
    case 'agenda':
      return { title: 'Agenda', html: await buildAgendaSection(taskId) };
    case 'documents':
      return { title: 'Task Documents', html: await buildDocumentsSection(taskId) };
    case 'partners':
      return { title: 'Partners', html: await buildPartnersSection(taskId) };
    case 'media':
      return { title: 'Media Content', html: await buildMediaSection(taskId) };
    case 'social':
      return { title: 'Social Content', html: await buildMediaSection(taskId) };
    case 'photos':
      return { title: 'Photos', html: await buildPhotosSection(taskId) };
    default:
      return { title: 'Report', html: wrapReport('Report', '', '<p>Section not available.</p>') };
  }
}
