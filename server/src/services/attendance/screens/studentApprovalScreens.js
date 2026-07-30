import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseOptionalId } from '../../../utils/sqlSafe.js';
import { auditFields, formatDateDisplay } from '../setupAudit.js';
import {
  buildOptionalDateFilter,
  buildStudentRollFilter,
  escapeHtml,
  htmlTable,
  logStudentAtt,
  parseApprovalDateRange,
  parseDateRange,
  toIsoDate,
  wrapReportHtml,
} from '../studentAttendanceShared.js';

const STATUS_LABELS = { 0: 'Pending', 1: 'Approved', 2: 'Rejected', 3: 'Cancelled' };

const TABLE_SELECT = {
  stu_leave_request: `A.id, A.request_id, A.student_id, A.from_date, A.to_date, A.status, A.comments, A.leave_type`,
  stu_permission_request: `A.id, A.request_id, A.student_id, A.from_date, A.to_date, A.status, A.comments, A.p_type`,
  stu_att_defaulter: `A.id, A.request_id, A.student_id, A.from_date, A.to_date, A.status, A.comments, A.leave_type`,
};

function requestSelect(table) {
  return TABLE_SELECT[table] || `A.id, A.request_id, A.student_id, A.from_date, A.to_date, A.status, A.comments`;
}

function mapStudentName(row) {
  return `${row.student_name || ''} ${row.student_initial || ''}`.trim();
}

function mapRequestRow(r, extra = {}) {
  return {
    id: Number(r.id),
    requestId: r.request_id,
    registerNo: r.register_no,
    studentName: mapStudentName(r),
    fromDate: formatDateDisplay(r.from_date),
    toDate: formatDateDisplay(r.to_date),
    status: Number(r.status),
    statusLabel: STATUS_LABELS[Number(r.status)] || r.status,
    comments: r.comments || '',
    leaveType: r.leave_type || '',
    pType: r.p_type || '',
    ...extra,
  };
}

function buildCourseIdFilter(courseIds) {
  const ids = (courseIds || [])
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id) && id > 0);
  if (!ids.length) return '';
  return ` AND B.course_id IN (${ids.join(',')})`;
}

async function loadDeptCourseIdsForMember(memberId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.course_id
     FROM dept_authentication AS A
     INNER JOIN web_account_setup AS B ON A.user_id = B.id
     WHERE A.del = 1 AND B.del = 1 AND B.member_id = '${escapeSql(memberId)}'
       AND A.course_id IS NOT NULL AND A.course_id > 0`,
  );
  return [...new Set(rows.map((row) => Number(row.course_id)).filter((id) => !Number.isNaN(id) && id > 0))];
}

async function loadStudentRequests(table, fields, status, options = {}) {
  const { fromDate, toDate } = parseApprovalDateRange(fields);
  const statusSql = status === 'all' || status === undefined ? '' : ` AND A.status=${Number(status)}`;
  const dateSql = buildOptionalDateFilter('A.from_date', fromDate, toDate);
  const rollSql = buildStudentRollFilter(fields.a_staff || fields.roll_no);
  const courseSql = buildCourseIdFilter(options.courseIds);
  return prisma.$queryRawUnsafe(
    `SELECT ${requestSelect(table)},
            B.register_no, B.student_name, B.student_initial
     FROM ${table} AS A
     INNER JOIN student_profile_tb AS B ON A.student_id = B.id
     WHERE A.del=1 AND B.del=1${dateSql}${rollSql}${courseSql}${statusSql}
     ORDER BY A.from_date DESC LIMIT 200`,
  );
}

async function loadStudentRequestHeader(table, rid, courseIds = null) {
  const courseSql = buildCourseIdFilter(courseIds);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${requestSelect(table)},
            B.register_no, B.student_name, B.student_initial
     FROM ${table} AS A
     INNER JOIN student_profile_tb AS B ON A.student_id = B.id
     WHERE A.del=1 AND B.del=1 AND A.id=${rid}${courseSql}
     LIMIT 1`,
  );
  return rows[0] || null;
}

