# 03 — Navigation & Menu — Frontend Control & UX Audit

## 1. Module recap

See [user-stories/03-navigation-menu.md](../user-stories/03-navigation-menu.md) for the full
pixel-level flow. This is the app shell chrome every authenticated screen renders inside: a
desktop top-nav with a mega-menu (`TopNav.jsx`, ~700 lines), a mobile slide-out drawer, an
in-menu search box (`TopNavSearch`), a global command palette (`CommandPalette.jsx`, ⌘K/Ctrl
K), an account dropdown (`UserMenu.jsx`), and a cosmetic theme picker
(`ThemeControlMenu.jsx`) — all driven by one `GET /api/menu` call and one large
legacy-link-to-modern-route mapping table (`legacyRoutes.js`, ~450+ entries). It is not a CRUD
module — there is no "save" anywhere in this file — but it has more distinct *interaction*
patterns (search, keyboard nav, drawer, mega-panel, sliding highlight) than most data-entry
screens in the app, which is why it earns its own control audit.

Unlike [04-settings.md](04-settings.md), where the same handful of control patterns
(native `<select>` + editable grid) repeats across 14 nearly-identical screens, Navigation is
the opposite extreme: one screen's worth of chrome, but built from several genuinely distinct,
purpose-built interaction mechanisms (two independent search implementations, a drag-free but
still fairly involved mega-panel column-packing algorithm, a portal-free dropdown, and a
keyboard-first command palette) that don't share much code with each other or with the rest of
the app's control library. That makes this file's gap analysis (§3) less about "swap component
X for component Y" and more about consistency *between* this module's own bespoke surfaces.

## 2. Frontend control inventory

