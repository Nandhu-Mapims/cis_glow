# 12 — Payroll

## 1. Module recap

Payroll is the largest modernized module — 37 client files under `client/src/pages/payroll/`
covering two parallel systems (staff/salary payroll and stipend payroll) that share UI patterns
but write to different tables. It spans read-only reports (dashboard, individual/consolidated/
group/salary-summary/salary-statement/monthly/tax reports), write-heavy batch generation screens
(Generate Payroll, Stipend Generate Payroll — both drive a per-staff/per-student AJAX loop with a
live progress bar), and 17 setup screens (payroll config, PF/ESI rates, staff salary bands,
advances/arrears/security-deposit add-and-close workflows, monthly deduction grids, payroll-close
gates). Full field-by-field detail, save payloads, and business rules:
[`../user-stories/12-payroll.md`](../user-stories/12-payroll.md).

---

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/Multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Payroll Dashboard | Native `<select>` (Month) | No | Single | — | Auto-loads report on month change (no separate Go click); print button; `dangerouslySetInnerHTML` report body |
| Individual Report | Native `<select>` (Month) + **native `<select multiple>`** (Category) + radio groups (Report type, Copy) + text input (Row Per Page) | No | Month single, Category multi | No | Go disabled until month+category+report-type all set; conditional Export XLS button (bank/PF/ESI); busy overlay "Exporting Excel…" |
| Individual Bundle | Native `<select>` (Month) + radio group (Copy) | No | Single | No | Simplest of the report screens; print via `reportRef.current.innerHTML` |
| Consolidated Report | **Native `<select multiple>`** (Months, required) | No | Multi | No | `size = min(8, max(4, monthOptions.length))`; report HTML split client-side into header/table/signature for independent horizontal scroll |
| Salary Summary | **Native `<select multiple>`** ×2 (Category 1, Category 2, `size=4` each) + paired text inputs (Title 1/2) | No | Multi (both) | No | Two independent category groups for a side-by-side comparison table |
| Salary Statement | Native `<select>` (Month) + **native `<select multiple>`** (Category, `size=5`) + text input (Row Per Page) | No | Category multi | No | One of the few report screens surfacing a server-supplied empty message, not just the client default |
| Group Report | **Native `<select multiple>`** ×2 (Months `size=5`, Category `size=5`) + radio group (Report type) | No | Multi (both) | No | Category disabled until months chosen |
| Generate Payroll | Native `<select>` (Month) + **`ChipMultiSelect`** (Category) + `<textarea>` (Staff ID, comma-separated) | Yes (`ChipMultiSelect`) | Category multi | Yes — Select all/Clear + Shift-click range-select (`ChipMultiSelect`) | Per-staff AJAX generation loop with live progress bar (`{n} of {total} Generated...`); month options color-flag already-generated categories; error text references a "Refresh" button that **does not render** on this screen (gap, see §3) |
| Att / Monthly / Tax Reports (`PayrollFilterReport`, shared component) | Native `<select>` (Month, or From/To Month for Monthly variant) + **native `<select multiple>`** (Category, `size=4`; Report Columns for Monthly, `size=4`) + radio group (Show, Att/Tax only) | No | Multi (category/columns) | No | One component parameterized by `title`/`apiPath`/`legacy`/`reportTypeField` drives all three screens |
| Payroll Setup Hub | Static tile grid | — | — | — | No API call |
| Cover Page Images | Per-row `type="file"` inputs in a table | — | — | — | Live thumbnail preview per row |
| Cron Email Setup | Native `<select>` (Cron Type) + checkbox (Status) + native `<select>` (Day) + editable grid with client-appended blank rows | No | Single | Row-level add (`+` button) / delete (`ConfirmModal`) | Not true bulk-select — per-row add/delete only |
| Payroll Group Setup / PF-ESI Rates | Native `<select>` (Payroll Type / Slab, incl. `add-new`) + plain text/number inputs + Yes/No `<select>`s | No | Single | No | Straightforward settings form |
| Staff Salary Setup | Radio group (Search by: Name/Staff ID/Category) + conditional native `<select>` or text input + scrollable color-coded staff-button list + editable salary-band table | No | Single (staff picker) | Row-level add (`+`) / delete (per-row confirm modal) | Color-coded result buttons (selected/no-current-salary/default); `Total` auto-sums client-side; money columns conditionally rendered as hidden inputs per Payroll Group Setup policy flags |
| Salary Advance / Security Deposit Add | Native `<select>`s (Staff, Type) + `type="month"` inputs + **`HoldMonthPicker`** (`ChipMultiSelect`) + **`SuretyStaffPicker`** (`ChipMultiSelect`, max-capped) + file upload | Yes (both pickers) | Multi (both pickers) | Yes (`ChipMultiSelect` inherited) | Hold-month options computed live from Detection-from + count; Surety picker capped at `data.maxSurety` |
| Salary Advance / Security Deposit Close | List: search inputs + native table + Edit/Delete row icons + `ConfirmModal`. Edit: Add-screen fields + Close checkbox revealing computed Close Amount | Yes — plain search inputs on list (Account No/Staff ID/month) | — | No | Close Amount is read-only, auto-computed (`computeCloseAmount()`), recalculates on Close Month change |
| Salary Arrear Add / Release | Same shape as Advance Add/Close, one fewer field (no Hold/Surety pickers) | Yes (list search) | — | No | — |
| Other Deduction / LOP / TDS / Cheque grids (`PayrollMonthlyGridSetup`) | Native `<select>`s (Month, Category) + per-staff grid of amount/reason/checkbox inputs | No | Single (filters) | No | One shared component parameterized per deduction type |
| Payroll Close / Stipend Payroll Close | Native `<select>` (Month) + checkbox (Complete) | No | Single | No | Overwrite-guard screen — completed months drop out of Generate Payroll's month dropdown |
| Stipend Hub | Static tile grid | — | — | — | No API call |
| Stipend Generate Payroll | Native `<select>` (Month) + **`ChipMultiSelect`** (Category, grouped by course type) + `<textarea>` (Register No) | Yes | Category multi | Yes (`ChipMultiSelect`) | Same AJAX-loop shape as Generate Payroll, but **does** render a visible Refresh button on step failure (see §3 contrast) |
| Stipend Att Report / Payroll Report / Salary Statement / Individual Report | Native `<select>` (Month) + **`ChipMultiSelect`** (Category) + radio group(s) | Yes | Category multi | Yes (`ChipMultiSelect`) | All four stipend report screens use `ChipMultiSelect`, unlike their staff-side siblings (see §3) |
| Stipend Individual PDF | Native `<select>` (Month) + radio group (Copy) | No | Single | No | 120-second explicit axios timeout with a dedicated timeout error message; password-protected download link on success |
| Stipend Setup: Amount / Deductions / Close | Native `<select>`s (Stipend Type / Month / Category with `<optgroup>`) + text input (Amount) or per-student grid | No | Single | No | — |

