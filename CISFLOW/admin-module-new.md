# Admin Module — Modernized CIS Flow Documentation

> Source: `client/src/pages/admin/` (React) + `server/src/routes/admin.js` +
> `server/src/services/admin/` (Express/Prisma), read directly from the code in this
> repository. Companion to [`admin-module.md`](admin-module.md) (the legacy PHP parity
> contract this module was rewritten against) — read that file first for the original
> SQL/behavior; this file documents what the modernized app actually does today,
> including everywhere it deliberately diverges from or extends the legacy behavior.
> Deeper per-screen field/story detail also lives in
> [`../user-stories/11-admin.md`](../user-stories/11-admin.md) and a frontend-control/UX
> audit in [`../cis-practical-flow/11-admin.md`](../cis-practical-flow/11-admin.md) —
> this document is the mid-level "how the whole module hangs together" view between
> those two.

## Module overview

The Admin module is the account/access/security control surface for the whole
application. It is one of two modules (the other being Settings) that mixes
legacy-parity screens with screens that have **no legacy PHP equivalent at all**
(Role Manager, Assign Roles — a newer, additive permission layer). It covers:

1. **Account lifecycle** — create, edit, soft-delete user accounts (`web_account_setup`).
2. **Login-time access restriction** — per-account day/time/device gating (`access_tb`).
3. **Department-scoped data authorization** — two structurally similar generations
   (`dept-auth` / `dept-auth-v1`) restricting which students/staff/courses a given
   user can see, by department.
4. **Menu-level authorization** — per-user grant/revoke of individual sidebar menu
   items (`authentication_tb`), which `menuAuthForModule()` reads on every request.
5. **Dashboard widget visibility** — per-user control of which dashboard tiles render.
6. **Password management** — both self-service (Change Password) and admin-forced
   (Reset Account), sharing one AES-128-CTR encryption scheme with the legacy app.
7. **Committee access** — per-user committee membership scoping.
8. **Staff self-service portal authorization** — a *separate* menu tree
   (`admin_staff_authentication_tb` / `basic_st_admin_menu_tb`) from the main app's
   menu, split into HOD-level and regular-staff-level variants.
9. **Role-based permissions** (new, no legacy equivalent) — reusable named roles that
   materialize into the same `authentication_tb` rows menu-authorization already reads,
   additive-only by design.
10. **Login/audit log review** — `log-dashboard` and `log-details` endpoints surfacing
    `log_tb` (not a `setup/:screen` screen — see §14).

**Primary actor:** Super Admin (`web_account_setup.access_type = 'Global'`) — the only
role that can persist any change in this module (enforced both client- and
server-side, see §0 below). **Secondary actor:** any user with admin-menu access but
not Global — full read access, zero write access.

---

## 0. Cross-cutting: the Global-write gate

Every one of the 14 setup screens shares one dispatcher and one gate, so this is
documented once here rather than repeated 14 times.

**Client** (`client/src/pages/admin/AdminSetupPage.jsx`):
- Looks up `ADMIN_SCREEN_META[screen]` (`client/src/pages/admin/adminSetupMeta.js`) for
  the screen's title and legacy filename, and `SETUP_COMPONENTS[screen]` for which React
  component renders it.
- Wires `data`/`busy`/`onLoad`/`onSave` from `useAdminSetupApi(screen)`
  (`client/src/pages/admin/setup/useAdminSetupApi.js`) — a thin wrapper posting to
  `POST /api/admin/setup/:screen/load` and `POST /api/admin/setup/:screen/save`.
- `handleSave` checks `isGlobalAccessType(user?.accessType)` **before** calling
  `save()` at all. If not Global: sets error
  `"Only Super Admin can save changes here. You have view-only access to this module."`
  and returns `null` — no network call is made. A persistent banner
  `"View-only access — only Super Admin can save changes in the Admin module."` renders
  above every screen for non-Global viewers.
