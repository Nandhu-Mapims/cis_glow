# 16 — Certificates: Frontend Control & UX Audit

## 1. Module recap

Certificates covers the full request → approve → generate/print lifecycle for bonafide/fee/custom
certificates, Transfer Certificates (TC), internship (CRI) completion certificates, and the two
AAADAR specialty certificates (Implant, Laser), plus receipt/fee tracking for certificate
requests. Sixteen screens, all mounted through the generic setup factory
(`createSetupApi('/api/certificates')` + `createModuleSetupPage`), one bespoke standalone
component (`ApproveScreen.jsx`, outside `CertificateScreens.jsx`). Full field-by-field detail,
including the pre-flagged bugs referenced below, lives in
[`user-stories/16-certificates.md`](../user-stories/16-certificates.md) — read that first; this
file only adds the interface-pattern lens on top of it.

Two bugs already flagged there and relevant to the UX suggestions below:
- **US-16.9**: the duplicate-request guard on `cert-request` only checks `status = 0` (pending) —
  a student can freely resubmit the same certificate once a prior request is Approved/Rejected.
  This is legacy-correct behavior, not a defect, but the UI gives **no warning before submit**
  that a pending duplicate exists (§3, §4 below).
- **US-16.11**: the "Certificate For" photocopy-item checkbox section only renders when a
  subcategory's `c_format` is the exact string `"photocopy"` — a typo'd format value (e.g. `"Photo
  Copy"`) silently drops that UI section with no error.

## 2. Frontend control inventory

| Screen (slug) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `setup` (Category/Subcategory) | Native `<select>` (category, template-per-row) + editable table rows | No | Single (category); table rows are independent | No (one row `Del` at a time) | Row-level inline edit; "Add row" appends a blank row; delete is immediate (no confirm) for persisted rows |
| `approve` (`ApproveScreen.jsx`, bespoke) | Native `<input>` search box, native date pair, native radio group (status), modal form (radios + textarea + text inputs) | Yes — free-text "Search By" (Roll No) | Single record selected into modal at a time | No (one Approve/Reject action per row, no batch-approve) | Manual Bootstrap modal (`div.modal.d-block`), server-side pagination (20/page, Previous/Next), static "Report" summary card always unfiltered |
| `generate` | Free-text `<textarea>` (receipt/register numbers), "Search" button | Yes (via textarea, comma/whitespace split) | Multi — the textarea itself accepts multiple tokens | No explicit bulk action, but multi-token search doubles as a lightweight bulk lookup | Results render as cards, not a table; no persistence (search-only) |
| `receipt-add` | Native `<select>` (Apply for), text inputs | No | Single | No | Comma-separated free-text "Reason" field client-parsed into an array |
| `receipt-edit` | Text input (Receipt no) + "Load" button, then plain form | No | Single | No | Two-step: load-by-number, then edit |
| `receipt-report` | Native date pair, native `<select>` (Type) | No | Single | No | Read-only report; running total computed server-side |
| `cert-request` | Native `<select>` (Category, Certificate), checkbox group (photocopy items) | No | Single (category/cert); multi (photocopy checkboxes) | No "select all"/"clear" on the checkbox group | Conditional UI section (only for `format==='photocopy'`); "Last Request" side card |
| `tc-details` | Native `<select optgroup>` (course), per-row radios (Completed/Discontinued), per-row `<select>` (discontinued year) | No | Single (course); per-row radio is single-choice | No batch "mark all as Completed" | Editable table (admission no/date, leaving/issue dates inline), server pagination (50/page) |
| `tc-request-add` | `<textarea>` (comma-separated roll numbers) | No | Multi (comma list is the batch mechanism) | Implicit — one textarea submission covers many roll numbers | Simplest possible bulk-entry pattern: no per-row UI at all |
| `tc-request-edit` | Native date pair, table with per-row Delete | No | Single delete at a time | No "select all rows, delete" | Confirm modal on delete (`Are you sure to delete...`) |
| `tc-generate` | Text input (Register no) + "Load" | No | Single | No | Card results, no print button (gap noted in user-stories) |
| `internship-schedule` | Text input (Register no) + "Load", 6 generic labeled inputs | No | Single student at a time | No | Un-humanized labels (`elDepartment`, `totalPeriod`, etc. shown raw); per-row delete on internship history table |
| `internship-generate` | Radio group (Roll No / Batch), text input or `<select optgroup>` | No (roll-no field takes literal comma list, no substring search) | Single result focused via clickable list | No | Print button (disabled until `certificateHtml` ready); CSS injected once on mount |
| `internship-photo` | `<input type="file" multiple accept=".jpg,.jpeg">`, checkbox (Overwrite) | No | Multi (native multi-file picker) | Implicit — multi-file select is the bulk mechanism, but uploads run **sequentially, one POST per file** | Progress bar; per-file success/failure list; 3 MB / extension validated client- and server-side |
| `implant-cert` / `laser-cert` | Identical to `internship-generate` (shared `AaadarCertificateScreen`) | No | Single | No | Parameterized by `title`/`CERT_CONFIG`, not two separate components |

