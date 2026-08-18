# 17 — NAAC

## 1. Module overview

**Purpose.** NAAC (National Assessment and Accreditation Council) is India's institutional
accreditation body. This module lets accreditation-committee staff maintain the evidence
repository the college submits for NAAC assessment: **qualitative** criteria items (narrative
evidence with an attachment) and **quantitative** criteria items (numbered documents with a
type — QN/QL/DOC), organized under criteria "sections" (`naac_qual_main`/`naac_quan_main`), each
with orderable sub-items (`naac_qual_sub`/`naac_quan_sub`). Two read-only reports let staff
review what's on file, filtered by section and document type, for self-audit before an actual
NAAC visit/submission.

**Primary actors.**
- **IQAC (Internal Quality Assurance Cell) / NAAC coordinator staff** — maintain sections and
  items, upload/attach evidence documents, run the reports.
- **Auditors/reviewers** (read-only report consumers) — use the report screens to spot-check
  completeness before submission deadlines.

**Legacy PHP files replaced:**

| Legacy file | Screen slug |
|---|---|
| `naac_qual.php` | `qual` |
| `naac_quan.php` | `quan` |
| `naac_quan_report.php` | `quan-report` |
| `naac_quan_detailed_report.php` | `quan-detailed-report` |

## 2. Screen inventory

All four screens run through the generic setup factory (see §3.0, same contract as Certificates
— see `16-certificates.md` §3.0 for the full factory walkthrough). Base client route:
`/naac/setup/:screen`; hub `/naac`.

| Screen (slug) | Route | Component | Server load/save | Legacy `.php` | Read-only? |
|---|---|---|---|---|---|
| `qual` | `/naac/setup/qual` | `NaacQualScreen` (wraps shared `NaacCrudScreen`) | `naacQual.js` | `naac_qual.php` | No |
| `quan` | `/naac/setup/quan` | `NaacQuanScreen` (bespoke, not `NaacCrudScreen`) | `naacQuan.js` | `naac_quan.php` | No |
| `quan-report` | `/naac/setup/quan-report` | `NaacQuanReportScreen` (wraps shared `NaacCrudScreen` with `readOnly` mode) | `naacQuanReport.js` | `naac_quan_report.php` | Yes (`meta.readOnly: true`) |
| `quan-detailed-report` | `/naac/setup/quan-detailed-report` | `NaacQuanDetailedReportScreen` (bespoke) | `naacQuanDetailedReport.js` | `naac_quan_detailed_report.php` | Yes (`meta.readOnly: true`) |

Server routes: `server/src/routes/naac.js` mounts `POST /api/naac/setup/:screen/load` and
`POST /api/naac/setup/:screen/save`, both gated by `authMiddleware` +
`menuAuthForModule('naac')`. Both dispatch through `server/src/services/naac/naacSetup.js` →
`loadNaacScreen` / `saveNaacScreen`. `VALID_SCREENS = new Set(['qual', 'quan', 'quan-report',
'quan-detailed-report'])`; an unrecognized screen → `{ error: 'Unknown NAAC screen' }` (HTTP
400). Saving a screen with no entry in `SAVERS` (i.e. either report screen) →
`{ error: 'Screen is read-only' }` — this is a **server-side** guard independent of the client's
`meta.readOnly` flag, so even a crafted direct API call to save a report screen is rejected.

## 3. Pixel-level flow per screen

### 3.0 Shared factory contract

Identical to the Certificates module — see `16-certificates.md` §3.0 for the full
`createSetupApi`/`createModuleSetupPage` walkthrough. `useNaacSetupApi = createSetupApi('/api/naac')`
(`client/src/pages/naac/NaacModule.jsx`). `NAAC_SCREEN_META` has no `initialLoadFields` overrides
for any screen — every screen's first `load()` call is `load({})`.

### 3.1 `qual` — Qualitative (`naac_qual.php`)

Component: `NaacQualScreen`, a thin wrapper around the shared `NaacCrudScreen`
(`client/src/pages/naac/setup/NaacScreens.jsx`) with `itemFields = [{key:'order',label:'Order'},
{key:'name',label:'Name'}, {key:'attachment',label:'Attachment'}]`.

