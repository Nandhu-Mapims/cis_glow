/**
 * Bulk-create/update login accounts (web_account_setup) from a CSV of
 * staff ID / name / password rows — used to provision initial production
 * accounts for staff who need CIS access (front office, accounts, library,
 * hostel, exam cell, etc.).
 *
 * CSV format expected (see ../../staff.csv): a markdown-table-style file —
 * header row, a "---" separator row, then data rows of
 *   , S.No , Designation , Staff ID , Staff Name , password
 * One staff member may appear on multiple rows (one per Designation they're
 * involved in, e.g. both "Students" and "Quality") — this script dedupes by
 * Staff ID and creates/updates ONE account per unique Staff ID. Designation
 * is informational only; it does not set up department/menu scoping — do
 * that afterward in Admin > Department Authentication / Menu Authentication
 * for each account, same as any other new account.
 *
 * Every account created here gets `access_type: 'Limit'` (never Global —
 * use scripts/create-super-user.js for that) and, like account_add.php /
 * accountSetup.js's saveAccountAdd, an unrestricted access_tb row (all 7
 * days, 00:00-23:59) so nobody is accidentally locked out on day one.
 *
 * Usage:
 *   node scripts/import-staff-accounts.js
 *   node scripts/import-staff-accounts.js /path/to/other.csv
 *   STAFF_CSV_PATH=/path/to/other.csv node scripts/import-staff-accounts.js
 *
 * Safe to re-run: existing accounts (matched by Staff ID = member_id) get
 * their password updated to the CSV's value; nothing is duplicated.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/config/prisma.js';
import { encrypt } from '../src/services/password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseCsvLine(line) {
  // Fields are quoted and comma-separated, with a leading empty field
  // (",\"...\",\"...\"") — a plain split on '","' after stripping the
  // outer quotes/leading comma is enough for this well-formed file.
  return line
    .split(',')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0 || cell === '')
    .map((cell) => cell.replace(/^"|"$/g, '').trim())
    .filter((cell, idx, arr) => !(idx === 0 && cell === ''));
}

function loadRows(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];
  for (const line of lines) {
    const cells = parseCsvLine(line);
    if (cells.length < 5) continue;
    const [sno, designation, staffId, staffName, password] = cells;
    if (!/^\d+$/.test(staffId)) continue; // skips header + "---" separator rows
    rows.push({
      sno, designation, staffId: staffId.trim(), staffName: staffName.trim(), password: password.trim(),
    });
  }
  return rows;
}

function nowSql() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  const csvPath = process.argv[2] || process.env.STAFF_CSV_PATH || path.join(__dirname, '../../staff.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const rows = loadRows(csvPath);
  if (rows.length === 0) {
    throw new Error(`No data rows parsed from ${csvPath} — check the format matches the header/---/data-row layout.`);
  }

  // Dedupe by Staff ID; keep the first name/password seen, collect all
  // designations for the summary printout.
  const byStaffId = new Map();
  for (const row of rows) {
    if (!byStaffId.has(row.staffId)) {
      byStaffId.set(row.staffId, { ...row, designations: [row.designation] });
    } else {
      byStaffId.get(row.staffId).designations.push(row.designation);
    }
  }

  console.log(`Parsed ${rows.length} row(s) -> ${byStaffId.size} unique staff ID(s) from ${csvPath}`);

  const createdBy = String(process.env.STAFF_IMPORT_CREATED_BY || 'system').trim();
  const createdIp = '127.0.0.1';
  const results = [];

  for (const staff of byStaffId.values()) {
    const memberId = staff.staffId;
    const now = new Date();

    // Raw SELECT (not prisma.web_account_setup.findFirst) — some rows in
    // this legacy-shared table have zero-date (`0000-00-00`) timestamp
    // columns, which Prisma's typed client throws on when deserializing a
    // full row into DateTime fields. Selecting only the non-date columns
    // we actually need sidesteps that entirely (see CLAUDE.md "Zero dates").
    const existingRows = await prisma.$queryRaw`
      SELECT id, access_type, member_name FROM web_account_setup
      WHERE del = 1 AND member_id = ${memberId} LIMIT 1
    `;
    const existing = existingRows[0];

    if (existing) {
      if (existing.access_type === 'Global') {
        results.push({ memberId, status: 'skipped (Global account, not touched)' });
        continue;
      }
      // Raw UPDATE for the same reason — prisma.web_account_setup.update()
      // reads the full row back afterward and would hit the same zero-date
      // parse error on unrelated columns like created_dt.
      await prisma.$executeRaw`
        UPDATE web_account_setup
        SET password = ${encrypt(staff.password)},
            member_name = ${existing.member_name || staff.staffName},
            reset_password = '',
            updated_dt = ${now},
            updated_ip = ${createdIp},
            updated_by = ${createdBy}
        WHERE id = ${existing.id}
      `;
      results.push({ memberId, status: 'updated', name: staff.staffName, designations: staff.designations.join(', ') });
      continue;
    }

    const user = await prisma.web_account_setup.create({
      data: {
        member_id: memberId,
        member_name: staff.staffName,
        address_mobile: '',
        address_email: '',
        password: encrypt(staff.password),
        reset_password: '',
        photo: '',
        acc_gender: '',
        access_type: 'Limit',
        created_dt: now,
        created_ip: createdIp,
        created_by: createdBy,
        updated_dt: now,
        updated_ip: createdIp,
        updated_by: createdBy,
        del: 1,
      },
    });

    try {
      await prisma.$executeRaw`
        INSERT INTO access_tb (
          user_id, local_access, random_id, random_id_1, random_id_2, random_id_3, random_id_4,
          date_base, from_date, to_date, day_base, allow_day, allow_from_time, allow_to_time,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
        ) VALUES (
          ${String(user.id)}, 0, '0', '', '', '', '',
          0, ${now}, '0000-00-00 00:00:00', 1, '1,2,3,4,5,6,7', '00:00:00', '23:59:00',
          ${now}, ${createdIp}, ${createdBy}, ${now}, ${createdIp}, ${createdBy}, 1
        )
      `;
    } catch (accessError) {
      console.warn(`Note: access_tb row skipped for ${memberId}:`, accessError.message);
    }

    results.push({ memberId, status: 'created', name: staff.staffName, designations: staff.designations.join(', ') });
  }

  console.log('\nDone:');
  console.table(results);
  console.log(`\nRun at: ${nowSql()}`);
  console.log('\nNext step: assign each account\'s department/menu access in Admin > Department');
  console.log('Authentication and Menu Authentication (Designation from the CSV is a hint, not applied automatically).');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
