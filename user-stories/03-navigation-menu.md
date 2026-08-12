# 03 — Navigation & Menu

> Deep-dive companion to [../userstory.md](../userstory.md). Covers the app shell chrome that
> every authenticated screen sits inside: the top navigation bar (desktop mega-menu + mobile
> drawer), the header strip, the command palette (⌘K / Ctrl K), the account/theme controls, and
> the legacy-PHP-menu-link → modern-React-route mapping layer that makes all of it work. This is
> **not** a "screen" module in the same sense as Students or Fees — it is the chrome that hosts
> every other module's screens, driven by one shared API call (`GET /api/menu`) and one shared
> mapping table (`LEGACY_ROUTE_MAP`, ~450+ entries).

---

## 1. Module overview

### Purpose

The legacy PHP app (`/home/mapims/cis/cis/`) renders its left/top navigation from
`basic_admin_menu_tb` rows joined against `admin_menu_category_tb` categories, gated per logged-in
user by `authentication_tb`. Every legacy screen is reachable only by clicking through that
PHP-rendered menu (or a raw URL to `some_screen.php`). The modernized app reproduces the same
data-driven menu (same tables, same authorization rule), but renders it as a single-row desktop
top-nav with a mega-menu, a slide-out mobile drawer, an in-menu search box, and a global
"jump to a screen" command palette — plus a translation layer (`legacyRoutes.js`) that maps each
legacy `*.php` link to the equivalent modern React route, or renders a clearly marked
"migration-pending" placeholder link when no modern route exists yet.

### Primary actors

- **Any authenticated staff/admin user** (`web_account_setup` account, JWT `req.user`) — sees the
  menu tree filtered to only the categories/links their `accessType`/`authentication_tb` grants.
- **`Global` accessType users** (superusers) — see every enabled menu row unfiltered; also bypass
  the per-module `menuAuthForModule` server-side authorization check entirely.
- **Admin (menu permission manager)** — a separate admin-setup screen (`admin_staff_authentication`
  family, e.g. `client/src/pages/admin/adminSetupMeta.js` → `'staff-auth-hod'` /
  `'staff-auth-page'` → `staff_authentication_add.php` / `staff_page_authentication_add.php`)
  grants/revokes rows in `authentication_tb`-family tables that this module reads at menu-build
  time. That admin screen itself is out of scope for this file (see `11-admin.md`); it's mentioned
  here only because its writes are what a menu-visibility user story depends on.

### Legacy .php files this module replaces / fronts