- `handleLoad` merges a `uid` query param (from the URL, e.g. `?uid=42` when navigating
  in from Account Edit's "Menu Authentication" / "Dashboard Access" cross-links) into
  every load call.

**Server** (`server/src/routes/admin.js`):
- `router.use(authMiddleware, menuAuthForModule('admin'))` — standard auth + menu gate,
  same as every other module.
- `POST /setup/:screen/load` — **no** Global check. Anyone who passed
  `menuAuthForModule('admin')` (i.e. has this module in their sidebar, or is Global) can
  view any screen's live data.
- `POST /setup/:screen/save` — gated by `requireGlobalWrite` middleware: 403s with the
  same message as the client if `req.user.accessType !== 'Global'`.
- Both routes delegate to `server/src/services/admin/adminSetup.js`
  (`loadAdminSetupScreen` / `saveAdminSetupScreen`), which validates the `screen` slug
  against a `VALID_SCREENS` set and dispatches to the matching service module in
  `server/src/services/admin/setup/`.

**Audit logging:** every load/save across all 14 screens writes to `log_tb` via
`server/src/services/admin/setup/setupAudit.js`'s `logAdminSetup(page, operation,
status, description, memberId, audit)` — `page` is the legacy `.php` filename for
parity screens (so log rows stay comparable to the legacy app's own logging), or a
synthetic non-`.php` string (`role_manager`, `assign_roles`) for the two screens with
no legacy equivalent, so they're visually distinguishable from parity screens when
reviewing logs. `auditFields(memberId, audit)` (same file) builds the standard
`created_dt/ip/by`, `updated_dt/ip/by`, `del: 1` block used on every insert/update
across this module (and most of the app).

---

## Screen inventory

| Slug | Title | Legacy `.php` | Component | Service |
|---|---|---|---|---|
| `account-add` | Add User Account | `account_add.php` | `AccountAddForm.jsx` | `accountSetup.js` |
| `account-edit` | Edit User Account | `account_edit.php` | `AccountEditSetup.jsx` | `accountSetup.js` |
| `access-restriction` | Login Access Restrictions | `access.php` | `AccessRestrictionSetup.jsx` | `accessRestriction.js` |
| `dept-auth` | Department Authentication | `department_authentication.php` | `DeptAuthSetup.jsx` | `deptAuthSetup.js` |
| `dept-auth-v1` | Staff Department Authentication | `department_authentication_v1.php` | `DeptAuthV1Setup.jsx` | `deptAuthV1Setup.js` |
| `menu-auth` | Menu Authentication | `authentication_add.php` | `MenuAuthSetup.jsx` | `menuAuthSetup.js` |
| `dashboard-access` | Dashboard Widget Access | `dashboard_access.php` | `DashboardAccessSetup.jsx` | `dashboardAccessSetup.js` |
| `change-password` | Change Password | `change_password.php` | `ChangePasswordSetup.jsx` | `changePasswordSetup.js` |
| `otp-reset` | Reset Account | `otp_account_reset.php` | `OtpResetSetup.jsx` | `otpAccountResetSetup.js` |
| `committee-access` | Committee Access | `committee_access.php` | `CommitteeAccessSetup.jsx` | `committeeAccessSetup.js` |
| `staff-auth-hod` | HOD Page Authentication | `staff_authentication_add.php` | `StaffAuthSetup.jsx` (mode `hod`) | `staffAuthSetup.js` |
| `staff-auth-page` | Staff Page Authentication | `staff_page_authentication_add.php` | `StaffAuthSetup.jsx` (mode `page`) | `staffAuthSetup.js` |
| `role-manager` | Role Manager | *(none)* | `RoleManagerSetup.jsx` | `roleManagerSetup.js` |
| `assign-roles` | Assign Roles | *(none)* | `AssignRolesSetup.jsx` | `assignRolesSetup.js` |

Plus two non-`setup/:screen` endpoints on the same router:

| Route | Purpose | Service |
|---|---|---|
| `GET/POST /api/admin/log-dashboard` | Login-attempt log summary | `services/admin/logDashboard.js` (`loadLogDashboard`) |
| `GET/POST /api/admin/log-details` | Login-attempt log drill-down | `services/admin/logDashboard.js` (`loadLogDetails`) |
| `GET /api/admin/users` | User list for other modules' pickers | `services/admin/adminUsers.js` (`listUsers`) |

## Table of contents

1. [Add User Account — `account-add`](#1-add-user-account--account-add)
2. [Edit User Account — `account-edit`](#2-edit-user-account--account-edit)
3. [Login Access Restrictions — `access-restriction`](#3-login-access-restrictions--access-restriction)
4. [Department Authentication — `dept-auth`](#4-department-authentication--dept-auth)
5. [Staff Department Authentication — `dept-auth-v1`](#5-staff-department-authentication--dept-auth-v1)
6. [Menu Authentication — `menu-auth`](#6-menu-authentication--menu-auth)
7. [Dashboard Widget Access — `dashboard-access`](#7-dashboard-widget-access--dashboard-access)
8. [Change Password — `change-password`](#8-change-password--change-password)
9. [Reset Account — `otp-reset`](#9-reset-account--otp-reset)
10. [Committee Access — `committee-access`](#10-committee-access--committee-access)
11. [HOD / Staff Page Authentication — `staff-auth-hod` / `staff-auth-page`](#11-hod--staff-page-authentication--staff-auth-hod--staff-auth-page)
12. [Role Manager — `role-manager`](#12-role-manager--role-manager)
13. [Assign Roles — `assign-roles`](#13-assign-roles--assign-roles)
14. [Log Dashboard / Log Details](#14-log-dashboard--log-details)

---

## 1. Add User Account — `account-add`

**Purpose:** Create a new login for the app (any access type). Legacy parity target:
`account_add.php`.

**Page layout:** Single form, section heading "Basic Information" — **Member Name***,
**Mobile**, **Email**, **Username***, **Password** (type toggle Show/Hide +
**Generate** button — random 6-char password from
`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789!@#%*+`, auto-fills
Confirm too), **Confirm Password**. Buttons: **Save**, **Reset** (clears form).

