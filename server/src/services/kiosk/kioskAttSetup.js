import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { KIOSK_MENU_CATEGORIES, KIOSK_MENU_ACCESS_CATEGORIES } from './kioskShared.js';

const MENU_PAGE = 'att_menu.php';
const ACCESS_PAGE = 'att_menu_access.php';

function mapMenuRow(row) {
  return {
    rowId: row.id,
    enable: row.m_enable === 1,
    order: row.m_order,
    title: row.m_title || '',
    url: row.m_url || '',
    icon: row.m_icon || '',
    backBg: row.back_bg || '',
    backColor: row.back_color || '',
    foreBg: row.fore_bg || '',
    foreColor: row.fore_color || '',
  };
}

export async function loadKioskAttMenu(memberId, fields = {}, audit = {}) {
  const menuCategory = fields.menuCategory || '';
  let rows = [];
  if (menuCategory) {
    rows = await prisma.$queryRawUnsafe(`
      SELECT id, m_enable, m_order, m_title, m_url, m_icon, back_bg, back_color, fore_bg, fore_color
      FROM att_menu_tb WHERE del=1 AND m_type='${escapeSql(menuCategory)}' ORDER BY m_order ASC
    `);
  }
  await logModulePage(MENU_PAGE, 'View', 'Successful', menuCategory, memberId, audit);
  return {
    success: true,
    categories: KIOSK_MENU_CATEGORIES,
    menuCategory,
    rows: rows.map(mapMenuRow),
  };
}

export async function saveKioskAttMenu(payload, memberId, audit = {}) {
  const menuCategory = String(payload.menuCategory || '').trim();
  if (!menuCategory) return { success: false, message: 'Select a category.' };
  const { create, update } = auditFields(memberId, audit);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  for (const row of rows) {
    const data = {
      m_type: menuCategory,
      m_title: escapeSql(row.title || ''),
      m_url: escapeSql(row.url || ''),
      m_icon: escapeSql(row.icon || ''),
      m_enable: row.enable === false ? 0 : 1,
      m_order: Number(row.order) || 0,
      back_bg: escapeSql(row.backBg || ''),
      back_color: escapeSql(row.backColor || ''),
      fore_bg: escapeSql(row.foreBg || ''),
      fore_color: escapeSql(row.foreColor || ''),
    };
    if (row.rowId) {
      await prisma.$executeRawUnsafe(`
        UPDATE att_menu_tb SET
          m_type='${escapeSql(menuCategory)}', m_title='${data.m_title}', m_url='${data.m_url}',
          m_icon='${data.m_icon}', m_enable=${data.m_enable}, m_order=${data.m_order},
          back_bg='${data.back_bg}', back_color='${data.back_color}',
          fore_bg='${data.fore_bg}', fore_color='${data.fore_color}',
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${Number(row.rowId)}
      `);
    } else if (row.title) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO att_menu_tb
          (m_type, m_title, m_url, m_icon, m_enable, m_order, back_bg, back_color, fore_bg, fore_color,
           created_dt, created_ip, created_by, del)
        VALUES ('${escapeSql(menuCategory)}', '${data.m_title}', '${data.m_url}', '${data.m_icon}',
          ${data.m_enable}, ${data.m_order}, '${data.back_bg}', '${data.back_color}',
          '${data.fore_bg}', '${data.fore_color}', NOW(), '${escapeSql(create.created_ip)}',
          '${escapeSql(memberId)}', 1)
      `);
    }
  }

  if (payload.action === 'delete' && payload.rowId) {
    await prisma.$executeRawUnsafe(`UPDATE att_menu_tb SET del=0, updated_dt=NOW() WHERE id=${Number(payload.rowId)}`);
  }

  await logModulePage(MENU_PAGE, 'Update', 'Successful', menuCategory, memberId, audit);
  return { success: true, message: 'Menu saved.', ...(await loadKioskAttMenu(memberId, { menuCategory }, { ...audit, skipLog: true })) };
}

export async function loadKioskAttMenuAccess(memberId, fields = {}, audit = {}) {
  const menuCategory = fields.menuCategory || '';
  let staffList = '';
  if (menuCategory) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT staff_list FROM att_menu_access WHERE menu_cat='${escapeSql(menuCategory)}' AND del=1 LIMIT 1
    `);
    staffList = rows[0]?.staff_list || '';
  }
  await logModulePage(ACCESS_PAGE, 'View', 'Successful', menuCategory, memberId, audit);
  return {
    success: true,
    categories: KIOSK_MENU_ACCESS_CATEGORIES,
    menuCategory,
    staffList,
  };
}

export async function saveKioskAttMenuAccess(payload, memberId, audit = {}) {
  const menuCategory = String(payload.menuCategory || '').trim();
  if (!menuCategory) return { success: false, message: 'Select a category.' };
  const { create, update } = auditFields(memberId, audit);
  const staffList = escapeSql(payload.staffList || '');
  const existing = await prisma.$queryRawUnsafe(`
    SELECT id FROM att_menu_access WHERE menu_cat='${escapeSql(menuCategory)}' LIMIT 1
  `);
  if (existing[0]?.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE att_menu_access SET staff_list='${staffList}', del=1,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${existing[0].id}
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO att_menu_access (menu_cat, staff_list, created_dt, created_ip, created_by, del)
      VALUES ('${escapeSql(menuCategory)}', '${staffList}', NOW(),
        '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
  }
  await logModulePage(ACCESS_PAGE, 'Update', 'Successful', menuCategory, memberId, audit);
  return { success: true, message: 'Menu access saved.', ...(await loadKioskAttMenuAccess(memberId, { menuCategory }, { ...audit, skipLog: true })) };
}

const INSTRUCTION_PAGE = 'att_instruction.php';

export async function loadKioskAttInstruction(memberId, _fields, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT page_title, page_content FROM pages_tb WHERE id=2 LIMIT 1
  `);
  await logModulePage(INSTRUCTION_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    form: {
      title: rows[0]?.page_title || '',
      content: rows[0]?.page_content || '',
    },
  };
}

export async function saveKioskAttInstruction(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE pages_tb SET
      page_title='${escapeSql(payload.title || '')}',
      page_content='${escapeSql(payload.content || '')}',
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=2
  `);
  await logModulePage(INSTRUCTION_PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Instruction updated.', ...(await loadKioskAttInstruction(memberId, {}, { ...audit, skipLog: true })) };
}
