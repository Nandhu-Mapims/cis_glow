# 11 — Admin (accounts / access / security)

## 1. Module recap

The Admin module is 14 screens under `client/src/pages/admin/setup/`, all rendered through one
shell (`AdminSetupPage.jsx`) and gated by `requireGlobalWrite` server-side plus a client-side
"view-only" banner for non-Global viewers. It covers account lifecycle (add/edit/delete),
login-time access restrictions, department/committee/menu authorization (four structurally
similar "pick a user, pick what they can touch" screens with **inconsistent controls** — see §3),
dashboard widget visibility, self-service and forced password resets, staff-portal page
authorization, and a newer role-based permission layer (Role Manager / Assign Roles) layered
additively on top of the legacy per-user menu grants. Full field-by-field detail, save payloads,
and business rules: [`../user-stories/11-admin.md`](../user-stories/11-admin.md).

---

## 2. Frontend control inventory

| Screen (slug) | Control type(s) | Search? | Single/Multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Add User Account (`account-add`) | Native text/email/tel/password inputs | — | — | — | Show/Hide password toggle; **Generate** random-password button (auto-fills Confirm too); Reset clears form |
| Edit User Account (`account-edit`) | List: search box + native table + pagination. Detail: native inputs + `type="file"` photo upload | Yes — plain substring search box on list (server round-trip, not client-filter) | — | — | Edit/Delete row actions; delete via `ConfirmModal` (danger tone); Previous/Next pager (limit 20); live photo thumbnail + Remove button; shared Show/Hide toggle for password fields |
| Login Access Restrictions (`access-restriction`) | `SearchableSelect` ×2 (member, copy-from) + native checkboxes/radios + free-text time/date inputs | Yes (both selects) | Single (both selects) | No | Mutually-exclusive "By Day" / "By Date & Time" checkboxes (checking one unchecks the other); copy-preview info alert; form doesn't render at all for Global members |
| Department Authentication (`dept-auth`) | `SearchableSelect` ×2 (user, dept) + **`CheckListSelect`** ×6 cards (Dept HOD, Staffs, U.G, Internship, P.G, Course) | Yes — selects + `CheckListSelect` search (auto-shown when options.length > 8) | Dept HOD = single (radio rows); other 5 = multi (checkboxes) | Yes — **Select all / Clear** per multi-select card | Recently redesigned; 2-per-row card grid; "N selected" counter per card |
| Staff Department Authentication (`dept-auth-v1`) | `SearchableSelect` ×2 (staff, copy-from) + **native `<select multiple>`** ×5 (local `MultiSelect` helper: Department, Staffs, U.G, Internship, P.G, Course) | No — plain OS listbox, no search box anywhere | Department is multi here (unlike `dept-auth`'s single HOD); all 5 lists multi | No — no select-all/clear | `size` auto-computed `min(10, max(4, options.length))`; supports `<optgroup>` grouping for Staffs when `staffGroups` present; "legacy-styled sibling" of `dept-auth` doing the *same task* with an older control set |
| Menu Authentication (`menu-auth`) | `SearchableSelect` ×2 (user, copy-from) + **uncontrolled checkbox grid** (`defaultChecked`, read from DOM on submit) | Yes — "Filter menu items by name..." text input, but implemented as `display:none` toggling on the DOM, not array-filter | Multi (grid) | Yes — "Check all main menus" (DOM-direct toggle, not React state) | Form is remount-keyed on `${selectedUser}:${copiedFromUser}` because `defaultChecked` only applies on mount; save reads `querySelectorAll('input:checked')` directly from the DOM, not from state |
| Dashboard Widget Access (`dashboard-access`) | `SearchableSelect` ×2 (user, copy-from) + native checkbox+number-input rows | Yes (selects only) | Multi (checkboxes) | Yes — **Check all**, **Fill default order** (auto-numbers order field 1..N) | Per-widget numeric "order" input (`width:70px`); zero-widgets save is treated as valid, not an error |
| Change Password (self-service) (`change-password`) | Native text/email inputs + password fields | — | — | — | Only screen scoped to the logged-in user's own account, not Global-write-gated the same way; **Generate** button (8-char random) |
| Reset Account (`otp-reset`) | Native checkbox grid | No | Multi | Yes — **Check all** | Global-only viewers see a decrypted "Current password" line per account; red label text flags `pendingReset` accounts |
| Committee Access (`committee-access`) | `SearchableSelect` ×2 (user, copy-from) + **native `<select multiple>`** (local `MultiSelect`, same shape as `dept-auth-v1`) | No | Multi | No | `size = min(10, max(4, options.length))`; not yet migrated to `CheckListSelect` |
| HOD / Staff Page Authentication (`staff-auth-hod`, `staff-auth-page`) | `SearchableSelect` ×2 (staff, copy-from) + custom pill-style checkbox grid (`staff-auth-item`, controlled state, not `defaultChecked`) | Yes (selects only) | Multi (grid) | Yes — **Check all** (disabled once fully checked), **Clear all** (disabled once empty) | Live "`N` of `total` menus enabled" summary; Save button duplicated top and bottom of page; unlike Menu Auth, this grid is **controlled** React state, not DOM-read |
| Role Manager (`role-manager`) | `SearchableSelect` (role, with synthetic "+ Create new role" option) + uncontrolled checkbox grid (same DOM-read pattern as Menu Auth) | Yes (select only) | Multi (grid) | Yes — "Check all main menus" | Ref-based (uncontrolled) Role Name/Description text inputs; remount-keyed on `${roleId}:${new|edit}` |
| Assign Roles (`assign-roles`) | `SearchableSelect` (user) + native checkbox grid (role list) | Yes (select only) | Multi (checkboxes) | No | Small muted description line per role; checked ids read from DOM on submit; empty-state prompts to visit Role Manager first |

**Pattern summary across the 14 screens:** `SearchableSelect` (single-value, searchable) is used
consistently for every "pick a person/role" dropdown across all 14 screens — this part of the
module is already converged and consistent. The inconsistency is entirely in the *multi-value*
picker layer: `CheckListSelect` (search + bulk actions) appears on exactly one screen
(`dept-auth`), plain uncontrolled/controlled checkbox grids (no search, per-screen bespoke bulk
actions) appear on five screens (Menu Auth, Dashboard Access, Reset Account, Staff Auth ×2, Role
Manager, Assign Roles), and legacy native `<select multiple>` (no search, no bulk actions) survives
on two screens (`dept-auth-v1`, `committee-access`). Three different multi-select idioms for
what is, in every case, "grant this user/role a set of items" is the single biggest cross-cutting
UX inconsistency in the module.

---

## 3. Advanced feature gaps

1. **`dept-auth-v1` and `committee-access` are the clear upgrade candidates for `CheckListSelect`.**
   `DeptAuthSetup.jsx` (`dept-auth`) already proves the pattern in production: six
   `CheckListSelect` cards with per-card search (auto-enabled past 8 options), a live "N selected"
   counter, and **Select all / Clear** bulk actions. `DeptAuthV1Setup.jsx` (`dept-auth-v1`) does
   the *structurally identical* task — pick a staff/HOD, then scope Department/Staffs/U.G/
   Internship/P.G/Course — but with a bare `<select multiple>` local `MultiSelect` helper: no
   search box, no select-all/clear, ctrl/cmd-click required to multi-pick, `size` auto-computed
   from option count rather than a scrollable fixed-height list. `CommitteeAccessSetup.jsx`
   (`committee-access`) has the exact same gap for its single Committee multi-select. Both screens
   already speak the same `selected: array-of-values` contract `CheckListSelect` expects
   (confirmed by reading `CheckListSelect.jsx` — `value`/`onChange` array contract, `multiple`
   prop for single-vs-multi), so this is a swap-the-component change, not a data-model change.
   For a department with 30+ staff or a college with 20+ committees, the missing search box is a
   real usability cost every single time the screen is opened.
2. **Menu Authentication's checkbox grid has no visual grouping/hierarchy beyond flat `<h5>`
   headings.** With potentially 100+ menu items across many `mainMenu` groups, a flat 4-per-row
   grid under repeated headings makes it hard to see the shape of what's granted at a glance
   (see §4 for the tree-view suggestion).
3. **Role Manager and Assign Roles reuse the same uncontrolled/DOM-read checkbox grid pattern as
   Menu Authentication**, inheriting the same remount-on-switch fragility (`defaultChecked` only
   applies on mount, so the whole form is keyed to force a fresh mount on user/role switch) rather
   than a controlled component. This is workable but brittle — any future feature that needs to
   read "what's currently checked" without a full form remount (e.g. a live count, or partial
   pre-population) can't, because the grid state doesn't exist in React at all until submit.
4. **Account Edit's search box does a full server round-trip per keystroke-triggered search**
   (via an explicit Search button, not live-as-you-type) rather than a `SearchableSelect`-style
   instant client-side filter — reasonable given it's a paginated list, not a fixed option set, but
   worth noting it behaves differently from every other "find a person" control in the module.
5. **Reset Account's account grid has no search either.** `OtpResetSetup.jsx` renders every live
   account (minus `igrapix`) as a flat `col-md-3` checkbox grid with only a "Check all" bulk
   toggle — for a college-wide account list this is the same "scroll to find it" problem
   `CheckListSelect` already solves elsewhere, but here there isn't even a native `<select
   multiple>` to fall back on; it's a raw checkbox grid, so this screen would benefit from the
   `CheckListSelect` treatment even more than `dept-auth-v1`/`committee-access` do, since it
   currently has *zero* filtering mechanism of any kind.
6. **Dashboard Widget Access's per-widget order input is a free-text number field with no
   drag-reorder**, even though `client/src/hooks/useDragReorder.jsx` already exists in the
   codebase and is presumably used elsewhere for list-ordering UIs. Typing "1, 2, 3…" into N
   separate small text boxes to set display order is more error-prone (duplicate numbers, gaps)
   than dragging rows into place, especially combined with the existing "Fill default order"
   button which only helps for the *initial* ordering, not a reorder of an already-configured set.
7. **Copy-preview screens give no way to select just a subset of what's being copied.** Every
   "copy from" flow (Access Restrictions, Menu Authentication, Dashboard Widget Access, `dept-auth`
   family, Staff Authentication) is all-or-nothing: picking a copy source loads *all* of that
   user's settings into the form, and the admin can only then manually uncheck individual items
   before saving — there's no "copy only these N menu items" picker at copy-time itself. For Menu
   Authentication specifically, copying from a user with 80 granted items to set up a narrower role
   means manually unchecking dozens of boxes after the fact.
8. **HOD Page Authentication (`staff-auth-hod`) and Staff Page Authentication (`staff-auth-page`)
   share one component (`StaffAuthSetup.jsx`) and one visual pattern (pill-style `staff-auth-item`
   checkboxes) that is distinct from every other checkbox grid in the module** — it's the only
   *controlled* grid (vs. Menu Auth/Role Manager's uncontrolled DOM-read grid), and its own custom
   CSS class instead of the shared `form-check` styling used on Dashboard Widget Access/Reset
   Account. Three different checkbox-grid visual/interaction patterns for what is conceptually the
   same task (grant a set of items to a user) is itself worth consolidating once the menu-tree
   suggestion in §4 is built, so there's one grid component instead of three.

---

## 4. User-experience suggestions

- **Menu Authentication — a visual menu tree instead of a flat checkbox grid.** With menu items
  grouped only by a `<h5>{mainMenu}</h5>` heading and 4-per-row checkboxes underneath, a Super
  Admin configuring a new account has no way to see "how much of the sidebar" they're granting at
  a glance, and the existing text-filter (which hides non-matching *items* via `display:none`,
  not the group headings) can leave orphaned group headings with zero visible children. A
  collapsible tree (group → items, with a group-level checkbox that reflects
  all/some/none-checked state) would make both bulk grants ("give this HOD everything under
  Fees") and audits ("does this person have exam access?") a visual scan instead of a read-every-
  checkbox exercise. This helps most on Menu Authentication and Role Manager, which share the
  identical grid today.
- **A permissions diff view for every "copy from" flow.** Access Restrictions, Menu Authentication,
  Dashboard Widget Access, `dept-auth`, `dept-auth-v1`, `committee-access`, and both Staff
  Authentication screens all implement the same "copy from another user, review, then Save"
  pattern — but the only feedback today is a generic info alert naming the source user
  ("Showing restrictions copied from **X**..."). None of them show *what specifically changed*
  relative to what the target user had before. A diff view ("+3 menu items added, -1 removed,
  12 unchanged") would let an admin catch an unintended over-grant before clicking Save, which
  matters most on Menu Authentication where the blast radius of a bad copy is real system access.
- **Distinguish Role Manager's role-level edits from Assign Roles' per-user edits with different
  warning styling.** `user-stories/11-admin.md` §3.13–3.14 documents a real, easy-to-misread
  asymmetry: editing a role's menu set on Role Manager does **not** retroactively touch any user
  already assigned that role (E-7), and removing a role from a user on Assign Roles does **not**
  revoke menu items that role previously granted (E-8) — permissions are additive-only by design,
  with no "granted by role X" marker to safely retract. Both screens currently communicate this
  only via body-copy sentences. Role Manager's save flow affects *future* materialization for
  potentially many users at once; Assign Roles' save flow is scoped to *one* user and *is*
  immediately effective for grants (just not revocations). Using a distinct banner color/icon per
  screen — e.g. an amber "this changes the template, not existing users" banner on Role Manager
  vs. a blue "grants apply now; removals require Menu Authentication" banner on Assign Roles —
  would stop admins from assuming a Role Manager save is retroactive (a plausible and costly
  misunderstanding given the screen literally shows a checked/unchecked menu grid, which reads as
  "this is what users have" rather than "this is what the role will grant going forward").
- **Inline validation on Add User Account before Save, not after.** Username/email-duplicate
  checks and password-mismatch validation currently only happen server-side after a full submit
  round-trip (per `user-stories/11-admin.md` §3.1). A debounced client-side "check availability"
  call on blur for Username/Email, plus live password-confirm matching as the admin types, would
  shorten the create-account loop — this is a high-frequency screen (every new hire) where a
  failed submit means re-entering the password fields from scratch since they're cleared on error.
- **Account Edit list — replace the plain search box with visible filter chips for common
  cases** (e.g. "no active accounts", "pending reset") reusing the same `pendingReset` flag already
  surfaced on `otp-reset`, so an admin auditing stale accounts doesn't have to cross-reference two
  screens.
- **Skeleton loading / empty-state polish** for `CheckListSelect` cards on `dept-auth`: the "No
  options available." text is accurate but gives no hint of *why* (e.g. no active staff in this
  department vs. a load failure) — a short qualifier would help distinguish a legitimately empty
  department from a broken load.
- **Drag-reorder for Dashboard Widget Access instead of free-text order numbers.** Reusing
  `useDragReorder.jsx` (already in the codebase) would replace N small numeric inputs with a
  single draggable list — directly relevant here because the screen's own "Fill default order"
  button already signals that manual numbering is the pain point the current UI is working around;
  drag-reorder removes the need for numbering entirely.
- **A partial-select step in every "copy from" flow**, letting the admin choose which subset of the
  source user's settings to bring over (e.g. a checklist of "which menu groups to copy" before the
  full form populates) rather than copying everything and manually pruning afterward — most
  valuable on Menu Authentication and Role Manager, where a copy source can carry 50+ granted
  items.
- **Reset Account — add a search/filter box to the account grid**, given it currently has no
  filtering mechanism at all (see gap 5) — even a simple substring filter above the `col-md-3` grid
  (matching the pattern already used on Menu Authentication's "Filter menu items by name...") would
  help on an install with more than a screenful of accounts.
- **Confirmation-strength scaling for destructive actions.** Account Edit's delete uses a
  `ConfirmModal` with an explicit name+ID in the message ("Delete user account "X" (Y)? This
  cannot be undone.") — a good pattern — but Reset Account's "Reset Password" button has no
  confirm step at all despite immediately overwriting a live login password for every checked
  account; given `otp-reset`'s own documented behavior (US-8: the new password becomes
  *immediately known* to the admin, not just a "please change" marker), a lightweight confirm
  ("Reset password for N accounts? They will be required to set a new password at next login.")
  would guard against a stray click on a large "Check all" selection.
- **Accessibility pass on the uncontrolled/DOM-read checkbox grids.** Menu Authentication and Role
  Manager's `name="a_auth"` checkboxes are plain unlabeled inputs read via
  `querySelectorAll`; pairing each with a proper `<label htmlFor>` (rather than relying on adjacent
  text) and adding `aria-checked`/group `role="group"` semantics would improve screen-reader
  navigability of what is, on a large install, a genuinely long list of controls.

---

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Swap `DeptAuthV1Setup.jsx`'s and `CommitteeAccessSetup.jsx`'s native `<select multiple>` fields
  for `CheckListSelect` — component already exists, contract already matches, zero server changes.
- Add a search box to Reset Account's account grid — even a plain substring filter, matching the
  existing Menu Authentication filter pattern.
- Add a short qualifier to `CheckListSelect`'s empty-state text on `dept-auth` (e.g. distinguish
  "no active staff in this department" from a load error).
- Distinct banner styling (color/icon) for Role Manager vs. Assign Roles warning copy — pure CSS/
  copy change, no logic change.
- Client-side password-confirm live matching on Add User Account / Change Password (already have
  the two fields in state; just add a comparison + inline message).
- Confirm modal before Reset Account's "Reset Password" bulk action — reuses the existing
  `ConfirmModal` component already used on Account Edit's delete flow.
- Port `GeneratePayroll`-style Refresh-button UX conventions aside — not applicable here, but the
  general pattern of "add a confirm step to an existing destructive bulk action" applies equally
  well to Reset Account with minimal new code.

**Bigger investments (needs design/product buy-in first):**
- Menu tree component for Menu Authentication + Role Manager (collapsible groups, tri-state
  group checkboxes) — a genuinely new shared component, not a swap of an existing one; ideally also
  absorbs Staff Page Authentication's separate pill-style grid so the module converges on one
  grid/tree component instead of three.
- Permissions diff view for all seven "copy from" screens — needs a shared diff-computation
  utility plus a consistent UI pattern chosen once and reused, not a per-screen bespoke build.
- Partial-select ("copy only these items") step for the copy-from flows — depends on the diff-view
  work above landing first, since both need the same underlying comparison data.
- Debounced username/email availability check on Add User Account — needs a new lightweight
  "check availability" endpoint (today only the full save path validates duplicates).
- Drag-reorder for Dashboard Widget Access — needs UI/interaction design even though the
  `useDragReorder` hook already exists, since the widget list also carries an enable/disable
  checkbox per row that a pure drag list doesn't currently model.