**Data source (load):** `loadAccountAdd` returns a blank form shape — no query, this
screen has no "load existing" mode.

**Save/submit behavior** (`saveAccountAdd` in `accountSetup.js`):
- Rejects `"Member name, username, and password are required."` / `"Invalid
  Password..."` (mismatch) / `"Email ID already exists..."` (raw-SQL duplicate check
  on live `member_id` OR `address_email`).
- `INSERT INTO web_account_setup` — `password: encrypt(password)` (AES-128-CTR, see
  §box below), `reset_password: ''`, `photo: ''`, `acc_gender: ''`, plus
  `auditFields().create`.
- **Also inserts a matching `access_tb` row** via raw `$executeRaw` —
  `local_access=0, date_base=0, day_base=1, allow_day='1,2,3,4,5,6,7',
  allow_from_time='00:00:00', allow_to_time='23:59:00'` — every new account starts
  **fully unrestricted** until someone visits Access Restrictions to tighten it. This
  mirrors legacy `account_add.php`'s own default-row insert.

**Business logic:** password encryption — `encrypt()`/`decrypt()` in
`server/src/services/password.js`, AES-128-CTR with a **static IV**
(`process.env.LEGACY_PASSWORD_IV || '1234567891011121'`) and key
(`process.env.LEGACY_PASSWORD_KEY || 'igrapixkey1'`, padded to 16 bytes). The static
IV is deliberate, not an oversight — both this app and the still-live legacy PHP app
read/write the same `password` column and must decrypt each other's ciphertext, which
a per-row random IV would break.

**Tables touched:** `web_account_setup`, `access_tb`, `log_tb`.

---

## 2. Edit User Account — `account-edit`

**Purpose:** Search, edit, soft-delete existing accounts. Legacy parity: `account_edit.php`.

**Page layout — two modes** (`data.mode`):
- **List** (`AccountList`): search box ("Search member ID or name") + Search button →
  `onLoad({ search }, { page: 1 })`; table (Member ID, Member Name, row actions);
  20/page pager (`Previous`/`Next`); per-row **Edit** and **Delete** (opens
  `ConfirmModal`, danger tone, names the account in the confirm text). List excludes
  `member_id = 'igrapix'` (reserved system account) and `del=0` rows.
- **Edit** (`AccountEditDetail`): "Back to list" link; **Basic Information** form —
  read-only Member ID, editable Member Name/Mobile/Email, Photo upload (`accept`
  jpeg/png/gif) with live thumbnail + Remove; **Save** (`Submit0: 'Save'`). Separate
  **Change Password** sub-form (New/Confirm Password, shared Show/Hide,
  `Submit3: 'Save'`). Two nav links: **Menu Authentication** →
  `/admin/setup/menu-auth?uid=<id>`, **Dashboard Access** →
  `/admin/setup/dashboard-access?uid=<id>`.