| Legacy concern | Legacy file(s) | Modern equivalent |
|---|---|---|
| Top/side navigation shell rendered on every page | `index.php` (nav include), per-module header includes | `client/src/layouts/DashboardLayout.jsx` + `TopNav.jsx` + `Header.jsx` |
| Menu tree data + per-user authorization | menu-building PHP reading `basic_admin_menu_tb` / `admin_menu_category_tb` / `authentication_tb` | `GET /api/menu` → `server/src/routes/menu.js` |
| Per-module server-side access gate (was checked page-by-page in each `.php` file's top include) | scattered `authentication_tb` checks per screen | `menuAuthForModule(moduleKey)` in `server/src/middleware/menuAuth.js`, applied per Express router |
| "Which modern screen does legacy link X open" | N/A (legacy just links to `X.php` directly) | `LEGACY_ROUTE_MAP` in `client/src/utils/legacyRoutes.js` (~450+ entries) + `resolveMenuLink` / `buildMenuHref` / `isMenuLinkActive` |
| Quick-jump / search-a-screen | not present in legacy | `client/src/components/CommandPalette.jsx` (new capability, ⌘K/Ctrl+K) |

---

## 2. Screen inventory

Not "screens" in the CRUD sense — these are the persistent UI surfaces every route renders inside.
Route column shows where each surface is mounted, not a route of its own (the shell has no route
path; it wraps `<Outlet/>`).

| Surface | Mount point | Component file(s) | Legacy counterpart |
|---|---|---|---|
| App shell / data loader | Wraps every `<Route element={<ProtectedRoute/>}><Route element={<AppShellLayout/>}>…` route in `client/src/routes/AppRoutes.jsx` (line ~152) | `client/src/layouts/AppShellLayout.jsx` | `index.php` top-level layout include |
| Dashboard layout (chrome composition, mobile drawer state, CSS var for sticky offset) | Rendered by `AppShellLayout` | `client/src/layouts/DashboardLayout.jsx` | same |
| Mobile-only header bar (hamburger + brand + theme + account) | Top of chrome, `d-lg-none` | `client/src/layouts/Header.jsx` | legacy mobile header markup |
| Desktop top nav bar + mega-menu + mobile drawer (dual-purpose file) | Top of chrome | `client/src/layouts/TopNav.jsx` | legacy `<nav>`/sidebar include |
| Command palette overlay (⌘K / Ctrl+K "jump to a screen") | Portal-style overlay, rendered once per `DashboardLayout` via `CommandPaletteProvider` | `client/src/components/CommandPalette.jsx`, `CommandPaletteContext.jsx`, `CommandPaletteTrigger.jsx` | none (new) |
| Account dropdown | Inside `Header` (mobile) and `TopNav` (desktop) | `client/src/components/UserMenu.jsx` | legacy account/logout dropdown |
| Theme control popover | Inside `Header` (mobile) and `TopNav` (desktop) | `client/src/components/ThemeControlMenu.jsx` | none (new — legacy has no theme picker) |
| Menu tree fetch + shared client-side cache | Used by `AppShellLayout` | `client/src/hooks/useShellData.js` + `client/src/utils/idbCache.js` | server-side PHP session/menu query, re-run per request |
| Menu grouping/search/label helpers | Used by `TopNav` and `CommandPalette` | `client/src/utils/menuUtils.js`, `client/src/utils/menuGroups.js` | inline PHP loop logic |
| Legacy-link → modern-route mapping | Used everywhere above | `client/src/utils/legacyRoutes.js` | N/A — legacy links directly to itself |
| Menu API endpoint | `GET /api/menu` | `server/src/routes/menu.js` | menu-rendering PHP include |
| Per-module server authorization gate | Applied to each `/api/<module>` router | `server/src/middleware/menuAuth.js` (`menuAuthForModule`) | per-screen PHP auth check |

---

## 3. Pixel-level flow

### 3.1 `GET /api/menu` — what it sends and returns

**Request:** `GET /api/menu`, `Authorization: Bearer <jwt>` header only (no query/body). Requires
`authMiddleware` (`server/src/routes/menu.js` line 40).

**Server logic (`server/src/routes/menu.js`):**
1. `userId = req.user.id`, `accessType = req.user.accessType`, `isGlobal = isGlobalAccessType(accessType)`.
2. Loads all active categories: `admin_menu_category_tb.findMany({ where: { del: 1 }, orderBy: { category_order: 'asc' } })`, selecting `id, category_name, menu_icon, category_order`.
3. If **not** Global: loads the user's allowed menu ids —
   `authentication_tb.findMany({ where: { user_id: userId, del: 1, authentication: 1 }, select: { menu_id: true } })`
   → `allowedMenuIds` Set. If Global, this query is skipped entirely (`authRows = []`).
4. Loads all enabled menu rows via raw SQL (to dodge Prisma `P2020` on legacy zero-date
   `created_dt`/`updated_dt` columns):
   ```sql
   SELECT id, category_id, menu_icon, main_menu_name, main_menu_order,
          sub_menu_name, sub_menu_link, sub_menu_order, menu_enable
   FROM basic_admin_menu_tb
   WHERE del = 1 AND menu_enable = 1
   ORDER BY main_menu_order ASC, sub_menu_order ASC
   ```
5. Builds a nested tree: `categories` → `mainMenus` (grouped by `main_menu_name` within a
   category) → `subMenus` (individual clickable links). Each `subMenu` is filtered out unless
   `isGlobal || allowedMenuIds.has(item.id)`. A `mainMenu` with zero surviving `subMenus` is
   dropped; a `category` with zero surviving `mainMenus` is dropped.
6. Sort order within a category: `compareMenuItems` — explicit `SUB_MENU_LINK_ORDER` overrides
   first (currently only `student_portfolio_dashboard.php: 1`, `student_portfolia_individual_report.php: 2`,
   `student_portfolia_individual_report_v1.php: 2`), then `main_menu_order`, then `sub_menu_order`,
   then numeric `id` as a final tiebreaker.
7. Label override: `resolveMenuLabel` swaps a link's default `sub_menu_name` for a friendlier
   label via `MENU_LABEL_OVERRIDES` — currently `class_time_table_v3.php → 'Report (New)'` and
   `tt_config_v3.php → 'Config (New)'` (both server-side; there's a separate, larger
   client-side `MENU_LABEL_OVERRIDES` in `legacyRoutes.js`, see §3.5).
8. Each `mainMenu.link` = first subMenu whose `link` is truthy and not `'#'`; `mainMenu.icon` =
   first subMenu's icon.
9. Each `category.link` is set only if the category collapses to exactly one `mainMenu` (i.e. acts
   as a single clickable link rather than a dropdown); `category.type` is `'dropdown'` if it has
   more than one `mainMenu`, else `'link'`.

**Response shape** (200):
```jsonc
{
  "menu": [
    {
      "id": 3,
      "name": "Students",              // admin_menu_category_tb.category_name
      "icon": "icon-users",            // raw legacy icon class, translated client-side
      "link": null,                    // set only when category has exactly 1 mainMenu
      "type": "dropdown",              // "dropdown" | "link"
      "mainMenus": [
        {
          "name": "Student",
          "link": "student_profile_edit.php",
          "icon": "icon-users",
          "subMenus": [
            { "id": 101, "name": "Edit Profile", "link": "student_profile_edit.php", "icon": "icon-users" },
            { "id": 102, "name": "New Profile", "link": "student_profile_add.php", "icon": "icon-users" }
          ]
        }
      ]
    }
  ]
}
```

**Error path:** any thrown error (Prisma failure, DB down) → `console.error('Menu error:', error)`
then `res.status(500).json({ message: 'Unable to load menu' })`. No partial-menu fallback — it's
all-or-nothing.

### 3.2 `useShellData()` — client-side fetch + cache (`client/src/hooks/useShellData.js`)

Called once by `AppShellLayout`. Fetches **both** `GET /api/settings/basic` and `GET /api/menu` in
parallel through a shared stale-while-revalidate cache (`cachedGet`, `client/src/utils/idbCache.js`,
cache key `'shell:v1'`, `SHELL_CACHE_TTL_MS = 300_000` (5 min)):

- `onCache` callback: if a cached payload exists (IndexedDB/session, keyed `'shell:v1'`), it paints
  immediately (`applyPayload` sets `settings`/`menu` state, `loading` set to `false`) — this is why
  the menu can appear to render before the network call finishes.
- `onFresh` callback: when the real network response lands, `applyPayload` runs again and silently
  replaces the stale menu/settings with the live ones (no visible re-render flash expected since
  shape is identical, just data).
- On network/API failure: if nothing was ever painted from cache (`!paintedFromCache`), `error`
  state is set to `err.response?.data?.message || 'Failed to load page data'`.
- Returns `{ settings, menu, loading, error, reload }`. `menu` defaults to `[]` if the payload has
  no `menu` key.

### 3.3 `AppShellLayout.jsx` — top-level states

- **Loading** (`loading === true`): renders `<PageLoading message="Loading…" />` — nothing else
  mounts, so the chrome itself doesn't appear until settings+menu resolve (or paint from cache).
- **Error** (`error` truthy): renders `<PageError message={error} onRetry={reload} />` — the entire
  shell (including nav) is unavailable; the only recovery action is the `onRetry` button which
  calls `reload()` (bumps `reloadKey`, re-runs the `useEffect` fetch).
- **Happy path:** renders `<DashboardLayout settings={settings} menu={menu}>` wrapping
  `<Suspense fallback={<PageLoading message="Loading…" />}><Outlet context={{ settings, menu }} /></Suspense>`
  — the routed page component receives `{ settings, menu }` via `useOutletContext()`.

### 3.4 `DashboardLayout.jsx` — chrome composition

DOM order (desktop):
1. `<CommandPaletteProvider>` wraps everything — supplies `open`/`setOpen` context.
2. `<CommandPalette menu={menu} />` — mounted once, renders `null` while closed.
3. `.cis-app.cis-app-topnav`
   - `.cis-body > .cis-main-column > main.cis-main`
     - `.cis-content-shell > .cis-content-canvas`
       - `.cis-chrome-sticky` (ref measured live via `ResizeObserver` to set CSS var
         `--cis-header-height` — every sticky-under-header offset in the app depends on this
         being accurate; a stale value is called out in the source comment as "sticky panel /
         scrolled-to section hidden under the header" bug class)
         - `<TopNav settings menu lastLoginAt={dashboard?.lastLoginAt} mobileOpen={navOpen} onMobileClose={...} />`
         - `<Header settings onMenuToggle={() => setNavOpen(v => !v)} />`
       - `.cis-content-body` → `{children}` (the routed page)
4. `MainScrollReset` (no visible UI) — resets `.cis-main` scrollTop to 0 on every pathname change.
5. `shellDepth` guard: if `DashboardLayout` is nested inside itself (context depth > 0) it renders
   only `children`, skipping a second chrome — prevents double-nav if a page composes layouts.

Note `dashboard?.lastLoginAt` — `DashboardLayout` accepts a `dashboard` prop but `AppShellLayout`
never passes one, so on the generic shell `lastLoginAt` is always `undefined`/`null` (the "Last
login" badge only appears where a caller explicitly supplies `dashboard`).

### 3.5 `Header.jsx` — mobile-only bar (`d-lg-none`, hidden ≥ lg breakpoint)

DOM order:
1. Hamburger button, `aria-label="Toggle navigation menu"`, three `<span className="cis-menu-toggle-bar" />` bars, `onClick={onMenuToggle}`.
2. `.cis-header-context-title` — `settings?.institutionShortName || 'CIS'` split on spaces, each
   word wrapped in its own `<span>`; odd-indexed words get class `cis-logo-accent`.
3. `<ThemeControlMenu />`.
4. `<UserMenu variant="light" />`.

### 3.6 `TopNav.jsx` — the main nav surface (largest file, ~700 lines)

#### Desktop bar (`d-none d-lg-block`, `<nav aria-label="Main">`)

DOM order inside `.cis-topnav-bar.cis-topnav-bar-single`:
1. **Brand link** — `<Link to="/dashboard" className="cis-topnav-brand">`: logo `<img src="/img/institution-logo.png" alt="" />`, then `<strong>{shortName}</strong>` / `<small>Campus Information</small>` where `shortName = settings?.institutionShortName || 'CIS'`.
2. **`<DesktopMenuBar>`** — the mega-menu bar itself (see below).
3. **`.cis-topnav-tools`**, in order:
   - `<TopNavSearch>` (compact) — search input, placeholder `"Search menu…"`, `aria-label="Search menu"` on a visually-hidden label. Icon `fa fa-search`. Clear button (`fa fa-times`, `aria-label="Clear search"`) shown only when `value` is non-empty. Results dropdown only when `normalizeMenuQuery(value)` is non-empty; each result row is a `MenuLink` showing `item.categoryIcon || item.icon || 'fa fa-circle-o'`, `<strong>{item.label}</strong>` + `<small>{item.category}</small>`. Empty state: `"No menu items match your search."`.
   - **Last login badge** (`d-none d-xl-inline-flex`, only if `lastLoginAt` truthy) — `fa fa-clock-o` icon, `<small>Last login</small>` + `formatLastLogin(lastLoginAt)` (formatted `en-IN`, e.g. `"11 Aug, 02:30 pm"`). Title attr `"Last successful login"`.
   - `<CommandPaletteTrigger />` — button, `title="Jump to a screen (⌘K)"`, `aria-label="Open command palette"`, icon `fa fa-bolt`, kbd text `⌘K` on Mac/`Ctrl K` elsewhere (detected via `navigator.platform`/`userAgent` regex `/Mac|iPhone|iPad/`).
   - `<Link to="/circular">` icon button — `fa fa-bell-o`, `title="Circulars & announcements"`.
   - `<Link to="/settings">` icon button — `fa fa-cog`, `title="Settings"`.
   - `<ThemeControlMenu />`.
   - divider `<span className="cis-topnav-tools-divider" />`.
   - `<UserMenu variant="dark" compact />`.

#### `DesktopMenuBar` internals

- `groupMenuCategories(menu)` (from `menuGroups.js`) buckets the raw `admin_menu_category_tb`
  categories (25+ in production) into fewer top-level pill buttons using `GROUP_DEFS`:
  `dashboard` (match `['Dashboard']`), `students` ("Students" pill, matches `Student`, `Student
  Portfolia`, `Student Att`, `Certificates`), `academics` (matches `Curriculum`, `Exam`,
  `E-Learning`, `NAAC`), `staff` (matches `Staff`, `Staff Att.`, `Payroll`, `Stipend Payroll`),
  `fees` (matches `Fee`), `facilities` (matches `Library`, `Hostel`, `Kiosk`, `TV`),
  `communication` (matches `Circular`, `SMS`, `Web`, `Committee`), `admin` (matches
  `Admin Office`, `Admin`, `Settings`). Any category name not matched by a `GROUP_DEF` gets its
  own standalone top-level slot (`id: 'cat-<id>'`) — "nothing silently disappears" per the source
  comment.
- Each group renders as either a plain `<NavItem>` link (single sub-menu, `groupIsDropdown` false)
  or a `<NavDropdownToggle>` button that opens a `<MegaPanel>`.
- `<MegaPanel>`: left rail (`cis-topnav-mega-rail`, shown only if the group has >1 row) listing
  either one row per category (multi-category group) or one row per `mainMenu` (single-category
  group); right side shows a `cis-topnav-mega-grid` of links for the active row, packed into 1/2/3
  columns via `columnsForCount` (≤5 links → 1 col, ≤15 → 2 cols, >15 → 3 cols) using a greedy
  bin-packing (`packSectionsIntoColumns`) so column heights stay balanced instead of flowing in
  raw source order.
- A sliding highlight pill (`SlideIndicator`, absolutely positioned, moved via `transform:
  translate(x,y)` + explicit width/height) tracks the hovered/open/active top-level item and,
  inside the mega panel, the active rail row. Re-measured on window resize, on a `ResizeObserver`
  watching the bar (covers late-arriving siblings like the last-login badge shifting layout after
  `/api/dashboard` resolves), and once more after `document.fonts.ready` resolves (Font Awesome
  loading late can shift `offsetLeft` on a cold cache).
- Closing behavior: `openCategoryId` resets to `null` on outside click (`mousedown` listener),
  `Escape` key, and on every `pathname`/`search` change (i.e. navigating away always closes the
  open mega-panel).

#### Mobile drawer (`d-lg-none`, class `cis-topnav-drawer`, `open` class toggled by `mobileOpen` prop)

DOM order:
1. `.cis-topnav-drawer-head` — brand link (same markup as desktop, navigates + closes drawer) and
   a close button (`fa fa-times`, `aria-label="Close menu"`, calls `onMobileClose`).
2. `.cis-topnav-drawer-body`:
   - `<TopNavSearch>` (non-compact), autofocuses ~120 ms after the drawer opens.
   - If the search query is empty: `<ul className="cis-topnav-menu cis-topnav-menu-mobile">` of
     `<MobileAccordion>` rows, one per raw `menu` category (not grouped by `GROUP_DEFS` — mobile
     shows the full un-bucketed category list). Each accordion:
     - **Single flattened item** → renders as a flat link, no expand affordance.
     - **Multiple items** → a toggle `<button aria-expanded>` showing category icon + name + a
       caret (`fa fa-angle-down`, rotates via `is-open` class), defaulting **open** if
       `categoryIsActive(category, pathname, search)` is true at mount; expanding reveals
       `.cis-topnav-panel-list` of every flattened item (icon + label), each an active-aware
       `MenuLink`.
3. `.cis-topnav-backdrop` — click closes the drawer (`onMobileClose`).

#### `MenuLink` — the legacy-link-aware `<a>`/`<Link>` switch (defined at top of `TopNav.jsx`, shared by every nav surface)

```jsx
function MenuLink({ link, className, children, onNavigate }) {
  const modern = buildMenuHref(link);
  if (modern) {
    return <Link to={modern} className={className} onClick={onNavigate}>{children}</Link>;
  }
  return (
    <a href={`#legacy-${link}`} className={className}
       title="Legacy module — migration pending" onClick={onNavigate}>
      {children}
    </a>
  );
}
```
This is the concrete implementation of the "migration-pending" placeholder called out in the
CLAUDE.md house rules: any `basic_admin_menu_tb.sub_menu_link` with **no** entry in
`LEGACY_ROUTE_MAP` renders as a plain anchor to `#legacy-<link>` (does not navigate anywhere real)
with tooltip text **"Legacy module — migration pending"**, instead of a React Router `<Link>`.

### 3.7 `legacyRoutes.js` — the mapping layer (`client/src/utils/legacyRoutes.js`, 586 lines)

- **`LEGACY_ROUTE_MAP`** (object, `{ 'legacy_file.php': '/modern/path' }`) — ~450+ entries, one per
  legacy screen with a modern equivalent. Representative real entries:
  ```js
  'dashboard.php': '/dashboard',
  'student_profile_edit.php': '/students',
  'student_profile_add.php': '/students/new',
  'staff_profile_edit.php': '/staff',
  'student_fee_slip_new.php': '/fees/collection',
  'elearn_dashboard.php': '/elearning/dashboard',
  'staff/subject_test.php': '/elearning/setup/subject-test',   // nested legacy path with a slash
  ```
  Several legacy files intentionally collapse onto the same modern route (e.g.
  `student_fee_slip_new.php`, `student_fee_slip.php`, `student_fee_slip_new1.php` all →
  `/fees/collection`) — handled via the `view=` query-param disambiguation described below.
- **`MENU_LABEL_OVERRIDES`** (client-side, separate from the server-side map in §3.1 step 7) —
  currently: `class_time_table_v3.php → 'Report (New)'`, `tt_config_v3.php → 'Config (New)'`,
  `student_profile_temp_add.php → 'Provisional Admission — New'`,
  `student_profile_temp_edit.php → 'Provisional Admission — Edit'`,
  `student_profile_temp_affidavit.php → 'Provisional Admission — Affidavit'`.
- **`cleanLegacyKey(legacyLink)`** — strips leading `/`, query string, and `.php`, replaces `/`/`_`
  with `-`; used as the `view=` disambiguation token, deliberately not the raw filename so the URL
  bar never shows `.php`.
- **`resolveMenuLink(legacyLink)`** — returns `null` for falsy input or `'#'`; otherwise splits
  `path?query`, looks up `path` in `LEGACY_ROUTE_MAP`, returns `null` if unmapped, else `modern` (+
  `?query` if the legacy link itself carried one).
- **`buildMenuHref(legacyLink)`** — wraps `resolveMenuLink`; if the resolved modern path is one
  that **multiple** legacy links share (computed once via `ROUTE_LEGACY_PATHS`), appends
  `?view=<cleanLegacyKey>` so the target page can tell which legacy variant was clicked.
- **`isMenuLinkActive(legacyLink, pathname, search)`** — used to highlight the current nav item.
  Handles: exact match; `PROFILE_LIST_ROUTES` special-cases (`/students` and `/staff` also "own"
  `/students/:id` / `/staff/:id` numeric profile sub-routes); `isPathOwnedBySpecificRoute` guard so
  a more specific registered route (e.g. `/students/id-card`) doesn't also light up its parent
  list route (`/students`); and for shared-route legacy links, only the one matching the current
  `?view=` query param is marked active.

### 3.8 Command palette (`CommandPalette.jsx` / `CommandPaletteContext.jsx` / `CommandPaletteTrigger.jsx`)

- **Open triggers:** `Ctrl+K` / `⌘K` (global `keydown` listener, `e.preventDefault()` +
  `setOpen(v => !v)`), `Escape` closes if open, or clicking `<CommandPaletteTrigger />` anywhere it
  is rendered (currently only in `TopNav`'s desktop tools row).
- **When closed:** component returns `null` (not just hidden — unmounted).
- **On open:** query resets to `''`, `activeIndex` resets to `0`, input autofocuses after ~30 ms.
- **Recent items:** when the palette opens with an empty query, shows up to `RECENT_MAX = 6`
  previously-visited items read from `sessionStorage['cis_cmdk_recent_v1']` (JSON array); written
  via `writeRecent(item)` every time an item is opened (de-duped by `id`, most-recent-first,
  capped at 6). `sessionStorage` read/write both wrapped in `try/catch` — quota errors or storage
  unavailability silently no-op.
- **Search:** `searchMenuItems(menu, query, 30)` — matches (case-insensitive, substring) against
  `item.label`, `item.group`, `item.category`, or `item.link` (i.e. you can search by the raw
  `.php` filename too), capped at 30 results.
- **Empty states:**
  - No query, no recents: `"Start typing to search every screen in the menu."`
  - Query present, zero matches: `` No screens match "{query}". `` (curly quotes in source:
    `&ldquo;{query}&rdquo;`).
- **List row:** icon (`item.categoryIcon || item.icon || 'fa fa-circle-o'`), `item.label` (bold),
  `item.category` + (`item.group` if present, prefixed `" › "`); a `"Current"` badge appears if
  `isMenuLinkActive(item.link, pathname, search)` is true for that row.
- **Keyboard nav:** `ArrowDown`/`ArrowUp` move `activeIndex` clamped to `[0, visible.length-1]`;
  `Enter` opens the item under `activeIndex` via `go(item)`.
- **`go(item)`:** resolves `buildMenuHref(item.link)`; writes it to recents; closes the palette;
  if a modern href exists, `navigate(href)` (React Router); otherwise
  `window.location.hash = '#legacy-' + item.link` — the same migration-pending fallback pattern as
  `MenuLink`.
- **Footer legend:** `↑↓ navigate`, `Enter open`, `Esc close` (rendered as literal `<kbd>` tags).

### 3.9 `UserMenu.jsx` — account dropdown

Trigger button: avatar (`UserAvatar` from `user.memberName`/`user.photoUrl`), and — unless
`compact` — the user's name (`user?.memberName`) plus role badge (`user?.accessType`, only
rendered `if (user?.accessType)`), plus a caret. Dropdown panel:
1. Header row — larger avatar, name, `accessType` (unconditionally rendered here, even if empty).
2. Divider.
3. `<Link to="/dashboard">Dashboard</Link>`.
4. Divider.
5. `<button onClick={logout}>Log Out</button>` (`useAuth().logout`).
Closes on outside `mousedown` or `Escape`.

### 3.10 `ThemeControlMenu.jsx` — cosmetic-only, no menu/auth interaction

Trigger: `fa fa-paint-brush` + `"Theme"` (label hidden below `md`). Panel: "Custom" swatch tile
(opens 4 color pickers: Primary / Accent / Page background / Shell background, each with a
`hint`), preset tiles from `THEME_PRESET_LIST`, a "Customize colors" collapsible section, a
"Top nav" Dark/Light toggle group (`sidebarMode`), and a "Reset to default" footer button. All
state is local browser theme preference (`useTheme()` context) — not persisted server-side, not
part of the menu/authorization system, included here only because it lives in the same chrome row.

---

## 4. Primary user stories

**US-NAV-01 — See only the modules I'm authorized for**
As a non-Global staff user, I want the top nav to show only menu categories/links I have
`authentication_tb` rows for, so that I never see or accidentally click into a screen I'm not
permitted to use.
- AC1: `GET /api/menu` filters `subMenus` to `isGlobal || allowedMenuIds.has(item.id)` (`menu.js`
  line 84); any `mainMenu` left with 0 subMenus is dropped, any `category` left with 0 mainMenus is
  dropped.
- AC2: A category with exactly one surviving `mainMenu` renders as a flat clickable link
  (`type: 'link'`); more than one renders as a dropdown/mega-panel (`type: 'dropdown'`).

**US-NAV-02 — Global users see everything without per-item checks**
As a `Global` accessType user, I want the full always-enabled menu tree regardless of my personal
`authentication_tb` rows, so that IT/admin superusers aren't blocked by incomplete permission
provisioning.
- AC1: `isGlobalAccessType(accessType)` short-circuits the `authentication_tb` query entirely
  (`authRows = []`) and the subMenu filter becomes `isGlobal || …` → always true.
- AC2: Server-side, `menuAuthForModule` also returns `next()` immediately for Global users before
  running any `LIKE` pattern check (`menuAuth.js` line 143).

**US-NAV-03 — Open a modern screen from the nav**
As a user, I want clicking a nav item whose legacy `.php` link has a modern route to navigate
there via client-side routing (no full page reload), so that navigation feels instant.
- AC1: `MenuLink` renders a React Router `<Link to={buildMenuHref(link)}>` whenever
  `resolveMenuLink(link)` finds an entry in `LEGACY_ROUTE_MAP`.
- AC2: If two+ legacy links collapse to the same modern path, the href carries `?view=<key>` so
  the destination page can render the correct variant.

**US-NAV-04 — See which nav item I'm currently on**
As a user, I want the nav item matching my current route highlighted (`is-active` class / sliding
pill), so that I have a sense of place inside a large menu.
- AC1: `isMenuLinkActive` drives the `is-active` class on `NavItem`, `NavDropdownToggle`, mobile
  accordion rows, search results, and command palette rows.
- AC2: The sliding highlight (`SlideIndicator`) animates to the active/hovered/open top-level
  group via `useSlideIndicator`, re-measuring on font load and bar resize.

**US-NAV-05 — Search the menu by typing**
As a user, I want a search box in the top nav (desktop compact / mobile drawer full) that filters
across every category/label/link, so that I don't have to hunt through a mega-menu for one screen.
- AC1: `TopNavSearch` calls `searchMenuItems(menu, query)`, matching label/group/category/link
  substrings, case-insensitively.
- AC2: Empty-result state shows `"No menu items match your search."`.
- AC3: Clicking a result clears the query and navigates (`onNavigate` → `handleNavigate` clears
  `query` and closes the mobile drawer if open).

**US-NAV-06 — Jump to any screen instantly via keyboard**
As a power user, I want `Ctrl+K`/`⌘K` to open a global command palette that searches the same menu
data and lets me arrow/Enter to a screen, so that I never need the mouse for navigation.
- AC1: Global `keydown` listener toggles `open` on the platform combo; `Escape` closes.
- AC2: `ArrowUp`/`ArrowDown` move selection, `Enter` opens the selected item via `go(item)`.
- AC3: Recently opened items (up to 6) persist across the session via `sessionStorage` and appear
  first when the palette opens with no query.

**US-NAV-07 — Collapse a large menu into a manageable mobile drawer**
As a mobile user, I want a hamburger-triggered slide-out drawer with a search box and accordions
per category, so that the full desktop mega-menu doesn't have to be reproduced on a small screen.
- AC1: `Header`'s hamburger (`onMenuToggle`) toggles `navOpen` state in `DashboardLayout`, passed
  to `TopNav` as `mobileOpen`.
- AC2: Drawer opens/closes via `open` class + backdrop click + explicit close button
  (`aria-label="Close menu"`).
- AC3: A category that flattens to exactly one item renders as a flat link (no needless
  single-item accordion).

**US-NAV-08 — See my identity and sign out from anywhere**
As a logged-in user, I want my name, role, and avatar visible in the header/top nav with a
Log Out action, so that I can confirm who I'm logged in as and end my session from any screen.
- AC1: `UserMenu` renders `user.memberName` and `user.accessType` from `useAuth()`.
- AC2: "Log Out" button calls `logout()` from `AuthContext`.

**US-NAV-09 — Fast repeat navigation via cached shell data**
As a returning user within the same session, I want the nav to render immediately from a short-TTL
cache while the network call for a fresh menu happens in the background, so that navigating
between pages (which remounts the shell in some flows) doesn't show a loading spinner every time.
- AC1: `useShellData` uses `cachedGet('shell:v1', fetcher, { ttlMs: 300_000, onCache, onFresh })`.
- AC2: A cache hit paints instantly (`setLoading(false)` in `onCache`) and is silently replaced by
  the live network result in `onFresh` once it resolves.

---

## 5. Rare / edge-case user stories

**US-NAV-E01 — Unmapped legacy menu link (migration-pending placeholder)**
As a user who clicks a menu item whose legacy `.php` file has not yet been ported, I want a clear
visual/tooltip signal that the screen isn't available yet instead of a broken navigation or a 404,
so that I understand it's a known gap, not a bug.
- Observed behavior: `MenuLink` (and the command palette's `go()`) fall back to
  `<a href="#legacy-<link>" title="Legacy module — migration pending">` — clicking it just sets
  the URL hash to `#legacy-student_something.php` and does not route anywhere; no toast, no error,
  the page underneath is whatever was already rendered.
- Same fallback fires from three independent call sites: `TopNav.jsx`'s `MenuLink`,
  `CommandPalette.jsx`'s `go()`, and (transitively) `MobileAccordion`/`TopNavSearch` since they all
  reuse `MenuLink`/`buildMenuHref`.

**US-NAV-E02 — Global accessType bypasses menu auth entirely (server + client)**
As a security reviewer, I want to confirm that `Global` accessType is a deliberate, narrowly-scoped
bypass and not an accidental hole, so that I can reason about who can see/do everything.
- Client: `GET /api/menu` skips the `authentication_tb` lookup and unfilters every subMenu
  (`menu.js` lines 44, 57-58, 84).
- Server per-module gate: `menuAuthForModule` returns `next()` immediately for Global users before
  even querying `authentication_tb`/`basic_admin_menu_tb` LIKE patterns (`menuAuth.js` line
  143-145) — meaning a Global user hitting `/api/students/*` etc. is **never** checked against
  `MODULE_MENU_PATTERNS.students`, regardless of what's provisioned for them individually.
- Edge implication: if an account is misconfigured as `Global` accidentally, it silently has full
  module access with no menu-based limiting mechanism to fall back on.

**US-NAV-E03 — Regular accessType is gated per-module via LIKE pattern matching, not per-link**
As a developer debugging a 403, I want to know that `menuAuthForModule('fees')` doesn't check the
specific screen the user is hitting — it checks whether the user has **any** `authentication_tb`
row whose joined `basic_admin_menu_tb.sub_menu_link` matches **any** of that module's configured
`LIKE` patterns (e.g. `fees: ['%fee%']`), so that a 403 doesn't necessarily mean "you lack this
exact screen," it means "you lack every screen matching this module's patterns."
- `userHasModuleAccess` runs one combined `EXISTS(... WHERE ... AND (${likeConditions}))` query
  (explicitly optimized — the source comment notes this replaced 20-30 sequential per-pattern
  round-trips for modules like `payroll`/`attendance` that have that many patterns).
- Some modules share overlapping patterns on purpose — e.g. `staff` and `payroll` both include
  `'staff_%'`, so a user with any `staff_%`-matching menu row also passes `payroll`'s module gate
  even without an explicit payroll-specific menu row (unless the specific payroll route also does
  its own finer-grained check downstream).
- Failure response: `403 { message: 'You do not have permission to access this module' }`.
- Unhandled/DB error path: `500 { message: 'Unable to verify menu permissions' }` (caught, logged
  via `console.error('Menu auth error:', error)`).

**US-NAV-E04 — Empty menu (no authorized screens at all)**
As a user with zero `authentication_tb` rows (or all rows disabled/`del=0`), I want to understand
why the nav appears mostly/entirely empty instead of assuming the app is broken, so that I know to
contact an admin for access provisioning.
- Behavior implied by the code path (not separately special-cased): `authRows` would be empty,
  `allowedMenuIds` would be an empty Set, every category's `mainMenus` would filter to zero
  subMenus, every category would be dropped by the final `.filter((category) =>
  category.mainMenus.length > 0)` — the API returns `{ menu: [] }} successfully (200, not an
  error). The desktop `<DesktopMenuBar>` would render an essentially empty bar (`groups` empty
  after `groupMenuCategories([])`), and the mobile drawer's `<ul>` would render zero
  `<MobileAccordion>` rows. Neither `TopNav.jsx` nor `menu.js` renders an explicit "no menu items /
  contact admin" empty-state message for this case — the UI would just look sparse.

**US-NAV-E05 — Menu/settings API failure on first load**
As a user whose session is valid but the menu API call fails (network blip, 500 from `menu.js`'s
catch block, DB outage), I want a clear retry affordance rather than a stuck spinner or a blank
shell, so that I can recover without a hard refresh.
- `AppShellLayout` shows `<PageError message={error} onRetry={reload} />` for the **entire** shell
  (there is no partial-chrome-with-broken-menu state) — the whole authenticated app is unusable
  until the retry succeeds.
- Exception: if a cached `'shell:v1'` payload existed from a prior successful load within the last
  5 minutes, `paintedFromCache` is true and the error is suppressed entirely — the user keeps
  seeing the *stale* cached menu with no indication the live refresh failed.

**US-NAV-E06 — Stale menu after an admin changes my access**
As a user whose `authentication_tb` grants were just changed by an admin (via the
`staff-auth-hod`/`staff-auth-page` admin screens or similar), I want to eventually see the updated
menu, so that newly granted screens become reachable / newly revoked screens disappear.
- The 5-minute `SHELL_CACHE_TTL_MS` in `useShellData`/`idbCache.js` means a user with the shell
  already cached (same tab or a persisted IndexedDB entry) can see a stale menu for up to 5
  minutes after an admin change, or until they navigate in a way that remounts `AppShellLayout`
  and the TTL has expired. There is no push/invalidation mechanism — the admin-side save action
  does not notify open client sessions.
- Server-side authorization (`menuAuthForModule`) is **not** cached — it re-queries
  `authentication_tb` on every request — so even if the *visible nav* is stale, a revoked user
  would still get a live 403 the moment they try to actually use a gated `/api/<module>` route; the
  staleness only affects what's *shown*, not what's *enforced* server-side.

**US-NAV-E07 — Two legacy screens intentionally collapse to one modern route**
As a user coming from a legacy menu link where multiple `.php` files map to the same modern page
(e.g. the three `student_fee_slip*.php` variants → `/fees/collection`), I want the modern page to
know which legacy entry point I actually clicked, so that any variant-specific default (labels,
initial filters) still makes sense.
- `buildMenuHref` detects a shared destination via `ROUTE_LEGACY_PATHS` (built once from
  `LEGACY_ROUTE_MAP`) and appends `?view=<cleanLegacyKey(legacyLink)>`.
- `isMenuLinkActive` only marks the *matching* variant's nav row active by comparing the current
  `?view=` param — if a user navigates to `/fees/collection` with no `view` param at all (e.g.
  typed URL, bookmark), **none** of the shared-route nav rows are marked active (falls through the
  final `return false` in the shared-path branch).

**US-NAV-E08 — `sessionStorage` unavailable for command-palette recents**
As a user in a browser with `sessionStorage` blocked/quota-exceeded (private browsing edge cases,
strict privacy settings), I want the command palette to still function for search/open, just
without a "recently visited" list, so that a storage restriction doesn't break core navigation.
- `readRecent()`/`writeRecent()` both wrap their `sessionStorage` calls in `try/catch` and
  silently degrade: `readRecent` returns `[]` on any error, `writeRecent` is a silent no-op.

**US-NAV-E09 — Legacy icon classes with no matching font loaded**
As a user viewing a menu row whose `menu_icon` value in the DB is an old "simple-line-icons"
class (e.g. `icon-home`) or a Unicons class (e.g. `uil uil-dashboard`) that the modern app doesn't
load a font for, I want a sensible fallback glyph instead of empty/invisible icon space.
- `resolveMenuIcon` (`menuUtils.js`) translates a known list of legacy classes to Font Awesome
  equivalents (`LEGACY_ICON_MAP`, 15 entries e.g. `icon-home → fa fa-home`,
  `icon-graduation → fa fa-graduation-cap`); anything already `fa …` passes through unchanged; any
  **unmapped** legacy class silently renders as whatever the browser does with an unknown class
  (effectively no icon) — only a handful of legacy classes are actually enumerated, so a DB row
  with an icon class outside that list falls back to rendering the raw (non-functional) class name
  with no icon glyph. When `menu_icon` is empty/whitespace, `resolveMenuIcon` explicitly falls back
  to `DEFAULT_MENU_ICON = 'fa fa-circle-o'`.

**US-NAV-E10 — `dashboard` prop never supplied to the generic shell**
As a developer investigating why "Last login" never shows on most pages, I want it documented that
`DashboardLayout`'s `dashboard` prop (source of `lastLoginAt`) is only ever passed by
`AppShellLayout` implicitly as `undefined` — `AppShellLayout` calls `<DashboardLayout settings={settings}
menu={menu}>` with no `dashboard` prop at all — so the "Last login" badge in `TopNav` is dead code
on every route mounted under the generic shell unless some other composition explicitly supplies
`dashboard`.

---

## 6. Future / predicted user stories

*(Future — not implemented. Grounded in [../mobile.md](../mobile.md) §5–§6; none of this exists in
the codebase today.)*

**US-NAV-F01 — Curated mobile nav subset per accessType**
As a mobile app user (Expo/React Native client, `mobile/` per `mobile.md` §4), I want the phone app
to show a small, role-appropriate subset of screens (Dashboard, Attendance, Fees, Exam
results/schedule, Library, Directory, Circulars/Notices) rather than the full desktop mega-menu, so
that the app stays usable on a small screen and matches what mobile users actually need.
`mobile.md` §5 explicitly states: *"mobile nav is simply a curated subset of what the menu payload
allows for that accessType"* — i.e. it plans to reuse `GET /api/menu` + `menuAuthForModule` as-is,
with the curation happening purely in the mobile client's own navigation config, not a new backend
endpoint.

**US-NAV-F02 — Push notifications for circulars**
As a mobile user, I want a push notification when a new circular/announcement is published, so
that I don't have to open the app to check the bell icon (`fa fa-bell-o` → `/circular` today on
web). `mobile.md` §8 flags this as **new backend surface** (Expo Push Notifications +
a new `server/src/services/push/` sender) requiring explicit sign-off before building — not a
trivial client-only addition like the rest of the mobile nav.

**US-NAV-F03 — Mobile "jump to a screen" equivalent of the command palette**
As a mobile user used to the web's ⌘K/Ctrl+K command palette, I want an equivalent quick-search
entry point (e.g. a persistent search tab or pull-down search) reusing the same
`searchMenuItems`/menu-label logic, so that the muscle memory from web carries over. Not mentioned
explicitly in `mobile.md`, but a natural extrapolation of its "reuse `/api/menu`" principle — a
native search-driven navigator over the same payload `CommandPalette.jsx` already searches.

**US-NAV-F04 — Directory search screen reusing the same menu-driven data pattern**
As a mobile user, I want a Staff/Student directory search screen (`mobile.md` §6, row "Staff/Student
directory" — `/api/students`, `/api/staff`, "Search + profile view, no editing in v1") — while not
strictly a *navigation* story, it depends on the same nav-shell principle of read-only, curated,
role-filtered access reusing existing backend endpoints with zero new server routes.

**US-NAV-F05 — Native share/print instead of a print window from nav-linked report screens**
As a mobile user opening a report screen reached via the curated mobile nav, I want the report
rendered via `react-native-webview` with a **Share**/**Save as PDF** action
(`expo-print` + `expo-sharing`) instead of the web's `printReportHtml()` new-window flow, so that
"print" behaves like a native mobile action. Per `mobile.md` §7.1 — no backend change, same
`printHtml`/`reportHtml` payload, new renderer only.

**US-NAV-F06 — Admin-side "who can see what" visibility into the live menu**
As an admin who just edited `authentication_tb` grants for a user, I want a way to preview exactly
what that user's `GET /api/menu` response would look like (or at minimum, a documented cache-bust
action), so that I'm not guessing whether/when the change takes effect for them. Not present today
(see US-NAV-E06's stale-cache gap) — a reasonable extrapolation of the current architecture rather
than anything mentioned in `mobile.md`, since the underlying pattern (client-side TTL cache with no
server-driven invalidation) is a genuine current gap.

---

## 7. Traceability table

| Story | Client file(s) | Server file(s) | Endpoint | Table(s) |
|---|---|---|---|---|
| US-NAV-01, E04 | `client/src/hooks/useShellData.js`, `client/src/layouts/AppShellLayout.jsx` | `server/src/routes/menu.js` | `GET /api/menu` | `basic_admin_menu_tb`, `admin_menu_category_tb`, `authentication_tb` |
| US-NAV-02, E02 | `client/src/utils/legacyRoutes.js` (n/a — client trusts server payload) | `server/src/routes/menu.js`, `server/src/middleware/menuAuth.js`, `server/src/utils/accessType.js` | `GET /api/menu`, every `/api/<module>` route wrapped in `menuAuthForModule` | `authentication_tb`, `basic_admin_menu_tb` |
| US-NAV-03, E01, E07 | `client/src/layouts/TopNav.jsx` (`MenuLink`), `client/src/utils/legacyRoutes.js` (`resolveMenuLink`, `buildMenuHref`) | — (client-only mapping) | — | — |
| US-NAV-04, E07 | `client/src/utils/legacyRoutes.js` (`isMenuLinkActive`), `client/src/layouts/TopNav.jsx` | — | — | — |
| US-NAV-05 | `client/src/layouts/TopNav.jsx` (`TopNavSearch`), `client/src/utils/menuUtils.js` (`searchMenuItems`, `normalizeMenuQuery`) | — | — | — |
| US-NAV-06, E08 | `client/src/components/CommandPalette.jsx`, `CommandPaletteContext.jsx`, `CommandPaletteTrigger.jsx` | — | — | — |
| US-NAV-07 | `client/src/layouts/Header.jsx`, `client/src/layouts/TopNav.jsx` (`MobileAccordion`), `client/src/layouts/DashboardLayout.jsx` | — | — | — |
| US-NAV-08 | `client/src/components/UserMenu.jsx`, `client/src/auth/AuthContext.js(x)` | `server/src/routes/auth.js` (logout) | `POST /api/auth/logout` (via `useAuth().logout`) | `web_account_setup` |
| US-NAV-09, E05, E06 | `client/src/hooks/useShellData.js`, `client/src/utils/idbCache.js` | `server/src/routes/menu.js`, `server/src/routes/settings.js` (`/api/settings/basic`) | `GET /api/menu`, `GET /api/settings/basic` | `basic_admin_menu_tb`, `admin_menu_category_tb`, `authentication_tb` |
| US-NAV-E03 | — | `server/src/middleware/menuAuth.js` (`MODULE_MENU_PATTERNS`, `userHasModuleAccess`) | every `menuAuthForModule(<module>)`-wrapped route | `authentication_tb` ⋈ `basic_admin_menu_tb` |
| US-NAV-E09 | `client/src/utils/menuUtils.js` (`resolveMenuIcon`, `LEGACY_ICON_MAP`) | — | — | `basic_admin_menu_tb.menu_icon`, `admin_menu_category_tb.menu_icon` |
| US-NAV-E10 | `client/src/layouts/DashboardLayout.jsx`, `client/src/layouts/AppShellLayout.jsx`, `client/src/layouts/TopNav.jsx` (last-login badge) | — | — | — |
| US-NAV-F01–F04 (future) | planned `mobile/src/navigation/**` (not yet created) | reuses existing `server/src/routes/menu.js`, `server/src/middleware/menuAuth.js` unchanged | `GET /api/menu` (reused, no new endpoint) | `basic_admin_menu_tb`, `admin_menu_category_tb`, `authentication_tb` |
| US-NAV-F02 (future) | planned `mobile/` push registration (not yet created) | planned `server/src/services/push/` (not yet created — flagged as new backend surface, needs sign-off) | none yet | `circular_%`-domain tables (existing) |
| US-NAV-F05 (future) | planned mobile report viewer (not yet created) | reuses existing `printHtml`/`reportHtml` builders per module | reuses existing report/print endpoints | unchanged |
| US-NAV-F06 (future) | none yet | none yet — extrapolated gap, no ticket/code | would extend `GET /api/menu` or a new admin preview endpoint | `authentication_tb` |
