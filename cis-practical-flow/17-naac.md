# 17 — NAAC: Frontend Control & UX Audit

## 1. Module recap

NAAC maintains the evidence repository (qualitative narrative items and quantitative typed
documents, organized under criteria "sections") the college submits for NAAC accreditation, plus
two read-only report screens for self-audit before a submission/visit. Four screens, all through
the generic setup factory (`createSetupApi('/api/naac')`), two edit screens (`qual`, `quan`) and
two server-enforced read-only report screens (`quan-report`, `quan-detailed-report`). Full
field-by-field detail lives in
[`user-stories/17-naac.md`](../user-stories/17-naac.md) — read that first.

Bugs already flagged there that shape the suggestions below:
- **US-17.8**: `quan`'s "Order" column actually edits `docNumber`, not a true order field — typing
  non-numeric text there resolves `d_order` to `0` server-side, silently sorting that row first.
- **US-17.9**: both `qual` and `quan` saves soft-delete every currently-active item under a section
  that isn't present in the submitted payload — a stale-tab save can silently wipe items added by
  someone else since page load (no optimistic locking).
- **US-17.7**: `quan-report`'s read-only view carries a server-computed `docTypes` field the UI
  never renders a filter control for.

## 2. Frontend control inventory

| Screen (slug) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `qual` (`NaacQualScreen` → shared `NaacCrudScreen`) | Native `<select>` (Category), drag-reorderable item rows (`useDragReorder`/`DragHandle`), free-text inputs per row | No | Single category; item rows individually editable | No | **Drag-to-reorder** is the module's one non-native control pattern; row delete is immediate (no confirm), unlike `quan` |
| `quan` (`NaacQuanScreen`, bespoke) | Native `<select>` (Category), per-row radios (QN/QL/DOC type), free-text inputs (including "Attachment" as plain text, no file picker) | No | Single category; item rows individually editable | No | Delete opens `ConfirmModal` (unlike `qual`); "+" button appends one blank row at a time — no bulk-add |
| `quan-report` (`NaacQuanReportScreen` → `NaacCrudScreen` `readOnly`) | Native `<select>` (section filter only) | No | Single | No | Simplified read-only layout; `docType` filter exists server-side but has **no UI control** to set/clear it (US-17.7) |
| `quan-detailed-report` (`NaacQuanDetailedReportScreen`, bespoke) | Two native `<select>`s (Criteria, Document Type), Search + Reset buttons | No | Single (criteria) + single (doc type) — no combined multi-filter | No | Fullest report: audit columns (Created/Updated by+date), clickable attachment link; `igrapix` username relabeled `NAACSUPPORT` |

Like Certificates, none of the four screens use `SearchableSelect` or `CheckListSelect` — every
dropdown is a native `<select>`. NAAC is the **only** module in this audit that uses the
drag-reorder pattern (`useDragReorder`/`DragHandle`, `client/src/hooks/useDragReorder.jsx`), and
only on one of its four screens (`qual`) — `quan`'s equivalent "Order" column is a plain text input
with no drag affordance at all, despite editing conceptually the same kind of value.

A quick cross-screen comparison of the module's two "add item under a section" screens is useful
context for the gaps below: `qual` is the newer, more polished pattern (drag-reorder, immediate
delete, Prisma-model-based service code); `quan` is the older, more literal legacy port (radio-type
selection, `ConfirmModal`-gated delete, raw-SQL-based service code, and the mislabeled Order
column). Neither is strictly "better" across the board — `quan`'s confirm-before-delete is actually
the safer of the two patterns — but the inconsistency itself, not either pattern individually, is
the thing worth resolving.

## 3. Advanced feature gaps

- **`quan` has no drag-reorder, `qual` does — same underlying concept, inconsistent UI.** Both
  screens edit an ordered list of items under a section; `qual` uses `useDragReorder` +
  `DragHandle` with the order input rendered `readOnly disabled`, `quan` uses a free-text "Order"
  input that (per US-17.8) is actually bound to `docNumber` and silently defaults to `0` on
  non-numeric input. Porting `quan` to the same `useDragReorder` pattern already proven on `qual`
  would both fix the mislabel confusion and remove the silent-zero footgun in one change.
