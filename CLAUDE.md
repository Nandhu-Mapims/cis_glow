# CLAUDE.md — CIS Modernized Application Context

> **Purpose:** Deep onboarding for Claude (or any coding agent) working on this codebase.  
> Read this before changing screens, SQL, auth, print, or course dropdowns.  
> High-level diagrams also live in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## What this project is

**CIS (College Information System)** for a dental college — student/staff records, attendance, fees, academics, exams, payroll, hostel, library, and more.

This repo is a **screen-by-screen modernization** of a large legacy PHP app:

| Item | Value |
|------|--------|
| Modern repo | `/home/mapims/cis/legacy-cis-modernized/` |
| Live legacy PHP | `/home/mapims/cis/cis/` (`LEGACY_CIS_PATH`) |
| Database | MariaDB **`apdchedu_cisapp`** (shared with legacy — **do not redesign schema**) |
| Stack | React 19 + Vite 6 + Express 5 + Prisma 6 + Node ≥ 20.19 |
| Dev UI | `http://localhost:5173` |
| Dev API | `http://localhost:4000` |

**Migration philosophy:** preserve business logic and data; match legacy PHP behavior (filters, keys, print) before UX polish.

---

## Absolute rules (do not violate)

1. **`del = 1` means ACTIVE. `del = 0` means DELETED.** Soft-delete = `UPDATE … SET del=0`. New rows set `del: 1`.
2. **Do not invent tables/columns** for migrated screens. Use existing MariaDB schema. Sync with `npm run db:pull && npm run db:generate` (no Prisma migrations).
3. **Match the specific legacy PHP file** for that screen. `exam_batch.php` ≠ `term_exam_setup.php` (different course dropdowns / key formats).
4. **Never commit secrets** (`.env`, PATs, passwords).
5. **Prefer native Node services** over PHP bridge once parity is proven. Bridge is an escape hatch.
6. **Zero dates** (`0000-00-00`) are real in this DB. Prisma `DateTime` often cannot read them — use raw SQL / CAST / helpers.
7. **Do not use `window.open(..., 'noopener')` for print** — it breaks `win.print()`.
8. **IPs** are often `VARCHAR(15)` — use `normalizeLegacyIp` from `sqlSafe.js`.

---

## Repository map

```text
legacy-cis-modernized/
├── ARCHITECTURE.md          # System architecture (diagrams, mounts)
├── CLAUDE.md                # THIS FILE — agent working context
├── README.md
├── client/                  # React SPA
│   ├── public/legacy/css/   # Print CSS (exam.css, style_print.css, salary.css, …)
│   └── src/
│       ├── api/client.js    # Axios + Bearer JWT
│       ├── auth/            # AuthContext (localStorage.cis_token)
│       ├── components/      # PageShell, ReportPrintBar, ModuleSetupFactory, …
│       ├── layouts/         # AppShell, Sidebar, TopNav
│       ├── pages/<module>/  # Hubs + setup/report screens + *Meta.js
│       ├── routes/          # AppRoutes, ProtectedRoute
│       └── utils/           # legacyRoutes.js, printReport.js, …
├── server/
│   ├── prisma/schema.prisma # Introspected (~400+ models) — do not hand-edit casually
│   ├── legacy-bridge/       # PHP CLI scripts (~74) + _bootstrap.php
│   ├── scripts/             # Smoke tests, normalize-zero-dates.js
│   ├── .env.example
│   └── src/
│       ├── index.js / app.js
│       ├── config/          # env, prisma.js, bridgeScreenMaps.js
│       ├── middleware/      # auth.js, menuAuth.js
│       ├── routes/          # One file per /api/<module>
│       ├── services/        # Domain logic (fat services)
│       └── utils/           # sqlSafe.js, jwt.js, legacySelects.js, …
├── test/                    # HTTP checklist suite → CHECKLIST.md
├── docs/                    # phase-*.md, auth-flow.md, prisma notes
└── legacy-reference/        # Copied legacy PHP snippets
```

---

## How to run

```bash
# Terminal 1 — API
cd server && npm install && npm run dev   # :4000

# Terminal 2 — UI
cd client && npm install && npm run dev   # :5173 (proxies /api + /legacy → :4000)
```

