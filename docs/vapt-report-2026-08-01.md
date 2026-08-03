# VAPT Report — CIS Modernized Application

**Assessment type:** White-box source code review (SAST) + targeted live verification against the local dev instance (`http://localhost:4000` / `http://localhost:5173`).
**Scope:** `server/` (Express API) and `client/` (React SPA), plus their interaction with the shared legacy PHP file tree (`/home/mapims/cis/cis`) and MariaDB `apdchedu_cisapp`.
**Assessment date:** 2026-08-01
**Assessor:** Automated code-assisted review (Claude Code)

> This is a source-level assessment, not a full black-box pentest. Findings marked **Confirmed (live)** were reproduced against the running dev server; findings marked **Confirmed (code)** are verified by reading the exact code path; findings marked **Systemic** describe a recurring pattern rather than one exploited instance.

---

## Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Unauthenticated disclosure of legacy DB credentials via `/legacy` static mount | **Critical** | ✅ Fixed |
| 2 | Unauthenticated exposure of entire legacy application tree (source, PII documents, payroll records) | **Critical** | ✅ Fixed (source/PHP disclosure only — see note) |
| 3 | Passwords stored reversibly-"encrypted" with a hardcoded key and static IV, not hashed | **High** | ⚠️ Partially mitigated — see note |
| 4 | Content-Security-Policy disabled application-wide | **Medium** | ✅ Fixed (report-only mode) |
| 5 | Widespread manual SQL string-escaping instead of parameterized queries | **Medium** | ✅ Guard added |
| 6 | Vulnerable frontend/backend dependencies (`react-router-dom`, `body-parser`) | **Medium** | ✅ Mostly fixed — 1 remaining, see note |
| 7 | MD5 used for device-trust cookie fingerprinting | **Low** | ⚠️ Won't fix — see note |
| 8 | `helmet` CORP set to `cross-origin` app-wide | **Low** | ✅ Fixed (`same-site`) |

Positive controls observed: JWT secret is externally configured (not the fallback default) and reasonably long; login is rate-limited (30/min per-IP, 5-failed-attempt lockout with true socket IP, not spoofable `X-Forwarded-For`); `/api/files` enforces JWT auth + path-traversal containment; `.env` is git-ignored and not present in git history; error responses don't leak stack traces.

---

## Remediation notes (2026-08-01)

**Findings 1 & 2 — fixed.** Added `server/src/middleware/legacyStaticGuard.js` in front of the `/legacy` static mount: blocks source/config extensions (`.php`, `.env`, `.sql`, `.inc`, dotfiles, etc.) everywhere, and restricts the mount to an explicit allow-list of top-level directories (`css`, `img`, `js`, `assets`, `tv`, `naac`, `alumni`, `files/*`) matching what `FILE_STORAGE_MAP` already documents as intentionally public. Live-verified: `config.php`, `a_dbcheck.php`, `files/change_password.php`, dotfiles, path traversal, and unlisted directories all now return `403`; existing photo/CSS/document links (e.g. the ID card feature) still return `200` unchanged. **Finding 2's PII/financial-document exposure is unchanged by design** — per your decision, `student_attachment`, `staff_documents`, `salary_advance`, etc. remain reachable at their documented public URLs, since locking those down requires migrating every consumer to `/api/files` first (the "full lockdown" option you didn't choose). **The exposed DB password still needs to be rotated by you** — I don't have DB admin access to do that, and it was live on an endpoint I've now confirmed was reachable.

**Finding 3 — partially mitigated, by design constraint.** `web_account_setup.password` is shared with the still-running legacy PHP app, which hardcodes the identical AES key and static IV in its own `password.php` (confirmed by reading it) — per your decision, we kept the scheme reversible rather than migrating to bcrypt. What changed: the key/IV in `server/src/services/password.js` now read from optional `LEGACY_PASSWORD_KEY`/`LEGACY_PASSWORD_IV` env vars (defaulting to the current values, so nothing breaks), making rotation possible without a source change. The static IV itself **cannot** be made per-user without also patching the legacy app — doing so unilaterally would make each app unable to decrypt passwords the other one just wrote. This finding stays open at the architecture level until legacy is either retired or updated in lockstep.

