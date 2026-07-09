# Phase 2 — Dashboard Widgets + Legacy Analysis

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed in Phase 2

### Dashboard widget data (dashboard_more.php parity)

- `GET /api/dashboard/widgets` — loads widget HTML via legacy PHP bridge
- React dashboard fetches widget groups on load and refresh
- Academic year params (`ugr`, `uga`, `pgr`) from `basic_setup_tb`
- Date picker + Refresh re-fetches all widget groups
- Legacy widget CSS ported to `client/src/styles/cis.css`

### Legacy reference files added

- `legacy-reference/dashboard_more.php`
- `legacy-reference/widget.php`
- `legacy-reference/dashboard_student.php`
- `legacy-reference/dashboard_access.php`

### Bridge architecture

Widget business logic remains in legacy `dashboard_more.php` (~2,900 lines + `staff_attendance.php` dependencies). Node invokes:

```
server/legacy-bridge/dashboard_widgets.php  →  cis/dashboard_more.php
```

This guarantees **identical SQL, calculations, and HTML** to the PHP app. Native Node ports of individual widget functions can replace the bridge incrementally in later phases.

**Requirements:** PHP 7.4+ CLI, `LEGACY_CIS_PATH` pointing at live CIS PHP tree (default `/home/mapims/cis/cis`).

## API endpoints (Phase 2)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/dashboard` | Yes | Shell + widget list + academic years |
| GET | `/api/dashboard/widgets` | Yes | Widget HTML data (`w`, `d`, `ugr`, `uga`, `pgr`, `c`, `t`) |

### Widget query parameters

| Param | Description |
|-------|-------------|
| `w` | Comma-separated widget names (required) |
| `d` | Unix timestamp or ISO date |
| `ugr` | U.G regular academic year |
| `uga` | U.G additional academic year |
| `pgr` | P.G regular academic year |
| `c` | `1` for staff_current time mode |
| `t` | Time `HH:MM` for staff_current |
| `cRefresh` | Cache refresh flag (legacy) |

### Supported widgets

Staff: `staff_attendance`, `staff_attendance_incampus`, `staff_leave_absent`, `staff_permission`, `staff_details`, `staff_current`

Student: `ug_attendance`, `ug_attendance_add`, `pg_attendance`, `pg_attendance_dept`, `pg_leave_absent`, `pg_permission`, `internship_*`, `student_details`, `student_add_details`, `student_scholarship`, `student_hostel`, `gents_hostel_attendance`, `ladies_hostel_attendance`, `student_ghostel`, `student_lhostel`, `feedback_analyasis`

## Run

```bash
# API
cd server && npm run dev

# UI
cd client && npm run dev
```

## Next phases

- Module-by-module PHP → Express + React (Student, Staff, Fees, etc.)
- Incremental native Node replacement of dashboard widget bridge
- Docker deployment
