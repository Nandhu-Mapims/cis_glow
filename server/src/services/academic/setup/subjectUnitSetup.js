import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect, staffDeptMasterSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'subject_unit_setup_v2.php';

const UNIT_PRESETS = [
  { value: 'Must Know', label: 'Must Know', order: 1 },
  { value: 'Desirable to Know', label: 'Desirable to Know', order: 2 },
  { value: 'Nice to Know', label: 'Nice to Know', order: 3 },
  { value: 'A-A-A', label: 'A-A-A', order: 4 },
  { value: 'Test', label: 'Test', order: 5 },
];

const SUB_CATEGORY_MAP = { 1: 'Lecture', 2: 'Clinical', 3: 'Practical' };

function courseUnitKey(courseId, academicYear, currentYear, subCategoryId) {
  return `${courseId}___${academicYear}___${currentYear}___${subCategoryId}`;
}

function parseCourseUnitKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 4) return null;
  return {
    courseId: parts[0],
    academicYear: parts[1],
    currentYear: parts[2],
    subCategoryId: parts[3],
    subCategory: SUB_CATEGORY_MAP[Number(parts[3])] || parts[3],
  };
}

async function buildCourseUnitOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
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
    const group = `${course.course_name} | ${course.degree_name}${dept} | ${ft}`;

    const regularYear = course.course_name === 'U.G'
      ? setup?.ug_academic_year
      : setup?.pg_academic_year;
    let duration = Number(course.course_duration) || Number(course.total_semester) || 0;
    if (course.course_name === 'U.G' && duration > 0) duration -= 1;

    const push = (acYear, cyear, subId, subLabel, batchLabel) => {
      if (!acYear) return;
      const cyearLabel = convertNYear(cyear, course.course_name || 'U.G');
      options.push({
        value: courseUnitKey(course.id, acYear, cyear, subId),
        label: `${cyearLabel} Year - ${subLabel}`,
        group: `${course.degree_name}${dept}-${acYear}`,
        courseId: String(course.id),
        academicYear: acYear,
        currentYear: String(cyear),
        subCategoryId: String(subId),
        subCategory: subLabel,
        batchLabel,
      });
    };

    for (let cy = 1; cy <= duration; cy += 1) {
      push(regularYear, cy, 1, 'Lecture', 'Regular');
      push(regularYear, cy, 2, 'Clinical', 'Regular');
      push(regularYear, cy, 3, 'Practical', 'Regular');
    }

    if (course.course_name === 'U.G' && regularYear) {
      const nextYearStart = Number(String(regularYear).slice(5, 9)) || (Number(String(regularYear).split('-')[0]) + 1);
      const addAcYear = `${nextYearStart}-${nextYearStart + 1}`;
      for (let cy = 1; cy <= duration; cy += 1) {
        push(addAcYear, cy, 1, 'Lecture', 'Additional');
        push(addAcYear, cy, 2, 'Clinical', 'Additional');
        push(addAcYear, cy, 3, 'Practical', 'Additional');
      }
    }
  }

  return options;
}