Env: copy `server/.env.example` → `server/.env`. Need `DATABASE_URL`, `JWT_SECRET`, `LEGACY_CIS_PATH` (for bridge/dashboard widgets).

---

## Soft-delete & audit (critical)

### Soft-delete

```text
del = 1  → row is LIVE / ACTIVE
del = 0  → row is DELETED
```

Almost every query filters `WHERE del=1`. Soft-delete before re-insert often looks like:

```sql
UPDATE some_table SET del=0, updated_by=..., updated_ip=..., updated_dt=NOW()
WHERE del=1 AND <business keys>
```

Then insert/update with `del=1`.

### Audit fields

Pattern from `server/src/services/exam/setup/setupAudit.js` (mirrored in fees/academic/…):

```js
auditFields(memberId, audit) → {
  create: { created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del: 1 },
  update: { updated_dt, updated_ip, updated_by },
}
```

Also write **`log_tb`** via `logExamSetup` / `logFeeSetup` / `insertLog` using the **legacy page name** (e.g. `exam_batch.php`) for audit parity.

### Zero dates

- Legacy uses `0000-00-00` / `0000-00-00 00:00:00` for “empty”.
- Prisma Studio / DateTime fields break on these (`docs/prisma-studio-legacy.md`).
- Helpers: `normalizeLegacyDate`, `sqlDateOrNull` in `server/src/utils/sqlSafe.js`.
- Display: treat `0000…` as empty (`formatDisplayDate` in `ciaSetupHelpers.js` / `feeHelpers.js`).
- Active students often: `(releaving_date='0000-00-00' OR releaving_date > CURRENT_DATE)`.

---

## Auth & authorization

Details: [docs/auth-flow.md](docs/auth-flow.md)

### Login flow

1. `POST /api/auth/login` with `a_username` / `a_password`
2. Rate-limit failed attempts via `log_tb`
3. User from `web_account_setup`
4. Password: AES-128-CTR in `server/src/services/password.js` (matches legacy `password.php`)
5. `access_tb` day/time/device checks
6. JWT signed with payload:

```js
{ id, memberId, memberName, accessType, sessionId }
```

7. Client stores token in `localStorage.cis_token`; Axios sends `Authorization: Bearer …`
8. `GET /api/auth/me` for shell profile; `401` → clear token → `/login`

### Middleware

| Middleware | File | Behavior |
|------------|------|----------|
| `authMiddleware` | `server/src/middleware/auth.js` | Require valid JWT → `req.user` |
| `menuAuthForModule('exam')` | `server/src/middleware/menuAuth.js` | Module access via `authentication_tb` ⋈ `basic_admin_menu_tb` |

- If `req.user.accessType === 'Global'` → **bypass** menu checks.
- Otherwise require matching enabled menu links for that module’s PHP patterns.

### Bridge session

`server/legacy-bridge/_bootstrap.php` sets:

```php
$_SESSION['empusername_login'] = $input['memberId'];
chdir(LEGACY_CIS_PATH);
```

---

## API surface (`server/src/app.js`)

| Mount | Domain |
|-------|--------|
| `/api/health` | Health |
| `/api/auth` | Login / me / logout |
| `/api/settings` | Settings / print setup |
| `/api/dashboard` | Dashboard widgets |
| `/api/menu` | Sidebar / top menu from DB |
| `/api/students` | Students |
| `/api/staff` | Staff |
| `/api/attendance` | Attendance |
| `/api/fees` | Fees |
| `/api/academic` | Academic / curriculum |
| `/api/exam` | Exams |
| `/api/admin` | Admin accounts / access |
| `/api/files` | File download |
| `/api/payroll` | Payroll / stipend |
| `/api/sms` | SMS |
| `/api/web` | Website CMS |
| `/api/tv` | TV displays |
| `/api/kiosk` | Kiosk |
| `/api/committee` | Committee |
| `/api/certificates` | Certificates |
| `/api/naac` | NAAC |
| `/api/portfolio` | Portfolio |
| `/api/elearning` | E-learning |
| `/api/library` | Library |
| `/api/hostel` | Hostel |
| `/api/circular` | Circulars |
| `/api/admin-office` | Admin office |

