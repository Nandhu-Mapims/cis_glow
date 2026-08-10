import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { isGlobalAccessType } from '../utils/accessType.js';

function normalizeLegacyPath(legacyLink) {
  return String(legacyLink || '').replace(/^\//, '').trim().split('?')[0];
}

const MENU_LABEL_OVERRIDES = {
  'class_time_table_v3.php': 'Report (New)',
  'tt_config_v3.php': 'Config (New)',
};

/** Explicit submenu order when legacy rows share the same main/sub menu order. */
const SUB_MENU_LINK_ORDER = {
  'student_portfolio_dashboard.php': 1,
  'student_portfolia_individual_report.php': 2,
  'student_portfolia_individual_report_v1.php': 2,
};

function compareMenuItems(a, b) {
  const linkA = normalizeLegacyPath(a.sub_menu_link);
  const linkB = normalizeLegacyPath(b.sub_menu_link);
  const rankA = SUB_MENU_LINK_ORDER[linkA];
  const rankB = SUB_MENU_LINK_ORDER[linkB];
  if (rankA != null && rankB != null && rankA !== rankB) return rankA - rankB;
  if (a.main_menu_order !== b.main_menu_order) return a.main_menu_order - b.main_menu_order;
  if (a.sub_menu_order !== b.sub_menu_order) return a.sub_menu_order - b.sub_menu_order;
  return Number(a.id) - Number(b.id);
}

function resolveMenuLabel(legacyLink, defaultName) {
  const key = normalizeLegacyPath(legacyLink);
  return MENU_LABEL_OVERRIDES[key] || defaultName;
}

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const accessType = req.user.accessType;
    const isGlobal = isGlobalAccessType(accessType);

    const categories = await prisma.admin_menu_category_tb.findMany({
      where: { del: 1 },
      orderBy: { category_order: 'asc' },
      select: {
        id: true,
        category_name: true,
        menu_icon: true,
        category_order: true,
      },
    });

    const authRows = isGlobal
      ? []
      : await prisma.authentication_tb.findMany({
          where: { user_id: userId, del: 1, authentication: 1 },
          select: { menu_id: true },
        });

    const allowedMenuIds = new Set(authRows.map((row) => row.menu_id));

    // Avoid Prisma P2020 on legacy zero-date timestamp columns (created_dt / updated_dt).
    const menuItems = await prisma.$queryRaw`
      SELECT id, category_id, menu_icon, main_menu_name, main_menu_order,
             sub_menu_name, sub_menu_link, sub_menu_order, menu_enable
      FROM basic_admin_menu_tb
      WHERE del = 1 AND menu_enable = 1
      ORDER BY main_menu_order ASC, sub_menu_order ASC
    `;

    const menuTree = categories.map((category) => {
      const categoryMenus = menuItems
        .filter((item) => item.category_id === category.id)
        .sort(compareMenuItems);
      const mainMenuNames = [...new Set(categoryMenus.map((item) => item.main_menu_name))];

      const mainMenus = mainMenuNames.map((mainMenuName) => {
        const subMenus = categoryMenus
          .filter((item) => item.main_menu_name === mainMenuName)
          .filter((item) => isGlobal || allowedMenuIds.has(item.id))
          .map((item) => {
            const link = String(item.sub_menu_link || '').trim();
            const defaultName = item.sub_menu_name || mainMenuName;
            return {
              id: item.id,
              name: resolveMenuLabel(link, defaultName),
              link,
              icon: item.menu_icon,
            };
          });

        const firstLink = subMenus.find((s) => s.link && s.link !== '#')?.link || null;
        return {
          name: mainMenuName,
          link: firstLink,
          icon: subMenus[0]?.icon || '',
          subMenus,
        };
      }).filter((menu) => menu.subMenus.length > 0);

      const categoryLink = mainMenus.length === 1 ? mainMenus[0].link : null;

      return {
        id: category.id,
        name: category.category_name,
        icon: category.menu_icon,
        link: categoryLink,
        type: mainMenus.length > 1 ? 'dropdown' : 'link',
        mainMenus,
      };
    }).filter((category) => category.mainMenus.length > 0);

    return res.json({ menu: menuTree });
  } catch (error) {
    console.error('Menu error:', error);
    return res.status(500).json({ message: 'Unable to load menu' });
  }
});

export default router;