`NaacCrudScreen` fields (non-read-only branch, DOM order):
1. **"Category"** `<select>` — options `data.sections` (`{id, name}` from `naac_qual_main`,
   `del=1`, ordered by `d_order`), plus a trailing `<option value="add_new">Add New</option>`.
   Placeholder `--Select One--`. `onChange` calls `loadSection(value)` → sets local `deptRef`
   and `onLoad({ deptRef })`.
2. **"Category name"** `<input>`, local state only (`deptName`).
3. Grid only shown once `deptRef` is truthy and is either `'add_new'` or a numeric id
   (`showGrid`).
4. **"Category order"** `<input type="number">` (`deptOrder`).
5. **Item rows** — because `itemFields` includes `order`, rows are **drag-reorderable**
   (`useDragReorder` hook, `DragHandle` shown per row via `dragHandleProps`/`rowDropProps`). The
   `order` input itself is rendered `readOnly disabled` with `title="Drag the handle to reorder"`
   when sortable — you cannot type a number directly, only drag. Each other field (`name`,
   `attachment`) is a free-text `<input placeholder={f.label}>`.
6. **Row delete button** — icon-only `<i className="fa fa-trash">` inside
   `btn btn-sm btn-outline-danger`, `title="Delete row"`. Persisted rows (`item.id` present) call
   `onSave({ action: 'delete', id: item.id, deptRef })` immediately (**no confirm modal** on this
   screen, unlike `quan`); unsaved rows are just spliced out of local state.
7. **"Add row"** button (`btn btn-sm btn-outline-secondary`) appends
   `{ order: items.length + 1, name: '' }`.
8. **"Save"** submit button (`btn btn-danger btn-sm`).

Server load (`loadNaacQual`): uses Prisma model calls (`prisma.naac_qual_main.findMany`,
`prisma.naac_qual_sub.findMany`) rather than raw SQL — one of the few NAAC services that goes
through the Prisma client directly instead of `$queryRawUnsafe`. If `deptRef==='add_new'`, seeds
`items` with a single blank row `{order:1, name:'', attachment:''}` (so the UI always has at
least one editable row when adding a new category, even before any "Add row" click).

Server save (`saveNaacQual`): delete branch soft-deletes one `naac_qual_sub` row. Otherwise:
`deptRef==='add_new'` creates a new `naac_qual_main` row; else updates the existing section **and
soft-deletes all its currently-active sub-items** (`updateMany({ del:1 → del:0 })`) before
re-creating/updating the submitted rows — meaning **any row present in the DB but not in the
submitted `items` array on save is deleted**, not just left alone. Rows with blank `name` are
skipped. Message: `"Updated..."` or `"Deleted..."`.

### 3.2 `quan` — Quantitative (`naac_quan.php`)

Component: `NaacQuanScreen` — a bespoke component (not `NaacCrudScreen`), with its own state and
a real delete-confirmation flow.

Fields (DOM order):
1. **"Category"** `<select>` — same section-list pattern as `qual` (`--Select One--` /
   `Add New`).
2. **"Category name"** `<input>`.
3. **"Category order"** `<input>` (plain text-typed number, not `type="number"`).
4. **Items table** — columns `S.No | Order | Title | Type | Attachment | View | Size | Del`.
   - "S.No" is just `index + 1` (display only, not editable).
   - "Order" input is actually bound to `docNumber` (labelled "Order" in the header but the
     underlying field the input edits is `item.docNumber`, **not** `item.order` — read the JSX
     carefully: `<td><input ... value={item.docNumber||''} onChange={... updateItem(index,
     {docNumber:...})} /></td>` sits under the `<th>Order</th>` column).
   - "Title" input edits `item.name`.
   - "Type" — three radios per row (`name="docType-{item.id||index}"`): `QN`, `QL`, `DOC`
     (`DOC_TYPES` constant), default `QN`.
   - "Attachment" — free-text input for the stored filename/path (`item.attachment`); **there is
     no file-picker/upload control on this screen** — the attachment field is a plain text input,
     meaning staff must type or paste the already-uploaded filename/path rather than upload
     in-place.
   - "View" — `<a href={naacAttachmentUrl(item.attachment)} target="_blank">` shown only when
     `item.attachment` is set; link builds `/legacy/naac/{encodeURIComponent(filename)}` (slashes
     preserved via `.replace(/%2F/g,'/')`, i.e. subpaths in the attachment value are honored).
   - "Size" — free-text input (`item.attachmentSize`), also just typed, not computed from an
     actual upload.
   - "Del" — `btn btn-sm btn-danger`, text `Del`. Persisted rows call
     `setDeleteId(item.id)` (opens a shared `ConfirmModal` from `../../fees/setup/ConfirmModal`,
     message `"Are you sure to delete..."`); unsaved rows are spliced locally with no modal.