Static: `/legacy` → legacy files/images parent path.

**Pattern:** thin routes → fat `services/<module>/`. Prefer `$queryRaw` + `escapeSql` when Prisma struggles with legacy types.

---

## Course / academic year key formats (VERY IMPORTANT)

Wrong builder = wrong dropdown, empty students, broken saves.

| Format | Example | Builder / parser | Typical screens |
|--------|---------|------------------|-----------------|
| `courseId___year___type` | `12___2025-2026___regular` | `courseIdYearKey` / `parseCourseIdYearKey` / **`buildCourseIdYearOptions`** | **`exam_batch.php`**, subject-batch, TT config, many academic reports |
| `courseName___year___type` | `U.G___2025-2026___regular` | `buildCourseYearOptions` / `parseCourseYearKey` | **`term_exam_setup.php`**, admission exam setup |
| `courseId___semester` | `12___1` | `courseSemesterKey` | Exam semester radios after exam select |
| `courseId___year` | `12___2025-2026` | year-only helpers | Some fee / subject report options |
| `courseId___year___batch` | fee class keys | `feeCourseYearGroups` | Fee pending SMS / letters |

### Academic year config source

Table **`basic_setup_tb`** (via `loadAcademicConfig()` in `ciaSetupHelpers.js`):

```js
{
  'U.G': { regular: ug_academic_year, additional: uga_academic_year },
  'P.G': { regular: pg_academic_year, additional: '' },
  EXAM: exam_academic_year.split(',')  // extra years shown in loops
}
```

Courses come from **`basic_setup_course_tb`** (`del=1`, order by `c_order`).

### Exam Batch vs Term Exam Setup (common confusion)

| Screen | Legacy | Dropdown style |
|--------|--------|----------------|
| Exam Batch Allocation | `exam_batch.php` | Per **degree/department**: `U.G \| BDS - Dental \| FT \| Regular` → options `BDS - Dental \| 2025-2026 (Regular)` — uses **course_id** keys |
| Exam Setup | `term_exam_setup.php` | Per **course type**: `U.G \| Regular` → options `U.G \| 2025-2026 (Regular)` — uses **course_name** keys |

Always open the legacy PHP file under `/home/mapims/cis/cis/` before changing a dropdown.

---

## End-to-end screen pattern (how to add/fix a screen)

### Canonical flow

```text
1. Legacy PHP: /home/mapims/cis/cis/<screen>.php
2. Meta: client/src/pages/<module>/*Meta.js  → slug, title, legacy filename
3. Hub link: /<module>/setup/<slug> or /reports/...
4. AppRoutes.jsx → ModuleSetupPage or custom page
5. Client component + use*SetupApi(slug)
6. POST /api/<module>/setup/<slug>/load|save
7. routes/<module>.js → services/<module>/…Setup.js load/save
8. legacyRoutes.js entry if menu should deep-link
9. Smoke-test + compare UI/print to legacy
```

### Example A — Exam Batch (course_id keys)

| Layer | Path |
|-------|------|
| Meta | `client/src/pages/exam/examSetupMeta.js` → `'exam-batch'` → `exam_batch.php` |
| Hub | `ExamSetupHub.jsx` → `/exam/setup/exam-batch` |
| Route | `AppRoutes.jsx` → `/exam/setup/:screen` → `ExamSetupPage` |
| UI | `client/src/pages/exam/setup/ExamBatchSetup.jsx` |
| Hook | `useExamSetupApi('exam-batch')` → `POST /api/exam/setup/exam-batch/load\|save` |
| Dispatch | `server/src/services/exam/examSetup.js` |
| Service | `server/src/services/exam/setup/examBatchSetup.js` → `loadExamBatch` / `saveExamBatch` |
| Shared | `buildCourseIdYearOptions` in `examSetupShared.js` |
| Table | `cia_batch_tb` |

**Load response shape:**

```js
{
  courseYearOptions, // [{ value, label, group, courseId, academicYear, academicType, courseDuration, … }]
  courseKey,
  selection,         // parsed + enriched
  semester,
  totalBatch,
  students,          // [{ registerNo, uregisterNo, name }]
  assignments,       // { 1: [roll,…], 2: […] }
  batchLetters,      // { 1: 'A', 2: 'B', … }
  printHtml,
}
```

