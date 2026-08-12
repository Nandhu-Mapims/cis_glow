# 01 — Auth & Session

> Deep-dive companion to [README.md](README.md). Covers login, JWT session lifecycle,
> logout, `GET /api/auth/me` rehydration, `access_tb` day/time/device gating, and the
> failed-login rate limit. Cross-reference: [docs/auth-flow.md](../docs/auth-flow.md).

---

## 1. Module overview

**Purpose:** Authenticate a CIS user (staff/admin — this app has no student self-service
login screen in the current codebase) against the shared legacy `web_account_setup` table,
issue a JWT session, and gate every subsequent API call behind that token. Session state
also drives which menu links a user is authorized to see (see
[03-navigation-menu.md](03-navigation-menu.md)).

**Primary actors:**
- **Any CIS staff member with a `web_account_setup` row** — logs in with Member ID (or
  email) + password.
- **Global-access admin** (`access_type = 'Global'`) — bypasses `access_tb` day/time/device
  restrictions and later bypasses per-menu `authentication_tb` checks (see
  `isGlobalAccessType` in `server/src/utils/accessType.js`).
- **Restricted/departmental user** (`access_type` = anything else, e.g. `'admin'` is also
  treated as unrestricted for `accessCheck`, other values are gated) — subject to
  `access_tb` day-of-week/time-window or date-range restrictions, and optionally
  device-lock (`local_access = 1`).

**Legacy PHP files replaced:**
- `index.php` — login form + rate limiting via `log_tb`.
- `password.php` — AES-128-CTR password validation against `web_account_setup`.
- `access_tb` gating logic (day/time/device — originally inline in legacy login flow).
- `$_SESSION['empusername_login']` server-side session — replaced by a signed JWT.
- `widget.php` — legacy per-page "load current user context"; replaced by
  `GET /api/auth/me`.
- `otp_request.php` — legacy forced-password-reset OTP flow. **Not yet migrated** — the
  modern login screen only detects the condition and shows a placeholder message (see
  §3, Login screen, error states).
- Implicit legacy `logout.php` — replaced by `POST /api/auth/logout`.

---

## 2. Screen inventory

| Route | Component file | Legacy `.php` counterpart |
|---|---|---|
| `/login` | `client/src/pages/Login.jsx` | `index.php` |
| *(all protected routes)* | `client/src/routes/ProtectedRoute.jsx` (gate, not a screen) | implicit session check on every legacy page |
| *(no dedicated route — context provider)* | `client/src/auth/AuthContext.jsx` | `widget.php` (per-page session/user load) |

There is exactly one user-facing screen in this module: **Login**. Session
rehydration (`/api/auth/me`) and logout are side-effects, not screens, and are documented
in §3 alongside Login since they share the same `AuthContext`.

---

## 3. Pixel-level flow per screen

### 3.1 Login — `client/src/pages/Login.jsx`

**On mount:**
- `useEffect` fires `api.get('/api/settings/public')` (no auth header needed — public
  endpoint). Response populates `settings` state; on any error, `settings` is set to
  `null` and the screen silently falls back to defaults (no visible error to the user).
- If `isAuthenticated` (from `useAuth()`) is already true, the component renders
  `<Navigate to="/dashboard" replace />` instead of the form — no interstitial screen.

**Layout (DOM order):**

*Left hero pane (`<aside className="login-hero">`)*:
- Institution mark: `<img src="/img/institution-logo.png" alt="" />`
- Heading: `Hello` / `{institutionName}!` (two-line `<h2>`; `institutionName` =
  `settings?.institutionShortName || 'APDCH'`)
- Copy: *"Manage students, staff, attendance, fees and academics from one connected
  campus system."*
- Footer: `© {currentYear} {institutionName}. All rights reserved.`

