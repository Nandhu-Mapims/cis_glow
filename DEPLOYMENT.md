# Deploying to a Hostinger VPS — Security / "Protection" Setup

> This is the VPS-hosting layer: hardening the server itself and putting a
> reverse proxy in front of the app. For the application-level install steps
> (cloning, importing the database, provisioning accounts), see
> [INSTALLATION.md](INSTALLATION.md) — do that **after** working through this
> file, since it assumes the VPS itself is already reasonably locked down.

Current setup: **no domain yet, IP-only, plain HTTP** (per your answer). Section
7 below covers switching to HTTPS the moment a domain is available — do that
as soon as you can, since the login form posts real passwords over whatever
connection is in front of it.

---

## 1. Get the VPS and initial access

1. Provision the VPS in Hostinger's panel (Ubuntu 22.04 or 24.04 LTS
   recommended — matches what Docker/Caddy are tested against here).
2. Note the VPS's public IP — you'll need it throughout this guide as
   `<VPS_IP>`.
3. Log in the first time with whatever credentials Hostinger gives you
   (usually `root` + a generated password, or a Hostinger-provided SSH key).

---

## 2. Lock down SSH access (do this before anything else)

```bash
ssh root@<VPS_IP>

# Create a non-root sudo user — don't operate as root day-to-day
adduser deploy
usermod -aG sudo deploy

# Copy your local public key to the new user (run from YOUR machine, not the VPS)
ssh-copy-id deploy@<VPS_IP>

# Back on the VPS, as deploy now:
su - deploy
sudo nano /etc/ssh/sshd_config
```

In `sshd_config`, set:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
sudo systemctl restart sshd
```

**Verify you can still log in as `deploy` with your key in a NEW terminal
session before closing your current one** — if `sshd_config` has a typo,
you don't want to be locked out with no way back in.

---

## 3. Firewall (ufw)

Only SSH, HTTP, and HTTPS should ever be reachable from the public internet.
Everything else the app needs (ports `1003`/`2003`/`3003`) is bound to
`127.0.0.1` in `docker-compose.yml` specifically so they're unreachable from
outside regardless of firewall state — ufw is the second layer, not the only
one.

```bash
sudo apt update && sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

