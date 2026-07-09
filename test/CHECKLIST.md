# CIS CRUD Test Checklist

> Last run: **2026-06-30T10:02:12.193Z**
> API: `http://localhost:4000`
> Mutations: **read-only** (set `TEST_MUTATIONS=1` to test create/update/delete)

## Overall

| Metric | Count |
|--------|------:|
| Total tests | 310 |
| Passed | 305 |
| Failed | 0 |
| Skipped | 5 |

## Module summary

| Module | Pass | Total | Status |
|--------|-----:|------:|--------|
| foundation | 4 | 4 | ✅ Complete |
| dashboard | 5 | 5 | ✅ Complete |
| students | 22 | 22 | ✅ Complete |
| staff | 33 | 35 | 🟡 Partial |
| attendance | 48 | 48 | ✅ Complete |
| fees | 11 | 11 | ✅ Complete |
| academic | 30 | 30 | ✅ Complete |
| exam | 26 | 27 | 🟡 Partial |
| payroll | 21 | 23 | 🟡 Partial |
| hostel | 11 | 11 | ✅ Complete |
| library | 12 | 12 | ✅ Complete |
| admin | 9 | 9 | ✅ Complete |
| settings | 12 | 12 | ✅ Complete |
| web | 20 | 20 | ✅ Complete |
| elearning | 3 | 3 | ✅ Complete |
| portfolio | 2 | 2 | ✅ Complete |
| sms | 5 | 5 | ✅ Complete |
| committee | 4 | 4 | ✅ Complete |
| certificate | 5 | 5 | ✅ Complete |
| circular | 6 | 6 | ✅ Complete |
| naac | 4 | 4 | ✅ Complete |
| adminOffice | 5 | 5 | ✅ Complete |
| tv | 3 | 3 | ✅ Complete |
| kiosk | 4 | 4 | ✅ Complete |

---

## Detailed checklist

### Foundation

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Login and receive JWT | — | 439ms |
| ✅ | Read | Get current user profile | — | 240ms |
| ✅ | Read | Load navigation menu | menu | 76ms |
| ✅ | Read | Load basic institution settings | basic-setup | 30ms |

### Dashboard

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load dashboard widgets | dashboard | 454ms |
| ✅ | Read | Load student dashboard shell | student-dashboard | 61ms |
| ✅ | Read | Load staff pattern shell | staff-pattern | 30ms |
| ✅ | Read | Load overall strength report | overall-strength | 83ms |
| ✅ | Read | Load community strength report | community-strength | 232ms |

### Students

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | List student courses | — | 37ms |
| ✅ | Read | Search students by name | student-search | 16ms |
| ✅ | Read | Load student report field definitions | student-report | 15ms |
| ✅ | Read | Load screen: temp-admission-add | temp-admission-add | 113ms |
| ✅ | Read | Load screen: temp-admission-edit | temp-admission-edit | 47ms |
| ✅ | Read | Load screen: temp-affidavit | temp-affidavit | 33ms |
| ✅ | Read | Load screen: academic-promotion | academic-promotion | 31ms |
| ✅ | Read | Load screen: attachments-upload | attachments-upload | 16ms |
| ✅ | Read | Load screen: attachments-view | attachments-view | 38ms |
| ✅ | Read | Load screen: attachments-report | attachments-report | 118ms |
| ✅ | Read | Load screen: id-card | id-card | 108ms |
| ✅ | Read | Load screen: photo-empty | photo-empty | 82ms |
| ✅ | Read | Load screen: photo-upload | photo-upload | 61ms |
| ✅ | Read | Load screen: promote | promote | 76ms |
| ✅ | Read | Load screen: address-label | address-label | 74ms |
| ✅ | Read | Load screen: alumni-registration | alumni-registration | 43ms |
| ✅ | Read | Load screen: alumni-edit | alumni-edit | 50ms |
| ✅ | Read | Load screen: alumni-report | alumni-report | 81ms |
| ✅ | Read | Load screen: alumni-id-card | alumni-id-card | 81ms |
| ✅ | Read | Load screen: collage-generate | collage-generate | 79ms |
| ✅ | Read | Load screen: collage-image | collage-image | 53ms |
| ✅ | Read | Load student profile by ID | student-profile | 144ms |