**Pattern summary across the 37 files:** the module splits cleanly along a "when was this built"
line. Screens built or touched more recently — Generate Payroll, all Stipend report/generate
screens, and the advance/deposit Hold-Month/Surety pickers — use `ChipMultiSelect` (search + bulk
+ range-select) uniformly. Screens that read as older/less-touched — every staff-side multi-month
or multi-category report filter (Individual Report, Consolidated Report, Salary Summary, Salary
Statement, Group Report, and the shared Att/Monthly/Tax component) — still use bare
`<select multiple>` with none of that. Single-value pickers (Month selects everywhere, staff-id
selects on setup screens) are uniformly plain native `<select>` with no search anywhere in the
module — unlike the Admin module, `SearchableSelect` is not used at all in Payroll, even though
Staff Salary Setup's staff lookup is exactly the kind of long-list single-pick scenario it was
built for.

---

## 3. Advanced feature gaps

1. **Staff-side report screens still use bare `<select multiple>`; the equivalent stipend-side
   screens already got `ChipMultiSelect`.** This is the payroll module's version of the admin
   module's `dept-auth` vs. `dept-auth-v1` split. `ChipMultiSelect` (read directly from
   `client/src/components/ChipMultiSelect.jsx`) already provides: a search box, a live "N
   selected" chip tray with per-chip remove buttons, **Select all / Clear** bulk actions, and a
   Shift-click range-select gesture matching native `<select multiple>` behavior — and it's
   already proven in production on `GeneratePayroll.jsx`, `StipendGeneratePayroll.jsx`,
   `StipendAttReport.jsx`, `StipendPayrollReport.jsx`, `StipendSalaryStatement.jsx`, and the
   advance/deposit `HoldMonthPicker`/`SuretyStaffPicker`. Yet the following six staff-side screens
   still use a plain `<select multiple>` with none of that: **Individual Report** (Category),
   **Consolidated Report** (Months), **Salary Summary** (Category 1 and Category 2, two
   instances), **Salary Statement** (Category), **Group Report** (Months and Category, two
   instances), and the shared **Att/Monthly/Tax Report** component (Category, and Report Columns
   for the Monthly variant). All of these consume the same `{value, label}` option shape
   `ChipMultiSelect` already expects — this is a component swap, not a data contract change, and
   it would fix the most tedious part of these screens: scanning an unsearchable, ctrl-click-only
   listbox to find "Accounts" or "December 2025" in a payroll category/month list that only grows
   over time.
