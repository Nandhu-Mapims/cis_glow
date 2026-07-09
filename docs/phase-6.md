# Phase 6 — Fees Module (complete)

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed

### Backend

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/fees/filters` | Account heads + payment modes |
| POST | `/api/fees/report/collection` | Collection report |
| GET | `/api/fees/students/:registerNo/history` | Student fee history |
| POST | `/api/fees/collection/sheet` | Load fee slip + entries |
| PUT | `/api/fees/collection/sheet` | Generate bank slip |
| GET | `/api/fees/slips/pending` | Pending slips queue |
| POST | `/api/fees/slips/approve/load` | Load slip for approval |
| POST | `/api/fees/slips/approve` | Post to `student_fee` + mark slip approved |
| POST | `/api/fees/dashboard` | Fee dashboard summary (`fee_dashboard_v2.php`) |
| POST | `/api/fees/dashboard/report` | Drill-down report (`fee_dashboard_report_v2.php`) |
| POST | `/api/fees/setup/:screen/load` | Load setup form (label/type/bank/fine/name) |
| POST | `/api/fees/setup/:screen/save` | Save setup form via legacy PHP |
| GET | `/api/fees/slips/approved` | Approved slips list |
| DELETE | `/api/fees/slips/approved/:groupId` | Soft-delete slip + student_fee |
| POST | `/api/fees/receipts/reprint` | Receipt HTML by receiptNo or groupId |
| GET | `/api/fees/delete/lookup/:receiptNo` | Receipt preview for delete request |
| POST | `/api/fees/delete/requests` | Submit delete request |
| GET | `/api/fees/delete/requests/mine` | User's delete requests |
| GET | `/api/fees/delete/requests/pending` | Pending approvals queue |
| GET | `/api/fees/delete/approve/:receiptNo` | Approval detail |
| POST | `/api/fees/delete/approve` | Approve delete (soft-delete student_fee) |
| POST | `/api/fees/delete/report` | Deleted receipts report |

### Frontend

- `/fees` — hub
- `/fees/collection` — generate slip
- `/fees/report/collection` — collection report
- `/fees/history` — student history
- `/fees/slips/pending` — pending queue with Approve link
- `/fees/slips/:groupId/approve` — approve + receipt print
- `/fees/dashboard` — fee summary by academic year with drill-down print
- `/fees/setup` — setup hub
- `/fees/setup/:screen` — label, type, bank, fine, name config (legacy form parity)
- `/fees/slips/approved` — delete/reprint approved slips
- Student history — per-receipt Print button
- `/fees/delete/*` — receipt delete request / approve / report
- Slip approve — full payment mode fields (bank/cash/cheque)

### Legacy bridges

- `student_fee_report.php`, `student_fee_slip_load.php`, `student_fee_slip_save.php`
- `student_fee_approve_load.php`, `student_fee_approve_save.php` → `student_fee_add_new.php`
- `fee_dashboard.php`, `fee_dashboard_report.php` → `fee_dashboard_v2.php` / `fee_dashboard_report_v2.php`
- `fee_config_load.php`, `fee_config_save.php` → fee setup PHP screens

## Pending
- None — core Phase 6 scope complete

## Notes

- Full flow: collection → pending slip → approve → `student_fee` + receipt
- Approval uses legacy receipt number logic inside `student_fee_add_new.php`
