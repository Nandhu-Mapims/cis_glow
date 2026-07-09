import { buildExamDashboardHtml } from './examDashboardCore.js';

const CACHE_MS = 600_000;

let dashboardCache = null;
let dashboardCacheAt = 0;
let dashboardInflight = null;

/** Legacy: exam_dashboard.php */
export async function loadExamDashboard(_memberId, { refresh = false } = {}) {
  if (!refresh && dashboardCache && Date.now() - dashboardCacheAt < CACHE_MS) {
    return dashboardCache;
  }

  if (!refresh && dashboardInflight) {
    return dashboardInflight;
  }

  dashboardInflight = (async () => {
    try {
      const [{ loadAttendanceBannerUrl }, html] = await Promise.all([
        import('../attendance/studentAttendanceShared.js'),
        buildExamDashboardHtml(),
      ]);
      const bannerUrl = await loadAttendanceBannerUrl();
      const result = html
        ? {
          html,
          bannerUrl,
          printMeta: {
            title: 'Exam Report',
            subtitleLine1: '',
            dateRange: new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
          },
        }
        : { error: 'No active exam data found' };
      dashboardCache = result;
      dashboardCacheAt = Date.now();
      return result;
    } catch (err) {
      console.error('exam dashboard', err);
      return { error: err.message || 'Unable to build exam dashboard' };
    } finally {
      dashboardInflight = null;
    }
  })();

  return dashboardInflight;
}

export function clearExamDashboardCache() {
  dashboardCache = null;
  dashboardCacheAt = 0;
}
