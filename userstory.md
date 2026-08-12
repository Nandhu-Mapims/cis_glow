# New CIS — User Stories

> Derived from [NEW_CIS_FULL_FLOW.md](NEW_CIS_FULL_FLOW.md) (module/API/flow inventory) and
> [CLAUDE.md](CLAUDE.md) (business rules). Organized by module, in "As a **&lt;role&gt;**, I want
> **&lt;capability&gt;**, so that **&lt;benefit&gt;**" form, with acceptance notes tying each story
> back to the actual screens/endpoints that implement it.

---

## 1. Actors / personas

| Role | Description |
|---|---|
| **Super Admin** (`accessType = Global`) | Bypasses all per-menu checks; only role that can write in the Admin module. |
| **Admin / Office Staff** | Day-to-day data entry across students, staff, fees, attendance. |
| **Department HOD / Staff** | Restricted to their own department's students/staff via Dept Authentication. |
| **Accountant / Fee Staff** | Fee collection, approvals, scholarships, pending-fee follow-up. |
| **Exam Cell** | Exam batch/schedule setup, marks entry, no-due, marksheets. |
| **Payroll / HR** | Staff attendance-linked salary, stipend, payroll reports. |
| **Librarian** | Book catalogue, issue/return, library reports. |
| **Hostel Warden** | Hostel allocation and related setup screens. |
| **Committee Coordinator** | Committee membership and access screens. |
| **Student** | End record subject of most modules; not a direct app login persona in this system, but the data owner. |
| **Parent / Guardian** | Recipient of SMS/communication (fee reminders, attendance alerts). |
| **IT / System Owner** | Manages menu, access windows, device/day-time login restrictions, print/report parity. |

---

## 2. Authentication & session

- As any **staff user**, I want to log in with my username/email and password so that I can access only the modules I'm authorized for.
  - *Backed by:* `POST /api/auth/login` (`routes/auth.js`) — looks up `web_account_setup`, decrypts the stored password (AES-128-CTR, byte-compatible with legacy `password.php`), checks `access_tb` day/time/device rules via `accessCheck()`.
- As a **user with 5+ failed login attempts**, I want to be temporarily locked out so that brute-force attempts are throttled.
  - *Backed by:* `countRecentFailedLogins()` + 429 response, mirrors legacy's 5-minute lockout.
- As a **logged-in user**, I want my session to persist across page reloads so that I don't have to log in every time I refresh.
  - *Backed by:* `localStorage.cis_token` + `GET /api/auth/me` rehydration in `AuthContext.jsx`.
- As a **user whose token has expired or is invalid**, I want to be redirected to the login page automatically so that I'm not stuck on a broken screen.
  - *Backed by:* Axios response interceptor, 401 → clear token → `/login`.
- As a **user**, I want to log out and have that action recorded so that there's an audit trail of session activity.
  - *Backed by:* `POST /api/auth/logout` writes to `log_tb`.
- As **IT/System Owner**, I want each user's login restricted to certain days/times/devices so that access outside approved hours is blocked.
  - *Backed by:* `access_tb` gate in `accessCheck()`, evaluated at login only.

---

## 3. Menu & navigation

- As a **staff user**, I want to see only the menu items I'm authorized for so that I'm not confused by screens I can't use.
  - *Backed by:* `GET /api/menu` — `authentication_tb` ⋈ `basic_admin_menu_tb`, filtered by `del=1`, `menu_enable=1`; **Global** users see everything.
- As a **Super Admin**, I want to bypass per-menu authorization checks so that I always retain full administrative visibility.
  - *Backed by:* `accessType === 'Global'` bypass in `menuAuthForModule` and `GET /api/menu`.
- As a **user**, I want a search/command palette to jump straight to a screen by name so that I don't have to click through nested menus.
  - *Backed by:* `CommandPalette*.jsx` (⌘K-style navigation).
- As a **user clicking an old/legacy menu link that hasn't been modernized yet**, I want a clear "migration pending" placeholder instead of a broken page so that I understand the screen isn't available yet.
  - *Backed by:* `LEGACY_ROUTE_MAP` unmapped-link fallback in `legacyRoutes.js`.

---

## 4. Dashboard

- As any **logged-in user**, I want a dashboard summarizing student/staff strength, attendance, and fee widgets so that I get an at-a-glance view of the institution.
  - *Backed by:* `GET /api/dashboard`, `/widgets`, `/student`, `/staff-pattern`, `/overall-strength`, `/community-strength`.