> **Docker + ufw gotcha, already handled but worth understanding:** Docker
> manipulates iptables directly for any container using `ports:` (published
> ports), and those rules take priority over ufw's own INPUT chain — a
> `ufw deny 3003` alone would **not** actually block a container published as
> `"3003:3306"`. This repo's `docker-compose.yml` avoids the problem
> entirely by binding those ports to `127.0.0.1` (`"127.0.0.1:3003:3306"`,
> `"127.0.0.1:1003:1003"`) — a restriction Docker itself enforces, immune to
> ufw misconfiguration. `caddy` and `backend` use `network_mode: host`
> instead of published ports, so normal ufw rules apply to them directly
> (which is why `backend`'s `2003` genuinely is blocked from the internet by
> the ufw rules above — there's no `ufw allow 2003`).

---

## 4. Fail2ban (SSH brute-force protection)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

Default config already covers SSH. The app itself has its own login
brute-force protection independent of this (see §8) — fail2ban here is
specifically about SSH, the door into the server itself.

---

## 5. Automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 6. Install Docker + Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# log out and back in for the group change to apply
docker compose version   # confirm v2 is available
```

---

## 7. Deploy the app

```bash
git clone https://github.com/Nandhu-Mapims/cis_glow.git cis-modernized
cd cis-modernized
```

(Public repo — plain HTTPS needs no credentials on the VPS. SSH also works if
you set up a deploy key: `git@github.com:Nandhu-Mapims/cis_glow.git`.)

Follow **[INSTALLATION.md](INSTALLATION.md) sections 2–6** (env config, DB
import, account provisioning) now, with one addition to the root `.env` from
INSTALLATION.md §2.2 — set `CLIENT_URL` to match how this will actually be
reached, so the backend's CORS check accepts the frontend's requests:

```bash
cat >> .env <<EOF
CLIENT_URL=http://<VPS_IP>
EOF
```

Then bring up the full stack, including Caddy:

```bash
docker compose up -d
docker compose ps   # confirm mariadb, backend, frontend, caddy are all running
```

Visit `http://<VPS_IP>` in a browser — Caddy on port 80 is now the single
public entry point, reverse-proxying to the frontend, which itself proxies
`/api`/`/legacy` to the backend internally. Nothing else is reachable from
outside.

### When you get a domain

1. Point the domain's DNS **A record** at `<VPS_IP>`.
2. Edit `Caddyfile`: comment out the `:80 { ... }` block, uncomment the
   domain block, fill in your real domain.
3. Update `.env`: `CLIENT_URL=https://your-domain.example`
4. `docker compose up -d` — Caddy automatically obtains and renews a free
   Let's Encrypt certificate and starts redirecting HTTP → HTTPS. No other
   config changes needed.

---

## 8. What's already protected at the application level

Worth knowing so you don't duplicate effort:

- **Login rate limiting**: `POST /api/auth/login` is capped at 30 requests/min
  per IP (`express-rate-limit`, keyed on the raw socket address, not a
  spoofable header), plus a separate 5-failed-attempts-in-5-minutes lockout
  per IP tracked in `log_tb`.
- **`trust proxy` is set to exactly 1 hop** (`server/src/app.js`) — this
  assumes exactly one reverse proxy (Caddy) sits between the internet and the
  app. If you ever add a second proxy layer (e.g. Hostinger's own LB in front
  of Caddy), this number needs to change too, or IP-based rate limiting above
  will key off the wrong address.
- **Passwords are AES-128-CTR encrypted** (not hashed) with a key/IV shared
  with the legacy PHP app — this is a legacy-parity constraint, not something
  this deployment changes. See `server/src/services/password.js`.
- **CORS** is an explicit origin allowlist (`CLIENT_URL`/`CLIENT_URLS`), not
  wildcard — requests from origins not in that list are rejected regardless
  of what the firewall/proxy allows through.
- **Helmet** is active but CSP is report-only (some screens still use inline
  handlers for legacy-parity print/dashboard HTML) — not a gap introduced by
  this deployment, a known existing state of the app.

---

## 9. Ongoing protection checklist

- [ ] `MARIADB_ROOT_PASSWORD` / `MARIADB_APP_PASSWORD` / `JWT_SECRET` set to
      real, unique, strong values in the root `.env` / `server/.env` — not
      left as the `cis_dev_*`/example defaults (see INSTALLATION.md §7,
      already itemized there — repeated here because it's the single most
      important item on both lists).
- [ ] Every account provisioned via `staff.csv`'s predictable
      `<StaffID>@123` passwords has been forced through a real reset
      (Admin → Reset Account) before this goes live for real users.
- [ ] HTTPS enabled (§7 "When you get a domain") — don't leave this on plain
      HTTP longer than necessary.
- [ ] Backups: `mariadb_data` is a Docker named volume — back it up like you
      would any production database data directory. A simple starting point:
      ```bash
      docker compose exec mariadb sh -c \
        'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" apdchedu_cisapp' > backup-$(date +%F).sql
      ```
      on a cron schedule, shipped off-VPS (Hostinger snapshot, S3, etc.) —
      a backup that only lives on the same disk as the database protects
      against nothing.
- [ ] `caddy_data`/`caddy_config` volumes also worth backing up — that's
      where Let's Encrypt certificates/keys live once HTTPS is enabled;
      losing them just means Caddy re-issues on next start, but backing up
      avoids unnecessary Let's Encrypt rate-limit churn.
- [ ] SSH key rotated/audited periodically; `deploy` user's `sudo` access
      limited to people who actually need server access (not the same list
      as people who need CIS admin accounts inside the app).
- [ ] `docker compose pull` / image updates applied periodically — this
      stack pins `mariadb:10.11` and `caddy:2-alpine` (not `latest`), which
      is good for reproducibility but means security patches in newer minor
      versions need a deliberate, occasional bump, not automatic pickup.
- [ ] Disk space monitored — `mariadb_data` will grow indefinitely with
      normal usage; an out-of-space database is a hard outage, not a
      graceful degradation.
