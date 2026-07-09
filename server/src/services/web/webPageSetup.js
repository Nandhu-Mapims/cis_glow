import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { ensureWebPagesTable, listWebPages } from './webDb.js';

const PAGE_TYPES = {
  'about-us': { legacy: 'web_aboutus_v1.php', pageType: 'Page1', title: 'About Us' },
  departments: { legacy: 'web_departments_v1.php', pageType: 'Page2', title: 'Departments' },
  lms: { legacy: 'web_lms_v1.php', pageType: 'Page3', title: 'LMS' },
  journal: { legacy: 'web_journal_v1.php', pageType: 'Page4', title: 'Journal' },
  facilities: { legacy: 'web_facilities_v1.php', pageType: 'Page7', title: 'Facilities' },
  aaadar: { legacy: 'web_aaadar_v1.php', pageType: 'Page7', title: 'AAADAR' },
  research: { legacy: 'web_research_v1.php', pageType: 'Page8', title: 'Research' },
  academic: { legacy: 'web_academic_v1.php', pageType: 'Page9', title: 'Academic' },
  iqac: { legacy: 'web_iqac_v1.php', pageType: 'Page9', title: 'IQAC' },
  outreach: { legacy: 'web_out_reach_v1.php', pageType: 'Page10', title: 'Outreach' },
};

export function getWebScreenMeta(screen) {
  return PAGE_TYPES[screen] || null;
}

function mapPage(row) {
  return {
    id: Number(row.id),
    title: row.page_title,
    order: Number(row.page_order || 0),
    link: row.page_link,
    content: row.page_content || '',
    postOn: row.post_now ? String(row.post_now).slice(0, 10) : '',
    enabled: Number(row.page_enable) === 1,
  };
}

export async function loadWebPageScreen(screen, memberId, fields = {}, audit = {}) {
  const meta = getWebScreenMeta(screen);
  if (!meta) return { error: 'Unknown web screen' };

  await ensureWebPagesTable();
  const pages = (await listWebPages(meta.pageType)).map(mapPage);
  const pageId = Number(fields.pageId || pages[0]?.id || 0);
  const current = pages.find((p) => p.id === pageId) || {
    id: 0,
    title: '',
    order: pages.length + 1,
    link: '',
    content: '',
    postOn: '',
    enabled: true,
  };

  await logModulePage(meta.legacy, 'View', 'Successful', screen, memberId, audit);
  return {
    screenTitle: meta.title,
    pageType: meta.pageType,
    pages: pages.map((p) => ({ id: p.id, title: p.title, order: p.order })),
    pageId: current.id,
    form: current,
  };
}

export async function saveWebPageScreen(screen, payload, memberId, audit = {}) {
  const meta = getWebScreenMeta(screen);
  if (!meta) return { error: 'Unknown web screen' };

  const { create, update } = auditFields(memberId, audit);
  await ensureWebPagesTable();

  if (payload.action === 'delete') {
    await prisma.$executeRaw`
      UPDATE web_pages SET del = 0, updated_by = ${memberId}, updated_ip = ${audit.ip || ''}, updated_dt = NOW()
      WHERE id = ${Number(payload.pageId)}
    `;
    await logModulePage(meta.legacy, 'Delete', 'Successful', String(payload.pageId), memberId, audit);
    return {
      success: true,
      message: 'Page deleted...',
      ...(await loadWebPageScreen(screen, memberId, {}, { ...audit, skipLog: true })),
    };
  }

  const title = String(payload.title || '').trim();
  const content = String(payload.content || '');
  const order = Number(payload.order) || 0;
  const link = String(payload.link || '').trim() || title.toLowerCase().replace(/\s+/g, '-');
  const postOn = payload.postOn ? new Date(payload.postOn) : null;
  const enabled = payload.enabled === false ? 0 : 1;

  if (!title) return { success: false, message: 'Page title is required' };

  if (payload.pageId) {
    await prisma.$executeRaw`
      UPDATE web_pages SET
        page_title = ${title},
        page_order = ${order},
        page_link = ${link},
        page_content = ${content},
        post_now = ${postOn},
        page_enable = ${enabled},
        updated_by = ${memberId},
        updated_ip = ${audit.ip || ''},
        updated_dt = NOW()
      WHERE id = ${Number(payload.pageId)} AND page_type = ${meta.pageType}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO web_pages (page_type, page_title, page_order, page_link, page_content, post_now, page_enable, created_dt, created_ip, created_by, del)
      VALUES (${meta.pageType}, ${title}, ${order}, ${link}, ${content}, ${postOn}, ${enabled}, NOW(), ${audit.ip || ''}, ${memberId}, 1)
    `;
  }

  await logModulePage(meta.legacy, 'Save', 'Successful', title, memberId, audit);
  let reloadPageId = payload.pageId ? Number(payload.pageId) : null;
  if (!reloadPageId) {
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    reloadPageId = Number(idRows[0]?.id) || null;
  }
  return {
    success: true,
    message: 'Page saved...',
    ...(await loadWebPageScreen(screen, memberId, { pageId: reloadPageId }, { ...audit, skipLog: true })),
  };
}