- As an **Admin**, I want dashboard widgets refreshed automatically on server startup so that the first user of the day doesn't wait on a cold cache.
  - *Backed by:* background warm-up `loadExamDashboard('SYSTEM', { refresh: true })` in `server/src/index.js`.

---

## 5. Students module

- As an **Admin**, I want to search for a student by name/register number/course so that I can quickly locate their record.
  - *Backed by:* `GET /api/students/search`.
- As an **Admin**, I want to add a new student's profile so that they're enrolled in the system.
  - *Backed by:* `POST /api/students/`.
- As an **Admin**, I want to view and edit a student's full profile so that records stay accurate over their time at the college.
  - *Backed by:* `GET/PUT /api/students/:id`.
- As an **Admin**, I want to upload and view a student's attachments (photos, certificates) so that supporting documents are centrally stored.
  - *Backed by:* `GET /api/students/:id/attachments`, multipart upload endpoints.
- As an **Admin**, I want an active-students-only view (excluding relieved/left students) so that reports reflect the current roll.
  - *Backed by:* `(releaving_date='0000-00-00' OR releaving_date > CURRENT_DATE)` filter convention (per CLAUDE.md).
- As an **Admin**, I want to filter students by course/academic year using the correct dropdown (course-id vs. course-name keyed, depending on screen) so that I don't get empty or wrong-course results.
  - *Backed by:* `buildCourseIdYearOptions` / `buildCourseYearOptions` (§6 of the flow doc).
- As an **Admin**, I want student ID cards, promotion, and alumni screens so that I can manage the full student lifecycle, not just admission data.
  - *Backed by:* `client/src/pages/students/` (ID card, promotion, alumni pages).

---

## 6. Staff module

- As an **Admin**, I want to add and search staff profiles, mirroring the student workflow, so that HR data entry is consistent across the app.
  - *Backed by:* `GET /api/staff/search`, `POST /api/staff/`, `GET/PUT /api/staff/:id`.
- As an **Admin**, I want a dedicated staff-admission options screen (departments, designations) so that dropdowns during onboarding are accurate.
  - *Backed by:* `GET /api/staff/admission/options`.
- As an **Admin**, I want to manage staff attachments (experience, education, ID proofs) so that HR documentation is complete and retrievable.
  - *Backed by:* `services/staff` attachment handlers, `staff_dept_master`/`staff_desg_master` tables.

---

## 7. Attendance module

- As a **Department Staff**, I want to mark daily student attendance and generate reports so that absentee tracking is accurate.
  - *Backed by:* `GET /api/attendance/students/filters`, `POST/PUT /api/attendance/students/daily`, `POST /api/attendance/students/report/generate`.
- As **Payroll/HR**, I want to manage staff attendance calendars and punch records so that salary calculations reflect actual presence.
  - *Backed by:* `POST /api/attendance/staff/calendar`, `POST /api/attendance/staff/punch`, `POST /api/attendance/staff/report`.
- As an **Admin**, I want student and staff attendance handled as separate concerns (different tables/screens) so that each workflow's edge cases (leave, half-day, biometric punch) are handled correctly without cross-contamination.
  - *Backed by:* `attendanceStaff.js` vs. `attendanceStudent.js` service split.

---

## 8. Fees module

- As **Accountant**, I want to collect fees against a student's fee sheet and record the payment so that dues are settled and receipted.
  - *Backed by:* `POST/PUT /api/fees/collection/sheet`.
- As **Accountant**, I want to raise a fee-collection delete request and have it separately approved by a supervisor so that fee corrections have a two-person audit trail.
  - *Backed by:* `POST /api/fees/delete/requests`, `POST /api/fees/delete/approve`.
- As **Accountant**, I want to view/print approved fee slips so that students have proof of payment.
  - *Backed by:* `GET /api/fees/slips/approved`.
- As **Accountant**, I want to send SMS reminders and generate pending-fee letters for students with outstanding dues so that collections improve without manual follow-up per student.
  - *Backed by:* `POST /api/fees/pending-sms/send`, `POST /api/fees/pending-letter/generate`, fee-class dropdowns from `feeCourseYearGroups.js`.
- As **Accountant**, I want scholarship/DME/ACMEC fee configuration screens so that concession-based fee structures are handled without hardcoding.
  - *Backed by:* `feeDmeSetup.js`, `feeScholarshipSetup.js`, `feeAcmecScholarshipSetup.js`, `feeAcmecConfig.js`.
