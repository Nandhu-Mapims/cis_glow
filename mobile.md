# mobile.md — CIS Mobile App Plan (Android + iOS)

> **Scope:** A mobile *client only*. It talks to the existing Dockerized backend
> (`server/` — Express 5 + Prisma, exposed today via `docker-compose.yml` on
> `PORT=2003`) over the same `/api/*` REST surface the React web client
> (`client/`) already uses. **No new backend code, no schema changes, no PHP
> bridge changes.** This doc is the plan; nothing is implemented yet.

---

## 1. Goal

Ship a native-feeling mobile app for Android and iOS that reuses 100% of the
current backend (`/api/auth`, `/api/students`, `/api/attendance`, `/api/fees`,
`/api/exam`, `/api/library`, …) already running in the `backend` Docker
service. The mobile app is a **new frontend**, sibling to `client/`, not a
replacement for it — the web app keeps serving desktop/admin/back-office use,
while mobile targets the screens that matter on a phone (login, dashboard,
attendance, fees, exam results, notices, library, staff/student lookups).

## 2. Non-goals

- No new REST endpoints beyond what `server/src/routes/*` already expose (unless
  a genuine gap is found — see §8).
- No PHP legacy bridge calls from the mobile client directly — those stay
  server-side, same as today.
- No offline-first database / sync engine in v1. Read-mostly screens can cache
  lightly (see §6.5) but this is not an offline-capable app initially.
- No re-implementation of `del=1`/`del=0`, audit fields, course-key formats,
  etc. — all business logic stays in `server/src/services/**`, untouched.

## 3. Why React Native (Expo)

| Option | Verdict |
|---|---|
| **React Native + Expo** | **Chosen.** Team already knows React (client/ is React 19). Expo gives one codebase → Android + iOS, OTA updates, easy camera/barcode/push modules (useful for library barcode scan, ID card scan, biometric attendance later), and EAS Build removes the need for local Xcode/Android Studio toolchains for most of the work. |
| Flutter | Rejected — new language (Dart), no code/knowledge reuse with `client/`. |
| Native (Swift + Kotlin) | Rejected — 2x the work, 2x the maintenance, no shared logic. |
| Capacitor (wrap the existing Vite SPA) | Considered fallback. Fastest to ship, reuses `client/` almost as-is, but gives a "webview app" feel (no real native nav/gestures, worse offline story, App Store review risk for pages that clearly look like a website). Keep as **Plan B** if RN timeline slips. |

Decision: **Expo (React Native) app in a new top-level `mobile/` directory**,
consuming the same Axios-style REST client pattern as `client/src/api/client.js`.

## 4. Repo layout (new)

```text
legacy-cis-modernized/
├── client/                  # existing web SPA — unchanged
├── server/                  # existing Express API — unchanged (just add CORS origin for mobile if needed)
├── mobile/                  # NEW — Expo React Native app
│   ├── app.json / app.config.ts
│   ├── src/
│   │   ├── api/client.js        # Axios instance, same interceptor pattern as client/src/api/client.js
│   │   ├── auth/                # AuthContext, SecureStore token storage
│   │   ├── navigation/          # React Navigation stacks/tabs
│   │   ├── screens/<module>/    # Dashboard, Attendance, Fees, Exam, Library, Profile, …
│   │   ├── components/          # Shared UI (cards, tables→lists, print/share button)
│   │   ├── hooks/                # useXSetupApi ports (read-focused subset)
│   │   └── utils/                 # date/zero-date helpers ported from sqlSafe.js display rules
│   ├── eas.json              # EAS Build profiles (dev/preview/production)
│   └── package.json
└── mobile.md                 # this file
```

## 5. Backend connectivity

- Base URL comes from an env-style config (`app.config.ts` → `extra.apiUrl`),
  pointing at the Dockerized backend, e.g. `https://cis.mapims.org/api` in
  prod, `http://<lan-ip>:2003/api` for local dev against `docker-compose.yml`.
- **Auth:** identical flow to web (`docs/auth-flow.md`):
  1. `POST /api/auth/login` with `a_username` / `a_password`.
  2. Store JWT in **Expo SecureStore** (Keychain/Keystore-backed) instead of
     `localStorage` — mobile equivalent of `cis_token`.
  3. Axios request interceptor attaches `Authorization: Bearer <token>`.
  4. Response interceptor: `401` → clear SecureStore → navigate to Login
     (mirrors `client/src/api/client.js` behavior).
  5. `GET /api/auth/me` on app start to restore session / hydrate shell.
- **CORS:** `server/src/app.js` currently allows `CLIENT_URL`/`CLIENT_URLS`.
  Mobile (native) requests aren't browser-origin-restricted, but the Expo web
  preview and any dev proxy will need the LAN/dev URL added to
  `CLIENT_URLS` in `server/.env`. No other backend change needed.
- **Menu/access control:** reuse `GET /api/menu` + `menuAuthForModule` as-is;
  mobile nav is simply a curated subset of what the menu payload allows for
  that `accessType`.

## 6. Feature-by-feature mapping (backend already supports these)

| Mobile screen | Backend routes reused | Notes |
|---|---|---|
| Login | `/api/auth/login`, `/api/auth/me` | Same AES-128-CTR password path, same `access_tb` day/time/device gate. |
| Dashboard | `/api/dashboard` | Widget-by-widget; anything backed by PHP bridge just returns JSON same as web. |
| Attendance (student/staff) | `/api/attendance` | Calendar/list view instead of the web's grid; same data shape. |
| Fees | `/api/fees` | Read balance/history first; payment collection UI is a stretch goal (§8). |
| Exam | `/api/exam` (results, schedule) | Read-only in v1: schedule + marks/results view. Setup/admin exam screens stay web-only. |
| Library | `/api/library` | Book search, my issued books, due dates; barcode scan via `expo-camera`/`expo-barcode-scanner` reusing `/api/library` lookup endpoints. |
| Staff/Student directory | `/api/students`, `/api/staff` | Search + profile view, no editing in v1. |
| Circulars/Notices | `/api/circular` | Push-notification-worthy — see §8. |
| Files (ID card, attachments) | `/api/files` | Download → share sheet or in-app viewer instead of browser download. |