None of the 16 screens use `SearchableSelect` or `CheckListSelect` — every dropdown is a plain
native `<select>` (or `optgroup`-grouped native select for course pickers), and every multi-item
input is either a checkbox group, a comma/whitespace-delimited free-text field, or a native
multi-file `<input type="file">`. There is no drag-reorder anywhere in this module (contrast NAAC's
`qual` screen, §2 of `17-naac.md`).

## 3. Advanced feature gaps

- **`internship-generate` course/batch `<select optgroup>` has no search.** The dropdown groups
  by course, and for a large multi-course institution this can be a long scroll. `SearchableSelect`
  (`client/src/components/SearchableSelect.jsx`) already solves exactly this — substring filter
  over a portal-rendered panel — and is a drop-in replacement for a single-value native `<select>`
  with the same `value`/`onChange` contract. Same applies to `implant-cert`/`laser-cert` (shared
  component) and `tc-details`'s course `<select optgroup>`.
- **`cert-request`'s photocopy checkbox group has no "Select all" / "Clear".** `CheckListSelect`
  already provides exactly this (`Select all` / `Clear` buttons, `{n} selected` counter) for
  multi-checkbox lists — the current hand-rolled checkbox loop in `CertificateScreens.jsx` (around
  line ~209) reimplements a weaker version of the same pattern with no bulk toggle.
- **`internship-photo`'s multi-file upload is sequential, not batched server-side** (flagged as
  US-16.14 in user-stories): 200 photos means 200 round-trips with no cancel button once started.
  This is a backend/protocol gap, not a control-type gap, but it directly undermines the "bulk
  upload" framing of the screen — see §4.
- **`approve` screen has no bulk approve/reject.** Every row requires opening the modal
  individually, even though the filter+list already narrows to, say, "all Pending requests from
  this week." A `CheckListSelect`-style row-selection column plus a single "Approve selected" /
  "Reject selected" action would materially speed up high-volume approval days (exam season,
  admission season).
- **`generate` and `tc-generate` results render as unstyled cards with no way to jump straight to
  print** for a specific one when multiple match — a `CheckListSelect`-style clickable list (as
  already used in `internship-generate`) would make disambiguating among several matches faster
  than reading through card text.

## 4. User-experience suggestions

- **Certificate preview before generation.** `internship-generate`/`implant-cert`/`laser-cert`
  already render `certificateHtml` via `dangerouslySetInnerHTML` before printing — this pattern
  should extend to `tc-generate` (currently no print path at all per user-stories §3.11) and to
  `generate` (bonafide/fee/custom certs), so staff can visually confirm the certificate content
  (name spelling, course, dates) before committing to a print run, rather than discovering an error
  on the printed physical document.
- **Bulk certificate generation for a batch of students.** `internship-generate`'s "Batch" search
  mode already resolves a whole course/batch to a student list — extend that pattern so, once a
  batch is loaded, staff can multi-select students (`CheckListSelect`, "Select all" included) and
  generate/print certificates for the whole selection in one action, instead of clicking through
  students one at a time. This directly reduces the friction the current one-student-at-a-time flow
  imposes at batch-graduation time (a recurring, predictable high-volume event for this college).
