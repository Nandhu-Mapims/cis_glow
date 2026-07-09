import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminOfficeSetup, parseDateTimeInput } from '../setupAudit.js';
import { loadDepartmentOptions } from '../shared.js';

const PAGE = 'incident_add.php';

export async function loadIncidentAddSetup(memberId, _fields = {}, audit = {}) {
  await logAdminOfficeSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    departmentOptions: await loadDepartmentOptions(),
    form: {
      incidentDate: '',
      category: '',
      title: '',
      location: '',
      firstAidBy: '',
      details: '',
    },
  };
}

export async function saveIncidentAddSetup(payload, memberId, audit = {}) {
  const incidentDate = parseDateTimeInput(payload.incidentDate);
  if (!incidentDate) return { success: false, message: 'Date and time are required' };
  if (!String(payload.title || '').trim()) return { success: false, message: 'Title is required' };

  const { create } = auditFields(memberId, audit);
  await prisma.incident_tb.create({
    data: {
      incident_date: incidentDate,
      incident_category: String(payload.category || ''),
      incident_title: String(payload.title || ''),
      incident_location: String(payload.location || ''),
      first_aid_by: String(payload.firstAidBy || ''),
      incident_details: String(payload.details || ''),
      ...create,
    },
  });

  await logAdminOfficeSetup(PAGE, 'Add', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadIncidentAddSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
