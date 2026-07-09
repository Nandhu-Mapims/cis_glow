import { prisma } from '../../config/prisma.js';

export async function listUsers({ search = '', page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const where = { del: 1, member_id: { not: 'igrapix' } };
  if (search && String(search).trim()) {
    const term = String(search).trim();
    where.OR = [
      { member_id: { contains: term } },
      { member_name: { contains: term } },
      { address_email: { contains: term } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.web_account_setup.count({ where }),
    prisma.web_account_setup.findMany({
      where,
      orderBy: { member_id: 'asc' },
      skip,
      take: safeLimit,
      select: {
        id: true,
        member_id: true,
        member_name: true,
        address_email: true,
        address_mobile: true,
        access_type: true,
      },
    }),
  ]);

  return {
    total,
    page: safePage,
    limit: safeLimit,
    users: rows.map((row) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      email: row.address_email,
      mobile: row.address_mobile,
      accessType: row.access_type,
      label: `${row.member_id} — ${row.member_name}`,
    })),
  };
}
