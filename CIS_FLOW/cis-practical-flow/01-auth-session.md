# 01 — Auth & Session — Frontend Control & UX Audit

## 1. Module recap

See [user-stories/01-auth-session.md](../user-stories/01-auth-session.md) for the full
pixel-level flow. In short: this module has exactly one user-facing screen —
**Login** (`client/src/pages/Login.jsx`) — plus two invisible plumbing layers:
`AuthContext.jsx` (session bootstrap/rehydration/logout) and `ProtectedRoute.jsx` (route
gate). There is no student self-service login, no registration screen, no forgot-password
screen (the `otp_request.php` flow is explicitly unmigrated — the modern UI only detects the
`resetPasswordRequired` condition and shows a static message). Because the module is a single
form with two text inputs, the control-inventory table below is much shorter than other
modules — the interesting UX material is in session lifecycle, error messaging, and the
device/lockout edge cases (§4).

## 2. Frontend control inventory


| Screen / surface                                      | Control type(s)                                                                                             | Search? | Single/multi | Bulk actions? | Other interaction notes                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login — Member ID field                               | Native `<input type="text">`, `maxLength={20}`, `autoFocus`                                                 | —       | —            | —             | `onChange` ~~silently strips punctuation via~~ `validateCharNum()` ~~— no visible validation message, just a live filter. No~~ `SearchableSelect`~~/~~`CheckListSelect` ~~anywhere in this module (there is nothing to~~ pick from a list).                                                                                          |
| Login — Password field                                | Native `<input type="password"/"text">`, `maxLength={50}`                                                   | —       | —            | —             | Custom show/hide toggle button (`aria-pressed`, icon swap, no network call); Caps Lock detection via `getModifierState('CapsLock')` on `keydown`/`keyup`, cleared on blur; `role="status"` live warning text.                                                                                                                        |
| Login — Submit                                        | Native `<button type="submit">`                                                                             | —       | —            | —             | Disables itself and swaps label to "Signing in…" while `loading` is true — the only in-flight affordance on the whole screen.                                                                                                                                                                                                        |
| Login — Error banner                                  | Static `<div role="alert">`                                                                                 | —       | —            | —             | Toast-less: errors render inline above the form, not as a toast/snackbar. Persists until the next submit attempt (no auto-dismiss, no manual close button).                                                                                                                                                                          |
| Login — Institution branding                          | Read-only text/image, sourced from `GET /api/settings/public`                                               | —       | —            | —             | No control; included because a silent fetch failure degrades to hardcoded defaults with zero user-facing indication.                                                                                                                                                                                                                 |
| Session bootstrap (`AuthContext`)                     | No visible control — background `GET /api/auth/me` on mount                                                 | —       | —            | —             | Route-level loading state is `<PageLoading message="Checking session…" />`, not a skeleton of the destination page.                                                                                                                                                                                                                  |
| Logout                                                | `<button onClick={logout}>` inside `UserMenu` dropdown (see [03-navigation-menu.md](03-navigation-menu.md)) | —       | —            | —             | No confirmation modal — logout is immediate and irreversible from the UI's perspective (no "are you sure?" step), and clears local state even if the server call fails/times out.                                                                                                                                                    |
| Axios 401 interceptor (module-adjacent, not a screen) | No visible control — a `window.location.assign('/login')` hard navigation                                   | —       | —            | —             | Fires on any `401` anywhere in the app except the login call itself; because it's a hard navigation rather than a client-side route change, any in-progress unsaved work on the page the user was on is lost with no warning — worth flagging alongside the logout-confirmation gap since both are "session ends abruptly" patterns. |
| `PageLoading` (session bootstrap)                     | Static spinner + text, no control                                                                           | —       | —            | —             | Identical component/markup used for "Checking session…" here and for every other module's initial load — consistent, but also means this module has no session-specific loading treatment at all.                                                                                                                                    |
| `PageError` (shell load failure)                      | Static alert + `onRetry` button                                                                             | —       | —            | —             | Shared with [03-navigation-menu.md](03-navigation-menu.md)'s `AppShellLayout` error state — a menu/settings fetch failure and an auth failure currently look identical to the user, even though only one of them means "you are not logged in."                                                                                      |


