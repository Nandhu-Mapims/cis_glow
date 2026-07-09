import { prisma } from '../../../config/prisma.js';
import { eventParticipantTbSelect, eventTbSelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminOfficeSetup, toIsoDate } from '../setupAudit.js';
import { loadAcademicYearRef, resolveParticipantNames } from '../shared.js';

const EVENT_TYPES = [
  { value: 'inter', label: 'Inter' },
  { value: 'intra', label: 'Intra' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
];

const CATEGORY_OPTIONS = [
  { value: 'Academic', label: 'Academic' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Finearts', label: 'Fine Arts' },
  { value: 'Association', label: 'Association' },
  { value: 'Others', label: 'Others' },
];

function pageFor(eventFor, mode) {
  return mode === 'add'
    ? (eventFor === 'student' ? 'student_activities_add.php' : 'staff_activities_add.php')
    : (eventFor === 'student' ? 'student_activities_edit.php' : 'staff_activities_edit.php');
}

function emptyParticipantRow() {
  return { id: null, prizeName: '', studentList: '', studentNameList: '' };
}

function mapEvent(row, participants = []) {
  return {
    id: row.id,
    eventName: row.event_name,
    eventType: row.event_type,
    eventCategory: row.event_category,
    eventDate: toIsoDate(row.event_date),
    eventVenue: row.event_venue,
    eventContent: row.event_content_1,
    participantsNo: row.event_participants_no,
    participantsName: row.event_participants_name,
    participantRows: participants.length
      ? participants.map((p) => ({
        id: p.id,
        prizeName: p.prize_name,
        studentList: p.student_list,
        studentNameList: p.student_name_list,
      }))
      : [emptyParticipantRow()],
  };
}

async function loadEventById(id, eventFor) {
  const row = await prisma.event_tb.findFirst({
    where: { del: 1, id: Number(id), event_for: eventFor },
    select: eventTbSelect,
  });
  if (!row) return null;
  const participants = await prisma.event_participant_tb.findMany({
    where: { del: 1, event_id: String(id) },
    orderBy: { id: 'asc' },
    select: eventParticipantTbSelect,
  });
  return mapEvent(row, participants);
}

export async function loadActivitiesAddSetup(memberId, eventFor, _fields = {}, audit = {}) {
  await logAdminOfficeSetup(pageFor(eventFor, 'add'), 'View', 'Successful', eventFor, memberId, audit);
  return {
    eventFor,
    eventTypes: EVENT_TYPES,
    categoryOptions: CATEGORY_OPTIONS,
    academicYear: await loadAcademicYearRef(),
    form: {
      eventName: '',
      eventType: 'inter',
      eventCategory: 'Academic',
      eventDate: '',
      eventVenue: '',
      eventContent: '',
      participantsNo: '',
      participantsName: '',
      participantRows: [emptyParticipantRow()],
    },
  };
}

export async function saveActivitiesAddSetup(payload, eventFor, memberId, audit = {}) {
  const eventDate = toIsoDate(payload.eventDate);
  if (!eventDate) return { success: false, message: 'Event date is required' };
  if (!String(payload.eventName || '').trim()) return { success: false, message: 'Event name is required' };

  const academicYear = await loadAcademicYearRef();
  const { create } = auditFields(memberId, audit);
  const created = await prisma.event_tb.create({
    data: {
      event_for: eventFor,
      academic_year: academicYear,
      event_name: String(payload.eventName || ''),
      event_type: String(payload.eventType || ''),
      event_category: String(payload.eventCategory || ''),
      event_date: new Date(`${eventDate}T00:00:00`),
      event_venue: String(payload.eventVenue || ''),
      event_content_1: String(payload.eventContent || ''),
      event_participants_no: String(payload.participantsNo || ''),
      event_participants_name: String(payload.participantsName || ''),
      c_completed: 0,
      ...create,
    },
  });

  const rows = Array.isArray(payload.participantRows) ? payload.participantRows : [];
  for (const row of rows) {
    const prizeName = String(row.prizeName || '').trim();
    const studentList = String(row.studentList || '').trim();
    if (!prizeName && !studentList) continue;
    await prisma.event_participant_tb.create({
      data: {
        event_id: String(created.id),
        prize_name: prizeName,
        house_name: '',
        student_list: studentList,
        student_name_list: String(row.studentNameList || ''),
        ...create,
      },
    });
  }

  await logAdminOfficeSetup(pageFor(eventFor, 'add'), 'Add', 'Successful', String(created.id), memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadActivitiesAddSetup(memberId, eventFor, {}, { ...audit, skipLog: true })),
  };
}

export async function loadActivitiesEditSetup(memberId, eventFor, fields = {}, audit = {}) {
  const searchId = fields.id ? parseId(fields.id) : null;
  const search = String(fields.search || '').trim();
  const page = Math.max(1, Number(fields.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  let event = null;
  let list = [];
  let total = 0;

  if (searchId) {
    event = await loadEventById(searchId, eventFor);
  } else {
    let where = `del=1 AND event_for='${escapeSql(eventFor)}'`;
    if (search) {
      where += ` AND event_name LIKE '%${escapeSql(search)}%'`;
    }
    const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM event_tb WHERE ${where}`);
    total = Number(countRows[0]?.cnt || 0);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, CAST(event_date AS CHAR) AS event_date, event_name, event_category
      FROM event_tb WHERE ${where}
      ORDER BY event_date DESC LIMIT ${limit} OFFSET ${offset}`);
    list = rows.map((r) => ({
      id: r.id,
      date: String(r.event_date || '').slice(0, 10),
      name: r.event_name,
      category: r.event_category,
    }));
  }

  await logAdminOfficeSetup(pageFor(eventFor, 'edit'), 'View', 'Successful', String(searchId || search), memberId, audit);
  return {
    eventFor,
    eventTypes: EVENT_TYPES,
    categoryOptions: CATEGORY_OPTIONS,
    search,
    page,
    limit,
    total,
    id: searchId || null,
    event,
    list,
  };
}

export async function saveActivitiesEditSetup(payload, eventFor, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    const { update } = auditFields(memberId, audit);
    await prisma.event_tb.update({ where: { id }, data: { del: 0, ...update } });
    await prisma.event_participant_tb.updateMany({
      where: { event_id: String(id) },
      data: { del: 0, ...update },
    });
    await logAdminOfficeSetup(pageFor(eventFor, 'edit'), 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadActivitiesEditSetup(memberId, eventFor, {}, { ...audit, skipLog: true })),
    };
  }

  const id = parseId(payload.id);
  if (!id) return { success: false, message: 'Event not found' };

  const eventDate = toIsoDate(payload.eventDate);
  if (!eventDate) return { success: false, message: 'Event date is required' };

  const { update, create } = auditFields(memberId, audit);
  await prisma.event_tb.update({
    where: { id },
    data: {
      event_name: String(payload.eventName || ''),
      event_type: String(payload.eventType || ''),
      event_category: String(payload.eventCategory || ''),
      event_date: new Date(`${eventDate}T00:00:00`),
      event_venue: String(payload.eventVenue || ''),
      event_content_1: String(payload.eventContent || ''),
      event_participants_no: String(payload.participantsNo || ''),
      event_participants_name: String(payload.participantsName || ''),
      del: 1,
      ...update,
    },
  });

  await prisma.event_participant_tb.updateMany({
    where: { event_id: String(id) },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.participantRows) ? payload.participantRows : [];
  for (const row of rows) {
    const prizeName = String(row.prizeName || '').trim();
    const studentList = String(row.studentList || '').trim();
    if (!prizeName && !studentList && !row.id) continue;
    if (row.id) {
      await prisma.event_participant_tb.update({
        where: { id: Number(row.id) },
        data: {
          prize_name: prizeName,
          student_list: studentList,
          student_name_list: String(row.studentNameList || ''),
          del: 1,
          ...update,
        },
      });
    } else if (prizeName || studentList) {
      await prisma.event_participant_tb.create({
        data: {
          event_id: String(id),
          prize_name: prizeName,
          house_name: '',
          student_list: studentList,
          student_name_list: String(row.studentNameList || ''),
          ...create,
        },
      });
    }
  }

  await logAdminOfficeSetup(pageFor(eventFor, 'edit'), 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadActivitiesEditSetup(memberId, eventFor, { id }, { ...audit, skipLog: true })),
  };
}

export async function lookupActivityParticipants(eventFor, ids) {
  return resolveParticipantNames(ids, eventFor);
}
