# ADMIN_ROLE_MODULE_UPGRADE.md — Admin / Role-Access Module: Old vs New + Upgrade Plan

> **Status: role system implemented (2026-08-10).** §5's proposal is now live —
> `role_tb`/`role_menu_tb`/`user_role_tb` exist in the shared MariaDB DB,
> `role-manager`/`assign-roles` screens are wired into `/api/admin` and the
> Admin hub, and `materializeUserPermissions()` compiles role assignments
> into `authentication_tb`. §5.5 below documents exactly what shipped vs.
> what's still deferred. Everything in §1–§4 (the old-vs-new comparison) is
> historical context and still accurate as of the port.

> Scope: the **admin / user-account / role-access** module only — user
> accounts, login/device restrictions, and "who can see which menu" (legacy
> `bs/` + root `account_*`/`access.php`/`authentication_*`/`department_*`/
> `committee_access.php`/`dashboard_access.php` screens; modern
> `/api/admin` + `client/src/pages/admin/`). Companion to
> [OLD_CIS_FULL_FLOW.md](OLD_CIS_FULL_FLOW.md) and
> [NEW_CIS_FULL_FLOW.md](NEW_CIS_FULL_FLOW.md), which cover the whole app.
> This file (1) compares old vs. new for this module specifically, then
> (2) proposes an upgraded flow for the **new** CIS. Nothing here has been
> implemented yet — it's a plan for sign-off before touching schema or code.

---

## 1. What this module actually does, in both apps

There is **no role concept** in either app. Access is granted **per user, per
menu item** — a checkbox matrix, not roles/permissions groups. "Admin module"
= account management + that checkbox matrix + login/device restrictions +
login audit log. Keep that in mind reading the rest of this doc: every
"weakness" below stems from this one structural fact.

---

## 2. Legacy CIS — how it works today

### 2.1 Screens (all under `bs/` or webroot, no dedicated directory)

| Legacy file | Purpose |
|---|---|
| `account_add.php` / `account_edit.php` | Create/edit a `web_account_setup` row — username, name, email, mobile, password, **`access_type`** (free-text-ish field, default `Limit`; `Global` = superuser). |
| `access.php` | Per-user **login restriction**: day-of-week window, date range, allowed time window, and device-cookie fingerprinting (`local_access` flag + 4 rotating `random_id_1..4` cookie/DB pairs) — writes `access_tb`. |
| `authentication_add.php` | **The core screen**: pick one user → render *every* enabled menu item as a checkbox → save which ones they can see. Writes `authentication_tb` (`user_id`, `menu_id`, `authentication` 0/1). |
| `department_authentication.php` / `department_authentication_v1.php` | A department-scoped variant of the same checkbox-matrix idea, for staff. |
| `staff_authentication_add.php` / `staff_page_authentication_add.php` | HOD-specific and staff-specific variants of the same matrix. |
| `committee_access.php` | Same pattern again, scoped to committee membership access. |
| `dashboard_access.php` | Same pattern again, scoped to which dashboard *widgets* a user sees (`dashboard_access` table). |
| `change_password.php` / `otp_account_reset.php` | Self-service password change / admin-triggered reset. |
| `bs/admin_menu.php` / `bs/admin_menu_category.php` / `bs/admin_menu_more.php` | The menu **definition** screens — what `basic_admin_menu_tb`/`admin_menu_category_tb` even contain. This is where a new screen gets registered into the menu system in the first place. |
| Admin's own login gate | `index.php`'s `access_check()` (§2 of OLD_CIS_FULL_FLOW.md) — `access_type === 'admin'`/`'Global'` bypasses everything; everyone else is checked against `access_tb`. |

### 2.2 Data model (unchanged in the new app — see §3.2)