There is no `<select>`, no multi-select, no checkbox grid, no drag-reorder, and no file
upload anywhere in this module — it is the simplest control surface in the app by a wide
margin. The only "list" the user ever effectively interacts with is the three fixed
`LOGIN_FEATURES` strip items, which are static, not selectable.

**Timeout behavior worth noting for the gaps below:** the Axios client
(`client/src/api/client.js`) applies a blanket 30-second request timeout to `POST /api/auth/login`, same as every other request. A slow DB (e.g. the 5-minute lockout throttle
query or the `access_tb` day/time check running against an unindexed column under load) has
exactly 30 seconds before the client gives up and reports it as a network failure — which, per
gap #2 below, then gets mislabeled as a credentials error to the user.

## 3. Advanced feature gaps

Because this module has no list-picker controls, the usual "native select vs.
`SearchableSelect` vs. `CheckListSelect`" gap analysis doesn't apply. The gaps here are
session/error-handling gaps instead, each concrete and screen-specific:

1. **No visible feedback when the punctuation filter silently strips a keystroke.** The
  Member ID field's `validateCharNum()` (`client/src/utils/validation.js`) removes
   characters like `@`, `-`, `_`, `(` etc. as the user types, with zero indication anything
   was dropped. A user pasting an email-style Member ID (containing `@` or `.`) or a
   hyphenated ID will watch characters vanish with no explanation — this is a silent data
   -loss pattern, not a validation error message like the Caps Lock warning two fields below
   it already demonstrates is achievable on this exact screen.
2. **The error banner has no distinction between "your fault" (bad password) and "our fault"
  (network/server down) errors**, even though the server already returns distinguishable
   messages (`401` vs `429` vs `500` vs no-`err.response` at all). `Login.jsx`'s
   `displayError` mapping only special-cases the literal string
   `'Wrong! Username or Password.'`; every other failure mode — including a genuine network
   outage — falls through to the same generic rewritten text
   ("Incorrect Member ID or password..."), actively misleading the user about what went
   wrong (US-01.16 in the user-stories doc already flags this as a known gap).
