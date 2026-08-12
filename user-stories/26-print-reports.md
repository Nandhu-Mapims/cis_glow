# 26 — Print & Reports (cross-cutting)

## 1. Module overview

**Purpose.** This is not a standalone module with its own routes/hub — it is the shared
print/report **pattern** used by nearly every other module (exam, academic, fees, attendance,
payroll, circular, certificates, library, admin, …) to reproduce legacy PHP's "click Print → a
new browser window opens with legacy-styled HTML → `window.print()` fires" behavior. A server
service builds an HTML string (`printHtml` / `reportHtml`), the client either renders a
`<ReportPrintBar>` button or calls a print helper directly, and `printReportHtml()` in
`client/src/utils/printReport.js` opens a `window.open` popup, writes that HTML into it wrapped
in mode-specific `<head>` CSS, and calls `.print()`.

**Actors.** Every module's staff/admin users who click a "Print" button — this is not a
user-facing screen of its own, it is infrastructure invoked from ~20+ setup/report screens.

**Legacy PHP files replaced.** Not one file — this reproduces the common legacy pattern found
across dozens of PHP report pages that all share the same structural idiom:
`callPrintHeader()` (produces the `#printingHeader`/`#printHeaderpanel` banner block) +
a body `<div>` with a report-specific id (`#exam_report_span`, `#att_report_span`,
`#form_details_panel`, `#total_con`, …) + a page-specific legacy stylesheet under
`/legacy/css/*.css`, followed by a `window.print()` call triggered either automatically on load
or from an on-page "Print" button. Representative legacy sources referenced directly in code
comments: `exam_dashboard.php`, `term_exam_sch_print.php`, `attendance_report*.php`,
`fee_pending_sms_v1.php`, `student_fee_slip_new.php`, `student_id_card.php`, `circular.css`'s
`circular_view.php`.

**Core files:**

| File | Role |
|---|---|
| `client/src/components/ReportPrintBar.jsx` | Generic "Print report" button; renders nothing if `html` is falsy |
| `client/src/utils/printReport.js` | `printReportHtml(html, mode, presetWin)` — the actual popup/print engine, plus half a dozen named export variants (`printFeePendingLetter`, `printFeeSlip`, `printAlumniIdCard`, `printStudentIdCard`, `printAaadarCertificate`, `printInternshipCertificate`, `printTaskManageReportSection`, `printCircularPreview`) for flows that don't go through the generic mode switch |
| `client/src/utils/examDashboardPrint.js`, `examSchedulePrint.js`, `attendanceReportPrint.js`, `subjectSchedulePrint.js`, `subjectBatchPrint.js` | Module-specific **HTML builders** — they assemble the `#printingHeader`/report-body markup string but do **not** open the print window themselves; callers pass the built string into `printReportHtml()` or `<ReportPrintBar>` |
| Server `printHtml`/`reportHtml` fields | Every module's `load`/`save` service response that supports printing includes a pre-rendered HTML string field (naming varies: `printHtml`, `reportHtml`) |

## 2. Screen inventory (representative entry points)

Not every module is listed — this table shows the two calling conventions in use plus a spread of
modules that each use them, to demonstrate the pattern is shared infrastructure, not one-off code.