- As **Accountant**, I want fee dashboards and historical reports so that I can track collection trends over the term/year.
  - *Backed by:* `feeDashboard.js`, `feeHistory.js`, `feeReport.js`.

---

## 9. Academic module

- As an **Admin**, I want to manage courses, subjects, rooms, and blocks so that the academic structure is correctly modeled before timetabling.
  - *Backed by:* `academicSetupShared.js`, `GET /api/academic/courses`.
- As an **Admin**, I want to configure timetables (v1 and v3) so that class scheduling matches the current academic term.
  - *Backed by:* `POST /api/academic/tt-config/more`, `/tt-config-v3/more`.
- As an **Admin**, I want academic-year and course dropdowns sourced from a single config table (`basic_setup_tb` + `basic_setup_course_tb`) so that every screen agrees on what "this year" and "active courses" mean.
  - *Backed by:* `loadAcademicConfig()` (`ciaSetupHelpers.js`).

---

## 10. Exam module

- As **Exam Cell**, I want to allocate exam batches per department using course-id-keyed dropdowns so that batch letters/rosters match the legacy `exam_batch.php` behavior exactly.
  - *Backed by:* `buildCourseIdYearOptions`, `services/exam/setup/examBatchSetup.js`, table `cia_batch_tb`.
- As **Exam Cell**, I want a separate term-exam-setup screen keyed by course name (not course id) so that U.G./P.G.-level exam setup doesn't get confused with per-department batch allocation.
  - *Backed by:* `buildCourseYearOptions`, `services/exam/setup/termExamSetup.js`, table `cia_setup`.
- As **Exam Cell**, I want to enter marks, print schedules/marksheets, and manage no-due clearance so that the full exam lifecycle (setup → marks → clearance → results) is covered in one module.
  - *Backed by:* `cia_marks_tb`, `cia_exam_nodue`, `GET /api/exam/marksheet/print`, `examSchedulePrint.js`.
- As **Exam Cell**, I want a student-wise exam statement so that I can review one student's exam history without pulling multiple reports.
  - *Backed by:* `POST /api/exam/student-statement`.
- As **Exam Cell / Admin**, I want an exam dashboard with warmed-up (pre-cached) data so that the dashboard loads fast even right after server restart.
  - *Backed by:* `GET /api/exam/dashboard`, background warm-up job.

---

## 11. Admin module (accounts, access, security)

- As a **Super Admin**, I want to add/edit user accounts and their access type (Global vs. Limit) so that I control who has elevated privileges.
  - *Backed by:* `services/admin/setup/accountSetup.js`, `access_type` column on `web_account_setup`.
