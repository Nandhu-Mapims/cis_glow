import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { getAvailableLeave, getLPTime } from '../staffAttendanceCore.js';
import { auditFields, formatDateDisplay, logStaffAttSetup, toIsoDate } from '../setupAudit.js';
import { htmlTable, loadStaffCategories, parseDateRange, searchStaffByCategory } from '../staffAttendanceShared.js';

const STATUS_LABELS = { 0: 'Pending', 1: 'Approved', 2: 'Rejected', 3: 'Cancelled' };

/** `created_dt`/`updated_dt` default to the zero date ('0000-00-00 00:00:00')
 * on these tables, which Prisma's raw-query row decoder can't parse as a
 * DateTime — it throws before the row even reaches JS, so aliasing a safe
 * CAST(...) alongside `A.*` doesn't help; the raw column still has to be
 * excluded from the selected list entirely. */
const REQUEST_COLUMNS = {
  att_leave_request: [
    'id', 'request_id', 'staff_id', 'staff_img', 'leave_for', 'from_date', 'to_date',
    'l_session', 'leave_type', 'status', 'reason_for', 'comments', 'req_comments',
    'req_reference', 'created_ip', 'created_by', 'updated_ip', 'updated_by', 'del',
  ],
  att_defaulter: [
    'id', 'request_id', 'staff_id', 'staff_img', 'leave_auth', 'leave_type', 'leave_stype',
    'leave_for', 'from_date', 'to_date', 'f_session', 't_session', 'status', 'req_comments',
    'comments', 'req_reference', 'created_ip', 'created_by', 'updated_ip', 'updated_by', 'del',
  ],
  att_permission_request: [
    'id', 'request_id', 'staff_id', 'staff_img', 'from_date', 'to_date', 'p_type', 'status',
    'comments', 'req_reference', 'created_ip', 'created_by', 'updated_ip', 'updated_by', 'del',
  ],
};

function safeRequestColumns(table, alias = 'A') {
  const cols = REQUEST_COLUMNS[table];
  if (!cols) throw new Error(`Unknown attendance request table: ${table}`);
  const list = cols.map((c) => `${alias}.${c}`).join(', ');
  return `${list},
       IF(CAST(${alias}.created_dt AS CHAR) LIKE '0000-00-00%', '', CAST(${alias}.created_dt AS CHAR)) AS created_dt,
       IF(CAST(${alias}.updated_dt AS CHAR) LIKE '0000-00-00%', '', CAST(${alias}.updated_dt AS CHAR)) AS updated_dt`;
}

/** Unlike most screens, the legacy approval pages (staff_leave_approve.php et
 * al.) don't default an empty date filter to "today" — they only add a
 * `from_date >= / <=` clause when the operator actually typed one, so an
 * empty filter shows every request regardless of date. `parseDateRange`
 * (used elsewhere) always fills in today's date, which silently hid every
 * non-today request on these screens. */
function parseOptionalDateRange(fields) {
  const fromDate = toIsoDate(fields.from_date || fields.fromDate) || '';
  const toDate = toIsoDate(fields.to_date || fields.toDate) || '';
  return { fromDate, toDate };
}

async function loadPendingRequests(table, fromDate, toDate, status, staffIds = []) {
  let staffFilter = '';
  if (staffIds?.length) {
    staffFilter = ` AND A.staff_id IN (${staffIds.map((s) => Number(s)).join(',')})`;
  }
  const statusVal = status === 'all' ? null : Number(status ?? 0);
  const statusSql = statusVal == null ? '' : ` AND A.status=${statusVal}`;
  let dateSql = '';
  if (fromDate) dateSql += ` AND DATE(A.from_date) >= '${escapeSql(fromDate)}'`;
  if (toDate) dateSql += ` AND DATE(A.from_date) <= '${escapeSql(toDate)}'`;
  return prisma.$queryRawUnsafe(
    `SELECT ${safeRequestColumns(table)}, B.staff_id AS emp_id, B.staff_name, B.staff_initial, B.staff_title, B.att_category
     FROM ${table} AS A
     INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
     WHERE A.del=1 AND B.del=1${dateSql}
       ${statusSql}${staffFilter}
     ORDER BY A.from_date DESC LIMIT 200`,
  );
}