- **`quan`'s "Attachment" field is a bare text input, not a file upload**, even though this app
  already has a proven multipart-file pattern elsewhere in the codebase — Certificates'
  `internship-photo` screen (`client/src/pages/certificate/setup/CertificateScreens.jsx`,
  `InternshipPhotoScreen`) implements exactly the extension/size-validated upload flow this screen
  needs, including client-side pre-validation and a progress bar. NAAC staff currently must already
  know the exact uploaded filename/path to type into this field — there is no discovery mechanism
  at all.
- **`quan-report`'s doc-type filter is server-ready but has no client control** (US-17.7). Adding a
  second native `<select>` (mirroring `quan-detailed-report`'s existing Document Type dropdown,
  which already uses the same `DOC_TYPES`/`DOC_TYPE_OPTIONS` constant) would let staff actually use
  the `docTypes` field the server already computes and returns.
- **Neither `qual` nor `quan` has a "section completeness" indicator.** Given NAAC accreditation is
  inherently checklist-driven (criteria → sub-criteria → evidence), and `CheckListSelect` already
  demonstrates a "N selected" counter pattern elsewhere in the app, a similar lightweight counter
  ("N items, M missing attachments") on the section selector would surface completeness gaps
  directly in the edit screens rather than only via a separate detailed report scan.

- **The two report screens duplicate a section filter with two different UIs.** `quan-report`
  (via `NaacCrudScreen readOnly`) and `quan-detailed-report` (bespoke) each implement their own
  section `<select>`, independently, rather than sharing one filter component — a small
  consolidation opportunity (extract a shared `NaacSectionFilter` component) that would also make
  it easier to add the missing doc-type filter to `quan-report` consistently with how
  `quan-detailed-report` already does it, rather than reinventing it a second time.

## 4. User-experience suggestions

- **A completeness/progress indicator across criteria.** This is the highest-value NAAC-specific
  gap: sections with zero items are currently invisible in both report screens (US-17.5), and items
  with a blank attachment save silently with no report-level flag (US-17.6). A dashboard-style
  summary — one row per section showing item count and a computed "missing attachment" count, sat
  above or alongside `quan-detailed-report`'s existing table — turns "manually scan the URL Link
  column for blanks" into an at-a-glance readiness check, which matters directly at NAAC-visit
  deadline time when staff need to know *what's incomplete*, not just *what exists*.
- **A dedicated "missing attachment" filter on `quan-detailed-report`**, directly addressing
  US-17.6: add a checkbox ("Show only missing attachments") next to the existing Criteria/Document
  Type filters. Since the query already fetches `attachment` per row, this is a client-side filter
  on already-loaded data (or a trivial `WHERE attachment=''` addition server-side) — a small
  addition that turns the report from a full dump into an actionable to-do list before submission.
- **Real file upload on `quan`, replacing the free-text Attachment field.** Beyond closing the
  "must already know the filename" gap noted in §3, this also removes a source of broken links —
  today a typo in the typed filename produces a dead "View" link with no validation at all.
  Reusing `InternshipPhotoScreen`'s validated-upload pattern gives NAAC staff the same safety net
  (extension/size checks, upload progress, success/failure feedback) already proven for Certificates.
- **Confirm-before-delete parity on `qual`.** `qual`'s item delete is immediate with no modal,
  while `quan`'s equivalent uses `ConfirmModal`. Since both screens delete conceptually the same
  kind of accreditation evidence record, bringing `qual` up to `quan`'s existing confirm pattern
  (already imported in the same file) closes an inconsistency that currently makes one of the two
  otherwise-parallel screens meaningfully more dangerous to use.
- **Stale-save warning banner, addressing US-17.9.** Since both `qual` and `quan` silently
  soft-delete any item not present in the submitted payload, a low-cost mitigation is a
  "last-loaded" timestamp captured on `load()` and compared against a lightweight
  `GET .../section-modified` check (or simply re-confirming the item count matches what's expected)
  before save — surfacing "This section may have changed since you loaded it — reload before
  saving?" prevents accidental evidence loss during concurrent multi-tab editing, which for a small
  IQAC team working the same sections during an accreditation crunch is a real, not hypothetical,
  risk.
- **Expose `quan-report`'s doc-type filter.** A one-line addition (a second `<select>` using the
  existing `DOC_TYPES` constant already present in `quan-detailed-report`) closes US-17.7 and makes
  the two report screens' filter capabilities consistent — reviewers currently have to switch to
  the *other* report screen just to filter by document type.