async function loadRequestStatusSummary(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(status) AS cnt
     FROM ${table}
     WHERE del=1
     GROUP BY status
     ORDER BY status ASC`,
  );
  const counts = { 0: 0, 1: 0, 2: 0 };
  let total = 0;
  for (const row of rows) {
    const status = Number(row.status);
    const cnt = Number(row.cnt);
    total += cnt;
    if (status in counts) counts[status] = cnt;
  }
  return {
    total,
    approve: counts[1],
    pending: counts[0],
    rejected: counts[2],
  };
}

function approvalListResponse(fields, status, requests, detail = null, summary = null, extra = {}) {
  const { fromDate, toDate } = parseApprovalDateRange(fields);
  return {
    from_date: fromDate ? formatDateDisplay(fromDate) : '',
    to_date: toDate ? formatDateDisplay(toDate) : '',
    a_status: status,
    requests,
    detail,
    summary,
    hasDateFilter: Boolean(fromDate || toDate),
    ...extra,
  };
}

function approvalReloadFields(payload, status) {
  const reload = { ...payload };
  delete reload.rid;
  delete reload.update;
  if (status === 1 || status === 2) {
    reload.a_status = String(status);
  }
  return reload;
}

// Per-day LE/OD breakdown (stu_leave_request_more) — a multi-day leave request gets one
// row per date, each independently markable as LE (loss of pay) or OD (on duty), matching
// stu_leave_approval.php's per-day radio list.
async function loadLeaveRequestMoreRows(rid) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, req_date, r_session, r_att, m_att
     FROM stu_leave_request_more
     WHERE del=1 AND request_id=${rid}
     ORDER BY req_date ASC, id ASC`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    date: formatDateDisplay(r.req_date),
    session: r.r_session || 'fullday',
    requestedType: r.r_att || '',
    markedType: (r.m_att || r.r_att || 'LE').toUpperCase(),
  }));
}

export async function loadSmrLeaveScreen(memberId, fields = {}, audit = {}, legacy = 'stu_leave_approval.php') {
  const status = fields.a_status ?? '0';
  const [rows, summary] = await Promise.all([
    loadStudentRequests('stu_leave_request', fields, status),
    loadRequestStatusSummary('stu_leave_request'),
  ]);
  const requests = rows.map((r) => mapRequestRow(r));

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = rows.find((r) => Number(r.id) === rid) || await loadStudentRequestHeader('stu_leave_request', rid);
    if (header) detail = { header: mapRequestRow(header), more: await loadLeaveRequestMoreRows(rid) };
  }

  await logStudentAtt(legacy, 'View', 'Successful', fields.from_date || 'all', memberId, audit);
  return approvalListResponse(fields, status, requests, detail, summary);
}

