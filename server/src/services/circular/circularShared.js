import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { toIsoDate } from './setupAudit.js';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

const CIRCULAR_COLS = `
  id, title, s_title,
  ${fmtDateExpr('c_date', 'c_date')},
  ${fmtDateExpr('to_date', 'to_date')},
  c_from, a_for, c_format, c_venue, description, c_attach,
  to_dept, to_board, c_signature, c_status, c_approved
`;

export function mapCircularRow(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    subTitle: row.s_title || '',
    fromDate: toIsoDate(row.c_date),
    toDate: toIsoDate(row.to_date),
    audienceFor: row.a_for || '',
    format: row.c_format || '',
    venue: row.c_venue || '',
    circularFrom: row.c_from || '',
    description: row.description || '',
    attach: row.c_attach || '',
    copyToDept: row.to_dept ? String(row.to_dept).split(',') : [],
    copyToBoard: row.to_board ? String(row.to_board).split(',') : [],
    signatures: row.c_signature ? String(row.c_signature).split(',') : [],
    status: Number(row.c_status || 0),
    approvedBy: row.c_approved || '',
  };
}

export function mapCircularListItem(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    subTitle: row.s_title || '',
    date: toIsoDate(row.c_date),
    status: Number(row.c_status || 0),
    audienceFor: row.a_for || '',
    signatures: row.c_signature || '',
  };
}

export async function fetchCircularById(id) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${CIRCULAR_COLS} FROM circular_tb WHERE del = 1 AND id = ${Number(id)} LIMIT 1
  `);
  return rows[0] ? mapCircularRow(rows[0]) : null;
}

export async function fetchCircularList({ where = 'del = 1', orderBy = 'c_date DESC', limit = 50 } = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${CIRCULAR_COLS} FROM circular_tb WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit}
  `);
  return rows.map(mapCircularListItem);
}

export async function fetchCircularPending(limit = 100) {
  return fetchCircularList({ where: 'del = 1 AND c_status = 0', limit });
}

export async function searchCircularByTitle(searchTitle, limit = 50) {
  const term = escapeSql(String(searchTitle).trim());
  return fetchCircularList({
    where: `del = 1 AND title LIKE '%${term}%'`,
    limit,
  });
}

export async function countCircular(where = 'del = 1') {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM circular_tb WHERE ${where}`);
  return Number(rows[0]?.cnt || 0);
}
