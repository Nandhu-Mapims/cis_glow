# 12 — Payroll

> Companion deep-dive to [../userstory.md](../userstory.md). Follows the template in
> [README.md](README.md). All field labels, button text, and validation text below are
> quoted directly from the JSX/service source, not paraphrased. Every code fact was
> verified by reading the file cited next to it.

## 1. Module overview

**Purpose.** Payroll is the largest modernized module (37 client files under
`client/src/pages/payroll/`, 32 service files under `server/src/services/payroll/`). It
covers two parallel payroll systems that share most of their UI patterns but write to
different tables:

- **Staff (salary) payroll** — attendance-linked monthly salary generation, bank/PF/ESI
  payslip reports, salary setup (bands, advances, arrears, security deposits, TDS,
  deductions), and payroll-close workflow. Core table: `staff_payroll_tb` (per-staff,
  per-month generated payroll), with `staff_payroll_log` tracking which
  category/month combinations have been generated (`payroll_complete` flag).
- **Stipend payroll** — the same shape of workflow for BDS/other stipend-eligible
  students (register-number based, not staff-ID based). Core tables:
  `stipend_payroll_tb`, `stipend_payroll_log`.

**Actors.** Accounts/payroll office staff and administrators with `Global` access or a
menu grant matching `payroll_%`, `salary_%`, `stipend_%` patterns
(`menuAuthForModule('payroll')` in `server/src/routes/payroll.js:31`, defined in
`server/src/middleware/menuAuth.js`). All routes require `authMiddleware` (a valid JWT).

**Legacy PHP files replaced** (from `docs/payroll-module.md` and
`client/src/pages/payroll/payrollSetupMeta.js`):
`payroll_dashboard.php`, `payroll_individual_report.php`,
`payroll_individual_report_excel_report.php`, `payroll_report1.php` (bundle),
`payroll_consolidated_report.php`, `salary_summary.php`, `salary_statement.php`,
`payroll_group_report.php`, `generate_payroll.php`, `payroll_report.php` (att-report),
`payroll_monthly_report.php`, `staff_tax_report.php`, `payroll_individual_setup.php`,
`payroll_cron_setup.php`, `staff_payroll_setup.php`, `staff_pfesi_setup.php`,
`staff_salary_setup.php`, `staff_salary_report.php`, `salary_advance_add.php`,
`salary_advance_edit.php`, `salary_arrear_add.php`, `salary_arrear_edit.php`,
`staff_deduction_add.php`, `staff_lop_deduction.php`, `staff_tds_add.php`,
`staff_cheque_add.php`, `security_deposit_deduction_add.php`,
`security_deposit_deduction_close.php`, `payroll_close.php`,
`stipend_payroll_report.php`, `stipend_salary_statement.php`,
`stipend_payroll_individual_report1.php`, `stipend_generate_payroll.php` (+
`stipend_generate_payroll_more.php` AJAX step), `stipend_att_report.php` (+
`_more.php`), `stipend_amount_setup.php`, `stipend_deduction_add.php`,
`stipend_payroll_close.php`.

**del=1 / audit.** Every payroll table query filters `del = 1` for active rows
(`server/src/services/payroll/payrollShared.js`, `payrollHelpers.js`); soft-deletes
follow the standard `del=0` pattern via `setupAudit.js`. Every load/generate/save call
writes to `log_tb` through `logPayrollPage()` (`payrollHelpers.js:44`), using the legacy
PHP filename as the page key for parity with legacy audit logs.

## 2. Screen inventory

| Route | Component file | Legacy `.php` |
|---|---|---|
| `/payroll` | `client/src/pages/payroll/PayrollHub.jsx` | (menu hub) |
| `/payroll/dashboard` | `client/src/pages/payroll/PayrollDashboard.jsx` | `payroll_dashboard.php` |
| `/payroll/individual-report` | `client/src/pages/payroll/PayrollIndividualReport.jsx` | `payroll_individual_report.php` + `..._excel_report.php` |
| `/payroll/individual-bundle` | `client/src/pages/payroll/PayrollIndividualBundle.jsx` | `payroll_report1.php` |
| `/payroll/consolidated-report` | `client/src/pages/payroll/PayrollConsolidatedReport.jsx` | `payroll_consolidated_report.php` |
| `/payroll/salary-summary` | `client/src/pages/payroll/SalarySummary.jsx` | `salary_summary.php` |
| `/payroll/salary-statement` | `client/src/pages/payroll/SalaryStatement.jsx` | `salary_statement.php` |
| `/payroll/group-report` | `client/src/pages/payroll/PayrollGroupReport.jsx` | `payroll_group_report.php` |
| `/payroll/generate-payroll` | `client/src/pages/payroll/GeneratePayroll.jsx` | `generate_payroll.php` |
| `/payroll/att-report` | `client/src/pages/payroll/PayrollReportPages.jsx` (`PayrollAttReport`) | `payroll_report.php` |
| `/payroll/monthly-report` | `client/src/pages/payroll/PayrollReportPages.jsx` (`PayrollMonthlyReport`) | `payroll_monthly_report.php` |
| `/payroll/tax-report` | `client/src/pages/payroll/PayrollReportPages.jsx` (`PayrollTaxReport`) | `staff_tax_report.php` |
| `/payroll/setup` | `client/src/pages/payroll/PayrollSetupHub.jsx` | (menu hub) |
| `/payroll/setup/individual-setup` | `PayrollSetupPage.jsx` → `setup/IndividualSetup.jsx` | `payroll_individual_setup.php` |
| `/payroll/setup/cron-setup` | `PayrollSetupPage.jsx` → `setup/IndividualSetup.jsx` (`CronSetup`) | `payroll_cron_setup.php` |
| `/payroll/setup/payroll-config` | `PayrollSetupPage.jsx` → `setup/PayrollSetupScreens.jsx` (`PayrollConfigSetup`) | `staff_payroll_setup.php` |
| `/payroll/setup/pf-esi-setup` | `PayrollSetupScreens.jsx` (`PfEsiSetup`) | `staff_pfesi_setup.php` |
| `/payroll/setup/salary-add` | `setup/SalaryAddSetup.jsx` | `staff_salary_setup.php` |
| `/payroll/setup/salary-report` | `PayrollSetupScreens.jsx` (`SalaryReportSetup`) | `staff_salary_report.php` |
| `/payroll/setup/salary-advance-add` | `setup/SalaryAdvanceAddSetup.jsx` | `salary_advance_add.php` |
| `/payroll/setup/salary-advance-close` | `setup/SalaryAdvanceCloseSetup.jsx` | `salary_advance_edit.php` |
| `/payroll/setup/salary-arrear-add` | `setup/SalaryArrearAddSetup.jsx` | `salary_arrear_add.php` |
| `/payroll/setup/salary-arrear-release` | `setup/SalaryArrearReleaseSetup.jsx` | `salary_arrear_edit.php` |
| `/payroll/setup/other-deduction` | `setup/PayrollMonthlyGridSetup.jsx` (via `OtherDeductionSetup`) | `staff_deduction_add.php` |
| `/payroll/setup/lop-deduction` | `PayrollMonthlyGridSetup.jsx` (via `LopDeductionSetup`) | `staff_lop_deduction.php` |
| `/payroll/setup/tds-add` | `PayrollMonthlyGridSetup.jsx` (via `TdsAddSetup`) | `staff_tds_add.php` |
| `/payroll/setup/cheque-payment` | `PayrollMonthlyGridSetup.jsx` (via `ChequePaymentSetup`) | `staff_cheque_add.php` |
| `/payroll/setup/security-deposit-add` | `setup/SecurityDepositAddSetup.jsx` | `security_deposit_deduction_add.php` |
| `/payroll/setup/security-deposit-close` | `setup/SecurityDepositCloseSetup.jsx` | `security_deposit_deduction_close.php` |
| `/payroll/setup/payroll-close` | `PayrollSetupScreens.jsx` (`PayrollCloseSetup`) | `payroll_close.php` |
| `/payroll/stipend` | `client/src/pages/payroll/StipendHub.jsx` | (menu hub) |
| `/payroll/stipend/generate-payroll` | `StipendGeneratePayroll.jsx` | `stipend_generate_payroll.php` (+ `_more.php`) |
| `/payroll/stipend/setup/amount-setup` | `StipendSetupPage.jsx` (screen=`amount-setup`) | `stipend_amount_setup.php` |
| `/payroll/stipend/setup/deduction-add` | `StipendSetupPage.jsx` → `setup/StipendDeductionSetup.jsx` | `stipend_deduction_add.php` |
| `/payroll/stipend/setup/payroll-close` | `StipendSetupPage.jsx` (screen=`payroll-close`) | `stipend_payroll_close.php` |
| `/payroll/stipend/att-report` | `StipendAttReport.jsx` | `stipend_att_report.php` (+ `_more.php`) |
| `/payroll/stipend/report` | `StipendPayrollReport.jsx` | `stipend_payroll_report.php` |
| `/payroll/stipend/statement` | `StipendSalaryStatement.jsx` | `stipend_salary_statement.php` |
| `/payroll/stipend/individual-report` | `StipendIndividualReport.jsx` | `stipend_payroll_individual_report1.php` |
| `/payroll/stipend/individual-pdf` | `StipendIndividualPdfReport.jsx` | password-protected PDF bundle (native) |