### Staff

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | List staff categories | — | 117ms |
| ✅ | Read | Search staff by name | staff-search | 105ms |
| ✅ | Read | Load staff profile dropdown options | staff-profile | 126ms |
| ✅ | Read | Load staff admission form options | staff_profile_add | 152ms |
| ✅ | Read | Load staff profile by internal ID | staff_profile_edit | 175ms |
| ✅ | Read | Load setup: designation-edit | designation-edit | 179ms |
| ✅ | Read | Load setup: attachment-category | attachment-category | 62ms |
| ✅ | Read | Load setup: attachment-scategory | attachment-scategory | 50ms |
| ✅ | Read | Load setup: attachment-setup | attachment-setup | 124ms |
| ✅ | Read | Load setup: org-chart-config | org-chart-config | 158ms |
| ✅ | Read | Load setup: inspection-config | inspection-config | 26ms |
| ✅ | Read | Load setup: inspection-name | inspection-name | 27ms |
| ✅ | Read | Load setup: transport-setup | transport-setup | 25ms |
| ✅ | Read | Load setup: login-help | login-help | 20ms |
| ✅ | Read | Load screen: appoint-order | appoint-order | 60ms |
| ✅ | Read | Load screen: salary-note | salary-note | 45ms |
| ✅ | Read | Load screen: id-card | id-card | 75ms |
| ✅ | Read | Load screen: photo-empty | photo-empty | 59ms |
| ✅ | Read | Load screen: photo-upload | photo-upload | 24ms |
| ✅ | Read | Load screen: org-structure | org-structure | 27ms |
| ✅ | Read | Load screen: transport | transport | 106ms |
| ✅ | Read | Load screen: certificates | certificates | 27ms |
| ✅ | Read | Load screen: photos | photos | 529ms |
| ✅ | Read | Load screen: inspection-details | inspection-details | 58ms |
| ✅ | Read | Load screen: inspection-attn-sheet | inspection-attn-sheet | 47ms |
| ✅ | Read | Load screen: inspection-attn-cert | inspection-attn-cert | 80ms |
| ✅ | Read | Load screen: dci-report | dci-report | 96ms |
| ✅ | Read | Load screen: tnmgr-report | tnmgr-report | 82ms |
| ✅ | Read | Load screen: affidavit-dci | affidavit-dci | 69ms |
| ✅ | Read | Load screen: affidavit-tnmgrmu | affidavit-tnmgrmu | 70ms |
| ✅ | Read | Load screen: attach-print | attach-print | 88ms |
| ✅ | Read | Load screen: publication-dci | publication-dci | 73ms |
| ✅ | Read | Load screen: publication-tnmgrmu | publication-tnmgrmu | 73ms |
| ⏭️ | Create | Create staff admission record | staff_profile_add | Set TEST_MUTATIONS=1 to run create/update/delete tests |
| ⏭️ | Update | Update staff profile remarks | staff_profile_edit | Set TEST_MUTATIONS=1 to run create/update/delete tests |

