import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import {
  courseIdYearKey,
  getCourseById,
  loadDepartmentMap,
  loadDepartmentOptions,
  loadRoomOptions,
  loadSubjectMasterMap,
  parseCourseIdYearKey,
} from '../academicSetupShared.js';
import { loadAcademicConfig } from '../../shared/ciaSetupHelpers.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'subject_setup.php';
const ATT_EOS = 2016;

const SUBJECT_DEFAULTS = {
  subject_count: 0,
  internal_min: 0,
  internal_max: 0,
  external_min: 0,
  external_max: 0,
  pass_mark: 0,
  credit_points: 0,
  part_no: '',
  subject_code: '',
  department: '',
};

function defaultShortName(name) {
  const s = String(name || '').trim();
  return s ? s.slice(0, 5) : '';
}

function splitCsv(val) {
  return String(val || '').split(',').map((v) => v.trim()).filter(Boolean);
}

async function loadTtRows(rid) {
  const rows = await prisma.basic_subject_tt_tb.findMany({
    where: { del: 1, rid: Number(rid) },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    categoryId: String(r.subject_category),
    name: r.subject_name,
    shortName: r.short_subject_name,
    departments: splitCsv(r.department),
    roomNo: r.room_no,
    batchSplit: r.s_batch === 1,
  }));
}

async function loadMarkRows(rid) {
  const rows = await prisma.basic_subject_marks_tb.findMany({
    where: { del: 1, rid: Number(rid) },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    categoryId: String(r.subject_category),
    name: r.subject_name,
    shortName: r.short_subject_name,
    departments: splitCsv(r.department),
    internalMax: r.internal_max,
    vivaMax: r.viva_max,
    externalMax: r.external_max,
    passMark: r.pass_mark,
    examRoom: r.ex_room_no,
  }));
}

function mapSubjectRow(row) {
  return {
    id: row.id,
    enabled: row.subject_enable === 1,
    order: row.subject_order,
    categoryId: String(row.subject_category),
    subTypeId: String(row.subject_type),
    subjectId: row.subject_id,
    name: row.subject_name,
    shortName: row.short_subject_name,
  };
}

/** Legacy subject_setup.php course dropdown — all years from setup down to ATT_EOS. */
export async function buildSubjectSetupCourseOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const yearOfStart = Math.max(Number(course.year_of_start) || 2000, ATT_EOS);
    const degreeLabel = `${course.degree_name}${dept}`;

    const regularSetup = academicYearArray[course.course_name]?.regular;
    if (regularSetup) {
      const [setupStart, setupEnd] = String(regularSetup).split('-').map(Number);
      const loopStart = Math.max(setupStart, setupEnd || setupStart);
      const group = `${course.course_name} | ${degreeLabel} | ${ft} | Regular`;
      for (let i = loopStart; i >= yearOfStart; i -= 1) {
        const yearLabel = `${i + 1}-${i + 2}`;
        options.push({
          value: courseIdYearKey(course.id, yearLabel, 'regular'),
          label: `${degreeLabel} | ${yearLabel}`,
          group,
          courseId: course.id,
          courseName: course.course_name,
          academicYear: yearLabel,
          academicType: 'regular',
          totalSemester: Number(course.total_semester) || 0,
        });
      }
    }

    const additionalSetup = academicYearArray[course.course_name]?.additional;
    if (additionalSetup && course.course_name === 'U.G') {
      const [setupStart, setupEnd] = String(additionalSetup).split('-').map(Number);
      const loopStart = Math.max(setupStart, setupEnd || setupStart) + 1;
      const group = `${course.course_name} | ${degreeLabel} | ${ft} | Additional`;
      for (let i = loopStart; i >= yearOfStart; i -= 1) {
        const yearLabel = `${i}-${i + 1}`;
        options.push({
          value: courseIdYearKey(course.id, yearLabel, 'additional'),
          label: `${degreeLabel} | ${yearLabel}`,
          group,
          courseId: course.id,
          courseName: course.course_name,
          academicYear: yearLabel,
          academicType: 'additional',
          totalSemester: Number(course.total_semester) || 0,
        });
      }
    }
  }

  return options;
}

export async function loadSubjectSetup(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildSubjectSetupCourseOptions();
  const selection = parseCourseIdYearKey(fields.course_name);
  const semester = Number(fields.semester_name) || 0;

  const [categoryMaster, subTypeMaster, typeMaster, ttCategoryMaster, departmentOptions, roomData] = await Promise.all([
    loadSubjectMasterMap('Category'),
    loadSubjectMasterMap('Sub-Type'),
    loadSubjectMasterMap('Type'),
    loadSubjectMasterMap('Timetable'),
    loadDepartmentOptions(),
    loadRoomOptions(),
  ]);

  let course = null;
  let rows = [];
  if (selection) {
    course = await getCourseById(selection.courseId);
    if (semester) {
      const subjectRows = await prisma.basic_setup_subject_tb.findMany({
        where: {
          del: 1,
          academic_year: selection.academicYear,
          course_id: selection.courseId,
          semester_no: semester,
        },
        orderBy: { subject_order: 'asc' },
      });
      rows = await Promise.all(subjectRows.map(async (row) => ({
        ...mapSubjectRow(row),
        ttRows: await loadTtRows(row.id),
        markRows: await loadMarkRows(row.id),
      })));
      if (!rows.length) {
        rows = [{
          enabled: true, order: 1, categoryId: '', subTypeId: '', subjectId: '', name: '', shortName: '',
          ttRows: [], markRows: [],
        }];
      }
    }
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    semester,
    totalSemester: course ? Number(course.total_semester) || 0 : 0,
    categoryOptions: categoryMaster.options,
    subTypeOptions: subTypeMaster.options,
    typeOptions: typeMaster.options,
    ttCategoryOptions: ttCategoryMaster.options,
    departmentOptions,
    roomGroups: roomData.groups,
    rows,
    scope: selection && semester ? {
      academicYear: selection.academicYear,
      courseId: selection.courseId,
      courseName: selection.courseName || course?.course_name,
      semester,
    } : null,
  };
}