**Finding 4 — fixed (report-only).** `helmet`'s CSP is now enabled in `reportOnly` mode with a baseline policy (`default-src 'self'`, `'unsafe-inline'` allowed for script/style since report HTML relies on inline handlers/styles). It logs violations to the browser console without blocking anything yet — flip `reportOnly` to `false` once a period of violation-free operation confirms the directives are complete.

**Finding 5 — guard added.** `server/scripts/check-raw-sql-interpolation.js` (run via `npm run check:sql` in `server/`) scans for request-shaped values (`req.*`/`fields.*`/`payload.*`/etc.) interpolated directly into `$queryRawUnsafe`/`$executeRawUnsafe` template literals without a recognized escaping wrapper on the same line. It's a heuristic (flags shadowed-but-safe patterns too, so it ships with a baseline of the 51 current findings — all manually spot-checked as correctly escaped upstream) and fails only on *new* additions, so it's usable as a CI gate today without a full historical audit.

**Finding 6 — mostly fixed.** `server`: `body-parser` patched, 0 vulnerabilities remain. `client`: `react-router-dom` bumped 7.6.2 → 7.18.2 (build verified), which resolves the open-redirect, RSC-XSS, and SSR-hydration-DoS advisories. One High remains — a React-Server-Components-mode CSRF bypass — that only clears on a react-router **8.x** major bump; this SPA doesn't use RSC mode, so it's low real-world exploitability here, but the major bump itself needs dedicated routing regression testing before I'd apply it unattended.

**Finding 7 — won't fix, by design constraint.** The MD5-hashed `login_random_id_*`/`login_user_id_*` cookies are also shared with legacy (confirmed identical `md5()` calls in legacy `index.php`) — changing the algorithm here would desync device recognition from the legacy app for every user. Documented the reason inline in `accessCheck.js`. Real-world risk stays low: this only gates a "remembered device" convenience skip, not the primary credential check.

**Finding 8 — fixed.** CORP tightened from `cross-origin` to `same-site`, appropriate for dev (`localhost:5173` ↔ `localhost:4000` share a registrable domain); revisit if client/API end up on genuinely different domains in production.

---

## 1. Critical — Unauthenticated disclosure of legacy DB credentials

**Where:** `server/src/app.js`

```js
app.use('/legacy', express.static(path.resolve(config.legacyImgPath, '..')));
```

`legacyImgPath` resolves to `/home/mapims/cis/cis/img`, so `path.resolve(..., '..')` serves **the entire legacy application root** (`/home/mapims/cis/cis`, i.e. `LEGACY_CIS_PATH`) as static files, with no authentication middleware in front of it.

That root contains `config.php`, the legacy database bootstrap file. Express `static` returns the raw file bytes for any extension it doesn't recognize as needing server-side execution (which is all of them — Express never executes PHP), so requesting it returns the **PHP source as plaintext**, including the live MySQL credentials.

**Confirmed (live):**
```
$ curl -s http://localhost:4000/legacy/config.php
HTTP 200
$host="localhost";
$username_db="apdchedu_cisapp";
$password_db="[REDACTED — live production DB password, recovered in plaintext]";
$db_name="apdchedu_cisapp";
```

No `Authorization` header, cookie, or session was used for this request — it succeeds from any unauthenticated client that can reach port 4000/whatever it's proxied behind.

**Impact:** Full read/write access to the shared MariaDB database (`apdchedu_cisapp`) used by both the legacy and modernized apps — every student, staff, payroll, and fee record. This single endpoint alone is a complete compromise of the data tier.

**Other similarly sensitive legacy files reachable the same way:** `a_config_sqli.php`, `a_dbcheck.php`, `change_password.php`, and any other `.php` file at the tree root — all served as raw source.