async function loadStatusCounts(table) {
  const counts = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) AS cnt FROM ${table} WHERE del=1 GROUP BY status`,
  );
  const byStatus = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let total = 0;
  for (const row of counts) {
    const n = Number(row.cnt);
    byStatus[Number(row.status)] = n;
    total += n;
  }
  return { total, pending: byStatus[0], approved: byStatus[1], rejected: byStatus[2], cancelled: byStatus[3] };
}

const REQUEST_MORE_COLUMNS = {
  att_leave_request_more: [
    'id', 'request_id', 'staff_id', 'req_date', 'r_session', 'r_att', 'm_att',
    'cl_days', 'el_days', 'od_days', 'lop_days', 'off_days', 'status',
    'created_ip', 'created_by', 'updated_ip', 'updated_by', 'del',
  ],
  att_defaulter_more: [
    'id', 'request_id', 'staff_id', 'req_date', 'r_session', 'a_info', 'a_matt', 'a_eatt',
    'm_att', 'e_att', 'cl_days', 'el_days', 'od_days', 'lop_days', 'off_days', 'h_days',
    'comments', 'status', 'created_ip', 'created_by', 'updated_ip', 'updated_by', 'del',
  ],
};

async function loadRequestDetail(tableMore, requestId) {
  const cols = REQUEST_MORE_COLUMNS[tableMore];
  const select = cols
    ? `${cols.join(', ')},
       IF(CAST(created_dt AS CHAR) LIKE '0000-00-00%', '', CAST(created_dt AS CHAR)) AS created_dt,
       IF(CAST(updated_dt AS CHAR) LIKE '0000-00-00%', '', CAST(updated_dt AS CHAR)) AS updated_dt`
    : '*';
  return prisma.$queryRawUnsafe(
    `SELECT ${select} FROM ${tableMore} WHERE del=1 AND request_id=${Number(requestId)} ORDER BY req_date ASC`,
  );
}

export async function loadLeaveApproveScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseOptionalDateRange(fields);
  const status = fields.a_status ?? '0';
  const requests = await loadPendingRequests('att_leave_request', fromDate, toDate, status, fields.a_staff);
  const categories = await loadStaffCategories();

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = requests.find((r) => Number(r.id) === rid) || (await prisma.$queryRawUnsafe(
      `SELECT ${safeRequestColumns('att_leave_request')}, B.staff_id AS emp_id, B.staff_name, B.att_category
       FROM att_leave_request A
       INNER JOIN staff_profile_tb B ON A.staff_id=B.id WHERE A.id=${rid} LIMIT 1`,
    ))[0];
    const more = await loadRequestDetail('att_leave_request_more', rid);
    let balances = null;
    if (header) {
      const lp = await getLPTime(header.att_category);
      balances = await getAvailableLeave(header.staff_id, header.from_date, lp, '', [rid]);
    }
    detail = { header, more, balances };
  }

  const counts = await loadStatusCounts('att_leave_request');

  await logStaffAttSetup('staff_leave_approve.php', 'View', 'Successful', fromDate || 'all', memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    a_status: status,
    categories,
    requests: requests.map((r) => ({
      id: Number(r.id),
      requestId: r.request_id,
      staffId: r.emp_id,
      staffName: `${r.staff_title || ''} ${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
      fromDate: formatDateDisplay(r.from_date),
      toDate: formatDateDisplay(r.to_date),
      status: Number(r.status),
      statusLabel: STATUS_LABELS[Number(r.status)] || r.status,
      comments: r.comments || '',
    })),
    statusCounts: counts,
    detail,
  };
}