3. **No toast/snackbar pattern exists anywhere in this module** even though the rest of the
  app (see [04-settings.md](04-settings.md)'s `SetupAlerts` pattern) already has a
   established inline-alert convention this screen could reuse consistently — currently the
   login error banner and the (unrelated) settings error banners look and behave slightly
   differently because they're implemented independently rather than sharing one
   `Alert`/`Toast` primitive.
4. **The 5-failed-login lockout message doesn't tell the user when they can retry** — it says
  "Please try again in 5 minutes..." as static text with no live countdown, even though the
   information (the lockout window) is fully known server-side at the moment the 429 fires.
5. **Logout has no confirmation and no "undo" window**, unlike every settings delete action in
  this app which already goes through `ConfirmModal.jsx` — a misclick on "Log Out" (e.g. on
   a touch device, or a fat-fingered click near the account menu) ends the session
   immediately with no recovery step, which is inconsistent with how destructive actions are
   handled elsewhere in the app (see [04-settings.md](04-settings.md) §2).
6. **The global Axios 401 interceptor and the login screen's own error banner are two
  completely separate error-surfacing mechanisms that a user can hit within seconds of each
   other**, with no shared visual language: the login screen shows an inline `role="alert"`
   banner, while an expired-session-elsewhere-in-the-app hard-navigates straight back to
   `/login` with zero explanation, dropping the user on a blank login form with no memory of
   why they're there. A returning user who was mid-task when their 8-hour JWT expired gets no
   "your session expired, please sign in again" message at all — just a silent redirect.
7. **No visible distinction between "checking session" and "loading the app after login"** —
  both use the identical `PageLoading` component/text pattern in different contexts
   (`ProtectedRoute`'s "Checking session…" vs. `AppShellLayout`'s "Loading…"), so a slow menu
   fetch after a fast, successful login looks indistinguishable from a slow session check
   before the user is even authenticated — makes it hard for a user to mentally model what
   stage of loading they're actually in.
8. **The 30-second Axios timeout (see §2 note above) has no visible countdown or "this is
  taking longer than usual" intermediate state** — a user on a slow campus network watching
   the "Signing in…" button for the full 30 seconds gets zero feedback that anything is
   different from a normal 1-second login until the hard failure lands, at which point (per
   gap #2) it's mislabeled as a credentials problem anyway — compounding two separate gaps
   into one especially confusing failure mode for exactly the users (poor connectivity) who
   can least afford a misleading error message.



## 4. User-experience suggestions

1. **Show a subtle "removed unsupported characters" hint under the Member ID field** the
  moment `validateCharNum()` actually strips something (compare input length before/after
   the filter). Why it helps: prevents the silent-data-loss confusion in gap #1 — users
   pasting real Member IDs with punctuation currently have no idea why their paste "didn't
   work."
2. **Split the error-banner logic into distinct categories** (credentials / lockout /
  access-window / network) with different icons and only rewrite the exact "wrong
   credentials" string, leaving network/server errors as a clearly different message ("We
   couldn't reach the server — check your connection and try again"). Why it helps: today a
   Wi-Fi drop and a wrong password produce identical UI, which sends users into a
   credential-retry loop instead of checking their connection — directly addresses US-01.16.
3. **Add a live countdown to the lockout message** ("Try again in 4:32") using `setInterval`
  against a `retryAfter` timestamp the server could include in the 429 payload. Why it
   helps: the current static "5 minutes" text gives no sense of progress, so a locked-out
   user is likely to keep hammering Sign In, which does nothing but confirms the lockout is
   still active — a countdown turns a dead end into a clear waiting state.
4. **Add a lightweight confirmation step to Log Out** — even something as small as a
  `ConfirmModal.jsx` reuse (already used throughout Settings, see
   [04-settings.md](04-settings.md)) with the same "Close"/"Confirm" button pair the rest of
   the app already trains users to expect. Why it helps: consistency with the app's existing
   destructive-action pattern, and protects against accidental session loss on shared/kiosk
   devices, which this college's attendance-kiosk-adjacent workflows make more likely than in
   a typical desktop-only app.
5. **Persist the typed Member ID (not the password) across a failed attempt with an explicit
  "Remember my Member ID on this device" checkbox**, stored client-side only. Why it helps:
   this is a staff-shared-device environment (see US-01.9's callout that a lab computer can
   lock out multiple different users) — re-typing a Member ID after every failed attempt on a
   slow-typing shared terminal is friction that a simple local remember-me removes without
   touching the password security model at all.

5b. **Use** `redirectTo` **from the login response** instead of hardcoding `navigate('/dashboard')`
   (US-01.17). Why it helps: a restricted user whose first authorized screen isn't the
   dashboard currently lands on a screen with "Panels/0" and an empty-state CTA to a page they
   likely can't reach either — landing them on their actual first authorized screen removes an
   avoidable dead-end on literally their first click after logging in.
6. **Close the** `resetPasswordRequired` **gap (US-01.15) at the UI layer today, before the OTP
   flow is migrated**: if `result.user?.resetPasswordRequired` is true, `AuthContext.login`
   should not persist the token at all (or `Login.jsx` should immediately call `logout()`
   before showing the message). Why it helps: right now a flagged account gets a fully valid,
   usable JWT sitting in `localStorage` the instant login succeeds — a user could manually
   type `/dashboard` in the URL bar and use the app despite being told they can't proceed;
   this is a real security-adjacent UX inconsistency, not just cosmetic.
7. **Add keyboard-only submit affordance hints** — the form already supports `Enter`-to-submit
   natively via `<form onSubmit>`, but nothing tells a keyboard user that; a small
   `<kbd>Enter</kbd>` hint near the submit button (mirroring the command palette's existing
   `↑↓ navigate / Enter open / Esc close` footer legend pattern documented in
   [03-navigation-menu.md](03-navigation-menu.md)) would make the existing behavior
   discoverable rather than just accidentally present.
8. **Skeleton vs. spinner on session bootstrap** — `ProtectedRoute` currently shows a generic
   `<PageLoading message="Checking session…" />` for every protected route regardless of
   destination. Why it helps: a lightweight destination-shaped skeleton (even just the
   sidebar/topnav chrome outline) instead of a centered spinner would reduce the perceived
   "double loading" feeling users get on refresh (spinner → chrome paints → dashboard
   skeleton), especially notable given the dashboard module's own careful stale-while-
   revalidate caching (see [02-dashboard.md](02-dashboard.md)) that this auth-level spinner
   currently masks.
9. **Show an explicit "Your session expired — please sign in again" banner on the login form**
   when the Axios interceptor's hard-redirect is what actually landed the user there (e.g. via
   a `?reason=expired` query param appended by the interceptor before `window.location.assign`).
   Why it helps: directly closes gap #6 — right now a user bounced back to login mid-task has
   no way to distinguish "I was logged out" from "I never logged in this session," which is
   confusing and makes the app feel unpredictable rather than clearly session-scoped.
10. **Differentiate the "Checking session…" and post-login "Loading…" messages with
   distinguishable copy** (e.g. "Confirming your sign-in…" vs. "Loading your workspace…").
   Why it helps: closes gap #7 with a copy-only change — gives the user a mental model of
   progress ("I'm past the login check, now the app itself is loading") instead of one
   undifferentiated spinner stage.
11. **Add a "still trying…" intermediate message after ~8-10 seconds of a pending login
   request**, well before the 30-second Axios timeout fires. Why it helps: closes gap #8 —
   converts a long silent wait into visible, reassuring progress feedback, and — combined with
   suggestion #2's clearer network-vs-credentials error split — means a slow-network user gets
   two chances (an early heads-up, then an honest final error) instead of one late, misleading
   one.
12. **Mobile/touch responsiveness spot-check on the login card** — the two-pane hero/form
   layout (`login-hero` + `login-form-pane`) is exactly the kind of split layout that needs an
   explicit narrow-viewport collapse strategy; confirming the password show/hide toggle and
   Caps Lock warning remain comfortably tappable (not just clickable) at common phone widths is
   worth a dedicated pass given this is the very first screen every user — including anyone
   testing the eventual mobile app's web-parity assumptions per `mobile.md` — encounters.

## 5. Quick wins vs. bigger investments

**Small diff, immediate win:**

- Distinguish network/server errors from credential errors in `displayError` (#2) — a pure
client-side conditional change in `Login.jsx`, no API contract change needed.
- Add the "characters removed" hint under Member ID (#1) — local state + a short string,
no server change.
- Add `<kbd>Enter</kbd>` submit hint (#7) — copy-only change.
- Wire up the already-computed `redirectTo` in `handleSubmit` (#5b) — the server already
returns this value; the client only needs to read it instead of hardcoding `/dashboard`.
- Differentiate "Checking session…" vs. "Loading…" copy (#10) — copy-only, two string
constants.
- Add a delayed "still trying…" message during login (#11) — a `setTimeout` in `handleSubmit`,
cleared on resolve/reject, no API change.

**Needs design/product buy-in:**

- Logout confirmation modal (#4) — needs a product decision on whether logout should ever be
interruptible, and if so what the modal copy/branding should be.
- Live lockout countdown (#3) — requires the server to start returning a `retryAfter`/
`unlockAt` timestamp in the 429 payload (a real API contract change), not just client work.
- "Remember my Member ID" (#5) — needs a privacy/security sign-off given this is an
institutional system, plus a decision on where the preference lives (per-browser only, or
synced somehow).
- Closing the `resetPasswordRequired` token-issuance gap (#6) — touches the auth/session
security model, not just UI; should go through the same review the OTP-flow migration
itself would get, even as an interim mitigation.
- Destination-aware skeleton loading on session bootstrap (#8) — meaningful investment since
it means building a per-route skeleton shape, not just swapping a spinner icon.
- Session-expired banner via an interceptor-set `?reason=expired` param (#9) — small in isolated
scope, but touches the shared Axios interceptor that every module depends on, so it needs
careful review to avoid regressing the 401-handling path for every other screen in the app.
- Mobile/touch responsiveness pass on the login card (#12) — needs actual device testing, not
just a breakpoint guess, and should be coordinated with any eventual mobile-app web-parity
effort mentioned in `mobile.md`.

