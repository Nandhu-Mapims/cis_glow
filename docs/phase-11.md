# Phase 11 — Admin / User Management (started)

## Backend

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/users` | Paginated `web_account_setup` list |
| POST | `/api/admin/setup/:screen/load` | Load legacy admin form |
| POST | `/api/admin/setup/:screen/save` | Save (incl. photo upload via multipart bridge) |

**Screens:** `account-add`, `account-edit`, `access-restriction`, `dept-auth`, `menu-auth`, `dashboard-access`

**Bridges:** `admin_config_load.php`, `admin_config_save.php`, `admin_config_helper.php`

## Frontend

- `/admin` — hub
- `/admin/users` — user directory
- `/admin/users/:userId/edit` — direct account edit
- `/admin/setup/:screen` — bridged forms

## Login audit

- `/admin/log-dashboard` — `log_dashboard.php` (date filter, refresh, print)
- `/admin/log-details` — `log_details.php` (user/date/OS/IP search, session trace, print)

## Remaining
- [ ] Other access screens (`att_menu_access.php`, `machine_access.php`, etc.)
