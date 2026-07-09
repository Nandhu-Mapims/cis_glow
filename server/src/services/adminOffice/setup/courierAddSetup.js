import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminOfficeSetup, parseDateTimeInput } from '../setupAudit.js';
import { loadDepartmentOptions } from '../shared.js';

const PAGE = 'courier_add.php';

const TYPE_OPTIONS = [
  { value: 'Postal', label: 'Postal' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Hand', label: 'Hand' },
];

const INOUT_OPTIONS = [
  { value: 'In', label: 'In' },
  { value: 'Out', label: 'Out' },
];

export async function loadCourierAddSetup(memberId, _fields = {}, audit = {}) {
  await logAdminOfficeSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    departmentOptions: await loadDepartmentOptions(),
    typeOptions: TYPE_OPTIONS,
    inoutOptions: INOUT_OPTIONS,
    form: {
      courierDate: '',
      courierInout: 'In',
      fromName: '',
      toName: '',
      category: '',
      cType: 'Postal',
      courierNo: '',
      courierCompany: '',
      hName: '',
      hDesignation: '',
      itemName: '',
      quantity: '',
      courierReceiver: '',
    },
  };
}

export async function saveCourierAddSetup(payload, memberId, audit = {}) {
  const courierDate = parseDateTimeInput(payload.courierDate);
  if (!courierDate) return { success: false, message: 'Date and time are required' };

  const { create } = auditFields(memberId, audit);
  await prisma.courier_tb.create({
    data: {
      courier_date: courierDate,
      courier_inout: String(payload.courierInout || 'In'),
      category: String(payload.category || ''),
      staff_id: '',
      courier_from: String(payload.fromName || ''),
      courier_to: String(payload.toName || ''),
      c_type: String(payload.cType || 'Postal'),
      courier_no: String(payload.courierNo || ''),
      courier_company: String(payload.courierCompany || ''),
      h_name: String(payload.hName || ''),
      h_designation: String(payload.hDesignation || ''),
      courier_note: '',
      item_name: String(payload.itemName || ''),
      quantity: String(payload.quantity || ''),
      courier_receiver: String(payload.courierReceiver || ''),
      ...create,
    },
  });

  await logAdminOfficeSetup(PAGE, 'Add', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadCourierAddSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