- **Pre-submit duplicate-request warning on `cert-request`.** Per US-16.9, the guard against a
  second pending request for the same certificate only surfaces as a save-time error message. Since
  the "Last Request" card already loads and displays the student's most recent request, the client
  could proactively grey out or flag the Certificate dropdown option when the last request for that
  category/subcategory is still pending (`status=0`) — this turns a reactive error into upfront
  guidance, and costs nothing extra server-side since the data is already being fetched.
- **`approve` bulk actions with the existing summary card as a live progress indicator.** The
  "Report" card (Total/Approve/Pending/Rejected) already exists and is always unfiltered — once
  bulk approve/reject ships (§3), this card becomes a natural live indicator of "N left to review"
  progress during an approval session, reinforcing why the two changes pair well together.
- **Confirm-before-delete parity on `setup`.** `setup`'s subcategory row delete has **no confirm
  modal** (unlike `tc-request-edit`'s and NAAC's `quan` screen's `ConfirmModal`), and is
  irreversible via UI (soft-delete only reversible by direct DB edit). Given subcategories are
  catalog-config data that other in-flight `cert-request` submissions may depend on, adding the
  same `ConfirmModal` used elsewhere in the app (`client/src/pages/fees/setup/ConfirmModal`) would
  bring this screen to the same safety bar as its siblings.
- **Humanize `internship-schedule`'s field labels.** Per user-stories §3.12, labels are the raw
  camelCase keys (`elDepartment`, `totalPeriod`) rather than human text — a small, low-risk
  relabeling pass (`"EL Department"`, `"Total Period"`) removes a real readability papercut for
  staff who aren't developers.
- **Surface "student has left" context on `cert-request`/`receipt-add`/`internship-generate`.**
  Per US-16.10, a student already marked Completed/Discontinued on `tc-details` can still have
  certificates issued with no UI indication of their leaving status. A small inline badge ("Left:
  {releaving_info} on {releaving_date}") next to the resolved student's name — data already fetched
  via `lookupStudent` — gives staff the context to decide whether re-issuing is intentional (e.g.
  alumni bonafide) without needing tribal knowledge.
- **Client-side "photocopy" format normalization warning on `setup`.** Per US-16.11, a subcategory
  saved with a near-miss format string (extra space, wrong case) silently loses the photocopy
  checkbox UI on `cert-request`. Since `setup`'s Template `<select>` already constrains input to the
  five known values, this specific failure mode is already largely closed off by the existing
  dropdown — but a one-line validation note directly under the Template select reminding staff that
  "photocopy" formats unlock item-selection at request time would help catch any legacy data that
  predates the dropdown's introduction.
- **Cap the internship-photo batch, or show cumulative progress across restarts.** Since uploads
  are sequential single-file POSTs (§3), a large batch benefits today only from the existing
  progress bar; a small addition — remembering already-succeeded filenames in the results list
  across a page reload / retry — would let staff resume a large batch without re-uploading files
  that already succeeded.

## 4b. Additional UX dimensions (validation, autosave, accessibility, mobile)

- **Inline validation instead of save-time errors.** `receipt-add`/`cert-request`/`tc-request-add`
  all currently discover required-field problems (`"Register number and apply type required."`,
  `"Session name is required"`-style messages elsewhere) only after clicking Save/Submit — a
  simple red-outline + inline message on blur for `registerNo` (already known to be required in
  three separate screens) would shorten the feedback loop without touching server logic.
  `ApproveScreen`'s modal already models the kind of small in-form guidance this module is missing
  elsewhere (its status radios visually gate which fields are relevant).
- **No autosave anywhere in this module** — `setup`'s subcategory table, `tc-details`'s per-row
  editable dates, and `internship-schedule`'s six-field form are all vulnerable to losing in-
  progress edits on an accidental navigation or session timeout. Given `tc-details` in particular
  can involve editing many rows across a 50-row page before saving once, even a simple
  `localStorage` draft-recovery ("Restore unsaved changes?" banner on reload) would reduce the risk
  of re-doing work after a JWT expiry (`401` → forced redirect to `/login` per CLAUDE.md's auth
  flow) mid-edit.
- **Skeleton loading vs. spinner-only states.** Every screen in this module currently shows
  `SetupPageShell`'s generic page-level spinner during the initial `load()`; screens with an
  obviously tabular shape (`approve`, `receipt-report`, `tc-details`) would read as more responsive
  with a table-shaped skeleton (header + a few grey rows) instead of a full-page blocking spinner,
  particularly on the 20–50-row paginated screens where the layout is already well known before
  data arrives.
- **Keyboard shortcuts for high-frequency actions.** `approve` is the screen most likely to be used
  repeatedly in a single sitting (batch-processing pending requests); a keyboard shortcut to
  advance to the next pending row after Confirm (e.g. auto-open the next row's modal) would reduce
  mouse-only interaction fatigue during exam-season approval spikes.
- **Accessibility of the hand-rolled `approve` modal.** The modal (`div.modal.d-block`, manually
  rendered rather than a library dialog) has no visible focus trap or `role="dialog"`/
  `aria-modal="true"` in the reviewed markup — keyboard users tabbing through the page can currently
  tab out of the modal into the page behind it while it's open. Adding a focus trap and proper ARIA
  roles matters here specifically because this modal is the module's single most-used interactive
  surface.
- **Mobile responsiveness of wide tables.** `tc-details`'s 9-column student table and the
  two-row-per-publication-style density seen in Portfolio (not this module, but a useful contrast)
  both rely on Bootstrap's `table-responsive` horizontal scroll on narrow viewports — functional but
  not pleasant for a registrar working from a tablet during a walk-through TC session. A
  card-per-student collapsed layout below a breakpoint (already a common Bootstrap pattern) would
  read better than a horizontally-scrolling 9-column grid on a phone/tablet screen.

## 5. Quick wins vs bigger investments

**Quick wins (small diff, immediate win):**
- Add `ConfirmModal` to `setup`'s subcategory row delete (pattern already exists in-repo).
- Humanize `internship-schedule`'s six raw camelCase field labels.
- Swap `internship-generate`/`implant-cert`/`laser-cert`/`tc-details`'s course `<select optgroup>`
  for `SearchableSelect` (drop-in, same value/onChange contract).
- Add "Select all" / "Clear" to `cert-request`'s photocopy checkbox group via `CheckListSelect`.
- Show a "student has left" badge on resolved-student cards in `cert-request`/`receipt-add`/
  `internship-generate` (data already available from `lookupStudent`).

**Bigger investments (needs design/product buy-in):**
- Certificate preview-before-print for `tc-generate` and `generate` (new `certificateHtml`
  builders needed server-side, plus print CSS parity work).
- Bulk approve/reject on `approve`, and bulk certificate generation for a selected batch on
  `internship-generate`/`generate` — both require new row-selection UI plus new batch-mutation
  endpoints, and product input on what "bulk approve" should do for exam-related certificates that
  require per-row subject-attempt data.
- Parallelizing/batching `internship-photo` uploads server-side (multipart batch endpoint) instead
  of one-POST-per-file — a protocol change, not just a UI change.
- Draft-recovery/autosave for the longer editing screens (`setup`, `tc-details`,
  `internship-schedule`) — needs a decision on storage (localStorage vs. server-side draft table)
  and on how to reconcile a restored draft against data that may have changed server-side since.
- A focus-trapped, ARIA-correct rebuild of the `approve` modal (and, if adopted, extending the same
  treatment to `tc-request-edit`'s delete-confirm modal) — worth pairing with the bulk-action work
  above since a redesigned modal is a natural place to also add "approve and advance to next" flow.
- A responsive, card-per-row fallback layout for `tc-details`'s 9-column table below a mobile
  breakpoint.
