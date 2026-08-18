# NEW_CIS_FULL_FLOW.md — Modernized CIS: Full Application Flow (Module-Wise)

> Companion to [OLD_CIS_FULL_FLOW.md](OLD_CIS_FULL_FLOW.md) (legacy PHP app at
> `/home/mapims/cis/cis/`). This document covers the **modernized** app at
> `/home/mapims/cis/legacy-cis-modernized/` — React 19 + Vite client, Express 5 +
> Prisma 6 server, same shared MariaDB `apdchedu_cisapp` database as the legacy
> app. High-level rules live in [CLAUDE.md](CLAUDE.md); diagrams in
> [ARCHITECTURE.md](ARCHITECTURE.md). This file goes one level deeper: the
> actual request/response flow, file-by-file, module by module, as the code
> stands today.

---

## 1. System shape

```text
Browser (client/, Vite, :5173 dev)
   │  Axios (Bearer JWT)  ── /api/*  ──────────────►  Express (server/, :4000 dev / :2003 docker)
   │  /legacy/* static                                    │
   └───────────────────────────────────────────────────►  Prisma 6 ──► MariaDB apdchedu_cisapp
                                                             │
                                                             └─► server/legacy-bridge/*.php (escape hatch, spawns PHP against LEGACY_CIS_PATH)
```

- **Client**: `client/src/` — single Vite SPA, React Router, one `pages/<module>/` tree per domain.
- **Server**: `server/src/` — thin `routes/<module>.js` → fat `services/<module>/**` → Prisma / raw SQL.
- **Docker** (`docker-compose.yml`): `backend` service on host network, `PORT=2003`; `frontend` service on `1003:1003`, `host.docker.internal` for reaching the backend.
- **Database**: same MariaDB the legacy PHP app writes to — no parallel schema, no migrations (`npm run db:pull && npm run db:generate` only).

---

## 2. Server boot & request pipeline

`server/src/index.js` → `app.listen(config.port, …)`, then kicks off one background warm-up (`loadExamDashboard('SYSTEM', { refresh: true })`), and installs a graceful-shutdown handler (`SIGTERM`/`SIGINT` → drain in-flight requests, `prisma.$disconnect()`, 10s force-exit timer).

`server/src/app.js` middleware stack, in order:

1. `helmet()` — CSP in **report-only** mode (screens still use `dangerouslySetInnerHTML` for legacy-parity print/dashboard HTML with inline handlers, so CSP isn't enforced yet), `crossOriginResourcePolicy: 'same-site'`.
2. `compression()`
3. `cors()` — explicit origin allowlist (`config.allowedClientOrigins`), `credentials: true`. Requests with no `Origin` header (native apps, curl) pass through.
4. `express.json({ limit: '5mb' })`, `express.urlencoded(...)`, `cookieParser()`
5. `app.set('trust proxy', 1)` — trusts exactly one reverse-proxy hop for `req.ip`.
6. `/legacy` → `legacyStaticGuard` + `express.static(...)` — serves legacy images/files (`LEGACY_IMG_PATH`/`LEGACY_FILES_PATH` parent) directly to the SPA.
7. `/api/health` — liveness check, no auth.
8. 26 module routers mounted at `/api/<module>` (table in §4).
9. Final error handler — `entity.too.large` → 413 with a friendly message; everything else → generic 500 (errors are logged server-side, not leaked to the client).

### 2.1 Middleware (`server/src/middleware/`)

| File | Role |
|---|---|
| `auth.js` (18 lines) | `authMiddleware` — verifies the Bearer JWT, populates `req.user = { id, memberId, memberName, accessType, sessionId }`. Every module router (except `/api/auth`, `/api/settings/public`) calls `router.use(authMiddleware, ...)` first. |
| `menuAuth.js` (155 lines) | `menuAuthForModule('<module>')` — cross-references `authentication_tb` ⋈ `basic_admin_menu_tb` for the user's module-relevant PHP link patterns. `accessType === 'Global'` bypasses the check entirely (superuser). Applied per-module (attendance, fees, staff, students, etc.) after `authMiddleware`. |
| `legacyStaticGuard.js` (43 lines) | Guards the `/legacy` static mount — prevents path traversal / serving anything outside the intended legacy asset roots. |

### 2.2 Config (`server/src/config/`)

| File | Role |
|---|---|
| `index.js` | Central env loader — `port`, `allowedClientOrigins`, `legacyImgPath`, `legacyFilesPath`, `legacyCisPath`, JWT secret/expiry, etc. |
| `prisma.js` | Shared `PrismaClient` singleton. |
| `bridgeScreenMaps.js` | Maps screen slugs → legacy PHP bridge scripts for the escape-hatch path. |
| `fileStorageMap.js` | Maps upload/attachment categories to legacy on-disk storage directories (parity with PHP's file layout). |

---

## 3. Auth flow (deep dive)

Full narrative: [docs/auth-flow.md](docs/auth-flow.md). File-level trace:

1. **Client** `Login.jsx` (`client/src/pages/Login.jsx`) submits `{ a_username, a_password }`.
2. **Route** `POST /api/auth/login` (`server/src/routes/auth.js`, 196 lines):
   - `loginRequestLimiter` (express-rate-limit, keyed on raw socket address, not `req.ip`, to avoid a spoofable-header bypass) — 30 req/min per IP.
   - `countRecentFailedLogins()` (`services/logService.js`) — if ≥5 failed attempts recently for that IP, hard-block with a 429 (mirrors legacy's 5-minute lockout) and still logs the attempt.
   - Looks up `web_account_setup` by `member_id` OR `address_email`, `del: 1`.
   - `decrypt(user.password)` (`services/password.js`, **AES-128-CTR**, byte-for-byte compatible with legacy `password.php`) compared to the submitted password.
   - `accessCheck()` (`services/accessCheck.js`) — day/time/device gate against `access_tb`, same rule as legacy's session gate, checked **at login only** (not per-request).
   - On success: `createSessionId()` + `signToken({ id, memberId, memberName, accessType, sessionId })` (`utils/jwt.js`), writes to `log_tb` via `insertLog`, returns `{ token, user }` where `user` includes `resolveFirstMenuLink()` (first enabled menu link this user can reach — used for post-login redirect) and `photoUrl` built from `/legacy/img/member/<photo>`.
3. **Client** stores `res.data.token` in `localStorage.cis_token` (`client/src/auth/AuthContext.jsx`), sets `user` in `AuthContext`.
4. **Every subsequent request**: `client/src/api/client.js` Axios request interceptor attaches `Authorization: Bearer <token>`. Response interceptor: `401` (except on the login call itself) → clears `localStorage.cis_token`, redirects to `/login`.
5. **Session restore on app load**: `AuthContext` reads `localStorage.cis_token`, calls `GET /api/auth/me` to rehydrate `user`; failure clears the token.
6. **Logout**: `POST /api/auth/logout` writes an audit row; client always clears local token regardless of API success/failure.

---

## 4. API surface — module router table

| Mount | File | Auth | Representative endpoints |
|---|---|---|---|
| `/api/health` | inline in `app.js` | none | `GET /` |
| `/api/auth` | `routes/auth.js` (196L) | none (self) | `POST /login`, `POST /logout`, `GET /me` |
| `/api/settings` | `routes/settings.js` (115L) | mixed | `GET /public` (unauth), `GET /basic`, `/setup/*` sub-router |
| `/api/dashboard` | `routes/dashboard.js` (197L) | auth only | `GET /`, `GET /widgets`, `GET /student`, `GET /staff-pattern`, `GET /overall-strength`, `GET /community-strength` |
| `/api/menu` | `routes/menu.js` (123L) | auth only | `GET /` |
| `/api/students` | `routes/students.js` (305L) | auth + menu(`students`) | `GET /courses`, `GET /search`, `POST /`, `GET/PUT /:id`, `GET /:id/attachments`, `POST /screens/:screen/load\|save` |
| `/api/staff` | `routes/staff.js` (390L) | auth + menu(`staff`) | `GET /admission/options`, `GET /search`, `POST /`, `GET/PUT /:id`, `POST /setup/:screen/load\|save`, `POST /screens/:screen/load\|save` |
| `/api/attendance` | `routes/attendance.js` (322L) | auth + menu(`attendance`) | `POST /staff/calendar`, `POST /staff/punch`, `POST /staff/report`, `GET /students/filters`, `POST /students/daily`, `PUT /students/daily`, `POST /students/report/generate` |
| `/api/fees` | `routes/fees.js` (442L, largest router) | auth + menu(`fees`) | `POST /collection/sheet`, `PUT /collection/sheet`, `POST /delete/requests`, `POST /delete/approve`, `GET /slips/approved`, `POST /pending-sms/send`, `POST /pending-letter/generate`, plus generic `/setup/:screen/load\|save` |
| `/api/academic` | `routes/academic.js` (108L) | auth | `GET /courses`, `/setup/:screen/load\|save`, `/tt-config/more`, `/tt-config-v3/more` |
| `/api/exam` | `routes/exam.js` (93L) | auth | `GET /dashboard`, `POST /student-statement`, `GET /marksheet/print`, `/setup/:screen/load\|save` |
| `/api/admin` | `routes/admin.js` (133L) | auth | `GET /users`, `GET/POST /log-dashboard`, `GET/POST /log-details`, `/setup/:screen/load\|save` |
| `/api/files` | `routes/files.js` (46L) | mixed | `GET /map`, `GET /*` (catch-all download resolver) |
| `/api/payroll` | `routes/payroll.js` (386L) | auth | `/dashboard`, `/individual-report`, `/consolidated-report`, `/individual-bundle`, `/stipend/*`, `/generate-payroll`, `/setup/:screen/load\|save` |
| `/api/sms` | `routes/sms.js` (48L) | auth | `/setup/:screen/load\|save` (generic factory) |
| `/api/web` | `routes/web.js` (44L) | auth | `/setup/:screen/load\|save` |
| `/api/tv` | `routes/tv.js` (43L) | auth | `GET /dashboard`, `/setup/:screen/load\|save` |
| `/api/kiosk` | `routes/kiosk.js` (36L) | auth | `/setup/:screen/load\|save` |
| `/api/committee` | `routes/committee.js` (33L) | auth | `/setup/:screen/load\|save` |
| `/api/certificates` | `routes/certificate.js` (45L) | auth | `/setup/:screen/load\|save` |
| `/api/naac` | `routes/naac.js` (32L) | auth | `/setup/:screen/load\|save` |
| `/api/portfolio` | `routes/portfolio.js` (53L) | auth | `POST /dashboard/load`, `POST /individual-report/load`, `GET /individual-report/student/:studentId` |
| `/api/elearning` | `routes/elearning.js` (42L) | auth | `GET /dashboard`, `/setup/:screen/load\|save` |
| `/api/library` | `routes/library.js` (56L) | auth | `/setup/:screen/load\|save` |
| `/api/hostel` | `routes/hostel.js` (56L) | auth | `/setup/:screen/load\|save` |
| `/api/circular` | `routes/circular.js` (53L) | auth | `/setup/:screen/load\|save` |
| `/api/admin-office` | `routes/adminOffice.js` (67L) | auth | `/setup/:screen/load\|save`, `POST /lookup-participants` |

**Pattern split:** modules with heavy bespoke business logic (students, staff, attendance, fees, payroll) have hand-built REST verbs per feature. Simpler/administrative modules (sms, tv, kiosk, committee, certificates, naac, library, hostel, circular, web, elearning, admin-office) lean almost entirely on the **generic setup factory** pattern: `POST /<module>/setup/:screen/load` and `POST /<module>/setup/:screen/save`, where `:screen` is a slug dispatched inside the module's service layer to the right load/save function.

---

## 5. Server services layer (`server/src/services/`)

Thin routes delegate to fat services — this is where all business logic, SQL, and legacy-parity rules live. File counts per module directory (today):

| Module | Files | Notes |
|---|---|---|
| `payroll/` | 32 | Largest service tree — stipend, individual/consolidated reports, generate-payroll, attendance-linked pay. |
| `fees/` | 28 | `feeCollection.js`, `feeApproval.js`, `feePending.js`, `feeHistory.js`, `feeReport.js`, `feeDashboard.js`, `feeDelete.js`, `feeSlipApproved.js`, `feePendingSms.js`, `feePendingLetter.js`, `feeDmeSetup.js`, `feeScholarshipSetup.js`, `feeAcmecScholarshipSetup.js`, `feeAcmecConfig.js`, `feeHelpers.js`, plus `setup/feeCourseYearGroups.js` and per-screen setup files. |
| `attendance/` | 20 | Split staff vs. student: `attendanceStaff.js`, `attendanceStudent.js`, `staffAttendanceSetup.js`, `staffAttendanceScreens.js`, `studentAttendanceScreens.js`, `staffCategories.js`. |
| `committee/` | 20 | Per-committee-screen setup services (generic factory backers). |
| `students/` | 16 | Profile CRUD, attachments, reports, screens dispatcher. |
| `staff/` | 12 | Mirrors `students/` — profile, attachments, categories, reports. |
| `sms/` / `tv/` / `certificate/` | 12 each | Setup-factory backers per screen. |
| `web/` | 11 | CMS-style content setup. |
| `kiosk/` | 9 | Kiosk display setup/config. |
| `exam/` | 7 | `examDashboard.js`, `setup/` subfolder (`examSetupShared.js`, `examBatchSetup.js`, `termExamSetup.js`, `setupAudit.js`, …). |
| `dashboard/` | 7 | `widgetDispatcher.js`, `dashboardMeta.js`, `dashboardScreens.js`, strength reports. |
| `academic/` | 6 | `academicSetupShared.js` + setup screens, timetable config v1/v3. |
| `elearning/` | 6 | Dashboard + setup. |
| `naac/` | 6 | Setup screens. |
| `hostel/` | 4 | Setup screens. |
| `admin/` | 5 | User/access admin, log dashboard/details. |
| `adminOffice/` | 3 | Setup + participant lookup. |
| `circular/` | 3 | Setup screens. |
| `library/` | 3 | Setup screens (dispatcher: `librarySetup.js`, shared: `libraryShared.js`, plus `setup/` per-screen files — see §7 for the recent library screens work). |
| `portfolio/` | 2 | Dashboard + individual report. |
| `settings/` | 2 | Public/basic settings. |
| `shared/` | 3 | `ciaSetupHelpers.js` (course/academic-year option builders, **course_name** keys), and other cross-module helpers. |

Top-level singletons (not in a module folder): `accessCheck.js`, `bridgeAuditLog.js`, `logService.js`, `password.js`.

### 5.1 The "setup factory" load/save contract

Every generic module (sms, tv, kiosk, committee, certificates, naac, library, hostel, circular, web, elearning, admin-office, and most of academic/admin) follows the same shape:

```text
POST /api/<module>/setup/<screen>/load  { ...filters }  →  { ...screenData }
POST /api/<module>/setup/<screen>/save  { ...formData }  →  { ...result, notice }
```

Server-side, `routes/<module>.js` does almost nothing but forward `req.params.screen` + `req.body` to a per-module dispatcher (e.g. `services/library/librarySetup.js`) that switch/maps the slug to the concrete `load*Setup`/`save*Setup` function. Client-side, `client/src/hooks/createSetupApi.js` + `client/src/components/ModuleSetupFactory.jsx` mirror this generically — a page just needs a `*Meta.js` entry (slug, title, legacy filename) and a component; no bespoke hook plumbing needed unless the screen's shape is unusual (exam, fees, academic use **custom** pages instead of the factory because their filters are non-generic — see §6).

### 5.2 Soft-delete & audit (enforced in services, not routes)

```text
del = 1  → row is LIVE
del = 0  → row is DELETED
```

Save flows generally: `UPDATE … SET del=0 WHERE del=1 AND <business keys>` (soft-delete the prior row) then insert/update the new row with `del: 1`. Audit fields (`created_dt/ip/by`, `updated_dt/ip/by`) come from a shared `auditFields(memberId, audit)` helper per module (canonical version: `services/exam/setup/setupAudit.js`), and every setup-screen save also writes `log_tb` with the **legacy page name** (e.g. `exam_batch.php`) for audit parity with the PHP app.

### 5.3 Zero dates

`0000-00-00` / `0000-00-00 00:00:00` are real legacy values. Prisma's typed `DateTime` throws on them, so any query touching a possibly-zero date column uses `$queryRaw`/`$executeRaw` + helpers in `server/src/utils/sqlSafe.js` (`normalizeLegacyDate`, `sqlDateOrNull`) instead of the Prisma client API. Display-side, `formatDisplayDate`-style helpers in `ciaSetupHelpers.js`/`feeHelpers.js` render zero dates as empty.

---

## 6. Course/academic-year key formats (why two nearly-identical screens differ)

This is the single most common source of "empty dropdown" bugs, so it's called out at both the CLAUDE.md and flow-doc level:

| Format | Example | Builder | Screens |
|---|---|---|---|
| `courseId___year___type` | `12___2025-2026___regular` | `buildCourseIdYearOptions` (`services/exam/setup/examSetupShared.js`) | Exam Batch Allocation (`exam_batch.php` → `/exam/setup/exam-batch`), subject-batch, TT config |
| `courseName___year___type` | `U.G___2025-2026___regular` | `buildCourseYearOptions` (`services/shared/ciaSetupHelpers.js`) | Term Exam Setup (`term_exam_setup.php` → `/exam/setup/exam-setup`), admission exam setup |
| `courseId___semester` | `12___1` | `courseSemesterKey` | Exam semester radios |
| `courseId___year` | `12___2025-2026` | year-only helpers | Some fee/subject reports |
| `courseId___year___batch` | fee class keys | `feeCourseYearGroups.js` | Fee pending SMS / letters |

Academic year source of truth: `basic_setup_tb` (regular/additional years per `U.G`/`P.G`, plus an `EXAM` extra-years list), loaded via `loadAcademicConfig()`. Courses: `basic_setup_course_tb` (`del=1`, `c_order`).

---

## 7. Client (`client/src/`)

### 7.1 Boot & shell

- `client/src/api/client.js` — Axios instance, `baseURL` from `VITE_API_URL`, Bearer interceptor, 401 → clear token + redirect.
- `client/src/auth/AuthContext.jsx` — `login()`/`logout()`/`user`/`isAuthenticated`, session restore via `GET /api/auth/me`.
- `client/src/routes/AppRoutes.jsx` (315 lines) — top-level React Router tree; `ProtectedRoute.jsx` gates authenticated routes.
- `client/src/layouts/` — `AppShellLayout.jsx` (sidebar + top nav shell), `DashboardLayout.jsx`, `Header.jsx`, `TopNav.jsx`.
- `client/src/hooks/` — `createSetupApi.js` (generic factory hook builder), `useShellData.js`, `useDragReorder.jsx`, `useTransientNotice.js`. Module-specific hooks (`useExamSetupApi`, `useFeeSetupApi`, `useAcademicSetupApi`, …) live **next to their pages**, e.g. `client/src/pages/exam/setup/useExamSetupApi.js` — not centralized.
- `client/src/components/` — shared building blocks: `PageShell.jsx`, `ModuleSetupFactory.jsx` (renders any generic setup screen from its `*Meta.js`), `ReportPrintBar.jsx` (print trigger), `DataTable.jsx`, `FormShell.jsx`, `ListSearchPage.jsx`, `ConfirmModal.jsx`, `SetupAlerts.jsx`, `CommandPalette*.jsx` (⌘K-style navigation), `LegacyDateInput.jsx`/`LegacyDateTimeInput.jsx` (zero-date-safe inputs), `DashboardWidgetCard.jsx`, `DeptStaffingChart.jsx`, `UserAvatar.jsx`/`UserMenu.jsx`.
- `client/src/utils/legacyRoutes.js` (586 lines) — `LEGACY_ROUTE_MAP`: ~450+ legacy `.php` filenames → modern React paths. Menu items with no mapped entry render as migration-pending (`#legacy-…`).
- `client/src/utils/printReport.js` — `printReportHtml(html, mode)`: opens a new window, injects the right legacy CSS bundle from `/legacy/css/...`, calls `print()`. **Never** opened with `window.open(..., 'noopener')` — that flag breaks `win.print()`.

### 7.2 Pages per module (`client/src/pages/<module>/`) — file counts

| Module | .jsx files | Shape |
|---|---|---|
| `payroll/` | 37 | Custom pages (dashboard, individual/consolidated report, stipend flows, generate-payroll) — largest client module tree. |
| `exam/` | 38 | Custom hub + setup pages (`ExamHub`, `ExamSetupHub`, `ExamSetupPage`, `ExamDashboard`, `ExamReportsHub`, `ExamStudentStatement`) + `setup/` subfolder per screen + `examSetupMeta.js`. |
| `fees/` | 32 | Custom — collection, approval, pending, history, reports, dashboard, delete workflow, scholarship/DME/ACMEC setup. |
| `academic/` | 30 | Custom — courses, subjects, timetable config v1/v3, rooms/blocks/depts. |
| `admin/` | 17 | User/access admin, log dashboards. |
| `attendance/` | 17 | Staff calendar/report/punch + student daily/report screens. |
| `hostel/` | 17 | Mostly `ModuleSetupFactory`-driven. |
| `settings/` | 17 | App/print settings. |
| `library/` | 20 | Setup screens (Entry, Report, Attendance, Book Add/Edit/Category/Report, Dashboard, Resources Barcode/Report, Transaction Issue/Return) — **recently modified**, see git status. |
| `students/` | 14 | Profile CRUD, attachments, reports, ID card, promotion, alumni. |
| `circular/` | 12 | Factory-driven. |
| `adminOffice/` | 12 | Factory-driven + participant lookup. |
| `sms/` | 9 | Factory-driven. |
| `staff/` | 9 | Profile CRUD, attachments, reports. |
| `web/` | 9 | CMS-style factory-driven. |
| `certificate/` | 3 | Factory-driven. |
| `portfolio/` | 3 | Dashboard + individual report. |
| `tv/` | 3 | Factory-driven. |
| `elearning/` | 2 | Dashboard + factory. |
| `naac/` | 2 | Factory-driven. |
| `committee/` | 2 | Factory-driven. |
| `kiosk/` | 2 | Factory-driven. |
| `dashboard/` | 5 | Main dashboard widgets, student/staff-pattern variants. |
| `reports/` | 1 | Cross-module report links hub. |
| (root) | `Dashboard.jsx`, `Login.jsx` | Entry points. |

### 7.3 Custom vs. factory pages — how to tell which pattern a module uses

- **Custom** (bespoke filters, non-generic course-key dropdowns, multi-step save flows): `exam`, `fees`, `academic`, `attendance`, `students`, `staff`, `payroll`, `admin`.
- **Factory** (`ModuleSetupFactory` + `createSetupApi` + `*Meta.js` map): `sms`, `tv`, `kiosk`, `committee`, `certificate`, `naac`, `library` (mostly), `hostel`, `circular`, `web`, `elearning`, `adminOffice`, parts of `admin`.

---

## 8. Navigation & menu resolution

1. `GET /api/menu` (`routes/menu.js`) builds a 3-level tree — `admin_menu_category_tb` → distinct `main_menu_name` groups → `basic_admin_menu_tb` rows — filtered by `del=1`, `menu_enable=1`, and (unless `accessType === 'Global'`) the user's `authentication_tb` rows (`authentication = 1`). A couple of hand-maintained overrides live in the route file itself: `MENU_LABEL_OVERRIDES` (rename specific legacy links, e.g. `class_time_table_v3.php` → "Report (New)") and `SUB_MENU_LINK_ORDER` (force explicit ordering when legacy `main_menu_order`/`sub_menu_order` collide).
2. Client `Sidebar`/`TopNav` (under `client/src/layouts/` + `components/Layout/`) render that tree and resolve each `sub_menu_link` (a legacy `.php` filename) through `resolveMenuLink`/`buildMenuHref` in `legacyRoutes.js`.
3. Unmapped links (not yet in `LEGACY_ROUTE_MAP`) render as migration-pending placeholders rather than 404s.
4. Some React paths are shared across multiple legacy files and disambiguate via a `?legacy=<php>` query param to pick the right active-state/menu highlight.

---

## 9. Print / reports flow

1. A service builds an HTML string server-side (`printHtml` or `reportHtml` in the load/response payload) — same markup/CSS classes as the legacy PHP print output, for visual parity.
2. Client renders `<ReportPrintBar html={data?.printHtml} />` (`client/src/components/ReportPrintBar.jsx`).
3. `printReportHtml(html, mode)` (`client/src/utils/printReport.js`) opens a new window, writes the HTML, injects the matching legacy CSS bundle from `/legacy/css/...` (served by the Express static mount), then calls `.print()`.
4. Module-specific print helpers exist for more complex cases: `examDashboardPrint.js`, `examSchedulePrint.js`, attendance/fee printers (colocated with their pages).

---

## 10. PHP bridge (escape hatch)

`server/src/services/legacy/phpBridge.js` → `runLegacyBridge(scriptName, payload)`:

- Spawns `php server/legacy-bridge/<script>.php` with JSON on stdin, `LEGACY_CIS_PATH` as the working directory (`_bootstrap.php` sets `chdir(LEGACY_CIS_PATH)` and re-creates `$_SESSION['empusername_login']` so the legacy script believes it's a normal logged-in PHP request).
- Screen-to-script mapping: `server/src/config/bridgeScreenMaps.js`.
- ~74 bridge scripts under `server/legacy-bridge/` today, used for dashboard widgets, complex payroll/fee parity calculations, and anything where the Node rewrite isn't proven yet.
- **Direction of travel**: prefer rewriting a bridge call to native Node once its output is verified to match; the bridge is not meant to be permanent per-screen infrastructure.

---

## 11. File downloads/uploads

- `GET /api/files/map` + `GET /api/files/*` (`routes/files.js`) resolve a requested logical file to its on-disk legacy path via `config/fileStorageMap.js`, so upload/download parity with the PHP app's directory layout is preserved without duplicating storage.
- `/legacy` static mount (`legacyStaticGuard` + `express.static`) directly serves legacy images (ID photos, attachments) referenced by DB columns (e.g. `web_account_setup.photo` → `/legacy/img/member/<photo>`).
- Module routes that accept uploads (`students`, `staff` attachments, certificates) use `multipart/form-data` POST endpoints (`POST /:id/attachments/upload`, `POST /screens/certificates/upload`).

---

## 12. Testing

No unit-test framework/linter — the suite is HTTP-based against a **running** API:

```bash
cd server && npm run dev                                    # start API on :4000 first
TEST_PASSWORD=... npm run test:crud                          # test/run.js — read-only by default
TEST_PASSWORD=... node ../test/run.js --module exam           # one module
TEST_PASSWORD=... node ../test/run.js --id staff.read.profile # one test
node ../test/run.js --list                                    # list modules/ids, no login needed
npm run test:all       # scripts/run-all-module-tests.js
npm run test:latency   # same, --json
npm run smoke:exam-elearning
```

`TEST_MUTATIONS=1` gates create/update/delete tests — leave unset against the shared DB. Results accumulate in `test/CHECKLIST.md` + `test/status.json`. Manual parity check: legacy PHP page and modern route open side-by-side.

---

## 13. End-to-end pattern for adding/fixing a screen

```text
1. Legacy PHP: /home/mapims/cis/cis/<screen>.php            (source of truth for behavior)
2. Meta: client/src/pages/<module>/*Meta.js                  → slug, title, legacy filename
3. Hub link: /<module>/setup/<slug> or /reports/...
4. AppRoutes.jsx → ModuleSetupPage or custom page
5. Client component + use*SetupApi(slug) (custom) or ModuleSetupFactory (generic)
6. POST /api/<module>/setup/<slug>/load|save
7. routes/<module>.js → services/<module>/…Setup.js load/save
8. legacyRoutes.js entry if the menu should deep-link to it
9. Smoke-test (node ESM import of the load function) + compare UI/print to legacy
```

---

## 14. Where each doc fits

| Need | Doc |
|---|---|
| Absolute rules, pitfalls, quick lookups | [CLAUDE.md](CLAUDE.md) |
| System diagrams | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Login/password/JWT narrative | [docs/auth-flow.md](docs/auth-flow.md) |
| Phase-by-phase build history | `docs/phase-1.md` – `docs/phase-12.md` |
| Migration status snapshot | [docs/migration-progress.md](docs/migration-progress.md) (verify against code — it drifts) |
| Zero-date/Prisma Studio gotchas | [docs/prisma-studio-legacy.md](docs/prisma-studio-legacy.md) |
| Payroll specifics | [docs/payroll-module.md](docs/payroll-module.md) |
| Checklist test runner | [test/README.md](test/README.md) |
| **This file** | End-to-end request flow + module-by-module file inventory, as of this writing |
| Legacy app flow | [OLD_CIS_FULL_FLOW.md](OLD_CIS_FULL_FLOW.md) |
| Mobile app plan | [mobile.md](mobile.md) |
