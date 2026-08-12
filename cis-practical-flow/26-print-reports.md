# 26 — Print & Reports (cross-cutting)

## 1. Module recap

Not a standalone module — this is the shared print/report **pattern** used by ~20+ setup/report
screens across nearly every module to reproduce legacy PHP's "click Print → new browser window
with legacy-styled HTML → `window.print()`" behavior. A server service builds an HTML string
(`printHtml`/`reportHtml`); the client either renders a generic `<ReportPrintBar>` button or
calls a dedicated print helper directly; `printReportHtml()` in `client/src/utils/printReport.js`
opens the popup, writes the HTML wrapped in mode-specific CSS, and fires `.print()`. The full
20+-mode dispatch table, `openPrintWindow()` internals, the `noopener` constraint, the
`presetWin` synchronous-open pattern, and all the edge cases are already documented in
[user-stories/26-print-reports.md](../user-stories/26-print-reports.md) — this file audits the
**input controls** surrounding that print mechanism (how the user triggers/configures a print,
not the print engine's internal HTML plumbing), per the README's cross-cutting guidance.

Core files: `client/src/components/ReportPrintBar.jsx`, `client/src/utils/printReport.js`.

## 2. Frontend control inventory (shared pattern + representative modules)

There is exactly one reusable **control** in this pattern — the Print button
(`<ReportPrintBar>` or a bespoke `<button>` calling a dedicated print helper). Everything else
that varies per screen is the filter/date-range form that determines what gets printed, which is
each module's own concern (already audited per-module in files 01–24 of this folder). This
inventory focuses on the print-trigger control itself and its immediate surroundings.

| Pattern | Where it appears | Control | Visible when no data? | Confirms before opening popup? | Feedback on popup-block? |
|---|---|---|---|---|---|
| Generic `<ReportPrintBar>` | 20 files via `grep -l ReportPrintBar client/src/pages -r` (Academic subject/timetable/curriculum reports, Library Resources Report, Payroll consolidated report, and others) | `<button className="btn btn-outline-secondary btn-sm">` inside a `<div className="cis-print-bar">` | **No** — component returns `null` entirely if `html` is falsy | No — one click opens the popup and triggers print immediately | `window.alert('Unable to open the print window. Please allow popups for this site.')`, fired from inside `printReportHtml`, not the button component itself |
| Disabled-button variant | e.g. Library's Book Report screen (per [13-library.md](13-library.md) §3.5) | Same `<button>` shape but kept visible with `disabled={!data?.printHtml}` instead of unmounting | **Yes, but disabled** — inconsistent with the `ReportPrintBar` default hide-on-empty behavior | No | Same shared alert |
| Toolbar-triggered print (bypasses `ReportPrintBar`) | Exam Dashboard (`ExamDashboard.jsx`) | A toolbar action button that calls `buildExamDashboardPrintHtml()` then `printReportHtml(body, 'exam-dashboard')` directly | Depends on toolbar's own visibility logic, not the shared component's guard | No | Same shared alert |
| Dedicated print functions (own button, own layout) | Fee slip/pending-letter screens, ID card screens, `CircularPrintSetup.jsx`'s per-row Preview → Print | A `<button className="btn btn-sm btn-outline-primary">Print</button>` (or similar) calling `printFeeSlip(html)` / `printAlumniIdCard(html)` / `printCircularPreview({...})` directly, bypassing the `mode` switch | Varies per screen | No | Same shared alert (all six dedicated functions still funnel through `openPrintWindow()`) |
| `presetWin` async-report pattern | Screens where the printable HTML resolves after an `await` | Same visible button, but the click handler opens `window.open('', '_blank')` **synchronously inside the click handler**, then passes that window reference into `printReportHtml(html, mode, presetWin)` once the async HTML build finishes | N/A | No | Same shared alert; additionally, if the eventually-built `html` turns out empty, the already-opened window is closed automatically (`presetWin?.close()`) rather than left blank |

**Cross-cutting observation: there is no print-preview step anywhere in this pattern.** Every
single calling convention audited — generic `ReportPrintBar`, disabled-button variant,
toolbar-triggered, and all six dedicated print functions — goes directly from "user clicks Print"
to "popup window opens with `.print()` already scheduled" in one step. The only "preview" that
exists anywhere in the audited screens is Circular's expand-a-row **View/Collapse** card (an
on-page preview, not a pre-print-dialog preview) — clicking **Print** from inside that expanded
card still jumps straight to the native print dialog with no intermediate confirmation screen.

## 3. Advanced feature gaps

1. **No print-preview modal before the native print dialog, anywhere.** Every mode funnels
   through `openPrintWindow()`, which writes HTML into a new window and calls `.print()` on a
   150ms/500ms timer (per user-stories §3.2) — the user never sees a "here's what will print,
   confirm or cancel" step distinct from the browser's own native print dialog (which itself only
   appears after the new window has already opened). A user who clicks Print on a report with
   the wrong filters applied currently discovers this only after the popup opens (and possibly
   after paper has already come out of a printer if "Print" was clicked instead of "Save as PDF"
   in the OS dialog).