5. **"+"** button (`btn btn-sm btn-info`) appends a blank item (`emptyQuanItem()`:
   `{name:'', docNumber:'', docType:'QN', attachment:'', attachmentSize:''}`).
6. **"Save"** submit button (`btn btn-danger`).
7. If `items` is empty, the table still renders **one blank row** (`items.length ? items :
   [emptyQuanItem()]`) so the table is never fully empty while the grid is shown.

Server load (`loadNaacQuan`, in `naacQuan.js` using `naacQuanShared.js` helpers): mirrors `qual`'s
shape but includes `docNumber`/`docType`/`attachment`/`attachmentSize`. Server save
(`saveNaacQuan`): same soft-delete-then-recreate pattern as `qual` for the section's sub-items on
update; `d_order` on save is computed as `Number(row.order) || Number(row.docNumber) || 0` —
i.e. it falls back to the mislabeled `docNumber` field for ordering if no explicit `order` is
present in the payload (there is no `order` field surfaced in this UI at all, so in practice
`d_order` is always driven by whatever the user typed into the "Order" column, which is really
`docNumber`).

### 3.3 `quan-report` — Quantitative Report (`naac_quan_report.php`, read-only)

Component: `NaacQuanReportScreen`, `<NaacCrudScreen {...props} readOnly />`. In `readOnly` mode,
`NaacCrudScreen` renders a **different, much simpler** layout than the edit mode:
1. **Section filter** `<select className="form-control">` — options `data.sections`, first
   option `"All sections"` (value `''`). `onChange` calls
   `onLoad({ deptRef: e.target.value, docType: data?.docType })` — note `docType` is read from
   the *previous* `data`, not from any local filter state (there is no separate doc-type filter
   control rendered in this read-only branch — see caveat in §5).
2. **Results table** — columns `Section | Name | Doc | Attachment`; "Doc" cell shows
   `{docNumber} {docType}` concatenated. No pagination, no empty-state message beyond an empty
   `<tbody>`.

Server (`loadNaacQuanReport`): filters `naac_quan_sub` by `deptRef`/`docType` if given (both
optional — empty selection returns all active items across all sections). Also returns
`docTypes: [...new Set(items.map(i=>i.doc_type))]` — a **distinct list of doc types actually
present in the filtered result set** — but the read-only UI never renders a doc-type selector to
consume it, so this field is currently unused by the client (parity gap / dead payload field, or
an incomplete UI relative to the field the server was clearly built to support).

### 3.4 `quan-detailed-report` — NAAC Detailed Report (`naac_quan_detailed_report.php`,
read-only)

Component: `NaacQuanDetailedReportScreen` — bespoke, the fullest report of the module.
Fields:
1. **Criteria `<select>`** — placeholder `-- Select Criteria --`, options `data.sections`.
2. **Document Type `<select>`** — placeholder `-- Select Document Type --`, options
   `DOC_TYPES` (`['QN','QL','DOC']`, client-hardcoded, matching server's
   `DOC_TYPE_OPTIONS`).
3. **"Search"** submit button (`btn btn-danger`).
4. **"Reset"** button (`btn btn-info`) — clears both filters to `''` and reloads.
5. **Results table**, columns: `S.No | Title | URL Link | File Size | Doc.Type | Created By |
   Created Date | Updated By | Updated Date`. Empty state:
   `<td colSpan={9} className="text-muted text-center">No data available</td>`. "URL Link" cell
   is a clickable `<a target="_blank">` of the attachment URL when present, else blank.

Server (`loadNaacQuanDetailedReport`): builds `attachmentUrl` the same way as `quan`
(`/legacy/naac/{encoded filename}`), and **anonymizes/relabels one specific legacy username**:
`formatUser()` maps the literal audit-log username `'igrapix'` to the display label
`'NAACSUPPORT'` (a hardcoded legacy-support-account rename — any other `created_by`/`updated_by`
value passes through unchanged). Date formatting is `DD-MM-YYYY HH:MM` via a hand-rolled
`formatDateTime` (not using `formatDisplayDate`/`sqlSafe.js` helpers — worth reconciling with the
module's zero-date conventions if editing this file, since it does not special-case
`0000-00-00`-style values beyond `Number.isNaN(d.getTime())` returning `''`).

