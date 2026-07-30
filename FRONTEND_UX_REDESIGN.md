# Frontend UX Redesign — Audit & Plan

> Working doc for the ongoing frontend modernization. Updated as work lands.
> Scope agreed with the user: **flagship-first, incremental** — extend the existing
> design system and fill genuine UX gaps, rather than a wholesale rewrite. Changes
> are left uncommitted for review (see CLAUDE.md: "keep diffs focused — no drive-by
> refactors", "do not commit unless asked").

## Honest starting point (read this before "redesigning" anything)

A prior pass on this repo already shipped a real design system, not a generic
Bootstrap/legacy UI:

- `client/src/styles/theme.css` — full token set (brand, surfaces, text, semantic
  colors, focus rings, typography scale, spacing/radius/shadow scale).
- `client/src/theme/` — `ThemeContext` + 5 live-switchable presets (`campus-red`,
  `slate-amber`, `forest-teal`, `navy-gold`, `charcoal-coral`) + light/dark sidebar
  mode + a custom-color picker, persisted to `localStorage`.
- `TopNav.jsx` — mega-menu with search, mobile drawer, active-route
  highlighting, keyboard-friendly dropdowns.
- `DataTable.jsx` — sortable columns, client search, pagination, skeleton loading,
  empty/error states, responsive card view on mobile, `aria-sort`/keyboard support.
  This is the shared pattern; most list pages already use it.
- `PageShell.jsx` — `PageHeader`, `Breadcrumbs`, `SetupPageShell`, `ModuleHub`/`HubCard`
  shared chrome for setup and hub screens.
- `ConfirmModal.jsx`, `SetupAlerts.jsx` — destructive-action confirmation and
  inline notice/error/busy states.

**Conclusion:** do not replace this system. Extend it, fix real inconsistencies,
and fill gaps below. A from-scratch rebuild would throw away work that already
matches the "modern, premium, consistent" bar the redesign brief asks for.

## Real gaps found

- [x] **No global toast/notification system.** Feedback today is per-page inline
      alerts (`SetupAlerts`). Fine for form save/error, but there's no ambient
      "action succeeded" feedback for actions taken outside a form context (row
      actions, bulk actions, background saves). → Added `ToastProvider` / `useToast`.
- [x] **No global search / command palette.** With 312 page components behind a
      mega-menu, jumping to a screen requires mousing through nav or using the
      per-menu search boxes (which only search menu labels, and are duplicated
      between `Sidebar.jsx` and `TopNav.jsx`). → Added Ctrl+K command palette,
      built on a shared `menuUtils.js` extracted from the duplicated flatten logic.
- [x] **Duplicated menu-flatten logic.** `TopNav.jsx` (`flattenCategoryItems`,
      `searchMenuItems`) previously duplicated this inline. Extracted into
      `utils/menuUtils.js`, now imported by both `TopNav` and `CommandPalette`.
- [x] **Dead shell layout.** `layouts/Sidebar.jsx` (classic left sidebar + hamburger)
      had zero imports anywhere in the codebase (`DashboardLayout.jsx` only renders
      `TopNav` + `Header`) — confirmed dead via repo-wide grep, then removed.
- [x] **Mixed styling approaches — checked, not a real gap.** Tailwind is installed
      but unused by the actual UI; every `btn btn-*` class used across the codebase
      (checked via grep) has a matching definition in `styles/base/_buttons.scss`.
      No missing/unstyled variants found. Left as-is — noted here only so a future
      pass doesn't assume Tailwind utilities work on these pages.
- [x] **Raw browser dialogs (`window.alert`/`window.confirm`) instead of the app's
      own UI.** Found in 6 files, 9 call sites — jarring, unstyled, and in the case
      of `window.confirm` un-cancelable-safely for destructive fee/user/schedule
      deletes. Replaced every one with `ConfirmModal` (destructive actions) or
      `useToast().error()` (the one plain error alert in `FeeDashboard.jsx`), each
      now also firing a success/error toast so the user gets confirmation the
      action actually happened. Files touched: `FeeDashboard.jsx`,
      `FeeDeleteApprove.jsx`, `AccountEditSetup.jsx`, `WebEventsScreen.jsx`,
      `StaffSetupPage.jsx` (×2), `StudentAttScreenPage.jsx` (×3).
- [x] **Recently-visited screens in the command palette.** Implemented — a
      `sessionStorage` ring buffer (last 6) shown when the palette opens with an
      empty query.

## Design system reference (existing — do not fork a second one)

- Tokens: `client/src/styles/theme.css` (`--cis-*` variables).
- Theme switching: `client/src/theme/ThemeContext.jsx`, `themePresets.js`.
- Buttons/forms/components: `client/src/styles/base/_buttons.scss`, `_forms.scss`,
  `_components.scss`, `_utilities.scss`.
- Shared chrome: `PageShell.jsx`, `DataTable.jsx`, `ConfirmModal.jsx`, `SetupAlerts.jsx`.
- New in this pass: `components/ToastProvider.jsx` (+ `styles/toast.css`),
  `components/CommandPalette.jsx` (+ `styles/command-palette.css`), `utils/menuUtils.js`.

## Implementation log

### Phase 1 — Audit (this doc)
- [x] Inspected shell, theme system, DataTable, PageShell, modals, alerts.
- [x] Identified genuine gaps vs. invented ones.

### Phase 2 — Toast notification system
- [x] `components/ToastProvider.jsx` — context + `useToast()` returning
      `{ show, success, error, info }`; auto-dismiss with pause-on-hover, stacked,
      `aria-live` region, dismiss button, respects `prefers-reduced-motion`.
- [x] `styles/toast.css` — uses existing `--cis-*` tokens (no new palette).
- [x] Wired `ToastProvider` around the app in `App.jsx` (available on every route,
      including outside the authenticated shell, e.g. login).
- [ ] Migrate existing per-page "notice" patterns to `useToast()` where it removes
      boilerplate (left as follow-up — call sites are numerous; not touched here to
      keep this diff additive-only).

### Phase 3 — Command palette (Ctrl+K)
- [x] `utils/menuUtils.js` — extracted `flattenCategoryItems`/`searchMenuItems`
      from `TopNav.jsx` (now imported, not duplicated).
- [x] `components/CommandPalette.jsx` — Ctrl+K / Cmd+K to open, arrow-key + Enter
      navigation, Escape to close, focus trap, searches the real menu (same data
      TopNav/Sidebar already have), shows category context per result.
- [x] `styles/command-palette.css`.
- [x] Wired into `DashboardLayout.jsx` (only mounts inside the authenticated shell,
      since it needs `menu`).
- [x] Discoverability: hint button in `TopNav` next to the existing search box.

### Phase 4 — Dead code + raw browser dialogs (this pass)
- [x] Removed `layouts/Sidebar.jsx` (confirmed zero imports repo-wide).
- [x] Spot-checked `btn btn-*` usage against `_buttons.scss` — fully covered,
      no fix needed.
- [x] Replaced all 9 `window.alert`/`window.confirm` call sites with
      `ConfirmModal`/`useToast` across 6 files (see gap list above for detail).
- [x] Recently-visited list added to the command palette.
- [x] Verified with a full `vite build` after every batch of changes (all clean).

### Remaining backlog (not started — sequenced for a future pass)

- [ ] Migrate remaining `SetupAlerts`-only pages to also fire a toast on save
      success, beyond the delete/confirm flows touched in Phase 4 (the bulk of
      form-save flows still only show the inline alert — that's fine for a form
      context, but worth a pass to check for actions with no visible feedback at
      all, e.g. some toolbar/table actions outside a form).
- [ ] Per-module accessibility pass (focus order, ARIA) beyond what's already in
      `DataTable`/`ConfirmModal`/`CommandPalette`/`ToastProvider`.
- [ ] Consider whether `styles/tailwind.css`/the Tailwind Vite plugin should be
      removed from `package.json` since nothing in the UI uses it (not done here —
      removing a build dependency is a slightly different risk class than adding
      components; flagged for a deliberate decision, not a silent deletion).

## Risks / constraints

- This is a live system backing a production college (fees, exam, student data).
  All changes above are **additive** (new components/files) or **extractions with
  identical behavior** (menuUtils) — nothing existing was rewritten in place,
  so regression risk is low. Verify manually per CLAUDE.md workflow before commit.
- Do not commit until the user reviews (per their explicit instruction this session).