- A hidden, never-rendered `<template class="d-none">` block references
  `user.currentPassword` — dead markup (`<template>` content is inert in every
  browser), but the server still computes/ships the decrypted `currentPassword` in
  every edit-load response regardless of whether the UI shows it — worth knowing if
  this payload is ever logged/proxied.

**Save/submit behavior** (`saveAccountEdit`):
- `fields.delete === 'Confirm'` → soft-delete (`del: 0` + audit update), logs `Delete`.
- `fields.Submit3 === 'Save'` → password change; rejects `"Password not match..."`.
- `fields.Submit0 === 'Save'` → profile update; rejects `"Email ID already exists..."`
  (excludes own id); photo upload rejects non-jpeg/jpg/gif/png
  (`"Please upload jpeg, gif, jpg, or png only."`) or >1MB
  (`"Please upload less than 1 MB file."`), writes to
  `<LEGACY_IMG_PATH>/member/<DDMMYY HHmmss + 4 random digits>.<ext>`.

**Tables touched:** `web_account_setup`, `log_tb`.

---

## 3. Login Access Restrictions — `access-restriction`

**Purpose:** Configure when/how one account can log in. Legacy parity: `access.php`.

**Page layout:** **Select Member** (`SearchableSelect`) → **Copy restrictions from
(optional)** (`SearchableSelect`, copy-preview — nothing saved until the admin clicks
Save; info alert names the source). If the selected member is Global, the form doesn't
render — `"Global users are not restricted on this screen."` (Global bypasses
`access_tb` entirely at login, so restricting it here would be a misleading no-op).
Otherwise, **Access Method** with three columns:
1. **By Login Key** checkbox + `1–4` count select + up to 4 free-text key inputs.
2. **By Day** checkbox (mutually exclusive with #3) + 7 day checkboxes (Mon–Sun,
   default all-checked on a brand-new row) + From/To `HH:MM` text.
