import { prisma } from '../../config/prisma.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';
import { escapeSql, normalizeLegacyDate, parseId, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';

const normalizeDate = normalizeLegacyDate;

export const EC_ACTIVITY_GROUPS = [
  { key: 'extra_skills', category: 'Skills', label: 'Add-on Skill Sets' },
  { key: 'extra_curricular', category: 'Extra Curricular', label: 'Extension Activities' },
  { key: 'area_interest', category: 'Area of Interest', label: 'Area of Specialization' },
  { key: 'area_interests', category: 'Area of Interests', label: 'Sports' },
];

async function loadEduOptions(category) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name, category_sname, sub_category
     FROM edu_setup_tb
     WHERE category = '${escapeSql(category)}' AND del = 1
     ORDER BY category_order ASC`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.category_name,
    shortName: r.category_sname,
    subCategory: r.sub_category || '',
  }));
}

async function loadMasterOptions(category) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name, category_sname
     FROM master_setup
     WHERE category = '${escapeSql(category)}' AND del != 0
     ORDER BY category_order ASC`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.category_name,
    shortName: r.category_sname,
  }));
}

export async function getStaffProfileOptions() {
  const [
    categories,
    departments,
    levels,
    attendanceTypes,
    payrollTypes,
    titles,
    religions,
    communities,
    bloodGroups,
    banks,
    courses,
    degrees,
    majors,
    universities,
    courseTypes,
    regCouncils,
    experienceTypes,
    institutionTypes,
    languages,
    activityOptions,
  ] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, category_name FROM edu_setup_tb
       WHERE category = 'Category' AND del != 0 ORDER BY category_order ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, name FROM staff_dept_master WHERE del = 1 ORDER BY d_order ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del = 1 ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, staff_category, morning_in, evening_in
       FROM basic_attendance_setup_tb WHERE del = 1 ORDER BY staff_category ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, payroll_type FROM basic_setup_payroll_tb WHERE del = 1 ORDER BY payroll_type ASC`,
    ),
    loadEduOptions('Staff Name Title'),
    loadMasterOptions('Religion'),
    loadMasterOptions('Community'),
    loadMasterOptions('BloodGroup'),
    loadEduOptions('Bank'),
    loadEduOptions('Course'),
    loadEduOptions('Degree'),
    loadEduOptions('Major'),
    loadEduOptions('University'),
    loadEduOptions('Course Type'),
    loadEduOptions('Dental Council'),
    loadEduOptions('Experience Type'),
    loadEduOptions('Experience Institution'),
    loadEduOptions('Languages Known'),
    Promise.all(EC_ACTIVITY_GROUPS.map(async (g) => ({
      key: g.key,
      label: g.label,
      items: await loadEduOptions(g.category),
    }))),
  ]);

  return {
    categories: categories.map((r) => ({ id: String(r.id), name: r.category_name })),
    departments: departments.map((r) => ({ id: String(r.id), name: r.name })),
    levels: levels.map((r) => r.course_name),
    attendanceTypes: attendanceTypes.map((r) => ({
      id: String(r.id),
      label: `${r.staff_category} (${String(r.morning_in).slice(0, 5)}-${String(r.evening_in).slice(0, 5)})`,
    })),
    payrollTypes: payrollTypes.map((r) => ({
      id: String(r.id),
      name: r.payroll_type,
    })),
    titles: titles.map((r) => r.name),
    religions,
    communities,
    bloodGroups,
    banks,
    education: {
      courses,
      degrees,
      majors,
      universities,
      courseTypes,
      regCouncils,
    },
    experience: {
      experienceTypes,
      institutionTypes,
    },
    languages,
    activityGroups: activityOptions,
    states: [
      'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
      'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Delhi', 'Goa',
      'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
      'Kerala', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
      'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    ],
  };
}

function staffKey(staffRowId) {
  return String(parseId(staffRowId, 'staff id'));
}

function docUrl(staffCode, filename) {
  if (!filename) return null;
  const name = String(filename).trim();
  if (!name) return null;
  if (name.includes('/')) {
    return legacyPublicFileUrl(`staff_documents/${name}`);
  }
  return legacyPublicFileUrl(`staff_documents/${staffCode}/${name}`);
}

export async function loadProfileRecords(staffRowId, staffCode = '') {
  const sid = staffKey(staffRowId);
  const code = String(staffCode || '').trim();

  const [education, experience, awards, activities] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, course_name, degree_name, major_name, course_type, yop, precentage,
        institution, university, regi_no, CAST(regi_date AS CHAR) AS regi_date,
        reg_council, attempt, attachment
       FROM staff_education_tb
       WHERE del = 1 AND staff_id = '${escapeSql(sid)}'
       ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, institution_type, institution, location, experience_type,
        CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date,
        description, total_experience, attachment
       FROM staff_experience_tb
       WHERE del = 1 AND staff_id = '${escapeSql(sid)}'
       ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, award_year, award_title, award_notes
       FROM staff_award_tb
       WHERE del = 1 AND staff_id = '${escapeSql(sid)}'
       ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, category, activity_name, activity_type
       FROM staff_ecurricular_tb
       WHERE del = 1 AND staff_id = '${escapeSql(sid)}'`,
    ),
  ]);

  const activityMap = {};
  EC_ACTIVITY_GROUPS.forEach((g) => {
    activityMap[g.key] = [];
  });

  activities.forEach((row) => {
    const key = String(row.category || '');
    if (!activityMap[key]) activityMap[key] = [];
    const subTypes = String(row.activity_type || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    activityMap[key].push({
      recordId: Number(row.id),
      activityId: String(row.activity_name),
      activityTypes: subTypes,
    });
  });

  return {
    education: education.map((r) => ({
      id: Number(r.id),
      courseId: String(r.course_name || ''),
      degreeId: String(r.degree_name || ''),
      majorId: String(r.major_name || ''),
      courseTypeId: String(r.course_type || ''),
      yop: r.yop || '',
      percentage: r.precentage || '',
      institution: r.institution || '',
      universityId: String(r.university || ''),
      regNo: r.regi_no || '',
      regDate: normalizeDate(r.regi_date),
      regCouncilId: String(r.reg_council || ''),
      attempt: r.attempt != null ? String(r.attempt) : '1',
      attachment: r.attachment || '',
      attachmentUrl: docUrl(code, r.attachment),
    })),
    experience: experience.map((r) => ({
      id: Number(r.id),
      institutionTypeId: String(r.institution_type || ''),
      institution: r.institution || '',
      location: r.location || '',
      experienceTypeId: String(r.experience_type || ''),
      fromDate: normalizeDate(r.from_date),
      toDate: normalizeDate(r.to_date),
      description: r.description || '',
      totalExperience: r.total_experience || '',
      attachment: r.attachment || '',
      attachmentUrl: docUrl(code, r.attachment),
    })),
    awards: awards.map((r) => ({
      id: Number(r.id),
      year: r.award_year != null ? String(r.award_year) : '',
      title: r.award_title || '',
      notes: r.award_notes || '',
    })),
    activities: activityMap,
  };
}