### Example B — Term Exam Setup (course_name keys)

| Layer | Path |
|-------|------|
| Meta | `'exam-setup'` → `term_exam_setup.php` |
| UI | `TermExamSetup.jsx` |
| Service | `server/src/services/exam/setup/termExamSetup.js` |
| Shared | `buildCourseYearOptions` / `parseCourseYearKey` from `ciaSetupHelpers.js` |
| Table | `cia_setup` |

### Example C — Generic module factory (SMS, TV, kiosk, …)

```js
// createSetupApi('/api/sms') + createModuleSetupPage({ metaMap, components, useSetupApi })
```

Files: `client/src/hooks/createSetupApi.js`, `client/src/components/ModuleSetupFactory.jsx`.

Exam/fees/academic often use **custom** pages instead of the factory.

---

## Shared helpers cheat sheet

| Helper | Path | Use when |
|--------|------|----------|
| `escapeSql`, `parseId`, `normalizeLegacyDate`, `sqlDateOrNull`, `normalizeLegacyIp` | `server/src/utils/sqlSafe.js` | Any raw SQL / dates / IPs |
| `auditFields`, `logExamSetup` | `server/src/services/exam/setup/setupAudit.js` | Exam writes + audit log |
| `buildCourseIdYearOptions`, `parseCourseIdYearKey`, batch/student loaders | `server/src/services/exam/setup/examSetupShared.js` | Exam screens needing **course_id** keys |
| `loadAcademicConfig`, `buildCourseYearOptions`, `parseCourseYearKey` | `server/src/services/shared/ciaSetupHelpers.js` | CIA / **course_name** keys |
| Academic course builders / rooms / depts | `server/src/services/academic/academicSetupShared.js` | Academic setup/reports |
| `convertNYear`, fee money helpers | `server/src/services/fees/feeHelpers.js` | Fees / year labels |
| Fee class dropdowns | `server/src/services/fees/setup/feeCourseYearGroups.js` | Fee SMS/letters |
| `runLegacyBridge` | `server/src/services/legacy/phpBridge.js` | Must match legacy PHP output |
| `legacySelects` | `server/src/utils/legacySelects.js` | Safe Prisma selects |
| `toJsonSafe` | `server/src/utils/toJsonSafe.js` | BigInt/Date in JSON |
| `printReportHtml` | `client/src/utils/printReport.js` | Client print window |
| `LEGACY_ROUTE_MAP` | `client/src/utils/legacyRoutes.js` | Menu PHP → React path |

---

## Important database tables by domain

| Domain | Core tables |
|--------|-------------|
| Auth / menu | `web_account_setup`, `access_tb`, `log_tb`, `authentication_tb`, `basic_admin_menu_tb`, `basic_setup_tb` |
| Courses | `basic_setup_course_tb`, `basic_setup_tb` |
| Students | `student_profile_tb`, `student_academic_tb`, `student_attachment_tb`, `student_profile_temp_tb` |
| Staff | `staff_profile_tb`, `staff_dept_master`, `staff_desg_master`, attachment/experience/education tables |
| Exam | `cia_setup`, `cia_exam_name`, `cia_batch_tb`, `cia_schedule_tb`, `cia_marks_tb`, `cia_exam_nodue`, `basic_subject_marks_tb`, `basic_setup_subject_tb` |
| Fees | `fee_name_master`, `fee_label_master`, `fee_type_master`, `fee_bank_master`, `student_fee`, scholarship/DME tables |
| Academic | `basic_setup_subject_tb`, `basic_subject_batch_tb`, `basic_subject_tt_tb`, `timetable_tb` / `timetable_tb_new`, `subject_master`, `rooms_tb`, `blocks_tb`, `academic_calender_tb` (legacy spelling) |
| Attendance | `student_att_tb`, `student_iatt_tb`, `staff_calendar_tb`, `staff_att_*` |

---

## Print / reports

