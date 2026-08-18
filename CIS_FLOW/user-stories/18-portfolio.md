# 18 — Portfolio

## 1. Module overview

**Purpose.** The Student Portfolio module surfaces academic-achievement data that is entered
elsewhere in CIS (publications, seminars/conferences/workshops — presumably captured by
staff/students against `student_publication_tb` and `student_seminar_tb`, whose entry screens
were not in scope for this read) as two **read-only reporting** views: a college-wide dashboard
of aggregate counts by course/year, and a per-student detailed report suitable for printing an
individual's portfolio record (e.g. for placement, further-studies applications, or NAAC
evidence gathering — this module and NAAC read from largely disjoint tables, see
`17-naac.md` US-Future for a proposed bridge).

**Primary actors.**
- **Faculty/HOD/admin office staff** — review aggregate publication/seminar counts by
  course/academic-year on the Dashboard, and pull an individual student's full portfolio on the
  Individual Report.
- **Students** (indirectly — their entered publications/seminars are what the reports surface;
  there is no student-facing self-service screen in this module today).

**Legacy PHP files replaced:**

| Legacy file | Modern route |
|---|---|
| `student_portfolio_dashboard.php` | `/portfolio/dashboard` |
| `student_portfolia_individual_report.php` (note legacy filename's misspelling "portfolia") | `/portfolio/individual-report` |

## 2. Screen inventory

Unlike Certificates/NAAC/E-learning, Portfolio does **not** use the generic setup factory
(`createSetupApi`/`createModuleSetupPage`) — both screens are bespoke pages that call `api.post`/
`api.get` directly with their own local `useState`/`useEffect` load logic.

| Screen | Route | Component file | Server endpoint(s) | Legacy `.php` |
|---|---|---|---|---|
| Hub | `/portfolio` | `PortfolioModule.jsx` (`PortfolioHub`, via `createModuleHub`) | — | — |
| Dashboard | `/portfolio/dashboard` | `PortfolioDashboardPage.jsx` | `POST /api/portfolio/dashboard/load` | `student_portfolio_dashboard.php` |
| Individual Report | `/portfolio/individual-report` | `PortfolioIndividualReportPage.jsx` | `POST /api/portfolio/individual-report/load`, `GET /api/portfolio/individual-report/student/:studentId` | `student_portfolia_individual_report.php` |

Server routes (`server/src/routes/portfolio.js`) are gated by `authMiddleware` +
`menuAuthForModule('portfolio')`. There is no `/save` route in this module — it is entirely
read-only end to end (no service file writes any table; both service files only ever
`SELECT`).

## 3. Pixel-level flow per screen

### 3.1 Hub — `/portfolio`

`PortfolioHub = createModuleHub({ title: 'Student Portfolio', basePath: '/portfolio', metaMap: {},
dashboardPath: '/portfolio/dashboard', extraLinks: [{ to: '/portfolio/individual-report', title:
'Portfolia Report', desc: 'Individual portfolio report', icon: 'fa fa-file-text-o', section:
'Reports' }] })`. Note the extra-link's **title text is literally "Portfolia Report"** (matching
the legacy filename's misspelling, not corrected to "Portfolio Report") — this is the exact label
rendered on the hub tile and repeated as the page's `<PageHeader title="Portfolia Report" />` on
the Individual Report screen itself (see §3.3). `metaMap: {}` means there is no setup-screen list
on this hub — only the Dashboard link (from `dashboardPath`) and the one extra "Reports" link.

### 3.2 Dashboard — `/portfolio/dashboard` (`PortfolioDashboardPage.jsx`)

Custom load function `loadDashboard(payload)`: `POST /api/portfolio/dashboard/load` with
`{ fields: payload }`, guarded by a `requestIdRef` counter so a slower, superseded request cannot
overwrite the result of a newer one (out-of-order response protection — the same pattern
`createSetupApi` gives you for free via `loadSeq`, reimplemented by hand here since this page
doesn't use the factory).

Breadcrumbs: `Home → Student Portfolio (/portfolio) → Dashboard`. Header: `Student Portfolio
Dashboard` with a **"Back"** button (`btn btn-outline-secondary btn-sm`) linking to `/portfolio`.

Error banner (shown only on request failure): `alert-danger`, message resolution order —
`err.response?.data?.message` → (if `err.code === 'ECONNABORTED'`) `"Portfolio dashboard request
timed out"` → (if `err.message` includes `"Network Error"`) `"Could not reach server — is the API
running?"` → fallback `"Unable to load portfolio dashboard"`. Includes a **"Retry"** button
(`btn btn-sm btn-outline-danger`) that re-submits the last-used form values (read live from the
DOM via `formRef.current` if mounted, else the last known `fields` state).

Filter form (`id`-labeled fields, both `<select>`s disabled while their option list is empty):
1. **Label `htmlFor="portfolio-ug-year"` "U.G academic year"** — `<select id="portfolio-ug-year"
   name="ugYear">`, options `data.ugYearOptions` (`{value, label}` pairs).
2. **Label `htmlFor="portfolio-pg-year"` "P.G academic year"** — `<select id="portfolio-pg-year"
   name="pgYear">`, options `data.pgYearOptions`.
3. **"Go" submit button** (`btn btn-info`) — label toggles to `"Loading…"` while `loading` is
   true; disabled while loading or while `ugYearOptions` is empty.

Loading states:
- First load with no data yet: full-page `<PageLoading />`.
- Subsequent reloads (year filter changed) while `data` already exists: an overlay
  (`.portfolio-refresh-overlay`) with a spinner and `"Refreshing…"` text is layered over the
  **existing** stale content (`aria-busy={loading}`), rather than blanking the page — the old
  numbers stay visible (dimmed via `.portfolio-refresh-content`) until the new response lands.

Content (once `data` present):
1. **Summary tiles** (`row g-3 mb-4`, `col-6 col-md-4 col-lg-2` cards) — five tiles in order:
   `Overall`, `Publications`, `Seminars`, `Conference`, `Workshops`, each showing
   `data.summary.<key>` as a large number with a colored footer label
   (`background: var(--cis-primary)`).
2. **"Publications" heading** + table — columns `Course` + one column per
   `data.publicationTypes` entry (server hard-codes 14 types: `National Journal`, `International
   Journal`, `National Conference`, `International Conference`, `National Seminar`,
   `International Seminar`, `National Workshop`, `International Workshop`, `National Symposium`,
   `International Symposium`, `Book`, `Patency` [sic — legacy spelling of "Patent", not
   corrected], `Copyright`, `Other`). Rows are grouped by `courseName` (`U.G` before `P.G`,
   anything else appended after, via `groupByCourseName`/`COURSE_GROUP_ORDER`), each group
   preceded by a `table-secondary` header row spanning all columns showing the group name.
3. **"Seminars / Conferences / Workshops" heading** + table — columns `Course | Category |
   National | International`, same course-name grouping pattern.

Server (`loadPortfolioDashboard`): defaults `ugYear`/`pgYear` from `basic_setup_tb`
(`ug_academic_year`/`pg_academic_year`, matching CLAUDE.md's documented `loadAcademicConfig`
convention) if not supplied in `fields`. Restricts courses to `course_name IN ('U.G', 'P.G')`
only (no additional/EXAM year lists factored in here, unlike some exam screens per CLAUDE.md).
Counts are computed via two `GROUP BY` queries joining `student_publication_tb`/
`student_seminar_tb` → `student_academic_tb` → `basic_setup_course_tb`, filtered to the selected
academic year **per course type** (U.G rows must match `ugYear`, P.G rows must match `pgYear` —
a single query handles both via an `OR` on `course_name`). Seminar counts are restricted to
`category IN ('Seminar','Conference','Workshop')` and `ntype IN ('National','International')` —
any row with an out-of-set category/ntype value is silently excluded from all counts. Year-option
ranges (`ugYearOptions`/`pgYearOptions`) are computed as `MAX(config start year, actual max
academic_year found in student_academic_tb data)` down to a hardcoded floor (`2017` for UG,
`2018` for PG) — so the dropdown always includes at least the configured current year even if no
students exist yet for it, and extends further back only as far as real historical data goes.

### 3.3 Individual Report — `/portfolio/individual-report` (`PortfolioIndividualReportPage.jsx`)

Breadcrumbs: `Home → Student Portfolio (/portfolio) → Portfolia Report` (again, the misspelled
label). `<PageHeader title="Portfolia Report" actions={<Link to="/portfolio">Back</Link>} />`.

Left column — **Filter card**:
1. **"Search By"** — two radios (unlabeled `name="searchBy"`, no `id`/`htmlFor` pairing, label
   text wraps the input): `Roll No` (value `roll_no`) and `Batch` (value `batch`).
2. If `searchBy === 'roll_no'`: **input** placeholder `"Roll No. separated by ,"` + **"Go"**
   button (`btn btn-info`, disabled while `busy`) → `load({ searchInput, studentId: null })`
   (clears any previously selected student).
3. If `searchBy === 'batch'`: **`<select>`** placeholder `--Select--`, grouped by `<optgroup
   label={`${course.courseName} | ${course.label}`}>` per `data.courseOptions` entry, each
   group's options are `course.batchOptions` (`{value, label}`). `onChange` immediately calls
   `load({ searchCourse: value, studentId: null })` (no separate "Go" button needed for the batch
   path — selecting the dropdown fires the search).
4. **Matched-student list** — buttons styled `btn-success` (selected) or `btn-outline-secondary`
   (not selected), text `{registerNo} - {name}`. `busy && !data?.students?.length` shows
   `"Loading..."` text above the list while the very first search for a set of students is still
   in flight.

Right column — student detail (`StudentDetail` component). If `detail` is falsy:
`<p className="text-danger">No details found...</p>`. Otherwise three stacked cards:

1. **"Student" card** — Name, Roll No, `{academicYear} | {courseName}`; right-aligned photo
   (`80×100`) if `student.photoUrl` resolves (via `studentIdCardPhotoUrl`, shared with other
   student-photo lookups — see `certificate/certificateInternship.js`'s similar
   `legacyPhotoUrl` pattern for the sibling ID-card convention).
2. **"Seminars & Conference" card** — table columns `Sl.No | Particular | Type | Location | From
   - To Date | Web Links`. "Particular" is `{ntype} {category}` concatenated (e.g. "National
   Seminar"). "Web Links" renders up to 3 possible links (`p_download_link`,
   `p_download_link_1`, `p_download_link_2` — only non-empty ones) each as `Link{n}` anchor tags.
   Empty state: `<tr><td colSpan={6} className="text-muted">No records</td></tr>`.
3. **"Publications" card** — a denser table with a **two-row-per-publication** layout:
   row A has 10 columns (`Sl.No` rowSpan 2, `Journal`, `Name of Publication & Title` [shows
   `publicationName` then bold `title` on a line break], `Title of the Paper & Author Name`
   [really the author field, mislabeled in the header — this is `row.author`, i.e.
   `p_author_name`], `Location`, `Month & Year`, `Volume & Page No`, `Points`, `Category`,
   `Authorship`, plus `Web Links` and `Attachment` both rowSpan 2); row B is a single
   `colSpan={9}` cell showing the abstract (`p_abstract`) beneath row A. Empty state: `<tr><td
   colSpan={12} className="text-muted">No records</td></tr>`.

Search flow (`load(payload)`): `setBusy(true)`, `POST /api/portfolio/individual-report/load` with
merged fields, then unconditionally overwrites `fields` state from the **response**'s
`searchBy`/`searchInput`/`searchCourse`/`studentId` (server-normalized echo-back, not just the
request payload — so if the server defaults `searchBy` to `'roll_no'` when unset, the radio UI
reflects that). `selectStudent(studentId)` is a **separate, lighter-weight** call:
`GET /api/portfolio/individual-report/student/:studentId` (not a re-run of the full search) that
only refreshes `detail` and the `selected` flag on the existing `students` list — this avoids
re-querying the student list every time the user just clicks a different name in an
already-loaded batch/search result.

Server (`portfolioIndividualReport.js`):
- `searchPortfolioStudents({by, q, studentId})` — for `by:'roll'`, splits `q` on commas, builds an
  `OR` of exact `register_no=` matches (**no wildcard/partial match** — a roll number must be
  typed exactly, comma-separated for multiple). For `by:'batch'`, `q` must be a
  `courseId___admissionYear` key (parsed via `split('___')`) — **this is the plain
  `courseId___year` format**, not `courseId___year___type` (exam) nor `courseId___year___batch`
  (fee) — see CLAUDE.md's course-key-format table; always verify against this file's actual
  parsing before reusing a course-key builder from elsewhere. Both queries filter
  `student_profile_tb WHERE del=1 AND course_id != 1` (hardcoded exclusion of `course_id=1` — a
  specific course, e.g. "unassigned"/placeholder, is always excluded from portfolio search
  regardless of which course-key was used to build the batch dropdown itself).
- The **first result in the list is auto-selected** if no `studentId` was explicitly requested
  (`(index===0 && !selectedId) || selectedId===Number(row.id)`), so searching by roll numbers or
  batch immediately shows a detail panel without requiring an extra click, for the first match.
- `courseOptions` is sourced from `getStudentCourseOptions()` (shared helper,
  `server/src/services/students/studentCourses.js`) filtered to exclude `id !== 1` (same
  exclusion as above, applied to the dropdown-building side too).
- `loadStudentDetail`: publications ordered `p_year ASC, p_month ASC`; month is rendered via a
  hardcoded `MONTHS` array (`['', 'Jan', ... 'Dec']`, index 1–12) — an out-of-range `p_month`
  value (0, negative, >12, or non-numeric) resolves to `undefined` at that array index and is
  coerced to the empty string by the template literal, so `monthYear` degrades to just `-{year}`
  with the leading dash stripped by the trailing `.replace(/^-/, '')`.

## 4. Primary user stories

**US-18.1 — Review aggregate portfolio counts by course and academic year**
As a **HOD/faculty/admin office staff member**, I want to select a U.G and P.G academic year on
the Portfolio Dashboard and see summary tiles plus per-course breakdowns of publications and
seminars/conferences/workshops (split National vs International), so that I can gauge overall
research/extracurricular output for an accreditation cycle or department review.
*Acceptance criteria:* changing either year dropdown and clicking "Go" refreshes the tiles/tables
via an overlay (old data stays visible, dimmed, during the refresh — not blanked); publication
and seminar tables both group rows by `U.G` then `P.G` then any other course name; year dropdown
ranges always include the currently configured academic year even with zero data.

**US-18.2 — Look up an individual student's full portfolio**
As a **faculty/admin office staff member**, I want to search a student by roll number(s) or by
picking a course+batch, see the matched student list, and view their full publications and
seminars/conferences detail (with clickable web links and an attachment link where present), so
that I can produce or verify a single student's portfolio record.
*Acceptance criteria:* searching by roll number requires an exact match (comma-separated for
multiple rolls, no partial/fuzzy match); the first matched student's detail auto-loads without an
extra click; clicking a different student in the list only re-fetches that student's detail (not
the whole search), keeping the search results list stable.

**US-18.3 — Handle student photo, links, and abstract gracefully**
As a **faculty/admin office staff member** viewing a student's detail panel, I want the ID photo
to render only if one exists, publication/seminar web links to render only for the non-empty link
slots (up to 3), and the abstract to appear beneath each publication row, so that missing data
doesn't produce broken images or empty link clutter.
*Acceptance criteria:* a student with no `photoUrl` shows no `<img>` at all (not a broken-image
icon); a publication with zero download links shows no "Link" anchors.

## 5. Rare / edge-case user stories

**US-18.4 — Student with an empty portfolio**
As a **faculty/admin office staff member**, if I search for and select a student who has no rows
in `student_seminar_tb` or `student_publication_tb`, I still see the "Student" card (name, roll
no, course) populated correctly, but the "Seminars & Conference" table shows `"No records"` and
the "Publications" table shows `"No records"` — the page never errors or shows a blank screen for
a student with zero portfolio entries, distinguishing this from "no student found" (`"No details
found..."`, shown only when `detail` itself is null, i.e. no matching student at all).

**US-18.5 — Report generation for a student with an unusually large attachment/publication count**
As a **faculty/admin office staff member** viewing a highly prolific student/staff record (e.g.
50+ publications), the Individual Report renders **every** publication row unpaginated (there is
no `LIMIT`/pagination on `loadStudentDetail`'s publication or seminar queries — both are plain
`SELECT ... WHERE student_id = ... ORDER BY ...` with no page size), so the two-row-per-publication
table can become very tall; the page also has no print-specific stylesheet reference in this
component (unlike Certificates' `printReport.js` integration), so printing relies on the browser's
default print rendering of the full unpaginated table — for a very large portfolio, consider that
this could produce a long, awkward print job rather than a paginated report.

**US-18.6 — Batch search with a malformed course/year key**
As a **faculty/admin office staff member**, if the batch `<select>`'s `value` is somehow set to a
key that doesn't split into exactly two `___`-separated parts (should not happen through normal
UI use since options come from the server-built `courseOptions`, but is possible via a stale
cached option list after a course is deleted/renamed), `searchPortfolioStudents` returns an empty
array silently (`if (!courseId || !admissionYear) return [];`) rather than erroring — the screen
would just show an empty student list with no error message, which could look like "no students
in this batch" rather than "the batch key was invalid."

**US-18.7 — Publication with an out-of-range month value**
As a **faculty/admin office staff member**, if a publication's `p_month` was stored outside 1–12
(data-entry error upstream, since this module never writes the value itself), the "Month & Year"
column silently drops the month text and shows just the year (e.g. `-2023` becomes `2023` after
the leading-dash strip) — there's no visual flag that the month value was invalid versus simply
blank on purpose.

### Future (not implemented)

- *(Future — not implemented)* **Student self-service portfolio builder**: today, publications
  and seminars are entered by staff into `student_publication_tb`/`student_seminar_tb` through
  screens outside this module's scope (not read as part of this document); a natural extension —
  consistent with the "read + light-write" mobile principle in `mobile.md` §6 — would be a
  student-facing self-service form to submit their own publications/seminars for staff approval,
  feeding the same tables the Dashboard and Individual Report already read from. Not present
  anywhere in the current codebase.
- *(Future — not implemented)* **Pagination or "load more" for very large individual reports**,
  directly addressing US-18.5 — capping the publications/seminars table at, say, 25 rows per page
  with a page control, matching the pagination pattern already used elsewhere in the app (e.g.
  Certificates' `receipt-report`/`tc-details` screens use `pagination.page`/`pageSize`).
- *(Future — not implemented)* **Dedicated print/export stylesheet** for the Individual Report,
  mirroring the `printHtml`/`ReportPrintBar` pattern used by Exam/Fees screens (per CLAUDE.md's
  "Print / reports" section), so a student's portfolio can be printed as a clean formatted
  document instead of relying on default browser print of the live table.
- *(Future — not implemented)* **Mobile read-only portfolio view**: per `mobile.md` §6, a
  student-facing mobile screen showing "my portfolio" (their own publications/seminars, read-only)
  would reuse `GET /api/portfolio/individual-report/student/:studentId` as-is once the mobile app
  can resolve "the logged-in student's own studentId" — not yet wired to any student-scoped auth
  path in the routes read here (today's route takes an arbitrary `:studentId` param with only
  module-level `menuAuthForModule('portfolio')` gating, not an ownership check).

## 6. Traceability

| Story | Client file(s) | Server endpoint | Service file | Table(s) |
|---|---|---|---|---|
| US-18.1 | `PortfolioDashboardPage.jsx` | `POST /api/portfolio/dashboard/load` | `portfolioDashboard.js` | `basic_setup_tb`, `basic_setup_course_tb`, `student_publication_tb`, `student_seminar_tb`, `student_academic_tb` |
| US-18.2 | `PortfolioIndividualReportPage.jsx` | `POST /api/portfolio/individual-report/load`, `GET /api/portfolio/individual-report/student/:studentId` | `portfolioIndividualReport.js` | `student_profile_tb`, `student_seminar_tb`, `student_publication_tb`, `basic_setup_course_tb` |
| US-18.3 | `PortfolioIndividualReportPage.jsx` (`StudentDetail`) | `GET /api/portfolio/individual-report/student/:studentId` | `portfolioIndividualReport.js` (`studentIdCardPhotoUrl`) | `student_profile_tb`, `student_publication_tb` |
| US-18.4 | `PortfolioIndividualReportPage.jsx` (`StudentDetail`) | `POST /api/portfolio/individual-report/load` | `portfolioIndividualReport.js` | `student_seminar_tb`, `student_publication_tb` |
| US-18.5 | `PortfolioIndividualReportPage.jsx` (`StudentDetail`) | `GET /api/portfolio/individual-report/student/:studentId` | `portfolioIndividualReport.js` (`loadStudentDetail`) | `student_publication_tb`, `student_seminar_tb` |
| US-18.6 | `PortfolioIndividualReportPage.jsx` | `POST /api/portfolio/individual-report/load` | `portfolioIndividualReport.js` (`searchPortfolioStudents`) | `student_profile_tb` |
| US-18.7 | `PortfolioIndividualReportPage.jsx` (`StudentDetail`) | `GET /api/portfolio/individual-report/student/:studentId` | `portfolioIndividualReport.js` (`loadStudentDetail`) | `student_publication_tb` |