## 4b. Additional UX dimensions (validation, autosave, accessibility, mobile)

- **Inline validation on blank "Name"/blank "Attachment" fields.** Both `qual` and `quan` currently
  skip blank-name rows silently on save (no error shown for the dropped row) and accept a blank
  attachment with no warning at all (US-17.6). A soft inline hint — not a hard block, since legacy
  business logic tolerates missing attachments — such as a small amber dot or "no evidence attached"
  note next to a row with a blank Attachment field would let IQAC staff self-correct in the moment
  rather than discovering the gap later via `quan-detailed-report`.
- **Autosave / draft protection for `qual`'s drag-reorder.** Because `useDragReorder` mutates local
  state immediately on drag but nothing persists until the explicit "Save" click, and because saves
  soft-delete anything not resubmitted (US-17.9), an accidental navigation away after a lengthy
  reordering session loses all of it with no warning. A `beforeunload` confirm ("You have unsaved
  reordering — leave anyway?") is a small, low-risk addition given how easy it is to lose a manual
  reorder pass across a dozen items.
- **Skeleton loading for the two report screens.** `quan-report` and `quan-detailed-report` are
  the module's most frequently re-run screens (staff re-filtering repeatedly while cross-checking
  criteria before a visit) — a table-shaped skeleton on filter-change would read as more responsive
  than the current full blocking spinner, especially since the table shape (columns) never changes
  between searches, only the row data.
- **Keyboard-driven navigation for drag-reorder.** `useDragReorder`'s `DragHandle` currently implies
  a mouse-only drag interaction; adding keyboard alternatives (e.g. focus a row, press up/down-arrow
  with a modifier to move it, matching common accessible drag-and-drop patterns) would make `qual`'s
  one distinctive interaction usable without a mouse — currently the only way to reorder qualitative
  items at all is dragging.
- **Accessibility of `ConfirmModal` and the drag handle.** Both should carry proper `role="dialog"`/
  focus-trap semantics; the `DragHandle` in particular needs an accessible name (`aria-label="Drag
  to reorder"` or similar) since it's an icon-only control with no visible text label in the reviewed
  markup.
- **Mobile responsiveness for `quan`'s eight-column items table.** `S.No | Order | Title | Type |
  Attachment | View | Size | Del` is wide for a phone/tablet; IQAC coordinators reviewing evidence
  on the move (a plausible NAAC-crunch scenario) would benefit from a stacked-card layout below a
  breakpoint, similar to the recommendation made for Certificates' `tc-details` table.

## 5. Quick wins vs bigger investments

**Quick wins (small diff, immediate win):**
- Add `ConfirmModal` to `qual`'s item delete (component already imported one file over in `quan`).
- Add the missing doc-type `<select>` to `quan-report` (constant and pattern already exist in
  `quan-detailed-report`).
- Add a "Show only missing attachments" checkbox filter to `quan-detailed-report` (data already
  fetched, just needs a client-side or trivial server-side filter).
- Fix `quan`'s mislabeled "Order" column — either rename the header to "Doc No." to match what it
  actually edits, or wire a real `order` field, as an interim step before the bigger drag-reorder
  port.

**Bigger investments (needs design/product buy-in):**
- Port `quan` to `useDragReorder`/`DragHandle` for real drag-to-reorder, matching `qual` and fixing
  the docNumber/order conflation properly (US-17.8).
- Replace `quan`'s free-text Attachment field with a real file-upload control, reusing
  Certificates' `internship-photo` validated-upload pattern.
- Build the section-level completeness/progress indicator (item counts + missing-attachment counts
  per criteria section) as a new dashboard view.
- Stale-save protection (optimistic locking or a "changed since load" warning) for `qual`/`quan`
  saves — needs product input on the right UX (block vs. warn vs. merge).
- Keyboard-accessible alternative to `qual`'s mouse-only drag-reorder — needs UX design work on the
  interaction (which keys, what visual feedback) before implementation.
- A mobile card-layout fallback for `quan`'s eight-column items table below a responsive breakpoint.
