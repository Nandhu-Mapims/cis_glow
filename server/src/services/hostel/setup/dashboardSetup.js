import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logHostelSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'dashboard_hostel.php';

export async function loadHostelDashboard(memberId, fields = {}, audit = {}) {
  const dateIso = toIsoDate(fields.date) || new Date().toISOString().slice(0, 10);

  const [blocksRows, roomsRows, studentsRows, pendingRows, attRows] = await Promise.all([
    prisma.$queryRawUnsafe('SELECT COUNT(*) AS cnt FROM hostel_blocks_tb WHERE del = 1'),
    prisma.$queryRawUnsafe('SELECT COUNT(*) AS cnt FROM hostel_rooms_tb WHERE del = 1 AND is_active = 1'),
    prisma.$queryRawUnsafe('SELECT COUNT(*) AS cnt FROM student_hostel_tb WHERE del = 1 AND hostel_discontinue = 0'),
    prisma.$queryRawUnsafe('SELECT COUNT(*) AS cnt FROM hostel_pass_request WHERE del = 1 AND status = 0'),
    prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT tktno) AS visitors FROM hostel_att WHERE DATE(p_date) = '${escapeSql(dateIso)}'`,
    ),
  ]);

  await logHostelSetup(PAGE, 'View', 'Successful', dateIso, memberId, audit);
  return {
    date: dateIso,
    stats: {
      blocks: Number(blocksRows[0]?.cnt || 0),
      rooms: Number(roomsRows[0]?.cnt || 0),
      activeStudents: Number(studentsRows[0]?.cnt || 0),
      pendingPasses: Number(pendingRows[0]?.cnt || 0),
      visitorsToday: Number(attRows[0]?.visitors || 0),
    },
  };
}

export async function saveHostelDashboard(payload, memberId, audit = {}) {
  return loadHostelDashboard(memberId, payload, audit);
}
