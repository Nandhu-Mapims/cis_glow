# Library Module — Legacy CIS Flow Documentation

> Source: `/home/mapims/cis/cis/*.php` (live legacy PHP tree). All SQL, field names and
> logic below were read directly from the PHP source and cross-checked against the live
> menu table (`basic_admin_menu_tb`) and table schemas in MariaDB `apdchedu_cisapp`.
> This document is the parity contract for rewriting the Library module — do not
> deviate from the SQL/behavior described here without re-checking the cited legacy file.

## Module overview

"Library" in legacy CIS covers:

1. **Dashboard** — counts of resources by branch/category, staff & student in/out
   attendance, and issue/return/due activity, with click-through drill-down reports.
2. **Attendance / entry-exit tracking** — two independent, *not interoperating*
   attendance pipelines:
   - A hardware/RFID-fed pipeline (table `library_attendance`) — read-only from the
     app's point of view, populated by an external sync job (`log_page='cron_library'`).
     Dashboard and reports read from this table.
   - A webcam/manual-entry pipeline (table `library_image_att_tb`), driven by
     `library_attendance.php` (webcam snapshot) and `library_att_entry.php` (manual
     time-grid entry). **Both screens are currently disabled in the menu**
     (`menu_enable=0`) and nothing in the app reads `library_image_att_tb` back out
     for the dashboard — see Open Questions.
3. **Book / resource catalog** — categories (branch/resource-type/source/subject/
   transfer-destination), add, edit/search/delete, and a printable/searchable report
   (staff-facing) plus a public-style OPAC search (`resources_report.php`).
4. **Book issue / return transactions** — circulation desk screens with barcode
   scanning support, issue-limit and loan-duration enforcement, damage flagging, and
   inter-department book transfer / receipt tracking.
5. **Barcode printing** and **daily/period summary reports**.

### Screen inventory (menu-verified)

Verified 2026-08 against `basic_admin_menu_tb` (`sub_menu_link`, `menu_enable`, `del=1`):

| Menu label | Legacy file | Enabled | Notes |
|---|---|---|---|
| Library Dashboard | `dashboard_library.php` | 1 | |
| Barcode | `resources_barcode.php` | 1 | |
| Book Issue | `library_transaction1.php` | 1 | student/staff-first flow |
| Book Return | `library_transaction.php` | 1 | book-first flow |
| Category | `library_book_cate.php` | 1 | |
| Daily Summary | `library_entry_report.php` | 1 | |
| Library Att. | `library_attendance.php` | **0 (disabled)** | webcam manual attendance |
| Manual Entry | `library_att_entry.php` | **0 (disabled)** | manual attendance time-grid |
| Library Att. Report | `lib_attendance_report.php` | 1 | present in menu, no PHP file links to it directly — reached only via sidebar |
| Limit Setup | `transaction_setup.php` | 1 | issue-limit/duration config, no PHP file links to it directly |
| OPAC | `resources_report.php` | 1 | |
| Resources ▸ Resources Add | `library_book_add.php` | 1 | |
| Resources ▸ Resources Edit | `library_book_edit.php` | 1 | list/search/edit/delete |
| Resources ▸ Report | `library_book_report.php` | 1 | |
| Transfer | `resource_transfer.php` | 1 | inter-department book transfer |

Not in the menu table, but reached via `window.open()` from the dashboard (drill-down
report window, no sidebar entry of its own):

| File | Reached from |
|---|---|
| `dashboard_lib_report.php` | `dashboard_library.php` JS `callstaffattendance/callstudentattendance/callstafftrans/callstudenttrans/calltrans/callbooks/calltotalattendance()` |

AJAX/partial-response helpers (not standalone pages, no menu entry, called only via
`$.ajax`):

| File | Called from |
|---|---|
| `transaction_more.php` | `library_transaction.php` (Book Return, book-first) |
| `transaction_more1.php` | `library_transaction1.php` (Book Issue, student-first) |
| `library_book_more.php` | `library_book_add.php` (`checkavailable()` — accession-no availability check) |
| `resource_transfer_more.php` | `resource_transfer.php` |
| `library_attendance_more.php` | `library_attendance.php` (webcam snapshot handler) |
| `lrecord.php` | `library_attendance.php` (raw webcam JPEG upload sink, called by `webcam.js`) |

### Superseded / dead duplicate files (do not use as parity source)

These co-exist on disk with a newer, unsuffixed, menu-active file. They are **not**
referenced by the menu table or by any other PHP file — do not port their behavior;
only the unsuffixed files listed above are live.

| Dead file | Superseded by | Diff summary |
|---|---|---|
| `library_book_add_10102023.php` | `library_book_add.php` | Older file predates the E-Book upload feature (`ebook_attachment`, `reference_copy` handling) |
| `library_book_edit_10102023.php` | `library_book_edit.php` | Same — missing e-book upload/replace logic and `is_damage` niceties present in the live file |
| `library_book_report_10102023.php` | `library_book_report.php` | Missing "E-book" column / `ebook_attachment` link |
| `resources_report_10102023.php` | `resources_report.php` | Missing "E-Book" column / `ebook_attachment` link |
| `dashboard_library_1.php` | `dashboard_library.php` | Large diff (495 lines) — an earlier dashboard layout iteration |
| `dashboard_library_v1.php` | `dashboard_library.php` | Large diff (204 lines) — another earlier iteration |

### Files that exist but are not part of this module's live surface

- `library_att_report.php`, `library_att_report_2.php` — not present in
  `basic_admin_menu_tb` and not `include`/linked from any other `.php` file in the
  repo. Likely superseded by `dashboard_lib_report.php` (flag 1/3/7) and
  `lib_attendance_report.php`. Do not port.
- `staff/dashboard_library.php`, `staff/dashboard_lib_report.php`,
  `staff/resources_report.php`, `staff/staff_book_history.php`,
  `staff_new/…`, `student/…` — these live under separate **self-service portal**
  applications (staff portal / student portal), not the back-office admin app
  documented here. They read the same tables but are a distinct, smaller
  read-only surface; out of scope for this document.
- `resource_transfer_more.php`'s parent `resource_transfer.php` uses `include('config.php')`
  instead of `include('widget.php')` (unlike every other screen in this module) — it
  does not get `$a_username`/audit globals from `widget.php`'s bootstrap the same way;
  confirm behavior at runtime if porting (see Open Questions).

---

## Table of contents

