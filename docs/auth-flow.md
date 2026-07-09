# Auth Flow — Legacy PHP to Node.js

## Legacy (PHP)

1. `index.php` — login form, rate limit via `log_tb`
2. `password.php` — validates `web_account_setup` (AES-128-CTR password)
3. `access_tb` — day/time/device restrictions
4. Session: `$_SESSION['empusername_login']` = `member_id`
5. `widget.php` — loads user context on every page

## Modern (Node + React)

1. `POST /api/auth/login` — same validation as legacy
2. JWT stored client-side; sent as `Authorization: Bearer`
3. `GET /api/auth/me` — validates token, returns user profile
4. `access_tb` checked at login only (same as legacy session gate)
5. Dashboard widgets: JWT → `member_id` → PHP bridge session injection

## Password encryption

Legacy AES-128-CTR in `server/src/services/password.js` (key/IV match `password.php`).

## Audit

`log_tb` via `server/src/services/logService.js` — login, logout, failed login, access denied.
