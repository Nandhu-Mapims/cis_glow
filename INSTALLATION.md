# CIS Modernized — Production Installation Guide

> Companion reference: [USE_SCRIPT.TXT](USE_SCRIPT.TXT) has the full source of every
> script mentioned below, in one file. This document is the step-by-step procedure;
> that one is the "what does this script actually do" reference.

Ports: **frontend `1003`**, **backend `2003`**, **database `3306`**.

> **Database note (changed from earlier revisions of this doc):** there is no longer
> a separate Dockerized `mariadb` service on port `3003`. `docker-compose.yml`'s
> `backend` runs with `network_mode: host` and reads `DATABASE_URL` straight from
> `server/.env` — the app connects to a normal host-installed MariaDB on `3306`, the
> same database the legacy PHP app uses. This was a deliberate change (the earlier
> Docker-managed database was a disposable, point-in-time-seeded copy that silently
> diverged from the real data — see the "gotchas hit during setup" note near the end
> of this doc for what that looked like in practice). If you're setting up a **brand
> new** host that doesn't have MariaDB yet, install it as a normal system service
> (`apt install mariadb-server` on Debian/Ubuntu) rather than relying on Docker for it.

---

## 0. Prerequisites

- A Linux host with Docker + Docker Compose v2 (`docker compose version` should work).
- MariaDB (10.11+) installed **on the host** (not just in Docker) and running as a
  system service, listening on `127.0.0.1:3306`.
- `git`, `node` (for the account-provisioning scripts, run via `docker compose exec backend`
  or locally against `server/`), `mysql`/`mysqldump` client (used to import the dump
  directly into the host MariaDB — see step 3).
- The two SQL sources you'll import (see step 3):
  - A **full** database dump (schema + data). The trimmed dump checked into the repo
    (`apdchedu_cisapp.sql`) is missing several tables, including the accounts table
    itself (`web_account_setup`) — do not rely on it alone for production. Use a
    complete dump instead (as of this writing, the complete one is
    `/home/mapims/apdchedu_cisapp.sql`, ~3.7GB, 427 tables).
  - `extra-tables.sql` (checked into the repo root) — a handful of tables added to the
    live database after that dump was taken, most importantly the Role Manager /
    Assign Roles feature tables (`role_tb`, `role_menu_tb`, `user_role_tb`).

---

## 1. Clone the repository

```bash
git clone https://github.com/Nandhu-Mapims/cis_glow.git cis-modernized
cd cis-modernized
```

(This is a public repo, so plain HTTPS needs no credentials. SSH also works if you
have a deploy key set up: `git@github.com:Nandhu-Mapims/cis_glow.git`. Default
branch is `main`.)

---

## 2. Configure environment

### 2.1 `server/.env`

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set, at minimum:

| Key | Production value |
|---|---|
| `JWT_SECRET` | A long random string — **do not** ship with the example's placeholder. |
| `LEGACY_FILES_PATH` / `LEGACY_IMG_PATH` / `LEGACY_CIS_PATH` | Real paths to the legacy PHP tree's files/images, if the legacy-bridge features (dashboard widgets, file downloads) are in use. |
| `LEGACY_PASSWORD_KEY` / `LEGACY_PASSWORD_IV` | Leave commented out **unless** you know the legacy app's AES key/IV were rotated — these must match whatever encrypted the passwords already in the database, not be freshly generated. |
| `DATABASE_URL` | **Now the single source of truth**, used both by `docker compose` (the `backend` service reads it via `env_file: server/.env`, no override) and by any script you run locally against `server/`. Point it at the host MariaDB, e.g. `mysql://apdchedu_cisapp:<password>@localhost:3306/apdchedu_cisapp`. |

> There is no root-level `.env` / `MARIADB_ROOT_PASSWORD` / `MARIADB_APP_PASSWORD`
> step anymore — those only applied to the removed Docker-managed database service.
> Create the app's MySQL user directly on the host MariaDB instead (see step 3).

---

## 3. Create the database and import data (host MariaDB)

Create the database and app user directly on the host MariaDB (skip the `CREATE
DATABASE`/`CREATE USER` steps if they already exist, e.g. on a host that already runs
the legacy PHP app against this same database):

```bash
sudo mysql <<'EOF'
CREATE DATABASE IF NOT EXISTS apdchedu_cisapp;
CREATE USER IF NOT EXISTS 'apdchedu_cisapp'@'localhost' IDENTIFIED BY '<generate-a-strong-password>';
GRANT ALL PRIVILEGES ON apdchedu_cisapp.* TO 'apdchedu_cisapp'@'localhost';
FLUSH PRIVILEGES;
EOF
```

Make sure that password matches `DATABASE_URL` in `server/.env` (step 2.1).

Then import the **complete** dump directly with the `mysql` client (not via Docker —
`scripts/import-db.sh` is now stale, it still targets the removed containerized
database on port `3003` and should not be used against a host MariaDB setup):