## 4. Primary user stories

**US-17.1 — Maintain qualitative NAAC evidence sections and items**
As an **IQAC coordinator**, I want to create/select a qualitative criteria section, add ordered
narrative items with an attachment reference, drag to reorder them, and delete items, so that
qualitative accreditation evidence stays organized by criteria.
*Acceptance criteria:* dragging an item row changes its persisted `d_order` on save; deleting a
persisted item calls save immediately (soft-delete, `del=0`) with no confirmation step; items with
a blank "Name" are silently dropped on save.

**US-17.2 — Maintain quantitative NAAC documents with type classification**
As an **IQAC coordinator**, I want to add quantitative documents under a section, classify each as
QN/QL/DOC, record an attachment reference and file size, and delete items (with a confirmation
step), so that quantitative accreditation evidence is typed and retrievable.
*Acceptance criteria:* deleting a persisted item opens a confirm modal (`"Are you sure to
delete..."`) and only calls save after confirming; the "+" button always adds one more blank row;
saving with `deptRef` unresolved to a numeric id or `'add_new'` does not render the grid at all
(nothing to save).

**US-17.3 — Review quantitative documents by section**
As an **auditor/reviewer**, I want to filter the quantitative report by section to spot-check
which documents are on file for a criterion, so that gaps are visible before a NAAC submission
deadline.
*Acceptance criteria:* selecting "All sections" (empty value) shows every active quantitative
item across all sections; the screen never allows editing (`readOnly` prop suppresses all
save-affecting controls).

**US-17.4 — Run the detailed NAAC report with audit trail**
As an **auditor/reviewer**, I want to search by criteria section and document type and see who
created/updated each document and when, plus a clickable link to the attachment, so that I can
verify evidence provenance before an accreditation visit.
*Acceptance criteria:* "Reset" clears both filters and reloads the unfiltered list; the legacy
support account `igrapix` always displays as `NAACSUPPORT` in Created By/Updated By columns.

## 5. Rare / edge-case user stories

**US-17.5 — Incomplete accreditation data entry (section with no items yet)**
As an **IQAC coordinator**, if I create a new qualitative or quantitative section (`Add New`) and
save it without adding any items, the section itself is created — but is invisible in both report
screens (which only ever list `naac_quan_sub`/`naac_qual_sub` items, never bare sections with zero
items), so an empty section silently produces **no rows anywhere** in reporting until at least one
item is added under it. There is no "sections with zero items" audit view.

**US-17.6 — Criteria item with no supporting document**
As an **IQAC coordinator**, if I add an item's Title but leave "Attachment" blank (there is no
required-field validation on `attachment` in either `saveNaacQual` or `saveNaacQuan`), the item
saves successfully with an empty attachment — the report screens render blank "View"/"URL Link"
cells for it rather than flagging it, so a section can appear "complete" in the edit screen count
while actually missing evidence. Reviewers using `quan-detailed-report` must visually scan the
"URL Link" column for blanks; there is no filter for "missing attachment only."

