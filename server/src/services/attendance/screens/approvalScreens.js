import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { getAvailableLeave, getLPTime } from '../staffAttendanceCore.js';
import { auditFields, formatDateDisplay, logStaffAttSetup, toIsoDate } from '../setupAudit.js';
import { htmlTable, loadStaffCategories, parseDateRange, searchStaffByCategory } from '../staffAttendanceShared.js';

const STATUS_LABELS = { 0: 'Pending', 1: 'Approved', 2: 'Rejected', 3: 'Cancelled' };

async function loadPendingRequests(table, fromDate, toDate, status, staffIds = []) {
  let staffFilter = '';
  if (staffIds?.length) {
    staffFilter = ` AND A.staff_id IN (${staffIds.map((s) => Number(s)).join(',')})`;
  }
  const statusVal = status === 'all' ? null : Number(status ?? 0);
  const statusSql = statusVal == null ? '' : ` AND A.status=${statusVal}`;
  return prisma.$queryRawUnsafe(
    `SELECT A.*, B.staff_id AS emp_id, B.staff_name, B.staff_initial, B.staff_title
     FROM ${table} AS A
     INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
     WHERE A.del=1 AND B.del=1 AND DATE(A.from_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
       ${statusSql}${staffFilter}
     ORDER BY A.from_date DESC LIMIT 200`,
  );
}

async function loadRequestDetail(tableMore, requestId) {
  return prisma.$queryRawUnsafe(
    `SELECT * FROM ${tableMore} WHERE del=1 AND request_id=${Number(requestId)} ORDER BY req_date ASC`,
  );
}

export async function loadLeaveApproveScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const status = fields.a_status ?? '0';
  const requests = await loadPendingRequests('att_leave_request', fromDate, toDate, status, fields.a_staff);
  const categories = await loadStaffCategories();

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = requests.find((r) => Number(r.id) === rid) || (await prisma.$queryRawUnsafe(
      `SELECT A.*, B.staff_id AS emp_id, B.staff_name FROM att_leave_request A
       INNER JOIN staff_profile_tb B ON A.staff_id=B.id WHERE A.id=${rid} LIMIT 1`,
    ))[0];
    const more = await loadRequestDetail('att_leave_request_more', rid);
    detail = { header, more };
  }

  const counts = await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) AS cnt FROM att_leave_request WHERE del=1 GROUP BY status`,
  );

  await logStaffAttSetup('staff_leave_approve.php', 'View', 'Successful', fromDate, memberId, audit);
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
  const { fromDate, toDate } = parseDateRange(fields);
  const status = fields.a_status ?? '0';
  const requests = await loadPendingRequests('att_permission_request', fromDate, toDate, status, fields.a_staff);

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    detail = (await prisma.$queryRawUnsafe(
      `SELECT A.*, B.staff_id AS emp_id, B.staff_name FROM att_permission_request A
       INNER JOIN staff_profile_tb B ON A.staff_id=B.id WHERE A.id=${rid} LIMIT 1`,
    ))[0];
  }

  await logStaffAttSetup('staff_permission_approve.php', 'View', 'Successful', fromDate, memberId, audit);
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
  const { fromDate, toDate } = parseDateRange(fields);
  const status = fields.a_status ?? '0';
  const requests = await loadPendingRequests('att_defaulter', fromDate, toDate, status, fields.a_staff);

  let detail = null;
  const rid = parseOptionalId(fields.rid);
  if (rid) {
    const header = (await prisma.$queryRawUnsafe(
      `SELECT A.*, B.staff_id AS emp_id, B.staff_name, B.att_category FROM att_defaulter A
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

  await logStaffAttSetup('staff_defaulter_approve.php', 'View', 'Successful', fromDate, memberId, audit);
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

export async function loadSmrAcknowledgeScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const data = await buildLpdReportData(fromDate, toDate, ['leave', 'permission', 'defaulter'], ['0', '1', '2']);
  await logStaffAttSetup('staff_leave_acknowledge.php', 'View', 'Successful', fromDate, memberId, audit);
  return { ...data, from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate) };
}

export async function loadLpdReportScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const types = fields.a_request || ['leave', 'permission', 'defaulter'];
  const statuses = fields.a_status || ['0', '1', '2'];
  const data = await buildLpdReportData(fromDate, toDate, types, statuses);
  await logStaffAttSetup('staff_lpd_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return { ...data, from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate), a_request: types, a_status: statuses };
}

async function buildLpdReportData(fromDate, toDate, types, statuses) {
  const statusSql = statuses.length
    ? ` AND status IN (${statuses.map((s) => Number(s)).join(',')})` : '';
  const sections = [];

  if (types.includes('leave')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, A.staff_id, B.staff_id AS emp_id, B.staff_name, A.from_date, A.to_date, A.status, A.comments,
              DATE(A.created_dt) AS created_dt
       FROM att_leave_request AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt DESC LIMIT 500`,
    );
    sections.push({ type: 'Leave', rows });
  }
  if (types.includes('permission')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.request_id, A.staff_id, B.staff_id AS emp_id, B.staff_name, A.p_type, A.from_date, A.to_date, A.status,
              DATE(A.created_dt) AS created_dt
       FROM att_permission_request AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt DESC LIMIT 500`,
    );
    sections.push({ type: 'Permission', rows });
  }
  if (types.includes('defaulter')) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, B.staff_id AS emp_id, B.staff_name, A.from_date, A.to_date, A.status, A.comments,
              DATE(A.created_dt) AS created_dt
       FROM att_defaulter AS A INNER JOIN staff_profile_tb AS B ON A.staff_id=B.id
       WHERE A.del=1 AND DATE(A.created_dt) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'${statusSql}
       ORDER BY A.created_dt DESC LIMIT 500`,
    );
    sections.push({ type: 'Defaulter', rows });
  }

  const bodyRows = [];
  for (const sec of sections) {
    for (const r of sec.rows) {
      bodyRows.push([
        sec.type,
        r.request_id || r.id,
        r.emp_id,
        r.staff_name,
        formatDateDisplay(r.from_date),
        formatDateDisplay(r.to_date),
        STATUS_LABELS[Number(r.status)] || r.status,
        r.p_type || '',
        formatDateDisplay(r.created_dt),
      ]);
    }
  }

  return {
    sections,
    reportHtml: htmlTable(['Type', 'Req#', 'Staff ID', 'Name', 'From', 'To', 'Status', 'P.Type', 'Created'], bodyRows),
  };
}