export async function saveSmrLeaveScreen(payload, memberId, audit = {}, legacy = 'stu_leave_approval.php', reloadFn = loadSmrLeaveScreen) {
  const rid = parseOptionalId(payload.rid);
  const status = Number(payload.att_status ?? payload.status);
  if (!rid || Number.isNaN(status)) return { error: 'Request and status required' };
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(
    `UPDATE stu_leave_request SET status=${status},
     comments='${escapeSql(String(payload.l_comments || payload.comments || ''))}',
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
     WHERE id=${rid}`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE stu_leave_request_more SET status=${status}, updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
     WHERE request_id=${rid}`,
  );
  for (const row of payload.more || []) {
    const mAtt = escapeSql(String(row.m_att || '').toUpperCase() === 'OD' ? 'OD' : 'LE');
    // Day weight follows r_session (fullday=1, half-day=0.5), same as legacy's $l_lmt —
    // OD gets the day counted against od_days, anything else (LE) against lop_days.
    await prisma.$executeRawUnsafe(
      `UPDATE stu_leave_request_more SET
       m_att='${mAtt}',
       od_days = IF('${mAtt}'='OD', IF(LOWER(r_session)='fullday','1','0.5'), '0'),
       lop_days = IF('${mAtt}'='OD', '0', IF(LOWER(r_session)='fullday','1','0.5')),
       status=${status},
       updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
       WHERE id=${Number(row.id)} AND request_id=${rid}`,
    );
  }
  await logStudentAtt(legacy, 'Update', 'Successful', String(rid), memberId, audit);
  const reloadFields = approvalReloadFields(payload, status);
  return {
    success: true,
    message: 'Leave request updated',
    ...(await reloadFn(memberId, reloadFields, { ...audit, skipLog: true })),
  };
}

export async function loadSmrDeptLeaveScreen(memberId, fields = {}, audit = {}) {
  const status = fields.a_status ?? '0';
  const courseIds = await loadDeptCourseIdsForMember(memberId);
  if (!courseIds.length) {
    const summary = await loadRequestStatusSummary('stu_leave_request');
    await logStudentAtt('student_leave_approval.php', 'View', 'Successful', fields.from_date || 'all', memberId, audit);
    return approvalListResponse(fields, status, [], null, summary);
  }

  const [rows, summary] = await Promise.all([
    loadStudentRequests('stu_leave_request', fields, status, { courseIds }),
    loadRequestStatusSummary('stu_leave_request'),
  ]);
  const requests = rows.map((r) => mapRequestRow(r));

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = rows.find((r) => Number(r.id) === rid)
      || await loadStudentRequestHeader('stu_leave_request', rid, courseIds);
    if (header) detail = { header: mapRequestRow(header), more: await loadLeaveRequestMoreRows(rid) };
  }

  await logStudentAtt('student_leave_approval.php', 'View', 'Successful', fields.from_date || 'all', memberId, audit);
  return approvalListResponse(fields, status, requests, detail, summary);
}

export async function saveSmrDeptLeaveScreen(payload, memberId, audit = {}) {
  return saveSmrLeaveScreen(payload, memberId, audit, 'student_leave_approval.php', loadSmrDeptLeaveScreen);
}

export async function loadSmrPermissionScreen(memberId, fields = {}, audit = {}) {
  const status = fields.a_status ?? '0';
  const { fromDate, toDate } = parseApprovalDateRange(fields);
  const statusSql = status === 'all' ? '' : ` AND A.status=${Number(status)}`;
  const dateSql = buildOptionalDateFilter('A.from_date', fromDate, toDate);
  const rollSql = buildStudentRollFilter(fields.a_staff || fields.roll_no);
  const [rows, summary] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT ${requestSelect('stu_permission_request')},
              B.register_no, B.student_name, B.student_initial
       FROM stu_permission_request AS A
       INNER JOIN student_profile_tb AS B ON A.student_id = B.id
       WHERE A.del=1 AND B.del=1${dateSql}${rollSql}${statusSql}
       ORDER BY A.from_date DESC LIMIT 200`,
    ),
    loadRequestStatusSummary('stu_permission_request'),
  ]);
  const requests = rows.map((r) => mapRequestRow(r));

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = rows.find((r) => Number(r.id) === rid) || await loadStudentRequestHeader('stu_permission_request', rid);
    if (header) detail = { header: mapRequestRow(header) };
  }

  await logStudentAtt('stu_permission_approval.php', 'View', 'Successful', fields.from_date || 'all', memberId, audit);
  return approvalListResponse(fields, status, requests, detail, summary);
}

export async function saveSmrPermissionScreen(payload, memberId, audit = {}) {
  const rid = parseOptionalId(payload.rid);
  const status = Number(payload.att_status ?? payload.status);
  if (!rid || Number.isNaN(status)) return { error: 'Request and status required' };
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(
    `UPDATE stu_permission_request SET status=${status},
     comments='${escapeSql(String(payload.l_comments || payload.comments || ''))}',
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
     WHERE id=${rid}`,
  );
  await logStudentAtt('stu_permission_approval.php', 'Update', 'Successful', String(rid), memberId, audit);
  const reloadFields = approvalReloadFields(payload, status);
  return {
    success: true,
    message: 'Permission updated',
    ...(await loadSmrPermissionScreen(memberId, reloadFields, { ...audit, skipLog: true })),
  };
}

