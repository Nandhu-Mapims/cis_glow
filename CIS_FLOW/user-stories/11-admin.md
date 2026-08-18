# Admin Module — User Stories

> Deep-dive companion to [../userstory.md](../userstory.md) §11. Covers `client/src/pages/admin/`
> and `server/src/services/admin/` — 14 screens dispatched through one `VALID_SCREENS` map. This is
> the most security-sensitive module in the app: `accessType === 'Global'` is the superuser flag
> that bypasses every per-menu check elsewhere in the system, and this module is where that flag
> (and everything else — passwords, menu grants, department scoping, dashboard widget visibility)
> is configured.

---

## 1. Module overview

**Purpose:** user-account lifecycle (create/edit/delete), login-time access restrictions (day/time
window), per-department data scoping for HODs, per-menu authorization, per-user dashboard widget
visibility, self-service password/profile change, forced account password resets, committee access,
and a newer role-based permission layer (Role Manager / Assign Roles) that has no legacy PHP
counterpart.

**Primary actor:** **Super Admin** (`web_account_setup.access_type = 'Global'`) — the only role that
can persist any change in this module.

**Secondary actor:** any user with **admin-menu access but not Global** — can open every screen and
see live data (read-only), but every save attempt is rejected both client-side and server-side.

**Legacy PHP files replaced** (from `client/src/pages/admin/adminSetupMeta.js`):

| Screen slug | Legacy file |
|---|---|
| `account-add` | `account_add.php` |
| `account-edit` | `account_edit.php` |
| `access-restriction` | `access.php` |
| `dept-auth` | `department_authentication.php` |
| `dept-auth-v1` | `department_authentication_v1.php` |
| `menu-auth` | `authentication_add.php` |
| `dashboard-access` | `dashboard_access.php` |
| `change-password` | `change_password.php` |
| `otp-reset` | `otp_account_reset.php` |
| `committee-access` | `committee_access.php` |
| `staff-auth-hod` | `staff_authentication_add.php` |
| `staff-auth-page` | `staff_page_authentication_add.php` |
| `role-manager` | *(none — new capability, see `ADMIN_ROLE_MODULE_UPGRADE.md`)* |
| `assign-roles` | *(none — new capability, see `ADMIN_ROLE_MODULE_UPGRADE.md`)* |

---

## 2. Screen inventory

| Slug | Title | Route | Component | Legacy `.php` |
|---|---|---|---|---|
| `account-add` | Add User Account | `/admin/setup/account-add` | `client/src/pages/admin/setup/AccountAddForm.jsx` | `account_add.php` |
| `account-edit` | Edit User Account | `/admin/setup/account-edit` | `client/src/pages/admin/setup/AccountEditSetup.jsx` | `account_edit.php` |
| `access-restriction` | Login Access Restrictions | `/admin/setup/access-restriction` | `client/src/pages/admin/setup/AccessRestrictionSetup.jsx` | `access.php` |
| `dept-auth` | Department Authentication | `/admin/setup/dept-auth` | `client/src/pages/admin/setup/DeptAuthSetup.jsx` | `department_authentication.php` |
| `dept-auth-v1` | Staff Department Authentication | `/admin/setup/dept-auth-v1` | `client/src/pages/admin/setup/DeptAuthV1Setup.jsx` | `department_authentication_v1.php` |
| `menu-auth` | Menu Authentication | `/admin/setup/menu-auth` | `client/src/pages/admin/setup/MenuAuthSetup.jsx` | `authentication_add.php` |
| `dashboard-access` | Dashboard Widget Access | `/admin/setup/dashboard-access` | `client/src/pages/admin/setup/DashboardAccessSetup.jsx` | `dashboard_access.php` |
| `change-password` | Change Password | `/admin/setup/change-password` | `client/src/pages/admin/setup/ChangePasswordSetup.jsx` | `change_password.php` |
| `otp-reset` | Reset Account | `/admin/setup/otp-reset` | `client/src/pages/admin/setup/OtpResetSetup.jsx` | `otp_account_reset.php` |
| `committee-access` | Committee Access | `/admin/setup/committee-access` | `client/src/pages/admin/setup/CommitteeAccessSetup.jsx` | `committee_access.php` |
| `staff-auth-hod` | HOD Page Authentication | `/admin/setup/staff-auth-hod` | `client/src/pages/admin/setup/StaffAuthSetup.jsx` (mode `hod`) | `staff_authentication_add.php` |
| `staff-auth-page` | Staff Page Authentication | `/admin/setup/staff-auth-page` | `client/src/pages/admin/setup/StaffAuthSetup.jsx` (mode `page`) | `staff_page_authentication_add.php` |
| `role-manager` | Role Manager | `/admin/setup/role-manager` | `client/src/pages/admin/setup/RoleManagerSetup.jsx` | — |
| `assign-roles` | Assign Roles | `/admin/setup/assign-roles` | `client/src/pages/admin/setup/AssignRolesSetup.jsx` | — |

Every screen is rendered by the same shell — `client/src/pages/admin/AdminSetupPage.jsx` — which
looks up `ADMIN_SCREEN_META[screen]` for the title/legacy filename and `SETUP_COMPONENTS[screen]`
for the component, then wires `data/busy/onLoad/onSave` from `useAdminSetupApi(screen)`
(`POST /api/admin/setup/:screen/load|save`, dispatched server-side by
`server/src/services/admin/adminSetup.js`).