### Attendance

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: calendar-add | calendar-add | 70ms |
| ✅ | Read | Load setup: calendar-edit | calendar-edit | 74ms |
| ✅ | Read | Load setup: working-day | working-day | 67ms |
| ✅ | Read | Load setup: att-time | att-time | 44ms |
| ✅ | Read | Load staff attendance: clear-icache | clear-icache | 42ms |
| ✅ | Read | Load staff attendance: daily-attendance | daily-attendance | 44ms |
| ✅ | Read | Load staff attendance: biometric-report | biometric-report | 43ms |
| ✅ | Read | Load staff attendance: smr-acknowledge | smr-acknowledge | 156ms |
| ✅ | Read | Load staff attendance: smr-leave-approve | smr-leave-approve | 132ms |
| ✅ | Read | Load staff attendance: smr-permission-approve | smr-permission-approve | 66ms |
| ✅ | Read | Load staff attendance: smr-defaulter-approve | smr-defaulter-approve | 85ms |
| ✅ | Read | Load staff attendance: smr-lpd-report | smr-lpd-report | 114ms |
| ✅ | Read | Load staff attendance: holiday-roster | holiday-roster | 91ms |
| ✅ | Read | Load staff attendance: compensation | compensation | 53ms |
| ✅ | Read | Load staff attendance: attendance-report | attendance-report | 60ms |
| ✅ | Read | Load staff attendance: teaching-month-report | teaching-month-report | 84ms |
| ✅ | Read | Load staff attendance: yearly-report | yearly-report | 28ms |
| ✅ | Read | Load staff attendance: att-chart | att-chart | 288ms |
| ✅ | Read | Load staff attendance: att-chart-modified | att-chart-modified | 78ms |
| ✅ | Read | Load staff attendance: att-chart-combined | att-chart-combined | 59ms |
| ✅ | Read | Load staff attendance: att-time-report | att-time-report | 1502ms |
| ✅ | Read | Load staff attendance: available-cl | available-cl | 116ms |
| ✅ | Read | Load staff attendance: att-transport | att-transport | 26ms |
| ✅ | Read | Load staff attendance: available-leave | available-leave | 28ms |
| ✅ | Read | Load student attendance filters | — | 7ms |
| ✅ | Read | Load student attendance: biometric-report | biometric-report | 17ms |
| ✅ | Read | Load student attendance: holiday-report | holiday-report | 17ms |
| ✅ | Read | Load student attendance: smr-leave-request | smr-leave-request | 33ms |
| ✅ | Read | Load student attendance: smr-dept-leave | smr-dept-leave | 31ms |
| ✅ | Read | Load student attendance: smr-permission | smr-permission | 13ms |
| ✅ | Read | Load student attendance: smr-defaulter | smr-defaulter | 32ms |
| ✅ | Read | Load student attendance: smr-lpd-report | smr-lpd-report | 37ms |
| ✅ | Read | Load student attendance: smr-setup | smr-setup | 24ms |
| ✅ | Read | Load student attendance: pg-att-setup | pg-att-setup | 33ms |
| ✅ | Read | Load student attendance: pg-holiday-roster-add | pg-holiday-roster-add | 26ms |
| ✅ | Read | Load student attendance: pg-holiday-roster-edit | pg-holiday-roster-edit | 35ms |
| ✅ | Read | Load student attendance: pg-manual-att | pg-manual-att | 26ms |
| ✅ | Read | Load student attendance: pg-reports-att | pg-reports-att | 23ms |
| ✅ | Read | Load student attendance: pg-punch-entry | pg-punch-entry | 27ms |
| ✅ | Read | Load student attendance: pg-punch | pg-punch | 21ms |
| ✅ | Read | Load student attendance: year-incharge | year-incharge | 36ms |
| ✅ | Read | Load student attendance: ug-att-report | ug-att-report | 20ms |
| ✅ | Read | Load student attendance: intern-att-setup | intern-att-setup | 21ms |
| ✅ | Read | Load student attendance: intern-holiday-roster-add | intern-holiday-roster-add | 36ms |
| ✅ | Read | Load student attendance: intern-holiday-roster-edit | intern-holiday-roster-edit | 48ms |
| ✅ | Read | Load student attendance: intern-manual-att | intern-manual-att | 18ms |
| ✅ | Read | Load student attendance: intern-reports-att | intern-reports-att | 32ms |
| ✅ | Read | Load student attendance: intern-att-statement | intern-att-statement | 20ms |