| Route / screen | Component | Calling convention | `printMode` / helper | Module |
|---|---|---|---|---|
| `/exam` (Exam Dashboard) | `client/src/pages/exam/ExamDashboard.jsx` | Direct call: `buildExamDashboardPrintHtml()` → `printReportHtml(body, 'exam-dashboard')` | `'exam-dashboard'` | Exam |
| `/exam/setup/schedule-print` | `client/src/pages/exam/setup/SchedulePrintSetup.jsx` | via `buildExamSchedulePrintHtml()` (`client/src/utils/examSchedulePrint.js`, wraps `buildAttendanceReportPrintHtml`) | `'exam-schedule-print'` | Exam |
| `/attendance/...` Student Attendance Report | `client/src/pages/attendance/StudentAttendanceReport.jsx` | `<ReportPrintBar html={buildPrintHtml()} printMode="student-attendance-report" />` | `'student-attendance-report'` | Attendance |
| `/academic/setup/subject-schedule` | `client/src/pages/academic/setup/SubjectScheduleSetup.jsx` | `<ReportPrintBar html={printHtml} label="Print" printMode="academic-subject-schedule" />` | `'academic-subject-schedule'` | Academic |
| `/academic/setup/subject-batch` | `client/src/pages/academic/setup/SubjectBatchSetup.jsx` | `<ReportPrintBar html={printHtml} label="Print" printMode="academic-subject-batch" />` | `'academic-subject-batch'` | Academic |
| `/academic/setup/subject-report` | `client/src/pages/academic/setup/SubjectReportSetup.jsx` | `<ReportPrintBar html={html} printMode="academic-subject-report" />` | `'academic-subject-report'` | Academic |
| `/academic/setup/timetable-report` | `client/src/pages/academic/setup/TimetableReportSetup.jsx` | `<ReportPrintBar html={html} printMode="academic-timetable-class-report" />` | `'academic-timetable-class-report'` | Academic |
| `/academic/setup/curriculum-report` | `client/src/pages/academic/setup/CurriculumReportScreen.jsx` | `<ReportPrintBar html={html} printMode={printMode} />` (dynamic — mode chosen per report type) | varies | Academic |
| Library — Resources Report / OPAC (see [13-library.md](13-library.md) §3.5/§3.6) | `client/src/pages/library/setup/BookReportSetup.jsx` | `<ReportPrintBar html={data?.printHtml} />` (default mode) | `'default'` | Library |
| Fee pending reminder letters | fee SMS/letters screens | `printFeePendingLetter(html)` — named export, own header/CSS, not the generic mode switch | n/a (dedicated function) | Fees |
| Fee bank slip | fee slip screens | `printFeeSlip(html)` — legacy `student_fee_slip_new.php` layout | n/a (dedicated function) | Fees |
| Circular preview | `client/src/pages/circular/setup/CircularPrintSetup.jsx` and siblings (`PrintStudentSetup.jsx`, `PrintStaffSetup.jsx`, `PrintDepartmentSetup.jsx`) | `printCircularPreview({ title, subTitle, description, date })` | n/a (dedicated function, builds its own body HTML from discrete fields rather than a server-built string) | Circular |
| Payroll consolidated report | payroll report screens | `<ReportPrintBar ... printMode="payroll-consolidated" />` | `'payroll-consolidated'` | Payroll |
| Alumni / Student ID cards | certificate/ID screens | `printAlumniIdCard(html)` / `printStudentIdCard(html)` | n/a (dedicated functions) | Certificates / Students |
| PG punch / stipend attendance | payroll/exam attendance screens | `printMode="pg-punch-report"` / `"stipend-attendance-report"` | see above | Payroll |
| Holiday report | academic/attendance calendar screens | `printMode="holiday-report"` | `'holiday-report'` | Academic |
| Intern attendance statement | attendance screens | `printMode="intern-att-statement"` | `'intern-att-statement'` | Attendance |
| Inspection certificates / appointment orders / affidavits | staff/admin-office screens | `printMode="inspection"` / `"appointment-order"` / `"affidavit"` (or `mode === true`) | — | Staff / Admin Office |

`ReportPrintBar` itself is used across 20 different page files (`grep -l ReportPrintBar
client/src/pages -r` → 20 matches), confirming this is genuinely shared infrastructure and not
duplicated per module.

## 3. Pixel-level flow

### 3.1 `ReportPrintBar` (`client/src/components/ReportPrintBar.jsx`)

Full component (17 lines, quoted verbatim structurally):
- Props: `html`, `label = 'Print report'`, `printMode = 'default'`.
- **Guard:** `if (!html) return null;` — the button does not render at all when there is nothing
  to print (see §5.2, printing a report with zero rows).
- Renders a single `<div className="cis-print-bar"><button type="button" className="btn
  btn-outline-secondary btn-sm" onClick={() => printReportHtml(html, printMode)}>{label}</button></div>`.
- The visible button text defaults to **"Print report"** but is frequently overridden — e.g.
  `label="Print"` in `SubjectScheduleSetup.jsx` and `SubjectBatchSetup.jsx`.

### 3.2 `printReportHtml(html, mode, presetWin)` (`client/src/utils/printReport.js`)

This is the actual print engine, a large `if (mode === '...')` chain (over 20 named modes as of
this writing) that each build a mode-specific `headHtml` (page size, margins, `<link>`s to
legacy CSS under `/legacy/css/`, inline `<style>` overrides) and a `bodyHtml`, then call the
shared `openPrintWindow(title, headHtml, bodyHtml, presetWin)` helper.

