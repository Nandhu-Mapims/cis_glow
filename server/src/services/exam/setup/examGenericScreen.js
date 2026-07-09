import { prisma } from '../../../config/prisma.js';

const SCREEN_TABLE_MAP = {
  'exam-nodue': 'cia_exam_nodue',
  'exam-examiners': 'cia_schedule_tb',
  'exam-attendance-certificate': 'cia_batch_tb',
  'examiner-setup': 'cia_schedule_tb',
  'camp-activity-add': 'cia_exam_name',
  'camp-activity-edit': 'cia_exam_name',
  'camp-activity-type': 'subject_master',
  'attendance-entry': 'cia_marks_tb',
  'attendance-report': 'cia_marks_tb',
  'sheets-upload': 'cia_omr_sheet_tb',
  'sheets-status': 'cia_omr_sheet_tb',
  'mark-sheet-status': 'cia_omr_sheet_tb',
  'mark-sheet-received': 'cia_omr_sheet_tb',
  'exam-sms': 'cia_setup',
  'report-analysis-v1': 'cia_marks_tb',
};

const EDITABLE_GENERIC_SCREENS = new Set([
  'exam-sms',
  'camp-activity-type',
  'camp-activity-add',
  'camp-activity-edit',
]);

function safeText(value) {
  if (value == null) return '';
  return String(value);
}

function safeDate(value) {
  const text = safeText(value);
  if (!text || text.startsWith('0000-00-00')) return '';
  return text.slice(0, 10);
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    tableName,
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?`,
    tableName,
  );
  return new Set(rows.map((row) => String(row.column_name)));
}

export async function loadExamGenericScreen(screen, fields = {}, memberId = 'SYSTEM') {
  const tableName = SCREEN_TABLE_MAP[screen] || 'cia_setup';
  const exists = await tableExists(tableName);
  const filters = {
    academicYear: safeText(fields.academicYear || ''),
    academicType: safeText(fields.academicType || ''),
  };

  if (!exists) {
    return {
      screen,
      memberId,
      tableName,
      editable: EDITABLE_GENERIC_SCREENS.has(screen),
      filters,
      summary: { total: 0, active: 0, deleted: 0 },
      rows: [],
      warning: `Reference table ${tableName} is not available in this schema.`,
    };
  }

  const columns = await getTableColumns(tableName);
  const hasColumn = (name) => columns.has(name);

  const whereParts = ['1=1'];
  const params = [];

  if (filters.academicYear && hasColumn('academic_year')) {
    whereParts.push('(CAST(academic_year AS CHAR) = ?)');
    params.push(filters.academicYear);
  }
  if (filters.academicType && hasColumn('academic_type')) {
    whereParts.push('(CAST(academic_type AS CHAR) = ?)');
    params.push(filters.academicType);
  }
  const whereSql = whereParts.join(' AND ');
  const delExpr = hasColumn('del') ? 'COALESCE(del, 1)' : '1';
  const idExpr = hasColumn('id') ? 'CAST(id AS CHAR)' : "''";
  const nameExpr = hasColumn('exam_name')
    ? 'CAST(exam_name AS CHAR)'
    : hasColumn('subject_id')
      ? 'CAST(subject_id AS CHAR)'
      : hasColumn('category_name')
        ? 'CAST(category_name AS CHAR)'
        : hasColumn('course_name')
          ? 'CAST(course_name AS CHAR)'
          : "''";
  const ayExpr = hasColumn('academic_year') ? 'CAST(academic_year AS CHAR)' : "''";
  const atExpr = hasColumn('academic_type') ? 'CAST(academic_type AS CHAR)' : "''";
  const createdExpr = hasColumn('created_dt')
    ? "IF(CAST(created_dt AS CHAR) LIKE '0000-00-00%', '', CAST(created_dt AS CHAR))"
    : hasColumn('created_date')
      ? "IF(CAST(created_date AS CHAR) LIKE '0000-00-00%', '', CAST(created_date AS CHAR))"
      : hasColumn('exam_date')
        ? "IF(CAST(exam_date AS CHAR) LIKE '0000-00-00%', '', CAST(exam_date AS CHAR))"
        : "''";
  const updatedExpr = hasColumn('updated_dt')
    ? "IF(CAST(updated_dt AS CHAR) LIKE '0000-00-00%', '', CAST(updated_dt AS CHAR))"
    : hasColumn('updated_date')
      ? "IF(CAST(updated_date AS CHAR) LIKE '0000-00-00%', '', CAST(updated_date AS CHAR))"
      : "''";

  const countRows = await prisma.$queryRawUnsafe(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN ${delExpr} = 1 THEN 1 ELSE 0 END) AS active
     FROM ${tableName}
     WHERE ${whereSql}`,
    ...params,
  );
  const total = Number(countRows?.[0]?.total || 0);
  const active = Number(countRows?.[0]?.active || 0);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       ${idExpr} AS id,
       ${nameExpr} AS name,
       ${ayExpr} AS academicYear,
       ${atExpr} AS academicType,
       ${delExpr} AS delValue,
       ${createdExpr} AS createdDate,
       ${updatedExpr} AS updatedDate
     FROM ${tableName}
     WHERE ${whereSql}
     ORDER BY ${hasColumn('id') ? 'id DESC' : '1'}
     LIMIT 25`,
    ...params,
  );

  const normalizedRows = rows.map((row) => ({
    id: row.id ?? '',
    name: safeText(row.name) || `Row ${row.id ?? ''}`,
    academicYear: safeText(row.academicYear),
    academicType: safeText(row.academicType),
    status: Number(row.delValue ?? 1) === 1 ? 'Active' : 'Deleted',
    createdDate: safeDate(row.createdDate),
    updatedDate: safeDate(row.updatedDate),
  }));

  return {
    screen,
    memberId,
    tableName,
    editable: EDITABLE_GENERIC_SCREENS.has(screen),
    filters,
    summary: {
      total,
      active,
      deleted: Math.max(0, total - active),
    },
    rows: normalizedRows,
  };
}

export async function saveExamGenericScreen(screen, fields = {}, memberId = 'SYSTEM') {
  const editable = EDITABLE_GENERIC_SCREENS.has(screen);
  if (!editable) {
    return { success: false, message: 'This screen is read-only in modern module.' };
  }

  return {
    success: true,
    message: 'Configuration captured. Operational updates remain managed by existing exam workflows.',
    screen,
    memberId,
    payload: {
      note: safeText(fields.note || ''),
      enabled: fields.enabled === false ? 0 : 1,
    },
  };
}