```bash
# Full dump — several minutes for a multi-GB file, be patient
mysql -u apdchedu_cisapp -p apdchedu_cisapp < /path/to/complete/apdchedu_cisapp.sql

# extra-tables.sql — safe/idempotent (CREATE TABLE IF NOT EXISTS), and needed
# regardless of dump completeness since the Role Manager tables postdate every
# known dump
mysql -u apdchedu_cisapp -p apdchedu_cisapp < extra-tables.sql
```

If you need the freshest possible account/access data from a live source instance
(rather than whatever the dump captured), see `scripts/sync-user-data.sh` in
[USE_SCRIPT.TXT](USE_SCRIPT.TXT) — it exports `web_account_setup`, `access_tb`,
`authentication_tb`, `dept_authentication`, `dept_auth`, `dashboard_access`,
`role_tb`, `role_menu_tb`, `user_role_tb`, and `admin_staff_authentication_tb` from a
source database and produces an importable file the same way. (This script also
predates the host-MariaDB switch — check what host/port it targets before running it
against a production setup.)

Once the database is populated, start the app stack (backend/frontend/caddy — no
`mariadb` service to wait on anymore):

```bash
docker compose up -d
docker compose ps
```

---

## 4. Provision accounts + menu access from `ALL_USER.json`

> `ALL_USER.json` is **gitignored** (it holds real plaintext passwords, and this is a
> public repo) — a fresh `git clone` will not have it. Copy it to the server the same
> way you'd hand over `server/.env`: scp/sftp directly, a password manager, or a
> secrets vault — never a public channel. If it doesn't exist yet for a brand-new
> install, create it following the structure described below (or generate it from
> `basic_admin_menu_tb` the way it was originally built — ask whoever set up the
> first install for the generation approach if you don't have it).

The repo root has [ALL_USER.json](ALL_USER.json) — the single source of truth for
every account this install should have and exactly which menus each one can see.
It supersedes the older one-account-at-a-time flow (`create-super-user.js` /
`import-staff-accounts.js`, still present in `server/scripts/` as lower-level
primitives, but no longer the recommended path — they don't set menu access, which
used to mean a manual trip through **Admin → Department/Menu Authentication** for
every new account).

Structure: one entry per user under `"users"`, each with `member_id`, `password`,
`access_type` (`"Global"` for super-admin, `"Limit"` for everyone else), and a
`menus` array — one row per enabled menu link in `basic_admin_menu_tb`
(`menu_id`, `main_menu`, `sub_menu`, `link`, `access: true|false`). This install's
file currently has:

- `CISADMIN` — `Global`, all menus (Global bypasses per-menu checks entirely, so the
  `menus` list is populated for completeness/record-keeping, not because the app
  reads it for this account).
- `Adminmd` — `Limit`, all menus granted (full admin-level access without being
  `Global` — see the note below on what "read-only" does and doesn't mean here).
- One entry per unique Staff ID from `staff.csv`, with menu access scoped by that
  staff member's Designation (e.g. "Library" → library-module menus only, "Exam" →
  exam-module menus only). Staff who appear under multiple designations in the CSV
  get the union of both.

Apply it:

```bash
docker compose exec backend sh -c "node scripts/import-all-users.js"
# or, running server/ locally instead of via Docker:
cd server && node scripts/import-all-users.js
```

This is `server/scripts/import-all-users.js` — **idempotent and safe to re-run**. It
matches existing accounts by `member_id` and existing grants by `(user_id, menu_id)`,
so editing `ALL_USER.json` (change a password, flip an `access` boolean to `true` or
`false`) and re-running applies exactly that diff — grants what's now `true`, revokes
what's now `false` — rather than duplicating rows or requiring manual UI clicks.

**Before you run this against a database that already has real accounts on it**,
check whether any `member_id` in `ALL_USER.json` already exists with different
access than what the file specifies — the import will overwrite that account's
password and menu grants to match the file. This bit us once already during setup:
several `staff.csv` IDs turned out to already be live accounts in the target
database, and re-running the import reset their passwords and replaced their
existing (broader/different) menu access with the designation-based scope defined
in the file. If you're importing into a database that predates this file, audit
overlapping `member_id`s first.

**A caution on editing `ALL_USER.json` by hand:** it's a plain-text file with real
passwords in it — some editors' autocorrect/autocapitalize can silently mutate a
password string (this happened during setup: `CisAdmin@2026` became `CIsAdmin@2026`
after the file was opened in an editor, and nobody noticed until login started
failing). After any manual edit, diff the file or re-read the password field back
before relying on it, and treat this file as sensitive — don't commit it anywhere
public, and don't paste its contents into chat/tickets/screenshots.

**On "read-only" access:** `authentication_tb` (what `menus`/`access` in this file
controls) is a binary "can this account reach this menu link at all" switch per
screen — there's no separate read vs. write flag in the schema. The one exception is
the Admin module specifically, which the app hardcodes to view-only for any
non-`Global` account regardless of what's granted here (see
`client/src/pages/admin/AdminSetupPage.jsx` — it shows a "view-only, only Super
Admin can save" banner and blocks the save call client-side for any `Limit`
account). Everywhere else, granting a menu means full read/write access to that
screen; there's no way to give someone view access to, say, Fee Approve without also
letting them approve fees.

---

## 5. Reverse proxy (Caddy)

