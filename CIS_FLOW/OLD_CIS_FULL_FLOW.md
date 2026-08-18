# OLD_CIS_FULL_FLOW.md — Legacy CIS: Full Application Flow (Module-Wise)

> Companion to [NEW_CIS_FULL_FLOW.md](NEW_CIS_FULL_FLOW.md) (modernized app at
> `/home/mapims/cis/legacy-cis-modernized/`). This document covers the **legacy
> PHP** app at `/home/mapims/cis/cis/` (`LEGACY_CIS_PATH`) — the source of truth
> for behavior when porting any screen (per [CLAUDE.md](CLAUDE.md)). It is a
> read-only survey: nothing here was changed, and nothing in the legacy app
> should be changed as part of the modernization effort.
>
> **Scale:** 6,317 `.php` files total, 961 directly at the webroot. No MVC
> framework, no ORM, no templating engine, no build pipeline — every screen is
> a single `.php` file mixing raw `mysqli_query()` SQL, business logic, and
> inline HTML/JS, reused only via `include`/`require` of a few shared shell
> files and `_more.php` AJAX-partial siblings.

---

## 1. Bootstrap / core files

| File | Role |
|---|---|
| `index.php` (497 lines) | The admin/staff login page **and** the login-processing logic (POST branch handled in the same file). |
| `config.php` | DB connection (`mysqli_connect`, global handle `$GLOBALS["__CIS_MYSQLI"]`) + institution branding constants pulled from `basic_setup_tb`. |
| `password.php` | `encrypt()`/`decrypt()` — **AES-128-CTR, reversible**, hardcoded key `igrapixkey1` / IV `1234567891011121`. Not a hash — passwords are decrypted and string-compared, not verified. |
| `log.php` | `insert_log($log_object)` → writes `log_tb` (page, operation, status, description, timestamp, ip, os, username, session id). Also handles a "Print Screen" tracking hit when called directly with `?flag=1&p_k=true`. |
| `widget.php` (736 lines) | Loaded at the top of nearly every protected page. Re-does `session_start()`, falls back to a `Cron` pseudo-user if no session (so cron-invoked scripts don't fatal), loads the logged-in user's display name/photo from `web_account_setup`, and builds the CSS/JS `<link>`/`<script>` tag arrays used by the page shell (`$basic_style_details_array`, `$basic_js_details_array`) — a manual asset bundle, not a build step. |
| `header.php` (85 lines) | **The actual auth guard**: `session_start(); if(!$_SESSION['empusername_login']){ header("location:logout"); }`. Also renders the top nav bar (branding, last-login timestamp from `log_tb`, search, user dropdown). |
| `sidebar.php` (313 lines) | Left nav menu, driven by the same `basic_admin_menu_tb` / `admin_menu_category_tb` / `authentication_tb` tables used for the post-login redirect in `index.php`. |

A curated copy of these core files (plus a few student-profile examples) already
lives at `legacy-cis-modernized/legacy-reference/` — verified byte-identical to
the live legacy files; useful as an offline reference without touching
`LEGACY_CIS_PATH`.

### 1.1 Canonical protected-page skeleton

```php
include('widget.php');   // session/user context + CSS/JS asset arrays
...
require('header.php');   // auth guard + topbar (redirects to logout if not authed)
...
require('sidebar.php');  // left nav
...
// page-specific HTML/PHP body, often with a matching <page>_more.php
// sibling that the page's own inline JS calls via AJAX for report bodies
```

`_more.php` companion files (AJAX partial-render endpoints) don't rely on the
shared `header.php` guard — they duplicate the check inline:

```php
session_start();
if(!$_SESSION['empusername_login']){ header("location:logout"); }
include('widget.php');
```

---

## 2. Login flow (root admin app) — step by step

1. **`index.php`** starts the session, clears prior login vars, `ob_start()`.
2. Includes `config.php` (DB + branding), `log.php` (audit), `password.php` (decrypt).
3. Loads `basic_setup_tb` for `time_zone`, sets `date_default_timezone_set`.
4. **Enforces HTTPS** — hard `exit` if `$_SERVER["HTTPS"] != "on"`.
5. **Brute-force guard**: counts `log_tb` rows where `log_page='index'` and `log_status != 'Successful'` in the last 5 minutes; ≥5 → blocks login with a "temporarily disabled" message (same rule the modern app's `loginRequestLimiter` + `countRecentFailedLogins()` reproduce — see NEW_CIS_FULL_FLOW.md §3).
6. **"Remember me" / returning-session shortcut**: if `$_SESSION['empusername_login']` is already set (from a prior cookie-backed session), re-validates against `web_account_setup` and redirects straight to `dashboard.php` (or `otp_request.php` if `reset_password` is pending) — skips the credential form entirely.
7. **POST branch**: reads `a_username` / `a_password`, looks up `web_account_setup` by `member_id` OR `address_email`, `decrypt()`s the stored password, string-compares to the submitted password.
8. **`access_check()`** (a local function defined at the bottom of `index.php`, not a separate file):
   - `access_type` of `admin`/`Global` → auto-allow.
   - Otherwise queries `access_tb` for day-of-week / date-window / device-cookie restriction rows keyed by `user_id`.
   - When `local_access = 1`, does device fingerprinting via four rotating cookie/random-id pairs (`random_id_1..4`), persisted back into `access_tb`.
   - Every attempt — success or failure — is logged via `insert_log()`.
9. **On success**: sets `$_SESSION['empusername_login']`, `empuserid_login`, `empuserauth_login`, `accessid_login`, `access_type = 'admin'`; redirects to `dashboard.php`, or — for non-Global users with no default landing page — resolves the first allowed menu link by joining `basic_admin_menu_tb` ⋈ `admin_menu_category_tb` ⋈ `authentication_tb`.
10. Login form itself (Bootstrap 4, username/password) is plain HTML appended after the PHP logic in the same file — no separate view/template.

### 2.1 Three independent login systems in one webroot

| Portal | Session key | Directory | Notes |
|---|---|---|---|
| Admin/staff-management app | `$_SESSION['empusername_login']` | webroot (`index.php`) | The app documented above; what most root-level `.php` screens guard against. |
| Staff self-service portal | `$_SESSION['stclgusername_login']` | `staff/` (111 files) | Own `config.php` (same DB, same credentials), own login page. |
| Staff self-service (redesign) | — | `staff_new/` (110 files) | Near-duplicate filename set to `staff/` — an in-flight redesign kept side-by-side with the original, not yet cut over. |
| Student self-service portal | reads `stclgusername_login`, writes `suclgusername_login` on success | `student/` (100 files) | Own `config.php`. The read/write session-key mismatch on entry looks like a copy-paste artifact from the staff portal — worth double-checking if a student-portal port is ever undertaken. |
| Alumni portal | own session (not fully verified) | `alumni/` (18 files) | `alumni_login.php`, `alumni_forgot_password.php`. |

All five share the **same** MariaDB database (`apdchedu_cisapp`) and DB
credentials, but a login in one portal does not authenticate you in another —
they are fully independent session domains that happen to read/write
overlapping tables.

---

## 3. Directory inventory

Non-asset top-level directories under `/home/mapims/cis/cis/` (excludes
`css/`, `js/`, `img/`, `assets*/`, `fonts/`):

| Dir | Files | What it is |
|---|---|---|
| *(webroot itself)* | 961 `.php` | The main admin/staff-management app — nearly every module's primary screens live here directly. |
| `alumni/` | 18 | Alumni self-service portal, own login/session. |
| `app/` | 15 | Lightweight API/mobile-facing shell — own `config.php`, `dashboard.php`/`dashboard_more.php`/`dashboard_widget.php`, `index.php`, `header.php`. Smaller surface than the full admin app. |
| `attendance/` | 59 | Biometric/kiosk-facing attendance **capture** sub-app (distinct from the root-level `attendance_report*.php` admin reports) — `att_report.php`, `att_schedule.php`, `absent_reason.php`, `defaulter*.php`. |
| `bs/` | 23 | **"Basic setup" / system admin module** — `admin_menu.php`, `admin_menu_category.php` (the menu tables that drive `sidebar.php` and post-login redirects), `basic_setup.php`, `basic_setup_attendance.php`, `basic_banner_setup.php`, `basic_staff_menu.php`, `basic_student_menu.php`. |
| `hostel/` | 60 | Nearly **identical file list to `attendance/`** (`absent_reason.php`, `att_report.php`, `att_schedule.php`, `cancel_request.php`, `defaulter*.php`, `dashboard.php`) — strong signal `hostel/` was forked from `attendance/`'s codebase and repurposed for hostel roll-call. |
| `staff/` | 111 | Staff self-service portal (see §2.1). |
| `staff_new/` | 110 | In-progress redesign of `staff/` (see §2.1). |
| `student/` | 100 | Student self-service portal (see §2.1). |
| `tv/` | — | Digital-signage/TV-display support; most TV screens actually live at webroot as `tv_*.php` (22 files). |
| `files/` | — | Uploaded document storage — this is what the modern app's `LEGACY_FILES_PATH` env var points at. |
| `new_cis/` | — | **Not legacy code.** Contains only migration-scope markdown (`new_cis.md`, `MODULE_USAGE_GUIDE.md`) for the *modernized* app, oddly placed inside the legacy webroot — ignore when studying legacy behavior. |
| `cache/`, `cgi-bin/`, `.well-known/`, `lost+found/` | — | Infra/system, not application modules. |

No dedicated `library/` or `exam/` directories exist — those modules live
entirely as webroot files (`library_*.php`/`lib_*.php`, `term_exam_*.php`).

---

## 4. Module inventory — webroot files grouped by filename prefix

Every module below is a **naming convention**, not a folder — screens for a
module are scattered across the 961 root `.php` files distinguished only by a
common filename prefix. Counts and representative files:

| Prefix | Count | Module | Representative screens |
|---|---|---|---|
| `staff_` | 140 | Staff records/admin | `staff_yearly_report.php`, `staff_activities_add/edit.php`, `staff_affidavit_dci*.php` (many dated variants), `staff_affidavit_TNMGRMU*.php` |
| `student_` | 98 | Student records/admin | `student_academic.php`, `student_acmec_config*.php`, `student_activities_add/edit.php`, `student_attachments*.php` family |
| `term_` | 39 | **Exam / CIA** (Continuous Internal Assessment) | `term_exam_setup.php`, `term_exam_schedule.php`, `term_exam_sch_print.php`, `term_exam_examiners.php`, `term_exam_evaluation_schedule.php`, `term_exam_nodue.php`, `term_mark_sheet_print*.php`, `term_sheets_upload.php` |
| `dashboard_` | 35 | Dashboards | `dashboard.php`, `dashboard_access.php`, `dashboard_leave_request.php`, `dashboard_certificate.php`, `dashboard_hostel.php`, `dashboard_library.php`, several dated snapshots (`dashboard_28112023.php`) |
| `task_` | 32 | Internal task/budget tracking | `task_budget_sheet.php`, `task_budget_approved.php`, `task_budget_expenses.php`, `task_category_setup.php`, `task_wtype_setup.php` |
| `payroll_` | 24 | Payroll | `payroll_dashboard.php`, `payroll_report.php`, `payroll_consolidated_report.php`, `payroll_individual_report1/2/3.php`, `payroll_group_report.php`, `payroll_cron.php`/`payroll_cron_setup.php` |
| `circular_` | 24 | Notices/announcements | `circular_dashboard.php`, `circular_add_staff.php`, `circular_add_v1.php`, `circular_approve.php`, `circular_edit*.php` |
| `fee_` | 23 | Fees | `fee_dashboard.php` (+`_v1`, `_v2`, `_report_v1/v2`), `fee_type_config.php`, `fee_delete_request.php`/`fee_delete_approve.php`, `fee_fine_config.php`, `fee_pending_sms.php` |
| `tv_` | 22 | Signage/kiosk content | `tv_photo_gallery.php`, `tv_youtube_gallery.php`, `tv_live_video.php`, `tv_academic_print.php`, `tv_aevent_report.php`, `tv_dashboard_access.php` |
| `subject_` | 20 | Academic subjects/timetable | `subject_master.php`, `subject_batch.php`, `subject_handle.php`, `subject_schedule*.php` (dated variants), `subject_dashboard.php`, `subject_report.php` |
| `st_` | 18 | Staff task allocation (separate from `staff_`) | `st_task_allocation*.php` (add/edit/approve/more), `st_activity_report.php`, `st_monthly_report.php` |
| `inventory_` | 18 | Inventory/stores | `inventory_product.php`, `inventory_category.php`, `inventory_unit.php`, `inventory_mreceived.php`/`inventory_mrequest.php`, `inventory_audit.php`, `inventory_product_report.php` |
| `library_` | 17 | Library | `library_book_add/edit.php` (+dated variants), `library_book_cate.php`, `library_transaction.php`, `library_attendance.php`/`library_att_report*.php` (one outlier: `lib_attendance_report.php`) |
| `stipend_` | 16 | PG stipend payroll | `stipend_generate_payroll.php`, `stipend_payroll_close.php`, `stipend_payroll_individual_report1/3.php`, `stipend_deduction_add.php`, `stipend_amount_setup_wo_pgyears.php` |
| `web_` | 12 | Public-website CMS | `web_aboutus_v1.php`, `web_departments_v1.php`, `web_facilities_v1.php`, `web_research_news_add/edit.php` |
| `sms_` | 12 | SMS | `sms_sender.php` (+dated variants), `sms_template.php`/`sms_template_add/edit.php`, `sms_approval_setup.php`, `sms_cron_setup.php` |
| `certificate_` | 12 | Certificates | `certificate_setup.php`, `certificate_generate.php`, `certificate_approve.php` (+dated variants), `certificate_receipt_add/edit/report.php` |
| `salary_` | 10 | Salary statements | `salary_statement.php` (+`_old`, `_wo_sdtd` variants), `salary_advance_add/edit.php`, `salary_arrear_add/edit.php`, `salary_summary.php`, `salary_signature.php` |
| `internship_` | 9 | Internship scheduling | `internship_generate.php` (+dated `_more` variants), `internship_schedule.php`/`_v1.php`, `internship_schedule_report_v1.php` |
| `exam_` | 9 | Exam admin (smaller, separate from `term_exam_*`) | `exam_dashboard.php`, `exam_batch.php`/`exam_batch_new.php`, `exam_name_config.php`, `exam_nodue.php`, `exam_sms.php` |
| `attendance_` | 8 | Attendance reports (admin) | `attendance_report.php`/`attendance_report_more.php`, `attendance_report_quartely*.php` (dated variants), `attendance_report_single.php`, `attendance_ug_report.php` |
| `naac_` | 7 | NAAC accreditation | `naac_quan.php`, `naac_qual.php`, `naac_quan_report.php`, `naac_attachment.php`, `naac_quan_detailed_report.php` |
| `transport_` | 6 | Transport | `transport_add.php`/`transport_edit.php` (+dated `_stops` variants), `transport_fee_config.php`, `transport_stopping_setup.php` |
| `hostel_` | 6 | Hostel (admin-side, root) | `hostel_attendance_rept.php`, `hostel_att_setup.php`, `hostel_pass_approval.php` (+`_more`, `_without_instant_sms`), `hostel_student_report.php` |
| `alumni_` | 6 | Alumni (admin-side companions to `alumni/` portal) | `alumni_id_card.php`, `alumni_profile_edit.php`, `alumni_registration.php`, `alumni_report.php` |
| `committee_` | 4 | Committees | `committee_access.php`, `committee_dashboard.php`, `committee_event_type.php` |
| `elearn_` | 4 | E-learning | `elearn_dashboard.php`, `elearn_setup.php`, `elearn_report.php`, `elearn_subreport.php` |
| `att_` | 4 | Attendance module config | `att_menu.php` (module's own left-menu/setup screen), `att_menu_access.php`, `att_log_details.php`, `att_instruction.php` |

**Not found as filename prefixes**: `admin_*`, `basic_setup_*` (these live under
`bs/` instead), `kiosk_*`, `portfolio_*` — kiosk/signage functionality appears
to be covered by `tv_*` under a different name; portfolio has no obvious
legacy equivalent (may be a new-CIS-only module, or named differently — worth
a targeted grep if a portfolio port needs legacy parity).

### 4.1 Pervasive codebase trait: dated-snapshot sprawl

Across nearly every module, instead of using version control branches,
developers copy-pasted whole files with a date or version suffix baked into
the filename: `staff_affidavit_dci_15072024.php`, `_17072024.php`,
`_22062023.php`, `_24062023.php`, plus an undated version and a `_v1.php` —
all coexisting. The same pattern recurs as `_bak.php`, `_old.php`,
`_v1`/`_v2`/`_v3.php` suffixes (`tt_config*.php`, `salary_statement_old.php`,
`attendance_report_quartely_v1*.php`, `dashboard_28112023.php`, …). When
porting a screen, **always confirm which variant is the one actually linked
from the live menu** (`bs/admin_menu.php` / `basic_admin_menu_tb`) — the
undated/latest-numbered file is not always the active one.

---

## 5. Representative page flow, by module

No framework, no ORM: every example below uses raw `mysqli_query($GLOBALS["__CIS_MYSQLI"], ...)` with page-level PHP building HTML tables directly.

### 5.1 Attendance

- **Setup/menu**: `att_menu.php` — queries `att_menu_tb` for menu categories; standard `widget.php` → `header.php` → `sidebar.php` shell.
- **Report/print**: `attendance_report.php` + `attendance_report_more.php`.
  - `attendance_report.php` renders the filter form (course/section/subject dropdowns sourced from `basic_setup_course_tb`, `basic_setup_subject_tb`, `dept_authentication`, `timetable_tb`); does its own session guard in addition to `header.php`.
  - Report data is fetched **client-side via jQuery AJAX** to `attendance_report_more.php?fmonth=...&tmonth=...&flag=1`. That file re-does the session guard, `include('widget.php')`, `include_once('igsCache.php')`, queries `student_profile_tb`, and returns an **HTML fragment** injected into the DOM (not JSON).
  - Print here uses the browser's native print on the rendered fragment rather than a dedicated print-only file.

### 5.2 Exam / CIA

- No `cia_*.php` files exist as screens — the module is implemented under the **`term_` prefix**, backed by a table literally named `cia_schedule_tb` (naming mismatch between filename convention and table name is a legacy quirk to remember when tracing behavior).
- **Setup**: `term_exam_setup.php`, `term_examiner_setup.php`, `term_exam_evaluation_schedule.php`.
- **Report/print**: `term_exam_sch_print.php` — joins `cia_schedule_tb` (A) ⋈ `basic_subject_marks_tb` (B) ⋈ `basic_setup_subject_tb` (C):
  ```sql
  SELECT DISTINCT(B.subject_id), B.short_subject_name, B.subject_category,
         A.internal_max, A.viva_max, A.external_max
  FROM cia_schedule_tb AS A
  INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
  INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
  WHERE ...
  ```
  The `_sch_print` filename suffix is the module's convention for "printable
  page" (see `term_mark_sheet_print*.php` too) — an alternative to the
  `window.open()` popup-print pattern used elsewhere (§5.3).

### 5.3 Fees

- **Dashboard/list**: `fee_dashboard.php` (~950+ lines) — joins `student_profile_tb`, `student_academic_tb`, `student_fee`, `student_fee_scholarship`, `student_fee_dme`, `student_fee_acmec`, and hostel tables (`hostel_rooms_tb`, `student_hostel_tb`, `hostel_blocks_tb`) to compute per-student fee due/paid. Uses `var pwin = window.open(url, 'Report', 'scrollbars=1');` to launch a printable report in a popup — the clearest confirmed example of the `window.open()` print pattern (this is exactly why the modern app's [CLAUDE.md](CLAUDE.md) rule #7 forbids `noopener` on print windows — it would break this exact interaction pattern's modern equivalent).
- **Report/print variant**: `fee_dashboard_report_v2.php` — same join shape, parameterized off `$f_course`/`$f_ayear`/`$f_cyear`/`$f_atype` request params — the "generate & print" counterpart to the dashboard's interactive filter screen.
- Both use string-concatenated SQL with inconsistent escaping (`addslashes` used ad hoc, not uniformly) — a real SQL-injection surface in the legacy app; the modern app's `escapeSql`/parameterized Prisma queries are a deliberate hardening, not just a style choice.

### 5.4 General pattern across all modules

1. Parent screen (`<name>.php`) renders filters + shell (`widget.php` → `header.php` → `sidebar.php`).
2. Report/list bodies are either:
   - fetched via AJAX from a `<name>_more.php` sibling that returns an HTML fragment, or
   - rendered inline in the same file after a form POST/GET.
3. Printable output is either a dedicated `*_print.php` file, or a `window.open(url, 'Report', ...)` popup pointed at a report variant of the same screen.
4. All persistence is `del=1`/`del=0` soft-delete (same convention the modern app preserves — see CLAUDE.md rule #1) plus a `log_tb` audit row via `insert_log()`.

---

## 6. Menu / navigation system

- **`bs/admin_menu.php`** and **`bs/admin_menu_category.php`** are where menu entries are actually configured (`basic_admin_menu_tb`, `admin_menu_category_tb`).
- **`authentication_tb`** maps a `user_id` to which menu rows (`menu_id`) they're allowed to see (`authentication = 1`), joined against those two tables — the exact same three-table join the modern app's `GET /api/menu` and `menuAuthForModule` middleware reproduce (see NEW_CIS_FULL_FLOW.md §8).
- **`sidebar.php`** renders the left nav from that join at request time.
- **`index.php`**'s post-login redirect (for non-Global users with no default landing page) does the identical join to find the user's first allowed link — i.e. the "first enabled menu link" logic in the modern login response (`resolveFirstMenuLink()`) is a direct port of this.

---

## 7. Data/auth conventions carried into the modern app

These are legacy behaviors the modernized app deliberately preserves (see
[CLAUDE.md](CLAUDE.md) "Absolute rules"), confirmed here at the source:

| Legacy behavior | Where observed | Modern equivalent |
|---|---|---|
| `del=1` = active, `del=0` = deleted | Universal convention, implicit in every module's queries | Same — CLAUDE.md rule #1 |
| AES-128-CTR reversible password "encryption" (not hashing) | `password.php`, key `igrapixkey1` / IV `1234567891011121` | `server/src/services/password.js` — byte-for-byte compatible `decrypt()` |
| Session key `empusername_login` | `index.php`, `header.php`, `widget.php`, all `_more.php` guards | JWT payload / `req.user`, same conceptual identity |
| 5-failed-logins-in-5-minutes lockout | `index.php` `log_tb` count | `countRecentFailedLogins()` in `server/src/services/logService.js` |
| `access_tb` day/date/device gating | `access_check()` in `index.php` | `accessCheck()` — checked at login only, matching legacy's session-gate-once behavior |
| Menu visibility via `authentication_tb` ⋈ `basic_admin_menu_tb` ⋈ `admin_menu_category_tb` | `bs/admin_menu.php`, `sidebar.php`, `index.php` redirect | `GET /api/menu`, `menuAuthForModule` middleware |
| `log_tb` audit trail (`insert_log()`) | `log.php`, called from every login/action | `insertLog()` / `logService.js`, `auditFields()` per module |
| `window.open()` popup print, no `noopener` | `fee_dashboard.php` and others | CLAUDE.md rule #7 — explicit prohibition on `noopener` for print windows |
| Zero dates (`0000-00-00`) as "empty" | Implicit throughout (MySQL legacy default) | CLAUDE.md rule #6 — `normalizeLegacyDate`, `sqlDateOrNull` |

---

## 8. Known gaps / things to verify before relying on this doc for a specific port

- **Portfolio module**: no obvious legacy filename prefix found (`portfolio_*` doesn't exist at the webroot). If a portfolio screen port is needed, grep more broadly before assuming there's no legacy equivalent — it may be named differently or nested under another module's files.
- **Kiosk module**: likely covered by `tv_*` (signage/kiosk content), not a separate prefix — confirm against the specific screen being ported.
- **Student portal session bug**: `student/index.php` reads `stclgusername_login` but writes `suclgusername_login` on success — flagged as a probable copy-paste artifact from the staff portal; verify directly if a student self-service port is ever undertaken (not relevant to the current admin-app-focused modernization).
- **`staff_new/`**: an unfinished parallel redesign of `staff/` sitting in the same webroot — don't assume `staff/` is the only/current staff self-service implementation without checking which one is actually linked/live.
- **`hostel/` vs `attendance/`**: near-identical file lists strongly suggest a fork; if porting hostel attendance, diff the two directories' equivalent files rather than assuming `hostel/` is purpose-built from scratch.
- This document is a **survey**, not an exhaustive per-file audit — 6,317 files were not individually read. Always open the specific target `.php` file under `/home/mapims/cis/cis/` before porting a screen, per CLAUDE.md's workflow.

---

## 9. Where each doc fits

| Need | Doc |
|---|---|
| Absolute rules, pitfalls, quick lookups (modern app) | [CLAUDE.md](CLAUDE.md) |
| Modern app full flow, module-wise | [NEW_CIS_FULL_FLOW.md](NEW_CIS_FULL_FLOW.md) |
| Login/password/JWT narrative (both apps) | [docs/auth-flow.md](docs/auth-flow.md) |
| Migration status snapshot | [docs/migration-progress.md](docs/migration-progress.md) |
| Curated legacy core-file reference | `legacy-reference/` (byte-identical copies of `index.php`, `config.php`, `password.php`, `widget.php`, `sidebar.php`, `log.php`, dashboard/student-profile examples) |
| **This file** | Legacy PHP app — full flow + module-by-module filename inventory |
| Mobile app plan | [mobile.md](mobile.md) |