export async function saveLeaveApproveScreen(payload, memberId, audit = {}) {
  const rid = parseId(payload.rid);
  const status = Number(payload.att_status ?? payload.status);
  if (!rid || Number.isNaN(status)) return { success: false, message: 'Request and status required' };

  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE att_leave_request SET status=${status},
      comments='${escapeSql(String(payload.l_comments || payload.comments || ''))}',
      updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
    WHERE id=${rid}
  `);

  const moreRows = payload.more || [];
  for (const row of moreRows) {
    const attM = String(row.m_att || row.att_m || '').toLowerCase();
    const refDay = Number(row.ref_day || row.days || 0);
    let cl = 0; let el = 0; let od = 0; let lop = 0; let off = 0;
    if (attM === 'cl') cl = refDay;
    else if (attM === 'el') el = refDay;
    else if (attM === 'od') od = refDay;
    else if (attM === 'off') off = refDay;
    else lop = refDay;
    await prisma.$executeRawUnsafe(`
      UPDATE att_leave_request_more SET m_att='${escapeSql(String(row.m_att || ''))}',
        cl_days=${cl}, el_days=${el}, od_days=${od}, lop_days=${lop}, off_days=${off}, status=${status},
        updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
      WHERE id=${Number(row.id)} AND request_id=${rid}
    `);
  }

  await logStaffAttSetup('staff_leave_approve.php', 'Update', 'Successful', String(rid), memberId, audit);
  return { success: true, message: 'Leave request updated.', ...(await loadLeaveApproveScreen(memberId, payload, { ...audit, skipLog: true })) };
}

export async function loadPermissionApproveScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseOptionalDateRange(fields);
  const status = fields.a_status ?? '0';
  const requests = await loadPendingRequests('att_permission_request', fromDate, toDate, status, fields.a_staff);

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    detail = (await prisma.$queryRawUnsafe(
      `SELECT ${safeRequestColumns('att_permission_request')}, B.staff_id AS emp_id, B.staff_name
       FROM att_permission_request A
       INNER JOIN staff_profile_tb B ON A.staff_id=B.id WHERE A.id=${rid} LIMIT 1`,
    ))[0];
  }

  const counts = await loadStatusCounts('att_permission_request');

  await logStaffAttSetup('staff_permission_approve.php', 'View', 'Successful', fromDate || 'all', memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    a_status: status,
    requests: requests.map((r) => ({
      id: Number(r.id),
      requestId: r.request_id,
      staffId: r.emp_id,
      staffName: `${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
      pType: r.p_type,
      fromDate: formatDateDisplay(r.from_date),
      toDate: formatDateDisplay(r.to_date),
      status: Number(r.status),
      statusLabel: STATUS_LABELS[Number(r.status)] || r.status,
      comments: r.comments || '',
    })),
    statusCounts: counts,
    detail,
  };
}

export async function savePermissionApproveScreen(payload, memberId, audit = {}) {
  const rid = parseId(payload.rid);
  const status = Number(payload.att_status ?? payload.status);
  if (!rid || Number.isNaN(status)) return { success: false, message: 'Request and status required' };
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE att_permission_request SET status=${status},
      comments='${escapeSql(String(payload.l_comments || payload.comments || ''))}',
      updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
    WHERE id=${rid}
  `);
  await logStaffAttSetup('staff_permission_approve.php', 'Update', 'Successful', String(rid), memberId, audit);
  return { success: true, message: 'Permission request updated.', ...(await loadPermissionApproveScreen(memberId, payload, { ...audit, skipLog: true })) };
}

export async function loadDefaulterApproveScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseOptionalDateRange(fields);
  const status = fields.a_status ?? '0';
  const requests = await loadPendingRequests('att_defaulter', fromDate, toDate, status, fields.a_staff);

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = (await prisma.$queryRawUnsafe(
      `SELECT ${safeRequestColumns('att_defaulter')}, B.staff_id AS emp_id, B.staff_name, B.att_category
       FROM att_defaulter A
       INNER JOIN staff_profile_tb B ON A.staff_id=B.id WHERE A.id=${rid} LIMIT 1`,
    ))[0];
    const more = await loadRequestDetail('att_defaulter_more', rid);
    let balances = null;
    if (header) {
      const lp = await getLPTime(header.att_category);
      balances = await getAvailableLeave(header.staff_id, header.from_date, lp, '', [rid]);
    }
    detail = { header, more, balances };
  }

  const counts = await loadStatusCounts('att_defaulter');

  await logStaffAttSetup('staff_defaulter_approve.php', 'View', 'Successful', fromDate || 'all', memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    a_status: status,
    requests: requests.map((r) => ({
      id: Number(r.id),
      staffId: r.emp_id,
      staffName: `${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
      fromDate: formatDateDisplay(r.from_date),
      toDate: formatDateDisplay(r.to_date),
      status: Number(r.status),
      statusLabel: STATUS_LABELS[Number(r.status)] || r.status,
      comments: r.comments || '',
    })),
    statusCounts: counts,
    detail,
  };
}