export async function loadSubjectUnit(memberId, fields = {}, audit = {}) {
  const departments = await prisma.staff_dept_master.findMany({
    where: { del: 1, category: 'Academic' },
    orderBy: { d_order: 'asc' },
    select: staffDeptMasterSelect,
  });
  const departmentOptions = departments.map((d) => ({ value: String(d.id), label: d.name }));

  const departmentId = String(fields.department_id || '').trim();
  const courseUnitKeyVal = String(fields.course_name || '').trim();
  const requestedUnitId = String(fields.unit_name_ref || fields.unit_name || '').trim();
  const courseSelection = parseCourseUnitKey(courseUnitKeyVal);

  const courseUnitOptions = departmentId ? await buildCourseUnitOptions() : [];

  let unitOptions = [];
  let unit = null;
  let chapters = [];

  let resolvedUnitId = requestedUnitId;
  if (departmentId && courseSelection) {
    const units = await prisma.basic_subject_new_unit.findMany({
      where: {
        del: 1,
        course_id: courseSelection.courseId,
        academic_year: courseSelection.academicYear,
        current_year: courseSelection.currentYear,
        department: departmentId,
        sub_category: courseSelection.subCategory,
      },
      orderBy: { u_order: 'asc' },
    });
    unitOptions = units.map((u) => ({ value: String(u.id), label: u.name }));

    // Legacy flow auto-opens either first unit or "Add new unit".
    if (!resolvedUnitId) {
      resolvedUnitId = units.length ? String(units[0].id) : 'add_new';
    }

    const activeUnitId = resolvedUnitId === 'add_new' ? '' : resolvedUnitId;
    if (activeUnitId && /^\d+$/.test(activeUnitId)) {
      const unitRow = units.find((u) => String(u.id) === activeUnitId);
      if (unitRow) {
        unit = { id: unitRow.id, name: unitRow.name, order: unitRow.u_order };
        const chapterRows = await prisma.basic_subject_new_chapter.findMany({
          where: { del: 1, u_id: unitRow.id },
          orderBy: { c_order: 'asc' },
        });
        chapters = chapterRows.map((c) => ({
          id: c.id,
          name: c.name,
          order: c.c_order,
          materialLink: c.material_link,
        }));
      }
    } else if (resolvedUnitId === 'add_new') {
      unit = { id: null, name: UNIT_PRESETS[0].value, order: UNIT_PRESETS[0].order, isNew: true };
      chapters = [{ name: '', order: 1, materialLink: '' }];
    }
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', courseUnitKeyVal || '', memberId, audit);
  return {
    departmentOptions,
    departmentId,
    courseUnitOptions,
    courseUnitKey: courseUnitKeyVal,
    courseSelection,
    unitPresets: UNIT_PRESETS,
    unitOptions,
    unitId: resolvedUnitId || '',
    unit,
    chapters: chapters.length ? chapters : (unit ? [{ name: '', order: 1, materialLink: '' }] : []),
    scope: departmentId && courseSelection ? {
      courseId: courseSelection.courseId,
      academicYear: courseSelection.academicYear,
      currentYear: courseSelection.currentYear,
      departmentId,
      subCategory: courseSelection.subCategory,
    } : null,
  };
}

export async function saveSubjectUnit(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.basic_subject_new_chapter.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadSubjectUnit(memberId, {
          department_id: payload.departmentId,
          course_name: payload.courseUnitKey,
          unit_name_ref: payload.unitId,
        }, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const scope = payload.scope || {};
  if (!scope.courseId || !scope.academicYear || !scope.currentYear || !scope.departmentId || !scope.subCategory) {
    return { success: false, message: 'Department and course selection are required' };
  }

  const { create, update } = auditFields(memberId, audit);
  let unitId = payload.unitId;
  const unitName = String(payload.unitName || '').trim();
  const unitOrder = Number(payload.unitOrder) || 1;

  if (unitId === 'add_new' || !unitId) {
    const created = await prisma.basic_subject_new_unit.create({
      data: {
        course_id: String(scope.courseId),
        academic_year: scope.academicYear,
        current_year: String(scope.currentYear),
        department: String(scope.departmentId),
        sub_category: scope.subCategory,
        subject_id: '',
        name: unitName,
        u_order: unitOrder,
        ...create,
      },
    });
    unitId = created.id;
  } else {
    await prisma.basic_subject_new_unit.update({
      where: { id: Number(unitId) },
      data: {
        course_id: String(scope.courseId),
        academic_year: scope.academicYear,
        current_year: String(scope.currentYear),
        department: String(scope.departmentId),
        sub_category: scope.subCategory,
        name: unitName,
        u_order: unitOrder,
        ...update,
      },
    });
    await prisma.basic_subject_new_chapter.updateMany({
      where: { del: 1, u_id: Number(unitId) },
      data: { del: 0, ...update },
    });
  }

  const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
  for (const ch of chapters) {
    const chName = String(ch.name || '').trim();
    if (!chName && !ch.id) continue;
    const chData = {
      name: chName,
      material_link: String(ch.materialLink || ''),
      c_order: Number(ch.order) || 0,
      del: 1,
      ...update,
    };
    if (!ch.id) {
      await prisma.basic_subject_new_chapter.create({
        data: { u_id: Number(unitId), ...chData, ...create },
      });
    } else {
      await prisma.basic_subject_new_chapter.update({
        where: { id: Number(ch.id) },
        data: chData,
      });
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', unitName, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadSubjectUnit(memberId, {
      department_id: scope.departmentId,
      course_name: payload.courseUnitKey,
      unit_name_ref: String(unitId),
    }, { ...audit, skipLog: true })),
  };
}