### Fees

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load fee filter options | — | 23ms |
| ✅ | Read | Load pending SMS classes | fee-pending-sms | 15ms |
| ✅ | Read | Load pending letter form | fee-pending-letter | 21ms |
| ✅ | Read | Load scholarship setup | fee-scholarship | 57ms |
| ✅ | Read | Load DME setup | fee-dme | 13ms |
| ✅ | Read | Load ACMEC config | fee-acmec-config | 26ms |
| ✅ | Read | Load setup: label | label | 26ms |
| ✅ | Read | Load setup: type | type | 17ms |
| ✅ | Read | Load setup: bank | bank | 15ms |
| ✅ | Read | Load setup: fine | fine | 20ms |
| ✅ | Read | Load setup: name | name | 92ms |

### Academic

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: subject-master | subject-master | 20ms |
| ✅ | Read | Load setup: academic-years | academic-years | 31ms |
| ✅ | Read | Load setup: master-setup | master-setup | 12ms |
| ✅ | Read | Load setup: subject-setup | subject-setup | 68ms |
| ✅ | Read | Load setup: subject-batch | subject-batch | 27ms |
| ✅ | Read | Load setup: subject-unit | subject-unit | 27ms |
| ✅ | Read | Load setup: subject-schedule | subject-schedule | 21ms |
| ✅ | Read | Load setup: tt-config | tt-config | 19ms |
| ✅ | Read | Load setup: subject-report | subject-report | 20ms |
| ✅ | Read | Load setup: timetable-report | timetable-report | 10ms |
| ✅ | Read | Load setup: batch-timetable-report | batch-timetable-report | 145ms |
| ✅ | Read | Load setup: batch-color | batch-color | 18ms |
| ✅ | Read | Load setup: feedback-topics | feedback-topics | 18ms |
| ✅ | Read | Load setup: period-setup | period-setup | 18ms |
| ✅ | Read | Load setup: internship-schedule | internship-schedule | 40ms |
| ✅ | Read | Load setup: feedback-config-ug | feedback-config-ug | 22ms |
| ✅ | Read | Load setup: feedback-config-pg | feedback-config-pg | 23ms |
| ✅ | Read | Load setup: tt-config-v3 | tt-config-v3 | 24ms |
| ✅ | Read | Load setup: subject-dashboard | subject-dashboard | 17ms |
| ✅ | Read | Load setup: subject-schedule-report | subject-schedule-report | 24ms |
| ✅ | Read | Load setup: subject-timing | subject-timing | 27ms |
| ✅ | Read | Load setup: feedback-dashboard | feedback-dashboard | 30ms |
| ✅ | Read | Load setup: class-timetable | class-timetable | 21ms |
| ✅ | Read | Load setup: class-timetable-v3 | class-timetable-v3 | 27ms |
| ✅ | Read | Load setup: feedback-report-ug | feedback-report-ug | 29ms |
| ✅ | Read | Load setup: feedback-report-pg | feedback-report-pg | 20ms |
| ✅ | Read | Load setup: subject-handle | subject-handle | 19ms |
| ✅ | Read | Load setup: staff-period-completed | staff-period-completed | 813ms |
| ✅ | Read | Load setup: department-period-completed | department-period-completed | 38ms |
| ✅ | Read | Load setup: subject-handle-grid | subject-handle-grid | 34ms |

