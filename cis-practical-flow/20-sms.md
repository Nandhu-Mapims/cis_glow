# 20 — SMS / Communication — Frontend Control & UX Audit

## 1. Module recap

See [user-stories/20-sms.md](../user-stories/20-sms.md) for the full pixel-level flow. In
short: SMS lets staff broadcast messages to students (`student-sms`), staff (`staff-sms`),
ad-hoc groups (`group-sms`), and parents ahead of a PTM (`parent-meeting-sms`); maintain
reusable templates and mobile-number groups; and audit send history. Every screen runs
through the generic `createSetupApi('/api/sms')` factory (`client/src/pages/sms/SmsModule.jsx`).
There is no live SMS gateway — every "send" is a single `sms_message_tb` row with
`sms_report: 'queued'`. All ten reachable screens live in `client/src/pages/sms/setup/`, with
`SmsSendScreen.jsx` (31 KB) carrying two of the three send flows (`StudentSmsFlow`,
`GroupSmsFlow`) internally.

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `student-sms` (`StudentSmsFlow` in `SmsSendScreen.jsx`) | Hand-rolled nested checkbox list (group header + per-year checkboxes, indeterminate state via raw DOM `ref`) driven by a hand-rolled `<input type="search">` filter over `courseGroups` | Yes — bespoke substring filter, not `SearchableSelect`/`CheckListSelect` | Multi (per course/year row) | No "select all shown" on this flow (unlike `staff-sms`/`group-sms`) | 3-step stepper bar (visual only, not routed); recipients list has its own second search box, a raw-comma-list textarea toggle, and per-row remove button |
| `staff-sms` (`GroupSmsFlow`, `groupKey="selectedGroups"`) | Flat hand-rolled checkbox list of categories + hand-rolled `<input type="search">` filter | Yes — bespoke | Multi | Yes — **"Select all shown"** checkbox above the list | Recipient table adds a Name column (`showRecipientNames`) |
| `group-sms` (`GroupSmsFlow`) | Same as `staff-sms` (shared component, different `groupLabel`/props) | Yes — bespoke | Multi | Yes — "Select all shown" | Recipient table has Mobile-only column (no Name) |
| `parent-meeting-sms` | Native `<select multiple size={10}>` for Class | No | Multi (ctrl/cmd-click, no search) | No | No stepper; single-page form; recipient table capped to first 50 rows client-side display only |
| `sms-history` | Native `<select>` (User filter), native `<input type="date">` ×2, native `<input type="text">` (Mobile) | No (dropdown itself unsearchable; the Mobile field *is* itself a substring filter against the DB) | Single (User dropdown) | No | Filter card + results table, no pagination — full result set renders at once |
| `sms-template-add` | Plain text inputs + `<textarea>`, no list control | — | — | — | No `onLoad` — always starts blank |
| `sms-template-edit` | Native `<input type="text">` search + **Previous/Next pagination buttons** (20/page) | Yes — server-side `LIKE` search | — (list, not a picker) | No | Immediate (non-confirmed) per-row Delete; inline Edit view replaces the list |
| `group-add` | Plain text input + `<textarea>`, no list control | — | — | — | Resets to blank after every save attempt, success or failure |
| `group-edit` | Same pattern as `sms-template-edit` (search + pagination + inline edit + immediate delete) | Yes — server-side `LIKE` search | — | No | Mobiles cell rendered `white-space:pre-wrap` (raw stored string, not parsed into chips) |

No screen in this module uses `SearchableSelect` or `CheckListSelect` anywhere — every
search-and-pick interaction (course/batch filtering on the three send screens, template/group
search on the two Edit screens) is a **separately hand-rolled** substring filter, each
implemented slightly differently:

- `StudentSmsFlow`/`GroupSmsFlow` filter an in-memory `courseGroups`/`groups` array client-side
  with a raw `<input type="search">` and manual `.filter()`.
- `sms-template-edit`/`group-edit` submit their search text to the **server** (`LIKE '%q%'`
  against DB columns) rather than filtering client-side, and paginate the results.