- **Early return:** `if (!html) { presetWin?.close(); return; }` — if a window was already opened
  synchronously (see `presetWin` below) but the HTML turned out empty, that window is closed
  rather than left blank.
- **`openPrintWindow()` internals** (lines 36–71):
  - `const win = presetWin !== undefined ? presetWin : window.open('', '_blank');` — **critically,
    `window.open` is called with no `'noopener'` feature string.** The code comment states this
    explicitly: *"Do not pass noopener — it makes window.open return null and breaks printing."*
    See §5.1 for the full explanation of why this is codified as an absolute rule in
    `CLAUDE.md` ("Never use `window.open(..., 'noopener')` for print — it breaks `win.print()`").
  - If `win` is null (popup blocked), every calling branch shows
    `window.alert('Unable to open the print window. Please allow popups for this site.')`.
  - Writes a full `<!DOCTYPE html><html><head>...<title>{escaped title}</title>{headHtml}</head><body>{bodyHtml}</body></html>`
    document into the new window via `win.document.open()` / `.write()` / `.close()`.
  - **Print-timing guard:** a `printed` flag ensures `.print()` only fires once. If
    `win.document.readyState === 'complete'` already, it schedules `triggerPrint` via
    `setTimeout(150)`; otherwise it attaches a `load` listener (also delayed 150ms) **and** a
    hard fallback `setTimeout(triggerPrint, 500)` in case the `load` event never fires (e.g. CSS
    `<link>` 404s hanging the load state — see §5.3).
  - `triggerPrint()` calls `win.focus(); win.print();` inside a `try { } catch { /* ignore print
    errors in restrictive environments */ }` — print failures are swallowed silently, no user
    feedback if `.print()` throws.
- **`presetWin` parameter** — documented in a code comment: it exists for callers where the HTML
  to print only becomes available *after* an `await` (e.g. an async report build). Opening the
  window synchronously inside the click handler (before the `await`) preserves the "direct result
  of a user gesture" requirement most browsers enforce for `window.open`; passing that
  already-opened window in as `presetWin` avoids it being blocked as a delayed popup.
- **Mode-specific behavior differences worth noting:**
  - `'affidavit'` (or legacy boolean `true`) and `'appointment-order'` both call
    `splitAffidavitHtml()` first, which pulls a leading `<style>...</style>` block off the front of
    the HTML string and re-injects it into the generated `<head>` alongside fixed A4-size/margin
    CSS — the server-built HTML is expected to *start* with its own `<style>` tag for these modes.
  - Most modes call `extractReportBodyHtml(html)` first, which strips a full `<html>/<head>/<body>`
    wrapper if the server happened to send one, or returns the body-match group if a `<body>` tag
    is present — defensive against services that build a full document instead of a fragment.
  - Several modes (`'academic-class-timetable'`, `'academic-subject-schedule'`,
    `'academic-timetable-class-report'`, `'academic-feedback-dashboard'`,
    `'academic-staff-period-completed'`, `'academic-subject-report'`) locate a
    `<div id="form_details_panel">` marker inside the raw HTML string and re-slice the document
    around it (stripping any `style="display:none;"` inline attribute that hid it in the source
    screen) rather than using the whole string as-is — these reports are built by reusing markup
    that's also rendered (hidden) inline in the on-screen report for print-preview parity.
  - The fallback/default branch (no named mode matched) uses a generic table stylesheet and calls
    `openPrintWindow('Report', headHtml, html, presetWin)` — this is the branch `ReportPrintBar`'s
    default `printMode='default'` exercises for report screens that don't need bespoke CSS (e.g.
    Library's Resources Report, §2 above).

### 3.3 Module-specific HTML builders (the "reused, not duplicated" evidence)

Two representative examples, both under `client/src/utils/`:

**`buildExamDashboardPrintHtml()`** (`examDashboardPrint.js`, 36 lines) — comment: *"Legacy
`exam_dashboard.php` — `callPrintHeader` + `exam_report_span`."* Takes `{ title, subtitleLine1,
dateRange, bannerUrl, tablesHtml }` and returns a string with a `#printingHeader` banner table
(logo image if `bannerUrl` given, title/subtitle in a `.promote_card` div, optional date-range
line) followed by `<div id="exam_report_span" class="exam_report_span att_report_span">
{tablesHtml}</div>`. Called from `client/src/pages/exam/ExamDashboard.jsx` line 92, then piped
straight into `printReportHtml(body, 'exam-dashboard')` (line 99) — **not** through
`ReportPrintBar` in this case, since the dashboard triggers print from a toolbar action rather
than a report-bar button.