`docker-compose.yml`'s `frontend` service now publishes port `1003` LAN-wide
(`"1003:1003"`, not loopback-only) so it's directly reachable during setup/testing —
but `Caddyfile` on port `80` remains the intended path for anything actually
public-facing (it forwards the real client IP via `X-Forwarded-For`, which the
backend's login rate-limiter depends on; going straight to `1003` skips that).

```bash
docker compose up -d caddy
docker compose logs caddy --tail 30
```

Known gotcha hit during setup: Caddy's `header_up` directive is a subdirective of
`reverse_proxy` and must be **nested inside its `{ }` block** — putting it after the
block at the top level fails to parse with `unrecognized directive: header_up` and
crash-loops the container. The checked-in `Caddyfile` already has this right
(`reverse_proxy 127.0.0.1:1003 { header_up X-Forwarded-For {remote_host} }`); if
you're copying config from an older revision of this repo, watch for that shape.

If Caddy fails to start with `bind: address already in use`, something else on the
host already owns port `80` — check with `sudo ss -ltnp | grep ':80 '` and stop/move
that service, or change the port Caddy binds in `Caddyfile`/`docker-compose.yml`.

---

## 6. Verify

1. Open `http://<server-host>:1003` in a browser (or `http://<server-host>` once
   Caddy is confirmed working — see step 5).
2. Log in as `CISADMIN` / the password in `ALL_USER.json` — should land on
   `/dashboard` with full admin access (no menu restrictions, since `Global`).
3. Log in as one of the staff accounts from `staff.csv` (e.g. `30455` / `30455@123`,
   unless you've already changed it) — should see only the menus scoped to that
   staff member's designation(s) in `ALL_USER.json`, not the full menu.
4. Check backend health: `curl http://<server-host>:2003/api/health` should return
   `200`.
5. Confirm the backend is actually talking to the database you think it is:
   `docker exec <backend-container> printenv | grep -i database_url` — should show
   your host MariaDB (`localhost:3306` or similar), **not** a `127.0.0.1:3003`
   Docker-only address. Mismatches here were the single biggest source of confusing
   "why don't my changes show up" symptoms during setup — a script run locally
   against `server/.env`'s database and the actual running backend container can
   silently be two different databases if `docker-compose.yml` was edited but the
   container never recreated (`docker compose up -d backend` picks up config
   changes; restarting the container process alone does not).
6. Watch for errors while clicking around: `docker compose logs -f backend`. A
   `PrismaClientKnownRequestError ... table does not exist` means some table is still
   missing from the imported dump — re-check step 3's complete-dump import actually
   reached that table (large imports can silently stop partway if the `mysql` client
   hits an error mid-file; check the import command's own output for errors, don't
   assume "it printed 'Done'" always means every statement in a multi-GB file
   succeeded).

---

## 7. Production hardening checklist (do before going live, not after)

- [ ] Host MariaDB's app user password (step 3) is a real generated secret, not left
      as a placeholder, and matches `DATABASE_URL` in `server/.env`.
- [ ] `JWT_SECRET` in `server/.env` changed from the example placeholder.
- [ ] `CISADMIN`'s password in `ALL_USER.json` changed from whatever was used during
      initial setup, if that value was shared/typed anywhere insecure — and the file
      itself hasn't been mangled by an editor (see the autocorrect caution in step 4).
- [ ] Every account provisioned via `ALL_USER.json`/`staff.csv` has its own real
      password set by that person on first login (the CSV's `<StaffID>@123` pattern
      is a predictable default, not a real credential) — consider forcing a reset via
      **Admin → Reset Account** for each one so `reset_password` is set and they're
      routed through the change-password flow on next login.
- [ ] Decide whether frontend port `1003` should stay open LAN-wide or be pulled back
      to loopback-only (`"127.0.0.1:1003:1003"` in `docker-compose.yml`) with Caddy
      on port `80`/`443` as the sole entry point — LAN-wide is convenient for
      same-network testing but widens exposure versus the original loopback-only
      design.
- [ ] TLS: get a domain pointed at this host and switch `Caddyfile` to its HTTPS
      block (commented out at the bottom of the file) — this stack serves plain HTTP
      by default, and real passwords go over that connection.
- [ ] A backup strategy for the host MariaDB (`apdchedu_cisapp` database) — this is
      the actual, shared database now; there is no separate Docker volume for it to
      back up, back up the host database the same way you would any production
      MySQL/MariaDB instance.
- [ ] Firewall rules restricting port `3306` (the database) to `localhost`/trusted
      hosts only — it should not be reachable from the public internet. Confirm with
      `sudo ss -ltnp | grep 3306` that it's bound to `127.0.0.1`, not `0.0.0.0`.
- [ ] `LEGACY_FILES_PATH`/`LEGACY_IMG_PATH`/`LEGACY_CIS_PATH` in `server/.env` point at
      real, readable paths if any legacy-bridge features are in use in this deployment.
- [ ] `ALL_USER.json` is treated as a secret (real passwords in plain text) — excluded
      from anywhere it could leak (public repos, shared tickets, chat transcripts) and
      not left readable by more accounts than necessary on the host.
