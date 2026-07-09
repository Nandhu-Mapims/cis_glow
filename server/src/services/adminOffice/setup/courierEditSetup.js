import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminOfficeSetup, parseDateTimeInput } from '../setupAudit.js';
import { loadDepartmentMap, loadDepartmentOptions } from '../shared.js';

const PAGE = 'courier_edit.php';

function mapRow(row) {
  const d = row.courier_date;
  const dateStr = d ? String(d).replace('T', ' ').slice(0, 16) : '';
  return {
    id: row.id,
    courierDate: dateStr,
    courierInout: row.courier_inout,
    fromName: row.courier_from,
    toName: row.courier_to,
    category: row.category,
    cType: row.c_type,
    courierNo: row.courier_no,
    courierCompany: row.courier_company,
    hName: row.h_name,
    hDesignation: row.h_designation,
    itemName: row.item_name,
    quantity: row.quantity,
    courierReceiver: row.courier_receiver,
  };
}

async function loadCourierById(id) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id,
           CAST(courier_date AS CHAR) AS courier_date,
           courier_inout, category, courier_from, courier_to, c_type,
           courier_no, courier_company, h_name, h_designation,
           item_name, quantity, courier_receiver, del
    FROM courier_tb WHERE del=1 AND id=${Number(id)} LIMIT 1`);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function loadCourierEditSetup(memberId, fields = {}, audit = {}) {
  const searchId = fields.id ? parseId(fields.id) : null;
  const search = String(fields.search || '').trim();
  const page = Math.max(1, Number(fields.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  let courier = null;
  let list = [];
  let total = 0;

  if (searchId) {
    courier = await loadCourierById(searchId);
  } else {
    let where = 'del=1';
    if (search) {
      where += ` AND (courier_from LIKE '%${escapeSql(search)}%' OR courier_to LIKE '%${escapeSql(search)}%' OR courier_inout LIKE '%${escapeSql(search)}%')`;
    }
    const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM courier_tb WHERE ${where}`);
    total = Number(countRows[0]?.cnt || 0);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, CAST(courier_date AS CHAR) AS courier_date, courier_inout,
             courier_from, courier_to, c_type, category
      FROM courier_tb WHERE ${where}
      ORDER BY courier_date DESC LIMIT ${limit} OFFSET ${offset}`);
    const deptMap = await loadDepartmentMap();
    list = rows.map((r) => ({
      id: r.id,
      date: String(r.courier_date || '').slice(0, 10),
      inout: r.courier_inout,
      fromName: r.courier_from,
      toName: r.courier_to,
      type: r.c_type,
      department: deptMap[String(r.category)] || r.category,
    }));
  }

  await logAdminOfficeSetup(PAGE, 'View', 'Successful', String(searchId || search), memberId, audit);
  return {
    departmentOptions: await loadDepartmentOptions(),
    search,
    page,
    limit,
    total,
    id: searchId || null,
    courier,
    list,
  };
}

export async function saveCourierEditSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    const { update } = auditFields(memberId, audit);
    await prisma.courier_tb.update({ where: { id }, data: { del: 0, ...update } });
    await logAdminOfficeSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadCourierEditSetup(memberId, {}, { ...audit, skipLog: true })),
    };
  }

  const id = parseId(payload.id);
  if (!id) return { success: false, message: 'Courier record not found' };

  const courierDate = parseDateTimeInput(payload.courierDate);
  if (!courierDate) return { success: false, message: 'Date and time are required' };

  const cType = String(payload.cType || 'Postal');
  const { update } = auditFields(memberId, audit);
  await prisma.courier_tb.update({
    where: { id },
    data: {
      courier_date: courierDate,
      courier_inout: String(payload.courierInout || 'In'),
      category: String(payload.category || ''),
      courier_from: String(payload.fromName || ''),
      courier_to: String(payload.toName || ''),
      c_type: cType,
      courier_no: cType === 'Hand' ? '' : String(payload.courierNo || ''),
      courier_company: cType === 'Hand' ? '' : String(payload.courierCompany || ''),
      h_name: cType === 'Hand' ? String(payload.hName || '') : '',
      h_designation: cType === 'Hand' ? String(payload.hDesignation || '') : '',
      item_name: String(payload.itemName || ''),
      quantity: String(payload.quantity || ''),
      courier_receiver: String(payload.courierReceiver || ''),
      del: 1,
      ...update,
    },
  });

  await logAdminOfficeSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadCourierEditSetup(memberId, { id }, { ...audit, skipLog: true })),
  };
}