1. Service builds HTML → return as `printHtml` (or `reportHtml`).
2. Client: `<ReportPrintBar html={data?.printHtml} />` (`client/src/components/ReportPrintBar.jsx`).
3. `printReportHtml(html, mode)` in `client/src/utils/printReport.js` opens a window, writes HTML, calls `print()`.
4. Modes inject legacy CSS from `/legacy/css/...` (Express static).
5. Module-specific helpers: `examDashboardPrint.js`, `examSchedulePrint.js`, attendance/fee printers.

**Parity:** copy layout/CSS from the matching legacy PHP print path.

---

## PHP bridge

**When to use:** dashboard widgets, complex payroll/fee parity, or when Node rewrite is incomplete.

```js
import { runLegacyBridge } from '../services/legacy/phpBridge.js';
const stdout = await runLegacyBridge('some_script.php', { memberId, ...fields });
```

- Spawns `php server/legacy-bridge/<script>.php`
- JSON stdin; string stdout
- Requires `LEGACY_CIS_PATH`
- Screen maps: `server/src/config/bridgeScreenMaps.js`

Prefer rewriting to Node once behavior matches.

---

## Frontend navigation & menu

1. Menu rows come from **`GET /api/menu`** (DB).
2. `Sidebar.jsx` / `TopNav.jsx` call `resolveMenuLink` / `buildMenuHref` from **`legacyRoutes.js`**.
3. Map: `'exam_batch.php' → '/exam/setup/exam-batch'` (~457 entries).
4. Unmapped links show as migration-pending (`#legacy-…`).
5. Shared React paths may use `?legacy=<php>` to disambiguate active state.

When adding a screen: **always** add/update `legacyRoutes.js` if the menu should open it.

---

## Domain hubs (where users land)

| Hub path | Module |
|----------|--------|
| `/dashboard` | Dashboard |
| `/students` | Students |
| `/staff` | Staff |
| `/attendance` | Attendance |
| `/fees` | Fees |
| `/academic` | Academic |
| `/exam` | Exam |
| `/payroll` | Payroll |
| `/library`, `/hostel`, `/circular`, `/sms` | Supporting |
| `/admin`, `/admin-office`, `/settings` | Admin |
| `/reports` | Cross-module report links |

Exam setup screens meta: `client/src/pages/exam/examSetupMeta.js` (exam-batch, exam-setup, mark-entry, schedule-print, nodue, …).

---

## Client API hooks

| Hook | Calls |
|------|-------|
| `useExamSetupApi(screen)` | `POST /api/exam/setup/${screen}/load\|save` |
| `useFeeSetupApi(screen)` | `/api/fees/setup/...` |
| `useAcademicSetupApi(screen)` | `/api/academic/setup/...` |
| `createSetupApi(base)` | Generic for SMS/TV/etc. |

Typical usage:

```js
const { data, busy, error, notice, load, save } = useExamSetupApi('exam-batch');
useEffect(() => { load(); }, [load]);
// filters → load({ course_name, semester_name, … })
// save({ courseKey, semester, totalBatch, assignments })
```

Axios client: `client/src/api/client.js` (Bearer interceptor, 401 → login).

---

## Testing

No unit-test framework or linter is configured — the suite is HTTP-based against a running API server (`cd server && npm run dev` first), and there is no `lint` script in either `client/` or `server/`.

```bash
# from server/ — requires API running on :4000 and TEST_PASSWORD set
TEST_PASSWORD=your_password npm run test:crud     # test/run.js, read-only by default → updates test/CHECKLIST.md + test/status.json
TEST_PASSWORD=your_password node ../test/run.js --module exam        # one module
TEST_PASSWORD=your_password node ../test/run.js --id staff.read.profile  # one test
node ../test/run.js --list                        # list modules/test ids, no login needed

npm run test:all           # scripts/run-all-module-tests.js --all
npm run test:latency       # same, --json output
npm run smoke:exam-elearning
```

Mutations (create/update/delete) only run with `TEST_MUTATIONS=1` — leave unset on the shared DB unless intentionally testing writes. Other test env vars: `TEST_USER` (default `CISADMIN`), `API_URL` (default `http://localhost:4000`), `TEST_STAFF_ID`, `TEST_STUDENT_ID`. See `test/README.md`.

Manual parity: open legacy PHP and modern route side-by-side.

---

## Workflow: fix a screen to match legacy

