import { prisma } from '../../../config/prisma.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'academic_calendar.php';

const COURSE_TYPE_OPTIONS = [
  { value: 'U.G', label: 'U.G' },
  { value: 'P.G', label: 'P.G' },
  { value: 'Int', label: 'Int' },
];

function buildMonthOptions() {
  const options = [];
  const cursor = new Date();
  cursor.setMonth(cursor.getMonth() + 11);
  cursor.setDate(1);
  const stop = new Date();
  stop.setMonth(stop.getMonth() - 3);
  stop.setDate(1);

  while (cursor >= stop) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    options.push({
      value,
      label: cursor.toLocaleString('en-US', { month: 'long' }),
      year: cursor.getFullYear(),
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
}

function formatRowDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
}

function defaultEventForDate(dateStr) {
  const d = new Date(dateStr);
  return d.getDay() === 0 ? 'Holiday-Weekly' : 'Working';
}

async function loadEventOptions() {
  const rows = await prisma.basic_cal_event.findMany({
    where: { del: 1 },
    orderBy: { event_name: 'asc' },
    select: { event_name: true },
  });
  return rows.map((row) => ({ value: row.event_name, label: row.event_name }));
}

async function loadMonthRows(calendarMonth) {
  const [year, month] = String(calendarMonth).split('-').map(Number);
  if (!year || !month) return [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const eventOptions = await loadEventOptions();
  const eventNames = eventOptions.map((opt) => opt.value);

  const rows = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = await prisma.academic_calender_tb.findFirst({
      where: { academic_date: new Date(dateStr), del: 1 },
    });

    const courseTypes = existing?.course_type
      ? String(existing.course_type).split(',,,').filter(Boolean)
      : [];

    rows.push({
      id: existing?.id || null,
      date: dateStr,
      dateLabel: formatRowDate(dateStr),
      event: existing?.academic_events || defaultEventForDate(dateStr),
      courseTypes,
      comment: existing?.comments || '',
      eventOptions: eventNames,
    });
  }
  return rows;
}

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildPrintHtml(monthLabel, rows) {
  const body = rows.map((r) => `
    <tr>
      <td>${esc(r.dateLabel)}</td>
      <td>${esc(r.event)}</td>
      <td>${esc((r.courseTypes || []).join(', '))}</td>
      <td>${esc(r.comment)}</td>
    </tr>`).join('');
  return `<div id="form_details_panel"><h3>Academic Calendar — ${esc(monthLabel)}</h3>
    <table border="1" cellspacing="0" cellpadding="4"><thead><tr>
      <th>Date</th><th>Event</th><th>Course</th><th>Comment</th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
}

export async function loadAcademicCalendar(memberId, fields = {}, audit = {}) {
  const monthOptions = buildMonthOptions();
  const calendarMonth = String(fields.calendarMonth || '').trim();
  const eventOptions = await loadEventOptions();

  let rows = [];
  let monthLabel = '';
  if (calendarMonth) {
    const [year, month] = calendarMonth.split('-').map(Number);
    const labelDate = new Date(year, month - 1, 1);
    monthLabel = labelDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    rows = await loadMonthRows(calendarMonth);
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', calendarMonth, memberId, audit);
  return {
    monthOptions,
    calendarMonth,
    monthLabel,
    eventOptions,
    courseTypeOptions: COURSE_TYPE_OPTIONS,
    rows,
    printHtml: rows.length ? buildPrintHtml(monthLabel, rows) : '',
  };
}

export async function saveAcademicCalendar(payload, memberId, audit = {}) {
  const calendarMonth = String(payload.calendarMonth || '').trim();
  if (!calendarMonth) {
    return { success: false, message: 'Month is required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  for (const row of rows) {
    const dateStr = String(row.date || '').trim();
    if (!dateStr) continue;

    const event = String(row.event || '').trim() || '-';
    const comment = String(row.comment || '').trim();
    const courseTypes = Array.isArray(row.courseTypes) ? row.courseTypes : [];
    const courseType = courseTypes.join(',,,');

    if (!row.id) {
      await prisma.academic_calender_tb.create({
        data: {
          course_type: courseType,
          academic_date: new Date(dateStr),
          academic_events: event,
          comments: comment,
          academic_year: '',
          admission_year: '',
          odd_even_sem: 0,
          course_id: '',
          day_order: 0,
          ...create,
        },
      });
    } else {
      await prisma.academic_calender_tb.update({
        where: { id: Number(row.id) },
        data: {
          course_type: courseType,
          academic_date: new Date(dateStr),
          academic_events: event,
          comments: comment,
          ...update,
        },
      });
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', calendarMonth, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadAcademicCalendar(memberId, { calendarMonth }, { ...audit, skipLog: true })),
  };
}
