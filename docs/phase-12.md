# Phase 12 — Audit and Security (started)

## Completed

- Central audit logging service (login/logout writes to `log_tb`)
- Login rate limiting (5 failures / 5 min)
- JWT authentication on all API routes
- File download protection (`GET /api/files/*`)
- Menu filtering for sidebar (`GET /api/menu` uses `authentication_tb`)
- API menu auth middleware (`menuAuthForModule`) on students, staff, fees, attendance, academic, exam, admin routes
- Login dashboard viewer (`/admin/log-dashboard` → `log_dashboard.php`)
- Log details search (`/admin/log-details` → `log_details.php`)
- Bridge save audit (`bridgeAuditLog.js` → `log_tb` for academic/exam/admin/fee setup saves)

## Remaining

- [ ] Per-route fine-grained menu checks (specific screen vs module prefix)
- [ ] Student portal JWT auth (separate from staff `empusername_login`)
- [x] Report view audit on bridged load endpoints (`logBridgeView` for academic/exam/admin/payroll reports + log viewers)