2. **Generate Payroll's failed-step error message references a "Refresh" button that doesn't
   exist on that screen.** `user-stories/12-payroll.md` §3.9 documents the exact gap: the error
   text reads *"Generation failed — use Refresh to retry from last row"*, but unlike
   `StipendGeneratePayroll.jsx` (which renders a real `btn-default btn-xs` **Refresh** button
   wired to `handleRefresh()`/`resumeIndex`), the staff-side screen has no such button rendered.
   Since `StipendGeneratePayroll.jsx` already has the working resume-from-last-row logic, porting
   it to `GeneratePayroll.jsx` is a proven-pattern copy, not new design.
3. **Single-value staff/category pickers on setup screens have no search either.** `staff_id`
   selects on Salary Advance Add, Salary Arrear Add, Security Deposit Add, and the disabled
   `staff_id` shown on the three Close/Release edit screens are plain native `<select>`s — for a
   college with hundreds of staff, `SearchableSelect` (already used extensively in the Admin
   module) would be a direct drop-in single-value upgrade with zero multi-select complexity.
4. **No dedicated large-cohort safeguard on the staff-side bundle/individual-report PDF paths.**
   `user-stories/12-payroll.md` §5.7 explicitly calls out that `StipendIndividualPdfReport.jsx`
   has a 120-second axios timeout and a tailored timeout error message, but
   `PayrollIndividualBundle.jsx` and `PayrollIndividualReport.jsx` use the default axios timeout
   with no equivalent handling — a real gap for a large staff cohort's Export XLS or bundle
   generation, mirroring a safeguard that already exists one screen-family over.
5. **Cron Email Setup's recipient grid has no bulk actions**, only per-row **+** (add blank row)
   and per-row **Delete** (with a `ConfirmModal`) — for a payroll office that emails reports to a
   dozen recipients, there's no "add multiple at once" or "remove all" shortcut, unlike the
   `ChipMultiSelect`-backed pickers elsewhere in the module that get Select all/Clear for free.
6. **Staff Salary Setup's staff-search radio (Name / Staff ID / Category) swaps between a text
   input and a native `<select>` depending on the chosen mode**, but neither mode offers the kind
   of instant substring search `SearchableSelect` provides — Name/Staff-ID search requires typing
   the full value and clicking **Go** (a server round-trip), and Category mode is a plain
   unsearched `<select>`. For the highest-friction setup screen in the module (18KB of JSX, the
   single largest payroll setup file), this is the screen most likely to benefit from a faster
   staff-lookup pattern.
7. **Salary Advance/Arrear/Security Deposit Close-list search is three separate plain text/date
   inputs (Account No, Staff ID, month) with an explicit Search button**, not a unified
   `SearchableSelect`-style staff picker — functionally fine for an exact-match account/staff-ID
   lookup, but there's no "start typing a name" path the way there is throughout the Admin module.
8. **The staff-side report screens (§3.1) and the setup-screen category/month pickers use
   inconsistent `size` conventions even within native `<select multiple>` itself** — e.g. Individual
   Report Category is `Math.min(6, Math.max(3, categoryOptions.length || 3))`, Salary Summary is a
   flat `size={4}`, Group Report is `size={5}` for both fields, Consolidated Report is
   `Math.min(8, Math.max(4, monthOptions.length))`. None of this matters once these are migrated to
   `ChipMultiSelect` (gap 1), but it's worth noting as evidence the staff-side screens were built
   at different times with no shared sizing convention, unlike the stipend-side screens which
   converged on one component.

