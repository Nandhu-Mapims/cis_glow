# Prisma Studio + Legacy MariaDB

## Run Studio

```bash
source ~/.nvm/nvm.sh
nvm use 20
cd /home/mapims/cis/legacy-cis-modernized/server
npm run studio
```

Open: `http://localhost:5555`

---

## Zero-date errors (P2020 / garbled STUDIO_EMBED_BUILD)

Legacy CIS stores invalid dates: `0000-00-00 00:00:00`. Prisma cannot read those as `DateTime`.

### Fix applied for Phase 1 tables

We normalize **data only** (not schema) for Phase 1 tables:

```bash
npm run db:normalize-dates          # dry-run
npm run db:normalize-dates:apply    # apply Phase 1 tables only
```

Phase 1 tables: `web_account_setup`, `access_tb`, `basic_setup_tb`, `log_tb`, `academic_calender_tb`, menu/auth/dashboard tables.

- `updated_dt = 0000-00-00` → set to `created_dt` (or `2000-01-01` fallback)
- `from_date` / `to_date` / `log_timestamp` zeros → `2000-01-01 00:00:00`

**Restart Prisma Studio** after applying.

### Other tables

~300+ other tables may still have zero dates (~1.8M rows total). Full fix (optional, large):

```bash
node scripts/normalize-zero-dates.js --dry-run    # preview all tables
node scripts/normalize-zero-dates.js --apply      # NOT recommended without backup
```

Use SQL for one-off browsing:

```sql
SELECT id, CAST(updated_dt AS CHAR) FROM some_table LIMIT 50;
```

---

## Notes

- Table name: **`academic_calender_tb`** (legacy spelling *calender*)
- Use local Prisma 6: `npm run studio` — not `npx prisma@7` from project root
