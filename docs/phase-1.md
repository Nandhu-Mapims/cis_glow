# Phase 1 — CIS Modernization

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

Phase 1 connects the new React + Node stack to the **existing** MariaDB database (`apdchedu_cisapp`) without changing schema, table names, or column names.

## Completed in Phase 1

- Prisma introspection (`427` models) via `prisma db pull`
- Express API connected to existing MariaDB
- Auth using `web_account_setup` + legacy AES-128-CTR password logic
- Access rules from `access_tb`
- Institution settings from `basic_setup_tb`
- Dashboard shell from `dashboard_access`
- Menu/top navigation from `admin_menu_category_tb`, `basic_admin_menu_tb`, `authentication_tb`
- Audit logging to `log_tb`
- React login + dashboard layout (Bootstrap 5)

## Project layout

```
legacy-cis-modernized/
├── client/              React + Vite frontend
├── server/              Express + Prisma backend
├── legacy-reference/    Snapshot of key legacy PHP files
└── docs/
```

## Backend setup

```bash
cd server
cp .env.example .env
# Set DATABASE_URL for apdchedu_cisapp
npm install
npm run db:pull
npm run db:generate
npm run dev
```

Server runs on `http://localhost:4000`.

## Frontend setup

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173` and proxies `/api` + `/legacy` to the backend.

## API endpoints (Phase 1)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login with legacy credentials |
| POST | `/api/auth/logout` | Logout + audit log |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/settings/public` | Login page branding |
| GET | `/api/settings/basic` | Full institution settings |
| GET | `/api/dashboard` | Dashboard shell + widgets |
| GET | `/api/menu` | Top navigation menu tree |

## Migration principle

1. Keep legacy PHP running as reference
2. Migrate one module at a time
3. Reuse existing tables and business rules
4. Do not invent new schema

## Next phases

- See [phase-2.md](phase-2.md) — dashboard widgets (complete)
- Module-by-module PHP → Express + React migration (Phase 3+)
- Docker deployment