async function softDeleteEducation(staffRowId) {
  await prisma.$executeRawUnsafe(
    `UPDATE staff_education_tb SET del = 0 WHERE staff_id = '${escapeSql(staffKey(staffRowId))}'`,
  );
}

async function softDeleteExperience(staffRowId) {
  await prisma.$executeRawUnsafe(
    `UPDATE staff_experience_tb SET del = 0 WHERE staff_id = '${escapeSql(staffKey(staffRowId))}'`,
  );
}

async function softDeleteAwards(staffRowId) {
  await prisma.$executeRawUnsafe(
    `UPDATE staff_award_tb SET del = 0 WHERE staff_id = '${escapeSql(staffKey(staffRowId))}'`,
  );
}

async function softDeleteActivities(staffRowId) {
  await prisma.$executeRawUnsafe(
    `UPDATE staff_ecurricular_tb SET del = 0 WHERE staff_id = '${escapeSql(staffKey(staffRowId))}'`,
  );
}

export async function saveProfileRecords(staffRowId, body, meta) {
  const sid = parseId(staffRowId, 'staff id');
  const staffIdStr = staffKey(sid);
  const ip = escapeSql(meta.ip || '');
  const user = escapeSql(meta.username || '');

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
  );
  if (!existing.length) return { error: 'Staff not found' };

  if (Array.isArray(body.education)) {
    await softDeleteEducation(sid);
    for (const row of body.education) {
      if (!row.degreeId && !row.courseId && !row.institution) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO staff_education_tb
          (staff_id, course_name, degree_name, major_name, course_type, yop, precentage,
           institution, university, regi_no, regi_date, reg_council, attempt, attachment,
           created_dt, created_ip, created_by, del)
         VALUES (
           '${staffIdStr}',
           '${escapeSql(row.courseId)}',
           '${escapeSql(row.degreeId)}',
           '${escapeSql(row.majorId)}',
           '${escapeSql(row.courseTypeId)}',
           '${escapeSql(row.yop)}',
           '${escapeSql(row.percentage)}',
           '${escapeSql(row.institution)}',
           '${escapeSql(row.universityId)}',
           '${escapeSql(row.regNo)}',
           '${sqlDateOrNull(row.regDate)}',
           '${escapeSql(row.regCouncilId)}',
           ${Number(row.attempt) || 1},
           '${escapeSql(row.attachment)}',
           NOW(), '${ip}', '${user}', 1)`,
      );
    }
  }

  if (Array.isArray(body.experience)) {
    await softDeleteExperience(sid);
    for (const row of body.experience) {
      if (!row.institution && !row.location) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO staff_experience_tb
          (staff_id, institution_type, institution, location, experience_type,
           from_date, to_date, description, total_experience, attachment,
           created_dt, created_ip, created_by, del)
         VALUES (
           '${staffIdStr}',
           '${escapeSql(row.institutionTypeId)}',
           '${escapeSql(row.institution)}',
           '${escapeSql(row.location)}',
           '${escapeSql(row.experienceTypeId)}',
           '${sqlDateOrNull(row.fromDate)}',
           '${sqlDateOrNull(row.toDate)}',
           '${escapeSql(row.description)}',
           '${escapeSql(row.totalExperience)}',
           '${escapeSql(row.attachment)}',
           NOW(), '${ip}', '${user}', 1)`,
      );
    }
  }

  if (Array.isArray(body.awards)) {
    await softDeleteAwards(sid);
    for (const row of body.awards) {
      if (!row.year && !row.title && !row.notes) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO staff_award_tb
          (staff_id, award_year, award_title, award_notes, created_dt, created_ip, created_by, del)
         VALUES (
           '${staffIdStr}',
           ${Number(row.year) || 0},
           '${escapeSql(row.title)}',
           '${escapeSql(row.notes)}',
           NOW(), '${ip}', '${user}', 1)`,
      );
    }
  }

  if (body.activities && typeof body.activities === 'object') {
    await softDeleteActivities(sid);
    for (const [categoryKey, items] of Object.entries(body.activities)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item.activityId) continue;
        const activityType = Array.isArray(item.activityTypes)
          ? item.activityTypes.filter(Boolean).join(',')
          : String(item.activityTypes || '');
        await prisma.$executeRawUnsafe(
          `INSERT INTO staff_ecurricular_tb
            (staff_id, category, activity_name, activity_type, created_dt, created_ip, created_by, del)
           VALUES (
             '${staffIdStr}',
             '${escapeSql(categoryKey)}',
             '${escapeSql(item.activityId)}',
             '${escapeSql(activityType)}',
             NOW(), '${ip}', '${user}', 1)`,
        );
      }
    }
  }

  if (Array.isArray(body.languageIds)) {
    const lang = body.languageIds.map(String).filter(Boolean).join(',');
    await prisma.$executeRawUnsafe(
      `UPDATE staff_profile_tb SET language_known='${escapeSql(lang)}',
        updated_dt=NOW(), updated_ip='${ip}', updated_by='${user}'
       WHERE id = ${sid}`,
    );
  }

  await insertLog(
    ['staff_profile_edit', 'Records', 'Successful', `id=${sid}`, new Date(), meta.ip, '', meta.username],
    '',
  );

  return { success: true };
}
