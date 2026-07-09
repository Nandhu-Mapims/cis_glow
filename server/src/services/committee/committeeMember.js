import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadCommitteeOptions, loadDesignationOptions, loadStaffOptions } from './committeeShared.js';

const PAGE = 'event_committee_member.php';

function formatMemberDate(val) {
  if (!val) return '';
  const raw = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
  return raw === '0000-00-00' ? '' : raw;
}

export async function loadCommitteeMember(memberId, fields = {}, audit = {}) {
  const committeeId = fields.committeeId ? String(fields.committeeId) : '';
  let rows = [];
  if (committeeId) {
    const list = await prisma.$queryRawUnsafe(`
      SELECT id, staff_id, designation, m_owner, from_date, to_date, s_order
      FROM t_committee_member WHERE del=1 AND committee_id=${Number(committeeId)} ORDER BY s_order ASC
    `);
    rows = list.map((r) => ({
      id: Number(r.id),
      staffId: r.staff_id ? String(r.staff_id) : '',
      designation: r.designation ? String(r.designation) : '',
      owner: Number(r.m_owner) === 1,
      fromDate: formatMemberDate(r.from_date),
      toDate: formatMemberDate(r.to_date),
      order: r.s_order ?? 0,
    }));
    if (rows.length === 0) {
      rows = [{ staffId: '', designation: '', fromDate: '', toDate: '', order: 1, owner: false }];
    }
  }

  const staffOptions = await loadStaffOptions();
  if (committeeId && rows.length) {
    const known = new Set(staffOptions.map((s) => String(s.id)));
    const missing = [...new Set(rows.map((r) => r.staffId).filter((id) => id && !known.has(String(id))))];
    if (missing.length) {
      const extra = await prisma.$queryRawUnsafe(`
        SELECT id, staff_id, staff_title, staff_name, staff_initial
        FROM staff_profile_tb WHERE del=1 AND id IN (${missing.map((id) => Number(id)).join(',')})
      `);
      for (const r of extra) {
        staffOptions.push({
          id: Number(r.id),
          staffId: r.staff_id || '',
          label: `${r.staff_id} | ${String(r.staff_title || '').trim()} ${r.staff_name || ''} ${r.staff_initial || ''}`.trim(),
        });
      }
    }
  }

  await logModulePage(PAGE, 'View', 'Successful', committeeId, memberId, audit);
  return {
    success: true,
    committees: await loadCommitteeOptions(),
    designations: await loadDesignationOptions(),
    staffOptions,
    committeeId,
    rows,
  };
}

export async function saveCommitteeMember(payload, memberId, audit = {}) {
  const committeeId = String(payload.committeeId || '').trim();
  if (!committeeId) return { success: false, message: 'Select a committee.' };
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.rowId);
    await prisma.$executeRawUnsafe(`UPDATE t_committee_member SET del=0, updated_dt=NOW() WHERE id=${id}`);
    await logModulePage(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Member removed.', ...(await loadCommitteeMember(memberId, { committeeId }, { ...audit, skipLog: true })) };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const staffId = escapeSql(row.staffId || '');
    const designation = Number(row.designation) || 0;
    if (!staffId || !designation) continue;
    const fromDate = row.fromDate ? `'${escapeSql(row.fromDate)}'` : 'NULL';
    const toDate = row.toDate ? `'${escapeSql(row.toDate)}'` : `'0000-00-00'`;
    const order = Number(row.order) || 0;
    const owner = row.owner ? 1 : 0;
    if (row.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE t_committee_member SET staff_id='${staffId}', committee_id=${Number(committeeId)},
          designation=${designation}, m_owner=${owner}, from_date=${fromDate}, to_date=${toDate}, s_order=${order},
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${Number(row.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO t_committee_member (staff_id, committee_id, designation, m_owner, from_date, to_date, s_order,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
        VALUES ('${staffId}', ${Number(committeeId)}, ${designation}, ${owner}, ${fromDate}, ${toDate}, ${order},
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          '0000-00-00 00:00:00', '', '', 1)
      `);
    }
  }
  await logModulePage(PAGE, 'Update', 'Successful', committeeId, memberId, audit);
  return { success: true, message: 'Members saved.', ...(await loadCommitteeMember(memberId, { committeeId }, { ...audit, skipLog: true })) };
}
