# Admin Module — Legacy CIS Flow Documentation

> Source: `/home/mapims/cis/cis/*.php` (live legacy PHP tree). All SQL, field names and
> logic below were read directly from the PHP source. Live/dead status for each file
> was determined by (a) cross-referencing `client/src/pages/admin/adminSetupMeta.js` in
> the modernized repo, which lists the 12 legacy `.php` files already ported to React,
> (b) grepping every file's own `insert_log()` calls / `$url_ref` usage (which is always
> `$_SERVER['REQUEST_URI']`, i.e. the requesting filename — see `widget.php` line 17 and
> `log.php`), and (c) grepping the whole tree for cross-file `<a href="...">`/`include`
> references to each candidate duplicate. No direct database access to
> `basic_admin_menu_tb` was available for this pass; where menu-enablement could not be
> confirmed from static reading, that uncertainty is called out explicitly. This
> document is the parity contract for rewriting the Admin module — do not deviate from
> the SQL/behavior described here without re-checking the cited legacy file.

## Module overview

"Admin" in legacy CIS covers back-office identity, authorization, and audit for the
**web admin account tier** (`web_account_setup`) that logs into the CIS back office —
distinct from the separate staff/student self-service portals. It covers:

1. **Account management** — create (`account_add.php`) and edit/list/delete
   (`account_edit.php`) admin login accounts (`web_account_setup`), including photo
   upload and an in-place password-change panel.
2. **Login access restriction** — per-account day/time-window and login-key gating
   (`access.php` → `access_tb`).
3. **Menu/page authorization** — three parallel, structurally-similar-but-independent
   authorization systems, each gating a different population against a different menu
   table:
   - Admin-account menu authorization (`authentication_add.php` → `authentication_tb`
     ⋈ `basic_admin_menu_tb`) — used by `menuAuthForModule()` in the modernized app.
   - Staff (HOD-tier) page authorization (`staff_authentication_add.php` →
     `admin_staff_authentication_tb` ⋈ `basic_st_admin_menu_tb`, filtered to
     `atten_auth=1` staff and `reg_icon!=1` menu rows).
   - Staff (non-HOD) page authorization (`staff_page_authentication_add.php` — same
     tables, but `atten_auth!=1` staff and `reg_icon!=0` menu rows) — i.e. these two
     screens partition the **same** staff population/menu table into two disjoint
     halves by `atten_auth`/`reg_icon`, they are not duplicates of each other.
4. **Department-level delegation** — assigning which staff/students/courses a
   department-scoped admin account (`department_authentication.php` → `dept_authentication`)
   or a department HOD staff member (`department_authentication_v1.php` → `dept_auth`,
   a **different** table) can see/manage, plus a shared **Committee Access** sub-screen
   (`committee_access.php`) that edits one extra column on the *same*
   `dept_authentication` table used by `department_authentication.php`.
5. **Dashboard widget access** — per-account (`dashboard_access.php` →
   `dashboard_access`) and per-staff (`dashboard_accessbystaff.php` →
   `dashboard_accessbystaff`) enable/order lists for the ~28 dashboard widget types
   shown on the main CIS dashboard.