export async function saveDefaulterApproveScreen(payload, memberId, audit = {}) {
  const rid = parseId(payload.rid);
  const status = Number(payload.att_status ?? payload.status);
  if (!rid || Number.isNaN(status)) return { success: false, message: 'Request and status required' };
  const { update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(`
    UPDATE att_defaulter SET status=${status},
      comments='${escapeSql(String(payload.l_comments || payload.comments || ''))}',
      updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
    WHERE id=${rid}
  `);
  await prisma.$executeRawUnsafe(
    `UPDATE att_defaulter_more SET status=${status}, updated_dt=NOW(), updated_by='${escapeSql(memberId)}' WHERE request_id=${rid}`,
  );

  for (const row of payload.more || []) {
    await prisma.$executeRawUnsafe(`
      UPDATE att_defaulter_more SET m_att='${escapeSql(String(row.m_att || ''))}',
        e_att='${escapeSql(String(row.e_att || ''))}',
        cl_days=${Number(row.cl_days || 0)}, el_days=${Number(row.el_days || 0)},
        od_days=${Number(row.od_days || 0)}, lop_days=${Number(row.lop_days || 0)},
        off_days=${Number(row.off_days || 0)}, h_days=${Number(row.h_days || 0)},
        updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
      WHERE id=${Number(row.id)} AND request_id=${rid}
    `);
  }

  await logStaffAttSetup('staff_defaulter_approve.php', 'Update', 'Successful', String(rid), memberId, audit);
  return { success: true, message: 'Defaulter request updated.', ...(await loadDefaulterApproveScreen(memberId, payload, { ...audit, skipLog: true })) };
}

/** The legacy Request/Status filters are checkbox groups (`a_request[]`,
 * `a_status[]`) — POST sends a single string when exactly one box is
 * checked and an array when multiple are, same as this API's `fields`. This
 * normalizes either shape back to an array, falling back to "all checked"
 * (the legacy page's default) only when nothing was sent at all. */
function normalizeCheckboxList(value, fallback) {
  if (Array.isArray(value)) return value.length ? value : fallback;
  if (value) return [value];
  return fallback;
}

function formatDateTimeDisplay(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.startsWith('0000-00-00')) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()} ${hh}:${min}`;
}

function dateRangeLabel(from, to) {
  const f = formatDateDisplay(from);
  const t = formatDateDisplay(to);
  if (!f) return '';
  if (!t || t === f) return f;
  return `${f} - ${t}`;
}

export async function loadSmrAcknowledgeScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const data = await buildLpdReportData(fromDate, toDate, ['leave', 'permission', 'defaulter'], ['p', '1', '2']);
  await logStaffAttSetup('staff_leave_acknowledge.php', 'View', 'Successful', fromDate, memberId, audit);
  return { ...data, from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate) };
}

export async function loadLpdReportScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const types = normalizeCheckboxList(fields.a_request, ['leave', 'permission', 'defaulter']);
  const statuses = normalizeCheckboxList(fields.a_status, ['p', '1', '2']);
  const data = await buildLpdReportData(fromDate, toDate, types, statuses);
  await logStaffAttSetup('staff_lpd_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return { ...data, from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate), a_request: types, a_status: statuses };
}

/** Legacy status checkbox values are 'p' (Pending → status 0), '1'
 * (Approved), '2' (Rejected) — not the raw numeric status codes. */
async function buildLpdReportData(fromDate, toDate, types, statuses) {
  const statusNums = statuses.map((s) => (s === 'p' ? 0 : Number(s))).filter((n) => !Number.isNaN(n));
  const statusSql = statusNums.length ? ` AND status IN (${statusNums.join(',')})` : '';
  const rows = [];

  if (types.includes('leave')) {
    const leaveRows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, A.from_date, A.to_date, A.leave_type, A.status, A.comments, A.created_dt,
              B.staff_id AS emp_id, B.staff_name, B.staff_initial, B.staff_title
       FROM att_leave_request AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt ASC LIMIT 500`,
    );
    for (const r of leaveRows) {
      rows.push({
        type: 'Leave',
        requestLabel: `LR${r.request_id}`,
        createdAt: formatDateTimeDisplay(r.created_dt),
        staffId: r.emp_id,
        staffName: `${r.staff_title || ''} ${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
        dateRange: dateRangeLabel(r.from_date, r.to_date),
        subLabel: r.leave_type || '',
        status: Number(r.status),
        comments: r.comments || '',
      });
    }
  }

  if (types.includes('permission')) {
    const permRows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, A.from_date, A.to_date, A.p_type, A.status, A.comments, A.created_dt,
              B.staff_id AS emp_id, B.staff_name, B.staff_initial, B.staff_title
       FROM att_permission_request AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt ASC LIMIT 500`,
    );
    for (const r of permRows) {
      rows.push({
        type: 'Permission',
        requestLabel: `PR${r.request_id}`,
        createdAt: formatDateTimeDisplay(r.created_dt),
        staffId: r.emp_id,
        staffName: `${r.staff_title || ''} ${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
        dateRange: formatDateDisplay(r.from_date),
        subLabel: r.p_type ? String(r.p_type).replace(/^./, (c) => c.toUpperCase()) : '',
        status: Number(r.status),
        comments: r.comments || '',
      });
    }
  }

  if (types.includes('defaulter')) {
    const defRows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, A.from_date, A.to_date, A.leave_stype, A.leave_auth, A.status, A.comments, A.created_dt,
              B.staff_id AS emp_id, B.staff_name, B.staff_initial, B.staff_title
       FROM att_defaulter AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt ASC LIMIT 500`,
    );
    for (const r of defRows) {
      rows.push({
        type: 'Defaulter',
        requestLabel: `DR${r.request_id}`,
        createdAt: formatDateTimeDisplay(r.created_dt),
        staffId: r.emp_id,
        staffName: `${r.staff_title || ''} ${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
        dateRange: dateRangeLabel(r.from_date, r.to_date),
        subLabel: [r.leave_stype, r.leave_auth].filter(Boolean).join(' | '),
        status: Number(r.status),
        comments: r.comments || '',
      });
    }
  }

  rows.forEach((r, idx) => {
    r.serial = idx + 1;
    r.statusLabel = STATUS_LABELS[r.status] || String(r.status);
  });

  return {
    rows,
    reportHtml: htmlTable(
      ['#', 'R.ID', 'Staff', 'Date & Request', 'Status', 'Remarks'],
      rows.map((r) => [
        r.serial,
        `${r.type}: <strong>${r.requestLabel}</strong><br><small>@${r.createdAt}</small>`,
        `<strong>${r.staffName}</strong><br>${r.staffId}`,
        `<strong>${r.dateRange}${r.subLabel ? ` | ${r.subLabel}` : ''}</strong>`,
        r.statusLabel,
        r.comments,
      ]),
    ),
  };
}
