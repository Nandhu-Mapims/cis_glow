# CIS Mobile (Expo / React Native)

Native Android + iOS client for the CIS backend. Talks to the **same**
Dockerized API (`docker-compose.yml`, `backend` service, default `PORT=2003`)
that `client/` (the web SPA) uses — no backend code was added or changed to
build this. See [`../mobile.md`](../mobile.md) for the full plan and phases.

This scaffold was generated without network access, so dependencies are
declared in `package.json` but **not yet installed**. Run the install step
below on a machine with npm registry access.

## What's implemented (Phase 0 + a slice of Phase 1)

- Login (`POST /api/auth/login`), JWT stored in `expo-secure-store`
  (Keychain/Keystore), auto-restore via `GET /api/auth/me`, 401 → auto logout.
- Bottom-tab shell: **Dashboard**, **Menu**, **Profile**.
- Dashboard: reads the same widget list as the web dashboard
  (`GET /api/dashboard`, `GET /api/dashboard/widgets?w=...`) and renders a
  generic card per widget (title + summarized payload).
- Menu: renders the full category → main-menu → sub-menu tree from
  `GET /api/menu`, already scoped by the account's `accessType` /
  `authentication_tb` rows, same as the web sidebar.
- Tapping a menu item that doesn't have a native screen yet shows an honest
  "not built natively yet" placeholder (`ModuleScreen.js`) — **not** a WebView
  wrapper around the legacy PHP or the web SPA, by design (see mobile.md §3).
- Profile: shows the logged-in user + sign out.

## Not implemented yet (see `mobile.md` Phases 1–5)

Attendance/Fees/Exam/Library native screens, file share/print via
`expo-print`, push notifications, offline caching, EAS build profiles.

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # then edit EXPO_PUBLIC_API_URL to point at your backend
npm start               # opens Expo dev tools; scan the QR code with Expo Go
```

- **Backend must be running first** — `docker compose up backend` from the
  repo root, or `cd server && npm run dev`.
- Physical device testing: your phone and the backend must be reachable on
  the same network; set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not
  `localhost`) — see comments in `.env.example`.
- Android emulator: `10.0.2.2` maps to the host machine's `localhost`.
- iOS simulator: `localhost` works directly.

## Project layout

```text
mobile/
├── App.js                    # Root: AuthProvider + NavigationContainer
├── app.json                  # Expo app config (name, bundle ids, icon)
├── .env.example               # EXPO_PUBLIC_API_URL
├── src/
│   ├── api/client.js          # Axios instance + SecureStore token interceptor
│   ├── auth/AuthContext.js    # login/logout/me, mirrors client/src/auth/AuthContext.jsx
│   ├── navigation/            # Bottom tabs (Dashboard/Menu/Profile) + Menu stack
│   ├── screens/               # LoginScreen, DashboardScreen, MenuScreen, ModuleScreen, ProfileScreen
│   ├── theme/colors.js        # Shared color palette
│   └── utils/media.js         # Resolves server-relative image paths (photoUrl, …) to absolute URLs
```

## Adding a native screen for a module (Phase 1+)

1. Open the matching legacy PHP + the web page in `client/src/pages/<module>/`
   to confirm the data shape and filters (same rule as the main `CLAUDE.md`).
2. Add a screen under `src/screens/<module>/`, calling the existing
   `POST /api/<module>/setup/<slug>/load` (or module-specific GET routes)
   via `src/api/client.js` — no new backend routes for screens the web app
   already supports read-only.
3. Register a route for it in `src/navigation/MainNavigator.js`'s `MenuStack`,
   and match it to the menu item's `link` (legacy `.php` filename) instead of
   falling through to `ModuleScreen`.
4. If the screen needs a printable report, reuse the service's `printHtml`
   payload and render it via `react-native-webview` + `expo-print` /
   `expo-sharing` (see mobile.md §7.1) rather than `window.open`.