**US-17.7 — `quan-report`'s hidden doc-type filter**
As a **developer maintaining this screen**, note that `NaacCrudScreen`'s read-only branch reads
`docType` from the *previous* load's `data.docType` when the section filter changes (`onLoad({
deptRef: e.target.value, docType: data?.docType })`) but never renders a doc-type `<select>` for
the user to actually change it — so once a doc-type filter is set (only possible by a manual API
call or by falling through from another screen's state), the section-only filter UI cannot clear
it. This is a UI gap worth reconciling against the server's `docTypes` field, which the server
computes but the client never surfaces.

**US-17.8 — Reordering under `quan`'s mislabeled Order/docNumber column**
As an **IQAC coordinator** using `quan`, be aware that the column headed "Order" actually edits
`docNumber`, and there's no drag-to-reorder on this screen (unlike `qual`) — `d_order` is derived
server-side from `docNumber` as a fallback. Typing non-numeric text into that "Order" column
results in `d_order` being computed as `0` (`Number('abc') || 0`), which sorts that item first;
this is easy to trigger by accident since the field looks like a free-text title/number field, not
a strict numeric order control.

**US-17.9 — Save wipes items not included in the payload**
As an **IQAC coordinator**, if I load a section, then delete rows only in a **second, separate
browser tab** open on the same section (or if my local `items` state is stale because I loaded the
section a while ago and someone else added items server-side), saving from my stale tab
soft-deletes **every currently active item under that section** that isn't present in my submitted
`items` array — including items added by someone else since I loaded the page. This is a
concurrent-edit race inherent to the soft-delete-then-recreate save pattern shared by both `qual`
and `quan`; there is no optimistic-locking / "modified since you loaded" check.

### Future (not implemented)

- *(Future — not implemented)* **NAAC data auto-aggregation from other modules**: today,
  publications/seminars/conferences tracked in the Portfolio module (`student_publication_tb`,
  `student_seminar_tb` — see `18-portfolio.md`) are entered independently of NAAC's quantitative
  items; a plausible future enhancement is a bridge that auto-populates relevant NAAC quantitative
  criteria counts from Portfolio data (e.g. publication counts feeding a NAAC metric) instead of
  requiring IQAC staff to re-enter the same numbers by hand. Not present in any service read for
  this module.
- *(Future — not implemented)* **Real file upload for NAAC attachments**: replacing the current
  free-text "Attachment" input (which requires staff to already know the uploaded filename/path)
  with an actual `<input type="file">` + server upload endpoint, consistent with the pattern
  already used by `certificate-internship-photo` (`server/src/services/certificate/
  certificateInternship.js` — multipart upload with extension/size validation). Would remove the
  current burden of manually typing filenames.
- *(Future — not implemented)* **Missing-attachment audit view**: a dedicated report filtering
  `quan-detailed-report` rows to only those with an empty `attachment`, directly addressing
  US-17.6, so IQAC staff can find and close accreditation evidence gaps before a NAAC visit
  without manually scanning every row.
- *(Future — not implemented)* **Mobile read-only NAAC report access**: per `mobile.md` §6's
  "read-mostly" v1 principle, `quan-report`/`quan-detailed-report` are natural candidates for a
  mobile "view only" screen for committee members reviewing evidence on the go — no write path
  needed since both screens are already server-enforced read-only.

## 6. Traceability

| Story | Client file(s) | Server endpoint | Service file | Table(s) |
|---|---|---|---|---|
| US-17.1 | `NaacScreens.jsx` (`NaacQualScreen`/`NaacCrudScreen`) | `POST /api/naac/setup/qual/load\|save` | `naacQual.js` | `naac_qual_main`, `naac_qual_sub` |
| US-17.2 | `NaacScreens.jsx` (`NaacQuanScreen`) | `POST /api/naac/setup/quan/load\|save` | `naacQuan.js`, `naacQuanShared.js` | `naac_quan_main`, `naac_quan_sub` |
| US-17.3 | `NaacScreens.jsx` (`NaacQuanReportScreen`/`NaacCrudScreen readOnly`) | `POST /api/naac/setup/quan-report/load` | `naacQuanReport.js`, `naacQuanShared.js` | `naac_quan_main`, `naac_quan_sub` |
| US-17.4 | `NaacScreens.jsx` (`NaacQuanDetailedReportScreen`) | `POST /api/naac/setup/quan-detailed-report/load` | `naacQuanDetailedReport.js`, `naacQuanShared.js` | `naac_quan_main`, `naac_quan_sub` |
| US-17.5 | `NaacScreens.jsx` (all) | `POST /api/naac/setup/*/load` | `naacQual.js`, `naacQuan.js`, `naacQuanReport.js`, `naacQuanDetailedReport.js` | `naac_qual_main`, `naac_quan_main` |
| US-17.6 | `NaacScreens.jsx` (`NaacQuanDetailedReportScreen`) | `POST /api/naac/setup/quan-detailed-report/load` | `naacQuanDetailedReport.js` | `naac_quan_sub` |
| US-17.7 | `NaacScreens.jsx` (`NaacCrudScreen` readOnly branch) | `POST /api/naac/setup/quan-report/load` | `naacQuanReport.js` | `naac_quan_sub` |
| US-17.8 | `NaacScreens.jsx` (`NaacQuanScreen`) | `POST /api/naac/setup/quan/save` | `naacQuan.js` | `naac_quan_sub` |
| US-17.9 | `NaacScreens.jsx` (`NaacQualScreen`, `NaacQuanScreen`) | `POST /api/naac/setup/qual\|quan/save` | `naacQual.js`, `naacQuan.js` | `naac_qual_sub`, `naac_quan_sub` |