```text
1. Identify legacy file: /home/mapims/cis/cis/<name>.php
2. Read its dropdown SQL, POST keys, save SQL, print HTML
3. Find modern meta → page → service
4. Fix service option builders / filters / save to match THAT php file
5. Fix client only if UI structure differs (radios, print bar)
6. Smoke with node --input-type=module importing the service
7. Hard-refresh browser; compare dropdown labels and save behavior
8. Update ARCHITECTURE/CLAUDE only if a new convention appears
```

### Debugging checklist

- [ ] Using correct course key builder for this legacy file?
- [ ] Filtering `del=1` for active rows?
- [ ] Academic year from `basic_setup_tb` + `EXAM` list?
- [ ] `academic_type` case (`regular` vs `Regular`) — often use `LOWER(...)` in SQL?
- [ ] Zero dates breaking Prisma findMany? Switch to `$queryRaw`.
- [ ] Print CSS mode correct in `printReport.js`?
- [ ] `legacyRoutes.js` updated for menu?

---

## Common pitfalls

1. **`del=1` is active** — filtering `WHERE del=0` for live data is wrong.
2. **Wrong course options builder** — name-based vs id-based (see table above).
3. **Assuming Prisma DateTime works** on all date columns — often fails on `0000-00-00`.
4. **Inventing schema** — not allowed for parity migrations.
5. **Copying another screen’s dropdown** — always open the target `.php`.
6. **Table typo** — `academic_calender_tb` (double “e” missing — legacy spelling).
7. **IP overflow** — truncate with `normalizeLegacyIp`.
8. **Print with noopener** — breaks printing.
9. **Case-sensitive academic_type** — DB may store `Regular` while UI sends `regular`.
10. **Stale client bundle** — hard refresh after client changes.

---

## Env reference (`server/.env.example`)

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | MariaDB connection |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Auth |
| `PORT` | Default 4000 |
| `CLIENT_URL` / `CLIENT_URLS` | CORS |
| `LEGACY_FILES_PATH` | Legacy files |
| `LEGACY_IMG_PATH` | Legacy images |
| `LEGACY_CIS_PATH` | Live PHP tree for bridge |

---

## Related docs

| Doc | When to read |
|-----|----------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System diagrams, mounts, module map |
| [docs/auth-flow.md](docs/auth-flow.md) | Login / password / JWT |
| [docs/phase-1.md](docs/phase-1.md)–[phase-12.md](docs/phase-12.md) | Phase history |
| [docs/migration-progress.md](docs/migration-progress.md) | Status (verify against code) |
| [docs/prisma-studio-legacy.md](docs/prisma-studio-legacy.md) | Zero dates / Studio |
| [docs/payroll-module.md](docs/payroll-module.md) | Payroll specifics |
| [test/README.md](test/README.md) | Checklist tests |
| Legacy PHP | `/home/mapims/cis/cis/*.php` — **source of truth for behavior** |

---

## Quick “where is X?”

| Need | Look here |
|------|-----------|
| Add exam setup screen | `examSetupMeta.js` + `ExamSetupPage.jsx` + `examSetup.js` dispatcher + `services/exam/setup/` |
| Course dropdown for exam batch | `buildCourseIdYearOptions` in `examSetupShared.js` |
| Course dropdown for term exam setup | `buildCourseYearOptions` in `ciaSetupHelpers.js` |
| Menu link not opening modern page | `client/src/utils/legacyRoutes.js` |
| Login broken | `routes/auth.js`, `services/password.js`, `accessCheck` |
| Print layout wrong | Service `printHtml` + `printReport.js` + `public/legacy/css/` |
| Dashboard widgets | PHP bridge + `services/dashboard/` |
| Soft-delete pattern | Any `save*Setup.js` — `del=0` then recreate with `del=1` |

---

## Agent response style for this repo

When implementing:

1. Open the **legacy PHP** for that screen first.
2. Change the **service** to match SQL/keys/labels.
3. Touch the client only as needed.
4. Keep diffs focused — no drive-by refactors.
5. Do not commit unless asked; do not push secrets.
6. After course/filter changes, verify with a small Node ESM smoke import of the load function.

This file is the working contract for understanding and modifying the CIS modernized application.
