# CIS Modernization — Full Architecture

Screen-by-screen migration of the legacy PHP College Information System (CIS) to a **React + Node.js + Express + Prisma** stack, keeping the existing MariaDB database (`apdchedu_cisapp`) unchanged.


| Item                | Path / value                                |
| ------------------- | ------------------------------------------- |
| **Repo**            | `/home/mapims/cis/legacy-cis-modernized/`   |
| **Live legacy app** | `/home/mapims/cis/cis/` (`LEGACY_CIS_PATH`) |
| **Database**        | MariaDB `apdchedu_cisapp`                   |
| **Dev UI**          | `http://localhost:5173`                     |
| **Dev API**         | `http://localhost:4000`                     |


Related docs: [auth-flow.md](docs/auth-flow.md) · [migration-progress.md](docs/migration-progress.md) · [phase-1.md](docs/phase-1.md)–[phase-12.md](docs/phase-12.md) · [payroll-module.md](docs/payroll-module.md)

---

## Table of contents

1. [Goals & design principles](#1-goals--design-principles)
2. [High-level system view](#2-high-level-system-view)
3. [Repository layout](#3-repository-layout)
4. [Technology stack](#4-technology-stack)
5. [Runtime & configuration](#5-runtime--configuration)
6. [Request & data flow](#6-request--data-flow)
7. [Authentication & authorization](#7-authentication--authorization)
8. [Backend architecture](#8-backend-architecture)
9. [Frontend architecture](#9-frontend-architecture)
10. [Database strategy](#10-database-strategy)
11. [PHP legacy bridge](#11-php-legacy-bridge)
12. [Domain module map](#12-domain-module-map)
13. [Print & reporting](#13-print--reporting)
14. [Legacy → modern screen mapping](#14-legacy--modern-screen-mapping)
15. [Security model](#15-security-model)
16. [Testing & quality](#16-testing--quality)
17. [Local development](#17-local-development)
18. [Key file index](#18-key-file-index)

---

## 1. Goals & design principles


| Goal                           | Approach                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Preserve business logic & data | Same MariaDB schema; Prisma introspects existing tables (`db pull`)              |
| Screen-level parity            | Each legacy `.php` page maps to a React route + Express service                  |
| Incremental cutover            | Modules migrate independently; PHP bridge used where Node parity is incomplete   |
| Shared auth & menu             | JWT auth mirrors legacy session/`member_id`; menu driven from legacy menu tables |


**Design principles**

1. **Parity first** — match legacy behavior before modernizing UX.
2. **Thin routes, fat services** — keep HTTP and domain logic separated.
3. **Shared DB** — migrate screens, not the database.
4. **Bridge as escape hatch** — not the long-term default for every screen.
5. **Module hubs** — discoverable navigation mirroring legacy menus.
6. **Print fidelity** — reuse legacy CSS/layout where reports are audited.

---

## 2. High-level system view

```text
┌─────────────────┐     HTTPS/JSON      ┌──────────────────────┐
│  React Client   │ ◄─────────────────► │  Express API Server  │
│  (Vite + BS5)   │   Bearer JWT        │  (Node ≥ 20)         │
└────────┬────────┘                     └──────────┬───────────┘
         │                                         │
         │ static /legacy/*                        │ Prisma / mysql2
         │                                         ▼
         │                              ┌──────────────────────┐
         └─────────────────────────────►│  MariaDB             │
                   images/files         │  apdchedu_cisapp     │
                                        └──────────┬───────────┘
                                                   │
                                        ┌──────────▼───────────┐
                                        │  PHP CLI Bridge      │
                                        │  (optional parity)   │
                                        │  LEGACY_CIS_PATH     │
                                        └──────────────────────┘
```

**Roles**


| Component   | Responsibility                                     |
| ----------- | -------------------------------------------------- |
| React SPA   | UI, routing, JWT storage, print windows            |
| Express API | Auth, menu, domain CRUD/reports, file serving      |
| MariaDB     | Single source of truth (shared with legacy PHP)    |
| PHP bridge  | Exact legacy SQL/HTML for selected screens/widgets |


---

## 3. Repository layout

```text
legacy-cis-modernized/
├── ARCHITECTURE.md         # This document
├── README.md
├── .gitignore
├── sonar-project.properties
├── client/                 # React SPA (Vite)
│   ├── public/
│   │   └── legacy/css/     # Print CSS (exam, salary, style_print, …)
│   └── src/
│       ├── api/            # Axios client
│       ├── auth/           # AuthContext, JWT storage
│       ├── components/     # Shared UI (PageShell, ReportPrintBar, …)
│       ├── layouts/        # App shell, sidebar, top nav
│       ├── pages/          # Feature modules (students, exam, fees, …)
│       ├── routes/         # AppRoutes, ProtectedRoute
│       ├── theme/          # ThemeContext
│       └── utils/          # legacyRoutes, print helpers
├── server/
│   ├── prisma/             # schema.prisma (introspected, ~400+ models)
│   ├── legacy-bridge/      # PHP scripts invoked from Node (~74)
│   ├── scripts/            # Smoke tests, DB utilities
│   ├── .env.example
│   └── src/
│       ├── index.js        # HTTP listen
│       ├── app.js          # Express app + route mounts
│       ├── config/         # env, prisma client, bridge maps
│       ├── middleware/     # auth, menuAuth
│       ├── routes/         # HTTP route modules
│       ├── services/       # Domain logic (one folder per module)
│       └── utils/          # SQL helpers, JWT, selects, dates
├── test/                   # Module CRUD / checklist runners
│   ├── CHECKLIST.md
│   ├── modules/            # Per-domain HTTP tests
│   └── lib/                # client, runner, report helpers
├── docs/                   # Phase notes, auth, payroll, Prisma notes
└── legacy-reference/       # Copied legacy PHP snippets for reference
```

---

## 4. Technology stack


| Layer         | Technology                          | Version / notes                   |
| ------------- | ----------------------------------- | --------------------------------- |
| UI            | React, React DOM                    | `^19.1.0`                         |
| Routing       | react-router-dom                    | `^7.6.2`                          |
| HTTP (client) | axios                               | `^1.9.0`                          |
| CSS           | Bootstrap                           | `^5.3.6`                          |
| Bundler       | Vite + `@vitejs/plugin-react`       | `^6.3.5` / `^4.5.2`               |
| API           | Express                             | `^5.1.0` (ESM `"type": "module"`) |
| ORM           | Prisma + `@prisma/client`           | `6.19.3`                          |
| DB driver     | mysql2                              | `^3.22.5`                         |
| Auth          | jsonwebtoken                        | `^9.0.2`                          |
| Other         | cookie-parser, cors, dotenv, qrcode | —                                 |
| Runtime       | Node.js                             | `>=20.19.0` (`.nvmrc` = `20`)     |
| Database      | MariaDB                             | Existing `apdchedu_cisapp`        |
| Bridge        | PHP CLI                             | 7.4+                              |


Version pins: [docs/node-prisma-versions.md](docs/node-prisma-versions.md)

---

## 5. Runtime & configuration

### Client


| Item         | Detail                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| Dev          | `cd client && npm run dev`                                                                 |
| Build        | `cd client && npm run build`                                                               |
| API base     | `VITE_API_URL` or same-origin; Vite proxies `/api` and `/legacy` → `http://localhost:4000` |
| Auth storage | `localStorage.cis_token`                                                                   |


### Server


| Item   | Detail                                                   |
| ------ | -------------------------------------------------------- |
| Dev    | `cd server && npm run dev` (`node --watch src/index.js`) |
| Prod   | `cd server && npm start`                                 |
| Config | `server/src/config/index.js` + `server/.env`             |


### Environment variables (`server/.env.example`)


| Key                 | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `DATABASE_URL`      | MySQL/MariaDB URL for `apdchedu_cisapp` (+ pool params) |
| `JWT_SECRET`        | JWT signing secret                                      |
| `JWT_EXPIRES_IN`    | e.g. `8h`                                               |
| `PORT`              | API port (default `4000`)                               |
| `CLIENT_URL`        | Primary CORS origin (default `http://localhost:5173`)   |
| `CLIENT_URLS`       | Optional comma-separated extra CORS origins             |
| `LEGACY_FILES_PATH` | Legacy `files/` root                                    |
| `LEGACY_IMG_PATH`   | Legacy `img/` root                                      |
| `LEGACY_CIS_PATH`   | Live PHP tree for bridge                                |


Test env (optional): `TEST_PASSWORD`, `TEST_USER`, `API_URL`, `TEST_MUTATIONS` — see `test/config.js`.

---

## 6. Request & data flow

```text
Browser
  → ProtectedRoute (JWT present?)
  → React page (hub / setup / report)
  → Axios → /api/<module>/...
  → authMiddleware (verify JWT → req.user / member_id)
  → menuAuth (optional module gate)
  → route handler
  → service layer
       ├─ Prisma / $queryRaw (primary path)
       └─ PHP bridge spawn (parity / complex legacy screens)
  → JSON { data, message, html?, printHtml? }
  → React render / print window
```

**Typical setup-screen contract**

1. `GET/POST` load with filter fields → `{ courseYearOptions, selection, rows, printHtml, … }`
2. User changes filters → reload
3. `POST` save → `{ success, message, …reloaded state }`
4. Print bar opens `printHtml` in a new window with legacy CSS

---

## 7. Authentication & authorization

Full narrative: [docs/auth-flow.md](docs/auth-flow.md)

### Login sequence

1. `POST /api/auth/login` with `a_username` / `a_password`
2. Rate limit via recent failed logins in `log_tb` (≥5 → 429)
3. User resolved from `web_account_setup` (`member_id` or email)
4. Password checked with AES-128-CTR (`services/password.js`, parity with legacy `password.php`)
5. `access_tb` day/time/device checks (`accessCheck`)
6. JWT issued (`utils/jwt.js`) with `id`, `memberId`, `memberName`, `accessType`, `sessionId`
7. Audit via `logService.insertLog`

### Client session

- Token stored in `localStorage.cis_token`
- Axios interceptor attaches `Authorization: Bearer <token>`
- `GET /api/auth/me` bootstraps profile for shell
- `401` → clear token → `/login`
- `POST /api/auth/logout` writes audit log

### Authorization


| Layer  | Mechanism                                                              |
| ------ | ---------------------------------------------------------------------- |
| Route  | `authMiddleware` — valid JWT required                                  |
| Module | `menuAuthForModule(key)` — `authentication_tb` + `basic_admin_menu_tb` |
| Bypass | Global `access_type` skips menu checks                                 |
| Bridge | Injects `member_id` into PHP `$_SESSION['empusername_login']`          |


---

## 8. Backend architecture

### Entry points


| File                  | Role                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `server/src/index.js` | Listen on `config.port`; warmers                                      |
| `server/src/app.js`   | CORS, JSON 5mb, cookie-parser, `/legacy` static, route mounts, errors |


### API mounts


| Mount               | Route module            |
| ------------------- | ----------------------- |
| `/api/auth`         | `routes/auth.js`        |
| `/api/settings`     | `routes/settings.js`    |
| `/api/dashboard`    | `routes/dashboard.js`   |
| `/api/menu`         | `routes/menu.js`        |
| `/api/students`     | `routes/students.js`    |
| `/api/staff`        | `routes/staff.js`       |
| `/api/attendance`   | `routes/attendance.js`  |
| `/api/fees`         | `routes/fees.js`        |
| `/api/academic`     | `routes/academic.js`    |
| `/api/exam`         | `routes/exam.js`        |
| `/api/admin`        | `routes/admin.js`       |
| `/api/files`        | `routes/files.js`       |
| `/api/payroll`      | `routes/payroll.js`     |
| `/api/sms`          | `routes/sms.js`         |
| `/api/web`          | `routes/web.js`         |
| `/api/tv`           | `routes/tv.js`          |
| `/api/kiosk`        | `routes/kiosk.js`       |
| `/api/committee`    | `routes/committee.js`   |
| `/api/certificates` | `routes/certificate.js` |
| `/api/naac`         | `routes/naac.js`        |
| `/api/portfolio`    | `routes/portfolio.js`   |
| `/api/elearning`    | `routes/elearning.js`   |
| `/api/library`      | `routes/library.js`     |
| `/api/hostel`       | `routes/hostel.js`      |
| `/api/circular`     | `routes/circular.js`    |
| `/api/admin-office` | `routes/adminOffice.js` |
| `/api/health`       | Inline health check     |


### Service conventions

- Handlers stay thin; logic lives in `server/src/services/<module>/`
- **Load / save** per screen (e.g. `loadExamBatch`, `saveExamBatch`)
- Shared helpers in `services/shared/` and module `*Shared.js` files
- Prefer Prisma where safe; use `$queryRaw` / `$queryRawUnsafe` + `escapeSql` for legacy quirks
- Soft-delete convention: `del = 1` means **active** (legacy)
- Audit helpers log View/Update/Delete against legacy page names (e.g. `exam_batch.php`)

### Middleware


| Middleware          | File                     | Role                           |
| ------------------- | ------------------------ | ------------------------------ |
| `authMiddleware`    | `middleware/auth.js`     | Require valid JWT → `req.user` |
| `menuAuthForModule` | `middleware/menuAuth.js` | Module access like legacy      |


### Utilities


| Utility                  | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `utils/sqlSafe.js`       | `escapeSql`, `parseId`                        |
| `utils/jwt.js`           | Sign / verify tokens                          |
| `utils/legacySelects.js` | Safe Prisma `select` shapes for legacy tables |
| `utils/fileUrls.js`      | Legacy file/image URL helpers                 |
| `utils/toJsonSafe.js`    | Serialize BigInt / Date for JSON              |


---

## 9. Frontend architecture

### Bootstrap

```text
main.jsx
  → App.jsx
       AuthProvider
       ThemeProvider
       BrowserRouter
         AppRoutes
```


| Concern   | Location                                            |
| --------- | --------------------------------------------------- |
| Routes    | `client/src/routes/AppRoutes.jsx`                   |
| Auth gate | `client/src/routes/ProtectedRoute.jsx`              |
| Shell     | `layouts/AppShellLayout.jsx` + `hooks/useShellData` |
| Theme     | `theme/ThemeContext`                                |
| API       | `api/client.js`                                     |


### Module UI pattern

Most modules follow:

1. **Hub** — cards linking to screens (`ExamHub`, `FeeHub`, …)
2. **Setup / Report page** — filters + table + save/print
3. **Meta maps** — `*Meta.js` maps screen slug → title + legacy `.php`
4. **Factories** — `ModuleSetupFactory`, `ExamSetupPage`, curriculum report shell

### Page folders (`client/src/pages/`)


| Folder                                              | Role                            |
| --------------------------------------------------- | ------------------------------- |
| `dashboard/`                                        | Main dashboard + widgets        |
| `students/`, `staff/`                               | Profiles, lists, setup screens  |
| `attendance/`                                       | Staff + student attendance hubs |
| `fees/`, `academic/`, `exam/`, `payroll/`           | Core academic/admin domains     |
| `library/`, `hostel/`, `circular/`, `sms/`          | Supporting campus modules       |
| `admin/`, `adminOffice/`, `settings/`               | Access, office, print setup     |
| `web/`, `tv/`, `kiosk/`, `committee/`               | Portal / display / governance   |
| `certificate/`, `naac/`, `portfolio/`, `elearning/` | Certificates & quality          |
| `reports/`                                          | Cross-module report hub         |


### Shared components

- `PageShell.jsx`, `ListSearchPage.jsx`, `ReportPrintBar.jsx`
- `ChipMultiSelect.jsx`, `LegacyDateInput.jsx`, `HtmlRichTextEditor.jsx`
- `ModuleSetupFactory.jsx` — generic load/save setup screens

---

## 10. Database strategy


| Principle     | Detail                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Shared DB     | MariaDB `apdchedu_cisapp` — **no schema redesign** for migration                                                       |
| Introspection | `npm run db:pull` → `npm run db:generate`                                                                              |
| Migrations    | **None** — no `prisma/migrations`; reuse tables/columns                                                                |
| Schema size   | `server/prisma/schema.prisma` — hundreds of models                                                                     |
| Zero dates    | Legacy `0000-00-00`; see `scripts/normalize-zero-dates.js` and [prisma-studio-legacy.md](docs/prisma-studio-legacy.md) |
| Soft delete   | `del = 1` active; `del = 0` deleted (legacy convention)                                                                |
| Query style   | Prisma models where safe; raw SQL for quirks                                                                           |


**Do not invent new tables** for migrated screens unless a new product feature requires it.

---

## 11. PHP legacy bridge

Used when exact legacy SQL/HTML is required (dashboard widgets, some payroll/fee/config screens, print chunks).

```text
Node service
  → spawn php server/legacy-bridge/<script>.php
  → inject member_id / POST fields (JSON stdin)
  → chdir(LEGACY_CIS_PATH) via _bootstrap.php
  → parse HTML / JSON from stdout
  → return to client
```


| Piece       | Path                                      |
| ----------- | ----------------------------------------- |
| Runner      | `server/src/services/legacy/phpBridge.js` |
| Bootstrap   | `server/legacy-bridge/_bootstrap.php`     |
| Screen maps | `server/src/config/bridgeScreenMaps.js`   |
| Scripts     | `server/legacy-bridge/*.php` (~74)        |


Bridge is an **escape hatch**. Prefer native Node services as parity is proven.

---

## 12. Domain module map


| Domain            | Modern entry          | API prefix                   | Example legacy                        |
| ----------------- | --------------------- | ---------------------------- | ------------------------------------- |
| Auth / Settings   | `/login`, `/settings` | `/api/auth`, `/api/settings` | `index.php`, `print_setup.php`        |
| Dashboard         | `/dashboard`          | `/api/dashboard`             | `dashboard.php`, `dashboard_more.php` |
| Students          | `/students/`*         | `/api/students`              | `student_profile_edit.php`            |
| Staff             | `/staff/*`            | `/api/staff`                 | `staff_profile_edit.php`              |
| Attendance        | `/attendance/*`       | `/api/attendance`            | Student/staff att reports             |
| Fees              | `/fees/*`             | `/api/fees`                  | Collection, slips, setup              |
| Academic          | `/academic/*`         | `/api/academic`              | Subjects, batches, timetable          |
| Exam              | `/exam/*`             | `/api/exam`                  | `exam_batch.php`, term exams          |
| Payroll / Stipend | `/payroll/*`          | `/api/payroll`               | Payslips, stipend suite               |
| Admin             | `/admin/*`            | `/api/admin`                 | Accounts, access, logs                |
| Admin Office      | `/admin-office/*`     | `/api/admin-office`          | Activities, courier, events           |
| Library           | `/library/*`          | `/api/library`               | Books, transactions                   |
| Hostel            | `/hostel/*`           | `/api/hostel`                | Blocks, rooms, transport              |
| Circular          | `/circular/*`         | `/api/circular`              | Setup / approve / print               |
| SMS               | `/sms/*`              | `/api/sms`                   | Student/staff/group SMS               |
| Web               | `/web/*`              | `/api/web`                   | Website content                       |
| TV                | `/tv/*`               | `/api/tv`                    | TV dashboard                          |
| Kiosk             | `/kiosk/*`            | `/api/kiosk`                 | Machines, attendance kiosk            |
| Committee         | `/committee/*`        | `/api/committee`             | Events / tasks                        |
| Certificates      | `/certificates/*`     | `/api/certificates`          | TC, internship, aaadar                |
| NAAC              | `/naac/*`             | `/api/naac`                  | NAAC screens                          |
| Portfolio         | `/portfolio/*`        | `/api/portfolio`             | Dashboard + reports                   |
| E-learning        | `/elearning/*`        | `/api/elearning`             | Setup + dashboard                     |
| Reports hub       | `/reports`            | (deep-links)                 | Aggregates module reports             |
| Files             | `/legacy/…`           | `/api/files`                 | Static + JWT download                 |


Phase status: [docs/migration-progress.md](docs/migration-progress.md) (prefer phase docs + code over outdated “Pending” rows).

---

## 13. Print & reporting

1. **Server** returns HTML (`printHtml`, report body, or full document) from Node SQL or PHP bridge.
2. **Client** opens a print window via `printReportHtml` / module helpers in `client/src/utils/printReport.js`.
3. **Legacy CSS** under `client/public/legacy/css/` (`style_print.css`, `exam.css`, `salary.css`, `att_card.css`, …).
4. **Module printers** — e.g. `examDashboardPrint.js`, `examSchedulePrint.js`, `attendanceReportPrint.js`.
5. **UI** — `ReportPrintBar.jsx`; hubs deep-link into module reports.
6. **Exports** — some payroll/student reports also Excel via bridge/legacy PHP.

**Parity rule:** Match the specific legacy file’s layout (e.g. `exam_batch.php` ≠ `term_exam_setup.php` course dropdowns).

---

## 14. Legacy → modern screen mapping

Canonical map: `client/src/utils/legacyRoutes.js` (~457 PHP → React paths).

Per-module metas (slug → title + legacy file):


| Meta file                                     | Module                 |
| --------------------------------------------- | ---------------------- |
| `examSetupMeta.js`                            | Exam setup/reports     |
| `academicSetupMeta.js`                        | Academic setup/reports |
| `feeModuleMeta.js`                            | Fees                   |
| `payrollSetupMeta.js`                         | Payroll                |
| `studentModuleMeta.js` / `staffModuleMeta.js` | Students / staff       |
| Attendance metas under `pages/attendance/`    | Staff & student att    |


**Key conventions preserved from legacy**

- Course keys: `courseId___academicYear___academicType` or `courseName___year___type`
- Optgroups / year loops from `basic_setup_tb` + `exam_academic_year`
- Soft-delete and audit columns (`created_`*, `updated_*`)

---

## 15. Security model


| Concern        | Implementation                                       |
| -------------- | ---------------------------------------------------- |
| Authentication | JWT after login; AES password compatible with legacy |
| Authorization  | Menu/module checks; Global access bypass             |
| SQL injection  | `escapeSql` / careful raw queries                    |
| CORS           | Allowlist of client origins                          |
| Secrets        | `.env` gitignored; never commit tokens/PATs          |
| Audit          | `log_tb` for login and setup actions                 |
| Files          | JWT-gated downloads via `/api/files` where required  |


---

## 16. Testing & quality


| Tool           | Command / path                                   | Purpose                           |
| -------------- | ------------------------------------------------ | --------------------------------- |
| Module smoke   | `cd server && npm run test:all`                  | `scripts/run-all-module-tests.js` |
| CRUD checklist | `cd server && npm run test:crud`                 | `test/run.js` → `CHECKLIST.md`    |
| Exam smoke     | `npm run smoke:exam-elearning`                   | Exam / e-learning                 |
| Latency JSON   | `npm run test:latency`                           | Smoke with JSON output            |
| Manual         | Compare UI/print vs `/home/mapims/cis/cis/*.php` | Parity                            |


**Test defaults:** read-only HTTP checks. Mutations require `TEST_MUTATIONS=1`.

Sonar: `sonar-project.properties` at repo root.

---

## 17. Local development

```bash
# Terminal 1 — API
cd server && npm install && npm run dev
# → http://localhost:4000

# Terminal 2 — UI
cd client && npm install && npm run dev
# → http://localhost:5173  (proxies /api + /legacy)
```

**Requirements**

- Node ≥ 20.19
- MariaDB reachable via `DATABASE_URL`
- PHP 7.4+ if using dashboard/bridge features (`LEGACY_CIS_PATH`)

**Keep Prisma in sync (no migrate)**

```bash
cd server && npm run db:pull && npm run db:generate
```

**Production sketch**

```bash
cd client && npm run build
cd server && npm start
```

Serve the client build behind the same origin or configure `CLIENT_URL` / CORS accordingly. Docker/go-live packaging is still evolving (see migration docs).

---

## 18. Key file index


| Concern                | Path                                               |
| ---------------------- | -------------------------------------------------- |
| This architecture      | `ARCHITECTURE.md`                                  |
| Auth narrative         | `docs/auth-flow.md`                                |
| App bootstrap (client) | `client/src/App.jsx`, `client/src/main.jsx`        |
| App bootstrap (server) | `server/src/index.js`, `server/src/app.js`         |
| Client routes          | `client/src/routes/AppRoutes.jsx`                  |
| Server routes          | `server/src/routes/*.js`                           |
| Legacy PHP → React map | `client/src/utils/legacyRoutes.js`                 |
| Bridge map             | `server/src/config/bridgeScreenMaps.js`            |
| Bridge runner          | `server/src/services/legacy/phpBridge.js`          |
| Prisma schema          | `server/prisma/schema.prisma`                      |
| Env template           | `server/.env.example`                              |
| Print helpers          | `client/src/utils/printReport.js`                  |
| Exam batch (example)   | `server/src/services/exam/setup/examBatchSetup.js` |
| README                 | `README.md`                                        |


---

## aAppendix A — Parity workflow (recommended)

```text
1. Identify legacy PHP screen (e.g. exam_batch.php)
2. Map filters, SQL, save, print
3. Implement service load/save (+ shared option builders)
4. Wire route + React page / meta / hub link
5. Add legacyRoutes entry if menu-driven
6. Smoke-test against live DB
7. Compare UI + print side-by-side with legacy
8. Prefer removing bridge once Node output matches
```

## Appendix B — Soft-delete & academic keys

```text
del = 1  → row is active (legacy)
del = 0  → row is deleted

Course year key examples:
  12___2025-2026___regular     (course_id based — exam_batch.php)
  U.G___2025-2026___regular    (course_name based — term_exam_setup.php)
```

Always match the **specific** legacy file’s key format and dropdown grouping.