**Global write gate — enforced twice:**
1. **Client**, in `AdminSetupPage.jsx`: `handleSave` checks `isGlobalAccessType(user?.accessType)`
   before calling `save()` at all; if not Global it sets the error
   `"Only Super Admin can save changes here. You have view-only access to this module."` and
   returns `null` without making a network call. A persistent warning banner
   `"View-only access — only Super Admin can save changes in the Admin module."` is shown above
   every screen for non-Global viewers.
2. **Server**, in `server/src/routes/admin.js`: `POST /setup/:screen/save` is guarded by
   `requireGlobalWrite`, which 403s with the same message if `req.user.accessType !== 'Global'`.
   The **load** endpoint has no such gate — anyone who passed `menuAuthForModule('admin')` can view.

---

## 3. Pixel-level flow per screen

### 3.1 Add User Account (`account-add`)

Component: `AccountAddForm.jsx`. Single form, section heading **"Basic Information"**.

Fields (in DOM order):

| Label | id | Type | Notes |
|---|---|---|---|
| `Member Name *` | `member_name` | text, `maxLength=70`, `required` | |
| `Mobile` | `address_mobile` | `type="tel"`, `maxLength=15` | optional |
| `Email` | `address_email` | `type="email"`, `maxLength=70` | optional |
| `Username *` | `username` | text, `autoComplete="off"`, `required` | |
| `Password` | `password` | `type="password"`/`"text"` toggle, `autoComplete="new-password"`, `required`, plus two inline buttons **Show/Hide** and **Generate** (fills a random 6-char password from the set `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789!@#%*+`, also fills Confirm Password and flips the field to visible text) | |
| `Confirm Password` | `confirm_password` | same type toggle as Password, `required` | |

Buttons: **Save** (`btn btn-danger`, `type="submit"`, disabled while `busy`), **Reset** (clears the
form back to blanks and hides the password).

Save payload: `{ member_name, address_mobile, address_email, username, password, confirm_password, Submit: 'Save' }`.

Server (`saveAccountAdd` in `accountSetup.js`):
- Rejects with `"Member name, username, and password are required."` if any of member name /
  username / password is blank.
- Rejects with `"Invalid Password..."` if `password !== confirm_password`.
- Rejects with `"Email ID already exists..."` if a **live** (`del=1`) row already has that
  `member_id` OR that `address_email` (raw SQL `duplicateCheck`, `escapeSql`-escaped).
- On success: `INSERT` into `web_account_setup` (`password` = `encrypt(password)` via AES-128-CTR,
  `reset_password: ''`, `photo: ''`, `acc_gender: ''`, plus `auditFields` create block), **and**
  a matching row is inserted directly into `access_tb` via raw SQL — `local_access=0`,
  `date_base=0`, `day_base=1`, `allow_day='1,2,3,4,5,6,7'`, `allow_from_time='00:00:00'`,
  `allow_to_time='23:59:00'` — i.e. every new account starts **unrestricted** (all 7 days,
  full 24h window) until someone visits Access Restrictions to tighten it.
- On success returns `{ success: true, message: 'Your details are updated...', ...(fresh blank form) }`
  — the form clears itself for the next entry.
- On any DB exception: generic `{ success: false, message: 'Please try again...' }`.
- Every attempt (success or failure) writes `log_tb` via `logAdminSetup('account_add.php', 'Add', 'Successful'|'Unsuccessful', username, memberId, audit)`.

### 3.2 Edit User Account (`account-edit`)

Component: `AccountEditSetup.jsx`, two sub-views driven by `data.mode`.

**List view** (`data.mode !== 'edit'`, component `AccountList`):
- Search box (placeholder **"Search member ID or name"**) + **Search** button — `onLoad({ search }, { page: 1 })`.
- Table columns: **Member ID**, **Member Name**, (blank action header). Empty state row:
  **"No data available"**.
- Per row: **Edit** button (`onLoad({ edit_row_id: user.id })`) and **Delete** button (opens a
  `ConfirmModal` titled **"Delete user?"**, message
  `Delete user account "<name>" (<id>)? This cannot be undone.`, confirm label **"Delete User"**,
  tone `danger`).
