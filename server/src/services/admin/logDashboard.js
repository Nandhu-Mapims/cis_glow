import { loadLogDashboardData } from './logDashboardService.js';
import { loadLogDetailsData } from './logDetailsService.js';

export async function loadLogDashboard(memberId, fields = {}, audit = {}) {
  return loadLogDashboardData(memberId, fields || {}, audit);
}

export async function loadLogDetails(memberId, fields = {}, audit = {}) {
  return loadLogDetailsData(memberId, fields || {}, audit);
}