**`buildAttendanceReportPrintHtml()`** (`attendanceReportPrint.js`) — comment: *"Legacy
`callPrintHeader` + `att_report_span` layout (`attendance_report*.php`)."* Nearly identical shape
to the exam builder (same `#printingHeader` banner idiom, different container id
`#att_report_span`), plus a `singleCourse` option that strips redundant per-row "Course:"/
"Subject:" `<p>` lines from the table body via regex when the report is already scoped to one
course. This single builder is **re-exported and reused** by two different report flows:
`buildPgPunchPrintHtml()` and `buildExamSchedulePrintHtml()` (in `examSchedulePrint.js`) both call
it internally rather than reimplementing the header markup — direct evidence the pattern is
shared, not copy-pasted per screen.

### 3.4 Dedicated (non-generic-mode) print functions

Several flows bypass the `mode` switch entirely because their layout is too specific to the
report to fit the generic dispatcher, instead exporting their own top-level function from
`printReport.js` that builds its own `headHtml`/`bodyHtml` and calls `openPrintWindow()` directly:
`printFeePendingLetter(html)` (legacy `fee_pending_sms_v1.php` layout, `/legacy/css/result.css`),
`printFeeSlip(html)` (`student_fee_slip_new.php`, `/legacy/css/fee_slip.css`, landscape A4),
`printAlumniIdCard(html)` / `printStudentIdCard(html)` (portrait/landscape ID card layouts),
`printAaadarCertificate(html)` / `printInternshipCertificate(html)` (dedicated
`/aaadar-certificate.css` / `/internship-certificate.css`, **not** under `/legacy/css/` — these
are new stylesheets, not ported legacy ones), `printTaskManageReportSection(html, { title,
useCircularCss, useTaskManagePrint })` (three interchangeable style sets selected by flags), and
`printCircularPreview({ title, subTitle, description, date })` — the only function in this file
that builds its **own** body HTML from discrete field values rather than receiving a pre-built
HTML string from the server, used for previewing a single circular in the legacy letter layout
(`/legacy/css/circular.css`) before it's actually sent.

### 3.5 What the save/load call sends and returns

The print pattern itself makes no network request — `printReportHtml()` operates entirely on an
HTML string already present in client state. That string is populated by whatever the module's
`load`/`save` endpoint returned. Concretely, for every module surveyed:
- Server services build the printable markup in the same function that resolves search/filter
  results (e.g. Library's `book-report` load response includes `printHtml` alongside `rows`
  — see [13-library.md](13-library.md) §3.5).
- The client stores that string unchanged in its `data` state (via `useXSetupApi`/`createSetupApi`,
  see `client/src/hooks/createSetupApi.js`) and threads it into `<ReportPrintBar html={data.printHtml}
  printMode="..." />` — no client-side HTML generation happens for these screens; only the
  builder-function screens (§3.3) assemble markup client-side, and even those still source
  their tabular data from a server response.

## 4. Primary user stories

1. **As any module's staff user, I want to click a "Print" button and get a legacy-styled printed
   page** (any `ReportPrintBar` usage — §3.1), so paperwork/report output matches what the college
   already relies on from the legacy system without retraining staff on a new layout.
   *Acceptance:* the button is entirely absent (`ReportPrintBar` returns `null`) until the
   underlying report has data to print — there is no way to trigger an empty/blank print dialog
   through this component.
2. **As a report screen author (developer), I want a shared `printReportHtml(html, mode)` entry
   point with per-report-type CSS**, so each new report doesn't need to reinvent
   popup-window-plus-print boilerplate. *Acceptance:* 20+ distinct `mode` values already share one
   `openPrintWindow()` implementation (§3.2); the fallback/default mode still works for a
   report with no bespoke CSS need.
3. **As a staff user printing a report whose data only resolves after an async step, I want the
   print window to open reliably instead of being blocked by the browser's popup blocker**, using
   the `presetWin` pattern (§3.2) — a window is opened synchronously in the click handler before
   the `await`, then handed to `printReportHtml()` once the HTML is ready.