// Per-day FN/AN breakdown (stu_att_defaulter_more) — one row per date, each with a
// forenoon and/or afternoon mark (P/La/Pe/AB/OD), matching stu_defaulter_approval.php's
// two radio groups per day. `r_session` says which half-day(s) apply: 'fullday' shows
// both, 'forenoon'/'afternoon' shows only one. a_matt/a_eatt are the originally recorded
// marks (read-only reference); m_att/e_att are what the approver can override.
async function loadDefaulterMoreRows(rid) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, CAST(req_date AS CHAR) AS req_date, r_session, a_matt, a_eatt, m_att, e_att
     FROM stu_att_defaulter_more
     WHERE del=1 AND request_id=${rid}
     ORDER BY req_date ASC, id ASC`,
  );
  return rows.map((r) => {
    const session = (r.r_session || 'fullday').toLowerCase();
    return {
      id: Number(r.id),
      date: formatDateDisplay(r.req_date),
      session,
      showForenoon: session === 'fullday' || session === 'forenoon',
      showAfternoon: session === 'fullday' || session === 'afternoon',
      requestedForenoon: (r.a_matt || '').toUpperCase(),
      requestedAfternoon: (r.a_eatt || '').toUpperCase(),
      forenoonMark: (r.m_att || r.a_matt || '').toUpperCase(),
      afternoonMark: (r.e_att || r.a_eatt || '').toUpperCase(),
    };
  });
}

export async function loadSmrDefaulterScreen(memberId, fields = {}, audit = {}) {
  const status = fields.a_status ?? '0';
  const { fromDate, toDate } = parseApprovalDateRange(fields);
  const statusSql = status === 'all' ? '' : ` AND A.status=${Number(status)}`;
  const dateSql = buildOptionalDateFilter('A.from_date', fromDate, toDate);
  const rollSql = buildStudentRollFilter(fields.a_staff || fields.roll_no);
  const [rows, summary] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT ${requestSelect('stu_att_defaulter')},
              B.register_no, B.student_name, B.student_initial
       FROM stu_att_defaulter AS A
       INNER JOIN student_profile_tb AS B ON A.student_id = B.id
       WHERE A.del=1 AND B.del=1${dateSql}${rollSql}${statusSql}
       ORDER BY A.from_date DESC LIMIT 200`,
    ),
    loadRequestStatusSummary('stu_att_defaulter'),
  ]);
  const requests = rows.map((r) => mapRequestRow(r));

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = rows.find((r) => Number(r.id) === rid) || await loadStudentRequestHeader('stu_att_defaulter', rid);
    if (header) detail = { header: mapRequestRow(header), more: await loadDefaulterMoreRows(rid) };
  }

  await logStudentAtt('stu_defaulter_approval.php', 'View', 'Successful', fields.from_date || 'all', memberId, audit);
  return approvalListResponse(fields, status, requests, detail, summary);
}

