# CIS CRUD Test Suite

HTTP-based CRUD verification for all CIS modules. After each run, **`CHECKLIST.md`** and **`status.json`** are updated so you can track pass/fail status per module and screen.

## Prerequisites

1. API server running (`cd server && npm run dev`)
2. Valid test credentials (`CISADMIN` or another admin user)
3. Node.js 20+

## Quick start

```bash
# Read-only tests (safe on shared DB — no create/update/delete)
TEST_PASSWORD=your_password node test/run.js

# Include mutation tests (staff create, profile update, examiner setup save)
TEST_PASSWORD=your_password TEST_MUTATIONS=1 node test/run.js

# One module at a time
TEST_PASSWORD=your_password node test/run.js --module staff
TEST_PASSWORD=your_password node test/run.js --module exam

# Single test
TEST_PASSWORD=your_password node test/run.js --id staff.read.profile

# List modules and test counts
node test/run.js --list
```

From `server/`:

```bash
npm run test:crud
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_PASSWORD` | — | **Required.** Login password |
| `TEST_USER` | `CISADMIN` | Login username |
| `API_URL` | `http://localhost:4000` | API base URL |
| `TEST_MUTATIONS` | `0` | Set to `1` to run create/update/delete tests |
| `TEST_STAFF_ID` | `847` | Internal staff row id for read/update tests |
| `TEST_STUDENT_ID` | — | Optional student internal id (auto-picks from search if unset) |

## Output files

| File | Purpose |
|------|---------|
| [`CHECKLIST.md`](./CHECKLIST.md) | Human-readable checklist with ✅/❌ per test |
| [`status.json`](./status.json) | Machine-readable results for CI or dashboards |

## Structure

```
test/
  run.js              # Main entry point
  config.js           # Environment config
  CHECKLIST.md        # Updated after each run
  status.json         # Updated after each run
  lib/
    client.js         # HTTP + login
    runner.js         # Test execution
    report.js         # Checklist generator
    screens.js        # Screen slugs (synced from server)
  mock/
    fixtures.js       # Mock staff/student payloads
  modules/
    foundation.js     # Auth, menu, settings
    dashboard.js
    students.js
    staff.js
    attendance.js
    fees.js
    academic.js
    exam.js
    payroll.js
    hostel.js
    library.js
    admin.js
    settings.js
    web.js
    others.js         # elearning, portfolio, sms, etc.
```

## CRUD coverage

| Op | Meaning |
|----|---------|
| **R** | Read — GET or load endpoints |
| **C** | Create — POST new records (mutation only) |
| **U** | Update — PUT/PATCH/save (mutation only) |
| **D** | Delete — soft-delete where supported (mutation only) |

Most screens are covered with **Read** tests (load screen data). Mutation tests are opt-in via `TEST_MUTATIONS=1`.

## Related

- `server/scripts/run-all-module-tests.js` — service-layer smoke + latency suite (no HTTP)
- `npm run test:all` — run the full service smoke suite
