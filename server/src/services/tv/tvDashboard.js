import { prisma } from '../../config/prisma.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'tv/dashboard.php';

export async function loadTvDashboard(memberId, audit = {}) {
  const widgets = await prisma.tv_setup_tb.count({ where: { del: 1 } });
  const videoRows = await prisma.$queryRawUnsafe('SELECT COUNT(*) AS c FROM tv_video_tb WHERE del=1');
  const videos = Number(videoRows[0]?.c || 0);
  const access = await prisma.tv_access_tb.count({ where: { del: 1 } });
  const recentLogs = await prisma.tv_log_tb.findMany({
    where: { del: 1 },
    orderBy: { id: 'desc' },
    take: 10,
  });

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    summary: { widgets, videos, access },
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      page: l.log_page,
      operation: l.log_operation,
      status: l.log_status,
      description: l.log_description,
      username: l.log_username,
      timestamp: l.log_timestamp,
    })),
  };
}