*Right form pane (`<main className="login-form-pane">`)*:
- `<ThemeControlMenu />` in a `login-theme-slot` div (theme switcher, not part of this
  module's scope).
- Banner image: `<img className="login-card-banner" src="/img/login-banner.png"
  alt={institutionName} />`
- Card head: `<h1>Sign in</h1>` and `<p>{pageTitle}</p>` where `pageTitle` =
  `settings?.adminTitle || \`${institutionName} Central Login\``.
- `<form onSubmit={handleSubmit}>`:
  1. **Member ID field** — `<i className="fa fa-user">` icon + `<input id="login-username"
     type="text" placeholder="Member ID" maxLength={20} autoComplete="username" autoFocus>`.
     `onChange` runs the typed value through `validateCharNum()`
     (`client/src/utils/validation.js`), which strips the characters
     `\ ! " $ % ^ & + * _ = { } ; : ' @ # ~ , ( ) - / < > ? | \` [ ]` before storing —
     i.e. the field silently rejects most punctuation as the user types (no error
     message shown for this — it's a silent filter, not a validation error).
  2. **Password field** — `<i className="fa fa-lock">` icon + `<input id="login-password"
     type={showPassword ? 'text' : 'password'} placeholder="Enter your password"
     maxLength={50} autoComplete="current-password">`. `onKeyDown`/`onKeyUp` call
     `handlePasswordKeyEvent`, which reads `event.getModifierState('CapsLock')` into
     `capsLockOn` state; `onBlur` forces `capsLockOn` back to `false`.
     - **Show/hide toggle button** — `<button type="button" className="login-password-toggle"
       aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
       tabIndex={-1}>` containing `<i className={showPassword ? 'fa fa-eye-slash' : 'fa fa-eye'}>`.
       Purely client-side toggle, no network call.
     - **Caps Lock warning** — conditionally rendered `<p className="login-caps-lock-warning"
       role="status">` with `<i className="fa fa-exclamation-triangle">` and text
       `Caps Lock is on`. Shown only while `capsLockOn` is true.
  3. **Submit button** — `<button className="login-submit" type="submit" disabled={loading}>`.
     Label is `Signing in…` while `loading` is true, otherwise `Sign In`.
- **Error banner** — `<div className="login-error" role="alert">{displayError}</div>`,
  rendered only when `displayError` is truthy (see error-message mapping below).
- **Feature strip** — `<ul className="login-register-strip">` rendering three fixed
  `LOGIN_FEATURES` entries (icon + title), hard-coded in the component, not from the API:
  - `fa-calendar-check-o` → "Today's register"
  - `fa-stethoscope` → "Academics & clinicals"
  - `fa-shield` → "Scoped access only"
- **Footer note** — `<p className="login-footer-note">Authorized users only. Contact your
  administrator for access.</p>`

**Submit flow (`handleSubmit`):**
1. `event.preventDefault()`, clear `error`, set `loading = true`.
2. Calls `login(username, password)` from `AuthContext`, which does
   `api.post('/api/auth/login', { a_username: username, a_password: password })`.
3. On success: if `result.user?.resetPasswordRequired` is true, sets
   `error = 'Password reset required. OTP flow will be migrated in a later phase.'` and
   **returns without navigating** — the user is left on the login screen even though a
   token was already stored (`AuthContext.login` unconditionally does
   `localStorage.setItem('cis_token', ...)` and `setUser(...)` before this check runs in
   `Login.jsx`). This is a known interim gap, not a bug workaround the agent should "fix"
   silently — see §5.
4. Otherwise: `navigate('/dashboard')`.
5. On error (any rejected promise, e.g. 401/403/429/500): `setError(err.response?.data?.message
   || 'Wrong! Username or Password.')`.
6. `finally`: `setLoading(false)`.

**Error message display mapping** — the component rewrites the server's fixed legacy-parity
string for display:
```js
const displayError = error === 'Wrong! Username or Password.'
  ? 'Incorrect Member ID or password. Check your details and try again.'
  : error;
```
So any *other* server message (429 lockout text, 403 access-check text, 500 fallback) is
shown **verbatim** as returned by the API. Concrete server-side messages that can surface
here, verbatim, from `server/src/routes/auth.js` and `server/src/services/accessCheck.js`:
- `"Your login has been temporarily disabled due to excessive login failures. Please try again in 5 minutes..."` (HTTP 429)
- `"You are not an autherised user..."` (HTTP 403 — note legacy misspelling of "authorised", preserved verbatim for parity)
- `"Login failed"` (HTTP 500 catch-all)
- Client-side network failure (no `err.response`) falls back to `'Wrong! Username or Password.'`
  → displayed as `'Incorrect Member ID or password. Check your details and try again.'`, which
  is misleading for a genuine network/server-down error (see §5).
- Also client-level: `'Too many login attempts. Please wait a moment and try again.'` from the
  Express rate limiter (HTTP 429, see §3.2) if the raw-request cap is hit before the DB-backed
  check even runs.

**What the login call sends / returns:**
- Request: `POST /api/auth/login` body `{ a_username, a_password }` (client always sends
  these two keys; server also accepts bare `username`/`password` as a fallback per
  `req.body.a_username || req.body.username`).
- Success response (HTTP 200):
  ```js
  {
    token: <JWT string>,
    user: {
      id, memberId, memberName, email, accessType, photo, photoUrl,
      resetPasswordRequired, sessionId,
    },
    redirectTo: 'dashboard.php' | 'otp_request.php' | <first authorized menu link>,
  }
  ```
  (`redirectTo` is computed server-side but **not currently consumed** by `Login.jsx` —
  the client always navigates to `/dashboard` regardless of `redirectTo`; see §5.)
  On success, if `accessCheck` returned `deviceCookies`, the server also sets two
  `httpOnly`, `sameSite: 'lax'`, 1-year-`maxAge` cookies
  (`login_random_id_<userId>`, `login_user_id_<userId>`) shared with the legacy PHP app
  for "remembered device" recognition.
- Failure responses: `401` (bad credentials), `403` (access_tb denial), `429` (rate
  limited, from either the Express limiter or the 5-failed-in-5-minutes DB check),
  `500` (unexpected error).

### 3.2 Session bootstrap & rehydration — `client/src/auth/AuthContext.jsx`

- On provider mount: reads `localStorage.getItem('cis_token')`. If absent,
  `loading = false` immediately (no API call — anonymous state).
- If present: calls `GET /api/auth/me` (Bearer header attached by the Axios interceptor
  in `client/src/api/client.js`). On success, `setUser(res.data.user)`. On any error
  (typically `401 Invalid or expired token` or `404 User not found`), the token is
  removed from `localStorage` and `user` is reset to `null`. `loading` is set `false`
  either way.
- `login(username, password)` — see §3.1; stores `res.data.token` under `cis_token` and
  sets `user = res.data.user` unconditionally (even when `resetPasswordRequired` is true
  — see the caveat in §3.1 step 3 and §5).
- `logout()` — calls `POST /api/auth/logout` (best-effort; failures are swallowed with an
  empty `catch`), then always removes `cis_token` from `localStorage` and clears `user`
  client-side regardless of whether the server call succeeded.
- Exposed context value: `{ user, loading, login, logout, isAuthenticated: Boolean(user) }`.

**Route gating** — `client/src/routes/ProtectedRoute.jsx`:
- While `loading` is true: renders `<PageLoading message="Checking session…" />`.
- If not authenticated: `<Navigate to="/login" replace />`.
- Otherwise: renders `<Outlet />` (the protected subtree).

**Axios-level session enforcement** — `client/src/api/client.js`:
- Request interceptor attaches `Authorization: Bearer <cis_token>` to every request if a
  token is present in `localStorage`.
- `withCredentials: true` (cookies, e.g. the legacy device cookies, ride along).
- Default request `timeout: 30000` ms (heavy endpoints like PDF/report generation
  override this per-request elsewhere in the app — not part of this module).
- Response interceptor: on any `401` **except** requests to `/api/auth/login`, it removes
  `cis_token` from `localStorage` and, if the current path doesn't already start with
  `/login`, hard-navigates via `window.location.assign('/login')`. This means an expired
  or server-rejected JWT on *any* authenticated API call anywhere in the app forces a
  full page reload back to the login screen — not a soft client-side route change.

### 3.3 Server-side login validation — `server/src/routes/auth.js`

Order of checks in `POST /login` (all wrapped in one try/catch → `500 { message: 'Login
failed' }` on unexpected errors):

1. **Express-level rate limiter** (`loginRequestLimiter`) — 30 requests/minute per raw
   socket IP (`req.socket.remoteAddress`, deliberately not `req.ip`, to avoid
   `X-Forwarded-For` spoofing bypassing the limiter under `trust proxy`). Over the cap →
   `429 { message: 'Too many login attempts. Please wait a moment and try again.' }`.
2. Normalize inputs: `normalizeUsername()` (trim + uppercase) on username;
   `String(...).trim()` on password.
3. Resolve institution timezone from `basic_setup_tb` (`del:1` row's `time_zone`,
   default `'Asia/Kolkata'`) and format "now" via `formatLocalTimestamp`.
4. **5-failed-logins-in-5-minutes DB throttle** (`countRecentFailedLogins`, keyed on IP +
   `log_page = 'index'` + `log_status != 'Successful'` within the window). If `>= 5`:
   logs a synthetic `'index' / 'View' / 'Successful'` row (page-view tracking) and returns
   `429 { message: 'Your login has been temporarily disabled due to excessive login
   failures. Please try again in 5 minutes...' }`.
5. Look up `web_account_setup` where `del: 1` and (`member_id` OR `address_email`)
   matches the normalized username. Not found → logs `'index'/'login'/'Unsuccessful'` →
   `401 { message: 'Wrong! Username or Password.' }`.
6. Decrypt stored password via AES-128-CTR (`decrypt()` in
   `server/src/services/password.js`) and compare: username must case-insensitively
   match either `member_id` or `address_email`, decrypted password must be non-empty and
   equal the submitted password. Any mismatch → logs unsuccessful attempt → same
   `401 { message: 'Wrong! Username or Password.' }` (deliberately identical message for
   "user not found" and "wrong password" — no username enumeration).
7. `createSessionId()` — builds a session token like `DDMMYYHHMMSS####` (zero-padded
   date/time + 4 random digits), not a UUID.
8. **`accessCheck()`** (`server/src/services/accessCheck.js`) — see §3.4 below. Failure →
   `403 { message: accessResult.message }` (always `'You are not an autherised user...'`
   for every failure branch in current code).
9. Compute `redirectTo`: `'otp_request.php'` if `user.reset_password` is truthy, else if
   `accessType` is not `'Global'` (`isGlobalAccessType`), resolve the user's first
   authorized menu link via a raw SQL join of `basic_admin_menu_tb` ⋈
   `admin_menu_category_tb` ⋈ `authentication_tb` (`del=1`, `menu_enable=1`,
   `authentication=1`, ordered by `category_order`, `main_menu_order`); falls back to
   `'dashboard.php'` if no rows. Global-access users always get `'dashboard.php'`.
10. Sign JWT via `signToken({ id, memberId, memberName, accessType, sessionId })` — payload
    exactly matches CLAUDE.md's documented shape. Expiry: `config.jwtExpiresIn`
    (`JWT_EXPIRES_IN` env var, default **`'8h'`**, `server/src/config/index.js`).
11. Respond `{ token, user: buildUserProfile(user, sessionId), redirectTo }`, set device
    cookies if `accessCheck` returned them.

`buildUserProfile(user, sessionId)` shape: `{ id, memberId, memberName, email, accessType,
photo, photoUrl (= '/legacy/img/member/' + photo, or null), resetPasswordRequired
(= Boolean(user.reset_password)), sessionId }`.

### 3.4 `access_tb` gating — `server/src/services/accessCheck.js`

Called after credential success, before token issuance.

1. If `authType === 'admin'` **or** `authType === 'Global'` → immediate success, logs
   `'index'/'login'/'Successful'`, no `access_tb` row required at all.
2. Otherwise, fetch the user's `access_tb` row (`user_id = <id>`, `del = 1`, cast
   `from_date`/`to_date`/`allow_from_time`/`allow_to_time` to CHAR to sidestep zero-date
   Prisma issues, per CLAUDE.md rule #6). No row found →
   log `'Unsuccessful' / 'Not an autherised'` → `{ success:false, message: 'You are not
   an autherised user...' }`.
3. Evaluate access window:
   - `day_base === 0 && date_base === 0` → always allowed.
   - `day_base === 1` → `isWithinDayTime()`: current ISO day (Sunday folded to `7`) must
     be in the comma-separated `allow_day` list AND current minutes-of-day must fall
     between `allow_from_time` and `allow_to_time`.
   - `date_base === 1` → `isWithinDateRange()`: if either `from_date`/`to_date` starts
     with `'0000-00-00'` (a real zero-date per CLAUDE.md rule #6), access is **denied**
     (treated as never-valid, not "always valid"); otherwise the current time must fall
     between the two parsed dates.
   - Any other combination → `allowFlag` stays `false` (denied).
   - Not allowed → logs `'Unsuccessful' / 'Not an autherised at this time'` → same
     `403` message.
4. `local_access === 0` → device checks skipped entirely, immediate success.
5. `local_access === 1` → **device lock** via `checkDeviceAccess()`:
   - Reads cookies `login_random_id_<userId>` and `login_user_id_<userId>`.
   - Validates `login_user_id_<userId>` equals `md5(userId)` (a fixed-input digest shared
     with the legacy PHP app for "remembered device" recognition — MD5 use here is
     explicitly commented in code as intentional legacy parity, not a crypto weakness,
     since it doesn't gate real authentication, only a device-recognition convenience on
     top of the already-verified password).
   - Compares `login_random_id` against up to 4 stored device slots
     (`random_id_1..4`, MD5-hashed) on the `access_tb` row, gated by `random_id` (slot
     count 0-4).
   - Match → success. No match but an empty slot exists → **auto-registers this device**:
     generates an 8-char random key (`generateDeviceKey()`, alphabet
     `abxdefghijklmnopqrstuvwxyz0987654321`), writes it into the next empty
     `random_id_N` column via raw SQL, logs `'Successful' / 'set cookies and login'`, and
     returns new `deviceCookies` for the response to set. No empty slot and no match →
     logs `'Unsuccessful' / 'Unknown device'` → same generic `403` denial message.

### 3.5 Logout — `POST /api/auth/logout`

- Requires `authMiddleware` (valid JWT).
- Writes an `insertLog(['logout', 'logout', 'Successful', '', userDt, userIp, userOs,
  req.user.memberId], req.user.sessionId)` row.
- Responds `{ message: 'Logged out' }` on success, `500 { message: 'Logout failed' }` on
  unexpected error.
- Client-side (`AuthContext.logout`) clears local state **regardless** of whether the API
  call succeeds (wrapped in try/catch that swallows errors) — so a logged-out UI state is
  guaranteed even if the server is unreachable, but the server-side `log_tb` "Successful
  logout" row may be missing in that case.

### 3.6 `GET /api/auth/me`

- Requires `authMiddleware`. Re-fetches `web_account_setup` by `id: req.user.id, del: 1`.
- Not found (e.g. account soft-deleted since token issuance) → `404 { message: 'User not
  found' }` — `AuthContext` treats this the same as a 401: clears the local token.
- Success → `{ user: buildUserProfile(user, req.user.sessionId) }` (same shape as login).
- Unexpected error → `500 { message: 'Unable to load profile' }`.

### 3.7 JWT verification — `server/src/middleware/auth.js`

- Reads `Authorization` header, requires literal `Bearer <token>` prefix. Missing header
  → `401 { message: 'Authentication required' }`.
- `jwt.verify(token, config.jwtSecret)` — any failure (expired, malformed, wrong
  signature) → `401 { message: 'Invalid or expired token' }`. Both messages are distinct
  from the login-failure message, but `Login.jsx` never sees this middleware directly —
  it only matters for already-authenticated pages, which redirect through the Axios
  401-interceptor described in §3.2.

---

## 4. Primary user stories

### US-01.1 — Sign in with Member ID and password
**As a** CIS staff member, **I want** to enter my Member ID and password on the Sign In
form and submit, **so that** I can access the authorized parts of the system.

Acceptance criteria:
- Given valid credentials in the `Member ID` (`#login-username`) and `Enter your
  password` (`#login-password`) fields, clicking **Sign In** issues
  `POST /api/auth/login { a_username, a_password }`.
- On success, the JWT is stored as `localStorage.cis_token`, the user object is stored in
  `AuthContext`, and the browser navigates to `/dashboard`.
- While the request is in flight, the button is disabled and reads **"Signing in…"**.

### US-01.2 — See a clear error on wrong credentials
**As a** CIS staff member, **I want** a clear message when my Member ID or password is
wrong, **so that** I know to retry rather than assume the system is broken.

Acceptance criteria:
- A `401` response with the legacy-parity message `Wrong! Username or Password.` is
  rewritten client-side to **"Incorrect Member ID or password. Check your details and
  try again."** and shown in the `role="alert"` `login-error` banner.
- The form remains editable; no field is cleared.

### US-01.3 — Toggle password visibility
**As a** CIS staff member, **I want** to reveal my typed password, **so that** I can
verify it before submitting.

Acceptance criteria:
- Clicking the eye icon button toggles the password `<input>` between `type="password"`
  and `type="text"`, and the icon between `fa-eye` and `fa-eye-slash`, with
  `aria-pressed` reflecting state. No network call is made.

### US-01.4 — Caps Lock warning
**As a** CIS staff member, **I want** to be warned if Caps Lock is on while typing my
password, **so that** I don't submit a mistyped password.

Acceptance criteria:
- While typing in the password field with Caps Lock active, a `role="status"` message
  **"Caps Lock is on"** appears beneath the field; it disappears on blur or when Caps
  Lock is toggled off.

### US-01.5 — Stay signed in across a page refresh
**As a** CIS staff member, **I want** my session to persist after refreshing the browser,
**so that** I don't have to log in again on every reload.

Acceptance criteria:
- On app load, if `cis_token` exists in `localStorage`, `GET /api/auth/me` is called; a
  valid token rehydrates `user` without showing the login form.
- Protected routes show **"Checking session…"** (`PageLoading`) while this resolves, not
  a flash of the login page.

### US-01.6 — Sign out
**As a** CIS staff member, **I want** to sign out, **so that** my session cannot be
reused on a shared device.

Acceptance criteria:
- Triggering logout calls `POST /api/auth/logout`, clears `cis_token` from
  `localStorage`, resets `user` to `null`, and any subsequent protected route access
  redirects to `/login`.
- Logout clears local session state even if the server call fails or times out.

### US-01.7 — Institution branding on the login screen
**As a** prospective/returning user, **I want** the login screen to show my
institution's name and title, **so that** I can confirm I'm on the correct portal.

Acceptance criteria:
- `GET /api/settings/public` populates `institutionShortName` (used for the hero heading
  and footer copyright) and `adminTitle` (used as the card subtitle, defaulting to
  `"{institutionName} Central Login"` when absent).
- If the public-settings call fails, the screen still renders using the hard-coded
  default `'APDCH'` — the login form is never blocked by this failure.

### US-01.8 — Automatic sign-out on expired/invalid token
**As a** CIS staff member, **I want** to be sent back to the login screen automatically
if my session token becomes invalid, **so that** I'm never stuck looking at a broken
authenticated page.

Acceptance criteria:
- Any API response with HTTP 401 (except the login call itself) clears `cis_token` and
  forces a hard navigation to `/login` via the Axios response interceptor.

---

## 5. Rare / edge-case user stories

### US-01.9 — Locked out after 5 failed logins in 5 minutes
**As a** CIS staff member who mistyped my password repeatedly, **I want** to be told I'm
temporarily locked out rather than getting endless generic errors, **so that** I
understand why login is failing and when to retry.

Acceptance criteria:
- After 5 unsuccessful `log_page='index'` attempts from the same IP within 5 minutes,
  the next attempt returns `429` with **"Your login has been temporarily disabled due to
  excessive login failures. Please try again in 5 minutes..."**, displayed verbatim
  (not rewritten, since it doesn't match the exact-string check in `Login.jsx`).
- This lockout is tracked in `log_tb`, keyed by IP + page, not by username — a shared-IP
  computer lab could lock out multiple different users simultaneously (worth flagging to
  product, not a bug to silently "fix").
- A courtesy `'View'/'Successful'` log row is still written on the lockout response
  itself (page-view style), distinct from the failed-credential rows that triggered it.

### US-01.10 — Raw request flood throttling (pre-DB layer)
**As** the system, **I want** to reject a flood of login POSTs before they ever reach the
database-backed 5-attempt check, **so that** the login endpoint can't be used to hammer
the DB/CPU.

Acceptance criteria:
- More than 30 `POST /api/auth/login` requests per minute from the same raw socket
  address get `429 { message: 'Too many login attempts. Please wait a moment and try
  again.' }` from `express-rate-limit`, independent of the 5-minute business-logic
  lockout.
- The limiter deliberately keys on `req.socket.remoteAddress`, not `req.ip`, so it cannot
  be bypassed by spoofing `X-Forwarded-For`.

### US-01.11 — Denied by day/time access window
**As a** restricted-access user configured with a day/time login window in `access_tb`
(`day_base = 1`), **I want** to be denied login outside my allowed day/time range, **so
that** the system enforces my department's access policy.

Acceptance criteria:
- Outside the allowed `allow_day`/`allow_from_time`/`allow_to_time` window, login returns
  `403 { message: 'You are not an autherised user...' }` even with fully correct
  credentials, and `log_tb` records `'Not an autherised at this time'`.

### US-01.12 — Denied by zero-date access range
**As a** restricted-access user whose `access_tb` row has a zero-date (`0000-00-00`)
`from_date` or `to_date` (`date_base = 1`), **I want** login to fail safely rather than
crash or default to "always allowed", **so that** an incompletely configured access
window never accidentally grants unrestricted access.

Acceptance criteria:
- `isWithinDateRange()` explicitly returns `false` whenever either date starts with
  `'0000-00-00'` — login is denied with the same generic `403` message.

### US-01.13 — Denied — no `access_tb` row at all
**As a** non-Global user who was never given an `access_tb` row, **I want** login to be
denied outright, **so that** account creation alone (without an access grant) can't be
used to sign in.

Acceptance criteria:
- Missing `access_tb` row → `403`, `log_tb` records `'Not an autherised'`.

### US-01.14 — Device-locked account, first-time device
**As a** user on an `access_tb` row with `local_access = 1` (device lock enabled) logging
in from a browser with no prior device cookies, **I want** the system to either register
my device automatically (if a slot is free) or deny me (if all slots are full), **so
that** device-limited accounts can't be used from unlimited machines.

Acceptance criteria:
- No matching `login_random_id_<userId>`/`login_user_id_<userId>` cookie pair, but an
  empty `random_id_N` slot exists (of up to 4): the server generates a new device key,
  persists it to that slot, sets two `httpOnly`/`sameSite=lax`/1-year cookies in the
  response, and login succeeds. `log_tb` records `'set cookies and login'`.
- No empty slot: login is denied (`403`), `log_tb` records `'Unknown device'`.

### US-01.15 — Password-reset-required user (interim gap)
**As a** user whose `reset_password` flag is set in `web_account_setup`, **I want** to be
told my password needs to be reset, **so that** I know not to keep retrying the same
password.

Acceptance criteria (current, interim behavior — flagged, not "fixed" silently):
- Credential + `access_tb` checks all pass; server still issues a valid token and sets
  `redirectTo: 'otp_request.php'`.
- **`AuthContext.login` stores the token and user regardless.** `Login.jsx` then checks
  `result.user?.resetPasswordRequired` and, if true, shows **"Password reset required.
  OTP flow will be migrated in a later phase."** and does **not** navigate — but a valid
  JWT is already sitting in `localStorage`, meaning the user could manually navigate to
  `/dashboard` and be treated as fully authenticated despite the pending reset
  requirement. This is a known interim gap pending the OTP flow migration
  (`otp_request.php` is unmigrated), not intended end-state behavior.

### US-01.16 — Network/API failure on login
**As a** CIS staff member, **I want** to at least see *some* error text if the login
request fails for network reasons (server down, timeout), **so that** I'm not staring at
a frozen form.

Acceptance criteria (current behavior, with a known UX gap):
- Any rejected promise without an `err.response` (network failure, the 30s Axios
  timeout) falls into `err.response?.data?.message || 'Wrong! Username or Password.'`,
  which is then rewritten to **"Incorrect Member ID or password. Check your details and
  try again."** — this is misleading for a genuine outage (looks like a credentials
  problem, not a connectivity problem). Worth flagging to product as a future
  improvement; not something to silently patch as part of unrelated work.

### US-01.17 — `redirectTo` computed server-side but unused
**As a** restricted-access (non-Global) user whose first authorized menu link is *not*
the dashboard, **I want** to land on that page after login (as legacy `index.php` would
have routed me), **so that** I don't see a dashboard I have no real use for.

Acceptance criteria (current gap):
- The server correctly computes `redirectTo` via the `basic_admin_menu_tb` ⋈
  `admin_menu_category_tb` ⋈ `authentication_tb` join (first `menu_enable=1`,
  `authentication=1` link ordered by category/menu order, falling back to
  `'dashboard.php'`), but `Login.jsx`'s `handleSubmit` **always** calls
  `navigate('/dashboard')` and never reads `result.redirectTo`. A user with zero
  dashboard-relevant menu access still lands on `/dashboard` today.

### US-01.18 — Account soft-deleted between login and next page load
**As a** user whose `web_account_setup` row is soft-deleted (`del: 0`) after they already
have a valid JWT, **I want** to be signed out on my next action rather than continuing
with stale access, **so that** deactivation takes effect promptly.

Acceptance criteria:
- `GET /api/auth/me` filters `del: 1`; a soft-deleted account gets `404 { message: 'User
  not found' }`, which `AuthContext` treats identically to an invalid token (clears
  `cis_token`, resets `user`). This only takes effect on the next `/api/auth/me` call or
  the next 401 from any other endpoint — a still-valid, not-yet-expired JWT for a
  soft-deleted user could still authenticate other endpoints until they hit one of these
  checks (no server-side token revocation list exists).

### US-01.19 — Global-access users bypass `access_tb` entirely
**As a** Global-access administrator, **I want** to log in without any day/time/device
restriction, **so that** admin access is never accidentally blocked by a misconfigured
`access_tb` row (or a missing one).

Acceptance criteria:
- `accessType === 'admin' || accessType === 'Global'` short-circuits `accessCheck()` to
  immediate success before any `access_tb` row is even queried.

---

### Future (not implemented)

*Grounded in [mobile.md](../mobile.md) §5 ("Backend connectivity") and honest
extrapolation — none of the following exist in the current code.*

- *(Future)* **As a** mobile app user, **I want** to log in from the Expo app using the
  same `POST /api/auth/login` endpoint, with the JWT stored in Expo SecureStore instead
  of `localStorage`, **so that** I get the same credential/access-window guarantees on
  mobile as on web. (mobile.md §5 explicitly plans this — "identical flow to web"; no
  backend change needed.)
- *(Future)* **As a** mobile app user, **I want** `GET /api/auth/me` called on app start
  to restore my session, **so that** I don't have to re-enter credentials every time I
  open the app. (mobile.md §5, item 5 — mirrors the current `AuthContext` bootstrap.)
- *(Future, speculative — not in mobile.md, extrapolated)* **As a** CIS admin, **I want**
  two-factor authentication on login, **so that** compromised passwords alone can't grant
  access. Nothing in the current code or mobile.md plans this; flagged purely as a
  plausible future hardening step given the existing device-cookie "remembered device"
  mechanism already gestures at device trust.
- *(Future, speculative)* **As a** CIS admin, **I want** a server-side token revocation
  list (or shorter-lived tokens + refresh tokens), **so that** logging out or
  soft-deleting an account takes effect immediately instead of waiting for the current
  8-hour JWT to expire or for the next `/me`/401 check. Motivated directly by the gap
  documented in US-01.18; not currently planned in any doc.
- *(Future, speculative)* **As a** user, **I want** the interim `resetPasswordRequired`
  gap (US-01.15) properly closed by migrating `otp_request.php` to a real in-app OTP
  reset flow, **so that** a flagged account can't retain a usable session token. CLAUDE.md
  and the code comment both call this out as pending, not hypothetical, but no
  implementation exists yet.

---

## 7. Traceability table

| Story | Client file | Server route/service | Table(s) |
|---|---|---|---|
| US-01.1 Sign in | `client/src/pages/Login.jsx`, `client/src/auth/AuthContext.jsx` | `POST /api/auth/login` → `server/src/routes/auth.js` | `web_account_setup`, `log_tb` |
| US-01.2 Wrong-credential error | `client/src/pages/Login.jsx` (`displayError` mapping) | `server/src/routes/auth.js` (401 branch) | `web_account_setup`, `log_tb` |
| US-01.3 Show/hide password | `client/src/pages/Login.jsx` (`showPassword` state) | — (client-only) | — |
| US-01.4 Caps Lock warning | `client/src/pages/Login.jsx` (`handlePasswordKeyEvent`) | — (client-only) | — |
| US-01.5 Persist session on refresh | `client/src/auth/AuthContext.jsx`, `client/src/routes/ProtectedRoute.jsx` | `GET /api/auth/me` → `server/src/routes/auth.js` | `web_account_setup` |
| US-01.6 Sign out | `client/src/auth/AuthContext.jsx` (`logout`) | `POST /api/auth/logout` → `server/src/routes/auth.js` | `log_tb` |
| US-01.7 Branding | `client/src/pages/Login.jsx` (`settings` state) | `GET /api/settings/public` → `server/src/routes/settings.js` | `basic_setup_tb` |
| US-01.8 Auto sign-out on 401 | `client/src/api/client.js` (response interceptor) | any route via `server/src/middleware/auth.js` | — |
| US-01.9 5-failed-login lockout | `client/src/pages/Login.jsx` (error passthrough) | `server/src/routes/auth.js`, `server/src/services/logService.js` (`countRecentFailedLogins`) | `log_tb` |
| US-01.10 Request-flood throttle | — | `server/src/routes/auth.js` (`loginRequestLimiter`) | — (in-memory) |
| US-01.11 Day/time access window | — | `server/src/services/accessCheck.js` (`isWithinDayTime`) | `access_tb`, `log_tb` |
| US-01.12 Zero-date access range | — | `server/src/services/accessCheck.js` (`isWithinDateRange`) | `access_tb`, `log_tb` |
| US-01.13 Missing access_tb row | — | `server/src/services/accessCheck.js` | `access_tb`, `log_tb` |
| US-01.14 Device lock / auto-register | — | `server/src/services/accessCheck.js` (`checkDeviceAccess`, `findEmptyDeviceSlot`, `generateDeviceKey`) | `access_tb`, `log_tb` |
| US-01.15 Reset-password-required gap | `client/src/pages/Login.jsx` (`resetPasswordRequired` branch) | `server/src/routes/auth.js` (`redirectTo` computation) | `web_account_setup` |
| US-01.16 Network failure UX | `client/src/pages/Login.jsx` (`catch` fallback) | — | — |
| US-01.17 Unused `redirectTo` | `client/src/pages/Login.jsx` (`handleSubmit`) | `server/src/routes/auth.js` (`resolveFirstMenuLink`) | `basic_admin_menu_tb`, `admin_menu_category_tb`, `authentication_tb` |
| US-01.18 Soft-deleted account | `client/src/auth/AuthContext.jsx` (`/me` catch) | `GET /api/auth/me` (`del:1` filter) | `web_account_setup` |
| US-01.19 Global bypass | — | `server/src/services/accessCheck.js` (`authType` check), `server/src/utils/accessType.js` | — |
| JWT issuance/verification | — | `server/src/utils/jwt.js`, `server/src/middleware/auth.js`, `server/src/config/index.js` (`JWT_SECRET`, `JWT_EXPIRES_IN`) | — |
| Password encryption | — | `server/src/services/password.js` (AES-128-CTR, matches legacy `password.php`) | `web_account_setup.password` |