**Remediation (priority 1, before anything else in this report):**
1. Rotate the exposed MariaDB password immediately.
2. Narrow the `/legacy` static mount to only the specific sub-paths that actually need public access (e.g. `/legacy/files/student_idcard`, `/legacy/files/certificate`, `/legacy/css`, `/legacy/img`) — never mount the legacy app root itself.
3. Add an explicit denylist/allowlist middleware in front of `express.static` that rejects `*.php`, `*.inc`, `*.env`, `*.sql`, `*.log`, and any dotfile, as defense in depth even after narrowing the mount.
4. Audit web server / reverse proxy access logs for prior unauthorized access to `/legacy/config.php` and other `.php` paths, since this has apparently been reachable since the `/legacy` mount was introduced.

---

## 2. Critical — Unauthenticated exposure of the full legacy file tree

**Where:** same root cause as Finding 1.

Beyond `config.php`, the same static mount exposes every directory under `/home/mapims/cis/cis/files/`, including (non-exhaustive):

- `student_attachment/`, `staff_documents/` — personal identity/education documents
- `salary_advance/`, `salary_arrear/`, `security_deposit/` — payroll and financial records
- `staff_idcard/`, `student_idcard/` — ID photos (some intentionally public for print use, but now trivially bulk-scrapable)
- Every `.php` file at the application root (business logic, disclosing internal query structure, endpoint names, and any other embedded secrets/API keys in those files)

None of this requires authentication — only knowledge (or brute-force guessing) of a filename, and many of these are named predictably (e.g. `<register_no>.<ext>`, `<staff_id>_<doc_type>.pdf`), making bulk enumeration feasible for anyone who can list valid register/staff IDs (which are themselves short, sequential/near-sequential numbers, e.g. `2526001`–`25260NN`).

**Impact:** Mass PII and financial-record disclosure (Aadhaar/ID scans, salary records, security deposit details) for the entire student and staff population, plus full legacy source code disclosure enabling further targeted attacks.

**Remediation:** Same as Finding 1 — this is one root cause with two blast-radius descriptions. Route all document access exclusively through the already-existing authenticated `/api/files` endpoint (`server/src/routes/files.js`), which correctly enforces `authMiddleware` and path-traversal containment. The only things that should stay on the unauthenticated static mount are truly public print assets (background images, logos, CSS) — enumerate those explicitly rather than serving the parent directory.

---

## 3. High — Reversible password "encryption" with hardcoded key/IV

**Where:** `server/src/services/password.js`

```js
const ENCRYPTION_KEY = 'igrapixkey1';
const IV = '1234567891011121';
...
crypto.createCipheriv('aes-128-ctr', getKey(), Buffer.from(IV));
```

Issues, in order of severity:

1. **Reversible, not hashed.** User passwords are stored so they can be *decrypted* back to plaintext (`decrypt()` is called on every login to compare against the submitted password). Any read access to `web_account_setup.password` — via Finding 1's DB compromise, a future SQL injection, or a DB backup leak — yields every user's plaintext password immediately, with no cracking required.
2. **Hardcoded, source-controlled key and IV.** Both are constants in the repository, not environment-configured. Anyone with read access to this repo (or the equivalent legacy PHP source, which likely has the same constants) can decrypt any captured ciphertext offline.
3. **Static IV reused for every encryption.** AES-CTR is a stream cipher; reusing the same key+IV pair for every password turns it into a two-time-pad problem — XORing any two ciphertexts encrypted under this scheme cancels the keystream and reveals the XOR of the two plaintexts. Combined with (1), this is largely moot (decryption is already trivial), but it means even without the key, patterns/lengths leak, and it violates a hard cryptographic invariant for CTR mode.

**Impact:** Total credential compromise is a near-immediate consequence of any data-tier breach (see Findings 1–2), and password reuse across other systems by staff/students amplifies the blast radius beyond this application.

**Context:** This mirrors the legacy PHP app's own scheme (`password.php`), which CLAUDE.md notes this code is intentionally kept parity with. That's understandable for a migration project, but it should not be treated as acceptable long-term.

