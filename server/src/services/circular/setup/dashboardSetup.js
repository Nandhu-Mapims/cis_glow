import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { countCircular, fetchCircularList } from '../circularShared.js';
import { logCircularSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'circular_dashboard.php';

export async function loadCircularDashboard(memberId, fields = {}, audit = {}) {
  const dateIso = toIsoDate(fields.date) || new Date().toISOString().slice(0, 10);

  const [total, pending, approved, today, recent] = await Promise.all([
    countCircular('del = 1'),
    countCircular('del = 1 AND c_status = 0'),
    countCircular('del = 1 AND c_status = 1'),
    prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM circular_tb WHERE del = 1 AND DATE(c_date) = '${escapeSql(dateIso)}'`,
    ),
    fetchCircularList({ limit: 10 }),
  ]);

  await logCircularSetup(PAGE, 'View', 'Successful', dateIso, memberId, audit);
  return {
    date: dateIso,
    stats: {
      total,
      pending,
      approved,
      today: Number(today[0]?.cnt || 0),
    },
    recent: recent.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      status: r.status,
      audienceFor: r.audienceFor,
    })),
  };
}

export async function saveCircularDashboard(payload, memberId, audit = {}) {
  return loadCircularDashboard(memberId, payload, audit);
}