- `parent-meeting-sms`'s Class field has **no search at all** — a bare `<select multiple
  size={10}>`, meaning a college with many course/year/batch combinations must scroll a tiny
  10-row OS listbox with no filter, no "select all," and no group headers (contrast with the
  same underlying course/batch universe on `student-sms`, which gets a nested, searchable,
  checkbox-based picker one screen over).

## 3. Advanced feature gaps

1. **`parent-meeting-sms`'s Class picker is the single worst list control in this module.** It
   is a native `<select multiple size={10}>` with zero search, zero group headers, and no
   "select all" — while `student-sms`, built against the *exact same* course/year/batch slot
   universe (`loadParentCourseOptions()` vs. `loadCourseSmsOptions()` in `smsShared.js`), gets a
   fully searchable, nested, checkbox-based, badge-counted picker. There is no technical reason
   for the gap; `CheckListSelect` (already proven for exactly this "many checkbox rows with an
   8+ option auto-search" shape) could replace the `<select multiple>` directly and immediately
   bring PTM notices up to parity with Student SMS's UX.
2. **Three independent hand-rolled search implementations instead of one shared component.**
   `StudentSmsFlow`, `GroupSmsFlow`, `sms-template-edit`, and `group-edit` each reimplement
   "type in a box, filter a list" with slightly different behavior (client-side vs. server-side,
   debounced vs. not, case-sensitivity handling). None of them route through `SearchableSelect`
   (built for exactly this single-value "search then pick" pattern) even where the picker is
   conceptually single-value-ish, and none route through `CheckListSelect` even where the
   picker is a checkbox list that already reimplements `CheckListSelect`'s own "Select all shown
   / Clear" toolbar by hand (`staff-sms`/`group-sms`'s "Select all shown" checkbox is a
   from-scratch reimplementation of `CheckListSelect`'s built-in `selectAll`/`clearAll`
   buttons).
3. **`sms-history`'s "User" dropdown is a plain `<select>`** with no search — acceptable while
   the sender list is capped at 300 accounts (per the load query), but a college approaching
   that cap would have a long, unsearchable dropdown for a screen whose entire purpose is fast
   filtering/investigation. `SearchableSelect` is a drop-in replacement here (single-value,
   substring search, portal dropdown) with no server changes needed.
4. **No pagination on `sms-history`'s results table.** Unlike `sms-template-edit`/`group-edit`,
   which paginate 20/page, `sms-history` renders every matching `sms_message_tb` row from the
   filter at once — a wide date range with a common sender/mobile substring could return a very
   long unpaginated table with no client-side row cap or "load more."
5. **The two Edit screens' (`sms-template-edit`, `group-edit`) list tables have no bulk-select
   or bulk-delete** — each row's Delete button fires independently; cleaning up a dozen stale
   templates/groups after a semester means a dozen individual clicks, each with no confirm step
   (see UX suggestion #5 below).

## 4. User-experience suggestions

1. **Recipient-count preview before send, surfaced identically on all three step-flow
   screens.** Today `StudentSmsFlow`/`GroupSmsFlow` show a badge count only after "Load
   recipients" completes a full round-trip; there's no lightweight "~N mobiles across your
   current selection" estimate while the user is still checking boxes. Why it helps: the badge
   on each course/category checkbox already shows a per-row `mobileCount` — summing the
   currently-checked rows' badges into a running total next to the "Load recipients" button (no
   extra API call, purely client-side arithmetic on data already loaded) lets a sender catch an
   obviously-wrong selection (e.g. "3 recipients" for what should be a whole year) before
   spending a round-trip.
2. **Character-count *and* segment-count indicator on the SMS text box**, addressing US-20.10.
   Today `SmsSendScreen.jsx` shows a live `{charCount} chars` counter with no segmentation math
   and no limit warning. Why it helps: a soft warning like "312 characters — this will send as 3
   SMS segments" (using the standard 160/70-char GSM-7/Unicode split) lets senders trim a message
   before it silently becomes a 3x-billed multi-part SMS with no UI signal today — this is a pure
   client-side computation, no server change required to add real value even before any gateway
   integration exists.
3. **Send-history search should support "search across all fields" and remember the last
   filter.** `sms-history`'s current filter (Mobile / User / date range) requires re-entering
   criteria on every visit since nothing persists across navigation. Why it helps: this screen's
   entire purpose (per US-20.5) is investigating "did message X actually go out" — a
   support/audit workflow that typically involves re-running a similar search multiple times in
   one sitting; even a simple "last search" `sessionStorage` cache removes repetitive retyping.
4. **Add a distinct "zero recipients" warning to `StudentSmsFlow`, matching `GroupSmsFlow`'s
   existing one.** Per US-20.8, `GroupSmsFlow` already shows *"No valid 10-digit mobile numbers
   found in the selected group(s)..."* when a selection resolves to zero mobiles, but
   `StudentSmsFlow` just renders a silently-empty recipient table with no equivalent text. Why it
   helps: a class teacher selecting a batch where every student happens to have a blank
   `mobile_no` currently gets no explanation for why the recipient table is empty — reusing the
   warning copy pattern that already exists two components over closes this gap with a small,
   scoped diff.
5. **Confirm-before-delete on `sms-template-edit` and `group-edit`,** reusing the `confirmSend`
   banner pattern already built into `SmsSendScreen.jsx` (or the `ConfirmModal` pattern used
   elsewhere in the app, e.g. Web CMS's Event delete). Why it helps: per US-20.12, both screens'
   Delete buttons fire an immediate soft-delete with zero confirmation step, while the *far less
   consequential* "Load recipients" action three screens over gets an explicit two-click confirm
   banner — the risk/friction ratio is inverted today.
6. **A visible "queued, not delivered" status badge on every send-confirmation response,**
   addressing US-20.9. Why it helps: `"Message queued for {n} mobile(s)..."` already says
   "queued" in text, but nothing in the UI visually distinguishes this from an actual delivery
   confirmation — a small badge/icon (e.g. a clock icon next to "Queued") would set correct
   expectations that delivery is a separate downstream step (SMS Cron), especially important
   since `sms-history` has no delivery-status column at all to check later.
7. **Auto-uppercase/normalize pasted mobile numbers in the "Edit comma list" textarea** on the
   send screens, and validate the 10-digit format live rather than only at send time. Why it
   helps: the raw-textarea toggle (`"Edit comma list"`) lets a sender paste an arbitrary
   comma/newline-separated blob; today malformed entries are silently dropped only when
   `parseMobileList` runs server-side (per US-20.8's group-mode warning) — a live per-line
   validity check (green/red) in the textarea itself would catch typos before "Apply list."
8. **Bulk "select all" on `student-sms`'s nested checkbox list,** matching the "Select all
   shown" control already present on `staff-sms`/`group-sms`. Why it helps: `StudentSmsFlow` is
   the only one of the three step-flows without any bulk toggle — a college-wide notice (e.g. a
   holiday announcement to every course) currently requires manually checking every group/year
   row one at a time.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Recipient-count running total while checking boxes (#1) — pure client-side arithmetic on data
  already in `data.courseGroups`/`data.groups`.
- Character/segment counter upgrade (#2) — client-only computation, no API change.
- "Zero recipients" warning on `StudentSmsFlow` (#4) — copy/condition already exists in the
  sibling `GroupSmsFlow` component to copy from.
- "Select all shown" checkbox on `student-sms`'s nested list (#8) — same pattern already built
  twice for `staff-sms`/`group-sms`.
- Confirm-before-delete on Edit Template/Edit Group (#5) — reuse existing `confirmSend`/
  `ConfirmModal` pattern already in the codebase.
- "Queued" status badge on the send-success banner (#6) — presentation-only change.

**Bigger investments (needs design/product buy-in first):**
- Swapping `parent-meeting-sms`'s `<select multiple>` for `CheckListSelect` — straightforward
  technically, but changes the visual layout of that screen and should be checked against the
  legacy `parent_meeting_sms.php` for parity expectations first (per the repo's migration
  philosophy).
- Consolidating the three hand-rolled search implementations into one shared "searchable
  checkbox list" component (ideally `CheckListSelect` itself, extended with the badge/group-
  header features `StudentSmsFlow` needs) — a real refactor, not a copy-paste fix, touching all
  three send screens.
- Pagination + persisted filters on `sms-history` — needs a decision on default page size, and
  possibly a "recent searches" UX, before implementation.
- Live per-line mobile-number validation in the raw-textarea "Edit comma list" mode (#7) — needs
  a decision on how much validation to surface without duplicating `parseMobileList`'s server
  logic in the client.