3. **By Date & Time** checkbox (mutually exclusive with #2) + From/To
   `dd-mm-yyyy HH:MM` text.

**Save/submit behavior** (`accessRestriction.js`, table `access_tb`): rejects
`"Select a member first."` / `"Global users cannot be restricted here."`; `create`s a
new row if the member has none yet, else `update`s the existing row (keyed by
`access_id`).

**Business logic:** this is the **only** enforcement point for `access_tb` — it's
checked once at login time (`accessCheck()` in `services/accessCheck.js`), not
per-request, matching the legacy behavior.

**Tables touched:** `access_tb`, `log_tb`.

---

## 4. Department Authentication — `dept-auth`

**Purpose:** Scope which students/staff/courses a user can see, by department. Legacy
parity: `department_authentication.php`.

**Page layout:** **User** → **Department** (`SearchableSelect` ×2) → once both picked,
six `CheckListSelect` cards (search auto-shown past 8 options, "N selected" counter,
Select all/Clear): **Dept HOD** (single, radio rows), **Staffs**, **U.G**,
**Internship**, **P.G**, **Course** (multi, checkbox rows). This is the screen that
was recently redesigned from a plain `<select multiple>` to `CheckListSelect` — see
[`../cis-practical-flow/11-admin.md`](../cis-practical-flow/11-admin.md) §3 for why
`dept-auth-v1`/`committee-access` still don't match this pattern.

**Save/submit behavior** (`deptAuthSetup.js`, table `dept_authentication`): rejects
`"User and department are required."`; every multi-field is normalized to a
**comma-joined CSV string** (`dept_staff`, `dept_student`, `dept_pg`, `dept_intern`,
`course_id` — matching the legacy schema's flat text columns, not a normalized join
table); `dept_hod` stores only the **first** selected value since it's conceptually
single-select. `create`s a new row if `r_id` is absent/0, else `update`s by id.

**Tables touched:** `dept_authentication`, `log_tb`.

---

## 5. Staff Department Authentication — `dept-auth-v1`

**Purpose:** The **legacy-styled sibling** of `dept-auth` — same conceptual task
(scope a user to departments/students/staff/courses), older UI. Legacy parity:
`department_authentication_v1.php`.

**Page layout:** **Staff (HOD)** `SearchableSelect` → **Department** (native
`<select multiple>` — still un-upgraded), **Staffs** (native `<select multiple>` with
`<optgroup>` support when `data.staffGroups` is present), **U.G**, **Internship**,
**P.G**, **Course** (all native `<select multiple>`). **Save** + **Menu
Authentication** link → `/admin/setup/staff-auth-hod?uid=<staff>`.

Key difference from `dept-auth`: **Department itself is multi-valued here** (an HOD
can span several departments), vs. `dept-auth`'s single-department-then-scope flow.

**Save/submit behavior** (`deptAuthV1Setup.js`, table `dept_auth` — note: **different
table name** from `dept-auth`'s `dept_authentication`): same CSV-join pattern as
`dept-auth` (`dept_id`, `dept_staff`, `dept_student`, `dept_pg`, `dept_intern`,
`course_id`), keyed on `dept_hod = Number(staffId)`.

**Tables touched:** `dept_auth`, `staff_profile_tb`, `staff_dept_master`,
`staff_designation_tb`, `master_setup`, `basic_setup_course_tb`, `log_tb`.

---

## 6. Menu Authentication — `menu-auth`

**Purpose:** Grant/revoke individual sidebar menu items per user — the table
`menuAuthForModule()` reads on every request across the whole app. Legacy parity:
`authentication_add.php`.

**Page layout:** **Select User** (options suffixed `" *"` if already configured) →
**Copy permissions from (optional)** (copy-preview alert). Toolbar: **"Check all main
menus"** (toggles every checkbox **directly in the DOM**, not via React state — these
are uncontrolled `defaultChecked` inputs) + **"Filter menu items by name..."** search
(hides non-matching groups/items via `display:none`, preserving checked state while
typing, rather than array-filtering). Menu items grouped under `<h5>` headings,
4-per-row. Form is remount-keyed on `` `${selectedUser}:${copiedFromUser}` `` because
`defaultChecked` only applies on mount.

**Save/submit behavior** (`menuAuthSetup.js`, table `authentication_tb`): checked ids
read directly from `form.querySelectorAll('input[name="a_auth"]:checked')`, not React
state. **Soft-toggle, not delete-and-recreate**: `updateMany` flips every
currently-`authentication=1` row to `0`, then per submitted menu id either flips an
existing `del=1` row back to `1` or inserts a fresh row (`department: 0,
authentication: 1`) — preserves row history/ids, unlike most other setup saves in this
app which soft-delete-then-recreate.

**Tables touched:** `authentication_tb`, `basic_admin_menu_tb`, `admin_menu_category_tb`, `log_tb`.

---

## 7. Dashboard Widget Access — `dashboard-access`

**Purpose:** Control which dashboard tiles a user sees and in what order. Legacy
parity: `dashboard_access.php`.

**Page layout:** **Select User** / **Copy widgets from (optional)**. Toolbar: **Check
all**, **Fill default order** (numbers every widget 1..N in current list order).
Widget list: bordered row per widget — enable checkbox, numeric order input
(`width:70px`), label.

**Save/submit behavior** (`dashboardAccessSetup.js`, table `dashboard_access`):
rejects `"Select a user first."`; disables all current rows first, then per submitted
widget updates-or-creates by `row_id`. Saving **zero** enabled widgets is still
`success: true` (message `"No widgets selected"`, not an error) — "give this user no
widgets" is a valid end state.

**Tables touched:** `dashboard_access`, `log_tb`.

---

## 8. Change Password — `change-password`

**Purpose:** **Self-service only** — the one screen in this module scoped to the
logged-in user's own account (`memberId` from the JWT), not a target user picker, and
therefore not subject to the Global-write gate the same way (a non-Global user editing
"their own" account here is normal self-service, not privilege escalation). Legacy
parity: `change_password.php`.

**Page layout:** **Basic Information** — read-only Username, editable Name/Mobile/Email,
**Save Profile**. **Change Password** section — muted "Current password: `<plaintext>`"
line (safe here because it's always the *viewer's own* password), New/Confirm Password
(shared Show/Hide) + **Generate** (8-char), **Save Password**.

**Save/submit behavior** (`changePasswordSetup.js`): password mismatch →
`"Password not match..."`; profile duplicate email/mobile (excluding self) →
`"Email ID already exists..."`.

**Tables touched:** `web_account_setup`, `log_tb`.

---

## 9. Reset Account — `otp-reset`

**Purpose:** Force a password reset on one or more accounts — the new password becomes
immediately **known** to the Super Admin (not just a "please change" marker), and the
affected account is routed through the OTP/change-password flow on next login. Legacy
parity: `otp_account_reset.php`.

**Page layout:** Note "Red labels indicate the password has not yet been changed after
reset." **Check all** + grid of accounts (checkbox + `<name> (<id>)`, red text when
`pendingReset`). **When the viewer is Global**: an additional "Current password:
`<code>`" line per account (decrypted, live). Non-Global viewers get no such field at
all (absent, not blanked). **Reset Password** button.