**Remediation:**
1. Migrate to a proper password hash (bcrypt/argon2) with per-user salt, either as a flag day (force reset for all accounts) or a lazy-migration-on-login pattern (verify against legacy `decrypt()` once, then re-hash and switch that account to bcrypt).
2. Until migrated, at minimum move the AES key out of source into an environment variable / secret manager, and stop reusing a static IV — generate a random IV per encryption and store it alongside the ciphertext.

---

## 4. Medium — Content-Security-Policy disabled application-wide

**Where:** `server/src/app.js`

```js
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

The codebase renders a large amount of server-generated HTML into the DOM via `dangerouslySetInnerHTML` (52 call sites in `client/src`), all sourced from server-built `reportHtml`/`printHtml` strings. Server-side escaping (`escapeHtml()` in `studentShared.js`, `payrollHelpers.js`, etc.) is the *only* XSS defense for that content — there is no CSP as a second layer, and no sanitization (e.g. DOMPurify) on the client before injection.

This assessment did not find a confirmed unescaped injection point in the report-building code sampled (see Finding 5 methodology note), but disabling CSP entirely removes a standard defense-in-depth layer for a codebase whose primary rendering pattern is inherently XSS-prone (raw HTML string building + `dangerouslySetInnerHTML`), across dozens of independently-written report generators.

**Remediation:** Introduce a CSP that at minimum restricts `script-src` to `'self'` (and specific trusted origins), even if `style-src`/`img-src` need to stay permissive for the inline styles this codebase's print HTML relies on. A `report-only` CSP rollout first would surface breakage without immediately blocking functionality, and is a low-risk way to start.

---

## 5. Medium — Systemic reliance on manual SQL string-escaping

**Where:** application-wide — 284 files / ~1,700 call sites use `prisma.$queryRawUnsafe` / `$executeRawUnsafe` with hand-built template literals, relying on every single interpolated value being pre-wrapped in `escapeSql()` (`server/src/utils/sqlSafe.js`).

**Methodology note:** I sampled roughly a dozen call sites flagged by a heuristic search for request-derived values (`fields.*`, `req.*`) interpolated into raw SQL, including `studentHostelSetup.js`, `actionScreens.js` (student academic + alumni edit), and attendance biometric lookups. In every sampled case, the value had in fact been routed through `escapeSql()` beforehand — sometimes several lines earlier via a locally-shadowed object, which is what made the heuristic search produce false positives. I did **not** find a confirmed unescaped injection in this pass, but I also did not (and could not, in this timebox) verify all ~1,700 call sites individually.

**Why this is still a real finding despite no confirmed hit:** this architecture has no structural enforcement — there's nothing that stops the next contributor from writing `WHERE id=${req.query.id}` without the `escapeSql()` wrapper, and nothing that would catch it before it ships (no lint rule, no code-level barrier, `$queryRawUnsafe` is used interchangeably with the safer tagged-template `$queryRaw` throughout). `menuAuth.js` already demonstrates the safer pattern is available and in use elsewhere:

```js
const rows = await prisma.$queryRaw`
  SELECT ... WHERE A.user_id = ${userId} AND (${likeConditions})
`;
```

**`escapeSql()` itself is functionally correct** (escapes backslash before quote, matching standard MySQL string-literal escaping) for a UTF-8 connection; it would be unsafe under a non-UTF8 client charset (e.g. GBK) due to the well-known multi-byte-charset SQL injection bypass class, but nothing observed suggests the connection is configured that way.

**Remediation:**
1. New code should default to `$queryRaw`/`$executeRaw` tagged templates (parameterized, injection-proof by construction) rather than `*Unsafe` variants, reserving `*Unsafe` for cases that genuinely need dynamic identifiers (table/column names), where parameterization can't apply and manual allow-listing is the correct control.
2. Add a lightweight static check (grep-based CI step, or an ESLint rule) that flags `${` interpolation of anything other than a small allow-listed set of helper calls (`escapeSql(...)`, `Number(...)`, `parseId(...)`) inside `$queryRawUnsafe`/`$executeRawUnsafe` template literals, to catch regressions automatically instead of relying on manual review.

---

## 6. Medium — Vulnerable dependencies

`npm audit` (production dependencies only):

**`client/`:**
- `react-router` / `react-router-dom` — **4 advisories, 3 High**: open redirect via backslash in `<Link>`/`useNavigate`, RSC error-handler XSS, DoS via inefficient route matching, RSC-mode CSRF bypass.

**`server/`:**
- `body-parser` — **1 Low**: DoS when an invalid `limit` value silently disables size enforcement.

**Remediation:** `npm audit fix` in both `client/` and `server/` picks up the available patched versions; re-test the SPA's routing behavior afterward since `react-router` major-version bumps have historically changed API surface.

---

## 7. Low — MD5 for device-trust cookie fingerprinting

**Where:** `server/src/services/accessCheck.js`

```js
const userIdCheck = crypto.createHash('md5').update(String(userId)).digest('hex');
...
loginRandomId === crypto.createHash('md5').update(String(slotValue)).digest('hex')
```

MD5 is used to fingerprint "known device" cookies against server-stored random IDs, not as a password hash — the practical impact of MD5's collision weaknesses here is limited, since this gates a secondary "remembered device" convenience check, not the primary authentication decision (login still requires the real credential check in `auth.js`). Still, MD5 is deprecated for any security-relevant hashing; a random 16+ byte token comparison (or HMAC-SHA256) would remove any question about it.

**Remediation:** Replace with `crypto.createHash('sha256')` or, better, avoid hashing at all and do a direct constant-time comparison (`crypto.timingSafeEqual`) of stored random tokens.

---

## 8. Low — Cross-Origin-Resource-Policy set to `cross-origin`

**Where:** `server/src/app.js`, same `helmet()` call as Finding 4.

```js
crossOriginResourcePolicy: { policy: 'cross-origin' },
```

This opts every response (including the exposed static file tree from Findings 1–2) out of Cross-Origin Resource Policy protection, allowing any other origin to `fetch()`/embed these resources cross-site once loaded, compounding the impact of Findings 1–2 rather than causing an issue on its own.

**Remediation:** Once Findings 1–2 are fixed and the static mount is narrowed to genuinely public print assets, revisit whether `cross-origin` is still needed — `same-site` is usually sufficient unless the SPA is served from a different origin than the API in production.

---

## Positive controls observed

- **Rate limiting on login**: 30 req/min per raw socket IP (not the spoofable `X-Forwarded-For`), plus a DB-backed 5-failed-attempt/5-minute lockout.
- **`/api/files`** correctly requires `authMiddleware` and resolves paths against a base directory with a `startsWith` containment check, rejecting traversal (`server/src/routes/files.js`).
- **`.env` is git-ignored** and confirmed absent from git history (`git log --all --full-history -- server/.env` returns nothing).
- **`JWT_SECRET`** is externally configured via `.env` (39 chars, not the `dev-secret` fallback) with an 8h expiry.
- **Error handler** returns a generic `Internal server error` message, no stack traces leaked to clients.
- **`menuAuthForModule`** uses parameterized `Prisma.sql`/tagged-template queries — the correct pattern, just not used consistently everywhere (see Finding 5).

---

## Prioritized remediation order

1. **Immediately:** rotate the exposed DB password (Finding 1); it has been sitting on a reachable, unauthenticated endpoint.
2. **This week:** narrow/remove the `/legacy` static mount (Findings 1–2) — this single fix closes the two Critical findings and most of the Low finding (8).
3. **Short term:** move the AES key/IV out of source and plan the password-hashing migration (Finding 3).
4. **Medium term:** enable a CSP in report-only mode and iterate (Finding 4); patch `react-router-dom`/`body-parser` (Finding 6); swap MD5 for SHA-256 in device fingerprinting (Finding 7).
5. **Ongoing:** introduce the CI/lint guard for raw SQL interpolation (Finding 5) so the existing manual-escaping discipline doesn't silently regress as the codebase grows.