---

## 4. User-experience suggestions

- **Bulk payroll generation progress indicator with per-row status, not just a percentage bar.**
  Both Generate Payroll and Stipend Generate Payroll already show a `{current} of {total}
  Generated...` label and a progress bar, but the appended `<tr>` rows give no persistent signal
  of *which* staff/students succeeded vs. are still pending once the loop is mid-flight and the
  admin has scrolled away — a sticky mini-summary ("142 done / 3 failed / 55 pending") anchored
  near the Generate button would let a payroll officer glance back at a long-running batch without
  scrolling to the table, which matters most on a full-department run that can take minutes.
- **Inline validation before generating — catch zero-attendance staff before submit, not after.**
  `user-stories/12-payroll.md` §5.6 documents that a staff/student with zero attendance records
  simply generates a payroll row showing 0% attendance and full LOP, with no warning surfaced
  anywhere in the UI before or during generation. Since `resolveStaffForGenerate()` already knows
  the staff list before the AJAX loop starts, a pre-flight check (comparing against attendance
  device logs, or simply flagging staff with literally zero attendance rows for the month) that
  renders a "3 staff have no attendance records this month — check devices before generating"
  banner *before* the Generate button is clicked would let a payroll officer catch a broken
  attendance device or a missing punch-in integration before 200 payroll rows are silently created
  with 0% attendance, rather than discovering it later in the Individual Report.
- **A comparison view between Consolidated Report and Individual Report totals.**
  `user-stories/12-payroll.md` §5.5 documents a real reconciliation trap: the Consolidated Report
  sums `staff_payroll_tb` per month with no filter, while the Individual Report's bank/PF/ESI
  exports filter by `net_pay > 0` / `pf_amount > 0` / `esi_amount > 0` — so a staff member with a
  generated row but zero net pay (fully absorbed by deductions) is silently in one total and
  absent from the other, with no UI explanation for the mismatch. A small "Consolidated total: ₹X
  · Bank-export total: ₹Y · N staff excluded (zero net pay)" reconciliation line on the
  Consolidated Report would turn a confusing, support-ticket-generating discrepancy into a
  self-explanatory number, without requiring a payroll officer to know the underlying filter logic.
- **Autosave for long report filter forms.** Screens like Group Report and the Att/Monthly/Tax
  triad have multiple required multi-selects (months, category, report type) that reset on
  navigation — losing a carefully-built filter set (e.g. 6 selected months + a specific category
  subset) to an accidental back-navigation or tab close is a real annoyance on the screens with the
  most filter state. Persisting the last-used filter set per screen (localStorage, keyed by
  screen+user) so returning to the same report pre-fills the prior selection would save
  re-selecting the same recurring monthly filter set every time.