**Save/submit behavior** (`otpAccountResetSetup.js`, table `web_account_setup`): for
every checked account, sets **both** `password` (AES-128-CTR encrypted) and
`reset_password` to a fixed known value — so the login password is immediately known
*and* the account is forced through `otp_request.php`-equivalent on next successful
login (`routes/auth.js`: `if (user.reset_password) redirectTo = 'otp_request.php'`).

**Load-time Global gate:** unlike the save gate (server-enforced via middleware), the
`currentPassword`/`canSeePasswords` field is gated **inside the service itself**
(`isGlobalAccessType(audit.accessType)`) — this is the one place in the module where a
*read* is conditionally shaped by access type, not just blocked outright.

**Tables touched:** `web_account_setup`, `log_tb`.

---

## 10. Committee Access — `committee-access`

**Purpose:** Scope which committees a user can see. Legacy parity: `committee_access.php`.

**Page layout:** **User** / **Copy committees from (optional)**. **Committee** —
`CheckListSelect` (recently upgraded from the same plain `<select multiple>`
`dept-auth-v1` still has).

**Save/submit behavior** (`committeeAccessSetup.js`): writes/updates the **same**
`dept_authentication` table `dept-auth` uses — column `event_committee`, CSV text.
Shares the table with `dept-auth`, not `dept-auth-v1`'s separate `dept_auth` table.

**Tables touched:** `dept_authentication`, `log_tb`.

---

## 11. HOD / Staff Page Authentication — `staff-auth-hod` / `staff-auth-page`

**Purpose:** Authorize access to the **staff self-service portal** — a menu tree
entirely separate from the main admin sidebar. Legacy parity: two files,
`staff_authentication_add.php` (HOD) and `staff_page_authentication_add.php` (regular
staff), rendered by **one shared React component** (`StaffAuthSetup.jsx`) whose copy
(`MODE_COPY`) switches on `mode`.

**Page layout:** Staff `SearchableSelect` (label/hint text differs by mode) + copy-from
picker. Toolbar card: live "`N` of `total` menus enabled" + **Check all** (disabled
once fully checked) + **Clear all** (disabled once empty) + **Save**. Menu grid:
pill-style `staff-auth-item` checkboxes (this is the module's only **controlled**
checkbox grid — every other grid in this module is uncontrolled/DOM-read) grouped by
main menu. Second **Save** button repeats at the bottom.

**Save/submit behavior** (`staffAuthSetup.js`, table
`admin_staff_authentication_tb`): submits **every** menu item (not just checked ones)
as three parallel arrays (`menu_id[]`, `user_row_id[]`, `a_auth[]` = `'1'`/`'0'`) —
unlike Menu Auth/Role Manager which only submit the checked subset.

**Business logic — the staff pool differs by mode:** `hod` mode only offers
`staff_profile_tb` rows with `atten_auth = 1`; `page` mode offers everyone else. The
menu catalog is **also separate** from the main app's — `admin_staff_menu_category_tb`
/ `basic_st_admin_menu_tb`, scoped by a `regFilter` on registration type.

**Tables touched:** `admin_staff_authentication_tb`, `basic_st_admin_menu_tb`,
`admin_staff_menu_category_tb`, `staff_profile_tb`, `log_tb`.

---

## 12. Role Manager — `role-manager`