| Surface | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `TopNavSearch` (desktop compact, in top bar) | Native `<input type="search">` + results dropdown | **Yes** — substring match on label/group/category/link (`searchMenuItems`) | single pick (click a result → navigate) | — | No debounce mentioned in source (filters synchronously on every keystroke against an already-loaded in-memory menu, not a server call, so no debounce is needed); empty-result state has explicit copy ("No menu items match your search."). |
| `TopNavSearch` (mobile drawer, full-width) | Same input, same search fn | Yes | single pick | — | Autofocuses ~120ms after the drawer opens; when query is non-empty, replaces the accordion list entirely (search results take over the panel). |
| `DesktopMenuBar` mega-panel | Hover/click-triggered dropdown panel, not a form control (`NavDropdownToggle` + `MegaPanel`) | No | single pick (click a link) | — | Left rail lists categories/mainMenus; right grid packs links into 1/2/3 columns via a greedy bin-packing algorithm (`packSectionsIntoColumns`) for balanced column heights — a genuinely custom layout algorithm, not a CSS-only masonry. |
| Mobile drawer accordions (`MobileAccordion`) | Native `<button aria-expanded>` toggle per category, no search filtering when collapsed | No (search only applies to the separate `TopNavSearch` above it) | — | — | Auto-opens the accordion whose category is currently active on mount; single-item categories render as a flat link, skipping the toggle affordance entirely (no needless single-item accordion). |
| Command palette (`CommandPalette.jsx`) | Overlay input + keyboard-navigable result list | **Yes** — same `searchMenuItems`, capped at 30 results, matches label/group/category/**raw `.php` filename** | single pick, keyboard `Enter` or click | — | Fully keyboard-drivable (`↑`/`↓`/`Enter`/`Esc`); shows up to 6 "recent" items from `sessionStorage` when query is empty; unmounts entirely (`return null`) when closed rather than just hiding. |
| `UserMenu` account dropdown | Trigger button + dropdown panel (avatar/name/role, Dashboard link, Log Out button) | No | — | — | Closes on outside `mousedown` or `Escape`; no confirmation on Log Out (see [01-auth-session.md](01-auth-session.md) §3-4). |
| `ThemeControlMenu` | Color swatch tiles + 4 native `<input type="color">` pickers + preset tiles + dark/light toggle group | No | single active preset, or custom colors | "Reset to default" acts as a bulk-clear of all 4 custom colors at once | Purely client-side/local preference — not part of the menu/auth system, not persisted server-side. |
| Sliding highlight (`SlideIndicator`) | Not a user control — visual state indicator only | — | — | — | Re-measures on resize, `ResizeObserver`, and `document.fonts.ready` — worth noting because it's the one piece of this module doing non-trivial layout math purely for polish. |
| Mobile hamburger (`Header.jsx`) | Native `<button aria-label="Toggle navigation menu">` | — | — | — | Three-bar icon built from plain `<span>` elements, not an icon font glyph — the one nav control that's hand-built rather than Font Awesome-based. |
| Mobile drawer close / backdrop | Native `<button aria-label="Close menu">` + click-anywhere-on-backdrop | — | — | — | Two redundant ways to close (explicit button, tap outside) — standard drawer UX, present and correct here. |
| `MenuLink` migration-pending fallback | Static `<a href="#legacy-...">` (not a real control, a dead-end link) | — | — | — | The single most-repeated "control" in this module by instance count (fires for every unmapped legacy link across `TopNav`, `CommandPalette`, `MobileAccordion`, and search results) — see gap analysis below, it has no visible-to-the-user distinction from a working link beyond a `title` tooltip that requires a hover to discover. |
| Category link vs. dropdown (`category.type`) | Server-computed binary: flat `<Link>` if 1 mainMenu, else mega-panel trigger | — | — | — | Not user-configurable — purely a data-driven rendering decision made once per page load from `GET /api/menu`'s response shape. |

**No `SearchableSelect`, `CheckListSelect`, native `<select>`, checkbox grid, or drag-reorder
exists anywhere in this module.** This is notable given the rest of the app leans heavily on
those patterns for "pick from a list" screens — Navigation instead rolled two *bespoke*
search implementations (`TopNavSearch` and the command palette) that both wrap the same
`searchMenuItems` utility rather than reusing `SearchableSelect`'s portal-dropdown UI, because
neither surface is a form field with a `value`/`onChange` contract — they're navigational
jump-lists, a genuinely different interaction shape.

## 3. Advanced feature gaps

1. **Two independent search implementations (`TopNavSearch` and `CommandPalette`) share logic
   (`searchMenuItems`) but not UI code** — each renders its own results-list markup, empty
   state, and keyboard handling instead of one shared "searchable list" presentational
   component. `SearchableSelect.jsx` already solves "portal-positioned dropdown panel with a
   search input and filtered results" as a reusable component elsewhere in the app — while
   navigation's use case isn't a form field, the *rendering* pattern (input → filtered list →
   click-to-select) is close enough that consolidating the results-list markup between these
   two navigation surfaces (not necessarily into `SearchableSelect` itself, but into one
   shared internal component) would cut real duplication.
2. **The command palette has full keyboard nav (`↑`/`↓`/`Enter`/`Esc`) but `TopNavSearch`'s
   results dropdown does not appear to** (no arrow-key handling is documented for it in the
   user-stories source, only Enter-to-pick-first-result behavior is described for other
   `SearchableSelect`-style inputs in this app, not confirmed present here) — a user who finds
   the top-nav search box first (it's more discoverable than ⌘K to a new user) gets a
   materially worse keyboard experience than a user who happens to know the palette shortcut,
   for what is functionally the same search index.
3. **No bulk/multi-action on the account dropdown or theme picker** — not a gap exactly, but
   worth flagging: `ThemeControlMenu`'s "Reset to default" is the *only* bulk action in this
   entire module (clearing 4 custom color pickers at once); nothing else in Navigation has a
   bulk pattern despite the app-wide `CheckListSelect` "Select all/Clear" convention being well
   established elsewhere (see [04-settings.md](04-settings.md)'s SMS group-checkbox pattern) —
   there's no natural fit for it here since nothing in this module is a list of *records* to
   act on, but it's the reason this module's inventory table above is so light on "bulk
   actions" cells.
4. **The migration-pending fallback link (`#legacy-<link>`) gives no in-context signal beyond
   a hover tooltip** — a click just silently rewrites the URL hash with no navigation, no
   toast, no visual state change on the link itself (US-NAV-E01). Contrast with how
   deliberately every *other* async action in this app surfaces a result (Settings' `SetupAlerts`
   banners, Dashboard's widget-load error banner) — this is the one interaction in the entire
   app that does genuinely nothing observable when clicked, which for a first-time user reads
   indistinguishably from "the click didn't register at all."
5. **The command palette's `go()` function reimplements the exact same migration-pending
   fallback as `MenuLink`, independently** (`window.location.hash = '#legacy-' + item.link`) —
   two separate implementations of the same fallback behavior in two files (`TopNav.jsx` and
   `CommandPalette.jsx`) rather than one shared helper, which is a small but real duplication
   risk: a future change to how unmapped links should behave (e.g. gap #4's fix) would need to
   be applied in both places, and it would be easy to update one and forget the other.

## 4. User-experience suggestions

1. **Add the same `↑`/`↓`/`Enter` keyboard navigation to `TopNavSearch`'s result dropdown that
   the command palette already has.** Why it helps: the top-nav search box is the *more
   discoverable* of the two search entry points (visible at all times vs. a keyboard shortcut
   a new user has to learn), so it's the one that should have the best keyboard ergonomics, not
   the one that currently lacks them — this is a case of the newer/flashier feature (command
   palette) getting better treatment than the more commonly-used one.
2. **Surface a visible hint for the command palette shortcut somewhere a first-time user will
   see it**, e.g. a one-time tooltip on `CommandPaletteTrigger` or a mention in the login
   feature strip. Why it helps: ⌘K/Ctrl+K is a power-user convention with zero organic
   discoverability in an institutional/dental-college staff context where many users won't have
   encountered it in other software — right now the only way to learn it exists is to notice
   the small `⌘K` kbd hint already rendered next to the trigger button, which is easy to miss
   in a busy top-nav row.
3. **Give the "no menu items" empty states (US-NAV-E04) an explicit message.** Currently a user
   with zero `authentication_tb` rows just sees a sparse/empty nav bar with no explanation.
   Why it helps: this reads exactly like a broken app on first login for a newly-provisioned
   account — a one-line "No modules assigned yet — contact your administrator" banner (reusing
   the exact empty-state pattern the Dashboard module already has for "No panels assigned," see
   [02-dashboard.md](02-dashboard.md)) would turn a confusing blank shell into a clear,
   actionable state.
4. **Add a visible "menu may be out of date, refresh to see recent access changes" affordance**
   tied to the 5-minute `SHELL_CACHE_TTL_MS` (US-NAV-E06). Why it helps: today, an admin
   granting a user new menu access has no way to tell that user "you should see it now" — the
   user has no indicator their nav might be stale at all. Even a simple manual "Refresh menu"
   action in `UserMenu`'s dropdown (bumping `reloadKey` the same way `AppShellLayout`'s retry
   button already does) would close the gap without needing real push invalidation.
5. **Make the shared-route `?view=` disambiguation user-visible somewhere**, e.g. a small
   breadcrumb note when a page is rendered via a shared legacy route with no `view` param
   (US-NAV-E07) — right now, navigating to a shared-destination page with no `view` param
   silently fails to highlight *any* nav row as active, which could read as "the nav lost track
   of where I am" to an attentive user. A graceful fallback (highlight the *first* variant, or
   show no highlight but log a dev warning) would make this an intentional-looking state rather
   than an apparent bug.
6. **Extend the legacy-icon fallback map (`LEGACY_ICON_MAP`, currently 15 entries)** — any
   `menu_icon` value outside that list currently renders no icon glyph at all (US-NAV-E09). Why
   it helps: a growing number of unmapped icon classes means a growing number of nav rows that
   look visually "broken" (missing icon) purely because of a translation gap, not a real
   content problem — this is a cheap, mechanical fix (add entries to a lookup table) with a
   directly visible payoff every time a new one is found.
7. **Mobile drawer: keep the search box sticky at the top while scrolling a long accordion
   list.** Why it helps: with 25+ raw (un-grouped, per the mobile drawer's intentional
   full-category-list behavior) categories, a long expanded accordion could push the search box
   off-screen on a small device — pinning it keeps the fastest way to find a screen always
   reachable without scrolling back up.
8. **Accessibility: audit the mega-panel and command palette for full ARIA correctness** —
   `role="listbox"`/`radiogroup` patterns are already used correctly in `CheckListSelect`
   elsewhere in the app; confirming the command palette's result list and the mega-panel's
   column grid follow the same `role`/`aria-activedescendant` conventions (rather than relying
   only on visual `is-active` classes) would bring screen-reader support in this
   highest-traffic surface up to the same bar the app already sets for its own list controls.
9. **Give the migration-pending fallback a visible, non-hover-dependent signal** — e.g. a small
   muted badge/icon suffix ("— coming soon") rendered directly in the link text for any item
   whose `buildMenuHref` resolves to `null`, instead of relying entirely on a `title` attribute
   tooltip that requires a mouse hover (invisible to touch/keyboard users entirely). Why it
   helps: directly closes gap #4 — a keyboard or touch user currently has *no* way to know a
   menu item is non-functional before clicking it, since `title` tooltips don't fire on tap or
   Tab-focus; this is also an accessibility gap, not just a polish one.
10. **Consolidate the two independent migration-pending fallback implementations** (`MenuLink`
   in `TopNav.jsx` and `go()` in `CommandPalette.jsx`) into one shared helper in
   `legacyRoutes.js` (e.g. `openMenuLink(link, navigate)`). Why it helps: closes gap #5 — any
   future change to fallback behavior (including suggestion #9 above) only needs to land in one
   place, removing a class of "fixed it in one surface, forgot the other" bugs that's easy to
   introduce given the current duplication.
11. **Add a small "last visited" recency marker distinct from the command palette's recents
   list** to the mega-menu itself — e.g. a subtle highlight on the mainMenu row matching the
   user's most-recently-opened item within the currently-open category. Why it helps: the
   command palette already proves the app values "recently visited" as a first-class signal
   (`RECENT_MAX = 6`, `sessionStorage`-backed); surfacing a lighter version of that same signal
   in the mega-panel itself (which most users will open far more often than they invoke ⌘K)
   would extend a feature already proven valuable to the far higher-traffic surface.
12. **Confirm the mobile drawer's accordion state doesn't reset unexpectedly on route change**
   — the source describes the "defaults open if `categoryIsActive`" behavior at *mount* time
   only; worth explicitly verifying (and if needed, fixing) that navigating between two screens
   within the same still-open drawer session doesn't collapse an accordion the user had
   deliberately expanded, which would be a small but real annoyance on a phone where re-opening
   an accordion after every tap adds up quickly across a session.

## 5. Quick wins vs. bigger investments

**Small diff, immediate win:**
- Add explicit empty-state copy for the zero-menu-items case (#3) — a single conditional
  render, reusing existing empty-state markup conventions from Dashboard.
- Add more entries to `LEGACY_ICON_MAP` as unmapped classes are discovered (#6) — pure data
  addition to a lookup table, no logic change.
- Add a visible ⌘K discoverability hint (#2) — a small UI addition (tooltip or first-login
  callout), no backend change.
- Sticky search box in the mobile drawer (#7) — CSS-only (`position: sticky`).
- Consolidate the duplicated migration-pending fallback into one shared helper (#10) — a
  focused refactor touching two files, mechanical once the shared helper signature is agreed.
- Verify/fix mobile drawer accordion state across in-drawer navigation (#12) — likely a small,
  contained state-management fix once confirmed as an actual bug.

**Needs design/product buy-in:**
- Unifying `TopNavSearch` and `CommandPalette`'s result-list rendering into one shared
  component (#1) — a real refactor across two files that both currently work correctly; needs
  scoping to avoid regressing either surface's specific behavior (autofocus timing, drawer
  close-on-navigate, etc.).
- A manual "refresh menu" action or any real invalidation signal for stale post-permission
  -change nav (#4) — touches caching architecture (`idbCache.js`, `useShellData.js`), not just
  UI, and needs a decision on whether this becomes a full push-invalidation system eventually
  (US-NAV-F06 already flags this as a plausible future direction).
- Full ARIA audit of the mega-panel and command palette (#8) — needs an accessibility pass with
  real screen-reader testing, not just a code read-through.
- Visible `?view=`-fallback handling for shared routes (#5) — needs a product decision on what
  "no view param, ambiguous destination" should actually look like in the nav.
- A visible, non-hover-dependent "coming soon" marker on migration-pending links (#9) — small
  in code size, but needs a design decision on the exact visual treatment so it reads as
  informative rather than as broken/error styling across ~450+ potential link rows.
- A "recently visited" signal inside the mega-panel itself (#11) — needs UX design work to
  avoid cluttering an already information-dense mega-panel layout.