**v1 principle:** ship **read + light-write** (view attendance, view fees, view
results, view/search library, mark self-attendance if the role allows it)
before any heavy setup/admin screens. Admin/setup screens (`exam_batch.php`
style configuration, fee setup, etc.) stay on the web app — they're
desk/desktop workflows, not mobile ones.

## 7. Cross-cutting concerns

### 7.1 Print → Share/Export
Web uses `printReportHtml()` opening a new window (`client/src/utils/printReport.js`).
That doesn't exist on mobile. Replace with:
- Backend already builds `printHtml`/`reportHtml` strings — reuse as-is.
- Mobile renders that HTML via `react-native-webview` (view) and offers
  **Share** (native share sheet) or **Save as PDF** using
  `expo-print` (`Print.printToFileAsync({ html })`) → `expo-sharing`.
- No backend change required — same `printHtml` payload, new renderer.

### 7.2 Zero dates & date formatting
Port the *display* rules only (`formatDisplayDate`-equivalent: treat
`0000-00-00` as empty) into `mobile/src/utils/date.js`. Do not touch
`server/src/utils/sqlSafe.js` — all zero-date handling stays server-side; the
API already returns normalized/display-safe values for read endpoints.

### 7.3 Course/exam key formats
Mobile only ever *displays* data already resolved by the backend
(`courseIdYearKey`, `courseYearKey`, etc. are server concerns). No dropdown
building logic needs porting for v1 since setup screens aren't in scope —
just render whatever `courseYearOptions`/`selection` the load endpoints
return, read-only.

### 7.4 IPs / audit
Mobile requests still pass through the same audit middleware server-side
(`normalizeLegacyIp`, `log_tb` writes). No mobile-side change; the app doesn't
need to know about `del=1`/audit fields — those are enforced by the services
it calls.

### 7.5 File uploads (photos, attachments)
Where the web uses `<input type=file>`, mobile uses `expo-image-picker` /
`expo-document-picker` and posts `multipart/form-data` to the same
`/api/files` or module-specific upload routes — verify each target route
accepts `multipart/form-data` from a non-browser client (most Express
`multer`-based routes will; test before relying on it).

## 8. Gaps to validate against the current backend (not yet confirmed)

- [ ] **Push notifications** (circulars, fee due, attendance alerts) — there is
  no push infrastructure today. Plan: Expo Push Notifications + a small new
  `server/src/services/push/` sender triggered from existing circular/fee
  services. This *is* new backend surface — flag and scope separately, get
  sign-off before building.
- [ ] **Fee payment gateway from mobile** — if fees currently redirect to a
  bank gateway page in the web flow, confirm that flow is mobile-webview-safe
  (many gateways require a `WebView` + redirect URL scheme handling on native).
- [ ] **Rate limiting / `access_tb` device restrictions** — legacy device/time
  gating was designed for desktop kiosks; confirm it won't lock out legitimate
  mobile logins (e.g. device-type checks keyed off User-Agent).
- [ ] **File download auth** — `/api/files` likely expects a Bearer header;
  mobile downloads (via `expo-file-system`) must attach the JWT manually since
  they don't share the Axios instance the way in-app fetches do.

These are investigation items for the first sprint, not blockers to starting
the plan.

## 9. Delivery phases

1. **Phase 0 — Scaffold:** `mobile/` Expo app, navigation shell, SecureStore
   auth, Axios client mirroring `client/src/api/client.js`, login screen
   hitting the Dockerized `/api/auth/login`.
2. **Phase 1 — Read-only core:** Dashboard, Attendance (view), Fees (view),
   Exam results/schedule (view), Directory search.
3. **Phase 2 — Library + files:** Library search/issue status, barcode scan,
   file/attachment view + share/print via `expo-print`.
4. **Phase 3 — Light write:** Self-attendance mark (if legacy supports it),
   profile edits allowed to the logged-in role.
5. **Phase 4 — Notifications:** Push infra (pending §8 sign-off).
6. **Phase 5 — Store release:** EAS Build, TestFlight + Play internal testing
   tracks, then production submission.

## 10. Testing approach

- Reuse the existing HTTP checklist suite (`test/`) unchanged — it validates
  the backend the mobile app depends on; no mobile-specific backend tests
  needed since no backend code changes.
- Add a thin `mobile/` smoke script hitting the same Dockerized backend
  (`docker-compose.yml`, `PORT=2003`) to verify auth + a handful of read
  endpoints from a plain Node script, before wiring up screens.
- Manual device testing: Expo Go for rapid iteration, EAS internal
  distribution builds for device-native features (camera, secure storage,
  push) that Expo Go can't fully cover.

## 11. Open decisions for the user

- Confirm **Expo (managed) vs bare React Native** — Expo recommended unless a
  native module is needed that Expo can't support (unlikely for this scope).
- Confirm **v1 screen list** in §6 — trim/expand before scaffolding starts.
- Confirm whether **push notifications** (§8) are in scope for v1 or a later
  phase, since it's the one item that touches the backend.
- Confirm target backend URL for mobile (same Docker host as `client/`, or a
  separate public HTTPS endpoint/reverse proxy in front of `PORT=2003`).

---

Once these are confirmed, next step is scaffolding `mobile/` (Phase 0) — no
backend changes required to start.