Two additional generic wrapper components exist but are not wired into the route table
found in this pass — `StipendNativeReportPage.jsx` (native-report variant with
`showReportTypes`/`variant="statement"` props) and `StipendAjaxReportPage.jsx` /
`PayrollLegacyReportPage.jsx` (legacy-HTML-passthrough wrappers used by
`mountLegacyReportRoute` targets such as `/payroll/group-report`,
`/payroll/stipend/report`, `/payroll/stipend/statement`,
`/payroll/stipend/individual-report` when rendered through the legacy-HTML path rather
than the native React form — the codebase has migrated most of these to native React
forms as shown above, but the legacy-passthrough plumbing remains for any screen not yet
fully natively rendered).

## 3. Pixel-level flow per screen

### 3.1 Payroll Hub — `/payroll` (`PayrollHub.jsx`)

A `ModuleHub` tile grid, title **"Payroll Module"**, breadcrumb `Home / Payroll`. Tiles
(exact `title`/`desc` text from `REPORT_LINKS`): **Payroll Dashboard** ("Monthly salary
summary by category"), **Individual Report** ("Payslips, bank/PF/ESI export"),
**Individual Bundle** ("Payroll DB + salary statement (legacy report1)"),
**Consolidated Report** ("Multi-month payroll summary"), **Salary Summary** ("Category
comparison summary"), **Salary Statement** ("Department salary statement"), **Group
Report** ("Multi-month group payroll report"), **Generate Payroll** ("Batch attendance
payroll generation"), **Attendance Report** ("Statement / summary attendance"),
**Monthly Report** ("Multi-month deduction matrix"), **Tax Report** ("TDS and
professional tax"), **Stipend Payroll** ("Stipend reports and statements"), plus a
**Payroll Setup** tile ("Config, salary, deductions, advances") added first via
`SETUP_LINK`. No API call — static links only.

### 3.2 Payroll Dashboard — `/payroll/dashboard` (`PayrollDashboard.jsx`)

- **Field: "Month"** — `<select className="form-select">`, first option
  `-Select Month-`, options from `data.monthOptions` (label/value pairs loaded by
  `POST /api/payroll/dashboard`, backed by `loadPayrollMonthOptions()` reading
  `staff_payroll_log` grouped by month, `payroll_type='Salary'`,
  `server/src/services/payroll/payrollHelpers.js:80`).
- Static text line when a month is generated: **"Generated by {user} on {date}"** (from
  `data.generatedBy`).
- **Button: "Print"** — only rendered `{data?.reportHtml && ...}`, calls
  `printReportHtml(data.reportHtml)`.
- **Button: "Back"** — `Link to="/payroll"`.
- Report body is injected via `dangerouslySetInnerHTML` from `data.reportHtml`
  (server-built HTML from `buildDashboardReportHtml()` in `payrollReportCore.js`,
  reading totals via `loadPayrollTotals()`/`loadBankTransferSummary()` against
  `staff_payroll_tb` joined to `staff_profile_tb`).
- Loading state: `<div className="p-4 text-muted">Loading...</div>` on first mount;
  `busy && <div className="text-muted small mb-2">Loading…</div>` on subsequent loads.
- Empty state: `payrollMonth && !busy && <p className="text-muted">No payroll summary
  available for the selected month.</p>`.
- **Save/submit call:** `POST /api/payroll/dashboard { fields: { payroll_month } }` on
  every month change → dispatches to `loadPayrollDashboard(memberId, fields, audit)`
  (`server/src/services/payroll/payrollDashboard.js`) which returns
  `{ monthOptions, selectedMonth, categoryOptions, generatedBy, canPrint, reportHtml }`.
  This is a **view-only** screen (no persistent write) but every view/generate is logged
  to `log_tb` as `payroll_dashboard.php`.

### 3.3 Individual Report — `/payroll/individual-report` (`PayrollIndividualReport.jsx`)

Fields, in DOM order:
- **"Month"** — `<select>` required, disabled while `busy || exporting`. Options from
  `data.monthOptions`.
- **"Category"** — `<select multiple>` required, disabled until a month is picked,
  `size={Math.min(6, Math.max(3, categoryOptions.length || 3))}`. Placeholder option
  text when no month: `Select month first`; while loading:
  `Loading categories…` / `Select categories`. Options loaded per-month from
  `loadSalarySummaryCategoryOptions(payrollMonth)` (join `staff_profile_tb` +
  `edu_setup_tb` + `staff_payroll_log`, active staff only).
- **"Row Per Page"** — plain `<input className="form-control">`, default `27`.
- **"Report"** (label rendered `d-block`) — radio group `name="report_for"`, options
  from `data.reportTypeOptions` filtered `.filter(opt => opt.visible)` (server-computed
  via `loadReportTypeOptions(payrollMonth)`, e.g. bank/PF/ESI variants).
- **"Copy"** — radio group `name="copy_type"`, three literal options **"Original"**,
  **"Duplicate"**, **"Default"** (rendered from `value.replace(' Copy', '')` of
  `'Original Copy' | 'Duplicate Copy' | 'Default Copy'`).
- **Button: "Go" / "Generating…"** (`PayrollGenerateButton`, default child text
  `"Go"`), disabled when `!payrollMonth || !searchCategory.length || !reportFor ||
  exporting`.
- **Buttons (top-right, conditional):** **"Export XLS"** — shown when
  `reportType === 'bank' | 'pf' | 'esi'` and `!busy`; calls
  `GET /api/payroll/individual-report/export?flag={1|2|3}&payroll_month&transfer_ref&search_category`
  → `exportPayrollIndividualExcel()` (writes a CSV file under
  `legacyFilesPath/excel/payroll_{bank|pf|esi}_report_<timestamp>.csv`, returns
  `{ downloadUrl, filename, format: 'csv' }`); on missing `downloadUrl` sets error
  **"Excel file was not created"**. **"Print"** — shown when `data?.reportHtml && !busy`.
  **"Back"** — `Link to="/payroll"`.
- Busy overlay text while exporting: **"Exporting Excel…"**.
- Empty/hint states (`PayrollReportResults`): `emptyFilterMessage="No individual payroll
  report data for the selected filters."`, `hintMessage="Select month, category, and
  report type, then click Go."`.
- **Save/submit call:** `POST /api/payroll/individual-report { fields: { payroll_month,
  search_category, row_per_page, report_for, copy_type, Submit: 'Generate' } }` →
  `loadPayrollIndividualReport()` (`server/src/services/payroll/payrollIndividualReport.js`)
  returns `{ monthOptions, categoryOptions, reportTypeOptions, selected, reportHtml,
  exportMeta }`. `exportMeta` carries `{ payroll_month, title, transfer_ref,
  search_category }` used by the Export XLS button.

### 3.4 Individual Bundle — `/payroll/individual-bundle` (`PayrollIndividualBundle.jsx`)

Same visual pattern as 3.3 but simpler: **"Month"** select + **"Copy"** radio group
(`Original`/`Duplicate`/`Default`) + Go button (disabled unless `payrollMonth` set).
`POST /api/payroll/individual-bundle { fields: { payroll_month, copy_type, Submit:
'Generate' } }` → `loadPayrollIndividualBundle()`
(`server/src/services/payroll/payrollIndividualBundle.js`, `payrollIndividualBundleCore.js`)
combines the payroll dashboard summary and salary statement into one bundled report
(legacy `payroll_report1.php`). Print button wraps `reportRef.current.innerHTML`.

### 3.5 Consolidated Report — `/payroll/consolidated-report` (`PayrollConsolidatedReport.jsx`)

- **"Month (multi-select)"** — `<select multiple required>`, `size={Math.min(8,
  Math.max(4, monthOptions.length))}`.
- **Button: "Go" / "Generating…"** — plain `<button type="submit" className="btn
  btn-danger">`, text toggles `busy ? 'Generating…' : 'Go'`, disabled while
  `busy || !selectedMonths.length`.
- Report HTML is split client-side by `splitConsolidatedReportHtml()` into
  header/table/signature sections so the table portion can scroll horizontally inside
  `.payroll-report-table-scroll` independent of header/signature.
- Empty state: `!busy && <p className="text-muted">Select one or more months, then click
  Go.</p>`; interim state while generating: `<div className="card-body text-muted
  small">Generating report…</div>`.
- `POST /api/payroll/consolidated-report { fields: { payroll_month: string[], Submit:
  'Generate' } }` → `loadPayrollConsolidatedReport()`
  (`server/src/services/payroll/payrollConsolidatedReport.js`,
  `payrollConsolidatedCore.js`) sums `staff_payroll_tb` figures per month across the
  selected months and returns `{ monthOptions, selectedMonths, reportHtml }`.

### 3.6 Salary Summary — `/payroll/salary-summary` (`SalarySummary.jsx`)

- **"Month"** select, required.
- **"Category 1"** — `<select multiple required size={4}>` + text input labelled
  (placeholder) **"Title"** bound to `categoryTitle1`.
- **"Category 2"** — identical second group, `categoryTitle2`.
- **Go button** disabled unless `payrollMonth && (searchCategory1.length ||
  searchCategory2.length)`.
- `POST /api/payroll/salary-summary { fields: { payroll_month, search_category_1,
  search_category_2, category_title_1, category_title_2, Submit: 'Generate' } }` →
  `loadSalarySummary()` (`server/src/services/payroll/salarySummary.js`,
  `payrollSalarySummaryCore.js`) builds a side-by-side category comparison table (legacy
  `salary_summary.php`).

### 3.7 Salary Statement — `/payroll/salary-statement` (`SalaryStatement.jsx`)

Fields: **"Month"** select, **"Category"** multi-select (`size={5}`), **"Row Per
Page"** text input (default `27`). Go button disabled unless
`payrollMonth && searchCategory.length`. `PayrollReportResults` shows
`reportEmpty`/`reportMessage` from the server when applicable (unlike most siblings, this
screen surfaces a server-supplied empty message rather than only the client default).
`POST /api/payroll/salary-statement { fields: { payroll_month, search_category,
row_per_page, Submit: 'Generate' } }` → `loadSalaryStatement()`
(`server/src/services/payroll/salaryStatement.js`, `payrollSalaryStatementCore.js`).

### 3.8 Group Report — `/payroll/group-report` (`PayrollGroupReport.jsx`)

- **"Months"** — `<select multiple required size={5}>`.
- **"Category"** — `<select multiple required size={5}>`, disabled until months chosen.
- **"Report"** — radio group from `data.reportTypeOptions.filter(opt => opt.visible)`.
- Go button disabled unless `payrollMonths.length && searchCategory.length &&
  reportFor`.
- `POST /api/payroll/group-report { fields: { payroll_month: string[], search_category,
  report_for, Submit: 'Generate' } }` routed through
  `mountLegacyReportRoute('/group-report', 'group-report', ...)` →
  `loadPayrollLegacyReport('group-report', ...)`
  (`server/src/services/payroll/payrollLegacyReports.js`,
  `payrollGroupReportCore.js`).

### 3.9 Generate Payroll — `/payroll/generate-payroll` (`GeneratePayroll.jsx`)

This is the write-heavy attendance-linked payroll generation screen.
- **"Month"** — `<select required>`, options from `data.monthOptions`
  (`loadOpenPayrollMonthOptions(true)` — only months from `2018-04-01` onward that are
  **not yet fully closed** for `payroll_type='Salary'`; each option's `generated` flag
  renders with `style={{ backgroundColor: '#96CD6D' }}` if that category has a partial
  `staff_payroll_log` entry for the month).
- **"Category"** — `ChipMultiSelect` fed `data.categoryOptions` (each option annotated
  `note: '(generated)'` when `opt.generated`).
- **"Staff ID (optional)"** — `<textarea rows={3}>` placeholder **"Comma-separated staff
  IDs"** — restricts generation to specific staff.
- **Button: "Generate"** — `<button className="btn btn-lg btn-danger">`, disabled while
  `busy || generating || !payrollMonth || !searchCategory.length`.
- On submit: `POST /api/payroll/generate-payroll { fields: { payroll_month,
  search_category, g_staff_list, Submit: 'Generate' } }` →
  `loadGeneratePayroll()` (`server/src/services/payroll/generatePayrollCore.js`) resolves
  the staff list (`resolveStaffForGenerate()` — active staff in the chosen category,
  `releaving_date = '0000-00-00' OR releaving_date > payrollMonthSql`), returns
  `{ monthOptions, categoryOptions, selected, staff, canGenerate }`.
- The client then drives a **per-staff AJAX loop** (`runGenerateStep`): for each staff
  index, `GET /api/payroll/generate-payroll/more?flag=1&id&s_staff&pmonth&s_cate` →
  `runGeneratePayrollMore()` computes that staff's attendance-linked stats for the month
  (`computeStaffMonthAttendance()` — walks every day of the payroll period calling
  `getAttendance`/`modifiedAttendance`/`calDefaulterPending` from
  `services/attendance/staffAttendanceCore.js`, applying late/permission-to-LOP
  conversion rules from `basic_setup_payroll_tb`), upserts one row into
  `staff_payroll_tb` (insert if no existing row for `staff_id + payroll_month`, else
  update the attendance-derived columns only — money columns stay untouched on
  re-generate), and returns an HTML `<tr>` fragment that is appended live into the
  `#payroll` table body (`tbody.insertAdjacentHTML('beforeend', rowHtml)`). Table
  columns: **S.No, Staff ID, Name, Period, T.D, W.D, Pr, Le, Ab, La, Pe, LOP, %**.
- Progress text: `` `${index} of ${staffList.length} Generated...` ``, then
  `'Updating please wait...'` while the final `flag=2` call upserts `staff_payroll_log`
  (marks that `payroll_type` generated for the month; `payroll_complete` starts `0`).
- Progress bar: `.progress-bar-success` with `width` proportional to
  `current/total`.
- Error text on a failed step: **"Generation failed — use Refresh to retry from last
  row"** (message string literal in `GeneratePayroll.jsx:72`; unlike the stipend
  equivalent there is **no visible Refresh button** wired on this screen — the error text
  references one that doesn't render here, a UI gap vs. `StipendGeneratePayroll.jsx`
  which does render a `Refresh` button).

### 3.10 Attendance Report / Monthly Report / Tax Report — shared `PayrollFilterReport`

These three screens are **grouped explicitly** because they render through one shared
component, `PayrollFilterReport` in `client/src/pages/payroll/PayrollReportPages.jsx`,
parameterized only by `title`, `apiPath`, `legacy`, and `reportTypeField`:

| Export | `title` | `apiPath` | `legacy` | `reportTypeField` |
|---|---|---|---|---|
| `PayrollAttReport` | "Attendance Report" | `/api/payroll/att-report` | `payroll_report.php` | `report_type` |
| `PayrollMonthlyReport` | "Monthly Payroll Report" | `/api/payroll/monthly-report` | `payroll_monthly_report.php` | *(none)* |
| `PayrollTaxReport` | "Tax Report" | `/api/payroll/tax-report` | `staff_tax_report.php` | `report_type` |

Field set depends on `isMonthly = apiPath.includes('monthly')`:
- **Monthly variant** (`PayrollMonthlyReport` only): **"From Month"** select,
  **"To Month"** select, **"Report Columns"** multi-select (`size={4}`, options from
  `data.reportForOptions`).
- **Non-monthly variant** (Att/Tax): **"Month"** select (`-Select-` placeholder).
- Both: **"Category"** multi-select (`size={4}`), disabled with placeholder
  `Select month first` when non-monthly and no month chosen.
- When `reportTypeField` is set (Att, Tax): **"Show"** radio group, default options
  `{ value: 'Statement', label: 'Statement' }, { value: 'Report', label: 'Report' }`
  overridden by `data.reportTypeOptions` if present.
- **Go button** (danger style) disabled unless: monthly → `payrollFmonth &&
  payrollTmonth && reportFor.length`; else → `payrollMonth && searchCategory.length`.
- `POST {apiPath} { fields: {...} }` — Att/Tax route through
  `mountPayrollFormRoute('/att-report', loadPayrollAttReport, ...)` /
  `.../tax-report', loadPayrollTaxReport, ...)`
  (`payrollAttReportCore.js`, `payrollTaxReportCore.js`, both reading
  `staff_payroll_tb`/`staff_profile_tb`); Monthly routes to `loadPayrollMonthlyReport`
  (`payrollMonthlyReportCore.js`) which builds a multi-month deduction matrix.
- Empty/hint text is title-derived: `` `No ${title.toLowerCase()} data for the selected
  filters.` `` / `"Select filters and click Go to generate the report."`.

### 3.11 Payroll Setup Hub — `/payroll/setup` (`PayrollSetupHub.jsx`)

Static tile grid, title **"Payroll Setup"**, 16 tiles (exact titles): **Cover Page
Images**, **Cron Email Setup**, **Payroll Group Setup**, **PF / ESI Rates**, **Staff
Salary Setup**, **Salary Setup Report**, **Salary Advance Add**, **Salary Advance
Close**, **Salary Arrear Add**, **Salary Arrear Release**, **Other Deduction**, **LOP
Deduction**, **TDS Entry**, **Cheque Payment**, **Security Deposit Add**, **Security
Deposit Close**, **Payroll Close**.

### 3.12 Payroll Setup screens (dispatched by `PayrollSetupPage.jsx` + `usePayrollSetupApi`)

All of these load via `POST /api/payroll/setup/:screen/load { fields }` and save via
`POST /api/payroll/setup/:screen/save { fields, files }`, dispatched server-side by
`loadPayrollSetupScreen`/`savePayrollSetupScreen`
(`server/src/services/payroll/payrollSetup.js`) to per-screen modules under
`server/src/services/payroll/setup/`.

**Cover Page Images** (`individual-setup`, `setup/IndividualSetup.jsx` default export) —
table `data.rows` (S. No., Title = `bannerName`, Image preview `<img width=100
height=40>` or `—`, per-row `<input type="file" accept="image/jpeg,image/png,image/gif">`).
**Button: "Submit"** (`"Saving…"` while busy). Save posts `id[]`, `hd_banner_image[]`
hidden values plus base64 file payloads (`fileToUploadPayload`) named
`banner_image[i]`. Server: `setup/individualSetup.js`, page key
`payroll_individual_setup.php`, stores under `banner_image` column, served from
`/legacy/img/global_images/`.

**Cron Email Setup** (`cron-setup`, `CronSetup` export in same file) — **"Cron Type"**
select (`--Select One--` placeholder, `dept_name_ref`), **"Title"** input
(`dept_name`). When a type is selected: **"Status"** checkbox labelled **"Yes"**
(`c_status`), **"Day"** select `01`–`31` (`c_day`), and an editable grid — columns
**S. No., Name, Email, Del** — each row's **Delete** button opens a `ConfirmModal` with
message **"Are you sure to delete..."**; a **"+"** button (`btn-info btn-sm`) appends a
blank row client-side. **Button: "Save"** (danger). Delete confirm posts
`{ delete: 'Confirm', confirm: deleteId, dept_name_ref }`.

**Payroll Group Setup** (`payroll-config`, `PayrollConfigSetup` in
`setup/PayrollSetupScreens.jsx`) — **"Payroll Type"** select (`add-new` / existing
types from `data.typeOptions`, table `basic_setup_payroll_tb`), **"Title"**
(`payroll_title`), **"Payroll Start Day"** (`payroll_start`), **"TDS Limit"**
(`tds_limit`), then six Yes/No selects for **basic pay**, **basic margin**, **hra
allowance**, **d allowance**, **m allowance**, **c allowance** (field labels are the raw
field name with underscores replaced by spaces, e.g. "basic pay"), then **PF %**
(`pf_percentage`), **PF Limit** (`salary_limit`), **Min Late** (`minimum_late`), **Min
Permission** (`minimum_permission`), **Yearly Leave** (`yearly_leave`), **Yearly EL**
(`yearly_el`). **Button: "Update"**.

**PF / ESI Rates** (`pf-esi-setup`, `PfEsiSetup`) — **"Slab"** select (`add-new` /
existing, table `basic_pfesi_setup`), **"From (MM-YYYY)"** (`h_from_date`), **"To
(MM-YYYY)"** (`h_to_date`), then seven raw-named inputs: `epf_er`, `eps`, `adm_charge`,
`edli`, `adli_add`, `esi_min`, `esi_er`. **Button: "Update"**.

**Staff Salary Setup** (`salary-add`, `setup/SalaryAddSetup.jsx`) — left filter panel:
radio **"Search by"** → **Name** / **Staff ID** / **Category**; conditional select
(category) or text input; **"Go"** button (`btn-info`); scrollable result list of staff
buttons color-coded green (`selected`), red (`!hasCurrentSalary`), grey (default); text
**"No details found..."** (`text-danger`) when a search returns zero staff. Right panel
(after selecting staff): **PAN No.**, **Bank A/c No.**, **A/c Name**, **Branch**, **Bank
Name** (select from `basic setup category='Bank'`), **IFSC Code**, **PF Acc.No.**, **PF
UAN**, **ESI Number**, staff photo. Salary grid table columns: **S.No., From, To, PF,
ESI, Basic, Margin, D.A, HRA, Medical, Conveyance, Total** (+ delete icon column); money
inputs render as `<input type="hidden">` when the corresponding `policyFlags` field is
off (screen respects the Payroll Group Setup Yes/No flags per column); Total is
read-only, auto-summed client-side on any amount field change. **"+"** button adds a
blank salary row; a delete-row `<i className="fa fa-trash">` opens a
Bootstrap-style confirm modal (**"Are you sure to delete this salary row?"**, Close /
Confirm buttons). **Button: "Save"** (danger). Save posts all rows as parallel arrays
(`g_id[]`, `from_date[]`, `to_date[]`, `basic_pay[]`, …, `pf_calculation_{i}`,
`esi_calculation_{i}`) plus bank/PF/ESI fields, table `salary_tb` (insert/update) and
`staff_profile_tb` (bank fields).

**Salary Setup Report** (`salary-report`, `SalaryReportSetup`) — a category select +
**"Generate"** button (danger); for each staff in `data.report`, renders
**{staffId} — {name}** with a table **From / To / Total** of that staff's `salary_tb`
history.

**Salary Advance Add** (`salary-advance-add`, `setup/SalaryAdvanceAddSetup.jsx`) —
read-only **"Account Number"** (`data.advanceNo`), **"Staff"** select required, **"Type"**
select required (`data.advanceTypes`), **"Issued Month"** (`type="month"`, required),
**"Amount"** (`maxLength=11`, `inputMode="decimal"`, required), **"Detection from"**
(`type="month"`, required), **"Detection"** number input + `"Months"` suffix (digit-only
filter), **"Hold Month"** — `HoldMonthPicker` (chip multi-select, computed schedule
starting at Detection-from for Detection-count + already-selected-hold months, footer
text **"Select months to skip during the deduction schedule."**), **"Surety Staff (max
{n})"** — `SuretyStaffPicker` chip multi-select capped at `data.maxSurety` (default 2;
footer text: **"** — staff already acting as surety for two open records"**),
**"Documents"** file input (`.pdf,.jpg,.jpeg,.png,.gif`, helper text **"Supported: pdf,
jpg, png, gif. Max 10 MB."**), **"Approved By"** required. **Buttons: "Save"** (danger),
**"Reset"** (outline). Table `salary_advance`.

**Salary Advance Close** (`salary-advance-close`, `setup/SalaryAdvanceCloseSetup.jsx`) —
two-mode screen. **List mode**: search row **Account No**, **Staff ID**, month picker +
**"Search"** button; text **"Showing {n} entries"**; table **Receipt ID / Staff ID /
Staff Name / Amount / Issued Month / Deduct From / #Month** + Edit(pencil)/Delete(trash)
icon buttons; empty row **"No data available"**; delete opens a modal **"Are you sure to
delete..."** (Close/Confirm). **Edit mode** (`data.mode === 'edit'`): same fields as Add
plus a **"Close"** checkbox (`a_close`) that reveals a card with **Close Month**, **Close
Amount** (read-only, computed client-side by `computeCloseAmount()` — proportional to
elapsed months minus hold months), **Close Approved By**, and a two-row table
**Source/Month-Date/Amount/Bank Name** for **Salary** vs **Bank** close-out source
(checkboxes gate each row's inputs). Buttons **"Save"**, **"← Back"** (link-style, returns
to list preserving the search filters).

**Salary Arrear Add** (`salary-arrear-add`, `setup/SalaryArrearAddSetup.jsx`) — read-only
**"Account Number"**, **"Staff"** select required, **"Type"** select required
(`data.arrearTypes`), **"Amount"** (`maxLength=11`), **"Detection Month"** (`type="month"`
required), **"Reason"** textarea, **"Release"** checkbox (`a_close`) revealing
**Release Amount**, **Release Month**, **Release Approved By**, **Documents** file input.
Buttons **"Save"**, **"Reset"**. Table `salary_arrear`.

**Salary Arrear Release** (`salary-arrear-release`, `setup/SalaryArrearReleaseSetup.jsx`)
— same List/Edit two-mode pattern as Salary Advance Close but for `salary_arrear`; list
columns **Receipt ID / Staff ID / Staff Name / D.Amount / D.Month / R.Amount / R.Month**.

**Other Deduction / LOP Deduction / TDS Entry / Cheque Payment** — all four render
`PayrollMonthlyGridSetup.jsx` with different props (`amountLabel`, `showReason`,
`chequeMode`): `OtherDeductionSetup` (`amountLabel="Amount"`, reason shown),
`LopDeductionSetup` (`amountLabel="LOP"`, reason shown), `TdsAddSetup`
(`amountLabel="TDS"`, no reason), `ChequePaymentSetup` (`chequeMode`, cheque checkbox +
reason). Common fields: **"Month"** select (green-highlighted `generated` options same
convention as Generate Payroll), **"Category"** select, **"Go"** button (`btn-info`).
Once loaded, a per-staff grid (**#, Staff ID, Name**, then either **Amount/Reason**,
**LOP/Reason**, **TDS**, or **Cheque checkbox/Reason**) with **"Update"** button
(danger). Legacy pages: `staff_deduction_add.php`, `staff_lop_deduction.php`,
`staff_tds_add.php`, `staff_cheque_add.php`.

**Security Deposit Add / Close** — mirror Salary Advance Add/Close exactly (same
`HoldMonthPicker`/`SuretyStaffPicker` components, same field labels except **"Deduction
from"**/**"Deduction"** instead of "Detection from"/"Detection", and **"Joined Month"**
instead of "Issued Month", **"Security Amount"** instead of "Amount"), writing to table
`security_deposit`. Add screen shows a **"Last Added by {user} on {date}"** line when
`data.lastAdded` is present; Close-list shows **"Last Updated by {user} on {date}"**.

**Payroll Close** (`payroll-close`, `PayrollCloseSetup`) — **"Payroll Month"** select
(reflects `payrollComplete` per option from `staff_payroll_log`), **"Payroll Complete"**
checkbox. **Button: "Update"**, disabled unless a month is chosen. Save:
`POST .../save { Submit: 'Update', payroll_month, payroll_complete: '1'|'0' }` →
`setup/payrollCloseSetup.js`, table `staff_payroll_log`. This is the **overwrite-guard**
screen for re-generation (see §5 edge cases).

### 3.13 Stipend Hub — `/payroll/stipend` (`StipendHub.jsx`)

Title **"Stipend Payroll"**, breadcrumb `Home / Payroll / Stipend`, 9 tiles: **Generate
Payroll**, **Amount Setup**, **Deductions**, **Close Payroll**, **Attendance Report**,
**Stipend Payroll Report**, **Stipend Salary Statement**, **Stipend Individual Report**,
**Stipend PDF**.

### 3.14 Stipend Generate Payroll — `/payroll/stipend/generate-payroll`
(`StipendGeneratePayroll.jsx`)

Same shape as 3.9 but register-number based:
- **"Month"** select (row label via `StipendFilterRow`, `col-sm-2` label / `col-sm-4`
  field), options with `.month-option-generated` class when partially generated.
- **"Category"** — `ChipMultiSelect` grouped by course type (`categoryOptions` is an
  array of `{ group, items }`).
- **"Register No"** — `<textarea>` placeholder **"Optional — comma-separated register
  numbers"**.
- **Button: "Generate"** (`btn-lg btn-danger`), disabled unless
  `!busy && searchCategory.length`.
- AJAX loop identical in spirit to 3.9: `GET
  /api/payroll/stipend/generate-payroll/more?flag=1&id&s_staff&pmonth&tmonth&ac_year&s_cate`
  per student, appending `<tr>` HTML into `#payroll` table (columns **S.No, Register No,
  Student Name, T.D, W.D, Pr, Ab, La, Pe, Le, LOP, %**); then `flag=2` finalize call.
  Server: `stipendGenerateCore.js` writes to `stipend_payroll_tb`
  (insert/update per student+month) and `stipend_payroll_log` (per category+month).
- **Difference from staff Generate Payroll:** this screen *does* render a visible
  **"Refresh"** button (`btn-default btn-xs`) when a step fails mid-loop
  (`showRefresh` state), calling `handleRefresh()` which resumes from
  `resumeIndex` — the staff-payroll screen's equivalent error message references a
  Refresh action that has no button (see §3.9 note / §5 edge case).

### 3.15 Stipend Attendance Report — `/payroll/stipend/att-report`
(`StipendAttReport.jsx`)

**"Month"** select, **"Category"** `ChipMultiSelect` (appears once month picked),
**"Show"** radio **Statement**/**Report** (`report_type`), **"Generate"** button
(`btn-lg btn-danger`). On submit, `POST /api/payroll/stipend/att-report` loads the
report shell HTML (injected into `tableWrapRef`), then the same per-student AJAX loop
(`GET /api/payroll/stipend/att-report/more`) appends rows and finally injects
`signatureHtml`. **Print** button (shown once `rowCount > 0 && !generating`) builds a
themed print document via `buildAttendanceReportPrintHtml()` using `printMeta`
(title/subtitle/date range) and `bannerUrl`.

### 3.16 Stipend Payroll Report — `/payroll/stipend/report` (`StipendPayrollReport.jsx`)

**"Month"** select, **"Category"** `ChipMultiSelect` (help text: **"Categories are
loaded from generated payroll for the selected month."**), **"Report"** — grouped radio
grid (`reportTypeGroups`, each group has a title + option list; e.g. bank/PF/ESI/other
deduction report variants), **"Go"** button (`btn-lg btn-info`) disabled unless
`monthReady && searchCategory.length && reportFor`. `POST
/api/payroll/stipend/report { fields }` → `mountLegacyReportRoute('/stipend/report',
'stipend-report', ...)` → `loadPayrollLegacyReport('stipend-report', ...)`.

### 3.17 Stipend Salary Statement — `/payroll/stipend/statement`
(`StipendSalaryStatement.jsx`)

**"Month"**, **"Category"** `ChipMultiSelect`, **"Row Per Page"** number input
(min 1, max 100, default 27), **"Go"** button disabled unless `searchCategory.length`.
`POST /api/payroll/stipend/statement`.

### 3.18 Stipend Individual Report — `/payroll/stipend/individual-report`
(`StipendIndividualReport.jsx`)

**"Month"**, **"Copy"** radio (Original/Duplicate/Default), **"Go"** button
(`btn-lg btn-info`) disabled unless `payrollMonth`. Subtitle text: **"Month-wide payroll
dashboard and salary statement bundle."** `POST /api/payroll/stipend/individual-report`.
Print uses `printMeta`/`bannerUrl` via `buildAttendanceReportPrintHtml()` when present,
else falls back to printing the raw panel HTML.

### 3.19 Stipend Individual PDF — `/payroll/stipend/individual-pdf`
(`StipendIndividualPdfReport.jsx`)

**"Month"** select (placeholder **"Loading months…"** while `formLoading`), **"Copy"**
radio (Original/Duplicate/Default), **Button: "Go"** (`"Generating…"` while busy),
disabled while `formLoading || busy || !payrollMonth`. Note text: **"Note: Password for
the output file is the first 3 characters of the month followed by the 4-digit year
(e.g. jan2017, dec2016)."** On success: green alert **"PDF ready: {filename}"** with a
download link and, if `passwordHint` present, **"Password: first 3 letters of month +
4-digit year (e.g. `{passwordHint}`)"**. Busy banner: **"Building PDF bundle — this can
take 10–30 seconds for a full month."**. `POST /api/payroll/stipend/individual-pdf {
fields: { payroll_month, copy_type, Submit: 'Generate' } }` with an explicit **120000ms
(`PDF_GENERATE_TIMEOUT_MS`) axios timeout**; on `ECONNABORTED` the error message is
**"PDF generation timed out. Try again or choose a month with fewer students."** — see
§5 for the large-list performance edge case this guards against. Server:
`stipendIndividualPdfReport.js` (uses `stipendPdfNative.js` for PDF generation with
password protection).

### 3.20 Stipend Setup: Amount / Deduction / Close (`StipendSetupPage.jsx`)

- **Amount Setup** (`amount-setup`) — **"Stipend Type"** select (`--Select--`
  placeholder, `data.courseTypeOptions`), **"Amount"** text input bound to
  `data.record.stipendAmount`, **Button: "Update"** disabled unless `courseType` chosen.
  Table `stipend_amount_setup_tb`.
- **Deductions** (`deduction-add`, delegates to `setup/StipendDeductionSetup.jsx`) —
  **"Month"** select, **"Category"** select with `<optgroup>` per course-type group,
  **"Go"** button (`btn-info`). Once rows load: table **#, Register No., Student Name,
  Amount, Reason** with an **"Update"** button (`btn-danger btn-lg`); empty-state text:
  **"Select month and category, then click Go to load students."** Table
  `stipend_deductions`.
- **Close Stipend Payroll** (`payroll-close`) — **"Month"** select, **"Payroll
  Complete"** checkbox, **Button: "Update"** disabled unless a month is chosen. Table
  `stipend_payroll_log`.

## 4. Primary user stories

1. **As a payroll officer**, I want to select a **Month** on the Payroll Dashboard and
   see the salary summary render automatically, so that I can review that month's
   totals without a separate "Go" click.
   *Acceptance:* selecting a `monthOptions` value triggers `POST /api/payroll/dashboard`
   immediately (`onMonthChange` in `PayrollDashboard.jsx`); `reportHtml` renders in the
   card; "Generated by / on" text appears if the month was previously generated.

2. **As a payroll officer**, I want to filter the **Individual Report** by Month,
   Category, and Report type and click **Go**, so that I get the correct bank / PF / ESI
   payslip layout with the right **Row Per Page** pagination and **Copy** watermark.
   *Acceptance:* Go is disabled until all three (month, category, report type) are set;
   submitting posts `Submit: 'Generate'`; the resulting `exportMeta.title` drives which
   **Export XLS** button (bank/PF/ESI) appears.

3. **As a payroll officer**, I want to **Export XLS** from a generated bank/PF/ESI
   report, so that I can hand the file to the bank/PF/ESI office.
   *Acceptance:* clicking Export XLS calls `GET .../individual-report/export` with the
   correct `flag` (1=bank, 2=PF, 3=ESI) and opens `downloadUrl` in a new tab; if no file
   was produced, the error **"Excel file was not created"** is shown instead.

4. **As a payroll officer**, I want to run **Generate Payroll** for a Month + Category
   (optionally limited to specific Staff IDs), so that attendance-linked salary rows are
   computed and inserted into `staff_payroll_tb` for every eligible active staff member.
   *Acceptance:* Generate is disabled until Month + at least one Category is chosen;
   each staff row appears live in the table as it completes with a running progress bar
   and `{current} of {total} Generated...` label; after the loop, a finalize call marks
   `staff_payroll_log` for that category/month.

5. **As a payroll officer**, I want the **Category** dropdown on Generate Payroll to
   visually flag categories already generated for the selected month (green background,
   "(generated)" note), so that I don't accidentally regenerate without realizing data
   already exists.
   *Acceptance:* `data.categoryOptions[].generated` (from
   `loadCategoryGeneratedFlags()`) drives both the `<option style>` background and the
   `ChipMultiSelect` note text.

6. **As an accounts admin**, I want to add a **Salary Advance** for a staff member with
   Amount, Detection-from month, Detection months, optional Hold Months, and up to N
   Surety Staff, so that the monthly deduction schedule is correctly scheduled around
   holidays/exceptions.
   *Acceptance:* Hold Month options are computed live from Detection-from + Detection
   count (`buildHoldMonthOptions`); Surety Staff picker caps selection at
   `data.maxSurety`; Save posts `hmonth_list`/`surity_list` arrays plus an optional
   uploaded document.

7. **As an accounts admin**, I want to **close** an existing Salary Advance/Security
   Deposit by checking "Close", picking a Close Month, and seeing the **Close Amount**
   auto-computed, so that I don't have to hand-calculate the remaining balance.
   *Acceptance:* `computeCloseAmount()` derives the amount from elapsed months (minus
   held months) times the per-month deduction; the field is read-only and recalculates
   whenever Close Month changes.

8. **As a payroll officer**, I want to mark a payroll **Month Complete** on the Payroll
   Close screen, so that Generate Payroll no longer lists that month as open for that
   category (or flags it as already generated).
   *Acceptance:* checking "Payroll Complete" and clicking Update posts `payroll_complete:
   '1'`; `loadOpenPayrollMonthOptions()` excludes fully-closed months from the Generate
   Payroll month dropdown afterward.

9. **As a stipend administrator**, I want to run **Stipend Generate Payroll** for a
   Month + Category (grouped by course type) and, if a step fails, click **Refresh** to
   resume from the last completed student, so that a transient failure doesn't force
   restarting the whole batch.
   *Acceptance:* on a failed AJAX step, `showRefresh` becomes true and a visible
   **"Refresh"** button appears; clicking it calls `runGenerateStep(resumeIndex, ...)`
   using the stored `studentsRef`/`generateMetaRef`.

10. **As a stipend administrator**, I want to generate a password-protected **Stipend
    PDF** bundle for a month, so that I can distribute individual payslips to students
    securely by month + copy type.
    *Acceptance:* Go posts with a 120-second client timeout; on success a green banner
    shows the filename, download link, and password hint (`first 3 letters of month +
    4-digit year`).

## 5. Rare / edge-case user stories

1. **Staff who joined mid-month.** `computeStaffMonthAttendance()` in
   `generatePayrollCore.js` walks every calendar day of the payroll period but only
   counts a day if `joinedOk` (`m >= joinedSec`) — days before the join date are
   excluded from `totalDays`/`workingDays`/attendance tallies entirely, so a staff
   member joining on the 15th gets a payroll row scoped to the actual worked days, not
   a full-month baseline. *As a payroll officer, I want a mid-month joiner's generated
   payroll row to reflect only their worked days, so that their first salary isn't
   overstated or understated.*

2. **Staff on unpaid leave / LOP.** `calDefaulterPending()` results
   (`lopList.m`/`lopList.e`) directly convert morning/evening slots to "Absent" for LOP
   calculation regardless of the raw attendance status, and late/permission overages
   beyond `minimum_late`/`minimum_permission` (from `basic_setup_payroll_tb`) further
   inflate `monthlyLop`. *As a payroll officer, I want LOP days (including
   late/permission-converted LOP) to reduce the generated payroll's day counts
   correctly, so that unpaid leave is reflected without manual adjustment.*

3. **Stipend vs salary miscategorization.** The two systems are structurally separate
   (`staff_payroll_tb`/`staff_payroll_log` for salary vs `stipend_payroll_tb`/
   `stipend_payroll_log` for stipend, keyed by internal staff `id` vs student register
   number respectively) with **no shared validation** preventing a student who is also
   employed as staff from appearing correctly in only one system — this is a purely
   data-integrity risk inherent to running two independent generation pipelines rather
   than something the UI actively guards against. *As a payroll officer, I want
   confidence that a person generated under Salary Payroll for a month is not
   double-counted under Stipend Payroll for the same period, so that no one is paid
   twice from the same attendance data.*

4. **Re-generating an already-generated month.** Generate Payroll's month dropdown
   flags already-partially-generated months in green with a `(generated)` note
   (`data.categoryOptions[].generated`, §4.5), but **nothing blocks re-submission** —
   `runGeneratePayrollMore` simply `UPDATE`s the existing `staff_payroll_tb` row's
   attendance-derived columns in place when one is found
   (`generatePayrollCore.js:397-406`), silently overwriting the prior attendance
   snapshot with no confirmation dialog. *As a payroll officer, I want a warning (or at
   minimum, a visible "already generated" cue, which currently exists) before
   re-running Generate Payroll for a month/category that's already been generated, so
   that I don't accidentally wipe a hand-adjusted attendance override.* The month can
   also be fully locked via Payroll Close (`payroll_complete=1`), after which it drops
   out of `loadOpenPayrollMonthOptions()` and can no longer be selected for
   re-generation at all — that's the actual overwrite guard in this system.

5. **Consolidated totals not matching individual report sum.** The Consolidated Report
   sums `staff_payroll_tb` figures independently per selected month
   (`payrollConsolidatedCore.js`), while the Individual Report and per-staff bank/PF/ESI
   exports filter by `net_pay > 0` / `pf_amount > 0` / `esi_amount > 0` per row
   (`payrollIndividualReport.js:120-136`) — a staff member with a generated row but
   zero net pay (e.g., fully absorbed by deductions) is included in the Consolidated sum
   but silently excluded from the bank-transfer Excel export, so the two totals can
   legitimately diverge. *As a payroll officer reconciling reports, I want to understand
   why the Consolidated Report total doesn't match the sum of exported bank-transfer
   rows, so that I don't mistake a zero-net-pay staff member for a data error.*

6. **Staff/student with zero attendance records for the month.** `getAttendance()` /
   `modifiedAttendance()` are called for every calendar day regardless of whether any
   attendance rows exist; with no punches at all, the per-day status effectively
   defaults through the "absent" branches (no `p`/`le`/`la`/`pe` match), driving
   `workingDays` up and `present` to `0`, so `att_present` (`perAttend`) computes to
   `0%`. *As a payroll officer, I want a staff/student with zero attendance for the
   whole month to generate a payroll row showing 0% attendance and full LOP rather than
   crash or silently skip, so that I can catch missing-attendance-device staff before
   payment.*

7. **Bundled individual-report PDF generation for a large staff list (timeout).** The
   Stipend Individual PDF screen (`StipendIndividualPdfReport.jsx`) explicitly sets a
   **120000ms axios timeout** (`PDF_GENERATE_TIMEOUT_MS`) and a distinct error message
   for the timeout case: **"PDF generation timed out. Try again or choose a month with
   fewer students."** — this is a known, designed-around performance edge case (a full
   month's password-protected PDF bundle for every student can take 10–30+ seconds per
   the UI's own busy-banner copy, and can exceed 2 minutes for a large cohort). *As a
   stipend administrator generating PDFs for a large month, I want a clear timeout
   message telling me to retry or narrow scope, rather than an unexplained network
   error, so that I know the request needs to be split rather than being broken.* Note:
   the equivalent **staff** salary side has no dedicated bundle-PDF screen with this
   safeguard — `PayrollIndividualBundle.jsx` and `PayrollIndividualReport.jsx` use the
   default axios timeout with no special large-list handling, which is itself a gap.

## 6. Future / predicted user stories

### Future (not implemented)

These are speculative and grounded only in extrapolating the current REST-and-native-form
pattern plus [../mobile.md](../mobile.md)'s general mobile-client plan (§6 "Feature-by-
feature mapping" and §8 "Gaps to validate"). None of the following exists in the code
today; nothing here should be read as a current capability.

1. *As a staff member*, I want to view and download my own payslip from a self-service
   mobile screen, so that I don't have to ask the accounts office for a printed copy.
   (Speculative — `mobile.md` §6 lists Fees/Attendance/Exam as v1 read-only mobile
   screens but does **not** currently list Payroll; a "my payslip" view would need a new
   staff-scoped payroll read endpoint plus mobile PDF rendering via
   `expo-print`/`expo-sharing` per `mobile.md` §7.1.)

2. *As a payroll officer*, I want generated bank-transfer Excel exports to push directly
   into the bank's NEFT/RTGS upload API instead of producing a manual-upload CSV, so
   that disbursement doesn't require a separate manual bank-portal step. (Speculative —
   today `exportPayrollIndividualExcel()` only writes a local CSV file; no gateway
   integration exists, and `mobile.md` §8 flags "Fee payment gateway from mobile" as an
   unconfirmed, separately-scoped gap of the same shape.)

3. *As a stipend administrator*, I want the password-protected Stipend PDF bundle to be
   emailed or SMS'd directly to each student instead of requiring a manual download and
   distribution step, so that payslip delivery doesn't depend on a shared office
   download. (Speculative — extrapolating from the existing Cron Email Setup screen,
   which already emails payroll-related notifications to designated recipients on a
   schedule, to a per-student delivery channel that does not currently exist.)

4. *As a payroll officer*, I want push notifications when a Generate Payroll or Stipend
   Generate Payroll batch finishes (or fails partway through), so that I don't have to
   keep the browser tab open watching the progress bar. (Speculative — no push
   infrastructure exists anywhere in the backend; `mobile.md` §8 explicitly calls out
   push notifications as new backend surface requiring separate sign-off before any
   module, payroll included, could use it.)

5. *As an accounts admin*, I want the Salary Advance/Arrear/Security Deposit "Documents"
   file uploads to be viewable inline in a mobile document viewer with camera capture for
   the approval document, so that approvals can happen away from a desktop. (Speculative
   — `mobile.md` §7.5 describes the general `expo-image-picker`/`expo-document-picker`
   pattern for file uploads but does not list any payroll setup screen in its v1/v2
   scope.)

## 7. Traceability table

| Story | File(s) | Endpoint | Table(s) |
|---|---|---|---|
| Payroll Dashboard view | `PayrollDashboard.jsx`, `payrollDashboard.js`, `payrollReportCore.js` | `POST /api/payroll/dashboard` | `staff_payroll_log`, `staff_payroll_tb`, `staff_profile_tb`, `edu_setup_tb` |
| Individual Report + Excel export | `PayrollIndividualReport.jsx`, `payrollIndividualReport.js`, `payrollReportCore.js` | `POST /api/payroll/individual-report`, `GET /api/payroll/individual-report/export` | `staff_payroll_tb`, `staff_profile_tb`, `staff_payroll_log` |
| Individual Bundle | `PayrollIndividualBundle.jsx`, `payrollIndividualBundle.js`, `payrollIndividualBundleCore.js` | `POST /api/payroll/individual-bundle` | `staff_payroll_tb`, `staff_profile_tb` |
| Consolidated Report | `PayrollConsolidatedReport.jsx`, `payrollConsolidatedReport.js`, `payrollConsolidatedCore.js` | `POST /api/payroll/consolidated-report` | `staff_payroll_tb` |
| Salary Summary | `SalarySummary.jsx`, `salarySummary.js`, `payrollSalarySummaryCore.js` | `POST /api/payroll/salary-summary` | `staff_payroll_tb`, `edu_setup_tb` |
| Salary Statement | `SalaryStatement.jsx`, `salaryStatement.js`, `payrollSalaryStatementCore.js` | `POST /api/payroll/salary-statement` | `staff_payroll_tb` |
| Group Report | `PayrollGroupReport.jsx`, `payrollLegacyReports.js`, `payrollGroupReportCore.js` | `POST /api/payroll/group-report` | `staff_payroll_tb` |
| Generate Payroll (batch + per-staff AJAX) | `GeneratePayroll.jsx`, `generatePayrollCore.js`, `staffAttendanceCore.js` | `POST /api/payroll/generate-payroll`, `GET /api/payroll/generate-payroll/more` | `staff_payroll_tb`, `staff_payroll_log`, `staff_profile_tb`, `basic_setup_payroll_tb` |
| Attendance / Monthly / Tax reports | `PayrollReportPages.jsx`, `payrollAttReportCore.js`, `payrollMonthlyReportCore.js`, `payrollTaxReportCore.js` | `POST /api/payroll/att-report`, `/monthly-report`, `/tax-report` | `staff_payroll_tb`, `staff_profile_tb` |
| Cover Page Images | `setup/IndividualSetup.jsx`, `setup/individualSetup.js` | `POST /api/payroll/setup/individual-setup/load\|save` | banner-image config table |
| Cron Email Setup | `setup/IndividualSetup.jsx` (`CronSetup`), `setup/cronSetup.js` | `POST /api/payroll/setup/cron-setup/load\|save` | cron/email config table |
| Payroll Group Setup | `setup/PayrollSetupScreens.jsx` (`PayrollConfigSetup`), `setup/payrollConfigSetup.js` | `POST /api/payroll/setup/payroll-config/load\|save` | `basic_setup_payroll_tb` |
| PF / ESI Rates | `setup/PayrollSetupScreens.jsx` (`PfEsiSetup`), `setup/pfEsiSetup.js` | `POST /api/payroll/setup/pf-esi-setup/load\|save` | `basic_pfesi_setup` |
| Staff Salary Setup | `setup/SalaryAddSetup.jsx`, `setup/salaryAddSetup.js` | `POST /api/payroll/setup/salary-add/load\|save` | `salary_tb`, `staff_profile_tb`, `basic_setup_payroll_tb` |
| Salary Advance Add/Close | `setup/SalaryAdvanceAddSetup.jsx`, `setup/SalaryAdvanceCloseSetup.jsx`, `setup/salaryAdvanceSetup.js` | `POST /api/payroll/setup/salary-advance-add\|salary-advance-close/load\|save` | `salary_advance`, `staff_profile_tb` |
| Salary Arrear Add/Release | `setup/SalaryArrearAddSetup.jsx`, `setup/SalaryArrearReleaseSetup.jsx`, `setup/salaryArrearSetup.js` | `POST /api/payroll/setup/salary-arrear-add\|salary-arrear-release/load\|save` | `salary_arrear`, `staff_profile_tb` |
| Other Deduction / LOP / TDS / Cheque grids | `setup/PayrollMonthlyGridSetup.jsx`, `setup/monthlyGridSetups.js`, `setup/monthlyGridShared.js` | `POST /api/payroll/setup/other-deduction\|lop-deduction\|tds-add\|cheque-payment/load\|save` | deduction/TDS/cheque grid tables |
| Security Deposit Add/Close | `setup/SecurityDepositAddSetup.jsx`, `setup/SecurityDepositCloseSetup.jsx`, `setup/securityDepositSetup.js` | `POST /api/payroll/setup/security-deposit-add\|security-deposit-close/load\|save` | `security_deposit`, `staff_profile_tb` |
| Payroll Close | `PayrollSetupScreens.jsx` (`PayrollCloseSetup`), `setup/payrollCloseSetup.js` | `POST /api/payroll/setup/payroll-close/load\|save` | `staff_payroll_log` |
| Stipend Generate Payroll (batch + per-student AJAX) | `StipendGeneratePayroll.jsx`, `stipendGenerateCore.js`, `stipendAttendanceCore.js` | `POST /api/payroll/stipend/generate-payroll`, `GET /api/payroll/stipend/generate-payroll/more` | `stipend_payroll_tb`, `stipend_payroll_log`, `student_profile_tb` |
| Stipend Attendance Report | `StipendAttReport.jsx`, `payrollLegacyReports.js`, `stipendAttReportCore.js` | `POST /api/payroll/stipend/att-report`, `GET /api/payroll/stipend/att-report/more` | `student_profile_tb`, `student_academic_tb` |
| Stipend Payroll Report / Statement / Individual Report | `StipendPayrollReport.jsx`, `StipendSalaryStatement.jsx`, `StipendIndividualReport.jsx`, `payrollLegacyReports.js`, `stipendReportsCore.js` | `POST /api/payroll/stipend/report\|statement\|individual-report` | `stipend_payroll_tb`, `stipend_payroll_log` |
| Stipend Individual PDF | `StipendIndividualPdfReport.jsx`, `stipendIndividualPdfReport.js`, `stipendPdfNative.js` | `POST /api/payroll/stipend/individual-pdf` | `stipend_payroll_tb` |
| Stipend Amount Setup | `StipendSetupPage.jsx`, `setup/stipendAmountSetup.js` | `POST /api/payroll/setup/stipend-amount-setup/load\|save` | `stipend_amount_setup_tb` |
| Stipend Deductions | `setup/StipendDeductionSetup.jsx`, `setup/stipendDeductionSetup.js` | `POST /api/payroll/setup/stipend-deduction-add/load\|save` | `stipend_deductions` |
| Stipend Payroll Close | `StipendSetupPage.jsx`, `setup/stipendPayrollClose.js` | `POST /api/payroll/setup/stipend-payroll-close/load\|save` | `stipend_payroll_log` |
| All screens — audit logging | `payrollHelpers.js` (`logPayrollPage`) | (all routes, via `auditContextFromRequest`) | `log_tb` |
