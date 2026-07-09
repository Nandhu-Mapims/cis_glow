/**
 * Normalize legacy MariaDB zero dates (0000-00-00) so Prisma Studio/Client can read rows.
 * Does NOT change schema — only replaces invalid placeholder dates.
 *
 * Usage:
 *   node scripts/normalize-zero-dates.js --dry-run              # all tables (can be millions of rows)
 *   node scripts/normalize-zero-dates.js --phase1 --dry-run     # Phase 1 tables only (~safe)
 *   node scripts/normalize-zero-dates.js --phase1 --apply       # apply Phase 1 fix
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const apply = process.argv.includes('--apply');
const phase1Only = process.argv.includes('--phase1');

const PHASE1_TABLES = new Set([
  'web_account_setup',
  'access_tb',
  'basic_setup_tb',
  'log_tb',
  'academic_calender_tb',
  'authentication_tb',
  'admin_menu_category_tb',
  'basic_admin_menu_tb',
  'dashboard_access',
]);

const ZERO = '0000-00-00 00:00:00';
const FALLBACK = '2000-01-01 00:00:00';

function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function countZero(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`${column}\` IN (?, '0000-00-00')`,
    [ZERO],
  );
  return Number(rows[0].c);
}

async function main() {
  const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
  const conn = await mysql.createConnection(cfg);

  const [tables] = await conn.query(
    `SELECT DISTINCT TABLE_NAME AS t FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME IN ('updated_dt', 'from_date', 'to_date', 'log_timestamp', 'created_dt')
     ORDER BY TABLE_NAME`,
  );

  const statements = [];

  for (const { t: table } of tables) {
    if (phase1Only && !PHASE1_TABLES.has(table)) continue;

    for (const column of ['updated_dt', 'from_date', 'to_date', 'log_timestamp']) {
      if (!(await columnExists(conn, table, column))) continue;

      const zeroCount = await countZero(conn, table, column);
      if (zeroCount === 0) continue;

      let sql;
      if (column === 'updated_dt' && (await columnExists(conn, table, 'created_dt'))) {
        sql = `UPDATE \`${table}\` SET \`updated_dt\` = CASE
          WHEN \`created_dt\` IS NULL OR \`created_dt\` IN ('${ZERO}', '0000-00-00') THEN '${FALLBACK}'
          ELSE \`created_dt\`
        END
        WHERE \`updated_dt\` IN ('${ZERO}', '0000-00-00')`;
      } else {
        sql = `UPDATE \`${table}\` SET \`${column}\` = '${FALLBACK}'
          WHERE \`${column}\` IN ('${ZERO}', '0000-00-00')`;
      }

      statements.push({ table, column, zeroCount, sql });
    }
  }

  const totalRows = statements.reduce((s, x) => s + x.zeroCount, 0);
  console.log(phase1Only ? 'Phase 1 tables only' : 'All tables');
  console.log(`Columns to fix: ${statements.length}`);
  console.log(`Rows to normalize: ${totalRows}`);
  statements.forEach((s) => console.log(`  ${s.table}.${s.column}: ${s.zeroCount}`));

  if (!apply) {
    console.log('\nDry run. Add --apply to update data.');
    await conn.end();
    return;
  }

  console.log('\nApplying...');
  for (const { table, column, sql } of statements) {
    const [result] = await conn.query(sql);
    console.log(`  ${table}.${column}: ${result.affectedRows} rows`);
  }

  console.log('Done. Restart Prisma Studio.');
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