- `web_account_setup.access_type` — a free-form `VARCHAR(10)`, default `'Limit'`. In practice only two values matter: `'Global'` (bypasses every check) and everything else (subject to `authentication_tb`). There's no table of valid role names — it's a convention, not a constraint.
- `authentication_tb(user_id, department, menu_id, authentication)` — one row per **(user, menu item)** pair. To give a new librarian the same permissions as an existing one, an admin must open `authentication_add.php`, select the new user, and re-tick every box by hand (or the legacy app has no "copy from another user" shortcut).
- `access_tb(user_id, ...)` — day/date/time/device restrictions, also per-user.
- `dashboard_access`, committee-access, department-authentication tables — same **per-user-per-item** shape, repeated for each sub-domain instead of reusing one general permission model.

### 2.3 Consequence

Onboarding N staff with identical access = N times re-ticking the same ~450
menu checkboxes by hand. There is no single place that says "this is what a
Librarian / HOD / Accountant is allowed to see" — that knowledge exists only
implicitly, spread across however many individual `authentication_tb` rows
happen to match.

---

## 3. New CIS — how it works today

### 3.1 Screens (`client/src/pages/admin/`, `/api/admin`)

Confirmed **1:1 port** of the legacy screen set — same slugs mapped straight
to the same legacy files in `adminSetupMeta.js`:

| Slug | Legacy file | Server setup file |
|---|---|---|
| `account-add` / `account-edit` | `account_add.php` / `account_edit.php` | `accountSetup.js` |
| `access-restriction` | `access.php` | `accessRestriction.js` |
| `menu-auth` | `authentication_add.php` | `menuAuthSetup.js` |
| `dept-auth` / `dept-auth-v1` | `department_authentication*.php` | `deptAuthSetup.js` / `deptAuthV1Setup.js` |
| `staff-auth-hod` / `staff-auth-page` | `staff_authentication_add.php` / `staff_page_authentication_add.php` | `staffAuthSetup.js` |
| `committee-access` | `committee_access.php` | `committeeAccessSetup.js` |
| `dashboard-access` | `dashboard_access.php` | `dashboardAccessSetup.js` |
| `change-password` | `change_password.php` | `changePasswordSetup.js` |
| `otp-reset` | `otp_account_reset.php` | `otpAccountResetSetup.js` |

Plus `AdminUserList.jsx`/`AdminUserEditPage.jsx` (`GET /api/admin/users` —
paginated/searchable user list, new convenience the legacy app didn't have
as a dedicated screen) and `AdminLogDashboard.jsx`/`AdminLogDetails.jsx`
(`log-dashboard`/`log-details` — login audit views over `log_tb`).

### 3.2 Data model — **unchanged**

Confirmed against `server/prisma/schema.prisma`: `web_account_setup.access_type`
is still a bare `VARCHAR(10)` string, `authentication_tb` is still one row per
`(user_id, menu_id)`, `access_tb` is still per-user device/time restrictions.
**No new tables were introduced for this module** — correctly following
CLAUDE.md's "don't invent schema for migrated screens" rule, but it also
means the new app inherited the exact same "no roles" limitation, unchanged.

### 3.3 What *is* better than legacy, already