2. **The two zero-row conventions (hide-button vs. disabled-button) are inconsistent across
   modules**, already flagged as a gap in user-stories US-5.2. This is a real control-inventory
   finding: `ReportPrintBar`'s own default (`if (!html) return null`) unmounts the button
   entirely, while at least one consuming screen (Library Book Report) keeps it visible but
   `disabled`. A user scanning for "is there a Print option on this screen" gets a different
   affordance depending on which module they're in, with no shared rule for which the button
   itself enforces.
3. **No popup-blocked recovery path beyond a single `window.alert()`.** When `window.open`
   returns `null` (popup blocked), every calling branch's only feedback is a browser-native
   `alert()` — no in-page banner, no "click here to retry" affordance, no guidance on *which*
   browser setting to change. Since some browsers block `window.open()` specifically when it's
   called from inside an **async** handler (not a direct synchronous click-gesture continuation)
   — exactly the scenario the `presetWin` pattern was built to work around for screens with an
   `await` before the HTML is ready — any screen that *doesn't* yet use the `presetWin` pattern
   for its async print flow is more exposed to this failure mode than screens that do, and the
   only observable symptom to the user is the same generic alert either way.
4. **No confirm step before firing `.print()` for the `presetWin` synchronous-open flow.**
   This pattern intentionally opens a blank window immediately on click (before the `await`) to
   dodge popup blockers — which means the user sees a blank browser tab appear immediately, then
   (after the async HTML build completes) content flows in and print fires automatically with no
   further user action. There's no visible "Preparing report…" state in that blank window while
   the user waits — depending on how long the async build takes, the user may not realize the
   blank tab is theirs/expected.

## 4. User-experience suggestions

1. **A print-preview modal before opening the native print dialog.** Instead of `.print()`
   firing automatically on a timer inside `openPrintWindow()`, render the same built HTML inside
   an in-page modal (or the already-opened popup, but paused before `.print()` is called) with
   an explicit **Print** / **Cancel** button pair. *Why it helps:* directly closes the gap in
   §3.1 — the report author already has the exact HTML string that would print (`printHtml`);
   showing it once for confirmation costs nothing structurally (the HTML is already built) and
   gives the user a chance to catch a wrong date range or filter before committing to the native
   print dialog, especially valuable for the fee-slip/ID-card/circular-letter flows where a
   wrong printout has a real paper/postage cost. This directly references the `noopener`/
   `win.print()` constraint documented in
   [user-stories/26-print-reports.md §5.1](../user-stories/26-print-reports.md) — any preview
   implementation must still avoid `noopener` on the eventual `window.open()` call, or reuse the
   same window reference the preview was already showing, to avoid breaking `win.print()` per
   that documented rule.
2. **A "print failed / popup blocked" fallback message richer than a native `alert()`.**
   Replace (or supplement) the current `window.alert('Unable to open the print window. Please
   allow popups for this site.')` with an in-page dismissible banner near the Print button that
   includes a **Retry** action (re-invokes the same print call, now that the user has had a
   chance to allow popups) and, ideally, browser-specific guidance copy. *Why it helps:* since
   some browsers block `window.open()` specifically when called from an async continuation
   (rather than a direct synchronous click), and the current codebase already has a documented
   workaround for this (the `presetWin` pattern), a fallback message that offers Retry — rather
   than requiring the user to notice the blocked-popup icon in their address bar, unblock it
   manually, and re-click Print from scratch — turns a confusing dead end into a one-click
   recovery.
3. **Unify the zero-row Print-button convention across modules.** Pick one behavior (hide vs.
   disabled-with-tooltip) and apply it everywhere `ReportPrintBar` or a dedicated print button is
   used. *Why it helps:* a disabled button with a tooltip ("No rows to print for this filter")
   is arguably more discoverable than a vanishing button (a first-time user might not realize a
   Print option exists at all for a screen if it only appears once data exists), but either
   choice is better than the current mixed behavior — the specific choice matters less than
   making it consistent, which is why this is called out as needing a decision (see §5).
4. **A visible "Preparing report…" indicator in the `presetWin` blank-tab window** while the
   async HTML build is in flight, instead of a silently blank tab. *Why it helps:* closes the
   gap in §3.4 — a few lines of HTML written into the pre-opened window immediately (before the
   async build resolves) would reassure the user the blank tab is expected and working, rather
   than looking like a stray empty tab they might close.