- As a **Super Admin**, I want to define per-department authentication (which users see which department's students/staff) so that HODs only see their own department's data.
  - *Backed by:* `deptAuthSetup.js`/`deptAuthV1Setup.js`, screen `Department Authentication`.
- As a **Super Admin**, I want to define per-menu authentication for non-Global users so that each account's sidebar reflects exactly what they're allowed to open.
  - *Backed by:* `menuAuthSetup.js`, `authentication_tb`.
- As a **Super Admin**, I want to restrict dashboard widgets and committee access per user so that sensitive summaries aren't visible to everyone with an admin login.
  - *Backed by:* `dashboardAccessSetup.js`, `committeeAccessSetup.js`.
- As a **Super Admin**, I want to force a password reset for selected accounts, setting their login password to a known value, so that I can regain control of an account or hand out a fresh credential without knowing the user's old password.
  - *Backed by:* `services/admin/setup/otpAccountResetSetup.js` (`otp_account_reset.php` parity) — sets `password` (encrypted) + `reset_password` flag, forcing the OTP/change-password flow on next login.
- As a **Super Admin**, I want to see the actual current login password for any account so that I can verify or communicate credentials without guessing.
  - *Backed by:* `loadOtpAccountReset` decrypting `web_account_setup.password`, gated to `accessType === 'Global'` only.
- As a **Non-Global admin-menu user**, I want read-only access to the Admin module screens (view but not save) so that I can review configuration without risking accidental changes.
  - *Backed by:* `requireGlobalWrite` middleware in `routes/admin.js` — load allowed for anyone with admin menu access, save restricted to Global.
- As a **Super Admin**, I want role-manager and assign-roles screens so that permission sets can be defined once and assigned to multiple accounts instead of configuring each user individually.
  - *Backed by:* `roleManagerSetup.js`, `assignRolesSetup.js`.
- As **IT/System Owner**, I want a login-attempt log dashboard and drill-down details so that I can investigate suspicious or failed login activity.
  - *Backed by:* `GET/POST /api/admin/log-dashboard`, `/log-details`.

---

## 12. Payroll module

- As **Payroll/HR**, I want to generate payroll runs tied to staff attendance so that salary reflects actual days worked/leave taken.
  - *Backed by:* `POST /api/payroll/generate-payroll`.
- As **Payroll/HR**, I want individual and consolidated payroll reports, plus bundled individual reports, so that I can hand out payslips and reconcile totals for finance.
  - *Backed by:* `/individual-report`, `/consolidated-report`, `/individual-bundle`.
- As **Payroll/HR**, I want a separate stipend workflow (for interns/PG students receiving a stipend rather than a salary) so that stipend and salary payroll don't get mixed in the same calculation.
  - *Backed by:* `/stipend/*` endpoints, `stipend*` service files.
- As **Payroll/HR**, I want a payroll dashboard summarizing recent runs so that I can spot anomalies before disbursement.
  - *Backed by:* `GET /api/payroll/dashboard`.

---

## 13. Library module

- As a **Librarian**, I want to catalogue books (add/edit/categorize) so that the library inventory is searchable and accurate.
  - *Backed by:* Library setup screens — Book Add/Edit/Category.
- As a **Librarian**, I want to issue and return books against a student/staff ID so that circulation is tracked and overdue items are visible.
  - *Backed by:* Transaction Issue/Return screens.
- As a **Librarian**, I want barcode-based resource lookup and reporting so that check-in/out is fast at the circulation desk.
  - *Backed by:* Resources Barcode/Report screens.
- As a **Librarian**, I want library attendance and dashboard reports so that footfall and usage trends are visible to administration.
  - *Backed by:* Library Entry/Attendance/Dashboard/Report screens.

---

## 14. Hostel module

- As a **Hostel Warden**, I want hostel setup screens (blocks, rooms, allocation) driven by the generic setup factory so that hostel administration doesn't require bespoke development for each sub-screen.
  - *Backed by:* `/api/hostel/setup/:screen/load|save`, `ModuleSetupFactory`-driven pages.

---

## 15. Committee, certificates, NAAC, portfolio, e-learning

- As a **Committee Coordinator**, I want to manage committee membership and per-committee access so that only assigned members/coordinators can view or edit that committee's data.
  - *Backed by:* `committeeAccessSetup.js`, `/api/committee/setup/:screen/load|save`.
- As an **Admin**, I want to issue certificates through a standard setup-factory flow so that new certificate types can be added without custom frontend work.
  - *Backed by:* `/api/certificates/setup/:screen/load|save`.
- As an **Admin/NAAC Coordinator**, I want NAAC-related data entry screens so that accreditation documentation is centralized in CIS rather than scattered spreadsheets.
  - *Backed by:* `/api/naac/setup/:screen/load|save`.
- As an **Admin**, I want a portfolio dashboard and individual student portfolio report so that a student's extracurricular/academic portfolio can be reviewed in one place.
  - *Backed by:* `POST /api/portfolio/dashboard/load`, `/individual-report/load`, `GET /individual-report/student/:studentId`.
- As an **Admin/Faculty**, I want an e-learning dashboard and setup screens so that e-learning resources/participation can be tracked alongside the rest of student data.
  - *Backed by:* `GET /api/elearning/dashboard`, `/setup/:screen/load|save`.

---

## 16. Communication — SMS, circular, web CMS, TV/kiosk displays

- As an **Admin**, I want to configure and send SMS campaigns (fee reminders, attendance alerts, general notices) so that parents/students are notified without manual calls/texts.
  - *Backed by:* `/api/sms/setup/:screen/load|save`.
- As an **Admin**, I want to publish circulars visible across the institution so that announcements reach staff/students consistently.
  - *Backed by:* `/api/circular/setup/:screen/load|save`.
- As a **Website Admin**, I want a CMS-style setup for the public website content so that non-technical staff can update the public site without a developer.
  - *Backed by:* `/api/web/setup/:screen/load|save`.
- As an **Admin**, I want to configure what displays on campus TV screens and kiosks so that digital signage content is managed centrally.
  - *Backed by:* `GET /api/tv/dashboard`, `/api/tv/setup/:screen/load|save`, `/api/kiosk/setup/:screen/load|save`.

---

## 17. Admin Office module

- As **Admin Office Staff**, I want generic setup screens plus a participant lookup so that office-level record-keeping (meetings, correspondence, participant tracking) is supported without a bespoke module.
  - *Backed by:* `/api/admin-office/setup/:screen/load|save`, `POST /api/admin-office/lookup-participants`.

---

## 18. Print & reports (cross-cutting)

- As any **module user** (Exam Cell, Accountant, Payroll, Admin), I want to print reports/slips/marksheets that visually match the legacy PHP printouts so that printed documents remain consistent for students, parents, and auditors across the transition.
  - *Backed by:* server-built `printHtml`/`reportHtml` + `<ReportPrintBar />` + `printReportHtml()` injecting legacy CSS from `/legacy/css/...`.
- As a **user**, I want the print window to actually trigger `window.print()` reliably so that I don't have to manually use the browser's print menu.
  - *Backed by:* explicit rule — print windows are **never** opened with `window.open(..., 'noopener')`, which breaks `win.print()`.
- As an **Admin/Exam Cell/Payroll user**, I want cross-module report links gathered in one Reports hub so that I don't need to remember which module owns which report.
  - *Backed by:* `client/src/pages/reports/` hub.

---

## 19. File uploads & downloads (cross-cutting)

- As an **Admin**, I want to upload student/staff photos and attachments and have them stored in the same directory layout the legacy PHP app uses so that both apps can read the same files without duplication or migration.
  - *Backed by:* `config/fileStorageMap.js`, multipart upload endpoints on `students`/`staff`/`certificates`.
- As a **user**, I want to download a previously uploaded file (photo, certificate, attachment) via a stable link so that I can retrieve documents without knowing the underlying storage path.
  - *Backed by:* `GET /api/files/map`, `GET /api/files/*` catch-all resolver.

---

## 20. Non-functional / platform stories

- As **IT/System Owner**, I want the modern app to read/write the **same** MariaDB database as the legacy PHP app (no schema fork) so that both systems stay in sync during the module-by-module migration.
  - *Backed by:* shared `apdchedu_cisapp` DB, `npm run db:pull && npm run db:generate` (no Prisma migrations).
- As **IT/System Owner**, I want an escape-hatch PHP bridge for screens not yet fully ported so that unported functionality keeps working during the transition instead of blocking a whole module's rollout.
  - *Backed by:* `runLegacyBridge()`, ~74 bridge scripts, explicit "prefer rewriting once verified" direction.
- As **IT/System Owner**, I want zero dates (`0000-00-00`) handled safely everywhere so that legacy data doesn't crash Prisma-backed screens.
  - *Backed by:* `normalizeLegacyDate`/`sqlDateOrNull` in `sqlSafe.js`, raw-SQL fallback pattern.
- As **IT/System Owner**, I want every setup-screen save to write an audit log entry under the legacy page name so that audit history is continuous across the legacy→modern transition, not reset to zero.
  - *Backed by:* `auditFields()` + `log_tb` writes keyed by legacy `.php` filename.
- As **IT/System Owner**, I want graceful shutdown (drain in-flight requests, close DB pool) so that deploys don't corrupt in-flight writes.
  - *Backed by:* `SIGTERM`/`SIGINT` handler in `server/src/index.js`.
- As **IT/System Owner**, I want the app deployable via Docker Compose (backend + frontend services) so that production rollout is reproducible.
  - *Backed by:* `docker-compose.yml` — `backend` (host network, `PORT=2003`), `frontend` (nginx, `1003:1003`).

---

## 21. Traceability — where to verify each story

| Story area | Verify against |
|---|---|
| Any endpoint referenced above | [NEW_CIS_FULL_FLOW.md](NEW_CIS_FULL_FLOW.md) §4 (router table), §5 (services) |
| Exact legacy behavior for a given screen | matching `.php` file under `/home/mapims/cis/cis/` — source of truth |
| Course/academic-year dropdown correctness | [CLAUDE.md](CLAUDE.md) "Course / academic year key formats" table |
| Soft-delete/audit conventions | [CLAUDE.md](CLAUDE.md) "Soft-delete & audit" |
| Login/session narrative | [docs/auth-flow.md](docs/auth-flow.md) |
| Legacy-vs-modern comparison | [OLD_CIS_FULL_FLOW.md](OLD_CIS_FULL_FLOW.md) |
