# CIS Practical Flow — Frontend Feature & UX Audit (by module)

> Companion to [../user-stories/](../user-stories/) (which documents *what each screen does*,
> field-by-field). This folder documents *how each screen behaves as an interface* — which input
> controls are used, which ones already have search/multi-select/bulk-select/toggle behavior,
> which ones are missing it, and concrete, screen-specific suggestions for a better user
> experience. Read the matching `user-stories/NN-*.md` file first — these files build directly on
> top of that pixel-level research rather than re-deriving it.

## Why this exists

The app has several different "pick from a list" patterns already living side by side:

| Pattern | Component | Search? | Multi-select? | Bulk actions? |
|---|---|---|---|---|
| Native `<select>` | plain HTML | No (browser type-ahead only) | No | No |
| Native `<select multiple>` | local `MultiSelect` helpers (several modules still have their own copy) | No | Yes (ctrl/cmd-click) | No |
| `SearchableSelect` | `client/src/components/SearchableSelect.jsx` | Yes (substring, portal dropdown) | No (single value) | No |
| `CheckListSelect` | `client/src/components/CheckListSelect.jsx` | Yes (when options.length > 8) | Yes (checkbox rows) or single (radio rows) | Yes — "Select all" / "Clear" |
| Checkbox grid (menu auth, role manager, staff auth) | inline JSX, uncontrolled `defaultChecked` or controlled state | No | Yes | "Check all" / "Clear all" (per-screen bespoke) |
| Drag-reorder | `client/src/hooks/useDragReorder.jsx` | — | — | — |

This is genuinely uneven: some screens got the newer `CheckListSelect` treatment
(`DeptAuthSetup.jsx`), others still use a bare `<select multiple>` from years earlier
(`DeptAuthV1Setup.jsx`, `CommitteeAccessSetup.jsx`). Each file in this folder calls out, screen by
screen, which pattern is in use today and where upgrading it would measurably help.

## File template each module follows

1. **Module recap** — one paragraph, link back to the matching `user-stories/NN-*.md` file.
2. **Frontend control inventory** — a table, one row per screen: control type(s) used
   (native select / `SearchableSelect` / `CheckListSelect` / checkbox grid / plain multi-select /
   file upload / drag-reorder / etc.), whether it has search, whether it's single or multi-select,
   whether bulk actions (select-all/clear/toggle-all) exist, and any other interaction detail
   (inline edit, confirm modal, toast, pagination).
3. **Advanced feature gaps** — screens that would clearly benefit from a control upgrade already
   proven elsewhere in the app (e.g. "this native `<select multiple>` of 40 items has no search —
   `CheckListSelect` already solves this exact problem two screens over"). Concrete, not generic.
4. **User-experience suggestions** — screen- or module-specific UX improvements: bulk operations,
   inline validation, autosave, keyboard shortcuts, skeleton loading, empty-state guidance,
   optimistic updates, confirmation patterns, accessibility, mobile responsiveness, etc. Each
   suggestion says *why* it helps for that specific screen, not a generic checklist.
5. **Quick wins vs. bigger investments** — a short prioritized list splitting suggestions into
   "small diff, immediate win" vs. "needs design/product buy-in first."

## Status

| # | Module | File | Status |
|---|---|---|---|
| 01 | Auth & Session | [01-auth-session.md](01-auth-session.md) | done |
| 02 | Dashboard | [02-dashboard.md](02-dashboard.md) | done |
| 03 | Navigation & Menu | [03-navigation-menu.md](03-navigation-menu.md) | done |
| 04 | Settings | [04-settings.md](04-settings.md) | done |
| 05 | Students | [05-students.md](05-students.md) | done |
| 06 | Staff | [06-staff.md](06-staff.md) | done |
| 07 | Attendance | [07-attendance.md](07-attendance.md) | done |
| 08 | Fees | [08-fees.md](08-fees.md) | done |
| 09 | Academic | [09-academic.md](09-academic.md) | done |
| 10 | Exam | [10-exam.md](10-exam.md) | done |
| 11 | Admin (accounts/access/security) | [11-admin.md](11-admin.md) | done |
| 12 | Payroll | [12-payroll.md](12-payroll.md) | done |
| 13 | Library | [13-library.md](13-library.md) | done |
| 14 | Hostel | [14-hostel.md](14-hostel.md) | done |
| 15 | Committee | [15-committee.md](15-committee.md) | done |
| 16 | Certificates | [16-certificates.md](16-certificates.md) | done |
| 17 | NAAC | [17-naac.md](17-naac.md) | done |
| 18 | Portfolio | [18-portfolio.md](18-portfolio.md) | done |
| 19 | E-learning | [19-elearning.md](19-elearning.md) | done |
| 20 | SMS / Communication | [20-sms.md](20-sms.md) | done |
| 21 | Web CMS | [21-web-cms.md](21-web-cms.md) | done |
| 22 | TV & Kiosk displays | [22-tv-kiosk.md](22-tv-kiosk.md) | done |
| 23 | Circular | [23-circular.md](23-circular.md) | done |
| 24 | Admin Office | [24-admin-office.md](24-admin-office.md) | done |
| 25 | Files (upload/download) | [25-files.md](25-files.md) | done |
| 26 | Print & Reports (cross-cutting) | [26-print-reports.md](26-print-reports.md) | done |