- Pagination footer (`Showing page X of Y`) with **Previous**/**Next** buttons, shown only when
  `data.total > data.limit` (limit = 20, server constant `LIST_LIMIT`).
- List query excludes `member_id = 'igrapix'` (a reserved/system account) and filters `del=1`.

**Edit view** (`data.mode === 'edit'`, component `AccountEditDetail`):
- **"Back to list"** link button — reloads the list preserving `listContext.search`/`page`.
- Section **"Basic Information"**: read-only **Member ID** (`form-control-plaintext`), editable
  **Member Name** (required), **Mobile**, **Email** (`type="email"`), **Photo** (`type="file"`,
  `accept="image/jpeg,image/png,image/gif"`) with a live thumbnail (`width=30 height=30`) and
  **Remove** button when a photo already exists. **Save** button (`Submit0: 'Save'`) — photo file
  is base64-encoded client-side (`FileReader.readAsDataURL`) and sent as
  `files: [{ field: 'photo', name, data }]`.
  - There is a hidden, never-rendered `<template class="col-md-6 d-none">` block in the JSX
    labeled **"Your Secret Code"** displaying `user.currentPassword` — `<template>` content is
    inert in every browser (it's parked in `.content`, not the live DOM), so this is dead markup,
    not a real leak, but it does mean `mapEditRow()` on the server unconditionally decrypts and
    ships `currentPassword` in the edit-load response payload even though nothing currently
    displays it.
- Section **"Change Password"** (separate `<form>`, `border-top pt-4`): **New Password**,
  **Confirm Password** (both `type="password"`/`"text"` via one shared **Show/Hide** toggle
  button), **Save Password** button (`Submit3: 'Save'`, payload `{ edit_row_id, password, confirm_password }`).
- Two navigation buttons at the bottom: **Menu Authentication** → `/admin/setup/menu-auth?uid=<id>`,
  **Dashboard Access** → `/admin/setup/dashboard-access?uid=<id>` (both `btn-success btn-sm`,
  pre-select that user on arrival via the `uid` query param, wired through `AdminSetupPage`'s
  `searchParams.get('uid')`).

Server (`accountSetup.js`):
- `loadAccountEdit`: if `edit_row_id` present, loads one `web_account_setup` row (`del=1`) via
  `mapEditRow()` (decrypts `password` → `currentPassword`, builds `photoUrl` from
  `/legacy/img/member/<photo>`); else returns the paginated/searched list.
- `saveAccountEdit` dispatches on which submit flag is present:
  - `fields.delete === 'Confirm'` → soft-delete (`del: 0` + audit `update`) the target id, logs
    `Delete`, reloads the list.
  - `fields.Submit3 === 'Save'` → password change; rejects `"Password not match..."` if the two
    fields differ; else `password: encrypt(password)`.
  - `fields.Submit0 === 'Save'` → profile update; rejects `"Email ID already exists..."` via
    `emailDuplicateCheck` (excludes the row's own id); handles photo upload (`uploadMemberPhoto`
    — rejects non-`jpeg/jpg/gif/png` with `"Please upload jpeg, gif, jpg, or png only."`, rejects
    files over 1 MB with `"Please upload less than 1 MB file."`, otherwise writes to
    `<LEGACY_IMG_PATH>/member/<DDMMYY HHmmss + 4 random digits>.<ext>`) or `remove_photo: '1'`
    clears the `photo` column.

### 3.3 Login Access Restrictions (`access-restriction`)

Component: `AccessRestrictionSetup.jsx`.

- **Select Member** — `SearchableSelect`, `onLoad({ member_id: val })`.
- **Copy restrictions from (optional)** — `SearchableSelect`, appears once a member is selected,
  excludes the member itself from its own option list, placeholder
  `"--This user's own restrictions--"`; picking a source calls
  `onLoad({ member_id, copy_from_user: val })`. When a copy source is active, an
  `alert alert-info` reads: *"Showing restrictions copied from **&lt;name&gt;**. Nothing is saved
  yet — review the settings below, adjust as needed, then click Save to apply them to the selected
  member."*
- If the selected member is Global, the form doesn't render at all — instead:
  **"Global users are not restricted on this screen."**
- Otherwise, form **"Access Method"** with three columns:
  1. **By Login Key** checkbox + a `1–4` count `<select>` + up to 4 free-text key inputs
     (placeholders `k1`…`k4`).
  2. **By Day** checkbox (mutually exclusive with "By Date & Time" — checking one unchecks the
     other) + 7 day checkboxes (**Mon–Sun**, all checked by default for a brand-new access row) +
     **From HH:MM** / **To HH:MM** free-text time inputs.
  3. **By Date & Time** checkbox (mutually exclusive with "By Day") + **From dd-mm-yyyy HH:MM** /
     **To dd-mm-yyyy HH:MM** free-text inputs.
- **Save** button, payload includes `access_id` (blank for a brand-new row), `local_access`,
  `random_key`/`random_key_1..4`, `date_base`/`day_base` flags, `from_date`/`to_date`,
  `a_from_time`/`a_to_time`, and a `day` map of `{ index: dayNumber }` for every checked day.

Server (`accessRestriction.js`, table `access_tb`): rejects `"Select a member first."` /
`"Global users cannot be restricted here."`; otherwise `create`s a new row if the member has none
yet or `update`s the existing one (keyed by `access_id`).

### 3.4 Department Authentication (`dept-auth`)

Component: `DeptAuthSetup.jsx` — **recently redesigned** to use the shared `CheckListSelect`
component (`client/src/components/CheckListSelect.jsx`) instead of a native `<select multiple>`.

- **User** (`SearchableSelect`) → **Department** (`SearchableSelect`, appears once a user is
  picked) — `onLoad({ user_name_ref, dept_name_ref })`.
- Once both are chosen, a form with six `CheckListSelect` cards, 2-per-row (`col-md-6`):
  **Dept HOD** (single-select: `multiple={false}`, renders as radio rows), **Staffs**, **U.G**,
  **Internship**, **P.G**, **Course** (all multi-select checkbox cards). Each card is a bordered
  panel with: a search box (only shown when `options.length > 8`), a **"N selected"** counter, and
  (for multi-select, when not disabled) **Select all** / **Clear** text-buttons in the toolbar row;
  the scrollable list below shows checkbox/radio rows with hover and selected-row highlighting.
- **Save** button (`btn btn-danger mt-4`). Payload: `user_name_ref`, `dept_name_ref`, `r_id`
  (existing record id or empty for new), `dept_hod` (array, but only ever 0 or 1 entries since it's
  single-select), `dept_staff`, `dept_student`, `dept_internship`, `dept_pg`, `course_id` (all
  arrays), `form_reset` (timestamp, forces the effect to re-derive selections after reload), `Submit: 'Save'`.

Server (`deptAuthSetup.js`, table `dept_authentication`): rejects `"User and department are
required."` if either is blank; normalizes every multi-field into a comma-joined string
(`dept_staff`, `dept_student` → stored as `dept_student` DB column? — actually stored under the
DB column names `dept_staff`, `dept_student`, `dept_pg`, `dept_intern`, `course_id`, all
**CSV text columns**, matching the legacy schema exactly — not a normalized join table); `dept_hod`
stores only the **first** selected value (`Number(deptHodCsv.split(',')[0]) || 0`) since it's
single-select. Creates a new `dept_authentication` row if `r_id` is absent/0, else updates the
existing row by id.

### 3.5 Staff Department Authentication (`dept-auth-v1`)

Component: `DeptAuthV1Setup.jsx` — the **legacy-styled** sibling of `dept-auth`: it still uses a
native `<select multiple>` (local `MultiSelect` helper), **not** the newer `CheckListSelect` card
UI. This is a real, visible inconsistency between the two very similar screens (see §5).

- **Staff (HOD)** `SearchableSelect` (`onLoad({ user_name_ref: val })`).
- Once selected, form with: **Department** (multi-select `<select multiple>`, unlike `dept-auth`'s
  single-select HOD picker — here department itself is multi-valued), **Staffs** (multi-select,
  supports `<optgroup>` grouping via `data.staffGroups` when present), **U.G**, **Internship**,
  **P.G**, **Course** (plain multi-selects, `size` auto-computed `min(10, max(4, options.length))`,
  or fixed `size={12}` when grouped).
- **Save** button + a **Menu Authentication** link button (`btn-success btn-sm`) →
  `/admin/setup/staff-auth-hod?uid=<selectedStaff>`.
- Payload: `user_name_ref`, `r_id`, `dept_name_ref` (array — plural departments here, vs. singular
  in `dept-auth`), `dept_staff`, `dept_student`, `dept_internship`, `dept_pg`, `course_id`, `form_reset`, `Submit: 'Save'`.

### 3.6 Menu Authentication (`menu-auth`)

Component: `MenuAuthSetup.jsx`.

- **Select User** (`SearchableSelect`) — options list every non-Global `web_account_setup` row,
  with a trailing `" *"` suffix on the label for any user who already has at least one
  `authentication_tb` row (`del=1`) — a quick "already configured" hint.
- **Copy permissions from (optional)** (`SearchableSelect`), same copy-preview pattern as
  Access Restrictions: nothing is saved until the admin clicks Save; an info alert names the
  source user.
- Toolbar: **"Check all main menus"** checkbox (toggles every `input[name="a_auth"]` in the DOM
  directly, not through React state — these are **uncontrolled** checkboxes using
  `defaultChecked`) + a **"Filter menu items by name..."** search input. Filtering is done by
  toggling `display: none` on non-matching groups/items (not array-filtering), specifically so
  that hidden items' checked state is preserved while the admin types.
- Menu items render grouped under `<h5>{group.mainMenu}</h5>` headings, 4-per-row (`col-md-3`)
  checkboxes with the menu label as text.
- When no items match the filter: **"No menu items match "&lt;query&gt;"."**
- The `<form>` is keyed on `` `${selectedUser}:${copiedFromUser}` `` so switching users/copy-source
  forces a full remount (needed because `defaultChecked` only applies on mount, not on prop
  changes).
- **Save** button. On submit, checked ids are read directly from the DOM
  (`form.querySelectorAll('input[name="a_auth"]:checked')`), not from React state.

Server (`menuAuthSetup.js`, table `authentication_tb`, `menu_id`/`user_id`/`authentication`
columns): loads the full menu catalog via `loadMenuCatalog()`/`buildMenuGroups()`
(`menuMatrixShared.js`), pre-checks against either the target user's own grants or (in copy-preview
mode) the source user's grants. **Save is a soft-toggle, not a delete-and-recreate**: first
`updateMany` flips every currently-`authentication=1` row for that user to `authentication=0`, then
for each submitted menu id it either flips an existing `del=1` row back to `authentication=1` or
inserts a new row (`department: 0, authentication: 1`). This preserves row history/ids rather than
soft-deleting and recreating like most other setup saves in this app.

### 3.7 Dashboard Widget Access (`dashboard-access`)

Component: `DashboardAccessSetup.jsx`.

- **Select User** / **Copy widgets from (optional)** — same pattern as above two screens.
- Toolbar buttons: **Check all** (enables every widget checkbox) and **Fill default order**
  (numbers every widget's order field `1..N` in current list order).
- Widget list: one bordered row per widget (`col-md-6`), each with an enable checkbox, a numeric
  **order** input (`width: 70px`), and the widget's label.
- **Save** button. Payload builds four parallel index-keyed maps: `dashboard_list[idx]` = widget
  name, `box_order[idx]` = order value (or empty string), `enable_disable[idx]` = `'1'` only if
  enabled (omitted otherwise), `row_id[idx]` = existing DB row id if any.

Server (`dashboardAccessSetup.js`, table `dashboard_access`): rejects `"Select a user first."`;
`updateMany`-disables all current `del=1` rows for the user first, then per submitted widget either
updates the existing row by `row_id` or creates a new one; success message is
`"Your details are Updated..."` if at least one widget ended up enabled, else `"No widgets
selected"` (still a `success: true` response, just an informational message — nothing is treated
as an error for saving zero widgets).

### 3.8 Change Password (self-service) (`change-password`)

Component: `ChangePasswordSetup.jsx` — the **only** screen in this module that operates on the
**logged-in user's own account** (`memberId` from the JWT), not a selected target user, and is
therefore **not gated by the Global-write restriction** in the same way — the server service
(`changePasswordSetup.js`) always resolves the row via `member_id: memberId` from the auth token,
so a non-Global user editing "their own" account here is normal, expected self-service, not a
privilege escalation.

- Section **"Basic Information"**: read-only **Username** (`readOnly`, shows `member_id`),
  editable **Name** (required), **Mobile**, **Email**. **Save Profile** button
  (`action: 'profile'`).
- Section **"Change Password"** (`border-top pt-4`): a small muted line —
  **"Current password: `<plaintext>`"** (shown via `data.user.currentPassword`, monospace font) —
  this is safe because it is always the *viewer's own* password, decrypted server-side purely for
  their own self-service convenience, unlike the Global-gated cross-account password visibility on
  `otp-reset` (§3.9). **New Password** / **Confirm Password** (shared Show/Hide toggle) +
  **Generate** button (8-char random password, same charset as `account-add`, auto-fills both
  fields and flips to visible). **Save Password** button (`action: 'password'`).

Server: rejects `"Password not match..."` if new/confirm differ (password change);
`"Email ID already exists..."` if another **different** live account already owns that
email/mobile (profile update, `duplicateContactCheck`). Both operations reload
`{ user: mapUser(row) }` (fresh decrypted `currentPassword`) on success.

### 3.9 Reset Account (`otp-reset`)

Component: `OtpResetSetup.jsx`.

- One paragraph note: *"Red labels indicate the password has not yet been changed after reset."*
- **"Check all"** checkbox toggles every account checkbox.
- Grid of accounts (`col-md-3` each), each a checkbox + label `<MemberName> (<MemberId>)`; the
  label text is rendered `text-danger` (red) when `account.pendingReset` is true.
- **When the viewer is Global (`data.canSeePasswords === true`)**: under each account, a small
  muted line — **"Current password: `<value>`"** in `<code>` — showing that account's actual
  decrypted login password. Non-Global viewers get no such line at all (the field is absent from
  the load response, not blanked).
- **Reset Password** button (`btn btn-danger`, disabled while `busy` or no accounts checked).

Server (`otpAccountResetSetup.js`, table `web_account_setup`):
- **Load**: lists all live accounts except `member_id = 'igrapix'`; `pendingReset` = whether
  `reset_password` is non-empty. If `isGlobalAccessType(audit.accessType)`, the Prisma `select`
  additionally pulls the `password` column and the response includes a decrypted
  `currentPassword` per account plus `canSeePasswords: true`.
- **Save**: for every selected account id, sets **both** `password` (AES-128-CTR encrypted) and
  `reset_password` to a fixed known value, so the account's real login password is immediately and
  predictably known to the Super Admin performing the reset — not just a "please change your
  password" marker. Because `reset_password` becomes non-empty, the account's next successful
  login is redirected into the OTP/change-password flow (`routes/auth.js`: `if (user.reset_password) redirectTo = 'otp_request.php'`), forcing the affected user to set a real
  password of their own before reaching the dashboard.

### 3.10 Committee Access (`committee-access`)

Component: `CommitteeAccessSetup.jsx` — still the **plain native `<select multiple>`** pattern
(local `MultiSelect`, same shape as `dept-auth-v1`), not yet migrated to `CheckListSelect`.

- **User** / **Copy committees from (optional)** — same `SearchableSelect` copy-preview pattern.
- **Committee** — `<select multiple>`, `size = min(10, max(4, options.length))`.
- **Save** button. Payload: `user_name_ref`, `r_id`, `event_committee` (array), `form_reset`, `Submit: 'Save'`.

Server (`committeeAccessSetup.js`) writes/updates the **same** `dept_authentication` table as
`dept-auth` (shared table, distinct column: `event_committee`, CSV text) — creates a row if `r_id`
is absent, else updates by id.

### 3.11 / 3.12 HOD / Staff Page Authentication (`staff-auth-hod`, `staff-auth-page`)

Both slugs render the **same** component, `StaffAuthSetup.jsx`, distinguished only by a `mode`
('hod' | 'page') coming from the load response — copy text differs per mode:

| Mode | User-picker label | Hint text | Empty-state text |
|---|---|---|---|
| `hod` | "Select HOD" | "Staff with attendance authentication enabled." | "Choose an HOD to configure portal menu access." |
| `page` | "Select Staff" | "Regular staff without HOD attendance authentication." | "Choose a staff member to configure portal menu access." |

- Picker card: staff `SearchableSelect` + **Copy permissions from (optional)** `SearchableSelect`
  (copy-preview alert, same pattern as other screens).
- Toolbar card: a live **"`<N>` of `<total>` menus enabled"** summary, **Check all** (disabled once
  already fully checked), **Clear all** (disabled once already 0 selected), and **Save** — all
  three in one row.
- Menu grid: grouped cards per main menu (`staff-auth-module`), each item a pill-style
  `staff-auth-item` checkbox row that gets an `is-selected` class when checked (custom CSS, not
  the shared `form-check` styling used elsewhere in this module).
- A second **Save** button repeats at the bottom (`staff-auth-footer`).
- Save payload sends three parallel arrays over **every** menu item (not just checked ones):
  `menu_id[]`, `user_row_id[]` (existing DB row id if the pair already exists, else empty string),
  `a_auth[]` (`'1'`/`'0'` per item) — unlike Menu Authentication/Role Manager which only submit the
  checked subset.

Server (`staffAuthSetup.js`, table `admin_staff_authentication_tb`): the **staff pool differs by
mode** — `hod` mode only offers `staff_profile_tb` rows with `atten_auth = 1` (i.e. staff already
flagged as attendance-authenticating HODs); `page` mode offers everyone else
(`atten_auth != 1`). The menu catalog also differs — `admin_staff_menu_category_tb` /
`basic_st_admin_menu_tb`, a **separate** menu tree from the main admin `basic_admin_menu_tb` used
by `menu-auth`, scoped by a `regFilter` on `mode` (registration type 0 for HOD vs. non-zero for
page-level staff).

### 3.13 Role Manager (`role-manager`) — *no legacy equivalent*

Component: `RoleManagerSetup.jsx`. Intro copy: *"Define a role once, then assign it to any number
of users on the **Assign Roles** screen instead of re-ticking the same menu boxes per person."*

- **Select Role** — `SearchableSelect` with a synthetic leading option `+ Create new role`
  (`value: 'new'`) prepended to the real `data.roles` list.
- Once a role (or "new") is selected: **Role Name** (required text input, uncontrolled via `ref`,
  placeholder *"e.g. Librarian, Accountant, HOD"*), **Description** (optional, ref-based,
  placeholder *"Optional — what this role is for"*).
- **"Check all main menus"** checkbox (same DOM-direct toggle pattern as Menu Authentication).
- Menu groups identical layout/structure to Menu Authentication (uncontrolled `defaultChecked`
  boxes, `name="a_auth"`, read from the DOM on submit).
- **Save Role** button. Form is keyed `` `${selectedRoleId}:${isNew ? 'new' : 'edit'}` `` to force
  remount on role switch (same uncontrolled-checkbox remount need as Menu Authentication).

Server (`roleManagerSetup.js`, tables `role_tb` + `role_menu_tb`): rejects `"Role name is
required."`; creates or updates the `role_tb` row, then applies the **same soft-toggle** pattern as
Menu Authentication to `role_menu_tb` (disable all currently-`authentication=1` rows for the role,
then re-enable/insert exactly the submitted menu set). **Important: saving a role's menu set here
does NOT retroactively touch any user who was already assigned that role** — it only changes what
future/next materialization will grant (see §3.14). Logged under the literal page name
`role_manager` (not a `.php` filename) specifically so it's visually distinguishable from
legacy-parity log entries in `log_tb`.

### 3.14 Assign Roles (`assign-roles`) — *no legacy equivalent*

Component: `AssignRolesSetup.jsx`. Intro copy (verbatim, important because it documents a genuine
behavioral asymmetry): *"Assign one or more roles to this user. Assigning a role grants its menu
items immediately. Removing a role does **not** revoke access already granted — use **Menu
Permissions** to remove specific items by hand."*

- **Select User** — `SearchableSelect` (non-Global users only, same pool as Menu Authentication).
- Role checklist (`col-md-4` per role): checkbox + role name + small muted description line.
  Empty state: *"No roles exist yet. Create one on the **Role Manager** screen first."*
- **Save** button. Checked role ids are read from the DOM (`input[name="a_roles"]:checked`).

Server (`assignRolesSetup.js`, table `user_role_tb` + calls `materializeUserPermissions()` from
`roleMaterializer.js`):
- Standard soft-delete-then-recreate on `user_role_tb`: every current `del=1` link for the user is
  set `del=0`, then a fresh `del=1` row is inserted per submitted role id.
- Then calls `materializeUserPermissions(userId, memberId, audit)`, which is **additive-only by
  design** (see the extensive comment in `roleMaterializer.js`): it computes the union of menu ids
  granted by all the user's currently-assigned roles (`role_menu_tb`, `authentication=1`), diffs
  against the user's existing `authentication_tb` grants, and **only inserts the missing ones** —
  it never removes an `authentication_tb` row, whether that row came from a role or from a manual
  edit on Menu Authentication. This is intentional: roles are a pure *authoring convenience* layered
  on top of the same `authentication_tb` table the legacy app and `menuAuthForModule()` already
  read; there is no "granted by role X" marker column, so revoking a role cannot know which rows to
  safely retract without risking removing a manually-granted permission too.
- Success message is dynamic: `"Roles updated. <N> new menu item(s) granted from <M> role(s).
  Existing individual permissions were left untouched."` or, if nothing new was granted,
  `"Roles updated. No new menu items to grant (already covered by existing permissions, or no
  roles selected)."`

---

## 4. Primary user stories

- **US-1.** As a **Super Admin**, I want to create a new staff/admin login (name, mobile, email,
  username, password) so that a new team member can access the system, with a **Generate** button
  so I don't have to invent a password by hand.
  - *Acceptance:* duplicate username/email is rejected before insert; the new account starts with
    an unrestricted `access_tb` row (all days, 00:00–23:59) so it isn't accidentally locked out on
    day one.
- **US-2.** As a **Super Admin**, I want to search, edit, and soft-delete existing accounts (name,
  contact info, photo, password) from one list so that account maintenance doesn't require
  database access.
  - *Acceptance:* delete requires an explicit confirm-modal click; deleted accounts (`del=0`)
    disappear from the list and from every user picker across this module (`del=1` filter is
    universal).
- **US-3.** As a **Super Admin**, I want to restrict when/how a specific (non-Global) account can
  log in — by day-of-week + time window, or by a fixed date/time range, or by a login key — so that
  access outside business hours or after a staff member's contract window is blocked automatically.
- **US-4.** As a **Department HOD-managing admin**, I want to scope which students/staff/courses a
  given user can see, per department, so that department-level users only ever see their own
  department's data (`dept-auth`/`dept-auth-v1`).
- **US-5.** As a **Super Admin**, I want to grant/revoke individual menu items per user so that each
  account's sidebar matches exactly what they're cleared to use.
- **US-6.** As a **Super Admin**, I want to control which dashboard widgets a given user sees, and
  in what order, so that role-appropriate summaries (e.g. fee widgets for accountants, exam widgets
  for exam cell) are the ones each person lands on.
- **US-7.** As **any logged-in user**, I want to change my own name/contact info and my own
  password from a self-service screen so that I don't have to ask an admin for routine profile
  updates.
- **US-8.** As a **Super Admin**, I want to force a password reset on one or more accounts — setting
  a known password and requiring the user to change it at next login — so that I can regain control
  of a compromised or forgotten account without needing to know the old password.
- **US-9.** As a **Super Admin**, I want to see the current live password for any account (not just
  after a reset) so that I can verify or manually communicate credentials when needed, without
  guessing.
  - *Acceptance:* this capability (`currentPassword` in the `otp-reset` load response) is present
    **only** when `audit.accessType === 'Global'`; a non-Global viewer's response has no such field
    at all.
- **US-10.** As a **Super Admin**, I want to grant committee membership access per user so that
  committee coordinators only see the committees they're actually part of.
- **US-11.** As a **Super Admin**, I want a separate menu-permission screen scoped to the staff
  self-service portal (distinct from the main admin menu tree), split between HOD-level and
  regular-staff-level permission sets, so that portal access can be managed independently of the
  main CIS admin menu.
- **US-12.** As a **Super Admin**, I want to define reusable named roles (a bundle of menu grants)
  once, so that onboarding ten accountants doesn't mean re-ticking the same 15 menu boxes ten
  times.
- **US-13.** As a **Super Admin**, I want to assign one or more roles to a user and have their menu
  access update immediately, while never having a role assignment silently strip access a person
  already has, so that role assignment is safe to use liberally without fear of accidentally
  locking someone out.
- **US-14.** As a **non-Global user with admin-menu access**, I want to view every screen in this
  module (read-only) so that I can review configuration/audit it without risking an accidental
  change — and I want a clear, persistent banner telling me why the Save button won't work.

---

## 5. Rare / edge-case user stories

- **E-1.** As a **non-Global user**, if I somehow trigger a save request on any Admin screen
  (e.g. by scripting around the disabled UI), the server independently rejects it with 403
  `"Only Super Admin can save changes here..."` — the client-side gate is a UX convenience, not the
  actual security boundary.
- **E-2.** As a **Super Admin**, if I try to restrict login access for a **Global** account on
  Access Restrictions, the form doesn't even render — the screen explicitly states
  `"Global users are not restricted on this screen."` (Global bypasses `access_tb` entirely at
  login time, so restricting it here would be a no-op that could mislead an admin into thinking
  it's enforced).
- **E-3.** As a **Super Admin** viewing `account-edit`, the edit form includes a hidden
  `<template>`-wrapped "Your Secret Code" block referencing `user.currentPassword` that never
  renders in any browser — a leftover/incomplete UI element. The **data itself** (decrypted
  password) is still computed and shipped in the load JSON regardless of whether anything displays
  it, which is worth knowing if this response payload is ever logged or proxied.
- **E-4.** As a **Super Admin**, if I select a user on `otp-reset` whose `password` column is
  corrupted/undecryptable (e.g. wrong-length ciphertext), `decrypt()` catches the exception and
  returns `''` — the UI shows `"Current password: —"` rather than throwing an error.
- **E-5.** As a **Department admin**, configuring `dept-auth` for a department with zero eligible
  staff/students simply renders empty `CheckListSelect` cards showing **"No options available."** —
  the form still submits successfully with empty selections.
- **E-6.** As a **Super Admin**, if I revoke a menu permission on Menu Authentication while the
  affected user has an active session, the change does **not** take effect until their next
  request that re-checks `authentication_tb` — `menuAuthForModule()` runs the DB lookup **per
  request**, not just at login, so in practice revocation is close to immediate (their very next
  navigation), but their currently-open page/tab won't auto-redirect. The JWT itself only encodes
  `{ id, memberId, memberName, accessType, sessionId }` — no menu grants — so there's nothing stale
  cached in the token to worry about.
- **E-7.** As a **Super Admin**, using **Role Manager** to change what menus a role grants does
  **not** retroactively change any user who was already assigned that role — I have to revisit
  **Assign Roles** for each affected user (or re-save their role assignment) to trigger
  `materializeUserPermissions()` again. This is a deliberate design tradeoff (additive-only, no
  "granted by role" marker), not a bug, but it is easy to assume otherwise.
- **E-8.** As a **Super Admin**, removing a role from a user on Assign Roles does **not** revoke any
  menu item that role had previously granted — the screen's own copy warns about this explicitly.
  To actually remove access I must go to Menu Authentication and uncheck the specific item.
- **E-9.** As a **Super Admin**, `role-manager`/`assign-roles` have `legacy: null` in
  `adminSetupMeta.js` — there is no corresponding legacy `.php` screen, and their `log_tb` entries
  use synthetic page names (`role_manager`, `assign_roles`) instead of a `.php` filename, so they
  are visually distinguishable from legacy-parity audit entries when reviewing logs.
- **E-10.** As a **Super Admin**, `dept-auth` (redesigned, `CheckListSelect` cards) and
  `dept-auth-v1`/`committee-access` (still native `<select multiple>`) look and behave
  noticeably differently for very similar tasks — a real, currently-unresolved UI inconsistency
  (see §6).
- **E-11.** As a **Super Admin**, changing my own password via **Change Password** does not log me
  out or invalidate my current JWT — the token has no embedded password hash, so an existing
  session keeps working with the old token until it naturally expires or I log out.
- **E-12.** As a **Super Admin**, saving `dashboard-access` with zero widgets checked is treated as
  a **successful** save (`success: true`) with an informational message
  `"No widgets selected"` rather than a validation error — deliberately allowing "give this user
  no dashboard widgets at all" as a valid end state.

---

## 6. Future / predicted user stories

### Future (not implemented)

> Grounded in [../mobile.md](../mobile.md) (no mobile app currently exists for any admin-facing
> screen) and sensible extrapolation of the current pattern. None of the following exist in the
> code today — they are speculative directions, not a roadmap commitment.

- As a **Super Admin**, I might want mandatory periodic password rotation (e.g. force a reset every
  90 days) instead of only ever resetting on-demand — today `otp-reset` is entirely manual/reactive.
- As a **Super Admin**, I might want two-factor authentication (TOTP/OTP-over-SMS) specifically for
  `Global` accounts, given they bypass every other access control in the system — no MFA exists
  anywhere in the current auth flow (`routes/auth.js` is username+password only).
- As a **Super Admin**, I might want a dedicated audit-trail viewer inside this module (filterable
  by page/user/date) instead of only being able to read raw `log_tb` rows via the separate
  Log Dashboard screens — every save in this module already writes a `log_tb` entry via
  `logAdminSetup`, so the data exists; only the presentation would be new.
- As a **user**, I might want self-service "forgot password" (email/SMS-based reset link) instead
  of always requiring a Super Admin to trigger `otp-reset` on my behalf — today there is no
  unauthenticated password-recovery path at all.
- As a **Super Admin**, I might want `role-manager`/`assign-roles` extended with an explicit
  "revoke on unassign" mode (opt-in per role) — closing the E-7/E-8 gap — once enough roles exist
  that manually cleaning up via Menu Authentication becomes unwieldy.
- As a **Super Admin**, I might want `dept-auth-v1` and `committee-access` migrated to the same
  `CheckListSelect` styling as `dept-auth`, for visual/interaction consistency across the module
  (closing E-10) — this is a pure UI follow-up with no server-side change required, given both
  already speak the same `selected: array-of-values` contract `CheckListSelect` expects.
- As **any user**, if a native mobile app is ever built per `mobile.md`'s general direction for
  student/staff-facing modules, the Admin module itself is a strong candidate to remain **web-only**
  — account/access administration is inherently a low-frequency, desktop-oriented task, unlike the
  student/staff/fees/attendance modules `mobile.md` actually targets.

---

## 7. Traceability

| Story | File(s) | Endpoint | Table(s) |
|---|---|---|---|
| US-1 | `AccountAddForm.jsx`, `accountSetup.js` | `POST /api/admin/setup/account-add/save` | `web_account_setup`, `access_tb` |
| US-2 | `AccountEditSetup.jsx`, `accountSetup.js` | `POST /api/admin/setup/account-edit/load\|save` | `web_account_setup` |
| US-3 | `AccessRestrictionSetup.jsx`, `accessRestriction.js` | `POST /api/admin/setup/access-restriction/load\|save` | `access_tb` |
| US-4 | `DeptAuthSetup.jsx`/`DeptAuthV1Setup.jsx`, `deptAuthSetup.js`/`deptAuthV1Setup.js` | `POST /api/admin/setup/dept-auth[-v1]/load\|save` | `dept_authentication` |
| US-5 | `MenuAuthSetup.jsx`, `menuAuthSetup.js` | `POST /api/admin/setup/menu-auth/load\|save` | `authentication_tb`, `basic_admin_menu_tb` |
| US-6 | `DashboardAccessSetup.jsx`, `dashboardAccessSetup.js` | `POST /api/admin/setup/dashboard-access/load\|save` | `dashboard_access` |
| US-7 | `ChangePasswordSetup.jsx`, `changePasswordSetup.js` | `POST /api/admin/setup/change-password/load\|save` | `web_account_setup` |
| US-8, US-9 | `OtpResetSetup.jsx`, `otpAccountResetSetup.js`, `services/password.js` | `POST /api/admin/setup/otp-reset/load\|save` | `web_account_setup` |
| US-10 | `CommitteeAccessSetup.jsx`, `committeeAccessSetup.js` | `POST /api/admin/setup/committee-access/load\|save` | `dept_authentication` |
| US-11 | `StaffAuthSetup.jsx`, `staffAuthSetup.js` | `POST /api/admin/setup/staff-auth-hod\|staff-auth-page/load\|save` | `admin_staff_authentication_tb`, `basic_st_admin_menu_tb`, `staff_profile_tb` |
| US-12 | `RoleManagerSetup.jsx`, `roleManagerSetup.js` | `POST /api/admin/setup/role-manager/load\|save` | `role_tb`, `role_menu_tb` |
| US-13 | `AssignRolesSetup.jsx`, `assignRolesSetup.js`, `roleMaterializer.js` | `POST /api/admin/setup/assign-roles/load\|save` | `user_role_tb`, `role_menu_tb`, `authentication_tb` |
| US-14, E-1 | `AdminSetupPage.jsx` (`handleSave`, `isGlobal` banner), `routes/admin.js` (`requireGlobalWrite`) | all `/api/admin/setup/:screen/save` | — |
| Audit trail (all screens) | `services/admin/setup/setupAudit.js` (`auditFields`, `logAdminSetup`) | — | `log_tb` |