4. **As a staff user printing fee slips, ID cards, or circular previews**, I want dedicated
   legacy-parity layouts (`printFeeSlip`, `printStudentIdCard`, `printCircularPreview` — §3.4)
   that don't force those visually distinct documents through the generic tabular-report styling.
5. **As a developer building a new exam/attendance report**, I want to reuse
   `buildAttendanceReportPrintHtml()`'s shared `#printingHeader` banner builder (§3.3) instead of
   duplicating the logo/title/subtitle markup, so every report's print header stays visually
   consistent.

## 5. Rare / edge-case user stories

1. **A print window opened with `window.open(..., 'noopener')` would break `win.print()`.**
   `openPrintWindow()` in `client/src/utils/printReport.js` (line 41-42) explicitly calls
   `window.open('', '_blank')` with **no** `noopener`/`noreferrer` feature string, and the code
   comment states why: *"Do not pass noopener — it makes window.open return null and breaks
   printing."* This is exactly why `CLAUDE.md`'s absolute-rules section (§7) states: *"Do not use
   `window.open(..., 'noopener')` for print — it breaks `win.print()`."* Mechanically: when
   `noopener` is passed, the browser detaches the new window from the opener's JS context for
   security (the opener can no longer hold a reference to `win` and drive it), so
   `win.document.write(...)`/`win.focus()`/`win.print()` — all of which this code needs to call
   *on the returned window object* — would either throw or silently no-op. If a future
   change added `noopener` here (e.g. copy-pasting a "secure `window.open`" pattern from
   elsewhere in the codebase without reading this comment), every one of the 20+ print modes in
   this file, and all six of the dedicated print functions in §3.4, would break at once, since
   they all funnel through this one `openPrintWindow()` function — this is a single point of
   failure by design (shared infra), which is exactly why the rule is called out at the top level
   in `CLAUDE.md` rather than left as a local comment only.
2. **Printing a report with zero rows.** `ReportPrintBar` returns `null` entirely when `html` is
   falsy (§3.1) — so if a server load resolves with an empty result set and the service chooses
   to return an empty/undefined `printHtml` in that case, the Print button simply never
   appears, and there is no explicit "nothing to print" message shown to the user beyond
   whatever the report screen itself already renders for its empty-rows state (e.g. Library's
   Resources Report shows `"No records found"` per [13-library.md](13-library.md) §3.5, alongside
   the Print button being `disabled={!data?.printHtml}` in that screen specifically — note this
   is a *disabled* button, not a missing one, showing the two conventions used across
   modules aren't fully consistent: some screens hide the button (`ReportPrintBar`'s own
   `if (!html) return null`), others keep it visible but disabled). If a service instead always
   returns a non-empty `printHtml` string (e.g. just the header banner with an empty body table),
   the button *would* appear and print a page with a header and no rows — behavior depends
   entirely on what each module's service chooses to return, not on any shared zero-row guard in
   the print utility itself.
3. **Printing while the legacy CSS bundle fails to load.** Most modes reference legacy stylesheets
   via `<link href="/legacy/css/....css" rel="stylesheet" />` inside the generated `headHtml`
   (e.g. `/legacy/css/style_print.css`, `/legacy/css/exam.css`, `/legacy/css/salary.css`,
   `/legacy/css/att_card.css`, `/legacy/css/circular.css`, `/legacy/css/fee_slip.css`) — these are
   served as static files per `CLAUDE.md`'s "Static: `/legacy` → legacy files/images parent path"
   mount. If that static mount is misconfigured or the file is missing, the `<link>` 404s.
   `openPrintWindow()`'s print-timing logic (§3.2) does not wait for stylesheet load specifically —
   it waits for the *document's* `readyState`/`load` event (with a 500ms hard-fallback timeout
   regardless), which fires independent of whether a linked stylesheet 404'd. Net effect: the
   print window still opens and still calls `.print()` on schedule, but renders/prints
   completely **unstyled** HTML (raw table borders, no legacy fonts/colors/page-size rules) —
   there is no error surfaced to the user distinguishing "styled correctly" from "CSS 404'd,
   printed unstyled," since the `<link>` failure is a browser-network event the printing code
   never inspects.

## 6. Future / predicted user stories

### Future (not implemented)

Grounded in `mobile.md` §7.1, which addresses this exact pattern directly:

> "Web uses `printReportHtml()` opening a new window (`client/src/utils/printReport.js`). That
> doesn't exist on mobile. Replace with: Backend already builds `printHtml`/`reportHtml` strings —
> reuse as-is. Mobile renders that HTML via `react-native-webview` (view) and offers **Share**
> (native share sheet) or **Save as PDF** using `expo-print` (`Print.printToFileAsync({ html })`)
> → `expo-sharing`. No backend change required — same `printHtml` payload, new renderer."

1. *(Speculative)* As a mobile app user, I want to view a report/receipt/slip in-app via
   `react-native-webview` and share or save it as a PDF, reusing the exact same `printHtml`
   payload this module's server services already build — per `mobile.md` §7.1, this needs **no**
   backend change, only a new renderer (`expo-print`'s `Print.printToFileAsync({ html })` +
   `expo-sharing`) in the future `mobile/` app, since `window.open`/`win.print()` (the mechanism
   documented throughout this file) has no mobile equivalent.
2. *(Speculative)* As a staff user, I want a "Save as PDF" option alongside the current
   browser-print flow on the web app too, not just on mobile, so a report can be archived or
   emailed without relying on the browser's own print-to-PDF dialog — this would likely reuse a
   server-side PDF renderer (e.g. wkhtmltopdf/Puppeteer against the same `printHtml`/`reportHtml`
   string) rather than a client change, but no such capability exists anywhere in
   `client/src/utils/printReport.js` or the server services today.
3. *(Speculative)* As a developer, I want `printReportHtml()` to detect and surface a stylesheet
   `<link>` load failure (§5.3) — e.g. via a `<link>` `onerror` handshake reported back before
   `.print()` fires — instead of silently printing unstyled output; this is a plausible
   robustness improvement, not something planned in `mobile.md` or any other doc found in this
   repo.
4. *(Speculative)* As a developer, I want the two zero-row conventions noted in §5.2
   (`ReportPrintBar`'s hide-the-button vs. some screens' disable-the-button pattern) unified into
   one documented convention, so new report screens don't have to guess which pattern to follow.

## 7. Traceability

| Story | Client file | Server endpoint / service | Table(s) |
|---|---|---|---|
| Generic print button | `client/src/components/ReportPrintBar.jsx` | (client-only; consumes whatever `printHtml`/`reportHtml` field the calling screen's load/save endpoint already returned) | n/a |
| Print engine / mode dispatch | `client/src/utils/printReport.js` (`printReportHtml`, `openPrintWindow`, `extractReportBodyHtml`, `splitAffidavitHtml`) | n/a (pure client-side HTML/window handling) | n/a |
| Exam Dashboard print | `client/src/pages/exam/ExamDashboard.jsx` + `client/src/utils/examDashboardPrint.js` | exam dashboard load service (builds source data; HTML assembled client-side) | `cia_*` exam tables (see [10-exam.md](10-exam.md)) |
| Exam Schedule print | `client/src/pages/exam/setup/SchedulePrintSetup.jsx` + `client/src/utils/examSchedulePrint.js` → `buildAttendanceReportPrintHtml` | `POST /api/exam/setup/schedule-print/load` | `cia_schedule_tb` |
| Academic subject schedule/batch/report/timetable prints | `client/src/pages/academic/setup/Subject*Setup.jsx`, `TimetableReportSetup.jsx` | `POST /api/academic/setup/<screen>/load` (each returns a `printHtml`) | academic tables per [09-academic.md](09-academic.md) |
| Student Attendance Report print | `client/src/pages/attendance/StudentAttendanceReport.jsx` | attendance report load endpoint | `student_att_tb` |
| Library report print (default mode) | `client/src/pages/library/setup/BookReportSetup.jsx` | `POST /api/library/setup/book-report/load` → `server/src/services/library/setup/bookReportSetup.js` | `book_tb` |
| Fee pending letters / fee slip | fee module screens | fee module load/save endpoints | fee tables per [08-fees.md](08-fees.md) |
| Circular preview | `client/src/pages/circular/setup/CircularPrintSetup.jsx` (+ `PrintStudentSetup.jsx`, `PrintStaffSetup.jsx`, `PrintDepartmentSetup.jsx`) | circular module endpoints | circular tables per [23-circular.md](23-circular.md) |
| Payroll consolidated / PG punch / stipend attendance prints | payroll report screens | payroll load endpoints | payroll tables per [12-payroll.md](12-payroll.md) |
| ID card prints | certificate/student screens | files/certificate endpoints | `student_profile_tb`, certificate tables |