6. **Credential self-service / recovery** — `change_password.php` (self password change
   for the logged-in admin account) and `otp_account_reset.php` (bulk-flag other
   accounts' passwords for forced reset).
7. **Audit / login activity reporting** — `log_dashboard.php` (summary tiles: active
   logins & login/operation activity counts for Admin/Staff/Student tiers) and
   `log_details.php` (searchable per-user login-session detail report, admin tier
   only), both reading the shared `log_tb` audit table written by `insert_log()`
   everywhere in the app.

### Screen inventory (menu-verified)

No direct DB read of `basic_admin_menu_tb` was available for this pass. Liveness below
is inferred from (a) the already-ported set in `adminSetupMeta.js` — treated as
confirmed-live, since a prior porting effort would only have targeted live menu
entries — and (b) same-tree cross-references (links from one legacy screen to
another) for files not in that list. Confirm directly against `basic_admin_menu_tb`
before relying on this table for menu-visibility decisions.

| Meta slug (modernized) | Legacy file | Liveness evidence | Notes |
|---|---|---|---|
| `account-add` | `account_add.php` | Ported in `adminSetupMeta.js` | Create admin login account |
| `account-edit` | `account_edit.php` | Ported | List/search/edit/delete + change password |
| `access-restriction` | `access.php` | Ported | Day/time/login-key access window per account |
| `dept-auth` | `department_authentication.php` | Ported | Admin-account-scoped department delegation |
| `dept-auth-v1` | `department_authentication_v1.php` | Ported | Staff(HOD)-scoped department delegation, separate table |
| `menu-auth` | `authentication_add.php` | Ported | Per-admin-account menu/page grants |
| `dashboard-access` | `dashboard_access.php` | Ported | Per-admin-account dashboard widget grants |
| `change-password` | `change_password.php` | Ported | Self-service password/profile change |
| `otp-reset` | `otp_account_reset.php` | Ported | Bulk flag accounts for forced password reset |
| `committee-access` | `committee_access.php` | Ported | Per-admin-account committee grants (shares `dept_authentication` table) |
| `staff-auth-hod` | `staff_authentication_add.php` | Ported | Per-HOD-staff page grants |
| `staff-auth-page` | `staff_page_authentication_add.php` | Ported | Per-non-HOD-staff page grants |
| — | `dashboard_accessbystaff.php` | Linked from `department_authentication_v1.php` ("Dashboard Access" button) | **Not yet ported** — staff-tier sibling of `dashboard_access.php`; live, not dead (see Superseded section below for why it was initially suspected to be a duplicate and ruled out) |
| — | `log_dashboard.php` | Self-contained; most recently modified file in this whole cluster (Feb 2025) | Admin/Staff/Student login-activity dashboard, **not yet ported** |
| — | `log_details.php` | Self-contained | Admin-tier searchable login-session report, **not yet ported** |
| — | `login_log.php` | No caller found anywhere in the tree | Orphaned JSON/AJAX endpoint — see §15 |
| — | `login_more.php` | No caller found anywhere in the tree | Orphaned, and **not actually part of Admin** — see §15 and "Files that exist but are not part of this module" below |

Two screens link to each other by explicit `<a href>` outside the sidebar menu
(same pattern noted for exam/other modules in this codebase): `department_authentication.php`
links to `authentication_add.php?uid=<id>` ("Menu Authentication") and
`dashboard_access.php?uid=<id>` ("Dashboard Access"); `department_authentication_v1.php`
links to `staff_authentication_add.php?uid=<id>` ("Menu Authentication") and
`dashboard_accessbystaff.php?uid=<id>` ("Dashboard Access").

### Superseded / dead duplicate files (do not use as parity source)

| Dead file | Superseded by | Diff summary |
|---|---|---|
| `change_password_v1.php` | `change_password.php` | Byte-for-byte identical POST handling and `encrypt()`/`decrypt()` helpers; the only functional diff is the HTML: `change_password_v1.php` **removes** the "Current Password" display row (comparing timestamps, both files are dated the same day — Feb 8 2022 — so this can't be resolved by recency alone). `change_password.php` is the one listed in `adminSetupMeta.js` as ported, confirming it is the live file; `change_password_v1.php` is not referenced from anywhere in the tree (no `<a href>`, no menu-meta entry) and should be treated as dead. |
| `log_dashboard_v2.php` | `log_dashboard.php` | **Not** actually different in logic — `diff` shows exactly 2 changed lines, both cosmetic label text ("CIS Login Active Users"/"CIS Login - Activities" in `_v2` vs "Admin Login Active Users"/"Admin Login - Activities" in the live file). Despite the "v2" suffix suggesting it's newer, `log_dashboard.php` has the more recent filesystem mtime (Feb 2025) vs `log_dashboard_v2.php` (Nov 2023) — the numeric suffix is misleading here; go by content/mtime, not the filename version number. |
| `log_dashboard_cis.php` | `log_dashboard.php` | Much smaller (232 vs 618 lines) — an early iteration containing only the "CIS Login Active Users" tile/table, missing the Staff and Student tiles and both Activities tables entirely. No caller found anywhere in the tree. |
| `dashboard_library_1.php`-style pattern N/A here | — | (No `_1`/`_10102023`-style admin duplicates were found beyond the ones listed above; the `find`/`grep` sweep described below did not surface any others.) |

A dedicated sweep for admin-related `*_v1`/`*_v2`/`*_old`/`*_backup`/date-suffixed files
(`ls | grep -iE 'account|access|department_auth|authentication_add|dashboard_access|
change_password|otp_account|committee_access|staff_authentication|staff_page_auth|
log_dashboard|log_details|login_log'`) turned up exactly the files discussed above,
plus `att_log_details.php` (discussed in §14, a broader Staff/Student login-session
report that is a superset of `log_details.php`'s admin-only scope — not a strict
duplicate, and no caller for it was found either; treat as a possible parked/orphaned
extension rather than a confirmed-dead duplicate) and `att_menu_access.php`/
`machine_access.php` (Kiosk/TV module's own screens — see next section, out of scope).

**Important — `dashboard_accessbystaff.php` is NOT a dead duplicate of
`dashboard_access.php`.** The task brief flagged it as a likely candidate, but reading
both files shows they serve two different, non-overlapping audiences and write to two
different tables:

- `dashboard_access.php` — dropdown sources **admin accounts** (`web_account_setup`,
  filtered to `access_type!='global'` unless the logged-in user's own account is
  `Global`), writes to `dashboard_access`. Reachable both from the sidebar (assumed —
  it's in the ported meta list) and from `department_authentication.php`'s "Dashboard
  Access" button.
- `dashboard_accessbystaff.php` — dropdown sources **staff** (`staff_profile_tb WHERE
  atten_auth=1`), writes to `dashboard_accessbystaff` (a separate table, one fewer
  widget option — `student_ghostel`/`student_lhostel` are present in
  `dashboard_access.php`'s widget list but absent from `dashboard_accessbystaff.php`'s).
  Reachable only via `department_authentication_v1.php`'s "Dashboard Access" button —
  no evidence it has its own sidebar menu entry, but it is a live, actively-linked
  screen, not dead code, and should be ported alongside `dashboard-access` as a sibling
  screen when this module's staff-facing half is tackled.

### Files that exist but are not part of this module's live surface

- `att_menu_access.php`, `machine_access.php`, `tv_dashboard_access.php`,
  `tv_slider_access.php`, `tv_website_access.php` — these follow the same
  "`<thing>_access.php` = per-user access grant screen" naming convention as
  `access.php`/`dashboard_access.php` in this module, which makes them easy to
  mistake for Admin screens, but they are **not**. They are the **Kiosk/TV module's**
  own per-device/per-user access-control screens (attendance kiosk menu access,
  biometric machine access, and the three TV-display screens' widget/slide/website
  access respectively) and belong with that module's documentation, not this one. Do
  not port them as part of Admin.
- `login_more.php` — despite the name suggesting an "Admin login log" AJAX helper (and
  being listed as a candidate to check in the task brief), reading it shows it has
  **nothing to do with Admin's own login/log_tb flow**. It checks a `punchtimedetails`
  table (biometric/attendance punch device data) against `$_SESSION['bslogin_time']`
  and sets `$_SESSION['bsusername_login']='igrapix'` — this is a leftover
  attendance-device polling helper, unrelated to the Admin module's account/login
  concerns. No caller was found anywhere in the tree (`grep` across all `.php` files
  turns up nothing referencing it). Treat as dead/orphaned and out of scope for this
  module; do not port it here.
- `login_log.php` — also has no caller anywhere in the tree, but unlike
  `login_more.php` it **is** conceptually part of Admin's audit domain (it queries
  `log_tb` to reconstruct per-user login sessions, very similar logic to
  `log_details.php`'s session-pairing algorithm). It outputs raw JSON, has no HTML
  chrome, and gates on `strstr($ref_url,'igrapix.org')` in its own referer check —
  this looks like it was built for an **external caller** (possibly on the vendor's
  own `igrapix.org` domain, not part of this app's own UI) that was never wired into
  the live CIS front end. See §15 for full detail; it is documented as its own section
  because of its audit-domain relevance, but flagged as orphaned/unreachable from
  inside this app today.

---

## Table of contents

1. [Add User Account — `account_add.php`](#1-add-user-account--account_addphp)
2. [Edit User Account — `account_edit.php`](#2-edit-user-account--account_editphp)
3. [Login Access Restrictions — `access.php`](#3-login-access-restrictions--accessphp)
4. [Department Authentication — `department_authentication.php`](#4-department-authentication--department_authenticationphp)
5. [Staff Department Authentication — `department_authentication_v1.php`](#5-staff-department-authentication--department_authentication_v1php)
6. [Menu Authentication — `authentication_add.php`](#6-menu-authentication--authentication_addphp)
7. [Dashboard Widget Access — `dashboard_access.php` (+ `dashboard_accessbystaff.php`)](#7-dashboard-widget-access--dashboard_accessphp--dashboard_accessbystaffphp)
8. [Change Password — `change_password.php`](#8-change-password--change_passwordphp)
9. [Reset Account — `otp_account_reset.php`](#9-reset-account--otp_account_resetphp)
10. [Committee Access — `committee_access.php`](#10-committee-access--committee_accessphp)
11. [HOD Page Authentication — `staff_authentication_add.php`](#11-hod-page-authentication--staff_authentication_addphp)
12. [Staff Page Authentication — `staff_page_authentication_add.php`](#12-staff-page-authentication--staff_page_authentication_addphp)
13. [Login Dashboard — `log_dashboard.php`](#13-login-dashboard--log_dashboardphp)
14. [Login Log Details — `log_details.php`](#14-login-log-details--log_detailsphp)
15. [Login Log (orphaned AJAX endpoint) — `login_log.php`](#15-login-log-orphaned-ajax-endpoint--login_logphp)

---

## 1. Add User Account — `account_add.php`

**Purpose:** Create a brand-new admin back-office login account in
`web_account_setup`, with an auto-created permissive `access_tb` row so the account is
immediately loginable every day/all hours.

**Entry point / menu:** Sidebar → Admin → "Add User Account" (`account_add.php`).

**Page layout (top→bottom):**
- Single panel, "Basic Information" heading.
- **Member Name** (text, required, `onKeyUp="dodacheck(this)"` — client-side character
  filter, max 70).
- **Mobile** (number input, max 15, optional).
- **Email** (email input, max 70, optional).
- **Username** (text, required, `autocomplete=off`, `onKeyUp="dodacheckalphanum(this)"`).
- **Password** (password input, required, `autocomplete=off`) + **Show** button
  (toggles input type + label text) + **Generate Password** button (client-side JS,
  6-char random string from a fixed `keylist`, fills both Password and Confirm
  Password fields).
- **Confirm Password** (password input, required).
- **Save** / **Reset** buttons; hidden `form_reset` anti-double-submit token
  (`date('His').rand(0000,1111)`).

**Data source (load):** None — pure create form, no dropdowns populated from DB.

**Save/submit behavior (`Submit=='Save'`):**
- Anti-double-submit guard: compares posted `form_reset` against
  `$_SESSION['check_form_submit']`; if equal, the whole POST is silently ignored (no
  re-render of an error — this guards against a browser back-button re-POST).
- Duplicate check: `SELECT id FROM web_account_setup WHERE del=1 AND ( member_id="<username>" [OR address_email="<email>"] )` —
  if any row matches, **insert is skipped** and `"Wrong! Email ID already exists...."`
  is shown (the message text is about email even though the match can also be on
  username — a minor UX mislabel to be aware of).
- Password confirmation: `trim($password)==trim($confirm_password)` — mismatch skips
  the insert with `"Wrong! Invalid Password...."`.
- Password is encrypted with `encrypt()` from `password.php` (AES-128-CTR, see
  "Password encryption scheme" below) before storage — **not hashed**, it is
  reversibly encrypted so the plaintext can be redisplayed later (see `account_edit.php`
  §2, which decrypts and displays the current password in plaintext on the edit
  screen).
- **INSERT INTO `web_account_setup`** columns: `member_id, member_name,
  address_mobile, address_email, password, created_dt, created_ip, created_by`. `del`
  is not set explicitly (relies on table default = `1`, i.e. active per CLAUDE.md's
  `del=1`-is-active convention).
- On successful insert, the new row's `id` is re-looked-up
  (`SELECT id FROM web_account_setup WHERE del=1 AND member_id=... AND created_dt=...
  AND created_ip=... AND created_by=... ORDER BY id DESC`) and immediately used to
  **INSERT INTO `access_tb`**: `(user_id, day_base, allow_day, allow_from_time,
  allow_to_time, created_dt, created_ip, created_by) VALUES ('<new_id>', '1',
  '1,2,3,4,5,6,7', '00:00:00', '23:59:00', ...)` — i.e. every new account gets a
  default "allowed every day of the week, 00:00–23:59" access window automatically;
  `access.php` (§3) is only needed later to *restrict* it.
- Logged via `insert_log()` with operation `Add` (`Successful`/`Unsuccessful`).

**Business logic / edge cases:**
- `$dob`/`$from_date[0]` handling (lines 51–56) references POST fields
  (`dob`, `from_date[]`) that do not exist anywhere in this form's HTML — dead/vestigial
  code copy-pasted from a richer profile-creation screen elsewhere in the legacy app;
  `$doj` is computed but never used in the INSERT. Harmless but confirms this file was
  derived from a larger member-profile template.
- No server-side validation on Username format beyond the client-side
  `dodacheckalphanum` filter — a rewrite should add its own server-side validation.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (insert + duplicate-check read),
`access_tb` (insert), `log_tb` (audit).

---

## 2. Edit User Account — `account_edit.php`

**Purpose:** Combined **search/list + edit profile + change password + soft-delete**
screen for existing `web_account_setup` accounts. Single PHP file switches between a
list view and a single-record edit view based on whether any `update[]` button was
posted (`edit_row_id`).

**Entry point / menu:** Sidebar → Admin → "Edit User Account" (`account_edit.php`).

**Page layout — List view (default):**
- Filter bar: free-text **Search** box (value preserved from `$_REQUEST['search']`) +
  **Search** button (icon only, `name="searchbtn" value="Search"`).
- Pagination summary ("Showing X to Y of Z entries") via shared `call_pagenation()`,
  page size **20**. Always excludes the `igrapix` super-account
  (`member_id!="igrapix"`) from both the list and its count.
- Results table: columns **Member ID**, **Member Name**, and an actions cell with an
  **Edit** button (`name="update[<counter>]" value="<row id>"`, plain form submit) and
  a **Trash** button (Bootstrap confirm modal → `delete=Confirm&confirm=<id>`).
- "No data available" row if the filtered query returns 0 rows.
- Search-string validity gate: the free-text search is only applied if
  `ctype_alnum()` (allowing spaces/commas/hyphens/periods as separators) passes — a
  search string containing other punctuation is silently dropped and the unfiltered
  list is shown instead (no error message).

**Page layout — Edit view (`edit_row_id!=''`, reached only via an `update[]` submit,
not via a GET/URL parameter):**
- "Back" link (preserves `page`/`search` querystring) at both top and bottom.
- **"Basic Information"** panel: Member ID (read-only, `htmlentities`-escaped display
  only, not an input), Member Name (required, text), Mobile (number), Email (email),
  Photo (file upload, `<1MB`, jpeg/gif/jpg/png only) with existing-photo preview +
  **Remove** button (`ConfirmDelete('hd_photo_div')`, clears the hidden field
  client-side only — the file itself is not deleted from disk until Save re-submits
  with the field blanked and a new save happens to overwrite `photo` to empty), a
  hidden `edit_row_id`, **Save** (`name="Submit0"`) / **Reset** buttons.
- **"Change Password"** panel (separate `<form>`, separate submit): read-only
  **Current Password** display (decrypted plaintext — see password-scheme note below),
  **New Password** + Show/Generate-Password buttons (same JS as Add), **Confirm New
  Password**, hidden `edit_row_id`, **Save** (`name="Submit3"`) / **Reset** buttons.

**Data source (load):**
- List: `SELECT * FROM web_account_setup WHERE del=1 AND member_id!="igrapix"
  <search filter> ORDER BY member_id ASC LIMIT <start>,20`; search filter (when valid)
  is `AND ( member_id LIKE '%x%' OR member_name LIKE '%x%' )`.
- Edit-view load: `SELECT * FROM web_account_setup WHERE del=1 AND id="<edit_row_id>"`.
  `password_temp = trim(decrypt($row['password']))` — the stored AES-128-CTR
  ciphertext is decrypted server-side and echoed **as plaintext** directly into the
  "Current Password" panel's HTML.

**Save/submit behavior:**
- **Delete** (`delete=Confirm`): soft delete —
  `UPDATE web_account_setup SET del="0", updated_dt/ip/by WHERE id="<confirm>"` (per
  CLAUDE.md, `del=0` here correctly means the account becomes inactive/deleted).
- **Save profile** (`Submit0=='Save'`): duplicate-email guard —
  `SELECT id FROM web_account_setup WHERE del=1 AND id!="<edit_row_id>" [AND
  address_email="<email>"]` — if any *other* active account already has that email,
  the update is skipped with `"Wrong! Email ID already exists...."`. Photo upload:
  copies (not moves) the uploaded file to `img/member/<random>.<ext>` where
  `<random> = date('dmyHis').rand(1000,9999)`; if no new file is uploaded, the hidden
  `hd_photo` value (existing filename) is preserved. **UPDATE `web_account_setup` SET
  member_name, address_mobile, address_email, photo, updated_dt/ip/by WHERE
  id="<edit_row_id>"`.**
- **Save password** (`Submit3=='Save'`): requires `trim($password)==trim($confirm_password)`;
  encrypts with `encrypt()` and **UPDATE `web_account_setup` SET password, updated_dt/ip/by
  WHERE id="<edit_row_id>"`.** Mismatch shows `"Wrong! Password not match...."` and
  does not write.
- No `form_reset` anti-double-submit token is used on this screen (unlike
  `account_add.php`/`department_authentication.php`/etc.) — a rewrite should decide
  whether to add one for consistency, since a double-POST here (e.g. a slow network
  retry) is not guarded against.
- All four outcomes (`Delete`, `Update` profile, `Update` password, plain `View`) are
  logged via `insert_log()`.

**Business logic / edge cases:**
- The **plaintext current password is rendered directly in the page HTML** on every
  edit-view load — this is a meaningful security exposure carried over from legacy
  (anyone who can view this screen, or intercept the response, sees the real
  password). Flag prominently for the rewrite: do not reproduce plaintext password
  display; if "show current password" is a required feature, gate it behind an
  explicit re-reveal action, not an always-rendered field.
- Filter state (`search`/`page`) round-trips via the "Back" link's querystring so
  returning from an edit preserves the list position.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (read/update/soft-delete), `log_tb` (audit).
Also writes uploaded photos to the filesystem (`img/member/*.{jpg,jpeg,gif,png}`), not
a DB table.

---

## 3. Login Access Restrictions — `access.php`

**Purpose:** Per-admin-account login gating — restrict a specific account to a
day-of-week + time-of-day window, **or** a specific date/time range, **or** require a
numbered "login key" be supplied at login (`local_access`), by editing that account's
single `access_tb` row (auto-created for every account by `account_add.php`, see §1).

**Entry point / menu:** Sidebar → Admin → "Access" (`access.php`).

**Page layout:**
- **Select Member** dropdown (`member_id`, `onchange="this.form.submit()"`) — options
  from `web_account_setup WHERE del=1 AND access_type!="Global"` (i.e. `Global`-tier
  accounts, presumably reserved super-admins, are excluded from this restriction
  screen entirely and can never be access-window-limited here).
- On selecting a member (server re-renders after the auto-submit), an **Access
  Method** panel appears with three mutually-exclusive checkboxes rendered as columns
  in one table row:
  - **"By Login Key"** (`local_access` checkbox) — independent of the other two (can be
    combined with either), controls whether a numbered login-key challenge is required.
    A **key-count dropdown** (`random_key`, 1–4) plus up to 4 conditionally-shown text
    inputs (`random_key_1..4`, labelled `k1..k4`) — `call_loginkey_enable()` JS
    toggles visibility of `k1..k4` based on the selected count. A note explains
    "Reset login to clear the key text box".
  - **"By Day"** (`day_base` checkbox) — reveals 7 day checkboxes (Mon–Sun,
    values 1–7) plus **From**/**To** time inputs (`a_from_time`/`a_to_time`,
    `HH:mm` picker).
  - **"By Date & Time"** (`date_base` checkbox) — reveals **From**/**To**
    datetime-picker inputs (`from_date`/`to_date`, `DD-MM-YYYY HH:mm`).
  - Client-side JS `call_live_option()` enforces that "By Day" and "By Date & Time"
    are mutually exclusive (checking one unchecks the other); `call_day()` auto-flips
    `day_base`/`date_base` based on whether any day checkbox is ticked.
- **Save** button.

**Data source (load):**
- Member dropdown: `SELECT * FROM web_account_setup WHERE del=1 AND access_type!="Global" ORDER BY member_id ASC`.
- On member selection, account tier check: `SELECT * FROM web_account_setup WHERE id="<id>" AND del=1` →
  reads `access_type`; **if `access_type=='Global'`, the whole access-method panel is
  suppressed** (defense in depth beyond just excluding Global accounts from the
  dropdown — even if a Global account's id were POSTed directly, the form still
  wouldn't render for it).
- Existing row: `SELECT * FROM access_tb WHERE del=1 AND user_id='<id>'` — fields read:
  `id, user_id, random_id, random_id_1..4, date_base, from_date, to_date, day_base,
  allow_day, local_access, allow_from_time, allow_to_time`.

**Save/submit behavior (`Submit=='Save'`):**
- Branches on which of `date_base`/`day_base` was posted as `1`:
  - `date_base==1`: parses `from_date`/`to_date` (or `'0000-00-00 00:00:00'` if
    blank) into `Y-m-d H:i:s`; **forces `day_base=0`**, `allow_day=''`,
    `allow_from_time='00:00:00'`, `allow_to_time='00:00:00'` — i.e. the two modes are
    hard mutually exclusive server-side too, not just client-side.
  - `day_base==1`: builds `allow_day` as a comma-joined string of the 7 posted `day[]`
    checkbox values (blank entries become empty list positions, then the trailing
    comma is trimmed — so unchecked days leave **empty string segments** in the
    middle of the list, e.g. `1,,3,,,6,` before the final `substr` only trims the
    *trailing* comma — this means `allow_day` can contain empty segments for
    unchecked days rather than only listing the checked ones; a rewrite should
    normalize this to a clean comma list of only the checked day numbers).
    `allow_from_time`/`allow_to_time` get `:00` appended if non-empty (`HH:mm` →
    `HH:mm:00`), else default to `'00:00:00'`. **Forces `date_base=0`**,
    `from_date`/`to_date` = `'0000-00-00 00:00:00'`.
  - If neither is posted as `1`, both date/day fields are left at their prior
    (`$_POST`-derived, effectively empty) values — no explicit "clear everything"
    branch exists distinct from the two above.
- `random_key_update` string: for each of `random_key_1..4`, if the **posted value is
  empty**, an explicit `random_id_N=""` fragment is added to the UPDATE's SET clause —
  this looks logically inverted (normally you'd want to clear the field when the
  *count* drops below N, not simply whenever the text box is empty) but is exactly
  what the code does; note this literal behavior if porting.
- `access_id==''` (no existing row — should not normally happen since
  `account_add.php` always creates one, but the code defensively handles it) →
  **INSERT INTO `access_tb`** (`user_id, local_access, random_id, date_base,
  from_date, to_date, day_base, allow_day, allow_from_time, allow_to_time,
  created_dt, created_ip, created_by`).
- Else → **UPDATE `access_tb` SET** `user_id, local_access, random_id,
  <random_key_update fragments>, date_base, from_date, to_date, day_base, allow_day,
  allow_from_time, allow_to_time, updated_by/ip/dt` **WHERE id="<access_id>"**.
- Logged via `insert_log()` with description `'User id->'.$member_id` (`Update`,
  `Successful`/`Unsuccessful`).

**Business logic / edge cases — this is the access_tb day/time restriction engine
referenced in the task brief:**
- The three access dimensions are independently stored on the same `access_tb` row:
  `local_access` (login-key requirement, works alongside either mode), and
  `date_base`/`day_base` (mutually exclusive absolute-date-range vs. recurring-weekly
  window). The actual **enforcement** of these columns at login time lives in the
  login flow (`routes/auth.js` / legacy `password.php`/login controller per
  `docs/auth-flow.md`), not in this screen — this file only edits the
  configuration row.
- Columns confirmed from this file's own SQL: `user_id, local_access, random_id,
  random_id_1, random_id_2, random_id_3, random_id_4, date_base, from_date, to_date,
  day_base, allow_day, allow_from_time, allow_to_time, created_dt, created_ip,
  created_by, updated_dt, updated_ip, updated_by`.
- `Global` accounts are structurally exempt from ever having an access-window
  configured through this screen.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (read), `access_tb` (read/insert/update),
`log_tb` (audit).

---

## 4. Department Authentication — `department_authentication.php`

**Purpose:** Scope an **admin account** (`web_account_setup`) to a single department —
assigning which department's HOD/staff-list/U.G-students/P.G-list/internship options
that admin account is allowed to operate against elsewhere in the app. One row per
`(user_id)` in `dept_authentication`.

**Entry point / menu:** Sidebar → Admin → "Department Authentication"
(`department_authentication.php`).

**Page layout:**
- **User** dropdown (`user_name_ref`, `onchange="this.form.submit()"`) — options from
  `web_account_setup WHERE del=1 AND member_id!="iGrapix"`, each option suffixed with
  `*` if that user already has a `dept_authentication` row
  (cross-referenced via `GROUP_CONCAT(user_id) FROM dept_authentication WHERE del=1`).
- On selecting a user, a **Department** dropdown (`dept_name_ref`,
  `onchange="this.form.submit()"`) appears — options from `staff_dept_master WHERE
  del=1 ORDER BY d_order ASC`.
- On selecting a department, four more fields appear:
  - **Dept HOD** (`dept_hod[]`, single-ish select, not marked multiple in this file
    despite the `[]` name — options are staff in that department with
    `staff_designation_tb.is_academic=1` and an active `to_date`).
  - **Staffs** (`dept_staff[]`, multi-select via `multipleSelect()`) — same staff
    query as HOD (is_academic=1, active `to_date`), independently selectable.
  - **U.G** (`dept_student[]`, multi-select) — options are **all** `staff_dept_master`
    department rows (not students — this "U.G" list is actually a *department*
    multi-select, presumably meaning "which departments' U.G students this account can
    see" reusing the same department id space).
  - **Internship** (`dept_internship[]`, multi-select) — options from `master_setup
    WHERE category="Internship Department" AND del!=0`.
  - **P.G** (`dept_pg[]`, multi-select) — options from `master_setup WHERE
    category="Department" AND del!=0` (a **different** `master_setup` category value
    than "Internship Department" above, both drawn from the same shared lookup table).
  - **Course** (`course_id[]`, multi-select) — options from `basic_setup_course_tb
    WHERE del!=0 ORDER BY c_order ASC`.
- **Save** button + "Menu Authentication" / "Dashboard Access" quick-link buttons
  (`target="_blank"`, carry `?uid=<user_name_ref>` to `authentication_add.php` /
  `dashboard_access.php` respectively — see §6/§7).

**Data source (load):** All dropdown queries above; existing row:
`SELECT id, user_id, dept_id, dept_hod, dept_staff, dept_student, dept_intern,
dept_pg, course_id FROM dept_authentication WHERE del=1 AND user_id="<selected>"` —
each multi-value column (`dept_staff`, `dept_hod`, `dept_student`, `dept_pg`,
`course_id`) is a comma-joined id list, `explode(',', ...)`'d to drive the
multi-select `selected` state.

**Save/submit behavior (`Submit=='Save'`, guarded by both a required
`dept_name_ref`/`user_name_ref` check and the standard `form_reset` anti-double-submit
token):**
- `$f_r_id` (posted `r_id`, the existing row's id if any) determines branch:
  - Numeric and non-empty → **UPDATE `dept_authentication` SET** `dept_id, user_id,
    dept_staff, dept_hod, dept_student, dept_pg, dept_intern, course_id, updated_dt/ip/by`
    **WHERE id="<r_id>"**.
  - Else → **INSERT INTO `dept_authentication`** (`dept_id, user_id, dept_hod,
    dept_staff, dept_student, dept_pg, dept_intern, course_id, created_dt, created_ip,
    created_by`).
- All multi-select arrays are `addslashes(implode(',', $array))`'d before storage —
  same comma-joined-string pattern as Library's `resource_department` (see
  `library-module.md` §4) — any consumer elsewhere in the app that reads
  `dept_staff`/`dept_hod`/etc. needs the same substring-match OR-chain pattern rather
  than exact equality or a join.
- Logged via `insert_log()` (`Update`, `Successful` only on the success path — no
  explicit `else` failure branch/log call is present in this file for the Save action,
  unlike most other Admin screens).

**Business logic / edge cases:**
- `$f_dept_head` referenced in the `addslashes()` call chain (line 32) is never
  assigned from `$_POST` anywhere — dead variable, always empty; harmless but present
  in the INSERT's `dept_hod` fallback path is actually fed from `$f_dept_hod`
  (assigned correctly), so this specific dead variable does not affect behavior.
- One `dept_authentication` row exists per `user_id` (admin account), not per
  department — an account can only be scoped to **one** department at a time through
  this screen (selecting a different department for the same user overwrites the
  existing row via the `r_id` update path, it does not create a second row).
- `committee_access.php` (§10) edits an **additional column** (`event_committee`) on
  this exact same `dept_authentication` table/row — the two screens are best
  understood as two different edit views onto one underlying department-authorization
  record per admin account.

**Print/report output:** none.

**Tables touched:** `dept_authentication` (read/insert/update), `web_account_setup`
(read, user dropdown), `staff_dept_master` (read, department dropdown),
`staff_profile_tb` ⋈ `staff_designation_tb` (read, HOD/Staff dropdowns),
`master_setup` (read, Internship/P.G dropdowns), `basic_setup_course_tb` (read, Course
dropdown), `log_tb` (audit).

---

## 5. Staff Department Authentication — `department_authentication_v1.php`

**Purpose:** The staff-tier counterpart to §4 — scopes a **staff member** (not an
admin account) who is flagged `atten_auth=1` (an HOD-designated staff record) to one
or more departments, with the same Staffs/U.G/Internship/P.G/Course
sub-authorizations. Writes to a **separate** table, `dept_auth` (singular, no
`entication` suffix — easy to confuse with `dept_authentication` used by §4/§10;
they are genuinely different tables with overlapping-but-not-identical column sets).

**Entry point / menu:** Sidebar → Admin → "Staff Department Authentication"
(`department_authentication_v1.php`).

**Page layout:** Structurally identical to §4 with these differences:
- **User** dropdown sources `staff_profile_tb WHERE del=1 AND atten_auth=1 AND
  (releaving_date > DATE(NOW()) OR releaving_date="0000-00-00") ORDER BY staff_id ASC`
  (active HOD-flagged staff), not `web_account_setup`.
- **Department** is a **multi-select** here (`dept_name_ref[]`, class `mcheck`,
  `multipleSelect()`) — in §4 it was a single dropdown. A department already assigned
  to this staff member as their *primary* HOD department (from a secondary lookup —
  see below) is marked with a trailing ` *` in its option label.
- No separate "Dept HOD" field (the *user themself* is implicitly the HOD in this
  screen's model — there is nothing here selecting who the HOD is, since that's the
  selected user).
- The "Menu Authentication"/"Dashboard Access" quick-links point to
  `staff_authentication_add.php?uid=...` and `dashboard_accessbystaff.php?uid=...`
  respectively (§11 and the sibling of §7), not the admin-account versions §6/§7 that
  §4 links to.

**Data source (load):**
- Existing row: `SELECT id, user_id, dept_id, dept_staff FROM dept_auth WHERE del=1
  AND dept_hod="<selected staff id>"` — note the row is looked up **by `dept_hod`**,
  not by a generic `user_id` column (this table's `dept_hod` column is effectively the
  "owner" of the row, filled with the selected staff's own id at save time — see
  below).
- `$sel_dept = $dept_auth['dept_id']` is used purely to render the ` *` marker
  described above; `$dept_name_ref` (the actual selected-department list driving the
  multi-select's checked state) is separately `explode(',', $dept_auth['dept_id'])`'d
  — both derived from the same `dept_id` column, just used two different ways in the
  render.

**Save/submit behavior (`Submit=='Save'`, requires `user_name_ref`, same
`form_reset` anti-double-submit pattern as §4):**
- `dept_id` = `implode(',', $_POST['dept_name_ref'])` (the multi-select).
- `dept_hod` = the selected staff's own id (`$user_name_ref`) — i.e. this table's
  `dept_hod` column always equals "the staff member this authorization row is for",
  reinforcing that department-HOD-ness is implicit in *being the selected user* on
  this screen, not a separate assignable field.
- `$f_r_id` (posted `r_id`) numeric → **UPDATE `dept_auth` SET** `dept_id, dept_hod,
  dept_staff, dept_student, dept_pg, dept_intern, course_id, updated_dt/ip/by` **WHERE
  id="<r_id>"**. Else → **INSERT INTO `dept_auth`** (`dept_id, dept_hod, dept_staff,
  dept_student, dept_pg, dept_intern, course_id, created_dt, created_ip, created_by`).
- Logged via `insert_log()` (`Update`, success path only — same as §4, no explicit
  failure-path logging for Save).

**Business logic / edge cases:**
- `dept_auth` (this file) and `dept_authentication` (§4/§10) are **not** the same
  table and **not** simply an old/new version of each other — they serve genuinely
  different subject populations (staff HODs vs. admin accounts) that both need
  department-scoped authorization, and were apparently implemented as two parallel,
  independently-evolved tables rather than one shared schema. A rewrite should decide
  deliberately whether to unify these or keep them separate; do not assume one
  supersedes the other.
- The "Staffs" multi-select query in this file (`staff_dept_master` ⋈
  `staff_profile_tb`/`staff_designation_tb`, `is_academic=1`) is **only populated
  inside the department-options loop when `$dept_name_ref` (the *existing* selected
  departments, not the newly-clicked one) is non-empty** — for a brand-new
  authorization row (no prior `dept_auth` record), the Staffs multi-select will render
  empty on first department selection until the row exists and is reloaded; verify
  this UX gap against the live app.

**Print/report output:** none.

**Tables touched:** `dept_auth` (read/insert/update), `staff_profile_tb` (read, user +
staff dropdowns), `staff_dept_master` (read, department dropdown),
`staff_designation_tb` (read, staff filtering), `master_setup` (read,
Internship/P.G dropdowns), `basic_setup_course_tb` (read, Course dropdown), `log_tb`
(audit).

---

## 6. Menu Authentication — `authentication_add.php`

**Purpose:** Grant/revoke individual **sub-menu-level** page access for a single admin
account (`web_account_setup`), checkbox-grid style, against the full **admin** menu
tree (`basic_admin_menu_tb`). This is the table read by `menuAuthForModule()` in the
modernized Express middleware (`server/src/middleware/menuAuth.js` per CLAUDE.md).

**Entry point / menu:** Sidebar → Admin → "Menu Authentication"
(`authentication_add.php`), also reachable via `?uid=<id>` from §4's quick-link.

**Page layout:**
- **Select User** dropdown (`member_id`, `onchange="this.form.submit()"`) — options
  from `web_account_setup WHERE del=1 AND access_type!="Global"`, each suffixed ` *`
  if the account already has any `authentication_tb` rows. Pre-selected from either
  the posted `member_id` or a `?uid=` querystring param (used by the §4 deep-link).
- On selection, a 4-column checkbox grid: header row has a **"Check All"** master
  checkbox (`call_check_all()` toggles every row's checkbox). Body: one row per
  distinct `main_menu_name` (ordered by `admin_menu_category_tb.category_order` then
  `main_menu_order`), main-menu name in the first cell, then every enabled sub-menu
  under that main menu wrapped 4-per-row (`td_counter%4==0` starts a new `<tr>`) as a
  labeled checkbox (`a_auth[]`, value = the sub-menu row's `id`), pre-checked if an
  active `authentication_tb` grant already exists for that `(user, menu)` pair.
- **Save** button.

**Data source (load):**
- User dropdown + `*` marker: `GROUP_CONCAT(DISTINCT(user_id)) FROM
  authentication_tb WHERE del=1`.
- Menu category ordering: `SELECT id FROM admin_menu_category_tb WHERE del=1 ORDER BY
  category_order ASC` → builds a `FIELD(category_id, '<ids>')` ORDER BY fragment.
- Main menus: `SELECT DISTINCT(main_menu_name) FROM basic_admin_menu_tb WHERE del=1
  AND menu_enable=1 AND category_id!=0 ORDER BY <category FIELD()>, main_menu_order+0 ASC`.
- Sub menus per main menu: `SELECT * FROM basic_admin_menu_tb WHERE
  main_menu_name='<name>' AND del=1 AND menu_enable=1 ORDER BY sub_menu_order ASC` —
  **only rows with a non-empty `sub_menu_link` are rendered as a checkbox** (rows with
  no link are skipped entirely, not even shown as a disabled placeholder — unlike the
  4-column padding logic which still pads with blank `<td>`s for alignment).
- Per-checkbox grant lookup: `SELECT * FROM authentication_tb WHERE menu_id="<m_id>"
  AND user_id="<a_id>" AND del=1`.

**Save/submit behavior (`Submit=='Save'`):**
- First, **blanket-revokes every currently-granted menu for this user**:
  `UPDATE authentication_tb SET authentication="0", updated_by/ip/dt WHERE
  user_id="<user_id_ref>" AND authentication=1 AND del=1` — this flips the
  `authentication` flag column (not the `del` soft-delete column) to `0` for all
  existing grants.
- Then, for each posted `a_auth[]` (checked menu id):
  - Look up any existing row for `(menu_id, user_id)` regardless of its current
    `authentication`/`del` state (`SELECT * FROM authentication_tb WHERE
    menu_id="<m>" AND user_id="<u>" AND del=1`).
  - If none exists → **INSERT INTO `authentication_tb`** (`user_id, menu_id,
    authentication, created_dt, created_ip, created_by`) with `authentication='1'`.
  - If one exists → **UPDATE ... SET user_id, menu_id, authentication="1",
    updated_by/ip/dt WHERE id="<row id>"`** — re-activates it.
- Net effect: any menu **not** re-checked on this save is left with
  `authentication=0` (revoked) from the blanket step; any menu checked is
  (re-)granted with `authentication=1`. This is a "flag flip", not a soft-delete —
  `del` itself is never touched by this Save flow (rows stay `del=1` forever once
  created; `authentication` is the real on/off switch consumed by `menuAuthForModule()`).
- Logged via `insert_log()` (`Update` on success, `Add` on failure — note the
  operation label used for the failure branch differs from the success branch, a
  minor inconsistency to note if the log is used for reporting).

**Business logic / edge cases:**
- `menu_id` grants are per-**sub-menu-link** row (`basic_admin_menu_tb.id`), not per
  main-menu — a user can be granted individual sub-pages within a main menu section
  without the whole section.
- This table (`authentication_tb`) is the one CLAUDE.md's `docs/auth-flow.md`
  describes as consulted by `menuAuthForModule('exam')`-style middleware, joined
  against `basic_admin_menu_tb`'s PHP-filename patterns for the requested module — so
  this screen's Save behavior is directly load-bearing for the modernized app's own
  authorization, not just legacy-only.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (read, user dropdown),
`admin_menu_category_tb` (read, category ordering), `basic_admin_menu_tb` (read, menu
tree), `authentication_tb` (read/insert/update), `log_tb` (audit).

---

## 7. Dashboard Widget Access — `dashboard_access.php` (+ `dashboard_accessbystaff.php`)

**Purpose:** Per-account enable/disable + display-order control over which of ~28
named dashboard widget tiles (Staff Attendance, U.G Attendance, Hostel, Scholarship,
etc. — the same widget catalog the main CIS dashboard renders) appear for a given
account. Two sibling screens, identical logic, different audience/table (see the
"Superseded" section above for why these are siblings, not duplicates).

**Entry point / menu:** Sidebar → Admin → "Dashboard Access" (`dashboard_access.php`);
also reachable via `?uid=<id>` from §4's quick-link.
`dashboard_accessbystaff.php` is reachable only via `?uid=<id>` from §5's quick-link
(no confirmed independent sidebar entry).

**Page layout (both files, identical structure):**
- **Select User** dropdown (`a_id`, `onchange="this.form.submit()"`), pre-selected
  from POST or `?uid=`.
  - `dashboard_access.php`: options from `web_account_setup` — if the **currently
    logged-in** admin's own `access_type` is `Global`, **all** accounts are listed
    (`WHERE del=1`); otherwise only non-Global accounts (`access_type!="global"`,
    case-insensitively different literal casing from the `Global` check used
    elsewhere in this module — worth normalizing in a rewrite). Options suffixed ` *`
    if the account already has `dashboard_access` rows.
  - `dashboard_accessbystaff.php`: options from `staff_profile_tb WHERE del=1 AND
    atten_auth=1 ORDER BY staff_id ASC` — no Global-account branching (staff have no
    such tier).
- On user selection: a 4-per-row grid of `[checkbox] [order text input] [widget
  label]` triples, one per widget in the hard-coded `$dashboard_list` PHP array
  (widget internal key → display label; the two files' arrays are identical except
  `dashboard_accessbystaff.php`'s list omits the trailing `student_ghostel` /
  `student_lhostel` entries present in `dashboard_access.php`'s — 28 vs 26 widgets).
  Widgets the user already has a `dashboard_access`/`dashboard_accessbystaff` row for
  are rendered first (in `widget_order` order, checkbox pre-checked per stored
  `status`), followed by any remaining widgets from the master list not yet given a
  row (unchecked, blank order).
  - Header row: **"Check All"** (`call_check_all()`) and **"Fill Default"**
    (`call_fill_all()` — auto-numbers every order box `1..N` in DOM order, or clears
    them all if unchecked) checkboxes.
- **Save** button; `form_reset` anti-double-submit token.

**Data source (load):** As above; existing grants: `SELECT * FROM dashboard_access
[or dashboard_accessbystaff] WHERE del=1 AND user_id='<id>' ORDER BY widget_order ASC`.

**Save/submit behavior (`Submit=='Update'`, both files identical logic against
their own table):**
- First, blanket soft-deletes every existing row for the user:
  `UPDATE dashboard_access SET del="0", updated_by/ip/dt WHERE user_id="<id>" AND
  del="1"` — this **is** a real soft-delete (unlike §6's flag-flip pattern), matching
  the CLAUDE.md `del=0`-means-deleted convention.
- Then, for each posted grid row `i`: if `row_id[i]` is empty **and**
  `enable_disable[i]` is truthy (checkbox was checked) → **INSERT** a new row
  (`user_id, widget_name, widget_order, status, created_dt, created_ip, created_by`).
  Else if `row_id[i]` is non-empty → **UPDATE** that row's `widget_name, widget_order,
  status, del="1"` (re-activating it) **WHERE id="<row_id>" AND user_id="<id>"`.**
  Rows for widgets that were **unchecked** and have no prior `row_id` are simply
  skipped (never inserted) — so unchecking a never-before-saved widget is a no-op, and
  unchecking a previously-saved widget correctly leaves it soft-deleted from the first
  blanket step (since it won't be re-inserted/re-updated to `del=1`) as long as its
  `row_id` was posted at all. Every posted widget row (checked or not) carries its
  `row_id` in a hidden field, so in practice this always resolves correctly for
  previously-saved widgets — only brand-new/never-saved-and-left-unchecked widgets are
  the ones silently skipped, which is the correct behavior (nothing to insert for an
  unchecked new widget).
- Logged via `insert_log()` (`Update`, success only, same as §4/§5's Save omitting an
  explicit failure-path log).

**Business logic / edge cases:**
- Widget catalog (`$dashboard_list`) is a **hard-coded PHP array in the file itself**,
  not a DB-driven lookup table — adding a new dashboard widget type requires editing
  this file (and its sibling) directly, there is no admin UI for the widget catalog
  itself.
- The "mark everything deleted, then re-insert/re-activate from the posted grid"
  pattern is identical in shape to Library's `library_book_cate.php` Save flow (see
  `library-module.md` §3) — same class of destructive-if-partial-submit risk applies:
  if a widget's hidden `row_id` were ever missing from a submitted grid (shouldn't
  normally happen given the server always renders it), that widget would be
  soft-deleted with no re-activation path until the page believes it needs a fresh
  insert.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (read, user dropdown + `Global` tier check),
`staff_profile_tb` (read, user dropdown for the staff sibling),
`dashboard_access`/`dashboard_accessbystaff` (read/insert/update/soft-delete),
`log_tb` (audit).

---

## 8. Change Password — `change_password.php`

**Purpose:** Self-service profile + password change for the **currently logged-in**
admin account (no user-selection dropdown — always operates on
`$a_username = $_SESSION['empusername_login']`).

**Entry point / menu:** Sidebar → Admin → "Change Password" (`change_password.php`).

**Page layout:** Same two-panel structure as the edit-view half of `account_edit.php`
(§2) — "Basic Information" (Username read-only display, Name, Mobile, Email, Save/Reset)
and "Change Password" (**Current Password** decrypted-plaintext display, New
Password + Show/Generate buttons, Confirm New Password, Save/Reset) — but with no
Photo field and no list/search view (this screen only ever shows the current user's
own record, `$edit_row_id = $a_username` is fixed at the top of the file, not
selectable).

**Data source (load):** `SELECT * FROM web_account_setup WHERE del=1 AND
member_id="<a_username>"`; `password_temp = trim(decrypt($row['password']))` — same
plaintext-password-exposure pattern flagged in §2.

**Save/submit behavior:**
- **Save profile** (`Submit0=='Save'`): duplicate check —
  `SELECT id FROM web_account_setup WHERE del=1 AND member_id!="<a_username>" AND
  (address_email="<email>" OR address_mobile="<mobile>")` (note: **this screen also
  checks mobile-number uniqueness**, unlike `account_edit.php`'s profile-save which
  only checks email) — if any other active account shares that email or mobile, the
  update is skipped with `"Wrong! Email ID already exists...."`. Else **UPDATE
  `web_account_setup` SET member_name, address_mobile, address_email, updated_dt/ip/by
  WHERE member_id="<a_username>"`.**
- **Save password** (`Submit3=='Save'`): same `trim($password)==trim($confirm_password)`
  guard as §1/§2; encrypts with `encrypt()`; **UPDATE ... SET password, updated_dt/ip/by
  WHERE member_id="<a_username>"`.**
- This file defines its **own local copies** of `encrypt()`/`decrypt()` (identical
  body to `password.php`'s, not `include_once('password.php')`'d) — a duplicated
  implementation of the same AES-128-CTR scheme, functionally equivalent but a code
  smell to clean up in the rewrite (single source of truth for the crypto helper).
- Logged via `insert_log()` for both Save branches.

**Business logic / edge cases:**
- Because `$edit_row_id` is hard-set to the session's own username, this screen cannot
  be used to edit any other account — it is strictly self-service, complementing
  `account_edit.php` (admin-on-others) and `otp_account_reset.php` (admin-forces-others
  to reset).
- Same plaintext-current-password exposure as §2 — flag identically for the rewrite.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (read/update, own row only), `log_tb`
(audit).

### Password encryption scheme (applies to §1, §2, §8, and the shared `password.php` helper)

Confirmed by reading `/home/mapims/cis/cis/password.php` directly (included via
`include_once('password.php')` in `account_add.php`/`account_edit.php`; duplicated
inline in `change_password.php`):

```php
function encrypt($data_input){
    $encryption_key = "igrapixkey1";
    $ciphering = "AES-128-CTR";
    $options = 0;
    $encryption_iv = '1234567891011121';
    $encryption = openssl_encrypt($data_input, $ciphering, $encryption_key, $options, $encryption_iv);
    return $encryption;
}
function decrypt($encoded_64){
    $encryption_key = "igrapixkey1";
    $ciphering = "AES-128-CTR";
    $options = 0;
    $decryption_iv = '1234567891011121';
    $decryption = openssl_decrypt($encoded_64, $ciphering, $encryption_key, $options, $decryption_iv);
    return $decryption;
}
```

- Cipher: **AES-128-CTR**, via PHP `openssl_encrypt`/`openssl_decrypt`.
- Key and IV are **hard-coded literal strings** (`"igrapixkey1"`, `'1234567891011121'`)
  shared across every account, not per-account or per-installation secrets — this
  means any code (or attacker) with the key/IV constants can decrypt every stored
  password in `web_account_setup.password` offline. This matches the modernized
  repo's `server/src/services/password.js` (per CLAUDE.md's own note that it "matches
  legacy `password.php`") — confirm the modernized service does not also hard-code
  these constants in a way that leaks them, and consider whether a real
  hash-based (not reversibly-encrypted) scheme is warranted for new installs while
  keeping AES-128-CTR only for reading legacy-created rows during migration.
- Every password field in the admin UI (Add/Edit/Change Password) round-trips through
  this same `encrypt()` on save, and `account_edit.php`/`change_password.php` both
  `decrypt()` the stored value to display it in plaintext on load — there is no
  one-way hashing anywhere in this module's account flows.

---

## 9. Reset Account — `otp_account_reset.php`

**Purpose:** Bulk-select any number of admin accounts and flag them for a forced
password reset by writing a fixed sentinel string into
`web_account_setup.reset_password`. Despite the "OTP" in the filename, there is no
OTP (one-time-password) generation, SMS/email dispatch, or per-account randomization
anywhere in this file — it is a single hard-coded reset marker applied to every
selected account.

**Entry point / menu:** Sidebar → Admin → "Reset Account" (`otp_account_reset.php`).

**Page layout:**
- **"Check all"** master checkbox (`call_check_all()`).
- A flat list of one checkbox per active account (`a_auth[]`, value = account id),
  label = `<Member Name> (<Member ID>)`, rendered in **red text** if that account's
  `reset_password` column is already non-empty (i.e. already flagged/pending), black
  otherwise. A note explains "Red color indicates Password not yet changed".
- **Reset** submit button.

**Data source (load):** `SELECT id, member_id, member_name, reset_password FROM
web_account_setup WHERE del=1 AND member_id!='igrapix' ORDER BY id ASC`.

**Save/submit behavior (`Submit=='Reset'`):**
- For each checked `a_auth[]` id: **UPDATE `web_account_setup` SET
  reset_password="RsETzLMn", updated_by/ip/dt WHERE id="<id>"** — the literal string
  `"RsETzLMn"` is hard-coded as the sentinel value written to every selected account,
  regardless of how many accounts are selected (same constant every time, not a
  per-account random token).
- Logged via `insert_log()` (`Update` on success, `Add` on failure — same
  operation-label inconsistency noted in §6).

**Business logic / edge cases:**
- This screen only **writes the flag**; the actual "force user to set a new password
  on next login" enforcement, and the clearing of `reset_password` back to empty once
  the user does so, must live in the login flow (not in this file) — verify that logic
  in the login controller (`docs/auth-flow.md`) before assuming this screen alone
  achieves anything user-visible.
- `reset_password` being non-empty is purely a display/status marker on this screen
  (red text) and presumably a gate elsewhere; it is not itself a real OTP or
  time-limited token, so "OTP" in the filename is a misnomer relative to actual
  behavior — worth flagging to product/stakeholders in case an actual OTP flow was
  intended but never finished.

**Print/report output:** none.

**Tables touched:** `web_account_setup` (read/update), `log_tb` (audit).

---

## 10. Committee Access — `committee_access.php`

**Purpose:** Assign which event/committee entities (from `t_committee`) an admin
account is authorized for. Writes to the **same** `dept_authentication` table as §4
(`department_authentication.php`), touching only its `event_committee` column — this
is best understood as a second, narrower edit view onto the same per-account
authorization row that §4 manages, not an independent authorization system.

**Entry point / menu:** Sidebar → Admin → "Committee Access" (`committee_access.php`).

**Page layout:**
- **User** dropdown (`user_name_ref`, `onchange="this.form.submit()"`) — options from
  `web_account_setup WHERE del=1 AND member_id!="iGrapix1"` (note: this exclusion
  literal is `"iGrapix1"`, subtly different from §4's `"iGrapix"` and §2/§9's
  `"igrapix"` — three different casings/spellings of what is presumably meant to be
  the same excluded super-account across the module; a rewrite should normalize this
  to one canonical excluded-account check, e.g. by `access_type` rather than a
  hard-coded username string). Suffixed ` *` if the account has any
  `dept_authentication` row.
- On selection: **Committee** multi-select (`event_committee[]`, `mcheck`,
  `multipleSelect()`) — options from `t_committee WHERE del=1 ORDER BY title ASC`.
- **Save** button; `form_reset` anti-double-submit token.

**Data source (load):** Existing row: `SELECT id, event_committee FROM
dept_authentication WHERE del=1 AND user_id="<selected>"`.

**Save/submit behavior (`Submit=='Save'`, requires `user_name_ref`):**
- `$f_r_id` (posted `r_id`) numeric → **UPDATE `dept_authentication` SET
  event_committee="<comma list>", updated_dt/ip/by WHERE id="<r_id>"`** — updates
  **only** the `event_committee` column, none of §4's other columns are touched or
  cleared.
- Else → **INSERT INTO `dept_authentication`** (`event_committee, user_id,
  created_dt, created_ip, created_by`) — a **new** row with only `event_committee`
  and `user_id` populated (all of §4's department/staff/student columns left at
  their table defaults) if the account had no prior `dept_authentication` row at all.
- Logged via `insert_log()` — note the log's description field uses `$dept_name_ref`
  (line 46), a variable **never assigned anywhere in this file** (it's a leftover
  variable name copy-pasted from §4's near-identical Save block) — the log entry's
  description will always be empty/undefined for this screen's Update log, not a
  meaningful value. Cosmetic logging bug, not a functional one.

**Business logic / edge cases:**
- Confirms the task brief's suspicion that this table is shared across screens: if a
  department admin's `dept_authentication` row is edited via §4 first and then via
  this screen (or vice versa), both screens' updates land on the same row (matched by
  `id`, looked up independently by each screen via its own `user_id` query) — order of
  operations across the two screens does not cause data loss for the *other* screen's
  columns, since each only SETs its own subset of columns.
- If a brand-new committee grant is saved here **before** §4 has ever been used for
  that account, the resulting `dept_authentication` row will have `dept_id` etc. all
  empty — if §4 is opened afterward for that same account, it will find this
  pre-existing row (matched by `user_id`) and its own Save will then populate the rest
  of the columns onto it, not create a duplicate row (§4's `r_id`-based branch would
  need to know the row exists — but §4 loads `dept_auth['id']` via its own `user_id`
  lookup independent of this screen, so it will correctly find and update the same row).

**Print/report output:** none.

**Tables touched:** `dept_authentication` (read/insert/update — shared with §4),
`web_account_setup` (read, user dropdown), `t_committee` (read, committee dropdown),
`log_tb` (audit).

---

## 11. HOD Page Authentication — `staff_authentication_add.php`

**Purpose:** The staff-tier counterpart to §6 — grant/revoke sub-menu-level page
access for **HOD-designated staff** (`staff_profile_tb.atten_auth=1`) against the
**staff** menu tree (`basic_st_admin_menu_tb`), writing to
`admin_staff_authentication_tb`. Structurally near-identical to §12 below; the two
screens partition the *same* staff population and menu table by opposite filters (see
§12 for the full comparison) — not duplicates of each other.

**Entry point / menu:** Sidebar → Admin → "HOD Page Authentication"
(`staff_authentication_add.php`), also reachable via `?uid=<id>` from §5's quick-link
(read as `staff_id`, not `uid`, in this file's own dropdown-selection logic — the
`?uid=` param from §5's link is not actually consumed by this file's `$_POST['staff_id']`
comparison, since this file only pre-selects based on `$_POST['staff_id']`, not any
`$_REQUEST['uid']` — a real integration gap between the two files worth verifying
against the live app, since §5's "Menu Authentication" deep-link may not actually
pre-select the intended staff member here).

**Page layout:**
- **Select User** dropdown (`staff_id`, `onchange="this.form.submit()"`) — options
  from `staff_profile_tb WHERE del=1 AND atten_auth=1 ORDER BY staff_id ASC` (a
  commented-out alternate query using `releaving_date` filtering is present but dead,
  line 124).
- On selection, the same 4-column "Check All" + main-menu/sub-menu checkbox grid
  pattern as §6, but sourced from **`basic_st_admin_menu_tb`** (staff menu tree,
  `admin_staff_menu_category_tb` for category ordering) and filtered additionally by
  **`reg_icon!=1`** on the main-menu query (`basic_st_admin_menu_tb WHERE del=1 AND
  menu_enable=1 AND category_id!=0 AND reg_icon!=1`).
- Each checkbox also carries **two hidden fields** (`user_row_id[]`, `menu_id[]`) —
  unlike §6, which only posts the checked `a_auth[]` ids and relies on a server-side
  re-lookup, this screen posts the **full set** of menu ids and their existing grant
  row ids (if any) alongside every checkbox, checked or not.
- **Save** button.

**Data source (load):** Same shape as §6 but against `basic_st_admin_menu_tb` /
`admin_staff_menu_category_tb` / `admin_staff_authentication_tb`; per-checkbox lookup:
`SELECT * FROM admin_staff_authentication_tb WHERE menu_id="<m_id>" AND
staff_id="<a_id>" AND del=1`.

**Save/submit behavior (`Submit=='Save'`, no `form_reset` token on this screen):**
- Loops over the **posted `menu_id[]` array** (every menu row rendered, not just
  checked ones), using the parallel `a_auth[]`/`user_row_id[]` arrays by index:
  - If `user_row_id[i]==''` → **INSERT INTO `admin_staff_authentication_tb`**
    (`staff_id, menu_id, authentication, created_dt, created_ip, created_by`) with
    `authentication = $a_auth[i]` (the checkbox's own value, `1` if checked — note
    this screen's checkbox `value="1"` and relies on the checkbox's **presence in the
    POST array being keyed by index**, i.e. `a_auth[<i>]` rather than §6's plain
    `a_auth[]` list of checked ids — a structurally different (and more
    index-fragile) checkbox-naming approach than §6 uses).
  - Else → **UPDATE `admin_staff_authentication_tb` SET staff_id, menu_id,
    authentication="<a_auth[i]>", updated_by/ip/dt WHERE id="<user_row_id[i]>"`.**
- Unlike §6, there is **no blanket-revoke step** before this loop — because every
  menu row's checkbox is posted by index (checked → `a_auth[i]='1'`, unchecked → the
  browser simply omits that array index or PHP receives no value for it, depending on
  exact input naming — given the input is `name="a_auth[<i>]"` not `name="a_auth[]"`,
  an **unchecked box still submits no value for that specific index**, so
  `$a_auth[i]` would be `''`/unset for unchecked rows), the UPDATE branch directly
  writes whatever `$a_auth[i]` evaluates to, correctly flipping previously-granted
  rows off when unchecked, without needing a separate revoke pass — a cleaner pattern
  than §6's blanket-then-reinsert approach, worth preferring in the rewrite.
- Logged via `insert_log()` (`Update` on success, `Add` on failure).

**Business logic / edge cases:**
- `reg_icon!=1` on the main-menu filter is the discriminator that separates this
  screen's menu set from §12's (`reg_icon!=0`) — see §12 for the full contrast; this
  column's exact semantic meaning ("registration icon"? a display-grouping flag?) is
  not evident from this file alone and should be confirmed against
  `basic_st_admin_menu_tb`'s actual data/other consumers before assuming its intent.
- The `atten_auth=1` staff population used for the **user dropdown** here is a
  different filter axis than `reg_icon` (which filters **menu rows**, not staff) —
  don't conflate the two; a given staff member's presence in this screen's dropdown is
  entirely about `atten_auth`, unrelated to which `reg_icon` menu set they're being
  granted access to.

**Print/report output:** none.

**Tables touched:** `staff_profile_tb` (read, user dropdown),
`admin_staff_menu_category_tb` (read, category ordering), `basic_st_admin_menu_tb`
(read, staff menu tree), `admin_staff_authentication_tb` (read/insert/update),
`log_tb` (audit).

---

## 12. Staff Page Authentication — `staff_page_authentication_add.php`

**Purpose:** The complementary half of §11 — same mechanism, same tables
(`admin_staff_authentication_tb` ⋈ `basic_st_admin_menu_tb`), but for the **other**
staff population and **other** menu subset.

**Entry point / menu:** Sidebar → Admin → "Staff Page Authentication"
(`staff_page_authentication_add.php`).

**Page layout / data source / save behavior:** Byte-for-byte identical to §11 in
structure and SQL shape, with exactly two filter differences:
- **User dropdown**: `staff_profile_tb WHERE del=1 AND atten_auth!=1 ORDER BY
  staff_id ASC` (the **complement** of §11's `atten_auth=1` — every non-HOD-flagged
  active-or-inactive staff record; note this filter, unlike several other staff
  queries in this module, does **not** additionally filter on `releaving_date`, so
  released/inactive staff can still appear in this dropdown — confirm whether that is
  intentional before porting).
- **Main-menu filter**: `basic_st_admin_menu_tb WHERE del=1 AND menu_enable=1 AND
  category_id!=0 AND reg_icon!=0` (the **complement** of §11's `reg_icon!=1`) — so
  between the two screens, every `basic_st_admin_menu_tb` row with `reg_icon` in
  `{0, other-non-1-non-0-values}` is covered by exactly one of the two screens'
  `!=1`/`!=0` filters; if `reg_icon` only ever takes values `0` or `1` in the live
  data, the two screens' menu sets are a clean, non-overlapping partition of the whole
  staff menu tree. If any row has `reg_icon` set to something else entirely (`NULL`,
  `2`, etc.), it would show up in **both** screens (since both filters are `!=`, not
  an exact `=0`/`=1` pair) — verify the actual distinct `reg_icon` values in
  `basic_st_admin_menu_tb` before assuming strict partition.

**Business logic / edge cases:** Same as §11 (index-based `a_auth[<i>]` posting, no
blanket-revoke step needed, same `insert_log()` operation-label inconsistency on
failure).

**Print/report output:** none.

**Tables touched:** identical to §11 — `staff_profile_tb`,
`admin_staff_menu_category_tb`, `basic_st_admin_menu_tb`,
`admin_staff_authentication_tb`, `log_tb`.

---

## 13. Login Dashboard — `log_dashboard.php`

**Purpose:** Summary-tile dashboard of login/activity counts across all three login
tiers (Admin `web_account_setup`/`log_tb`, Staff `staff_profile_tb`/`staff_log_tb`,
Student `student_profile_tb`/`student_log_tb`) for a selectable date, plus per-tier
"Activities" breakdown tables (Success/Failed counts per day-bucket). This is the most
recently modified file anywhere in this cluster (Feb 2025 mtime) and is **not yet
ported** to the modernized app per `adminSetupMeta.js`.

**Entry point / menu:** Sidebar → Admin (or possibly a top-level Audit/Log section —
not confirmed without menu table access) → "Login Dashboard" (`log_dashboard.php`).

**Page layout (top→bottom):**
- "Last View by `<user>` on `<date>`" line, computed from the **second-most-recent**
  `log_tb` row for this exact page (`ORDER BY log_timestamp DESC LIMIT 1,1` — offset 1,
  i.e. it deliberately skips the current page-load's own just-inserted `View` log row
  to show the *previous* viewer, not "you, just now").
- Report title via shared `callPrintHeader(['Login Dashboard'], '1')`.
- Three side-by-side "Active Users" tiles (Admin / Staff / Student), each showing a
  Today/Yesterday/Day-before-yesterday/Last-7-days/Last-30-days row of active-login
  counts, plus a "Current" (last-5-minutes) live count for whichever tier, **only
  computed if the selected date is today** (`if($today==date('Y-m-d'))`) — for a
  past-date selection, "Current" simply doesn't get set (renders as `0`).
- Three "Activities" tables (Admin / Staff / Student), each a Day × #Success/#Failed
  grid (several additional columns — #Account, #Auth., #Valid Op., #Invalid Op. — are
  computed but rendered `style="display:none"`, i.e. present in the DOM but not
  visually shown; dead weight to consider dropping in the rewrite unless a "show all
  columns" toggle is planned).
- **Date** picker (`s_date`, auto-submits on change) + conditional **"Today"** link
  (hidden when already viewing today) + **Refresh** button + (hidden) **Print** button
  (`callPrintContent('printContent','1','idcard_style_id','')`).
- "Last Updated On: `<timestamp>`" line, shown only for the today view.

**Data source (load) — key queries (representative; the file repeats near-identical
per-tier variants of each):**
- Admin active-logins-by-bucket: `SELECT DISTINCT(B.member_id) FROM log_tb AS A INNER
  JOIN web_account_setup AS B ON A.log_username=B.member_id WHERE A.del=1 AND B.del=1
  <bucket date filter on A.log_timestamp>`.
- Admin "Current" (live, today only): `SELECT DISTINCT(log_username) FROM log_tb WHERE
  del=1 AND log_timestamp>='<now-5min>'`.
- Admin Activities per day: `SELECT id FROM log_tb WHERE del=1 AND log_page='index' AND
  log_operation='login' AND log_status='successful' <day filter>` (Success count) and
  the `log_status='unsuccessful'` variant (Failed count); the hidden extra columns use
  `log_page IN ('account_edit.php','account_add.php')` and `log_page='authentication.php'`
  filters respectively — **note `'authentication.php'` here does not match any file
  in the current tree** (the actual file is `authentication_add.php`) — this hidden
  "#Auth." column is almost certainly always `0` in the live app due to a stale
  filename reference; low-impact since the column is hidden, but a real bug to note if
  ever un-hidden.
- Staff/Student equivalents mirror the Admin queries exactly, substituting
  `staff_log_tb`/`staff_profile_tb` and `student_log_tb`/`student_profile_tb`
  respectively, joined on `staff_id`/`register_no`.
- **Caching side-effect:** every render writes its computed `$final_log_details` array
  as JSON to `assets/json/log/log_<yyyymmdd>.json` via `file_put_contents()` (using
  `utf8_encode($json)`) — the actual *read* of this cache file
  (`file_get_contents($jfile_name)`) happens unconditionally too, but the branch that
  would **skip** recomputation and serve straight from the cache is commented out
  (`/*if(file_exists($jfile_name) && $_POST['Submit']!='Refresh') { ... } else { ...
  */` — the closing brace and surrounding structure show the caching-skip logic was
  disabled, meaning **every page load fully recomputes all queries and then
  overwrites the cache file**, regardless of whether a "Refresh" was requested — the
  cache file is written but never actually used to skip work. Flag as dead
  optimization code; either restore the skip-logic properly or remove the
  read/write entirely in the rewrite.

**Save/submit behavior:** none — read-only dashboard (the `s_date` field re-submits
via GET/POST to reload for a different date; no data is created/updated by user action
here beyond the incidental JSON cache file write described above).

**Business logic / edge cases:**
- See the `'authentication.php'` stale-filename bug and the disabled cache-skip logic
  above — both are real, if low-impact, defects to flag rather than silently port.
- Every view is logged via `insert_log()` at the very top of the file (`View`,
  unconditionally, before any date/report logic runs) — this is what the "Last View
  by" line at the top of the page reads back (skipping the just-inserted row via
  `LIMIT 1,1`).

**Print/report output:** `callPrintHeader()`/`callPrintContent('printContent','1',
'idcard_style_id','')` — same shared print helper pattern used elsewhere in the app;
print CSS is captured into a hidden `<textarea id="idcard_style_id">` from
`$basic_style_details_array['basic']`.

**Tables touched:** `log_tb`, `web_account_setup`, `staff_log_tb`,
`staff_profile_tb`, `student_log_tb`, `student_profile_tb`. Also reads/writes
`assets/json/log/log_<date>.json` on the filesystem (not a DB table).

---

## 14. Login Log Details — `log_details.php`

**Purpose:** Searchable, filterable per-session login-activity report for the
**admin** tier only (`web_account_setup`/`log_tb`) — given a user/date-range/OS/
IP/operation filter, reconstructs each matching login session's in-time, status,
out-time, and the sequence of pages/operations performed during that session, by
pairing a `login` row with subsequent `log_tb` rows sharing the same
`log_session`/`log_os`/`log_username` up to the next `login` or the session's end.

**Entry point / menu:** Sidebar → Admin (or Audit) → "Login Log Details"
(`log_details.php`). **Not yet ported.**

**Page layout:**
- Left filter column: **User** dropdown (`web_account_setup WHERE del=1 AND
  member_id!='igrapix'`), **Date** range text input (`from_date`, a `daterange_picker`
  defaulting to "today to today"), **OS** free-text, **IP** free-text, **Operation**
  free-text, **Search** submit button.
- Right of the filter column: **Print** button (`onClick="print_log_details()"` — see
  Print section below).
- Results area (`#result_span_details`): a filter-summary row followed by a table with
  columns **Date, User, LIT** (login-in-time), **S** (status: `S`/`F`), **LOT**
  (logout-time), **Process** (list of pages visited, `<br>`-joined), **Time** (matching
  per-page timestamps), **Operation** (matching per-page `log_operation` values,
  spaces stripped), **IP**, **Device** (parsed from the User-Agent string via
  `GetBetween($log_os,'(',')')`).

**Data source (load) — key queries:**
- Primary login rows: `SELECT * FROM log_tb WHERE del=1 AND log_page='index' AND
  log_operation='login' <user/os/ip/date filters> AND log_username!='igrapix' ORDER BY
  log_timestamp ASC`.
- For each login row with `log_status!='Successful'` (a **failed** login attempt): a
  single-row entry is added directly (In-time = the failed attempt's own timestamp,
  Out-time blank) — no session-pairing needed since a failed login has no session to
  chase.
- For each **successful** login row: `SELECT * FROM log_tb WHERE del=1 AND
  id>='<login row id>' AND log_username='<user>' AND log_timestamp>='<login time>' AND
  log_session='<session>' AND log_os='<os>' <optional to_date filter> ORDER BY
  log_timestamp ASC` — walks forward through every subsequent log row in the *same*
  session, building the `Process`/`Time`/`Operation` trails, until either a
  `log_page=='logout'` row is hit (sets `Lotime`) or a **second** `log_page=='index'
  AND log_operation=='login' AND log_status=='Successful'` row is hit (`break`s the
  loop — the next login ends the previous session's trace).
- `call_page_title($log_page)` — resolves a raw `log_page` filename to a human label
  via `SELECT * FROM basic_admin_menu_tb WHERE sub_menu_link='<log_page>' AND del=1`
  (`main_menu_name - sub_menu_name`), falling back to the bare filename (`.php`
  stripped) if no menu match is found.
- **Confirmed bug:** line 369 —
  `if($log_page=='index' && $log_operation='login' &&  $log_status=='Successful' && $l_counter!=0) break;`
  — this uses a **single `=` assignment**, not `==` comparison, for
  `$log_operation='login'`. In PHP this expression (a) unconditionally overwrites
  `$log_operation` to the literal string `'login'` on every iteration of the inner
  loop (clobbering the just-read `$row_select_2['log_operation']` value for the rest
  of that iteration, including the `Operation` column output later in the same loop
  body — meaning the printed "Operation" trail column can show `login` where the real
  operation should have appeared), and (b) the assignment expression itself evaluates
  truthy (a non-empty string), so the `break` condition effectively degrades to just
  `log_page=='index' && $log_status=='Successful' && $l_counter!=0` — broader than
  intended, since it stops the session trace on *any* successful `index` page hit with
  that status, not specifically a second login. **This is a genuine logic + data
  corruption bug in the live legacy file** (distinct from `att_log_details.php`,
  which does not have this exact line) and must **not** be ported as-is; the rewrite
  should implement the intended `==` comparison.
- `call_log_details()` (a JS function defined later in the file, wired to nothing —
  no element in the rendered HTML has an `onclick`/handler calling it) targets
  `log_details_more.php?...&flag=1` via AJAX — **that file does not exist anywhere in
  the tree** (`ls` confirms no `log_details_more.php`). This is dead/vestigial
  client-side code referencing a non-existent endpoint; the actual search flow is a
  plain form POST back to `log_details.php` itself, not this AJAX path. Do not port
  `call_log_details()`'s AJAX pattern.

**Save/submit behavior:** none — read-only report; every load logs a `View` via
`insert_log()` (unconditional, at the top of the file, same pattern as §13).

**Business logic / edge cases:** see the two bugs called out above (mis-assignment in
the break condition, and the dead `call_log_details()`/`log_details_more.php`
reference) — both are load-bearing findings for anyone trying to reproduce "exact"
legacy numbers from this report.

**Print/report output:** `print_log_details()` — **not** the shared
`callPrintContent()` helper used by most other screens in this app; instead it
manually `window.open()`s a new window and `document.write()`s the result table's
`innerHTML` wrapped in a minimal `<html><link href="css/bootstrap.min.css">...
<body onload="window.print()">`. Functionally similar end result (opens, prints,
via `window.print()` without `noopener` — consistent with CLAUDE.md's rule about not
breaking print) but implemented ad hoc rather than through the shared print utility;
note this if consolidating print flows in the rewrite.

**Tables touched:** `log_tb`, `web_account_setup`, `basic_admin_menu_tb` (via
`call_page_title()`). Also reads `assets/json/uploadconfig.json` for an
`$attachment_config_label` variable that is computed but never actually used anywhere
in this file's rendered output (dead code, likely copy-pasted from a
file-upload-heavy screen elsewhere in the app).

---

## 15. Login Log (orphaned AJAX endpoint) — `login_log.php`

**Purpose (as written):** A JSON-emitting endpoint that reconstructs a single user's
login sessions for a specific date — the same session-pairing algorithm as
`log_details.php` (§14), condensed into a standalone script with no HTML output.
**No caller for this file was found anywhere in the current codebase** (`grep` across
every `.php` file and any `.js` under the legacy tree turns up zero references) — it
appears to be a leftover integration point, not a reachable screen in the live app.

**Entry point:** `GET login_log.php?user_name=<id>&user_date=<date>&flag=1&referer=<url>`
— note this file does **not** `session_start()`-gate on `$_SESSION['empusername_login']`
the way every other Admin screen does; instead its only access control is a referer
substring check.

**Page layout:** None — pure JSON response (`echo json_encode($response)`), no HTML,
no header/sidebar chrome, no `widget.php`/`insert_log()` bootstrap at all (it
`include('config.php')` directly, more minimal than even `resource_transfer.php`'s
`config.php`-only pattern noted in `library-module.md`).

**Data source (load) / logic:**
- Gate: the whole response body only executes if `$flag==1 && $user_date &&
  $user_name && strstr($ref_url,'igrapix.org')==true && ...` — i.e. it requires the
  **`referer` GET parameter itself** (not the HTTP `Referer` header) to contain the
  substring `'igrapix.org'`. Since `$ref_url` is read straight from
  `$_GET["referer"]`, this is a **caller-supplied, trivially spoofable value**, not a
  real security check — any caller can pass `&referer=igrapix.org` regardless of where
  the request actually originates. This is not a meaningful access control and should
  not be treated as one if this endpoint is ever revived.
- Primary query: `SELECT * FROM log_tb WHERE del=1 AND log_page='index' AND
  log_operation='login' AND log_username='<user_name>' AND DATE(log_timestamp)=
  '<user_date>' ORDER BY log_timestamp ASC`.
- Same forward-session-walk pairing logic as §14 (chase subsequent same-session rows
  until a `logout` page or a second successful login, tracking a `$mis_used['PS']`
  counter that increments whenever `log_operation=='print screen'` is encountered
  along the way — a "misuse" signal not present in §14's version of this algorithm).
- Response shape: `{"accessdetails": [{"intime","outtime","astatus","workingtime",
  "workingsec","outstatus"}, ...], "accessflag": 0|1, "misused": "<summary string>"}`.

**Save/submit behavior:** none — read-only.

**Business logic / edge cases:**
- This file duplicates §14's session-pairing algorithm in a third independent
  implementation (alongside `log_details.php` and, in spirit, `att_log_details.php`)
  — worth consolidating into one shared helper in the rewrite rather than maintaining
  three parallel copies.
- Given the lack of any caller in this codebase and the non-`empusername_login`-gated,
  spoofable-referer access model, this is almost certainly meant to be consumed by an
  **external system** (possibly hosted on the vendor's own `igrapix.org` domain) that
  is outside this repository's scope — do not assume it needs a UI counterpart ported;
  confirm with stakeholders whether any such external integration is still active
  before deciding whether to carry this endpoint forward at all.
- `login_more.php` (the other file initially considered for this section) turned out,
  on reading, to be entirely unrelated to Admin's login/log domain — it checks a
  `punchtimedetails` biometric-device table against `$_SESSION['bslogin_time']` and
  has no connection to `web_account_setup`/`log_tb`/admin authentication at all. It is
  documented in "Files that exist but are not part of this module's live surface"
  above, not here, and should not be ported as part of Admin.

**Print/report output:** none (JSON only).

**Tables touched:** `log_tb` only.

---

## Tables used across this module

| Table | Stores |
|---|---|
| `web_account_setup` | One row per admin back-office login account — `member_id` (username), `member_name`, `address_mobile`, `address_email`, `password` (AES-128-CTR ciphertext), `photo`, `access_type` (`Global` = super-admin tier, exempt from `access.php`/dashboard-access-by-Global-only-listing rules), `reset_password` (forced-reset sentinel), audit fields, `del`. |
| `access_tb` | One row per `web_account_setup.id` (`user_id`) — login gating: `local_access` (require login key), `random_id`/`random_id_1..4` (login-key count/values), `date_base`/`from_date`/`to_date` (absolute date-range gate), `day_base`/`allow_day`/`allow_from_time`/`allow_to_time` (recurring weekly window gate). Auto-created permissively by `account_add.php`. |
| `dept_authentication` | One row per admin account (`user_id`) — department scoping: `dept_id`, `dept_hod`, `dept_staff`, `dept_student`, `dept_pg`, `dept_intern`, `course_id` (all comma-joined id lists, set by `department_authentication.php`), plus `event_committee` (comma-joined id list, set independently by `committee_access.php`). |
| `dept_auth` | The **staff-tier** counterpart to `dept_authentication` — one row per HOD staff member (`dept_hod` = the staff's own id), same shape (`dept_id`, `dept_staff`, `dept_student`, `dept_pg`, `dept_intern`, `course_id`), set by `department_authentication_v1.php`. Not the same table as `dept_authentication` despite the similar name. |
| `authentication_tb` | Per-`(user_id, menu_id)` grant flag for **admin-account** menu access — `authentication` (1/0 on/off, flipped by `authentication_add.php`'s blanket-revoke-then-reinsert Save pattern), joined against `basic_admin_menu_tb`. Consumed by the modernized app's `menuAuthForModule()` middleware per CLAUDE.md. |
| `admin_staff_authentication_tb` | Per-`(staff_id, menu_id)` grant flag for **staff** page access — `authentication` (1/0), joined against `basic_st_admin_menu_tb`. Shared by both `staff_authentication_add.php` (HOD staff, `atten_auth=1`, `reg_icon!=1` menus) and `staff_page_authentication_add.php` (non-HOD staff, `atten_auth!=1`, `reg_icon!=0` menus). |
| `basic_admin_menu_tb` | Admin menu tree — `main_menu_name`, `sub_menu_name`, `sub_menu_link` (legacy PHP filename), `menu_enable`, `category_id`, `main_menu_order`, `sub_menu_order`, `del`. Read by `authentication_add.php` (grant grid) and `log_details.php`'s `call_page_title()`. |
| `admin_menu_category_tb` | Category ordering lookup for `basic_admin_menu_tb` (`category_order`), used only to build the `FIELD()` ORDER BY in `authentication_add.php`. |
| `basic_st_admin_menu_tb` | Staff-tier menu tree, same shape as `basic_admin_menu_tb` plus a `reg_icon` column that partitions rows between §11 and §12's two screens. |
| `admin_staff_menu_category_tb` | Category ordering lookup for `basic_st_admin_menu_tb`, mirrors `admin_menu_category_tb`. |
| `dashboard_access` | Per-`(user_id)` admin-account dashboard-widget grant list — `widget_name` (matches a hard-coded PHP key from `dashboard_access.php`'s `$dashboard_list` array), `widget_order`, `status` (1/0), `del` (real soft-delete, blanket-cleared-then-reinserted on every Save). |
| `dashboard_accessbystaff` | Same shape as `dashboard_access`, for `staff_profile_tb.id` (`atten_auth=1` staff) instead of admin accounts, set by `dashboard_accessbystaff.php`; one widget key fewer than `dashboard_access`'s list. |
| `staff_dept_master` | Department master list (`name`, `d_order`) — read as the "Department" dropdown source in both `department_authentication.php` and `department_authentication_v1.php`. |
| `master_setup` | Shared category lookup (rows distinguished by `category`, e.g. `"Internship Department"`, `"Department"`) — read for the Internship/P.G multi-selects in both department-authentication screens. Not the same table as `book_category_tb`-style module-specific lookups elsewhere in the app. |
| `t_committee` | Committee/event master list (`title`) — read by `committee_access.php`'s Committee multi-select. |
| `staff_profile_tb` / `staff_designation_tb` | Staff identity/profile and designation/department assignment — joined for the Staffs/HOD dropdowns in both department-authentication screens (`is_academic=1`, active `to_date`), and for the user dropdowns in the staff-tier menu/dashboard-access screens (`atten_auth`). |
| `basic_setup_course_tb` | Course master — read as the "Course" multi-select option source in both department-authentication screens. |
| `staff_log_tb` / `student_log_tb` | Per-tier login/activity audit logs (staff and student self-service portals), mirroring `log_tb`'s shape — read only by `log_dashboard.php`'s per-tier Activities tables in this module. |
| `log_tb` | Shared admin-tier audit/activity log (`insert_log()`), written by every screen in this module (and the rest of the app) on every view/save. Read back by `log_dashboard.php`, `log_details.php`, and the orphaned `login_log.php` to reconstruct login sessions. |
| `basic_setup_tb` | Institution config, read by `log.php`'s `insert_log()` GET-flag branch (Print Screen logging) for `time_zone`. |

---

## Open questions / ambiguities

These could not be resolved from static reading alone and should be confirmed against
the live app/DB (or with the admin users) before or during the rewrite:

1. **`dashboard_accessbystaff.php` has no confirmed independent sidebar menu entry** —
   it is only reachable via a deep-link from `department_authentication_v1.php`. Confirm
   against `basic_admin_menu_tb`/`basic_st_admin_menu_tb` whether it also has its own
   menu row before deciding how to surface it in the modernized navigation.
2. **`staff_authentication_add.php` does not read the `?uid=` querystring param** that
   `department_authentication_v1.php`'s "Menu Authentication" quick-link passes — it
   only pre-selects from `$_POST['staff_id']`. Verify against the live app whether the
   deep-link actually pre-selects the intended staff member, or whether this is a real
   integration gap (the link opens the screen but lands on the blank "--Select One--"
   state instead of the intended staff).
3. **`reg_icon`'s exact value domain in `basic_st_admin_menu_tb`** determines whether
   §11 (`reg_icon!=1`) and §12 (`reg_icon!=0`) are a clean partition or have overlap
   for rows where `reg_icon` is neither `0` nor `1` (e.g. `NULL`). Confirm the actual
   distinct values before assuming strict partition in a rewrite.
4. **`access_tb.allow_day`'s empty-segment encoding** — `access.php`'s day-mode Save
   builds this as a comma list with empty placeholders for unchecked days (e.g.
   `1,,3,,,6,` before only the trailing comma is trimmed), not a clean list of only
   the checked values. Confirm how any downstream login-enforcement code parses this
   column (does it `explode(',', ...)` and check membership, tolerant of empty
   segments, or does it assume a clean list?) before deciding whether the rewrite
   should preserve or normalize this encoding.
5. **Plaintext password display** on `account_edit.php` (§2) and `change_password.php`
   (§8) is a real, confirmed security exposure in the live legacy app — needs an
   explicit product/security decision before the rewrite: drop the "show current
   password" feature entirely, gate it behind a fresh re-authentication/reveal action,
   or keep as-is for exact parity during a transition period only.
6. **Password storage is reversible AES-128-CTR with a hard-coded shared key/IV**, not
   a one-way hash — confirm whether `server/src/services/password.js` (per CLAUDE.md,
   already built to match this) is intended to remain reversible-encryption-based
   long-term, or whether new accounts created going forward should move to a proper
   hash (bcrypt/argon2) while legacy rows are read via the legacy scheme during
   migration only.
7. **`log_dashboard.php`'s hidden "#Auth." column filters on `log_page='authentication.php'`**,
   a filename that does not exist in the current tree (the real file is
   `authentication_add.php`) — confirm whether this was ever a valid filename in an
   older version of the app (i.e. `authentication_add.php` was renamed at some point
   and this reference was never updated) or has simply always been wrong; since the
   column is hidden today it has no visible impact, but would need fixing if ever
   un-hidden.
8. **`log_dashboard.php`'s JSON caching to `assets/json/log/log_<date>.json`** is
   written on every load but the corresponding read-and-skip-recompute branch is
   commented out — confirm whether this caching was intentionally disabled (e.g. due
   to staleness complaints) or is simply dead/forgotten code, before deciding whether
   to reintroduce caching in the rewrite.
9. **`log_details.php` line 369's `=` vs `==` bug** (see §14) actively corrupts the
   `Operation` trail column and broadens the session-break condition in the live app —
   confirm whether anyone currently relies on this report's exact numbers (if so, a
   fix will visibly change historical-looking output) before silently fixing it in the
   rewrite; recommend fixing regardless, but flag the visible-output change to
   stakeholders first.
10. **`att_log_details.php`** (Staff/Student session report, a broader sibling of
    `log_details.php`) has no caller found anywhere in this tree either — unlike the
    admin-only duplicates confirmed dead above, this one could plausibly be a real,
    separately-menu-linked screen belonging to a different module (Staff or Student
    audit, not Admin) that simply wasn't captured by this Admin-focused file sweep.
    Confirm its menu status and owning module before treating it as either "part of
    Admin" or "dead" — this document takes no position on it beyond noting its
    existence and its structural similarity to §14.
11. **Three independent copies of the login-session-pairing algorithm** exist across
    this module alone (`log_details.php`, the orphaned `login_log.php`, and — by
    inspection — likely `att_log_details.php` too) with at least one confirmed bug in
    one copy (§14) and a "misused: print screen" side-counter present in only one
    copy (`login_log.php`). A rewrite should consolidate to a single, tested
    implementation rather than porting three near-duplicate algorithms.
12. **`otp_account_reset.php`'s single hard-coded reset sentinel `"RsETzLMn"`** — the
    actual login-time enforcement of this flag (what happens when a user with this
    `reset_password` value logs in, and when/how it gets cleared) lives outside this
    file. Confirm that logic (likely in the login controller) before assuming this
    screen alone delivers a working "force password reset" feature.
