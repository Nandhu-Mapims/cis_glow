# CIS Top Navigation — Full Menu Structure

Source: `admin_menu_category_tb` + `basic_admin_menu_tb` (`del=1`, `menu_enable=1`).

**Totals:** 25 categories · 260 main menus · 390 screens

## Pattern

```text
Top group ▾
  └── Category ▸          (inner dropdown)
        └── Main menu
              └── Sub menu (screen link)
```

## Nested behavior

1. Click top group → panel opens with categories.
2. Hover/click category → flyout shows main menus / screens.
3. Click screen → navigate (same `legacyRoutes` / `/api/menu` links).
4. Mobile: accordion instead of flyout.

## Notes

- Grouping is client-side only; `/api/menu` auth/filtering unchanged.
- Categories with no permitted items are hidden.
- Search / command palette keep flattening all screens.

---

## Full menu tree

```text
Dashboard ▾
│   └── Dashboard ▸
│       ├── Dashboard
│       │   └── Dashboard  →  dashboard_task.php
│       ├── Student Dashboard
│       │   └── Student Dashboard  →  dashboard_student.php
│       ├── Overall Strength
│       │   └── Overall Strength  →  student_strength_overall.php
│       ├── Community Strength
│       │   └── Community Strength  →  student_community_strength.php
│       ├── Log Dashboard
│       │   └── Log Dashboard  →  log_dashboard.php
│       └── Staff Pattern
│           └── Staff Pattern  →  dashboard_v5.php

Academics ▾
│   ├── Student ▸
│   │   ├── Student Profile
│   │   │   ├── New Profile  →  student_profile_add.php
│   │   │   └── Edit Profile  →  student_profile_edit.php
│   │   ├── Student Admission
│   │   │   ├── Add  →  student_profile_temp_add.php
│   │   │   ├── Edit  →  student_profile_temp_edit.php
│   │   │   └── Print  →  student_profile_temp_affidavit.php
│   │   ├── Academic Promotion
│   │   │   └── Academic Promotion  →  student_academic.php
│   │   ├── Attachments
│   │   │   ├── Upload  →  student_attachments.php
│   │   │   ├── View  →  student_attachments_view.php
│   │   │   └── Report  →  student_attachments_report.php
│   │   ├── Student ID Card
│   │   │   ├── ID Card  →  student_id_card.php
│   │   │   ├── Empty  →  student_photo_empty.php
│   │   │   └── Upload Photo  →  student_photo_upload.php
│   │   ├── Promotion
│   │   │   └── Promotion  →  student_promote.php
│   │   ├── Student Report
│   │   │   └── Student Report  →  student_profile_export.php
│   │   ├── Address Label
│   │   │   └── Address Label  →  student_address.php
│   │   ├── Alumni Registration
│   │   │   └── Alumni Registration  →  alumni_registration.php
│   │   ├── Alumni Profile
│   │   │   ├── Alumni Profile Edit  →  alumni_profile_edit.php
│   │   │   ├── Alumni Report  →  alumni_report.php
│   │   │   └── Alumni ID Card  →  alumni_id_card.php
│   │   └── Student/Staff Image
│   │       ├── Generate  →  colage_generate.php
│   │       └── Image  →  colage_image.php
│   ├── Curriculum ▸
│   │   ├── Subject Dashboard
│   │   │   └── Subject Dashboard  →  subject_dashboard.php
│   │   ├── Subject
│   │   │   ├── Subject  →  subject_setup.php
│   │   │   └── Report  →  subject_report.php
│   │   ├── Subject Batch
│   │   │   └── Subject Batch  →  subject_batch.php
│   │   ├── Unit Setup
│   │   │   └── Unit Setup  →  subject_unit_setup_v2.php
│   │   ├── Period Setup
│   │   │   └── Period Setup  →  period_setup.php
│   │   ├── Room No. Device Config
│   │   │   ├── Add  →  machine_room_add.php
│   │   │   └── Edit  →  machine_room_edit.php
│   │   ├── Time Table
│   │   │   ├── Report  →  class_time_table.php
│   │   │   └── Config  →  tt_config.php
│   │   ├── Time Table new
│   │   │   ├── Report  →  class_time_table_v3.php
│   │   │   └── Config  →  tt_config_v3.php
│   │   ├── Class TT Sch Report
│   │   │   └── Class TT Sch Report  →  timetable_class_report.php
│   │   ├── Subject Schedule
│   │   │   ├── Config  →  subject_schedule.php
│   │   │   └── Status  →  subject_schedule_report.php
│   │   ├── Internship Schedule
│   │   │   └── Internship Schedule  →  internship_schedule.php
│   │   ├── Batch Color
│   │   │   └── Batch Color  →  batch_color_setup.php
│   │   ├── Feed Back
│   │   │   ├── Setup-UG  →  feedback_config.php
│   │   │   ├── Setup-PG  →  feedback_config_pg.php
│   │   │   ├── Status  →  feedback_dashboard.php
│   │   │   ├── Report-UG  →  feedback_report.php
│   │   │   ├── Topic  →  feedback_topic.php
│   │   │   └── Report-PG  →  feedback_report_pg.php
│   │   ├── Subject Timing
│   │   │   └── Subject Timing  →  subject_timing.php
│   │   ├── Period Completed (Class)
│   │   │   └── Period Completed (Class)  →  subject_handle.php
│   │   ├── Period Completed (Staff)
│   │   │   └── Period Completed (Staff)  →  staff_period_completed.php
│   │   ├── Period Completed (Dept.)
│   │   │   └── Period Completed (Dept.)  →  department_period_completed.php
│   │   └── Subject Attendance (Staff)
│   │       └── Subject Attendance (Staff)  →  subject_handle1.php
│   ├── Student Portfolia ▸
│   │   ├── Portfolia Dashboard
│   │   │   └── Portfolia Dashboard  →  student_portfolio_dashboard.php
│   │   └── Portfolia Report
│   │       └── Portfolia Report  →  student_portfolia_individual_report.php
│   ├── Student Att ▸
│   │   ├── Biometric Reports
│   │   │   └── Biometric Reports  →  student_bio_att.php
│   │   ├── Working Day Configuration
│   │   │   ├── Config  →  academic_calendar.php
│   │   │   └── Report  →  holiday_report.php
│   │   ├── SMR Approval
│   │   │   ├── Leave Request  →  stu_leave_approval.php
│   │   │   ├── Dept. Leave Request  →  student_leave_approval.php
│   │   │   ├── Permission  →  stu_permission_approval.php
│   │   │   ├── Defaulter  →  stu_defaulter_approval.php
│   │   │   ├── Report  →  student_lpd_report.php
│   │   │   └── Setup  →  stu_leave_approval_setup.php
│   │   ├── U.G Manual Att.
│   │   │   └── U.G Manual Att.  →  student_mattendance.php
│   │   ├── U.G Reports Att
│   │   │   └── U.G Reports Att  →  attendance_report.php
│   │   ├── Student Quarterly Att. Report
│   │   │   └── UG Quarterly Att. Report  →  attendance_report_quartely_v1.php
│   │   ├── PG Att. Setup
│   │   │   └── PG Att. Setup  →  pg_attendance_setup.php
│   │   ├── P.G Holiday Roster
│   │   │   ├── Edit  →  pg_holiday_roster_edit.php
│   │   │   └── Add  →  pg_holiday_roster_add.php
│   │   ├── P.G Manual Att.
│   │   │   └── P.G Manual Att.  →  pg_mattendance.php
│   │   ├── P.G Reports Att
│   │   │   └── P.G Reports Att  →  pg_attendance_report.php
│   │   ├── P.G Attendance Punch
│   │   │   ├── P.G Attendance Punch  →  pg_attendance_punch.php
│   │   │   └── Entry  →  pg_attendance_punch_add.php
│   │   ├── UG/PG Year Incharge
│   │   │   └── UG/PG Year Incharge  →  staff_incharge_setup.php
│   │   ├── UG Attendance Report
│   │   │   └── UG Attendance Report  →  attendance_ug_report.php
│   │   ├── Internship Att. Setup
│   │   │   └── Internship Att. Setup  →  intern_att_setup.php
│   │   ├── Internship Holiday Roster
│   │   │   ├── Edit  →  intern_holiday_roster_edit.php
│   │   │   └── Add  →  intern_holiday_roster_add.php
│   │   ├── Internship Manual Att.
│   │   │   └── Internship Manual Att.  →  intern_mattendance.php
│   │   ├── Internship Reports Att
│   │   │   └── Internship Reports Att  →  istudent_att_report.php
│   │   └── Intern Att. Statement
│   │       └── Intern Att. Statement  →  istudent_att_card.php
│   ├── Exam ▸
│   │   ├── Exam Dashboard
│   │   │   └── Exam Dashboard  →  exam_dashboard.php
│   │   ├── Create Exam
│   │   │   ├── Exam  →  term_exam_setup.php
│   │   │   └── Name  →  exam_name_config.php
│   │   ├── Exam Schedule
│   │   │   ├── Schedule  →  term_exam_schedule.php
│   │   │   ├── Schedule Print  →  term_exam_sch_print.php
│   │   │   └── Inviligation Schedule Print  →  term_exam_Inviliga_sch_print.php
│   │   ├── Exam No-Due
│   │   │   └── Exam No-Due  →  term_exam_nodue.php
│   │   ├── Exam Batch
│   │   │   └── Exam Batch  →  exam_batch.php
│   │   ├── QR Code Register
│   │   │   └── QR Code Register  →  term_mark_sheet.php
│   │   ├── Examiner Details
│   │   │   ├── Examiners  →  term_exam_examiners.php
│   │   │   ├── Attn Cert  →  term_exam_att_certificate.php
│   │   │   └── Setup  →  term_examiner_setup.php
│   │   ├── Camp Activity
│   │   │   ├── Add  →  camp_activity_add.php
│   │   │   ├── Edit  →  camp_activity_edit.php
│   │   │   └── Type  →  camp_activity_type.php
│   │   ├── Mark Manual Entry
│   │   │   └── Mark Manual Entry  →  term_mark_entry.php
│   │   ├── Attendance Percentage
│   │   │   ├── Add  →  term_attendance_entry.php
│   │   │   └── Report  →  term_attendance_report.php
│   │   ├── OMR Sheets Upload
│   │   │   ├── Sheets Upload  →  term_marks_upload.php
│   │   │   ├── Sheets Upload (Multiple)  →  term_sheets_upload.php
│   │   │   ├── Sheets Uploaded Status  →  term_sheets_status.php
│   │   │   ├── Sheets Completed Status  →  term_mark_sheet_status.php
│   │   │   └── Sheet Received Status  →  term_mark_sheet_received.php
│   │   ├── Statement of Marks
│   │   │   └── Statement of Marks  →  term_report_statement.php
│   │   ├── Reports
│   │   │   └── Reports  →  term_report.php
│   │   ├── Marks Analysis
│   │   │   └── Marks Analysis  →  term_report_analysis_v1.php
│   │   ├── Progress Card
│   │   │   └── Progress Card  →  term_progress_card.php
│   │   ├── Send SMS
│   │   │   └── Send SMS  →  exam_sms.php
│   │   └── Sheet Config
│   │       └── Sheet Config  →  omr_style_config.php
│   └── E-Learning ▸
│       ├── E-Learning
│       │   └── Dashboard  →  elearn_dashboard.php
│       └── E-Learning Report
│           ├── Report  →  elearn_report.php
│           └── Setup  →  elearn_setup.php

Finance ▾
│   ├── Fee ▸
│   │   ├── Fee Dashboard
│   │   │   └── Fee Dashboard  →  fee_dashboard_v2.php
│   │   ├── Hostel Attendance
│   │   │   └── Hostel Attendance  →  hostel_attendance_report.php
│   │   ├── Fee Challan
│   │   │   └── Fee Challan  →  student_fee_slip_new.php
│   │   ├── Fee Approve
│   │   │   ├── Add  →  student_fee_add_new.php
│   │   │   └── Delete  →  student_fee_delete.php
│   │   ├── Fee Report
│   │   │   └── Fee Report  →  student_fee_report.php
│   │   ├── Bank Accounts
│   │   │   └── Bank Accounts  →  fee_bank_config.php
│   │   ├── Account Heads
│   │   │   └── Account Heads  →  fee_type_config.php
│   │   ├── Fee Category
│   │   │   └── Fee Category  →  fee_label_config.php
│   │   ├── Fee Configuration
│   │   │   └── Fee Configuration  →  fee_name_config.php
│   │   ├── Fine Configuration
│   │   │   └── Fine Configuration  →  fee_fine_config.php
│   │   ├── Fee Scholarship
│   │   │   └── Fee Scholarship  →  fee_scholarship_received.php
│   │   ├── DME Fee Approve
│   │   │   └── DME Fee Approve  →  dme_fee_approve.php
│   │   ├── ACMEC Scholarship
│   │   │   ├── Approved  →  acmec_fee_scholarship.php
│   │   │   └── Entry  →  student_acmec_config.php
│   │   ├── Fee Pending SMS 
│   │   │   └── SMS  →  fee_pending_sms.php
│   │   └── Fee Pending Letter
│   │       └── Letter  →  fee_pending_sms_v1.php
│   ├── Stipend Payroll ▸
│   │   ├── Stipend Generate Payroll Att.
│   │   │   └── Stipend Generate Payroll Att.  →  stipend_generate_payroll.php
│   │   ├── Stipend Payroll Att.Report
│   │   │   └── Stipend Payroll Att.Report  →  stipend_payroll_att_report.php
│   │   ├── Stipend Salary Setup
│   │   │   └── Stipend Salary Setup  →  stipend_amount_setup.php
│   │   ├── Stipend Other Deductions
│   │   │   └── Stipend Other Deductions  →  stipend_deduction_add.php
│   │   ├── Stipend Payroll Statement
│   │   │   └── Stipend Payroll Statement  →  stipend_salary_statement.php
│   │   ├── Stipend Payroll Report
│   │   │   └── Stipend Payroll Report  →  stipend_payroll_report.php
│   │   ├── Stipend Payroll Con. Report
│   │   │   ├── Report  →  stipend_payroll_individual_report1.php
│   │   │   └── PDF  →  stipend_payroll_individual_report3.php
│   │   └── Stipend payroll Close
│   │       └── Stipend payroll Close  →  stipend_payroll_close.php
│   └── Payroll ▸
│       ├── Payroll Dashboard
│       │   └── Payroll Dashboard  →  payroll_dashboard.php
│       ├── Payroll Setup
│       │   └── Payroll  →  staff_payroll_setup.php
│       ├── PF/ESI Setup
│       │   └── PF/ESI  →  staff_pfesi_setup.php
│       ├── Salary Setup
│       │   ├── Add  →  staff_salary_setup.php
│       │   └── Report  →  staff_salary_report.php
│       ├── Salary Advance
│       │   ├── Add  →  salary_advance_add.php
│       │   └── Close  →  salary_advance_edit.php
│       ├── Salary Arrears
│       │   ├── Add  →  salary_arrear_add.php
│       │   └── Release  →  salary_arrear_edit.php
│       ├── Other Deductions
│       │   └── Other Deductions  →  staff_deduction_add.php
│       ├── LOP Deduction
│       │   └── LOP Deduction  →  staff_lop_deduction.php
│       ├── Salary TDS
│       │   └── Salary TDS  →  staff_tds_add.php
│       ├── Cheque Payment
│       │   └── Cheque Payment  →  staff_cheque_add.php
│       ├── Security Deposit
│       │   ├── Add  →  security_deposit_deduction_add.php
│       │   └── Close  →  security_deposit_deduction_close.php
│       ├── Generate Payroll Att.
│       │   └── Generate Payroll Att.  →  generate_payroll.php
│       ├── Payroll Att. Report
│       │   └── Payroll Att. Report  →  payroll_report.php
│       ├── Payroll Statement
│       │   └── Payroll Statement  →  salary_statement.php
│       ├── Salary Summary
│       │   └── Salary Summary  →  salary_summary.php
│       ├── Payroll Report
│       │   ├── Month  →  payroll_individual_report.php
│       │   └── Group  →  payroll_group_report.php
│       ├── Payroll Consolidate Report
│       │   ├── PDF  →  payroll_individual_report3.php
│       │   ├── HTML  →  payroll_individual_report1.php
│       │   └── Setup  →  payroll_individual_setup.php
│       ├── Tax Report
│       │   └── Tax Report  →  staff_tax_report.php
│       ├── Monthly Report
│       │   └── Monthly Report  →  payroll_monthly_report.php
│       └── Payroll Close
│           └── Payroll Close  →  payroll_close.php

Staff ▾
│   ├── Staff ▸
│   │   ├── Staff Profile
│   │   │   ├── New Profile  →  staff_profile_add.php
│   │   │   ├── Edit Profile  →  staff_profile_edit.php
│   │   │   ├── Appointment Order  →  staff_appoint_order.php
│   │   │   └── Salary Note  →  staff_salary_note.php
│   │   ├── Designation
│   │   │   └── Designation  →  staff_designation_edit.php
│   │   ├── Staff Report
│   │   │   └── Staff Report  →  staff_profile_export.php
│   │   ├── ID Card
│   │   │   ├── ID Card  →  staff_id_card.php
│   │   │   ├── Empty  →  staff_photo_empty.php
│   │   │   └── Upload Photo  →  staff_photo_upload.php
│   │   ├── Org. Chart Config
│   │   │   └── Org. Chart Config  →  org_chart_config.php
│   │   ├── Org. Chart 
│   │   │   └── Org. Chart  →  org_structure.php
│   │   ├── Staff Transport
│   │   │   └── Staff Transport  →  staff_transport.php
│   │   ├── Attachment Config
│   │   │   ├── Category  →  staff_attachment_category.php
│   │   │   ├── Attachments Title  →  staff_attachment_scategory.php
│   │   │   └── Setup  →  staff_attachment_setup.php
│   │   ├── Staff Certificates
│   │   │   └── Staff Certificates  →  staff_attachments.php
│   │   ├── Staff Quarters/Hostel
│   │   │   └── Staff Quarters/Hostel  →  staff_rental_hostel.php
│   │   ├── Staff Photos
│   │   │   └── Staff Photos  →  staff_photos.php
│   │   ├── Staff Login Help
│   │   │   └── Staff Login Help  →  staff_help.php
│   │   ├── Inspection
│   │   │   ├── Create  →  inspection_config.php
│   │   │   ├── Inspector Details  →  inspection_details.php
│   │   │   ├── Attn. Sheet  →  staff_attendance_sign_with_photo.php
│   │   │   ├── Attn. Cert Print  →  inspection_attn_certificate.php
│   │   │   └── Name Setup  →  inspection_name.php
│   │   ├── Staff DCI Report
│   │   │   └── Staff DCI Report  →  staff_dci_report.php
│   │   ├── Staff TnMGR Report
│   │   │   └── Staff TnMGR Report  →  staff_tnmgr_report.php
│   │   ├── Staff Affidavit
│   │   │   ├── DCI  →  staff_affidavit_dci.php
│   │   │   ├── TnMGRmu  →  staff_affidavit_TNMGRMU.php
│   │   │   └── Print Attachments  →  staff_attach_print.php
│   │   ├── Staff Publication Report
│   │   │   ├── DCI  →  dci_staff_publication_report.php
│   │   │   └── TnMGRmu  →  tnmgrmu_staff_publication_report.php
│   │   └── Staff Transport Setup
│   │       └── Staff Transport Setup  →  staff_transport_setup.php
│   └── Staff Att. ▸
│       ├── Daily Attendance
│       │   └── Daily Attendance  →  staff_daily_attendance.php
│       ├── Biomertic Reports
│       │   └── Biomertic Reports  →  biomertic_att.php
│       ├── Manual Attendance
│       │   ├── Add  →  staff_calendar_add.php
│       │   └── Edit  →  staff_calendar_edit.php
│       ├── SMR Acknowledge
│       │   └── SMR Acknowledge  →  staff_leave_acknowledge.php
│       ├── SMR LApproval
│       │   ├── Leave  →  staff_leave_approve.php
│       │   ├── Permission  →  staff_permission_approve.php
│       │   ├── Defaulter  →  staff_defaulter_approve.php
│       │   └── Report  →  staff_lpd_report.php
│       ├── Holiday Roster
│       │   └── Holiday Roster  →  staff_holiday_roster.php
│       ├── Compensation
│       │   └── Compensation  →  staff_compensation.php
│       ├── Reports Att.
│       │   └── Reports Att.  →  staff_attendance_report.php
│       ├── Reports Month
│       │   └── Reports Month  →  teaching_staff_att_report.php
│       ├── Reports Year
│       │   └── Reports Year  →  staff_yearly_report.php
│       ├── Individual Calendar
│       │   ├── Calendar  →  individual_calendar.php
│       │   └── Clear Cache  →  clear_icache.php
│       ├── Att.Chart
│       │   ├── Actual  →  staff_att_chart.php
│       │   ├── Modified  →  staff_att_chart_modified.php
│       │   └── Combined  →  staff_att_chart_combine.php
│       ├── Working Day Setup
│       │   └── Working Day Setup  →  staff_academic_calendar.php
│       ├── Time Schedule
│       │   ├── Att. Time  →  staff_att_time.php
│       │   └── Report  →  staff_att_time_report.php
│       ├── Available CL
│       │   └── Available CL  →  staff_cl_el.php
│       ├── Staff Att. Transport
│       │   └── Staff Att. Transport  →  staff_att_transport.php
│       ├── Attendance Report
│       │   └── Attendance Report  →  staff_att_report.php
│       └── Available Leave 
│           └── Available Leave  →  available_leave.php

Campus ▾
│   ├── Library ▸
│   │   ├── Library Dashboard
│   │   │   └── Library Dashboard  →  dashboard_library.php
│   │   ├── Library Att. Report
│   │   │   └── Library Att. Report  →  lib_attendance_report.php
│   │   ├── Daily Summary
│   │   │   └── Daily Summary  →  library_entry_report.php
│   │   ├── Resources
│   │   │   ├── Resources Add  →  library_book_add.php
│   │   │   ├── Resources Edit  →  library_book_edit.php
│   │   │   └── Report  →  library_book_report.php
│   │   ├── Category
│   │   │   └── Category  →  library_book_cate.php
│   │   ├── Supplier
│   │   │   ├── Add  →  supplier_add.php
│   │   │   └── Edit  →  supplier_edit.php
│   │   ├── OPAC
│   │   │   └── OPAC  →  resources_report.php
│   │   ├── Transfer
│   │   │   └── Transfer  →  resource_transfer.php
│   │   ├── Book Issue
│   │   │   └── Book Issue  →  library_transaction1.php
│   │   ├── Book Return
│   │   │   └── Book Return  →  library_transaction.php
│   │   ├── Limit Setup
│   │   │   └── Limit Setup  →  transaction_setup.php
│   │   ├── Transactions Report
│   │   │   └── Transactions Report  →  transaction_report.php
│   │   └── Barcode
│   │       └── Barcode  →  resources_barcode.php
│   ├── Hostel ▸
│   │   ├── Blocks
│   │   │   └── Blocks  →  block_setup.php
│   │   ├── Rooms
│   │   │   ├── Add  →  room_setup_add.php
│   │   │   └── Edit  →  room_setup_edit.php
│   │   ├── Rental Config
│   │   │   └── Rental Config  →  room_rental_setup.php
│   │   ├── Transport
│   │   │   ├── Transport Add  →  transport_add.php
│   │   │   ├── Transport Edit  →  transport_edit.php
│   │   │   ├── Stopping Setup  →  transport_stopping_setup.php
│   │   │   └── Trans. Fee Config  →  transport_fee_config.php
│   │   ├── Hostel
│   │   │   └── Hostel  →  student_hostel.php
│   │   ├── Pass Approval
│   │   │   ├── Approve / Reject  →  hostel_pass_approval.php
│   │   │   └── Hostel Pass Report  →  hostel_student_report.php
│   │   └── Hostel Att. Setup
│   │       └── Hostel Att. Setup  →  hostel_att_setup.php
│   └── Circular ▸
│       ├── Circular
│       │   ├── Add  →  circular_add.php
│       │   ├── Edit  →  circular_edit.php
│       │   ├── Approve  →  circular_approve.php
│       │   └── Setup  →  circular_setup.php
│       └── Circular Print
│           ├── Student  →  circular_print_student.php
│           ├── Staff  →  circular_print_staff.php
│           └── Department  →  circular_print_department.php

Admin ▾
│   ├── Admin Office ▸
│   │   ├── Student
│   │   │   ├── Add  →  student_activities_add.php
│   │   │   └── Edit  →  student_activities_edit.php
│   │   ├── Staff
│   │   │   ├── Add  →  staff_activities_add.php
│   │   │   └── Edit  →  staff_activities_edit.php
│   │   ├── Courier
│   │   │   ├── Courier Add  →  courier_add.php
│   │   │   ├── Courier Edit  →  courier_edit.php
│   │   │   └── Courier Report  →  courier_report.php
│   │   └── Incident
│   │       ├── Incident Add  →  incident_add.php
│   │       ├── Incident Edit  →  incident_edit.php
│   │       └── Incident Report  →  incident_report.php
│   ├── Certificates ▸
│   │   ├── Manual Request
│   │   │   ├── Request  →  create_crequest.php
│   │   │   └── Setup  →  certificate_setup.php
│   │   ├── SMR CRequest
│   │   │   └── Approve & Print  →  certificate_approve.php
│   │   ├── TC Details
│   │   │   └── TC Details  →  tc_details.php
│   │   ├── TC Request
│   │   │   ├── Request  →  tc_approve_add.php
│   │   │   └── Edit Request  →  tc_approve_edit.php
│   │   ├── TC Print
│   │   │   └── TC Print  →  tc_generate.php
│   │   ├── Internship
│   │   │   ├── Schedule  →  student_internship.php
│   │   │   ├── Print  →  internship_generate.php
│   │   │   └── Photo Upload  →  student_internship_photo.php
│   │   └── AAADAR Certificate
│   │       ├── Implant Certificate  →  aaadar_implant.php
│   │       └── Laser Certificate  →  aaadar_laser.php
│   ├── Committee ▸
│   │   ├── Committee Dashboard
│   │   │   └── Committee Dashboard  →  committee_dashboard.php
│   │   ├── Manage Event Calendar
│   │   │   ├── Create  →  tv_academic_event.php
│   │   │   └── Print  →  tv_academic_print.php
│   │   ├── Manage Events
│   │   │   └── Manage Task  →  st_task_allocation_approved.php
│   │   ├── Event Re-Schedule
│   │   │   └── Event Re-Schedule  →  approve_reschedule_event_v1.php
│   │   ├── Budget Approval
│   │   │   └── Budget Approval  →  task_budget_approved.php
│   │   ├── Documents Upload
│   │   │   └── Documents Upload  →  task_document.php
│   │   ├── Events Report
│   │   │   └── Events Report  →  task_manage_report.php
│   │   ├── Manage Committee
│   │   │   ├── Committees Information  →  event_committee_report.php
│   │   │   ├── Manage Members  →  event_committee_member.php
│   │   │   ├── Committee Add  →  event_committee_add.php
│   │   │   ├── Committee Edit  →  event_committee_edit.php
│   │   │   └── Designation  →  event_committee_designation.php
│   │   ├── Event Type Config
│   │   │   └── Event Type Config  →  committee_event_type.php
│   │   ├── Event Menu Assign
│   │   │   └── Event Menu Assign  →  task_category_setup.php
│   │   └── Event Sub-Menu Config
│   │       ├── Work Type  →  task_wtype_setup.php
│   │       ├── Participator  →  task_participator_setup.php
│   │       ├── Budget Expenses  →  task_budget_expenses.php
│   │       ├── Partners/Sponsors  →  task_event_organization.php
│   │       └── Document Type  →  task_document_type.php
│   ├── Kiosk ▸
│   │   ├── Machine Slider
│   │   │   ├── Slider  →  slider_widget.php
│   │   │   └── Widget  →  slider_widget_edit.php
│   │   ├── Machine Menu
│   │   │   ├── Menu  →  att_menu.php
│   │   │   └── Access  →  att_menu_access.php
│   │   ├── Machine Instruction
│   │   │   └── Instruction  →  att_instruction.php
│   │   ├── Staff PIN Number
│   │   │   ├── Letter  →  staff_machine_password.php
│   │   │   └── Regenerate  →  staff_mpassword_reset.php
│   │   ├── Student PIN Number
│   │   │   ├── Letter  →  student_machine_password.php
│   │   │   └── Regenerate  →  student_mpassword_reset.php
│   │   ├── Machine Access
│   │   │   └── Machine Access  →  machine_access.php
│   │   ├── Machine Att. stmt.
│   │   │   └── Machine Att. stmt.  →  m_att_statement.php
│   │   ├── Announcements
│   │   │   ├── New  →  announcement_add.php
│   │   │   └── Edit  →  announcement_edit.php
│   │   └── Receipt Setup
│   │       └── Receipt Setup  →  m_recepit_setup.php
│   ├── TV ▸
│   │   ├── TV Authentication
│   │   │   └── (unnamed)  →  tv_dashboard_access.php
│   │   ├── TV Photo
│   │   │   └── TV Photo  →  tv_photo_gallery.php
│   │   ├── TV Videos
│   │   │   └── TV Videos  →  tv_video_gallery.php
│   │   ├── TV API
│   │   │   └── TV API  →  tv_api_gallery.php
│   │   ├── TV Youtube Gallery
│   │   │   └── TV Youtube Gallery  →  tv_youtube_gallery.php
│   │   └── Silder Config
│   │       ├── Style  →  tv_slider_config.php
│   │       ├── Widget  →  tv_slider_widget.php
│   │       └── CSS  →  tv_print_style.php
│   ├── Web ▸
│   │   ├── Slider Animation
│   │   │   └── Slider Animation  →  home_slider_widget_edit.php
│   │   ├── About Us
│   │   │   └── About Us  →  web_aboutus_v1.php
│   │   ├── Academic
│   │   │   └── Academic  →  web_academic_v1.php
│   │   ├── Departments
│   │   │   └── Departments  →  web_departments_v1.php
│   │   ├── Facilities
│   │   │   └── Facilities  →  web_facilities_v1.php
│   │   ├── Journal
│   │   │   └── Journal  →  web_journal_v1.php
│   │   ├── AAADAR
│   │   │   └── AAADAR  →  web_aaadar_v1.php
│   │   ├── IQAC
│   │   │   └── IQAC  →  web_iqac_v1.php
│   │   ├── News & Events
│   │   │   ├── Add  →  festival_event_add.php
│   │   │   ├── Edit  →  festival_event_edit.php
│   │   │   └── Type  →  event_category.php
│   │   ├── Research
│   │   │   ├── Website  →  web_research_v1.php
│   │   │   ├── Program Add  →  web_research_news_add.php
│   │   │   └── Program Edit  →  web_research_news_edit.php
│   │   ├── Photos
│   │   │   ├── Add  →  photos_add.php
│   │   │   └── Edit  →  photos_edit.php
│   │   ├── Staff Web Display Order
│   │   │   └── Website Display Order  →  staff_web_display_order_setup.php
│   │   ├── Out Reach Activity
│   │   │   └── Out Reach Activity  →  web_out_reach_v1.php
│   │   ├── Web Document Upload
│   │   │   └── Web Document Upload  →  website_doc_upload.php
│   │   └── LMS
│   │       └── LMS  →  web_lms_v1.php
│   ├── SMS ▸
│   │   ├── Student SMS
│   │   │   └── Student SMS  →  student_sms.php
│   │   ├── Staff SMS
│   │   │   └── Staff SMS  →  staff_sms.php
│   │   ├── Group SMS
│   │   │   ├── SMS  →  group_sms.php
│   │   │   ├── Create Group  →  group_add.php
│   │   │   └── Edit Group  →  group_edit.php
│   │   ├── Template
│   │   │   ├── Add  →  sms_template_add.php
│   │   │   └── Edit  →  sms_template_edit.php
│   │   ├── Parent Message
│   │   │   └── Parent Message  →  parent_meeting_sms.php
│   │   └── SMS Report
│   │       └── SMS Report  →  student_sms_history.php
│   ├── Admin ▸
│   │   ├── Account
│   │   │   ├── New Account  →  account_add.php
│   │   │   ├── Edit Account  →  account_edit.php
│   │   │   ├── Reset Account  →  otp_account_reset.php
│   │   │   └── Change Password  →  change_password.php
│   │   ├── Access
│   │   │   └── Access  →  access.php
│   │   ├── Authentication
│   │   │   └── Add  →  authentication_add.php
│   │   ├── Staff Authentication
│   │   │   └── Staff Authentication  →  department_authentication.php
│   │   ├── Committee Access
│   │   │   └── Committee Access  →  committee_access.php
│   │   ├── Log Details
│   │   │   └── Log Details  →  log_details.php
│   │   ├── Staff Department Authentication
│   │   │   └── Staff Department Authentication  →  department_authentication_v1.php
│   │   ├── HOD Page Authentication
│   │   │   └── HOD Page Authentication  →  staff_authentication_add.php
│   │   └── Staff Page Authentication
│   │       └── Staff Page Authentication  →  staff_page_authentication_add.php
│   ├── Settings ▸
│   │   ├── Academic Setup
│   │   │   └── Academic Setup  →  academic.php
│   │   ├── Course
│   │   │   ├── New Course  →  course_add.php
│   │   │   └── Edit Course  →  course_edit.php
│   │   ├── Master Setup
│   │   │   └── Master Setup  →  master_setup.php
│   │   ├── Staff Dept Master
│   │   │   ├── Designation  →  staff_dept_setup.php
│   │   │   └── D.Order  →  staff_dept_order.php
│   │   ├── Staff Master
│   │   │   └── Staff Master  →  staff_profile_setup.php
│   │   ├── Staff Edu Master
│   │   │   └── Staff Edu Master  →  staff_edu_allied.php
│   │   ├── Dashboard Access
│   │   │   └── Dashboard Access  →  dashboard_access.php
│   │   ├── Approval
│   │   │   └── Approval  →  approval_setup.php
│   │   ├── Subject Master
│   │   │   └── Subject Master  →  subject_master.php
│   │   ├── SMS Config
│   │   │   ├── College  →  sms_approval_setup.php
│   │   │   ├── Hospital  →  hospital_sms_approval.php
│   │   │   └── Budget  →  task_sms_approval.php
│   │   ├── Print Setup
│   │   │   ├── Setup  →  print_setup.php
│   │   │   └── Style  →  print_style.php
│   │   ├── Lesson Plan Setup
│   │   │   └── Lesson Plan Setup  →  lession_plan_setup.php
│   │   ├── Signatue Setup
│   │   │   └── Signatue Setup  →  salary_signature.php
│   │   ├── Payroll Emailer
│   │   │   └── Payroll Emailer  →  payroll_cron_setup.php
│   │   └── SMS Cron
│   │       └── SMS Cron  →  sms_cron_setup.php
│   └── NAAC ▸
│       ├── NAAC Entry
│       │   └── NAAC Entry  →  naac_quan.php
│       ├── NAAC Report
│       │   └── NAAC Report  →  naac_quan_report.php
│       └── NAAC Detailed Report
│           └── NAAC Detailed Report  →  naac_quan_detailed_report.php
```
