import { prisma } from '../../../config/prisma.js';
import { auditFields, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'library_att_entry.php';

export async function loadAttEntrySetup(memberId, _fields = {}, audit = {}) {
  await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    staffId: '',
    entryDate: new Date().toISOString().slice(0, 10),
    entryTime: new Date().toTimeString().slice(0, 5),
    inOut: 'IN',
  };
}

export async function saveAttEntrySetup(payload, memberId, audit = {}) {
  const staffId = String(payload.staffId || '').trim();
  const entryDate = toIsoDate(payload.entryDate);
  const entryTime = String(payload.entryTime || '00:00');
  const inOut = String(payload.inOut || 'IN').toUpperCase();

  if (!staffId || !entryDate) {
    return { success: false, message: 'Staff ID and date are required' };
  }

  const staff = await prisma.staff_profile_tb.findFirst({
    where: { del: 1, staff_id: staffId },
    select: { staff_id: true, staff_image: true, job_category: true },
  });
  if (!staff) return { success: false, message: 'Staff not found' };

  const { create } = auditFields(memberId, audit);
  const dateTime = new Date(`${entryDate}T${entryTime}:00`);
  await prisma.library_image_att_tb.create({
    data: {
      s_id: staff.staff_id,
      job_category: staff.job_category || '',
      staff_image: staff.staff_image || '',
      entry_date_time: dateTime,
      entry_in_out: inOut,
      manual_entry: 1,
      ...create,
    },
  });

  await logLibrarySetup(PAGE, 'Add', 'Successful', staffId, memberId, audit);
  return { success: true, message: 'Manual entry saved...', ...(await loadAttEntrySetup(memberId, {}, { ...audit, skipLog: true })) };
}