1. [Library Dashboard — `dashboard_library.php`](#1-library-dashboard--dashboard_libraryphp)
2. [Dashboard drill-down report — `dashboard_lib_report.php`](#2-dashboard-drill-down-report--dashboard_lib_reportphp)
3. [Category — `library_book_cate.php`](#3-category--library_book_catephp)
4. [Resources Add — `library_book_add.php`](#4-resources-add--library_book_addphp)
5. [Resources Edit — `library_book_edit.php`](#5-resources-edit--library_book_editphp)
6. [Resources Report — `library_book_report.php`](#6-resources-report--library_book_reportphp)
7. [OPAC — `resources_report.php`](#7-opac--resources_reportphp)
8. [Barcode — `resources_barcode.php`](#8-barcode--resources_barcodephp)
9. [Book Issue — `library_transaction1.php` (+ `transaction_more1.php`)](#9-book-issue--library_transaction1php--transaction_more1php)
10. [Book Return — `library_transaction.php` (+ `transaction_more.php`)](#10-book-return--library_transactionphp--transaction_morephp)
11. [Transfer — `resource_transfer.php` (+ `resource_transfer_more.php`)](#11-transfer--resource_transferphp--resource_transfer_morephp)
12. [Daily Summary — `library_entry_report.php`](#12-daily-summary--library_entry_reportphp)
13. [Library Att. Report — `lib_attendance_report.php`](#13-library-att-report--lib_attendance_reportphp)
14. [Limit Setup — `transaction_setup.php`](#14-limit-setup--transaction_setupphp)
15. [Library Att. (disabled) — `library_attendance.php` (+ helpers)](#15-library-att-disabled--library_attendancephp--helpers)
16. [Manual Entry (disabled) — `library_att_entry.php`](#16-manual-entry-disabled--library_att_entryphp)

---

## 1. Library Dashboard — `dashboard_library.php`

**Purpose:** Landing page for the Library module. Shows resource-count tiles by
branch/department, a "Total Summary" of resource types, "Issue/Return" activity for
Today/Yesterday/This Week/Last Week/This Month/Last Month/Total, staff & student
in/out attendance counts, and per-category staff/student book issue-return-due
counts. Every number is clickable and opens `dashboard_lib_report.php` in a popup
window for the detail list.

**Entry point / menu:** Sidebar → "Library Dashboard" → `dashboard_library.php`.

**Page layout (top→bottom):**
- Breadcrumb, hidden `attendance_date` filter field (date picker, format `dd-mm-yyyy`,
  `endDate` = today; posted as `attendance_date`, defaults to current date if blank).
- Row 1 (3 tiles):
  - **Total Summary** — table of `Resources | Total`, one row per active
    `book_category_tb` row where `category='Resource'` (first 6 by `category_order`),
    with `Total` = count of `book_tb` rows with `resource_type` = that category id.
  - **Issue/Return** — table `Days | I | R | D` for buckets `Today, Yesterday, This
    Week, Last Week, This Month, Last Month, Total`. I/R/D = counts of
    `library_transaction_tb` joined to `book_tb` filtered by `check_out_date` /
    `check_in_date` / `due_date` falling in the bucket range (Total = no date filter).
  - **Attendance** (from `ssAttendance()`) — per-course-year and per-staff-category
    In/Out counts, computed from `library_attendance` (see business logic below), plus
    a grand "Total" row.
- Row 2: `staffLibraryAttendance()` output — 3 tiles: Staff In/Out summary tile
  (`Staff` panel with big numbers + "Last sync" timestamp from
  `log_tb` where `log_page='cron_library' AND log_operation='Sync'` ordered by
  `log_timestamp DESC LIMIT 1`), Staff In/Out table by `edu_setup_tb.job_category`
  (excludes `hostel`, `Teaching Basic Science`, `College Support` categories), and
  Staff Book Issue/Return/Due table by the same categories.
- Row 3 (if called for U.G/P.G via `studentLibraryAttendance()` — invoked inline as
  part of `ssAttendance()`, not separately rendered as its own row in the final HTML
  in the current file — see Business logic notes) student per-year In/Out and
  Issue/Return/Due tables.
- Final row: **Resource count tiles by branch** (`LibraryBook()`): one tile per active
  `book_category_tb` row where `category='Department'`, tile count = count of
  `book_tb` rows (`del=1`) whose `resource_department` matches that branch id (stored
  as a comma-joined string, matched via `=`, `LIKE 'id%,'`, `LIKE ',%id'`,
  `LIKE ',%id%,'`), plus a synthetic **"Other"** tile for books whose department does
  not match any configured branch. Clicking a tile opens `dashboard_lib_report.php`
  with `flag=6`.

**Data source (load) — key queries:**
- Resource totals: `SELECT id FROM book_tb WHERE del=1 AND resource_type='<catId>'`.
- Branch totals: `SELECT id FROM book_tb WHERE del=1 AND (resource_department='<id>'
  OR resource_department LIKE '<id>%,' OR resource_department LIKE ',%<id>' OR
  resource_department LIKE ',%<id>%,')`.
- Staff categories: `SELECT DISTINCT(B.id),B.category_sname FROM staff_profile_tb AS
  A INNER JOIN edu_setup_tb AS B ON A.job_category=B.id WHERE A.del=1 AND
  (A.releaving_date > '<date>' OR A.releaving_date='0000-00-00') AND
  B.category='Category' AND B.category_name NOT IN ('hostel','Teaching Basic
  Science','College Support') ORDER BY A.job_category ASC`.
- Staff attendance in/out (parity logic, see below):
  `SELECT A.id, B.id FROM staff_profile_tb AS A INNER JOIN library_attendance AS B ON
  (A.staff_id=B.tktno OR CONCAT('0',A.staff_id)=B.tktno) WHERE A.del=1 AND
  A.job_category='<cid>' AND date(B.p_date)='<current_date>' GROUP BY B.id`.
- Staff issue/return/due: three separate `library_transaction_tb` ⋈ `staff_profile_tb`
  queries filtered by `check_out_date`, `check_in_date`, `due_date` respectively
  (due query additionally requires `check_in_date='0000-00-00'`).
- Academic year lookup: `SELECT * FROM basic_setup_tb WHERE del=1` →
  `ug_academic_year` / `pg_academic_year`.
- Student course list: `SELECT * FROM basic_setup_course_tb WHERE del=1 AND
  course_name='<U.G|P.G>' ORDER BY c_order ASC`.

**Save/submit behavior:** none — read-only dashboard. Every view logs to `log_tb` via
`insert_log()` with operation `View`.

**Business logic / edge cases:**
- **In/Out parity trick:** the app has no reliable "in" vs "out" flag it trusts from
  the hardware feed (despite `library_attendance.in_out` existing as a column — see
  Open Questions); instead, for each person it fetches all `library_attendance` rows
  for the day (`GROUP BY B.id`), and counts a running per-person counter: odd hits =
  "In", even hits = "Out". This same parity algorithm is repeated near-verbatim in
  `dashboard_library.php`, `dashboard_lib_report.php`, `library_entry_report.php`, and
  `lib_attendance_report.php`.
- **`studentLibraryAttendance($current_date,'U.G')` bug carried from
  `library_entry_report.php`** does not appear in `dashboard_library.php` itself, but a
  near-identical function in `library_entry_report.php` calls
  `studentLibraryAttendance($att_current_date,'U.G')` for **both** the U.G and P.G
  columns (`$pgs=studentLibraryAttendance($att_current_date,'U.G');` — should be
  `'P.G'`). The P.G column in that Daily Summary report is therefore always a
  duplicate of the U.G column. Flagged as a legacy bug — decide during rewrite whether
  to fix or preserve for exact parity.
- Book-count "Other" bucket: any book whose `resource_department` does not match
  *any* configured branch id falls into a synthetic "Other" tile.
- `academic_year` filtering for non-final-year students uses `basic_setup_tb`'s
  current `ug_academic_year`/`pg_academic_year`; the **final year** of a U.G course is
  treated as "graduating batch" and is *not* filtered by academic year (all final-year
  students across academic years are included).

**Print/report output:** none directly; drill-downs open a separate popup window
(`dashboard_lib_report.php`) which is itself printable via browser print (uses
`print_style.css`, has an internal page-counter CSS block for pagination footer).

**Tables touched:** `book_category_tb`, `book_tb`, `staff_profile_tb`, `edu_setup_tb`,
`library_attendance`, `library_transaction_tb`, `basic_setup_tb`,
`basic_setup_course_tb`, `student_academic_tb`, `log_tb`.

---

## 2. Dashboard drill-down report — `dashboard_lib_report.php`

**Purpose:** Renders the printable detail list behind every clickable number on the
dashboard. Opened in a popup window (`Report`) via `window.open()`; not in the sidebar
menu.

**Entry point:** `GET dashboard_lib_report.php?flag=<1..7>&...` from
`dashboard_library.php`'s JS functions (`callstaffattendance`, `callstudentattendance`,
`callstafftrans`, `callstudenttrans`, `calltrans`, `callbooks`, `calltotalattendance`).

**Page layout:** Minimal standalone HTML page (own `<head>`, own bootstrap/print CSS,
`print_page_no` CSS counter for pagination) with an `<h3>` title, a filter-summary
block, and a single results `<table>`.

**Flags (each is effectively its own sub-report; dispatched by `$_GET['flag']`):**

| flag | Report | Key params | Columns |
|---|---|---|---|
| 1 | Staff Library In/Out (by day, optional category) | `cat`,`cdate`,`ctype=In\|Out` | S.No, S.ID, Staff Name, Time |
| 2 | Student Library In/Out (by course/year/day) | `course`,`cyear`,`cdate`,`ctype` | S.No, Roll No, Student Name, Year, Time |
| 3 | Staff Book Issued/Return/Due | `cat`,`cdate`,`ctype=Issued\|Return\|Due` | S.No, S.ID, Staff Name, Accession No, Book, Issued Date, Due Date, (Return Date if Return) |
| 4 | Student Book Issued/Return/Due (by course/year) | `course`,`cyear`,`cdate`,`ctype` | same + Year column |
| 5 | Issue/Return/Due for a day-bucket (Today/Yesterday/This Week/…) | `cat` (bucket name), `cdate`, `ctype=I\|R\|D` | S.No, S.ID, Name, Category/Year (via `getNameDetails()`), Accession No, Book, Issued Date, Due Date, (Return Date) |
| 6 | Book list by branch | `cdate` (unused for filtering), `ctype`=branch id or `Other` | S.No, Accession No, Name, Resource, Author — `book_tb` rows filtered like the dashboard branch tiles |
| 7 | Combined Attendance In/Out for the whole institute (students + staff) | `cdate`,`ctype=In\|Out` | S.No, S.ID, Name, Time — two stacked result sets (students then staff) |

**Data source (load):** See flag table above; representative queries:
- flag=3 (Staff issue/return/due):
  `SELECT DISTINCT(A.id), A.book_id, A.check_out_date, A.check_in_date, A.due_date,
  B.staff_id, B.staff_title, B.staff_name, B.staff_initial, C.resource_name FROM
  library_transaction_tb AS A INNER JOIN staff_profile_tb AS B ON
  A.register_no=B.staff_id INNER JOIN book_tb AS C ON A.book_id=C.accession_no WHERE
  A.del=1 AND DATE(A.<search_str>)='<cdate>' <due-only extra filter> AND B.del=1
  <cat filter> AND C.del=1 ORDER BY A.<order_str> ASC` — `search_str` is
  `check_out_date`/`check_in_date`/`due_date`; `order_str` is `created_dt` (Issued),
  `updated_dt` (Return), `created_dt` (Due, plus `check_in_date='0000-00-00'` filter).
- `getNameDetails($register_no)` — shared helper used by flag=5: looks up
  `staff_profile_tb` first, falling back to `student_profile_tb` ⋈
  `basic_setup_course_tb` ⋈ `student_academic_tb` if not staff, to build a
  `[name, designation/year-line]` pair.

**Save/submit behavior:** none — pure report.

**Business logic / edge cases:**
- All In/Out splits use the same odd/even parity trick as the dashboard (`$ref_inout[$id]++`,
  odd = In for staff, but note the **student** version at flag=2/7 requires
  `$ref_inout[$sid]%2==0 && $ref_inout[$sid]>0` for Out (guards against the count
  being exactly 0), while the staff version at flag=1/7 does not have that extra
  `>0` guard — a subtle asymmetry to preserve exactly.
- flag=6 "Other" bucket logic is duplicated from `LibraryBook()` in the dashboard.
- Zero dates (`0000-00-00` or empty) are blanked out for display (`'0000-00-00'` and
  `''` both map to `''` before `date()` formatting), never passed through
  `date()` directly (would otherwise render as `01-01-1970` / wrong year).

**Print/report output:** Own standalone HTML with `print_style.css`/`style.css`
included directly (not through the shared `widget.php` header/footer chrome), plus an
inline `@media print` block with a page counter (`#print_page_no:after{counter-increment:section;content:"Page: " counter(section);}`).

**Tables touched:** `staff_profile_tb`, `library_attendance`, `edu_setup_tb`,
`library_transaction_tb`, `book_tb`, `student_academic_tb`, `student_profile_tb`,
`basic_setup_tb`, `basic_setup_course_tb`, `book_category_tb`.

---

## 3. Category — `library_book_cate.php`

**Purpose:** Manage the five lookup-list "category" groups that drive every dropdown
in the module: **Department** (Branch), **Resource** (resource type — Book/Journal/
E-Book/etc.), **Source**, **Subject**, **Transfer** (Transfer-To destinations for
inter-department book transfer). All are rows in one shared table, `book_category_tb`,
distinguished by the `category` column.

**Entry point / menu:** Sidebar → Library → "Category" → `library_book_cate.php`.

**Page layout:**
- Single **Category** dropdown (`<select name="category" onchange="this.form.submit()">`)
  with options `Department→"Branch"`, `Resource→"Resource"`, `Source→"Source"`,
  `Subject→"Subject"`, `Transfer→"Transfer To"` (value sent = the internal category
  key, label shown differs from the key for Department/Transfer).
- On selecting a category, an editable grid appears: columns **Order** (text input,
  `act_order[]`), **Name** (text input, `act_name[]`, hidden `act_id[]` for existing
  rows), and a trash-can button per row (opens a Bootstrap confirm modal, posts
  `delete=Confirm&confirm=<id>`).
- "+" button (`subject_addRow()`) appends a new blank row to the grid via JS DOM
  manipulation (no server round-trip).
- **Save** button posts the whole grid.

**Data source (load):**
`SELECT * FROM book_category_tb WHERE category='<selected>' AND del=1 ORDER BY
category_order ASC`. If zero rows, a single blank input row (`value="1"` for order) is
rendered.

**Save/submit behavior:**
- **Delete** (`delete=Confirm`): soft delete —
  `UPDATE book_category_tb SET del="0", updated_dt=…, updated_ip=…, updated_by=…
  WHERE id='<confirm>'`.
- **Save** (`Submit=Update`):
  1. First **soft-deletes the entire category**: `UPDATE book_category_tb SET del=0
     WHERE del=1 AND category='<category>'` — every existing active row in that
     category is marked deleted before the grid is re-applied.
  2. Then loops the posted `act_name[]`/`act_order[]`/`act_id[]` arrays:
     - If `act_id[i]` is empty → **INSERT** new row (`category, category_name,
       category_order, created_dt, created_ip, created_by`) — `del` column not set
       explicitly on insert (relies on the table's `del` default `1`).
     - Else → **UPDATE** the existing row by id, setting `category`, `category_name`,
       `category_order`, `del="1"` (re-activating it) and audit fields.
  3. `$del_val` (`1` if `act_enable[i]==1` else `2`) is computed in the loop but
     **never actually used** in either the INSERT or UPDATE SQL — dead code artifact;
     there is no visible "enable" checkbox for existing rows in the current HTML,
     so this looks like a leftover from an earlier design. Flag for the rewrite: do
     not implement an `act_enable` toggle unless product confirms it should exist.
  4. No duplicate-name check.

**Business logic / edge cases:**
- The blanket "mark whole category deleted, then re-insert/re-activate from the
  posted grid" pattern means **any row removed client-side (via the trash icon before
  save) that is not resubmitted is effectively soft-deleted on next Save even if the
  trash icon's own AJAX/post never fired** — i.e., a row omitted from the grid on
  submit is deleted, not just the ones explicitly trashed. This is a destructive
  side-effect to replicate carefully (or flag as a bug to fix) in the rewrite.
- Order (`category_order`) is used everywhere for dropdown ordering.

**Print/report output:** none.

**Tables touched:** `book_category_tb` (read/write), `log_tb` (audit log only).

---

## 4. Resources Add — `library_book_add.php`

**Purpose:** Add a brand-new book/resource (one accession number = one physical
copy/row in `book_tb`).

**Entry point / menu:** Sidebar → Library → Resources ▸ "Resources Add".

**Page layout (3 panel groups):**
- **"Resource / Accession No. / Title"** panel:
  - Hidden "Type" day/evening radio (`course_type`) — rendered `display:none`, dead
    UI (no visible label change observed; kept for schema compatibility only).
  - **Resource** dropdown (`resource_type`, required) — options from
    `book_category_tb WHERE category='Resource'`. `onchange="callISSNLabel(this)"`
    toggles: if the selected label contains the substring `"Journal"`, the "ISBN No"
    label swaps to "ISSN No" and a "Month" field becomes visible
    (`div_issn_month`/`issn_month`); if `resource_type==1` specifically, an **E-Book
    Upload** file field (`ebook`, `accept=".pdf"`) is shown (id `1` is whichever
    `book_category_tb` row happens to be first/lowest id under category `Resource` —
    confirm this is genuinely "E-Book" in the live category data before relying on
    the magic number `1`).
  - **Accession No** (text, required, max 20) with a "check availability" icon button
    (`checkavailable()`) that AJAX-calls `library_book_more?accession_no=…&flag=1`
    and shows "Available" (green) / "Not Available" (red) inline, based on whether an
    active `book_tb` row already has that accession number.
  - **Title** (`resource_name`, required) — `onKeyUp` mirrors the raw value into a
    hidden `convert_name` field (used as fallback before/without transliteration).
  - **Sub Title** (`resource_subname`, optional).
  - **Convert Title** dropdown — Tamil/Urdu/Arabic/Hindi — drives a Google
    Transliteration API widget (`google.elements.transliteration`) that live-converts
    the Title into the selected script and writes it into **Title (converted)**
    (`convert_name` visible input, id `transliterateTextarea`). *(Note: this depends
    on the deprecated Google Transliteration/Language JSAPI — likely non-functional
    today; flag for rewrite as needing a modern transliteration approach or removal.)*
  - **E-Book Upload** (`ebook`, file, `.pdf` only) — hidden unless Resource is the
    e-book category.
  - **Reference Copy** checkbox (`reference_copy`, value `1`).
- **"Author / Publisher / Supplier"** panel: Author (required), Publisher, Supplier
  (dropdown from `book_supplier WHERE del=1 ORDER BY supplier_name`, `title` attr
  carries the address as a tooltip), Source (dropdown from `book_category_tb WHERE
  category='Source'`).
- **"Category Details"** panel: Subject (dropdown, `category='Subject'`), Branch
  (`resource_department[]`, **multi-select**, `category='Department'`, uses
  `multipleSelect()` jQuery plugin), Call No + Copy No (two text inputs on one row),
  ISBN/ISSN No + conditional Month, Edition, Revised Edition (checkbox), Published
  Year, Volume.
- **"Location / Price"** panel: Shelf No, Rack No, Page No, No. of Disk, Bill No, Bill
  Date (date picker), Price, Remarks.
- Single **Add** submit button; `form_reset` hidden anti-double-submit token
  (`date('His').rand(0,1111)`, compared against `$_SESSION['check_form_submit']`).

**Data source (load):** All the dropdown-population `SELECT * FROM book_category_tb
WHERE category='<X>' AND del=1 ORDER BY category_order ASC` queries described above,
plus `SELECT * FROM book_supplier WHERE del=1 ORDER BY supplier_name ASC`.

**Save/submit behavior:**
- Server-side duplicate guard: `SELECT id FROM book_tb WHERE del=1 AND
  accession_no='<accession_no>'` — if any row exists, **INSERT is skipped** and the
  form re-renders with `"Oops! Accession no. Already Exists...."` (no field-level
  message; the whole form loses its submitted values except for what is repopulated
  into `$post_details[...]`, though the code re-reads all of `$_POST` directly rather
  than the sanitized/`addslashes`'d local vars, so re-display could show raw
  un-escaped POST values back into HTML attributes — a minor XSS-adjacent legacy
  wrinkle to *not* reproduce as-is in the rewrite).
- E-Book upload: if `resource_type==1` and a `.pdf` file was uploaded, it's copied
  (not moved) to `files/library_ebook/<random>.pdf` where `<random>` =
  `date('dmyHis').rand(1000,9999).<ext>`; only `.pdf` extension is accepted
  (case-insensitive). Non-PDF uploads are silently ignored (no error shown).
- **INSERT INTO `book_tb`** columns: `course_type, resource_type, accession_no,
  resource_name, convert_title, convert_name, call_number, copy_no,
  resource_department, author_name, publisher_name, resource_subname,
  resource_subject, isbn_no, issn_month, edition, redition, year, volume, shelf_no,
  rack_no, page_no, price, source, remarks, disc, billno, billdate, supplier_code,
  created_dt, created_ip, created_by, ebook_attachment, reference_copy`. Note:
  `resource_department` (multi-select array) is stored as a single
  comma-`implode()`d string (`$resource_department1=implode(',',$resource_department)`)
  — this is why every branch-membership query elsewhere in the module needs the
  4-way `=`/`LIKE 'id%,'`/`LIKE ',%id'`/`LIKE ',%id%,'` OR-chain instead of a normal
  equality or join. `del` is **not** set explicitly on insert (table default is `1`).
- Required fields (client `required` attr): Resource, Accession No, Title,
  Author. No other server-side required-field validation beyond the duplicate check.
- Audit: `created_dt/created_ip/created_by` only (no update fields on insert, as
  expected).
- Log: `insert_log()` writes to `log_tb` with operation `Add` (`Successful` or
  `Unsuccessful`) using `$url_ref` (`$_SERVER['REQUEST_URI']`) as the page key.

**Business logic / edge cases:**
- `book_tb.accession_no` is the physical/circulation identity of a copy; multiple
  copies of the same title get separate `book_tb` rows with different
  `accession_no`/`copy_no` but identical `resource_name` (this is how "available
  copies of a title" counts are computed elsewhere — see Resources Report).
- The "check availability" AJAX call re-checks live as the user types/blurs
  `accession_no` (`onchange`), duplicating the server-side check purely for UX; the
  server-side check is authoritative.

**Print/report output:** none.

**Tables touched:** `book_tb` (insert), `book_category_tb` (read), `book_supplier`
(read), `log_tb` (audit).

---

## 5. Resources Edit — `library_book_edit.php`

**Purpose:** Combined **search/list + edit + soft-delete + "add copy" (duplicate
accession)** screen for existing `book_tb` rows. Single PHP file switches between a
list view and a single-record edit view based on whether `edit_row_id` is set.

**Entry point / menu:** Sidebar → Library → Resources ▸ "Resources Edit".

**Page layout — List view (default, `edit_row_id==''`):**
- Filter bar: free-text **Search** box, **Search By** dropdown (`--All--`, Title,
  Accession No., Convert Title, Call Number, Author, Publisher), **Resource** type
  dropdown (`--All Resource--` + `book_category_tb WHERE category='Resource'`),
  **Department** dropdown (`--All Department--` + `category='Department'`), Search
  button (icon only).
- Pagination summary text ("Showing X to Y of Z entries") + page-number links, via
  shared `call_pagenation()` helper, page size **20**.
- Results table: columns **Resource** (type label), **Status** (computed — see
  below), **Accession**, **Title**, and an actions cell with an **Edit** button
  (`name="update[<i>]" value="<book id>"`, plain form submit, not AJAX) and a
  **Trash** button (Bootstrap confirm modal → `delete=Confirm&confirm=<id>`).
- "No data available" row if the filtered query returns 0 rows.

**Page layout — Edit view (`edit_row_id!=''`):**
- Same 4-panel layout as Resources Add (Resource/Accession/Title, Author/Publisher/
  Supplier, Category Details, Location/Price), pre-filled from the existing
  `book_tb` row, **plus**:
  - **Damage** checkbox (`is_damage`) — not present on the Add screen.
  - **"Add Book" (copy accession numbers)** mini-panel: a grid of **New Accession
    No** / **New Copy No** input pairs (`new_accession_no[]`, `new_copy_no[]`), a "+"
    row-adder, and an **"Add Book"** submit button (`name="addbooks" value="Add
    Book"`) — bulk-clones the *current* record into N new `book_tb` rows sharing
    every field except `accession_no`/`copy_no`, used for registering multiple
    physical copies of the same title in one action.
  - E-book "View" link if `ebook_attachment` is set
    (`https://www.cis.apdch.edu.in/files/library_ebook/<file>`); a hidden
    `ebook_attachment` field preserves the existing filename if no new file is
    uploaded on save.
  - Confirm-delete modal identical to the list view.

**Data source (load):**
- List: `SELECT * FROM book_tb WHERE del=1 <search filters> ORDER BY resource_name
  ASC LIMIT <start>,<20>`; row count for pagination via the same filters without
  `LIMIT`.
  - `search_by=''` (All) free-text search expands to `(course_type LIKE '%x%' OR
    resource_name LIKE '%x%' OR accession_no LIKE '%x%' OR convert_name LIKE '%x%' OR
    call_number LIKE '%x%' OR author_name LIKE '%x%' OR publisher_name LIKE '%x%')`.
  - **Status** per row is computed with two lookups, same pattern used everywhere
    else in the module:
    1. `SELECT B.category_name FROM book_transfer AS A INNER JOIN book_category_tb AS
       B ON A.transfer_to=B.id WHERE A.accession_no='<no>' AND (A.receive_date=
       '0000-00-00' OR A.receive_date='') AND A.del=1 AND B.del=1` → if found, status
       = the transfer-destination category name (e.g. a department name) — book is
       physically elsewhere.
    2. Else `SELECT * FROM library_transaction_tb WHERE book_id='<no>' AND
       (check_in_date='0000-00-00' OR check_in_date='') AND del=1` → if exactly 1 row,
       status = `Issued`.
    3. Else status = `Library` (on the shelf, list view) / `Available` (edit form
       initial-list view header text differs slightly by screen — see below).
- Edit form load: `SELECT * FROM book_tb WHERE del=1 AND id='<edit_row_id>'`, plus the
  same category/supplier dropdown population queries as Add.

**Save/submit behavior:**
- **Delete** (`delete=Confirm`): soft delete — `UPDATE book_tb SET del="0",
  updated_dt/ip/by WHERE id='<confirm>'`.
- **Save** (`Submit=Save`): **UPDATE `book_tb`** with the same field set as the Add
  screen's INSERT, plus `is_damage` and re-handling of `ebook_attachment` (new upload
  replaces; otherwise the posted hidden `ebook_attachment` value is preserved).
  `WHERE id='<edit_row_id>'`. No duplicate-accession re-check on update (unlike Add).
- **"Add Book"** (`addbooks=='Add Book'`): for each non-empty
  `new_accession_no[i]`/`new_copy_no[i]` pair, runs an
  `INSERT INTO book_tb(... ) SELECT ... FROM book_tb WHERE id='<copy_book_id>'`
  (copy-by-SELECT of every column except the two being overridden) — i.e. a true
  clone including `created_dt/ip/by` set fresh for the new row, but **not**
  re-validating that the new accession number is unique.
- Log: `Delete`/`Update`/`Add` operations logged via `insert_log()`.

**Business logic / edge cases:**
- The list-view Status badge for **Issued/transferred books gets a pink/red row
  background** (`style="background-color:#F6C3C3"`) in the Report/OPAC screens (see
  §6/§7) but the **Edit list view does not apply that background color** — only the
  Report/OPAC screens do. Preserve this UI inconsistency intentionally or flag it for
  product sign-off if unifying.
- Edit view lost/kept filter state across an edit round-trip via hidden
  `search`/`search_by`/`search_type`/`search_department`/`page` fields
  (`$hd_input_details`) so returning to the list after Save keeps the same filter/page.

**Print/report output:** none.

**Tables touched:** `book_tb` (read/update/insert/soft-delete), `book_category_tb`
(read), `book_supplier` (read), `book_transfer` (read, for status),
`library_transaction_tb` (read, for status), `log_tb` (audit).

---

## 6. Resources Report — `library_book_report.php`

**Purpose:** Staff-facing searchable/printable catalog report with live availability
counts per title.

**Entry point / menu:** Sidebar → Library → Resources ▸ "Report".

**Page layout:**
- Filter bar identical in shape to Resources Edit's list filter (Search text, Search
  By, Resource type, Department — Department options include a synthetic **"Others"**
  entry), Search button, **Print** button
  (`callPrintContent('final_result_span','1','')`).
- Results: a `<span id="final_result_span">` wrapping a bordered table with columns
  **S.No., Resource, Status, Accession No, No. Available, Title, Sub Title, Call No,
  Subject, Branch, Author, Publication, Year / Volume / Edition, Shelf / Rack No,
  E-book**.
- "No records found" / "Please select search option" messages when applicable (a
  search must include at least one populated filter field — an empty search never
  runs the query, per the `if($search_string_ref)` guard).

**Data source (load):**
- Same filter-string construction as Resources Edit (`search_by` blank → OR-search
  across `course_type/resource_name/accession_no/call_number/author_name/publisher_name`;
  note **`convert_name` is NOT included** in this screen's blank-search OR-list,
  unlike Resources Edit's — a small but real behavioral difference between the two
  screens' "search everything" mode).
- `search_department='Others'` uses a precomputed `$department_not_like` NOT-LIKE
  chain (every configured branch id excluded) instead of a positive department match.
- Main query: `SELECT * FROM book_tb WHERE del=1 <filters> ORDER BY resource_name ASC`
  (**no pagination** — returns the full result set in one page, unlike Resources
  Edit's search which limits to 20/page).
- Per-row **availability math** (distinct from the simple 3-state Status used in Edit):
  ```
  total_book_available = COUNT(book_tb WHERE del=1 AND resource_name=<name>)
  book_transfer         = COUNT(book_tb ⋈ book_transfer ON accession_no
                                 WHERE del=1 (both) AND resource_name=<name>
                                 AND receive_date IN ('0000-00-00','') )
  book_issued           = COUNT(book_tb ⋈ library_transaction_tb ON accession_no=book_id
                                 WHERE del=1 (both) AND resource_name=<name>
                                 AND check_in_date IN ('0000-00-00','') )
  remain_book = total_book_available - (book_issued + book_transfer)
  ```
  Displayed as `"<remain_book> of <total_book_available>"`. Note this is computed
  **per copy row displayed**, grouped implicitly by matching `resource_name` string —
  two titles with an identical `resource_name` string (even if logically different
  books) will be conflated into the same availability count. This is an inherent
  legacy data-modeling limitation (no `title_id`/FK grouping) to be aware of if the
  rewrite wants to normalize.
- Row status/highlight logic (transfer → destination-name badge with pink background;
  else issued → "Issued" + pink background; else "Available") is the same 2-step
  lookup pattern as §5, but this screen's *default* (non-transferred, non-issued)
  label is **"Available"**, whereas §5's Edit-list default label is **"Library"** —
  another cross-screen label inconsistency to preserve or reconcile deliberately.
- Damaged flag: `is_damage==1` appends `"(Damaged)"` to the Status cell text.

**Save/submit behavior:** none (read-only report). `Search` action is logged
(`Generate` operation) with the encoded filter querystring as the log payload.

**Business logic / edge cases:**
- E-book link only rendered when `resource_type==1` (same "magic id 1 = e-book"
  assumption as Resources Add) **and** `ebook_attachment` is non-empty.
- Print uses `callPrintHeader()`/`callPrintContent()` shared helpers (see Print
  section below) — prints only the `#final_result_span` table content, not the filter
  form.

**Print/report output:** `Print` button calls
`callPrintContent('final_result_span','1','')` (shared JS helper, presumably in
`widget.php`/global JS bundle — opens a print-formatted window of just that span's
HTML using the site's report print CSS). Report title fixed to `"Resources Report"`
via `callPrintHeader($att_header,'1')`.

**Tables touched:** `book_tb`, `book_category_tb`, `book_transfer`,
`library_transaction_tb`, `log_tb`.

---

## 7. OPAC — `resources_report.php`

**Purpose:** A second, near-duplicate catalog-search screen ("Online Public Access
Catalog" style) with a richer, more publication-oriented column set (separate Author
column ahead of Title, explicit "Total No. of Copies" column, Shelf/Rack/Pages/Disk
columns broken out) and **pagination** (unlike §6's Report screen).

**Entry point / menu:** Sidebar → Library → "OPAC" (top-level, not nested under
Resources).

**Page layout:** Same filter bar as §6 (Search/Search By/Resource/Department +
Others), but **no explicit Print button in the header row** (print affordance for
this screen was not found in the read portion of the file — verify in-browser; may
rely on browser print only). Results table columns: **S.No., Resource, Status,
Accession No, No. of Copies Available, Name of the Author, Name of the Title, Sub
Title, Edition, Volume No., Year of Publication, Total No. of Copies, Call No,
Subject, Branch, Publication, Shelf No, Rack No, No. of Pages, Disk No, E-Book**.
Below the table: page-number links (`call_pagenation()`, limit **50**/page — vs. 20 on
Resources Edit's list and unlimited on Resources Report).

**Data source (load):** Identical search-filter construction and availability-math
(`total_book_available`/`book_transfer`/`book_issued`/`remain_book`) to §6, with
`LIMIT <start>,50`. Status default label here is **"Library"** (matching §5, not §6).
Runs the search **unconditionally** on every page load if any `$_REQUEST` filter is
present — this screen does not require the `searchbtn=='Search'` POST flag that §6/§8
use; it evaluates `$search_string_ref` truthiness directly from `$_REQUEST`, so a
bookmarked/shared URL with querystring filters works without re-clicking Search
(useful for deep-linking; note as an intentional behavior difference vs. §6).

**Save/submit behavior:** none — read-only. Every `searchbtn=='Search'` POST is
logged (`Generate`); plain `GET`/no-POST loads are logged as `View`.

**Business logic / edge cases:** Same per-title availability caveat as §6 (grouped by
`resource_name` string equality, not a real title id).

**Print/report output:** Not confirmed in this file's HTML (no visible Print button in
the read range) — verify against the live page before treating "no print" as final;
flag as open question.

**Tables touched:** `book_tb`, `book_category_tb`, `book_transfer`,
`library_transaction_tb`, `log_tb`.

---

## 8. Barcode — `resources_barcode.php`

**Purpose:** Generate and print CODE128 barcode labels for one or more accession
numbers (comma-separated list, or an accession-number range), with a configurable
number of copies per label.

**Entry point / menu:** Sidebar → Library → "Barcode".

**Page layout:**
- **Find** text box — free text, placeholder "Accession number separated by comma".
- **By** row: Resource-type dropdown, Department dropdown (no "Others" synthetic
  option here, unlike §6/§7).
- **From A.No. / To A.No.** — numeric accession-number range filter (only applied if
  both are numeric, `is_numeric()`).
- **No. of Copy** — radio buttons 4/3/2/1 (default 4) — number of label copies printed
  per matched book.
- **Search** submit button (large, styled prominently) + **Print** button
  (`callPrintContent('final_result_span','0','barcode_style_id')` — note the middle
  arg is `'0'` here vs `'1'` elsewhere, and a barcode-specific inline stylesheet
  `#barcode_style_id` `<textarea>` is injected as the print CSS override).
- Right-hand help column: printer setup instructions (Firefox-specific: Portrait,
  Scale 100%, uncheck "shrink to fit", enable "print background", zero margins/no
  header-footer) and an illustrative image (`img/barcode_print.png`).
- Note: page explicitly instructs **"Print using firefox only."**

**Data source (load):**
`SELECT id, accession_no, call_number, copy_no, author_name FROM book_tb WHERE del=1
<filters> ORDER BY accession_no ASC`. Comma-separated accession numbers become an
OR-chain of exact `accession_no="<n>"` matches (each trimmed).

**Save/submit behavior:** none — generation only, no DB writes. Search logged
(`Generate`).

**Business logic / edge cases:**
- Barcode generation uses `files/certificate/barcodelib.inc.php`'s `BARCODE` class
  (`CODE128` symbology, height 30, scale 1, color `#230000` on white). Each barcode
  image is generated **on every page render** as a PNG file at
  `files/certificate/images/<accession_no>.png` (`genBarCode()`), i.e. this is a
  side-effecting "report" that writes files to disk as a byproduct of viewing — note
  for the rewrite: either generate barcodes on-the-fly client/server without
  persisting per-view files, or replicate the caching-by-overwrite behavior
  intentionally.
- Label layout logic is copy/position dependent: every 2nd label in the sequence uses
  a different CSS class (`bcol_1`/`bcol_2` alternating) and a `page-break-before`
  div is injected every other item to keep 2 label columns per printed row. A 3rd
  "large text only" label style (`bcol_3`) exists in commented-out code but is not
  currently active. If a given copy index `$i==3` render uses the plain-text label
  variant (title/call number, no barcode image) instead of the barcode variant —
  effectively only the 4th copy of the "No. of Copy" batch is a text-only label; this
  looks like an intentional "spine label" vs "loose label" distinction but the exact
  intent should be confirmed with the librarian before the rewrite changes it.

**Print/report output:** Custom, non-standard print flow — prints directly from the
`#final_result_span` div using an inline `<textarea id="barcode_style_id">` as an
override stylesheet (`body{margin:0;padding:0}` + the `.bcol_*`/`.btxt` label-layout
CSS), rather than the shared report print CSS used elsewhere.

**Tables touched:** `book_tb`, `book_category_tb`, `log_tb`. Also writes to the
filesystem (`files/certificate/images/*.png`), not a DB table.

---

## 9. Book Issue — `library_transaction1.php` (+ `transaction_more1.php`)

**Purpose:** Circulation-desk screen for issuing (and, if the scanned book turns out
to already be checked out to that person, returning) a book, **starting from the
Student/Staff ID** (student/staff-first workflow — contrast with §10 which starts
from the book).

**Entry point / menu:** Sidebar → Library → "Book Issue".

**Page layout:**
- **Student / Staff** panel: `student_id` text input (required, autofocus, barcode
  keystroke-capture via `RegBarcheck()` — buffers rapid keypresses within 500ms and
  treats a ≥5-character burst as a scanned barcode value), a **Go** button
  (`call_student_details()`), and a **Clear** button that resets the form and
  re-focuses the ID field.
- **Resources** panel: populated entirely by AJAX response HTML from
  `transaction_more1.php` (flag=1 then flag=2) — no static fields.
- **Last Issue** / **Last Return** side panels: most-recent `library_transaction_tb`
  row (`ORDER BY id DESC` for Last Issue; `ORDER BY updated_dt DESC` filtered to
  `check_in_date!='0000-00-00'` for Last Return) shown as static S.ID/B.ID reference —
  purely informational, refreshed only on full page reload (not live-updated after a
  transaction in the same session).
- Hidden hardening fields: `s_available`, `b_trans` (JS sets `b_trans.value=1` only
  when a real Issue/Return submit button is clicked; the form's `onSubmit` handler
  blocks submission if `b_trans` is still empty — prevents accidental Enter-key
  submits before a book/person has actually been resolved).

**Data source (load) / step-by-step flow:**
1. `call_student_details()` → `GET transaction_more1.php?student_id=<id>&flag=1`.
   Looks up `student_profile_tb` (active, non-releaved: `releaving_date='0000-00-00'
   OR releaving_date>NOW()`) joined to `basic_setup_course_tb`; if not a student,
   falls back to `staff_profile_tb` (same releaving-date filter). ID-card-prefix
   normalization is applied via `STU_IDCARD_YEAR`/`STU_IDCARD_LEN` (students) or
   `IDCARD_YEAR`/`IDCARD_LEN` (staff) constants — strips a configured year-prefix off
   scanned card IDs before the profile lookup, if the scanned value starts with that
   prefix.
   - Computes the person's **issue limit** from `library_setup_tb` (`ug_limit` for
     U.G, `pg_limit` for P.G, `staff_limit` for staff) and their **currently issued
     count** (`library_transaction_tb WHERE register_no=<id> AND check_in_date IN
     ('0000-00-00','') AND del=1`).
   - Lists every currently-issued book title inline ("Issued Details" mini-table).
   - If `issued_count < limit` → renders the **Accession No** input (book_id) +
     "Go" button for step 2, and stashes `member_type` (`student`/`staff`) as a hidden
     field. If at/over limit → shows **"Oops! Issue Limit Exceed...."** and does not
     render the accession-no field (issue flow dead-ends here).
2. `call_book_details()` (fires after the accession-no field changes) → `GET
   transaction_more1.php?student_id=<id>&book_id=<accno>&member_type=<type>&flag=2`.
   - Looks up `book_tb` by `accession_no`. If the book has an **open transfer** (row
     in `book_transfer` with no `receive_date`) → shows **"Resource trasfer to
     <dept>....."** (sic — legacy typo "trasfer") and stops.
   - Else checks whether any **other** person already has it checked out
     (`library_transaction_tb WHERE book_id=<accno> AND register_no!=<id> AND
     check_in_date IN ('0000-00-00','')`) → if so, **"Oops! Issued to <register_no>....."**
     and stops.
   - Else checks whether **this same person** already has this exact book open
     (`register_no=<id>`) → if yes, renders the **Return** form (Check-out/Due date
     read-only display + Return Date input defaulting to today + Damaged checkbox +
     **Return** submit button carrying `trans_id`).
   - Else (book free, not held by this person) → renders the **Issue** form
     (Check-out Date + Due Date inputs, both pre-filled — Check-out = today, Due =
     today + duration days for that person's category, pulled from `library_setup_tb`)
     and an **Issue** submit button. If `reference_copy==1` on the book, an extra
     warning banner is shown: **"This is Reference Copy. it should be return today
     (<today>) itself."**

**Save/submit behavior (posted back to `library_transaction1.php` itself):**
- **Issue** (`Submit=='Issue'`): requires `accession_no` + `student_id`. Re-checks
  server-side that no open transaction exists for that book
  (`library_transaction_tb WHERE book_id=<accno> AND check_in_date IN
  ('0000-00-00','') AND del=1`) — if one exists, **"Oops! Book ID Already
  Issued...."** (race-condition guard against a second concurrent issue of the same
  copy). Else **INSERT INTO `library_transaction_tb`**
  (`register_no, book_id, check_out_date, due_date, created_dt, created_ip,
  created_by`) — `del` defaults to `1`, `check_in_date`/`is_damage` left at column
  defaults (empty/`0000-00-00`).
- **Return** (`Submit=='Return'`): requires `trans_id` + `return_date`. **UPDATE
  `library_transaction_tb` SET check_in_date=<date>, is_damage=<0|1>, updated_dt/ip/by
  WHERE id=<trans_id>`. If `return_damage==1`, **also** propagates the damage flag
  onto the book itself: `UPDATE book_tb SET is_damage=1, updated_dt/ip/by WHERE
  accession_no=<book's accession_no looked up from the transaction row>` — i.e.
  damage marked at return time is sticky on the physical copy going forward (future
  issues of that copy will show "(Damaged)" until manually cleared by editing the
  book).
- `form_reset` anti-double-submit token pattern (same as every other screen).
- Both Issue and Return failures/successes are logged via `insert_log()`
  (`Issued`/`Return`, `Successful`/`Unsuccessful`).

**Business logic / edge cases:**
- **Reference copies** must be returned same-day (UI warning only — not
  server-enforced; a reference copy can still technically be issued with a
  multi-day due date and returned late, nothing blocks it).
- Issue-limit and loan-duration are **per person-category** (U.G / P.G / Staff), not
  per book or per department, configured centrally in `library_setup_tb` (single row,
  `id=1`) — see §14 Limit Setup.
- `library_transaction1.php` and `library_transaction.php` (§10) contain **byte-for-byte
  identical PHP POST-handling logic** for both Issue and Return — the two menu items
  are really the same backend action reachable from two different UI entry sequences
  (person-first vs. book-first). A rewrite can and should consolidate this into one
  shared "issue/return" service used by both UI flows.

**Print/report output:** none.

**Tables touched:** `library_transaction_tb` (insert/update), `book_tb` (read +
conditional damage-flag update), `book_transfer` (read), `student_profile_tb`,
`staff_profile_tb`, `basic_setup_course_tb`, `edu_setup_tb`, `library_setup_tb`,
`log_tb`.

---

## 10. Book Return — `library_transaction.php` (+ `transaction_more.php`)

**Purpose:** Same Issue/Return backend as §9, but the UI flow starts from the
**Accession No / book** first, then resolves the borrower — this is the natural flow
when a book is physically handed back at the desk and the librarian doesn't yet know
(or need to ask) whose card it's under.

**Entry point / menu:** Sidebar → Library → "Book Return".

**Page layout:** Mirror image of §9 — **Resource** panel first (`book_id` input,
barcode-capture via `BookBarcheck()`, "Go" button), then **Student / Staff** panel
(populated via AJAX), then the same **Last Issue** / **Last Return** side panels.

**Data source (load) / step-by-step flow:**
1. `call_book_details()` → `GET transaction_more.php?book_id=<accno>&flag=1`.
   Looks up `book_tb`; checks open transfer (same as §9 step 2's transfer check).
   If not transferred:
   - If **no open transaction** exists for the book → renders the bare
     **Student/Staff ID** input (step 2 will be an Issue).
   - If **exactly one** open transaction exists → resolves the current holder's
     name/photo/designation (student or staff, with ID-card-prefix normalization
     as in §9) and renders the **Return** form directly (Check-out/Due read-only +
     Return Date + Damaged checkbox + **Return** button carrying `trans_id`) — no
     second AJAX round-trip needed in this branch, because the book fully determines
     the transaction.
   - Else (book invalid, or resource-transferred) → shows the appropriate
     `"Oops!"` message and no form fields.
2. Only reached when step 1 resulted in an "Issue" state: `call_student_details()` →
   `GET transaction_more.php?student_id=<id>&flag=2`. This flag=2 branch in
   `transaction_more.php` is much thinner than §9's flag=2/1 handlers — it exists
   *only* to compute and return the **Issue** submit button + hidden
   `check_out_date`/`due_date`/`student_id` fields (it does not re-validate
   issue-limits or re-check the book here, unlike `transaction_more1.php`'s
   symmetric step). **This means the issue-limit check that blocks over-limit
   students in §9's flow does not appear to run at all in the Book Return screen's
   Issue sub-path** — worth flagging as a real behavioral gap between the two
   screens (see Open Questions) rather than assuming it's equivalent.

**Save/submit behavior:** Identical POST handler to §9 (byte-for-byte duplicate code
in the two files) — same Issue/Return SQL, same `form_reset` token, same logging.

**Business logic / edge cases:**
- Because this flow resolves "who has it" before asking for a person, it is the
  natural desk flow for returns; because its Issue sub-path skips the per-person
  issue-limit re-check present in `transaction_more1.php`, a book could in principle
  be issued here to someone already at their limit if this path is used for issuing
  instead of returning. Confirm with stakeholders whether this asymmetry is
  intentional (i.e., "Book Return" screen is never meant to be used to newly issue a
  book in practice) before deciding whether to fix or preserve it in the rewrite.
- Same reference-copy same-day-return UI warning is **not present** in this screen's
  `transaction_more.php` flag=1 Issue-available branch (only `transaction_more1.php`
  shows the reference-copy warning) — another asymmetry between the two screens.

**Print/report output:** none.

**Tables touched:** same as §9 — `library_transaction_tb`, `book_tb`,
`book_transfer`, `student_profile_tb`, `staff_profile_tb`, `basic_setup_course_tb`,
`edu_setup_tb`, `library_setup_tb`, `log_tb`.

---

## 11. Transfer — `resource_transfer.php` (+ `resource_transfer_more.php`)

**Purpose:** Record a book being sent out of the main library to another
department/location (e.g. a departmental reading room), and later record its
return/receipt back into the main library. This is what makes a book show as
"Issued to <department>" (rather than "Issued to <person>") elsewhere in the module.

**Entry point / menu:** Sidebar → Library → "Transfer".

**Page layout:**
- **Receipt** panel: `book_id` (Accession No) text input + **Go** button
  (`call_book_details()`), result area (`#book_transfer_details`) populated by AJAX.
- **Last Issued** / **Last Return** side panels — most recent `book_transfer` row
  (by `id DESC`) and most recent completed transfer (`receive_date!='0000-00-00'`, by
  `updated_dt DESC`) respectively, showing Dept. + B.ID.

**Data source (load) / flow:**
`call_book_details()` → `GET resource_transfer_more.php?book_id=<accno>&flag=1`:
- Looks up `book_tb` by `accession_no`.
- If the book currently has an **open issue** to a person
  (`library_transaction_tb WHERE book_id=<accno> AND check_in_date IN
  ('0000-00-00','') AND del=1`) → shows **"Resource not available. Issued to
  <register_no>"** — a book that's checked out to a person cannot be transferred.
- Else if it has an **open transfer already** (`book_transfer WHERE
  accession_no=<accno> AND receive_date IN ('0000-00-00','') AND del=1`) → renders
  the **Receive** sub-form: read-only "Transfer to" + "Transfer on" (from the open
  transfer row), a **Received on** date input (default today, required), and a
  **Return** submit button carrying the transfer row's `tid`.
- Else (book is on-shelf, free to transfer) → renders the **Transfer** sub-form: a
  **Transfer to** dropdown (`book_category_tb WHERE category='Transfer'`), a
  **Transfer on** date input (default today, required), and a **Transfer** submit
  button.

**Save/submit behavior:**
- **Transfer** (`Submit=='Transfer'`): requires `accession_no` + `transfer_to`.
  **INSERT INTO `book_transfer`** (`accession_no, transfer_to, transfer_date,
  created_dt, created_ip, created_by`) — `transfer_to` is upper-cased
  (`strtoupper()`) before insert, which is unusual for what is otherwise a
  category-id foreign key (an integer id being upper-cased is a no-op for digits, so
  functionally harmless, but suggests the field may have originally been intended as
  a free-text code rather than an FK — worth double-checking the actual stored
  values in `book_transfer.transfer_to` before assuming it's always numeric).
- **Return/Receive** (`Submit=='Return'`): requires `tid` + `receive_date`.
  **UPDATE `book_transfer` SET receive_date=<date>, updated_dt/ip/by WHERE
  id=<tid>`.
- Standard `form_reset` anti-double-submit + `insert_log()` logging
  (`Transfer`/`Return`, `Successful`/`Unsuccessful`).

**Business logic / edge cases:**
- `resource_transfer.php` (unlike every other file in this module) does
  `include('config.php')` at the top instead of `include('widget.php')` — verify at
  runtime whether `$a_username`, `$a_user_ip`, `$a_user_dt`, `$url_ref`, and the
  shared page-chrome variables (`$breadcrumb_details`, `$basic_style_details_array`,
  etc.) are still populated the same way; if `config.php` doesn't define them, some
  of the audit fields or page chrome could silently be blank/undefined on this
  screen specifically. Flag as a must-verify item (see Open Questions).
- A transferred-and-not-yet-received book is what several other screens' Status
  computation surfaces as the transfer-destination category name with a pink
  highlight (see §5/§6/§7) — this table is the single source of truth for
  "off-site" book location across the whole module.

**Print/report output:** none.

**Tables touched:** `book_transfer` (insert/update), `book_tb` (read),
`library_transaction_tb` (read, availability guard), `book_category_tb` (read,
Transfer-To options), `log_tb`.

---

## 12. Daily Summary — `library_entry_report.php`

**Purpose:** Date-range summary report of daily Issued/Return/Due counts plus
U.G/P.G/Staff attendance In/Out counts, one row per calendar day in the selected
range.

**Entry point / menu:** Sidebar → Library → "Daily Summary".

**Page layout:**
- Filter panel: **Date** range (`from_date`/`to_date`, both date pickers, default
  "1 month ago +1 day" → today), **Go** button, **Print** button (appears only after
  a successful Generate).
- Results table (only rendered after `Submit=='Generate'` with both dates present):
  columns **S.No, Date, Issued, Return, Due, U.G(In/Out), P.G(In/Out), Staff(In/Out)**
  — one row per day in the inclusive date range.

**Data source (load):** For each day in the range:
- `Issued`/`Return`/`Due` counts: `library_transaction_tb ⋈ book_tb` filtered by
  `check_out_date`/`check_in_date`/(`due_date` AND `check_in_date='0000-00-00'`)
  equal to that day.
- `Staff In/Out`: `staff_profile_tb ⋈ library_attendance` (odd/even parity by
  `mod(B.sno,2)` **directly on the `sno` column this time**, not the running-counter
  parity trick used elsewhere — `mod(sno,2)=1` → In, `mod(sno,2)=0` → Out). This is a
  **different algorithm** from the one used in `dashboard_library.php`/
  `dashboard_lib_report.php` (running per-person counter) even though it's aiming for
  the same In/Out semantics — the two can disagree if a person's `library_attendance`
  rows for a category are not globally sequential in `sno`. Flag as a cross-screen
  parity-logic inconsistency (see Open Questions).
- `U.G`/`P.G` per-day In/Out: calls the file's own local `studentLibraryAttendance()`
  function — **note the bug described in §1**: the call site passes `'U.G'` for both
  the U.G and P.G columns (`$pgs=studentLibraryAttendance($att_current_date,'U.G');`),
  so the P.G column is always a duplicate of U.G, never actual P.G data. This is a
  confirmed legacy bug in the live file, not a misreading.

**Save/submit behavior:** none — read-only. `Generate` action logged with the date
range as payload.

**Business logic / edge cases:** see the two flagged algorithm/bug items above.

**Print/report output:** `Print` button →
`callPrintContent('att_report_span','1','')`; report header built via
`callPrintHeader(['Daily Summary', '<from> to <to>'], '1')`.

**Tables touched:** `library_transaction_tb`, `book_tb`, `staff_profile_tb`,
`library_attendance`, `basic_setup_tb`, `basic_setup_course_tb`, `student_academic_tb`,
`log_tb`.

---

## 13. Library Att. Report — `lib_attendance_report.php`

**Purpose:** Per-student time-in-library report over a date range, for one or more
selected course/year groups — shows daily punch duration and totals/averages, sourced
from the hardware-fed `library_attendance` table (i.e., this report is meaningful only
if RFID/turnstile hardware attendance sync is active; it does not read the
webcam/manual attendance table).

**Entry point / menu:** Sidebar → Library → "Library Att. Report" (present in the
menu table; not linked from any other PHP file, reached only via the sidebar).

**Page layout:**
- **Category** multi-select (`course_name[]`, via `multipleSelect()`), grouped by
  `<optgroup>` per degree/department, each with year-level options built as
  `<course_id>___<academic_year>___<year_number>___<regular|additional>` — U.G courses
  get both a "Regular" and an "Additional" optgroup per year; P.G only "Regular".
- **Date** range (`from_date`/`to_date`).
- **Show Empty** checkbox — if unchecked (default), students with zero punches in the
  range are excluded from the results entirely.
- **Go** / (post-generate) **Print** buttons.
- Results: one table per selected course/year group (or a single combined table if
  only one group is selected), with a rotated (`-90deg` transform) date-header column
  per day in the range, plus **Total Days, Punched Days, Time, Avg.** trailing
  columns, sorted by total punched time **descending** (`krsort()` on the per-student
  total-seconds key).

**Data source (load):**
- Course/year options: `basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC`,
  academic year resolved per `course_name` from `basic_setup_tb`.
- Student roster per selected group: `SELECT GROUP_CONCAT(register_no) FROM
  student_academic_tb WHERE del=1 AND course_id=<id> AND academic_year=<year> AND
  academic_batch=<regular|additional> AND current_year=<n>`.
- Per-student per-day duration: `getLibAtt($s_id, $register_no, $current_date)` —
  reads `library_attendance WHERE date(p_date)=<day> AND tktno=<register_no> ORDER BY
  p_date ASC`, then pairs consecutive rows into in/out sessions **collapsing any two
  punches within 600 seconds (10 minutes) of each other into a single "bounce"
  event** (`if($latt_time=='' || strtotime($p_date)-$latt_time>600)`), summing
  session durations (`converttime()` → `HH:MM:SS`). A student needs **more than one**
  qualifying punch on a day (`$counter>1`) for that day to count as "punched" at all
  (a single stray punch with no matching pair contributes nothing to total time or
  the punched-day count).

**Save/submit behavior:** none — read-only. `Generate` logged with the selected
subjects/date-range/show-empty flag as payload.

**Business logic / edge cases:**
- This is a **third** distinct interpretation of the raw `library_attendance` punch
  stream (dashboard's running-odd/even-counter, Daily Summary's `mod(sno,2)`, and this
  screen's 10-minute-debounce paired-session model) — the three reports can produce
  different In/Out/duration numbers from the same underlying rows. A rewrite should
  pick one canonical interpretation (most likely this screen's debounce+pairing model,
  as it's the most defensive against duplicate/noisy hardware punches) and apply it
  everywhere, or explicitly preserve all three algorithms if exact per-screen parity
  is required.
- `$fBatchList`/`$subject_list_string_report` referenced in the single-course header
  branch (`$single_course_header`) are never assigned anywhere in this file — they
  will always be empty/undefined in that header string. Cosmetic-only bug (extra
  " | " artifacts in the printed header for the single-selected-group case).

**Print/report output:** `Print` → `callPrintContent('att_report_span','1','')`;
header built via `callPrintSetup(16)` + `callPrintHeader()` with title `"<report_type>
Attendance Report"` (note: `$report_type` is read from `$_POST['report_type']` but no
`report_type` form field was found in the read portion of this file — likely dead/
unused input, verify against the live page).

**Tables touched:** `basic_setup_tb`, `basic_setup_course_tb`, `student_academic_tb`,
`student_profile_tb`, `library_attendance`, `log_tb`.

---

## 14. Limit Setup — `transaction_setup.php`

**Purpose:** Single-row configuration screen for per-category **issue limit** (max
concurrent books) and **loan duration** (days until due) used everywhere in §9/§10's
issue logic.

**Entry point / menu:** Sidebar → Library → "Limit Setup" (present in menu table; not
linked from any other PHP file — sidebar-only entry point).

**Page layout:** A single 3-row table, **Book Limit** / **Duration (Days)** columns,
rows **U.G Student**, **P.G Student**, **Staff** — six small numeric text inputs
(`maxlength=2` for all, no explicit numeric `type` or client-side range validation),
plus **Save**.

**Data source (load):** `SELECT * FROM library_setup_tb WHERE id=1` — a single
fixed-id configuration row (`ug_limit, ug_duration, pg_limit, pg_duration,
staff_limit, staff_duration`).

**Save/submit behavior:** `Submit=='Update'` → **UPDATE `library_setup_tb` SET
ug_limit=<>, ug_duration=<>, pg_limit=<>, pg_duration=<>, staff_limit=<>,
staff_duration=<>, updated_dt/ip/by WHERE id='1'`. No validation (empty/non-numeric
input would be coerced to `0` by MySQL's numeric column casting, effectively
disabling issuing for that category — no client or server guard against this).
Logged as `Update`.

**Business logic / edge cases:** This is the single control surface for the
limits/durations consumed throughout §9/§10's issue-eligibility and due-date-default
logic; there is exactly one row (`id=1`) — the schema does not support
per-department or per-branch overrides.

**Print/report output:** none.

**Tables touched:** `library_setup_tb`, `log_tb`.

---

## 15. Library Att. (disabled) — `library_attendance.php` (+ helpers)

> **Status: `menu_enable=0` in `basic_admin_menu_tb`** — present in the menu table but
> hidden from the sidebar in the current configuration. Documented for completeness /
> in case it is re-enabled, but treat as lower priority than the active screens above.

**Purpose:** Kiosk-style webcam attendance capture — operator/student types an
ID, an attached webcam auto-snaps a photo, and an In/Out record is written.

**Entry point / menu:** Would be Sidebar → Library → "Library Att." if enabled.

**Page layout:**
- **Attendance** panel: `staff_id` large text input (autofocus, `onchange="take_snapshot()"`),
  read-only result fields for **Name**, **Designation**, **Time**, **In/Out**, a
  **Clear** button, and an `#upload_results` image slot showing the captured/looked-up
  photo.
- Right panel: conditionally either a live **JPEGCam** webcam widget (`webcam.js`,
  posts JPEG to `lrecord.php`, `set_quality(25)`) with a **Configure** button — shown
  only if `basic_setup_library_tb.live_att_photo=1` — or, if that setting is off, an
  ID-only flow with no camera capture (`take_snapshot()` skips the webcam and goes
  straight to the lookup AJAX call, in that branch using `msg=-` as the photo marker).
- Config source: `SELECT * FROM basic_setup_library_tb WHERE id=1` →
  `live_attendance` (unused directly in this screen's read HTML, may gate the whole
  screen elsewhere), `live_att_photo` (gates webcam vs ID-only mode as above).

**Data source (load):** `basic_setup_library_tb` (id=1) for the two feature flags.

**Save/submit behavior (via `library_attendance_more.php?flag=1`, called on
snapshot-complete or ID `onchange`):**
- Looks up `staff_profile_tb` (active, non-releaved) by `staff_id`; if not found,
  falls back to `student_profile_tb` by `register_no` (**no active/releaving-date
  filter on the student lookup branch** — unlike almost every other student lookup in
  this module, this one omits the releaving-date guard, meaning a graduated/inactive
  student could still register a library attendance record here; flag as a
  possible bug or, if intentional, a documented exception).
- Determines **In/Out** by looking at the most recent same-day
  `library_image_att_tb` row for that person (`ORDER BY entry_date_time DESC LIMIT
  1`) — if the last entry was `In` (or none exists yet), the new entry is `Out`...
  **wait, re-read carefully: if last was empty or `'Out'` → new entry is `'In'`; else
  → `'Out'`** (simple last-state toggle, not the odd/even-count parity trick used by
  the hardware-fed `library_attendance` table elsewhere in the module — this pipeline
  is self-consistent because it always knows its own last state directly).
- **INSERT INTO `library_image_att_tb`** (`s_id, staff_image, entry_date_time,
  entry_in_out, created_dt, created_ip, created_by`) — `staff_image` stores the
  webcam-uploaded filename (or the fallback ID-card image path if no live photo was
  taken, `msg=='-'`).

**Business logic / edge cases:**
- This whole pipeline (`library_attendance.php` → `library_attendance_more.php` →
  `library_image_att_tb`) is **entirely separate from** the `library_attendance` table
  that the Dashboard, Daily Summary, and Library Att. Report all read from. As far as
  static reading can determine, **nothing in the active module reads
  `library_image_att_tb` back out** for any report — it is a write-only sink today
  (see Open Questions). If re-enabling this screen, either wire a report to
  `library_image_att_tb`, or confirm/replace the intended data flow before relying on
  it.

**Print/report output:** none.

**Tables touched:** `basic_setup_library_tb` (read), `staff_profile_tb`,
`student_profile_tb`, `basic_setup_course_tb`, `library_image_att_tb` (insert),
`log_tb`. Also writes JPEGs to `files/library_att/*.jpg` via `lrecord.php`.

---

## 16. Manual Entry (disabled) — `library_att_entry.php`

> **Status: `menu_enable=0`.** Documented for completeness only.

**Purpose:** Manual back-office correction/entry grid for a single day's
`library_image_att_tb` In/Out times (the webcam-pipeline table from §15) — lets an
operator retroactively add or fix a person's in/out times for a chosen date without
needing the webcam kiosk.

**Entry point / menu:** Would be Sidebar → Library → "Manual Entry" if enabled.

**Page layout:** Date picker (`att_date`, `onchange="this.form.submit()"` —
auto-reloads the grid for the newly selected date), then a table with columns **SNo.,
Reg No. / Emp ID, In Time (24:00 Hrs), Out Time (24:00 Hrs)** — one row per person who
already has a manual `In` entry for that date, plus a blank starter row if none exist
yet. **+/-** buttons add/remove grid rows client-side. **Save** submits the whole
grid.

**Data source (load):**
`SELECT * FROM library_image_att_tb WHERE del=1 AND DATE(entry_date_time)='<date>'
AND entry_in_out='In' AND manual_entry='1' ORDER BY entry_date_time ASC` — for each
`In` row found, a matching later same-day `Out` row for the same `s_id` is looked up
separately (`entry_date_time>=<in time> AND id!=<in id> AND entry_in_out='Out' AND
manual_entry='1'`) to populate the paired Out-time cell.

**Save/submit behavior:**
- First, **soft-deletes** every existing manual entry for the selected date:
  `UPDATE library_image_att_tb SET del=0, updated_by/ip/dt WHERE del=1 AND
  DATE(entry_date_time)='<date>' AND ... AND manual_entry='1'` — **note: this UPDATE
  statement as written in the live file has a SQL syntax defect**
  (`WHERE del =1 AND DATE(entry_date_time)='$att_date' AND  AND manual_entry='1'` —
  a duplicated `AND AND` with nothing between them). This is almost certainly a
  broken/no-op or outright SQL-error statement in production as written; **do not
  port this query literally** — treat the intended logic as "soft-delete existing
  manual rows for this date" and implement it correctly, but flag to product that the
  live legacy behavior here may currently be non-functional (the subsequent
  INSERT/UPDATE loop would then be creating duplicate rows every save rather than
  cleanly replacing the day's entries, since the intended pre-clear does not
  reliably run).
- Then, for each grid row: if `intime[i]` is set and has no existing `iid[i]` →
  **INSERT** a `library_image_att_tb` row (`entry_in_out='In', manual_entry='1'`);
  if `iid[i]` is set → **UPDATE** that row's `entry_date_time`/`s_id`/`del=1`. Same
  pattern independently for `outtime[i]`/`oid[i]` (`entry_in_out='Out'`).
- Logged as `Update` (only on the outer `Submit=='Update'` branch reaching a
  successful `$result`).

**Business logic / edge cases:** See the SQL-defect note above — this is the single
highest-priority correctness item found anywhere in this module's source and should
be fixed (not blindly ported) in the rewrite, with the pre-clear logic re-derived
from intent rather than copied literally.

**Print/report output:** none.

**Tables touched:** `library_image_att_tb` (read/insert/update/soft-delete),
`log_tb`.

---

## Tables used across this module

| Table | Stores |
|---|---|
| `book_tb` | One row per physical copy/resource (accession number = circulation identity). Title, author, publisher, category/branch/subject/source ids, shelf/rack/page location, price/bill info, e-book attachment, damage flag, reference-copy flag. |
| `book_category_tb` | Shared lookup rows for 5 category groups distinguished by `category`: `Department` (branch), `Resource` (resource type incl. e-book), `Source`, `Subject`, `Transfer` (transfer-to destinations). |
| `book_supplier` | Book vendor/supplier master (name, address, contact) used by Resources Add/Edit's Supplier dropdown. |
| `book_transfer` | Inter-department book transfer log — `accession_no`, `transfer_to` (category id), `transfer_date`, `receive_date` (empty/`0000-00-00` = still out). |
| `library_transaction_tb` | Book circulation ledger — one row per issue; `register_no` (student/staff id), `book_id` (accession no), `check_out_date`, `due_date`, `check_in_date` (empty = still out), `is_damage`. |
| `library_setup_tb` | Single-row (`id=1`) config: issue limit + loan duration (days) per U.G/P.G/Staff category. |
| `library_attendance` | Hardware/RFID-fed raw punch log — `tktno` (student/staff id), `p_date` (timestamp), `sno`, `in_out` (present but not consistently used by the app's own In/Out logic — see Open Questions). No `del` column (no soft-delete concept here). Read-only from the app's perspective; populated by an external `cron_library` sync job. |
| `library_image_att_tb` | Webcam/manual-entry attendance pipeline — `s_id`, `staff_image`, `entry_date_time`, `entry_in_out` (`In`/`Out`, last-state-toggle logic), `manual_entry` flag distinguishing kiosk-webcam rows from back-office manual-grid rows. Currently write-only (no active report reads it) because the feeding screens are disabled in the menu. |
| `basic_setup_library_tb` | Feature flags for the (disabled) webcam attendance kiosk: `live_attendance`, `live_att_photo`. |
| `basic_setup_tb` | Institution-wide academic-year config (`ug_academic_year`, `pg_academic_year`) — read by nearly every report to resolve "current" academic year per course type. |
| `basic_setup_course_tb` | Course/degree master (course id, name, duration, department) — drives the U.G/P.G year-loop logic in dashboard and attendance reports. |
| `student_profile_tb` / `student_academic_tb` | Student identity/profile and per-year academic enrollment — joined throughout for name/photo/course-year resolution and roster building. |
| `staff_profile_tb` / `edu_setup_tb` | Staff identity/profile and staff job-category master — joined throughout for name/photo/category resolution. |
| `log_tb` | Shared audit/activity log (`insert_log()`); also double-duty as the source of the dashboard's "Last sync" timestamp (`log_page='cron_library', log_operation='Sync'`), implying an external hardware-sync cron job writes here too (not part of this module's own PHP, not found in this file set). |

---

## Open questions / ambiguities

These could not be resolved from static reading alone and should be confirmed against
the live app/DB (or with the librarian/admin users) before or during the rewrite:

1. **Two unrelated attendance pipelines.** `library_attendance` (hardware/RFID feed,
   read by Dashboard/Daily Summary/Library Att. Report) and `library_image_att_tb`
   (webcam/manual entry, written by the currently-**disabled** `library_attendance.php`
   / `library_att_entry.php` screens) appear to be entirely disconnected — nothing in
   the codebase reads the latter back into any report. Confirm whether: (a) this is
   intentional (webcam pipeline was an abandoned/parked feature) and can be dropped
   from the rewrite entirely, or (b) some other consumer (a report not in this file
   set, a cron job, an export) does read `library_image_att_tb` and needs to be found
   before deciding scope.
2. **Three different In/Out interpretation algorithms** over the same
   `library_attendance` rows: (a) running per-person odd/even counter (Dashboard,
   Dashboard drill-down), (b) direct `mod(sno,2)` parity (Daily Summary), (c) a
   10-minute-debounce paired-session model (Library Att. Report). These can disagree
   on the same underlying data. Needs a product decision on which is "correct" before
   the rewrite picks one canonical implementation — or all three must be preserved
   per-screen for exact legacy parity.
3. **`library_attendance.in_out` column exists but is not read** by any of the In/Out
   logic in this file set — all screens instead derive In/Out algorithmically. Confirm
   whether the hardware feed populates `in_out` reliably (in which case the rewrite
   could simplify to just reading it) or whether it's known-unreliable (in which case
   the algorithmic derivation must be kept).
4. **`resource_transfer.php` uses `include('config.php')`** instead of
   `include('widget.php')` like every other screen in the module — needs a runtime
   check that all the shared bootstrap variables (`$a_username`, `$a_user_ip`,
   `$a_user_dt`, `$url_ref`, page-chrome helpers) are still populated correctly on
   this specific screen; if `config.php` is a strict subset of `widget.php`'s
   bootstrap, some audit fields could be silently blank in production today.
5. **Book Return's Issue sub-path (`transaction_more.php` flag=2) does not
   re-check the person's issue limit**, unlike Book Issue's equivalent step
   (`transaction_more1.php` flag=1). Confirm with the librarian whether "Book Return"
   is ever actually used to issue a new book in practice (in which case this is a
   real bug to fix) or whether staff are trained to always use "Book Issue" for new
   issues (in which case this asymmetry is low-risk to leave as a known legacy quirk,
   or worth fixing anyway for defense-in-depth).
6. **`library_att_entry.php`'s pre-save cleanup UPDATE has a duplicated `AND AND`**
   (malformed SQL) — needs confirmation whether this throws a query error silently
   swallowed by the app (meaning the "clear existing day's entries" step never
   actually runs) or whether the live MySQL/MariaDB version tolerates it. Either way,
   do not port the query as-is.
7. **`studentLibraryAttendance($date,'U.G')` bug in `library_entry_report.php`**
   (P.G column always shows U.G data) — confirm whether to fix in the rewrite or
   preserve for exact legacy-number parity during a transition/validation period.
8. **OPAC (`resources_report.php`) — no Print button found** in the read portion of
   the file, unlike the near-identical Resources Report (§6) and Barcode (§8) screens
   which both have one. Verify against the live rendered page whether Print exists via
   some other affordance (browser-only, or a control further down the file not
   reached by static reading) before assuming it's absent by design.
9. **`resource_type==1` "e-book" magic number**, relied on by Resources
   Add/Edit/Report/OPAC to decide whether to show the e-book upload field / ISSN vs
   ISBN label / e-book download link, is a *live data value* (the id of whichever
   `book_category_tb` row happens to be first under `category='Resource'`), not a
   named constant. Confirm this id is stable/guaranteed to always mean "E-Book" in
   the live data before hard-coding `1` in the rewrite — safer to look it up by
   `category_name` match if the rewrite's schema allows.
10. **`book_category_tb.category='Category'`** (a *fourth*, unlisted category
    value used for staff job-categories, distinct from the 5 Library categories
    managed by `library_book_cate.php`) is read by several Library screens
    (`edu_setup_tb WHERE category='Category'` — actually confirmed as `edu_setup_tb`,
    a **different** table from `book_category_tb`, used for staff job-category
    lookups). Verify this is indeed a separate table/config space (`edu_setup_tb`)
    and not accidentally conflated with `book_category_tb` anywhere during the
    rewrite — the two lookup-table patterns look superficially similar
    (`category`/`category_name`/`category_order`/`del`) but serve different domains.
11. **Multi-copy availability counting is keyed by `resource_name` string equality**,
    not a normalized title id — two different books that happen to share an exact
    title string will have their "available copies" counts conflated in Resources
    Report/OPAC. Decide during the rewrite whether to keep this behavior (for exact
    parity with legacy counts) or introduce a proper title grouping.
