# 02 — Dashboard — Frontend Control & UX Audit

## 1. Module recap

See [user-stories/02-dashboard.md](../user-stories/02-dashboard.md) for the full pixel-level
flow. The Dashboard module is the post-login landing surface: `/dashboard`
(`client/src/pages/Dashboard.jsx`) shows a per-user grid of attendance/roster **widgets**
(`DashboardWidgetCard`) for a chosen date, plus a hub (`/dashboard/hub`) linking out to
Student Dashboard, Staff Pattern, Overall/Community Strength reports, and the Log dashboard.
Widget content is raw legacy HTML injected via `dangerouslySetInnerHTML` and rendered inside a
modern card chrome with collapse/expand, a headline badge, and (for one widget) a bar chart.
This module has almost no traditional form controls — its "input surface" is a date picker,
three academic-year `<select>`s on two screens, and a set of expand/collapse/refresh buttons.
Because so much of the module's actual data rendering happens server-side (raw HTML strings
per widget, not structured JSON the client renders itself), most of the audit below focuses on
the handful of *interaction* controls that do exist (date, refresh, expand/collapse, year
pickers) rather than on data-entry forms, which this module simply doesn't have — it is a
read-only reporting surface, not a setup/CRUD module like [04-settings.md](04-settings.md).

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `/dashboard` — date picker | Native `<input type="date">`, `max=todayIso()` | — | single date | — | 400ms debounce before reload; "Today" button; future dates blocked at the picker level, not just server-side. |
| `/dashboard` — Refresh panels | Native `<button>` | — | — | — | Label flips to "Updating…"; disabled while in flight; bypasses both client cache (`ttlMs:0`) and the 90s server-side widget cache (`cRefresh=1`) — a genuine force-refresh, not just a re-fetch of possibly-cached data. |
| `/dashboard` — Expand all / Collapse all | Native `<button>` pair | — | bulk toggle of every card | Yes — this is the module's only real "bulk action," and it's a UI-state bulk action (no server call), not a data-mutating one | Increments a tick counter every `DashboardWidgetCard` listens for; `staff_unit` is excluded (always expanded, no toggle). |
| Per-widget collapse toggle | Custom chevron `<button aria-expanded>` | — | single card | — | Starts collapsed for every widget except `staff_unit`; toggling swaps a `visually-hidden` label ("Expand panel"/"Collapse panel"). |
| `/dashboard/hub` | Static link cards (`ModuleHub`) | — | — | — | No API call at all — pure navigation, zero interactive state. |
| `/dashboard/student`, `/dashboard/staff-pattern` — date/refresh | Same date `<input>` + refresh `<button>` pattern as `/dashboard` | — | — | — | No client-side cache here (`DashboardWidgetShell` does a plain `await`, unlike `/dashboard`'s `idbCache` stale-while-revalidate wrapper) — every date change or refresh is a full round trip with no instant cache paint. |
| `/dashboard/student` — academic year pickers | Three **native `<select>`** (U.G Regular / U.G Additional / P.G) | No | single value each | No | Options are year-range strings (e.g. "2024-2025") sourced from `yearOptions`; changing any one re-fetches shell + widgets. This is the one place in the module where a `SearchableSelect` upgrade would be relevant if the year list ever grows long — see §3. |
| `/dashboard/overall-strength`, `/dashboard/community-strength` | Read-only legacy `<table>` HTML + one **Print** button | — | — | — | No filter controls at all on these two report screens — the table always reflects the server's current reference year; Print opens a new window via `printReportHtml`. |
| Widget: `staff_current` ("who's teaching right now") | Legacy inline `HH:MM` text input + "Go" button (raw HTML, not React) | — | — | — | **Not a real control** in the modern sense — it's legacy markup wired to a legacy `onclick="callStaffCurrent()"` handler that has no React state behind it; inert unless the old JS asset happens to be loaded (US-D18). Flagged as a gap, see §3. |
| Identity strip (`ID`/`Role`/`Panels`) | Read-only `<dl>` metadata, no control | — | — | — | Included because "Panels {loaded}/{total}" is the only place a user can see their widget-assignment count at a glance — worth noting for the tooltip suggestion in §4. |
| `DashboardWidgetCard` badge extraction | Read-only, regex-derived from raw legacy HTML (`extractBadge`) | — | — | — | Not a control, but worth flagging as a fragile pattern: the headline count/pair badge is parsed out of server-rendered HTML via regex matching on CSS class names (`rev-combo`, `.degree`) rather than a structured field the server returns — a legacy markup change could silently break the badge with no error, only a missing number. |
| `DeptStaffingChart` (`staff_unit` widget only) | Read-only HTML/CSS bar chart, no interactive control | — | — | — | The only chart in this module; no tooltip-on-hover or click-to-drill documented — purely a static visual summary above the raw table. |

There is no `CheckListSelect`, no `SearchableSelect`, no multi-select, no checkbox grid, no
drag-reorder, and no file upload anywhere in this module. The three academic-year dropdowns on
`/dashboard/student` are the only `<select>` elements in the whole module.

**Loading-state pattern worth noting for §4:** this module already runs two different loading
treatments side by side — a full-page `<PageLoading message="Opening your register…" />` on
first paint with no cache, versus a per-card 3-bar skeleton stack inside `DashboardWidgetCard`
once the shell itself has resolved. This dual pattern (page skeleton → per-card skeleton) is
actually a reasonably good model other modules in this app could point to, since it avoids the
common anti-pattern of one giant spinner blocking an otherwise-ready page — worth calling out
explicitly because [01-auth-session.md](01-auth-session.md) and
[03-navigation-menu.md](03-navigation-menu.md) both flag the opposite pattern (one blocking
spinner for their entire shell) as a gap in their own modules; Dashboard is the one screen in
this batch that already does per-component granular loading correctly, and is a reasonable
reference implementation to point future skeleton-loading work at.

## 3. Advanced feature gaps

1. **The three academic-year `<select>`s on `/dashboard/student` have no search**, and while
   the current year lists are short, this is the exact "small native `<select>`" pattern that
   `SearchableSelect` (`client/src/components/SearchableSelect.jsx`) was built to drop in
   without changing the value/onChange contract — worth pre-emptively swapping if the
   institution ever starts keeping >10 years of academic-year history selectable here, since
   the component already exists and is proven in Admin/Fee screens.
2. **`staff_current`'s inline time-picker is dead on arrival** (US-D18) — it's raw legacy HTML
   with a legacy `onclick` handler, not a React control, so it silently does nothing in the
   modern app. Every other "change a parameter and reload" interaction in this exact module
   (`/dashboard`'s date input, the year selects) already has a proven React pattern
   (controlled input → debounced/explicit reload) that this widget alone doesn't use — it's
   the one leftover non-interactive control hiding inside an otherwise fully modern widget
   deck.
3. **No per-widget retry** — when a widget group times out, the whole-page "N panels took too
   long to load — try refreshing" banner re-fetches *every* group, not just the failed one
   (US-D26). The module already has group-scoped `Promise.allSettled` tracking
   (`failedGroups`) internally — the data needed to offer a scoped retry button already
   exists, it's just not exposed as a per-card action the way `DashboardWidgetCard`'s
   per-card collapse toggle already demonstrates granular per-card controls are entirely
   feasible in this codebase.
4. **No bulk "assign widgets to me" self-service** — the empty state ("No panels assigned")
   only links to `/admin/setup/dashboard-access`, a full admin screen, for what is
   fundamentally a personal preference (which widgets I see). Contrast with
   `CheckListSelect`'s proven "Select all / Clear" bulk-toggle pattern already used elsewhere
   in the app for exactly this kind of "pick items from a list" interaction — dashboard widget
   assignment is architecturally the same shape of problem (pick N of M named items) and could
   reuse the identical component if a self-service "customize my dashboard" screen were ever
   built.
5. **The badge-extraction regex (`extractBadge`) is a fragile read-only "control" with no
   fallback UI proven elsewhere in the module.** Other widgets in this same deck (e.g. the
   `staff_unit` widget's `chart` payload) already demonstrate the better pattern — a
   structured JSON field (`{type, rows}`) the client renders deterministically — while the
   badge count on every *other* widget is scraped from HTML class names, meaning a change to
   the legacy table markup on the server side could silently zero out a badge with no error
   surfaced anywhere in this module.
6. **Print button gating exists nowhere in this module except as a documented gap** (US-D20) —
   `DashboardWidgetCard`'s "Nothing to show" empty state already demonstrates the app knows how
   to represent "no data yet" distinctly from "data present"; the Strength report Print button
   doesn't reuse that same distinction before allowing a click.

## 4. User-experience suggestions

1. **Add a per-widget "Retry" action on failed groups**, not just the page-level banner. Why
   it helps: on a high-enrollment date, `staff_attendance` can legitimately be the slow group
   while everything else already loaded — forcing a full-page refresh to retry one group
   re-requests data the user already has, wasting the 90s server cache window they just paid
   for, and increasing perceived latency for no reason (US-D26 already documents this as a
   known limitation).
2. **Wire `staff_current`'s time input to real React state** (or replace it with the same
   debounced-input pattern the date picker above it already uses). Why it helps: this is the
   one widget on the whole dashboard that looks interactive but isn't — a user who tries the
   `HH:MM` + "Go" control gets silent non-response, which reads as a bug rather than a
   migration gap, actively eroding trust in the rest of the (correctly working) dashboard.
3. **Replace the plain "Expand all/Collapse all" pair with a small persisted preference**
   (localStorage: "always show my panels expanded"). Why it helps: users who habitually expand
   everything (e.g. an HOD who wants full detail on every visit) currently re-click "Expand
   all" on every single dashboard load — the state is UI-only and already recomputed from
   scratch each mount, so persisting the last chosen mode is a small addition with daily
   repeat-value for power users.
4. **Give the Print buttons on Strength reports a disabled/guarded state when `data` hasn't
   loaded** instead of allowing a click that opens a print window with an empty table
   (US-D20). Why it helps: an admin who prints before the report finishes loading currently
   gets a near-blank printed page with just a heading — a one-line `disabled={!data?.tableHtml}`
   guard (or a "Report still loading — please wait" tooltip) prevents wasted paper/confusion,
   and this is a screen admins specifically use for physical/PDF handoffs where a blank
   printout is a real annoyance, not just a UI nit.
5. **Add a lightweight tooltip/help icon next to "Panels {loaded}/{total}"** in the identity
   strip explaining what determines a user's assigned panel count, linking to
   "Ask an administrator to assign widgets" the same way the empty state already does. Why it
   helps: a partially-loaded state (e.g. "6/10") currently gives no indication of *why* 4 are
   missing — assigned-but-failed-to-load vs. simply not-assigned look identical in this counter
   today, and a hover explanation removes a guessing step for the common "why don't I see
   widget X" support question.
6. **Mobile responsiveness check on the mega date/refresh control row** — `/dashboard`'s
   register-controls row packs a date input, "Today" button, "Refresh panels" button, and an
   "All dashboards" link into one row; on narrow viewports this is exactly the kind of control
   cluster that benefits from an explicit stacked/wrapped layout audit, since the widget grid
   below it already appears to be designed responsively (`cis-widget-grid`) but the controls
   strip above it is not documented as such.
7. **Surface `idbCache` staleness explicitly** — right now a returning user can see a
   90-second-old (today) or long-TTL (past dates) cached shell silently swapped for fresh data
   with no visible transition; a subtle "Updated just now" pulse (the module already has a
   `statusNotice` transient-message mechanism for date changes — reuse it) after a background
   `onFresh` replace would make the stale-while-revalidate behavior legible instead of
   invisible, especially useful for the Refresh-panels use case where users are explicitly
   checking for new data.
8. **Empty-state guidance on `DashboardWidgetShell` screens should match `/dashboard`'s** — the
   Student Dashboard and Staff Pattern shells currently show the same "No panels assigned" copy
   but *omit* the "Open dashboard access" CTA button that `/dashboard` has (US-D11). Why it
   helps: a user landing on Staff Pattern with zero widgets has no next step at all today,
   whereas the near-identical `/dashboard` empty state already solved this — a one-line prop
   addition brings parity.
9. **Replace `extractBadge`'s regex scraping with a structured badge payload from the server**
   (mirroring the `chart: {type, rows}` contract `staff_unit` already uses). Why it helps:
   directly closes gap #5 — a structured `{label, value}` badge field would be immune to future
   legacy-HTML markup drift, and the module already has a proven precedent
   (`widgetDispatcher.js`'s `splitResult()`) for shipping structured metadata alongside raw
   widget HTML, so this is extending an existing contract rather than inventing a new one.
10. **Add hover tooltips to `DeptStaffingChart`'s bars** showing the exact
   sanctioned/available/vacant/surplus numbers per department. Why it helps: the chart caption
   already explains the visual encoding ("Bar is available faculty, the marker is the
   sanctioned norm...") but the precise numbers are only visible by scrolling down to the raw
   table below — a hover tooltip lets an HOD get the exact figure without leaving the chart,
   which is the whole point of pairing a chart with a table in the first place.
11. **Add a small loading-state distinction between "first ever load" and "refresh of already-
   visible data"** — currently both states can show similar loading treatment (page spinner vs.
   per-card skeleton depending on cache state), and the boundary between them isn't always
   obvious to the user. Why it helps: a returning user hitting "Refresh panels" on data that's
   already on screen benefits from a *subtler* in-place loading indicator (e.g. a dimmed
   overlay on existing cards) rather than the full first-load skeleton treatment, so they don't
   lose their place or think the whole page reset.
12. **Keyboard shortcut for "Refresh panels"** (e.g. `R` when no input is focused), mirroring
   the app's existing investment in keyboard-drivable UI elsewhere (the command palette's full
   arrow-key navigation, see [03-navigation-menu.md](03-navigation-menu.md)). Why it helps: this
   is the single most-repeated action on the dashboard's busiest screen for admins checking
   attendance throughout the day — a keyboard shortcut removes a mouse trip for a very
   high-frequency action.

## 5. Quick wins vs. bigger investments

**Small diff, immediate win:**
- Disable/guard the Strength-report Print button when `tableHtml` is empty (#4) — a single
  conditional in `StrengthReportPages.jsx`.
- Add the missing "Open dashboard access" CTA to `DashboardWidgetShell`'s empty state (#8) —
  copy/prop parity fix with `Dashboard.jsx`'s existing empty state.
- Persist "always expanded" preference via localStorage (#3) — client-only, no API change.
- Add the "Panels {loaded}/{total}" tooltip (#5) — copy/markup only.
- Add hover tooltips to `DeptStaffingChart`'s bars (#10) — a `title` attribute or small
  tooltip component on already-rendered SVG/CSS bars, data already present in `chart.rows`.
- Add a keyboard shortcut for "Refresh panels" (#12) — a single `keydown` listener scoped to
  the dashboard route, no API change.

**Needs design/product buy-in:**
- Per-widget retry on failed groups (#1) — needs UI design for where the retry action lives on
  a card that never fully rendered, plus care around the existing 90s server cache semantics.
- Rewiring `staff_current`'s time control to React (#2) — a real feature port, not a tweak;
  needs someone to confirm the legacy `callStaffCurrent()` behavior precisely before
  reimplementing it natively (this is exactly the kind of screen CLAUDE.md's "open the legacy
  PHP first" rule applies to).
- Visible stale-while-revalidate indicator (#7) — needs a design decision on how prominent a
  "data updated" signal should be without becoming noisy on every date change.
- Mobile layout audit of the register-controls row (#6) — needs actual device/breakpoint
  testing, not just a CSS guess.
- Structured badge payload replacing `extractBadge`'s regex (#9) — a server-side contract
  change across every native widget handler in `widgetDispatcher.js`, not a one-file client fix.
- Distinct first-load vs. refresh loading treatment (#11) — needs a UX decision on what
  "in-place refresh" should look like across every widget card, not just a spinner swap.