5. **Surface stylesheet-load failure instead of silently printing unstyled output** (per
   user-stories US-5.3's documented gap: a 404'd `/legacy/css/*.css` `<link>` doesn't block or
   delay `.print()`, so the printed page can silently render as unstyled raw tables). A
   `<link>` `onerror` handshake that either delays the print-timing timer slightly or shows a
   one-line "Report printed without its stylesheet — layout may look different than usual"
   notice after the fact would at least make the failure mode visible instead of silent. *Why it
   helps:* this is exactly the kind of failure a staff user has no way to self-diagnose today —
   a printed page missing its legacy fonts/borders/page-size rules looks like a bug report
   waiting to happen, with no signal in the UI pointing at the actual cause (a missing static
   asset, not a data problem).
6. **A "Save as PDF" affordance distinct from the browser's own print-to-PDF option**, at least
   for the highest-value dedicated flows (fee slips, ID cards, circular attachments). *Why it
   helps:* today the only way to get a PDF is the OS/browser print dialog's own "Save as PDF"
   destination, which most users don't associate with "download" — an explicit button reduces
   friction for the very common case of archiving/emailing a printed document rather than
   physically printing it. (This is speculative/future per user-stories §6, since it would need
   a server-side HTML→PDF renderer that doesn't exist anywhere in this codebase today — noted
   here for completeness of the UX suggestion, not as something achievable purely client-side.)
7. **A shared `printLabel` naming convention.** `ReportPrintBar`'s default label is "Print
   report," but individual screens override it inconsistently (`label="Print"` on Academic's
   Subject Schedule/Batch screens, the default left as-is elsewhere). *Why it helps:* this is a
   minor but visible inconsistency a user notices when moving between modules in one session —
   standardizing on the shorter "Print" (matching what most consuming screens already override
   to) would remove the odd-one-out default without any functional change.
8. **Keyboard-accessible print trigger.** The Print button in every calling convention audited
   is a `<button type="button">`, which is already keyboard-focusable and Enter/Space-activatable
   by default — but none of the audited screens document (or provide) a dedicated keyboard
   shortcut (e.g. `Ctrl+P` intercepted to trigger the app's own print flow instead of the
   browser's native print-current-page shortcut, which would print the *setup screen itself*,
   not the intended report). *Why it helps:* a power user reflexively pressing `Ctrl+P` on a
   report screen today gets the browser's native print of the on-screen filters/table UI, not
   the legacy-styled report — an unexpected and confusing result that a captured shortcut could
   redirect to the correct `printReportHtml()` call instead.
9. **Mobile/narrow-viewport handling of the popup-based print flow.** `window.open('', '_blank')`
   behaves inconsistently across mobile browsers (many open a new tab rather than a popup
   window, and some mobile browsers restrict `window.print()` entirely) — none of the audited
   code paths detect a mobile user agent or offer an alternative (e.g. a direct "Open printable
   version in this tab" link) for the case where the popup-based flow doesn't work well. *Why it
   helps:* per user-stories §6, mobile is already flagged as needing an entirely different
   renderer (`react-native-webview` + `expo-print`) for the future native app, but the *web*
   client itself is also reachable from a mobile browser today, where this gap is live now, not
   just a future-app consideration.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Replace the bare `window.alert('Unable to open the print window...')` with an in-page banner
  that includes a Retry button — the popup-blocked detection logic already exists in
  `openPrintWindow()`, only the feedback surface needs to change.
- Pick and apply one consistent zero-row Print-button convention (disabled-with-tooltip is the
  more discoverable option) across the handful of screens currently using the
  disabled-button variant instead of `ReportPrintBar`'s default hide-on-empty behavior.
- Add a one-line "Preparing report…" placeholder into the blank window opened by the `presetWin`
  pattern, written immediately on open rather than left blank until content resolves.
- Add a `<link>` `onerror` handler on the legacy CSS `<link>` tags injected by
  `openPrintWindow()` to at minimum log/flag a stylesheet-load failure, as a first step toward
  the fuller "unstyled print" warning described in §4 item 5.
- Standardize the Print button label to "Print" across every `ReportPrintBar` consumer instead
  of the mixed default/"Print report"/"Print" wording currently in use.

**Bigger investments (needs design/product buy-in first):**
- A true print-preview modal/step before `.print()` fires — needs a decision on UI treatment
  (in-page modal vs. pausing the already-opened popup window) and must be implemented carefully
  around the documented `noopener` constraint so it doesn't reintroduce the exact bug that
  constraint exists to prevent.
- A "Save as PDF" button backed by a server-side HTML→PDF renderer (e.g. Puppeteer/wkhtmltopdf)
  reusing the existing `printHtml`/`reportHtml` payloads — new backend infrastructure, not a
  client-only change, and directly overlaps with the mobile app's already-documented plan to
  reuse the same `printHtml` strings via `expo-print` (per
  [user-stories/26-print-reports.md §6](../user-stories/26-print-reports.md)), so it's worth
  scoping the web and mobile PDF paths together rather than independently.
- Richer stylesheet-load-failure UX (beyond a console flag) — needs a decision on whether a
  failed `<link>` should delay printing, block it with a warning, or just annotate the printed
  output after the fact.