### Exam

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load exam dashboard | exam-dashboard | 13ms |
| ✅ | Read | Load setup: exam-names | exam-names | 24ms |
| ✅ | Read | Load setup: exam-setup | exam-setup | 37ms |
| ✅ | Read | Load setup: exam-nodue | exam-nodue | 41ms |
| ✅ | Read | Load setup: exam-schedule | exam-schedule | 44ms |
| ✅ | Read | Load setup: exam-batch | exam-batch | 24ms |
| ✅ | Read | Load setup: mark-sheet | mark-sheet | 36ms |
| ✅ | Read | Load setup: exam-examiners | exam-examiners | 32ms |
| ✅ | Read | Load setup: exam-attendance-certificate | exam-attendance-certificate | 39ms |
| ✅ | Read | Load setup: examiner-setup | examiner-setup | 29ms |
| ✅ | Read | Load setup: mark-entry | mark-entry | 53ms |
| ✅ | Read | Load setup: attendance-entry | attendance-entry | 119ms |
| ✅ | Read | Load setup: attendance-report | attendance-report | 52ms |
| ✅ | Read | Load setup: marks-upload | marks-upload | 18ms |
| ✅ | Read | Load setup: sheets-upload | sheets-upload | 14ms |
| ✅ | Read | Load setup: sheets-status | sheets-status | 40ms |
| ✅ | Read | Load setup: mark-sheet-status | mark-sheet-status | 41ms |
| ✅ | Read | Load setup: mark-sheet-received | mark-sheet-received | 47ms |
| ✅ | Read | Load setup: term-statement | term-statement | 118ms |
| ✅ | Read | Load setup: term-report | term-report | 141ms |
| ✅ | Read | Load setup: report-analysis | report-analysis | 118ms |
| ✅ | Read | Load setup: progress-card | progress-card | 121ms |
| ✅ | Read | Load setup: exam-sms | exam-sms | 38ms |
| ✅ | Read | Load setup: schedule-print | schedule-print | 129ms |
| ✅ | Read | Load setup: invigilator-print | invigilator-print | 140ms |
| ✅ | Read | Load setup: omr-config | omr-config | 23ms |
| ⏭️ | Update | Save examiner setup (first batch type) | examiner-setup | Set TEST_MUTATIONS=1 to run create/update/delete tests |

### Payroll

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: individual-setup | individual-setup | 20ms |
| ✅ | Read | Load setup: cron-setup | cron-setup | 26ms |
| ✅ | Read | Load setup: stipend-amount-setup | stipend-amount-setup | 20ms |
| ✅ | Read | Load setup: payroll-config | payroll-config | 23ms |
| ✅ | Read | Load setup: pf-esi-setup | pf-esi-setup | 29ms |
| ✅ | Read | Load setup: salary-add | salary-add | 107ms |
| ✅ | Read | Load setup: salary-report | salary-report | 4906ms |
| ✅ | Read | Load setup: payroll-close | payroll-close | 58ms |
| ✅ | Read | Generate payroll report | generate-payroll | 206ms |
| ✅ | Read | Payroll attendance report | payroll-att-report | 51ms |
| ✅ | Read | Payroll monthly report | payroll-monthly-report | 69ms |
| ✅ | Read | Payroll tax report | payroll-tax-report | 30ms |
| ✅ | Read | Stipend generate payroll | stipend-generate | 294ms |
| ✅ | Read | Stipend attendance report | stipend-att-report | 11ms |
| ⏭️ | Update | Update PF/ESI setup slab | pf-esi-setup | Set TEST_MUTATIONS=1 to run create/update/delete tests |
| ⏭️ | Update | Update payroll group setup | payroll-config | Set TEST_MUTATIONS=1 to run create/update/delete tests |
| ✅ | Read | Search staff on salary setup | salary-add | 132ms |
| ✅ | Read | Load salary advance add form | salary-advance-add | 262ms |
| ✅ | Read | Load salary arrear add form | salary-arrear-add | 14ms |
| ✅ | Read | Load salary arrear release list | salary-arrear-release | 55ms |
| ✅ | Read | Load salary advance close list | salary-advance-close | 79ms |
| ✅ | Read | Load security deposit add form | security-deposit-add | 52ms |
| ✅ | Read | Load security deposit close list | security-deposit-close | 25ms |

