import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { ATT_STATEMENT_OPTIONS, loadJobCategories, randomPin } from './kioskShared.js';

const STAFF_RESET_PAGE = 'staff_mpassword_reset.php';
const STUDENT_RESET_PAGE = 'student_mpassword_reset.php';
const STMT_PAGE = 'm_att_statement.php';

export async function loadKioskPinReset(memberId, fields = {}, audit = {}) {
  const type = fields.type === 'staff' ? 'staff' : 'student';
  const categories = type === 'staff' ? await loadJobCategories() : [];
  await logModulePage(type === 'staff' ? STAFF_RESET_PAGE : STUDENT_RESET_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    type,
    categories: [{ id: 'All', name: 'All' }, ...categories],
    searchBy: fields.searchBy || 'category',
    searchInput: fields.searchInput || '',
    searchCategory: fields.searchCategory || '',
  };
}

export async function saveKioskPinReset(payload, memberId, audit = {}) {
  const type = payload.type === 'staff' ? 'staff' : 'student';
  const page = type === 'staff' ? STAFF_RESET_PAGE : STUDENT_RESET_PAGE;
  const { update } = auditFields(memberId, audit);
  let updated = 0;

  if (payload.searchBy === 'roll_no') {
    const ids = String(payload.searchInput || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const code of ids) {
      const pin = randomPin(4);
      if (type === 'staff') {
        const r = await prisma.$executeRawUnsafe(`
          UPDATE staff_profile_tb SET a_pin='${escapeSql(pin)}',
            updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
          WHERE del=1 AND staff_id='${escapeSql(code)}'
            AND (releaving_date='0000-00-00' OR releaving_date>DATE(NOW()))
        `);
        updated += r;
      } else {
        await prisma.$executeRawUnsafe(`
          UPDATE student_profile_tb SET a_pin='${escapeSql(pin)}',
            updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
          WHERE del=1 AND register_no='${escapeSql(code)}'
        `);
        updated += 1;
      }
    }
  } else {
    const cat = payload.searchCategory;
    const pin = randomPin(4);
    if (type === 'staff') {
      const where = cat && cat !== 'All' ? `AND job_category='${escapeSql(String(cat))}'` : '';
      await prisma.$executeRawUnsafe(`
        UPDATE staff_profile_tb SET a_pin='${escapeSql(pin)}',
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE del=1 ${where}
          AND (releaving_date='0000-00-00' OR releaving_date>DATE(NOW()))
      `);
      updated = 1;
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE student_profile_tb SET a_pin='${escapeSql(pin)}',
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE del=1
      `);
      updated = 1;
    }
  }

  await logModulePage(page, 'Reset', 'Successful', String(updated), memberId, audit);
  return { success: true, message: 'PINs regenerated.' };
}

export async function loadKioskAttStatement(memberId, fields = {}, audit = {}) {
  const staffCategory = fields.staffCategory ? String(fields.staffCategory) : '';
  const categories = await loadJobCategories();
  const options = [];
  if (staffCategory) {
    for (const opt of ATT_STATEMENT_OPTIONS) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT id, a_status FROM att_statement
        WHERE del=1 AND staff_cat='${escapeSql(staffCategory)}' AND stmt_option='${escapeSql(opt.key)}' LIMIT 1
      `);
      options.push({
        rowId: rows[0]?.id || null,
        key: opt.key,
        label: opt.label,
        enabled: Number(rows[0]?.a_status) === 1,
      });
    }
  }
  await logModulePage(STMT_PAGE, 'View', 'Successful', staffCategory, memberId, audit);
  return { success: true, categories, staffCategory, options };
}

export async function saveKioskAttStatement(payload, memberId, audit = {}) {
  const staffCategory = String(payload.staffCategory || '').trim();
  if (!staffCategory) return { success: false, message: 'Select a category.' };
  const { create, update } = auditFields(memberId, audit);
  const options = Array.isArray(payload.options) ? payload.options : [];

  await prisma.$executeRawUnsafe(`
    UPDATE att_statement SET del=0,
      updated_dt=NOW(),
      updated_ip='${escapeSql(update.updated_ip)}',
      updated_by='${escapeSql(memberId)}'
    WHERE staff_cat='${escapeSql(staffCategory)}' AND del=1
  `);

  for (const opt of options) {
    if (!opt.enabled) continue;
    if (opt.rowId) {
      await prisma.$executeRawUnsafe(`
        UPDATE att_statement SET del=1, a_status=1, stmt_option='${escapeSql(opt.key)}',
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${Number(opt.rowId)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO att_statement (
          staff_cat, stmt_option, a_status,
          created_dt, created_ip, created_by,
          updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(staffCategory)}', '${escapeSql(opt.key)}', 1,
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    }
  }

  await logModulePage(STMT_PAGE, 'Update', 'Successful', staffCategory, memberId, audit);
  return { success: true, message: 'Statement options saved.', ...(await loadKioskAttStatement(memberId, { staffCategory }, { ...audit, skipLog: true })) };
}