**Purpose:** *(No legacy equivalent — see [`../ADMIN_ROLE_MODULE_UPGRADE.md`](../ADMIN_ROLE_MODULE_UPGRADE.md).)*
Define a reusable named role (a bundle of menu grants) once, instead of re-ticking the
same boxes per user on Menu Authentication.

**Page layout:** **Select Role** with a synthetic leading `+ Create new role` option.
Role Name* / Description (uncontrolled, ref-based). Same uncontrolled checkbox-grid
pattern as Menu Authentication (`"Check all main menus"`, DOM-read on submit,
remount-keyed on `` `${roleId}:${new|edit}` ``).

**Save/submit behavior** (`roleManagerSetup.js`, tables `role_tb` + `role_menu_tb`):
rejects `"Role name is required."`; create-or-update `role_tb`, then the **same
soft-toggle pattern as Menu Authentication** on `role_menu_tb`.

**Business logic — critical asymmetry:** saving a role's menu set here does **not**
retroactively touch any user already assigned that role (see §13's
`materializeUserPermissions`) — logged under the synthetic page name `role_manager`
(not a `.php` filename) so it's visually distinguishable in `log_tb`.

**Tables touched:** `role_tb`, `role_menu_tb`, `log_tb`.

---

## 13. Assign Roles — `assign-roles`

**Purpose:** *(No legacy equivalent.)* Assign one or more roles to a user; grants apply
immediately, but **removing a role never revokes previously-granted access** (the
screen's own copy states this explicitly).

**Page layout:** **Select User** + role checklist (checkbox, name, muted description).
Empty state points to Role Manager if no roles exist yet.

**Save/submit behavior** (`assignRolesSetup.js`, table `user_role_tb`, calls
`roleMaterializer.js`'s `materializeUserPermissions()`): standard soft-delete-then-
recreate on `user_role_tb`, then **additive-only** materialization — computes the
union of menu ids granted by the user's current roles (`role_menu_tb`,
`authentication=1`), diffs against existing `authentication_tb` grants, and **only
inserts what's missing**. It never removes an `authentication_tb` row regardless of
whether that row came from a role or a manual Menu Authentication edit — there is no
"granted by role X" marker column, by design, so a role can never safely be known to
retract without risking a manually-granted permission too. Response message is
dynamic: `"Roles updated. N new menu item(s) granted from M role(s). Existing
individual permissions were left untouched."` or the zero-new-grants variant.

**Tables touched:** `user_role_tb`, `role_menu_tb`, `authentication_tb`, `log_tb`.

---

## 14. Log Dashboard / Log Details

**Purpose:** Review login-attempt activity. Not a `setup/:screen` pair — separate
routes (`GET/POST /api/admin/log-dashboard`, `GET/POST /api/admin/log-details`) backed
by `services/admin/logDashboard.js`. Legacy parity: `log_dashboard.php` /
`log_details.php` (see [`admin-module.md`](admin-module.md) for the legacy SQL/columns
— this modernized doc doesn't re-derive that detail since the legacy file is the
source of truth being ported against).

**Tables touched:** `log_tb`.

---

## Cross-module patterns worth knowing before touching this module

- **Three different multi-select idioms for the same conceptual task** ("grant this
  user/role a set of items"): `CheckListSelect` (`dept-auth`, `committee-access`),
  uncontrolled DOM-read checkbox grids (`menu-auth`, `role-manager`), and controlled
  pill grids (`staff-auth-hod`/`page`) — plus `dept-auth-v1`'s still-native
  `<select multiple>`. See
  [`../cis-practical-flow/11-admin.md`](../cis-practical-flow/11-admin.md) §2–3 for the
  full inventory and upgrade-candidate reasoning.
- **Two different tables named almost the same thing**: `dept_authentication`
  (`dept-auth`, `committee-access`) vs. `dept_auth` (`dept-auth-v1`) — easy to
  transpose when writing a new query against either screen's data.
- **`del=1` is ACTIVE everywhere in this module**, same as the rest of the app — every
  "list live accounts/roles/grants" query filters `del=1`; soft-delete sets `del=0`.
- **The role layer (§12–13) is purely additive on top of `authentication_tb`** — it
  introduces no new enforcement path. `menuAuthForModule()` and the legacy app both
  keep reading `authentication_tb` exactly as before; roles only ever *write* to it.