### Hostel

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: dashboard | dashboard | 1650ms |
| ✅ | Read | Load setup: block-setup | block-setup | 8ms |
| ✅ | Read | Load setup: room-setup-add | room-setup-add | 8ms |
| ✅ | Read | Load setup: room-rental-setup | room-rental-setup | 8ms |
| ✅ | Save | Save setup: transport-add | transport-add | contact_number column fixed (`transport_add.php`) |
| ✅ | Read | Load setup: student-hostel | student-hostel | 10ms |
| ✅ | Read | Load setup: att-setup | att-setup | 6ms |
| ✅ | Read | Load setup: attendance-report | attendance-report | 5ms |
| ✅ | Read | Load setup: pass-approval | pass-approval | 222ms |
| ✅ | Read | Load setup: pass-report | pass-report | 26ms |
| ✅ | Read | Load setup: staff-rental | staff-rental | 86ms |

### Library

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: dashboard | dashboard | 610ms |
| ✅ | Read | Load setup: book-category | book-category | 9ms |
| ✅ | Save | Save setup: book-add | book-add | billdate required field fixed (`library_book_add.php`) |
| ✅ | Read | Load setup: book-report | book-report | 22ms |
| ✅ | Read | Load setup: transaction-issue | transaction-issue | 11ms |
| ✅ | Read | Load setup: transaction-return | transaction-return | 9ms |
| ✅ | Read | Load setup: transaction-setup | transaction-setup | 9ms |
| ✅ | Read | Load setup: transaction-report | transaction-report | 7ms |
| ✅ | Read | Load setup: entry-report | entry-report | Daily summary rows fixed (`library_entry_report.php`) |
| ✅ | Read | Load setup: attendance | attendance | 1160ms |
| ✅ | Read | Load setup: supplier-add | supplier-add | 10ms |
| ✅ | Read | Load setup: resources-report | resources-report | 11ms |

### Admin

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: account-add | account-add | 8ms |
| ✅ | Read | Load setup: account-edit | account-edit | 12ms |
| ✅ | Read | Load setup: access-restriction | access-restriction | 14ms |
| ✅ | Read | Load setup: dept-auth | dept-auth | 24ms |
| ✅ | Read | Load setup: menu-auth | menu-auth | 127ms |
| ✅ | Read | Load setup: dashboard-access | dashboard-access | 26ms |
| ✅ | Read | Load setup: change-password | change-password | 12ms |
| ✅ | Read | Load setup: committee-access | committee-access | 18ms |
| ✅ | Read | Load setup: staff-auth-hod | staff-auth-hod | 17ms |

### Settings

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: designation | designation | 13ms |
| ✅ | Read | Load setup: staff-master | staff-master | 9ms |
| ✅ | Read | Load setup: approval | approval | 10ms |
| ✅ | Read | Load setup: college | college | 13ms |
| ✅ | Read | Load setup: hospital | hospital | 10ms |
| ✅ | Read | Load setup: budget | budget | 10ms |
| ✅ | Read | Load setup: print-setup | print-setup | 26ms |
| ✅ | Read | Load setup: print-style | print-style | 9ms |
| ✅ | Read | Load setup: lesson-plan | lesson-plan | 8ms |
| ✅ | Read | Load setup: signature | signature | 7ms |
| ✅ | Read | Load setup: payroll-emailer | payroll-emailer | 11ms |
| ✅ | Read | Load setup: sms-cron | sms-cron | 15ms |