- **Surface the "already generated" cue more prominently on Generate Payroll's Category picker,
  not just a background color.** `user-stories/12-payroll.md` §4.5 documents that
  `data.categoryOptions[].generated` drives a green `<option style>` background and a
  `ChipMultiSelect` "(generated)" note — but nothing in the flow actually *blocks* or *confirms*
  re-submission (§5.4), meaning `runGeneratePayrollMore` silently overwrites the prior attendance
  snapshot on re-generate. Since Payroll Close is the only hard guard, a lightweight confirm
  dialog ("Category X was already generated for this month — regenerating will overwrite the
  existing attendance-derived data. Continue?") when a flagged category is selected would close
  the gap between "visually flagged" and "actually protected" without needing the heavier
  Payroll Close workflow for every accidental re-run.
- **Consistent Refresh-on-failure UX across both generation screens.** Porting
  `StipendGeneratePayroll.jsx`'s working Refresh button to `GeneratePayroll.jsx` (see §3.2) is
  also a direct UX win: today a failed step on the staff-side screen leaves the payroll officer
  with no recovery path other than reloading the whole screen and re-selecting month/category/
  staff, potentially re-processing already-completed rows.
- **Auto-computed Close Amount deserves an inline explanation, not just a read-only field.**
  Salary Advance Close, Salary Arrear Release, and Security Deposit Close all show a computed
  Close Amount (`computeCloseAmount()` — proportional to elapsed months minus hold months) as a
  plain read-only number with no visible breakdown. A small inline expansion ("6 months elapsed −
  1 held month × ₹X/month = ₹Y") next to the field would let an accounts admin sanity-check the
  number before approving a close, rather than trusting an opaque calculation — this matters most
  here because these are financial close-out actions with no undo.
- **Recipient bulk-add for Cron Email Setup.** Given the screen already supports per-row add/
  delete, accepting a pasted comma- or newline-separated list of emails (parsed into rows
  client-side) alongside the existing one-row-at-a-time **+** button would remove the most tedious
  part of onboarding a new distribution list.
- **A faster staff-lookup on Staff Salary Setup.** Swapping the Category-mode `<select>` for
  `SearchableSelect`, and adding live-as-you-type filtering to the Name/Staff ID search modes
  (debounced, without waiting for an explicit **Go** click) would shorten the highest-friction
  lookup flow in the module — this screen is opened every time a staff member's salary band
  changes, which is a recurring task, not a one-off.
- **Surface the payroll-close state directly on report screens, not just on Generate Payroll.**
  Today "is this month locked" is only visible via the Payroll Close screen's own checkbox state
  and indirectly via which months appear in Generate Payroll's dropdown. Showing a small "Closed"
  badge next to closed months on the Dashboard, Individual Report, and Consolidated Report month
  pickers would help a payroll officer immediately understand why a given month's data is final
  without having to cross-reference the separate Payroll Close screen.

---

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Port `StipendGeneratePayroll.jsx`'s Refresh button + `resumeIndex` resume logic onto
  `GeneratePayroll.jsx` — the pattern already exists and works one screen over.
- Swap the six staff-side `<select multiple>` report filters (Individual Report, Consolidated
  Report, Salary Summary ×2, Salary Statement, Group Report ×2, Att/Monthly/Tax Category) for
  `ChipMultiSelect` — component and option contract already match what stipend screens use.
- Swap `staff_id` native `<select>`s on Salary Advance/Arrear/Security Deposit Add for
  `SearchableSelect` — direct drop-in, same single-value contract, already proven across the
  Admin module.
- Add a reconciliation line ("N staff excluded — zero net pay") to the Consolidated Report,
  reusing the same `net_pay > 0` filter logic the bank-export path already computes.
- Add an axios timeout + tailored timeout error message to `PayrollIndividualBundle.jsx` /
  `PayrollIndividualReport.jsx`, mirroring `StipendIndividualPdfReport.jsx`'s existing
  `PDF_GENERATE_TIMEOUT_MS` pattern.
- Add a `ConfirmModal` before Generate Payroll's Generate action when the selected category is
  already flagged `generated` — reuses the existing `ConfirmModal` component and the
  already-computed `generated` flag, no new backend logic.
- Inline breakdown text next to Close Amount on Salary Advance Close / Arrear Release / Security
  Deposit Close — `computeCloseAmount()`'s inputs (elapsed months, held months, per-month rate) are
  already in client state; just render them.

**Bigger investments (needs design/product buy-in first):**
- Pre-flight zero-attendance validation banner on Generate Payroll / Stipend Generate Payroll —
  needs a new check against attendance device data before the generation loop starts, plus UI/copy
  design for how prominently to warn (blocking vs. advisory).
- Confirm-before-regenerate dialog for already-generated categories — needs a product decision on
  whether this should be a soft confirm (quick win above) or a harder guard closer to Payroll
  Close's semantics (e.g. requiring a typed confirmation for categories with hand-adjusted data).
- Persistent per-screen filter autosave (localStorage-backed) across all multi-filter report
  screens — needs a shared hook/pattern chosen once (not a per-screen bespoke implementation) plus
  a decision on staleness (e.g. do saved months become irrelevant after a payroll-close?).
- Sticky per-batch generation status summary (done/failed/pending counts) — needs new client-side
  state tracking across the AJAX loop, shared between the staff and stipend generate screens.
- Faster staff-lookup redesign for Staff Salary Setup — the largest, highest-traffic setup screen
  in the module; worth a dedicated design pass rather than a component swap, since its three search
  modes (Name/Staff ID/Category) and color-coded result list are bespoke to this screen.
- Payroll-close status badges surfaced on report-screen month pickers — needs the month-options
  payload extended with a `closed` flag on every report endpoint that currently only returns
  `{label, value}`, not just the Generate Payroll / Payroll Close endpoints that already have it.
