import { prisma } from '../../config/prisma.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGES = {
  student: 'student_machine_password.php',
  staff: 'staff_machine_password.php',
};

export async function loadMachinePassword(memberId, fields = {}, audit = {}) {
  const type = fields.type === 'staff' ? 'staff' : 'student';
  const page = PAGES[type];
  const search = String(fields.search || '').trim();

  let rows = [];
  if (type === 'student') {
    rows = await prisma.$queryRaw`
      SELECT A.id, A.student_name AS name, A.register_no AS code, A.a_pin AS password
      FROM student_profile_tb AS A
      WHERE A.del = 1
        AND (${search} = '' OR A.register_no LIKE CONCAT('%', ${search}, '%') OR A.student_name LIKE CONCAT('%', ${search}, '%'))
      ORDER BY A.register_no ASC
      LIMIT 100
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT A.id, A.staff_name AS name, A.staff_id AS code, A.a_pin AS password
      FROM staff_profile_tb AS A
      WHERE A.del = 1
        AND (${search} = '' OR A.staff_id LIKE CONCAT('%', ${search}, '%') OR A.staff_name LIKE CONCAT('%', ${search}, '%'))
      ORDER BY A.staff_id ASC
      LIMIT 100
    `;
  }

  await logModulePage(page, 'View', 'Successful', search, memberId, audit);
  return {
    type,
    search,
    entries: rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      code: r.code,
      password: r.password || '',
    })),
  };
}

export async function saveMachinePassword(payload, memberId, audit = {}) {
  const type = payload.type === 'staff' ? 'staff' : 'student';
  const page = PAGES[type];
  const password = String(payload.password || '').trim();
  const id = Number(payload.id);
  if (!id || !password) return { success: false, message: 'Record and PIN are required' };

  if (type === 'student') {
    await prisma.$executeRaw`UPDATE student_profile_tb SET a_pin = ${password} WHERE id = ${id}`;
  } else {
    await prisma.$executeRaw`UPDATE staff_profile_tb SET a_pin = ${password} WHERE id = ${id}`;
  }

  await logModulePage(page, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Machine PIN updated...',
    ...(await loadMachinePassword(memberId, { type, search: payload.search }, { ...audit, skipLog: true })),
  };
}
