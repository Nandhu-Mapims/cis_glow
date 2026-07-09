# cis_dental — Modernized CIS (Phase 3)

Screen-by-screen migration of the legacy PHP CIS application to **React + Node.js + Express + Prisma**, using the existing MariaDB database (`apdchedu_cisapp`) unchanged.

## Completed scope

**Phase 1:** Login, auth, settings, menu, dashboard shell, audit logs.

**Phase 2:** Dashboard widget data (`dashboard_more.php` parity).

**Phase 3 (in progress):** Student search, profile view, limited edit at `/students`.

See [docs/phase-1.md](docs/phase-1.md), [docs/phase-2.md](docs/phase-2.md), and [docs/phase-3.md](docs/phase-3.md).

**Note:** Widget data uses a PHP CLI bridge to legacy `dashboard_more.php` for exact SQL/HTML parity. Requires PHP 7.4+ and `LEGACY_CIS_PATH` (default `/home/mapims/cis/cis`).

## Quick start

```bash
# Terminal 1 — API
cd server && npm install && npm run dev

# Terminal 2 — UI
cd client && npm install && npm run dev
```

Legacy PHP reference files are in `legacy-reference/` and the live legacy app remains at `/home/mapims/cis/cis`.