export async function saveSmrDefaulterScreen(payload, memberId, audit = {}) {
  const rid = parseOptionalId(payload.rid);
  const status = Number(payload.att_status ?? payload.status);
  if (!rid || Number.isNaN(status)) return { error: 'Request and status required' };
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(
    `UPDATE stu_att_defaulter SET status=${status},
     comments='${escapeSql(String(payload.l_comments || payload.comments || ''))}',
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
     WHERE id=${rid}`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE stu_att_defaulter_more SET status=${status},
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
     WHERE request_id=${rid}`,
  );
  for (const row of payload.more || []) {
    const mAtt = escapeSql(String(row.m_att || ''));
    const eAtt = escapeSql(String(row.e_att || ''));
    // Only AB (absent) and OD (on duty) count against pay/duty days — half a day per
    // session — matching stu_defaulter_approval.php's exact formula. P/La/Pe are purely
    // informational marks with no day-count effect.
    await prisma.$executeRawUnsafe(
      `UPDATE stu_att_defaulter_more SET
       m_att='${mAtt}',
       e_att='${eAtt}',
       od_days = (IF(LOWER('${mAtt}')='od',0.5,0) + IF(LOWER('${eAtt}')='od',0.5,0)),
       lop_days = (IF(LOWER('${mAtt}')='ab',0.5,0) + IF(LOWER('${eAtt}')='ab',0.5,0)),
       updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
       WHERE id=${Number(row.id)} AND request_id=${rid}`,
    );
  }
  await logStudentAtt('stu_defaulter_approval.php', 'Update', 'Successful', String(rid), memberId, audit);
  const reloadFields = approvalReloadFields(payload, status);
  return {
    success: true,
    message: 'Defaulter updated',
    ...(await loadSmrDefaulterScreen(memberId, reloadFields, { ...audit, skipLog: true })),
  };
}

function normalizeLpdRequestTypes(raw) {
  const arr = Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
  return arr.length ? arr : ['leave', 'permission', 'defaulter'];
}

function normalizeLpdStatuses(raw) {
  const arr = Array.isArray(raw)
    ? raw.map(String).filter(Boolean)
    : (raw != null && raw !== '' ? [String(raw)] : []);
  if (!arr.length) return ['0', '1', '2'];
  return arr.map((s) => (s === 'p' ? '0' : s));
}

function buildLpdStatusSql(statuses) {
  const normalized = normalizeLpdStatuses(statuses);
  if (!normalized.length) return '';
  return ` AND A.status IN (${normalized.map((s) => Number(s)).join(',')})`;
}

export async function loadSmrLpdReportScreen(memberId, fields = {}, audit = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = toIsoDate(fields.from_date || fields.fromDate) || today;
  const toDate = toIsoDate(fields.to_date || fields.toDate) || today;
  const types = normalizeLpdRequestTypes(fields.a_request);
  const statuses = normalizeLpdStatuses(fields.a_status);
  const generate = Boolean(fields.Submit === 'Generate' || fields.Submit === 'Search' || fields.generate);
  const statusSql = buildLpdStatusSql(statuses);
  const response = {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    a_request: types,
    a_status: statuses.map((s) => (s === '0' ? 'p' : s)),
  };

  if (!generate) {
    await logStudentAtt('student_lpd_report.php', 'View', 'Successful', fromDate, memberId, audit);
    return response;
  }

  const bodyRows = [];

  if (types.includes('leave')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, B.register_no, B.student_name, A.from_date, A.to_date, A.status, DATE(A.created_dt) AS created_dt
       FROM stu_leave_request AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt DESC LIMIT 300`,
    );
    for (const r of rows) {
      bodyRows.push(['Leave', escapeHtml(r.request_id), escapeHtml(r.register_no), escapeHtml(r.student_name),
        escapeHtml(formatDateDisplay(r.from_date)), escapeHtml(formatDateDisplay(r.to_date)),
        escapeHtml(STATUS_LABELS[Number(r.status)] || r.status)]);
    }
  }
  if (types.includes('permission')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, B.register_no, B.student_name, A.p_type, A.from_date, A.to_date, A.status
       FROM stu_permission_request AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt DESC LIMIT 300`,
    );
    for (const r of rows) {
      bodyRows.push(['Permission', escapeHtml(r.request_id), escapeHtml(r.register_no), escapeHtml(r.student_name),
        escapeHtml(formatDateDisplay(r.from_date)), escapeHtml(formatDateDisplay(r.to_date)),
        escapeHtml(STATUS_LABELS[Number(r.status)] || r.status)]);
    }
  }
  if (types.includes('defaulter')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.id, B.register_no, B.student_name, A.from_date, A.to_date, A.status
       FROM stu_att_defaulter AS A INNER JOIN student_profile_tb AS B ON A.student_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt DESC LIMIT 300`,
    );
    for (const r of rows) {
      bodyRows.push(['Defaulter', escapeHtml(r.id), escapeHtml(r.register_no), escapeHtml(r.student_name),
        escapeHtml(formatDateDisplay(r.from_date)), escapeHtml(formatDateDisplay(r.to_date)),
        escapeHtml(STATUS_LABELS[Number(r.status)] || r.status)]);
    }
  }

  await logStudentAtt('student_lpd_report.php', 'Generate', 'Successful', fromDate, memberId, audit);
  return {
    ...response,
    reportHtml: wrapReportHtml('Student L/P/D Report', htmlTable(['Type', 'Req ID', 'Register No', 'Name', 'From', 'To', 'Status'], bodyRows)),
  };
}