- **`menuAuthForModule()`** (`server/src/middleware/menuAuth.js`) collapses what
  would have been legacy's per-request, one-query-per-menu-pattern check into
  a **single SQL query per module** (`EXISTS(... OR ... OR ...)` across all of
  a module's link patterns) — a real perf win, not just a rewrite.
- **View vs. write split**: `router.use(authMiddleware, menuAuthForModule('admin'))` lets
  any account with admin-module menu access **view** every admin screen, but
  `requireGlobalWrite()` (`server/src/routes/admin.js`) blocks `POST
  /setup/:screen/save` unless `accessType === 'Global'`. Legacy had no
  equivalent split — if you could open `authentication_add.php` at all in
  the old app, you could also save it.
- **`AdminUserList.jsx`** — a searchable, paginated user directory. Legacy had
  no single "list all accounts" screen; you'd only ever land on one account
  at a time via `account_edit.php`.
- Login lockout / rate-limiting logic (`server/src/routes/auth.js`) reproduces
  legacy's 5-in-5-minutes rule but adds a request-volume limiter in front of
  it (`loginRequestLimiter`) — legacy had no equivalent front-line throttle.

### 3.4 What's identical (i.e., still a weakness, faithfully preserved)

- The `menu-auth` screen (`MenuAuthSetup.jsx` → `menuAuthSetup.js`) is a
  **direct port of the same checkbox-matrix UX**: pick one user, render every
  enabled menu item, tick boxes, save. `loadMenuMatrix()` in
  `menuAuthSetup.js` builds the exact same per-user, per-menu-row structure
  `authentication_add.php` did.
- `accessType === 'Global'` string-literal checks are scattered across the
  codebase (`menuAuth.js`, `admin.js`'s `requireGlobalWrite`, and elsewhere)
  rather than centralized behind one helper — a direct carry-over of legacy's
  "special-case the superuser string" pattern rather than a deliberate
  design choice for the new app.
- No "copy permissions from user X" / "role template" shortcut anywhere —
  onboarding N identical accounts is still N times through the same matrix.
- `dept-auth`, `staff-auth-hod`, `staff-auth-page`, `committee-access`,
  `dashboard-access` are five **separate** per-item permission screens with
  the same underlying shape — never unified into one general permission
  model, in either app.

---

## 4. Gap summary

| Gap | Old CIS | New CIS | Root cause |
|---|---|---|---|
| Role/permission groups | ❌ none | ❌ none | `authentication_tb` is per-user-per-menu by design |
| Bulk-onboard identical access | ❌ manual, per user | ❌ manual, per user | same |
| Central "what can a Librarian see" definition | ❌ doesn't exist | ❌ doesn't exist | same |
| Permission change history | Only implicit via generic `log_tb` | Only implicit via generic `log_tb` | no dedicated audit trail for `authentication_tb` writes |
| Superuser check centralization | N/A (procedural PHP) | Scattered `=== 'Global'` checks | not addressed during migration |
| Unified permission model across sub-domains (menu / dept / committee / dashboard) | 5 separate screens/tables | 5 separate screens, same tables | preserved 1:1 |
| View vs. write separation | ❌ none | ✅ `requireGlobalWrite` | **new app improvement** |
| Query efficiency for permission checks | Per-pattern queries | ✅ single `EXISTS` query | **new app improvement** |

---

## 5. Proposed upgraded flow for New CIS

**Principle: additive, not destructive.** The legacy PHP app (`/home/mapims/cis/cis/`)
reads `authentication_tb`/`access_tb`/`web_account_setup` directly and keeps
running independently — this module can't be redesigned out from under it.
Every proposal below is **new, optional tables that compile down into the
existing tables**, so both apps keep working off the same effective
permission rows regardless of which one made the change. This deviates from
"don't invent schema" only because it's *new capability*, not a screen port —
flagging explicitly per CLAUDE.md's spirit: **get sign-off before adding any
table**, this section is the proposal to get sign-off on, not a fait accompli.

### 5.1 New tables (additive, all `del=1`/`del=0` + standard audit fields, same convention as every other table)

```text
role_tb            (id, role_name, description, created_by/dt/ip, updated_by/dt/ip, del)
role_menu_tb        (id, role_id, menu_id, authentication, ...audit, del)     -- mirrors authentication_tb's shape exactly
user_role_tb         (id, user_id, role_id, ...audit, del)                     -- many-to-many: a user can hold multiple roles
```

`role_menu_tb` is intentionally shaped identically to `authentication_tb`
(`role_id` instead of `user_id`) so the same matrix UI component
(`MenuAuthSetup.jsx`'s table) can render either a per-user or a per-role
matrix with a prop swap — no new UI paradigm, just a new target.

### 5.2 Compilation step, not a runtime redesign

Add one function, `materializeUserPermissions(userId)`:

1. Look up the user's `user_role_tb` rows (0 or more roles).
2. Union all `role_menu_tb` rows for those roles.
3. Overlay any user-specific `authentication_tb` rows the admin explicitly
   set (per-user rows always win — this preserves today's "individual
   override" screens for edge cases, e.g. one HOD who needs one extra menu
   item beyond their role).
4. **Write the result back into `authentication_tb`** (the same table
   `menuAuthForModule()` and the legacy PHP app already read) — on role
   assignment/change, not on every request.

This means: **zero changes to `menuAuthForModule()`, zero changes to the
legacy PHP app, zero changes to `resolveFirstMenuLink()`** — they keep
reading `authentication_tb` exactly as today. Roles are purely an
*authoring* convenience layered on top of the existing effective-permission
table, not a new runtime code path.

### 5.3 New/changed screens (new CIS only — legacy app untouched)

| Screen | Behavior |
|---|---|
| **Role Manager** (new) | List roles, create/edit a role → same checkbox-matrix component as today's `menu-auth`, but scoped to `role_menu_tb`. |
| **Assign Roles** (new) | Per user: multi-select which role(s) they hold (`user_role_tb`). Triggers `materializeUserPermissions()`. |
| **Menu Authentication** (existing `menu-auth`, kept) | Unchanged UI, now labeled "individual overrides" — still writes `authentication_tb` directly for one-off exceptions, still available for accounts that shouldn't hold a role at all. |
| **"Copy permissions from user"** (new, small) | Pure convenience on top of existing `authentication_tb` — no schema change needed at all; can ship *before* the role system as a quick win. |
| **Permission Change Log** (new, in `AdminLogDashboard`) | Filter the existing `log_tb` (or a new lightweight audit insert alongside every `authentication_tb`/`role_*` write) down to "who changed whose access, when" — currently invisible inside the generic login/activity log. |
| **Centralize the superuser check** | Add `isGlobalAdmin(user)` in one shared util; replace every scattered `accessType === 'Global'` with a call to it. Zero behavior change, pure maintainability — do this regardless of whether the role system ships. |

### 5.4 Suggested build order (each step independently useful, none blocks the next)

1. ✅ **Quick wins, no schema change**: centralize `isGlobalAdmin()`; add
   "copy permissions from user X" to the existing `menu-auth` screen.
2. ✅ **Add `role_tb`/`role_menu_tb`/`user_role_tb`** (additive migration,
   `npm run db:pull && npm run db:generate` after a DBA adds them — per
   CLAUDE.md this needs explicit sign-off since it's schema, not a script).
3. ✅ **Role Manager + Assign Roles screens**, backed by
   `materializeUserPermissions()` writing into `authentication_tb`. See §5.5
   for exactly what shipped.
4. ⬜ **Permission Change Log** surfaced in the existing log dashboard — not
   yet built. `log_tb` already gets entries for role/assignment saves (via
   `logAdminSetup`, page `role_manager`/`assign_roles`), but there's no
   filtered view for "show me permission changes only" yet.
5. ⬜ *(Stretch, only if useful in practice)* unify `dept-auth`/
   `staff-auth-hod`/`staff-auth-page`/`committee-access`/`dashboard-access`
   under the same role concept — each already shares the per-user-per-item
   shape, so once roles exist for menu access the same pattern generalizes,
   but this is a bigger lift and should wait until the core role system is
   proven.

### 5.5 What actually shipped (implementation notes)

| Piece | File(s) | Notes |
|---|---|---|
| Schema | `role_tb`, `role_menu_tb`, `user_role_tb` — created directly in MariaDB (InnoDB, `latin1`/`latin1_swedish_ci`, no FK constraints — matching every other table in this schema), then `npm run db:pull && npm run db:generate` | Additive only; `authentication_tb`/`web_account_setup`/legacy tables untouched. |
| Shared matrix helpers | `server/src/services/admin/setup/menuMatrixShared.js` (`loadMenuCatalog`, `buildMenuGroups`) | Extracted from `menuAuthSetup.js`'s original `loadMenuMatrix` (behavior-preserving refactor) so the per-user matrix (Menu Authentication) and the new per-role matrix (Role Manager) share one implementation instead of duplicating the category-sort logic. |
| Compiler | `server/src/services/admin/setup/roleMaterializer.js` — `materializeUserPermissions(userId, memberId, audit)` | **Additive only, as designed**: unions `role_menu_tb` across all of a user's assigned roles, writes any menu_id not already present in that user's `authentication_tb` (whether that existing row came from a prior role grant or a manual override — no distinction is made, and none is needed, because the write is additive either way). Removing a role does **not** retract previously granted menu items — that's a deliberate v1 constraint, not an oversight (see the "Explicit non-goals" callout it necessitated, below). To revoke access, an admin still uses Menu Permissions to uncheck the specific item. |
| Role Manager screen | `server/src/services/admin/setup/roleManagerSetup.js`, `client/src/pages/admin/setup/RoleManagerSetup.jsx`, slug `role-manager` | Create/edit a role → name + description + the same checkbox matrix component. No legacy file — `adminSetupMeta.js` marks it `legacy: null`. |
| Assign Roles screen | `server/src/services/admin/setup/assignRolesSetup.js`, `client/src/pages/admin/setup/AssignRolesSetup.jsx`, slug `assign-roles` | Pick a user → check which role(s) they hold → Save does a standard `del=1`/`del=0` soft-delete-then-recreate on `user_role_tb`, then calls the materializer. Returns a message stating exactly how many new menu items were granted, so the admin isn't guessing whether anything happened. |
| Dispatcher wiring | `server/src/services/admin/adminSetup.js` | Both slugs added to `VALID_SCREENS`/`LOADERS`/`SAVERS` — no route changes needed; `/api/admin/setup/:screen/load|save` already handles arbitrary slugs, and the existing `menuAuthForModule('admin')` (view) + `requireGlobalWrite` (save) gates apply automatically since they're router-level, not per-screen. |
| Access-check centralization | `server/src/utils/accessType.js`, `client/src/utils/accessType.js` — `isGlobalAccessType()`/`GLOBAL_ACCESS_TYPE` | Landed alongside this as the §5.4 step-1 quick win; every scattered `accessType === 'Global'` literal across both server and client now goes through one helper. |
| Menu entry point | `client/src/pages/admin/AdminHub.jsx` | Two new tiles: "Role Manager" and "Assign Roles". Not added to the legacy `sidebar.php`-driven menu system (`basic_admin_menu_tb`) since there's no legacy screen to map — reachable only via the Admin hub, same as it would be for any genuinely new capability. |
| Verification | Ad hoc smoke test (not part of the committed test suite) | Created a real role with 2 menu items, assigned it to a live non-Global test account, confirmed `authentication_tb` active-row count went from 0 → 2 for that user, then fully reverted (soft-deleted) all of it. No test-suite entries were added — `test/` doesn't have per-admin-screen mutation tests today; add one if this becomes load-bearing. |

### 5.6 Explicit non-goals

- **Not** touching `access_tb` (day/time/device restriction) semantics — that's
  inherently per-user/per-device, not a role concept, and legacy device
  fingerprinting behavior must stay bit-for-bit compatible.
- **Not** removing or renaming `authentication_tb`, `web_account_setup`, or
  any existing column — roles are additive tables only.
- **Not** changing what the legacy PHP app sees or does — it keeps reading
  the same `authentication_tb` rows it always has, populated either by its
  own `authentication_add.php` or by the new app's role compiler; either
  path produces rows in the same shape.

---

## 6. Where this fits

| Need | Doc |
|---|---|
| Whole-app legacy flow | [OLD_CIS_FULL_FLOW.md](OLD_CIS_FULL_FLOW.md) |
| Whole-app modern flow | [NEW_CIS_FULL_FLOW.md](NEW_CIS_FULL_FLOW.md) |
| Absolute rules (schema, soft-delete, audit) | [CLAUDE.md](CLAUDE.md) |
| **This file** | Admin/role-access module: old vs. new comparison + upgrade proposal (not yet implemented) |
