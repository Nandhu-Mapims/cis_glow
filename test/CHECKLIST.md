# CIS CRUD Test Checklist

> Last run: **2026-08-03T03:37:39.027Z**
> API: `http://localhost:4000`
> Mutations: **read-only** (set `TEST_MUTATIONS=1` to test create/update/delete)

## Overall

| Metric | Count |
|--------|------:|
| Total tests | 1 |
| Passed | 0 |
| Failed | 1 |
| Skipped | 0 |

## Module summary

| Module | Pass | Total | Status |
|--------|-----:|------:|--------|
| library | 0 | 1 | ❌ Needs attention |

---

## Detailed checklist

### Library

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ❌ | Read | Load setup: entry-report | entry-report | entry-report failed (500): {"message":"Unable to load library form"} |

---

## How to run

```bash
# Read-only CRUD verification (safe for shared DB)
TEST_PASSWORD=your_password node test/run.js

# Include create/update/delete tests
TEST_PASSWORD=your_password TEST_MUTATIONS=1 node test/run.js

# Single module
TEST_PASSWORD=your_password node test/run.js --module staff

# Single test by id fragment
TEST_PASSWORD=your_password node test/run.js --id staff.read.profile
```