export async function saveSubjectSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.basic_setup_subject_tb.update({ where: { id }, data: { del: 0, ...update } });
      await prisma.basic_subject_tt_tb.updateMany({ where: { rid: id }, data: { del: 0, ...update } });
      await prisma.basic_subject_marks_tb.updateMany({ where: { rid: id }, data: { del: 0, ...update } });
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadSubjectSetup(memberId, {
          course_name: payload.courseYearKey,
          semester_name: payload.semester,
        }, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const scope = payload.scope || {};
  const academicYear = String(scope.academicYear || '').trim();
  const courseId = Number(scope.courseId);
  const semester = Number(scope.semester);
  if (!academicYear || !courseId || !semester) {
    return { success: false, message: 'Course, year and semester are required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.basic_setup_subject_tb.updateMany({
    where: { del: 1, academic_year: academicYear, course_id: courseId, semester_no: semester },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const subjectId = String(row.subjectId || '').trim();
    if (!row.id && (!name || !subjectId)) continue;

    const data = {
      academic_year: academicYear,
      course_id: courseId,
      semester_no: semester,
      subject_id: subjectId,
      subject_category: String(row.categoryId || ''),
      subject_type: String(row.subTypeId || ''),
      subject_name: name,
      short_subject_name: String(row.shortName || '').trim() || defaultShortName(name),
      subject_order: Number(row.order) || 0,
      subject_enable: row.enabled ? 1 : 0,
      del: 1,
      ...update,
    };

    let parentId;
    if (!row.id) {
      const created = await prisma.basic_setup_subject_tb.create({
        data: { ...SUBJECT_DEFAULTS, ...data, ...create },
      });
      parentId = created.id;
    } else {
      await prisma.basic_setup_subject_tb.update({ where: { id: Number(row.id) }, data });
      parentId = Number(row.id);
    }

    await prisma.basic_subject_tt_tb.updateMany({ where: { del: 1, rid: parentId }, data: { del: 0, ...update } });
    for (const tt of row.ttRows || []) {
      const ttName = String(tt.name || '').trim();
      const ttSubjectId = String(tt.subjectId || '').trim();
      if (!ttSubjectId || !ttName) continue;
      const ttData = {
        rid: parentId,
        subject_id: ttSubjectId,
        subject_category: String(tt.categoryId || ''),
        subject_name: ttName,
        short_subject_name: String(tt.shortName || '').trim() || defaultShortName(ttName),
        department: (tt.departments || []).join(','),
        room_no: String(tt.roomNo || ''),
        s_batch: tt.batchSplit ? 1 : 0,
        del: 1,
        ...update,
      };
      if (!tt.id) {
        await prisma.basic_subject_tt_tb.create({ data: { total_batch: 1, req_hours: '', ...ttData, ...create } });
      } else {
        await prisma.basic_subject_tt_tb.update({ where: { id: Number(tt.id) }, data: ttData });
      }
    }

    await prisma.basic_subject_marks_tb.updateMany({ where: { del: 1, rid: parentId }, data: { del: 0, ...update } });
    for (const mk of row.markRows || []) {
      const mkName = String(mk.name || '').trim();
      const mkSubjectId = String(mk.subjectId || '').trim();
      if (!mkSubjectId || !mkName) continue;
      const mkData = {
        rid: parentId,
        subject_id: mkSubjectId,
        subject_category: String(mk.categoryId || ''),
        subject_name: mkName,
        short_subject_name: String(mk.shortName || '').trim() || defaultShortName(mkName),
        department: (mk.departments || []).join(','),
        internal_max: Number(mk.internalMax) || 0,
        viva_max: Number(mk.vivaMax) || 0,
        external_max: Number(mk.externalMax) || 0,
        pass_mark: String(mk.passMark ?? ''),
        ex_room_no: String(mk.examRoom || ''),
        del: 1,
        ...update,
      };
      if (!mk.id) {
        await prisma.basic_subject_marks_tb.create({
          data: { internal_min: 0, viva_min: 0, external_min: 0, ...mkData, ...create },
        });
      } else {
        await prisma.basic_subject_marks_tb.update({ where: { id: Number(mk.id) }, data: mkData });
      }
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadSubjectSetup(memberId, {
      course_name: payload.courseYearKey,
      semester_name: semester,
    }, { ...audit, skipLog: true })),
  };
}
