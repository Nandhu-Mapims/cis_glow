import { prisma } from '../../../config/prisma.js';
import { legacyPublicFileUrl } from '../../../utils/fileUrls.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import { listStaffPicker, searchStaff, staffPhotoDisplayUrl } from '../staffShared.js';
import { uploadStaffAttachmentFile } from '../staffAttachments.js';

const PAGE = 'staff_designation_edit.php';

function toDateInput(val) {
  if (!val || String(val).startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export async function loadDesignationEditSetup(memberId, fields = {}, audit = {}) {
  const staffId = fields.staffId ? parseId(fields.staffId) : null;
  const staffIdStr = staffId ? String(staffId) : '';
  const [departments, designations] = await Promise.all([
    prisma.$queryRawUnsafe('SELECT id, name FROM staff_dept_master WHERE del = 1 ORDER BY d_order ASC'),
    prisma.$queryRawUnsafe('SELECT id, name, d_id FROM staff_desg_master WHERE del = 1 ORDER BY d_order ASC'),
  ]);

  let staff = null;
  let designRows = [];
  if (staffId) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, staff_id, staff_name, staff_initial, staff_title,
              CAST(releaving_date AS CHAR) AS releaving_date,
              releaving_info, releaving_attachment
       FROM staff_profile_tb WHERE del = 1 AND id = ${staffId} LIMIT 1`,
    );
    if (rows.length) {
      staff = rows[0];
      const desRows = await prisma.$queryRawUnsafe(
        `SELECT id, department, designation, unit_type,
                CAST(from_date AS CHAR) AS from_date,
                CAST(to_date AS CHAR) AS to_date,
                is_academic
         FROM staff_designation_tb
         WHERE del = 1 AND staff_id = '${staffIdStr}'
         ORDER BY id ASC`,
      );
      designRows = desRows.map((r) => ({
        id: Number(r.id),
        departmentId: r.department,
        designationId: r.designation,
        unitType: r.unit_type,
        fromDate: toDateInput(r.from_date),
        toDate: toDateInput(r.to_date),
        isAcademic: Number(r.is_academic) === 1,
      }));
    }
  }

  await logStaffModule(PAGE, 'View', 'Successful', String(staffId || ''), memberId, audit);
  return {
    departments: departments.map((d) => ({ id: Number(d.id), name: d.name })),
    designations: designations.map((d) => ({ id: Number(d.id), name: d.name, departmentId: Number(d.d_id) })),
    staff: staff ? {
      id: Number(staff.id),
      staffId: staff.staff_id,
      name: `${staff.staff_title ? `${staff.staff_title}. ` : ''}${staff.staff_name} ${staff.staff_initial}`.trim(),
      releavingDate: toDateInput(staff.releaving_date),
      releavingInfo: staff.releaving_info || '',
      releavingAttachment: staff.releaving_attachment || '',
      releavingAttachmentUrl: staff.releaving_attachment
        ? legacyPublicFileUrl(`staff_documents/${staff.releaving_attachment}`)
        : null,
      photoUrl: await staffPhotoDisplayUrl(staff.staff_id, 'idcard'),
    } : null,
    designations_rows: designRows.length
      ? designRows
      : [{ departmentId: '', designationId: '', unitType: '', fromDate: '', toDate: '', isAcademic: true }],
    searchResults: fields.q
      ? await searchStaff({ by: fields.by || 'name', q: fields.q, staffId })
      : await listStaffPicker(50),
  };
}

export async function saveDesignationEditSetup(payload, memberId, audit = {}) {
  const staffRowId = parseId(payload.staffId);
  if (!staffRowId) return { success: false, message: 'Staff is required' };
  const staffIdStr = String(staffRowId);
  const { create, update } = auditFields(memberId, audit);

  let releavingAttachment = String(payload.releavingAttachment || '');
  if (payload.releavingAttachmentUpload?.dataBase64) {
    const uploaded = await uploadStaffAttachmentFile(
      payload.releavingAttachmentUpload.filename || 'attachment.pdf',
      payload.releavingAttachmentUpload.dataBase64,
    );
    if (uploaded.error) return { success: false, message: uploaded.error };
    releavingAttachment = uploaded.filename;
  }

  await prisma.staff_profile_tb.update({
    where: { id: staffRowId },
    data: {
      releaving_date: payload.releavingDate ? new Date(payload.releavingDate) : new Date('0000-00-00'),
      releaving_info: String(payload.releavingInfo || ''),
      releaving_attachment: releavingAttachment,
      ...update,
    },
  });

  await prisma.staff_designation_tb.updateMany({
    where: { staff_id: String(staffRowId), del: 1 },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.designations) ? payload.designations : [];
  for (const row of rows) {
    const dept = Number(row.departmentId);
    const desg = Number(row.designationId);
    if (!dept || !desg) continue;
    const data = {
      staff_id: staffIdStr,
      department: dept,
      designation: desg,
      unit_type: String(row.unitType || ''),
      from_date: row.fromDate ? new Date(row.fromDate) : new Date(),
      to_date: row.toDate ? new Date(row.toDate) : new Date('0000-00-00'),
      is_academic: row.isAcademic ? 1 : 0,
      del: 1,
      ...update,
    };
    if (row.id) {
      await prisma.staff_designation_tb.update({ where: { id: Number(row.id) }, data });
    } else {
      await prisma.staff_designation_tb.create({ data: { ...data, ...create } });
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', String(staffRowId), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadDesignationEditSetup(memberId, { staffId: staffRowId }, { ...audit, skipLog: true })),
  };
}

export async function designationEditMore(query = {}) {
  const q = String(query.q || '').trim();
  if (!q) return listStaffPicker(50);
  return searchStaff({
    by: query.by || 'name',
    q,
    staffId: query.staffId,
  });
}