### Web

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: about-us | about-us | 12ms |
| ✅ | Read | Load setup: departments | departments | 8ms |
| ✅ | Read | Load setup: lms | lms | 10ms |
| ✅ | Read | Load setup: journal | journal | 9ms |
| ✅ | Read | Load setup: facilities | facilities | 9ms |
| ✅ | Read | Load setup: aaadar | aaadar | 12ms |
| ✅ | Read | Load setup: research | research | 9ms |
| ✅ | Read | Load setup: academic | academic | 9ms |
| ✅ | Read | Load setup: iqac | iqac | 9ms |
| ✅ | Read | Load setup: outreach | outreach | 9ms |
| ✅ | Read | Load setup: slider-animation | slider-animation | 9ms |
| ✅ | Read | Load setup: staff-display-order | staff-display-order | 9ms |
| ✅ | Read | Load setup: photos-add | photos-add | 8ms |
| ✅ | Read | Load setup: photos-edit | photos-edit | 8ms |
| ✅ | Read | Load setup: doc-upload | doc-upload | 7ms |
| ✅ | Read | Load setup: research-program-add | research-program-add | 14ms |
| ✅ | Read | Load setup: research-program-edit | research-program-edit | 7ms |
| ✅ | Read | Load setup: event-add | event-add | 8ms |
| ✅ | Read | Load setup: event-edit | event-edit | 18ms |
| ✅ | Read | Load setup: event-type | event-type | 13ms |

### Elearning

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: elearn-dashboard | elearn-dashboard | 9ms |
| ✅ | Read | Load setup: elearn-setup | elearn-setup | 8ms |
| ✅ | Read | Load setup: elearn-report | elearn-report | 10ms |

### Portfolio

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load portfolio dashboard | portfolio-dashboard | 13ms |
| ✅ | Read | Load portfolio individual report | portfolio-individual | 9ms |

### Sms

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: student-sms | student-sms | 11ms |
| ✅ | Read | Load setup: staff-sms | staff-sms | 9ms |
| ✅ | Read | Load setup: group-sms | group-sms | 10ms |
| ✅ | Read | Load setup: sms-history | sms-history | 104ms |
| ✅ | Read | Load setup: sms-template | sms-template | 9ms |

### Committee

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: dashboard | dashboard | 17ms |
| ✅ | Read | Load setup: committee-report | committee-report | 8ms |
| ✅ | Read | Load setup: committee-add | committee-add | 7ms |
| ✅ | Read | Load setup: task-dashboard | task-dashboard | 9ms |

### Certificate

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: setup | setup | 8ms |
| ✅ | Read | Load setup: approve | approve | 71ms |
| ✅ | Read | Load setup: generate | generate | 7ms |
| ✅ | Read | Load setup: cert-request | cert-request | 8ms |
| ✅ | Read | Load setup: tc-details | tc-details | 8ms |

### Circular

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: dashboard | dashboard | 31ms |
| ✅ | Read | Load setup: add | add | 19ms |
| ✅ | Read | Load setup: edit | edit | 19ms |
| ✅ | Read | Load setup: approve | approve | 13ms |
| ✅ | Read | Load setup: report | report | 13ms |
| ✅ | Read | Load setup: setup | setup | 8ms |

### Naac

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: qual | qual | 13ms |
| ✅ | Read | Load setup: quan | quan | 15ms |
| ✅ | Read | Load setup: quan-report | quan-report | 40ms |
| ✅ | Read | Load setup: quan-detailed-report | quan-detailed-report | 55ms |

### AdminOffice

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: student-activities-add | student-activities-add | 9ms |
| ✅ | Read | Load setup: staff-activities-add | staff-activities-add | 13ms |
| ✅ | Read | Load setup: courier-add | courier-add | 24ms |
| ✅ | Read | Load setup: incident-add | incident-add | 11ms |
| ✅ | Read | Load setup: events-group-add | events-group-add | 6ms |

### Tv

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: slider-widget | slider-widget | 27ms |
| ✅ | Read | Load setup: dashboard-access | dashboard-access | 13ms |
| ✅ | Read | Load setup: photo-gallery | photo-gallery | 9ms |

### Kiosk

| Status | Op | Test | Screen | Notes |
|--------|----|------|--------|-------|
| ✅ | Read | Load setup: machine-access | machine-access | 12ms |
| ✅ | Read | Load setup: student-password | student-password | 9ms |
| ✅ | Read | Load setup: staff-password | staff-password | 10ms |
| ✅ | Read | Load setup: announcement-add | announcement-add | 6ms |

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

