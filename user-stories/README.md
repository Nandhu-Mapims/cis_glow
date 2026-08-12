# New CIS — User Stories (by module)

> One file per module, pixel-level detail: exact screen fields/labels/buttons as they exist in
> the code today (not paraphrased), primary user stories, rare/edge-case user stories, and
> forward-looking "future" stories (clearly marked, not yet implemented). Companion to the
> single-file overview at [../userstory.md](../userstory.md), which stays as the short
> cross-module summary — these files are the deep-dive per module.
>
> Every file cites concrete file paths (`client/src/pages/...`, `server/src/services/...`,
> `server/src/routes/...`) and legacy `.php` filenames so each story can be verified against
> the real code, not just prose.

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

## File template each module follows

1. **Module overview** — purpose, primary actors, legacy PHP source files it replaces.
2. **Screen inventory** — every screen in the module: route, component file, legacy `.php` counterpart.
3. **Pixel-level flow per screen** — fields in DOM order, labels exactly as rendered, input types,
   dropdown option sources, buttons/actions, validation messages, loading/empty/error states,
   what the save call sends and what it returns.
4. **Primary user stories** — happy-path, tied to the concrete fields/buttons above.
5. **Rare / edge-case user stories** — permission denial, zero-dates, concurrent edits, empty
   datasets, legacy-parity mismatches, network/API failure, large datasets, duplicate keys.
6. **Future / predicted user stories** — explicitly labeled *(Future — not implemented)*,
   grounded in [../mobile.md](../mobile.md) and realistic extrapolation of the current pattern,
   never presented as if they already exist.
7. **Traceability table** — story → file/endpoint/table.
