/**
 * Map legacy PHP menu links to modern React routes.
 */
export const LEGACY_ROUTE_MAP = {
  'dashboard.php': '/dashboard',
  'dashboard_student.php': '/dashboard/student',
  'student_strength_overall.php': '/dashboard/overall-strength',
  'student_community_strength.php': '/dashboard/community-strength',
  'dashboard_v5.php': '/dashboard/staff-pattern',
  'dashboard_task.php': '/dashboard',
  'edashboard.php': '/dashboard',
  'student_profile_edit.php': '/students',
  'student_profile_add.php': '/students/new',
  'student_profile_export.php': '/students/reports',
  'student_profile_temp_add.php': '/students/temp-admission-add',
  'student_profile_temp_edit.php': '/students/temp-admission-edit',
  'student_profile_temp_affidavit.php': '/students/temp-affidavit',
  'student_academic.php': '/students/academic-promotion',
  'student_attachments.php': '/students/attachments-upload',
  'student_attachments_view.php': '/students/attachments-view',
  'student_attachments_report.php': '/students/attachments-report',
  'student_id_card.php': '/students/id-card',
  'student_photo_empty.php': '/students/photo-empty',
  'student_photo_upload.php': '/students/photo-upload',
  'student_promote.php': '/students/promote',
  'student_address.php': '/students/address-label',
  'alumni_registration.php': '/students/alumni-registration',
  'alumni_profile_edit.php': '/students/alumni-edit',
  'alumni_report.php': '/students/alumni-report',
  'alumni_id_card.php': '/students/alumni-id-card',
  'colage_generate.php': '/students/collage-generate',
  'colage_image.php': '/students/collage-image',
  'staff_profile_edit.php': '/staff',
  'staff_profile_add.php': '/staff/new',
  'staff_attachments.php': '/staff/certificates',
  'staff_profile_export.php': '/staff/reports',
  'staff_appoint_order.php': '/staff/appoint-order',
  'staff_salary_note.php': '/staff/salary-note',
  'staff_designation_edit.php': '/staff/setup/designation-edit',
  'staff_id_card.php': '/staff/id-card',
  'staff_photo_empty.php': '/staff/photo-empty',
  'staff_photo_upload.php': '/staff/photo-upload',
  'org_chart_config.php': '/staff/setup/org-chart-config',
  'org_structure.php': '/staff/org-structure',
  'staff_transport.php': '/staff/transport',
  'staff_attachment_category.php': '/staff/setup/attachment-category',
  'staff_attachment_scategory.php': '/staff/setup/attachment-scategory',
  'staff_attachment_setup.php': '/staff/setup/attachment-setup',
  'staff_photos.php': '/staff/photos',
  'staff_help.php': '/staff/login-help',
  'inspection_config.php': '/staff/setup/inspection-config',
  'inspection_details.php': '/staff/inspection-details',
  'staff_attendance_sign_with_photo.php': '/staff/inspection-attn-sheet',
  'inspection_attn_certificate.php': '/staff/inspection-attn-cert',
  'inspection_name.php': '/staff/setup/inspection-name',
  'staff_dci_report.php': '/staff/dci-report',
  'staff_tnmgr_report.php': '/staff/tnmgr-report',
  'staff_affidavit_dci.php': '/staff/affidavit-dci',
  'staff_affidavit_TNMGRMU.php': '/staff/affidavit-tnmgrmu',
  'staff_attach_print.php': '/staff/attach-print',
  'dci_staff_publication_report.php': '/staff/publication-dci',
  'tnmgrmu_staff_publication_report.php': '/staff/publication-tnmgrmu',
  'staff_transport_setup.php': '/staff/setup/transport-setup',
  'individual_calendar.php': '/attendance/staff',
  'staff_att_report.php': '/attendance/staff/report',
  'staff_attendance_report.php': '/attendance/staff/attendance-report',
  'staff_daily_attendance.php': '/attendance/staff/daily-attendance',
  'biomertic_att.php': '/attendance/staff/biometric-report',
  'staff_calendar_add.php': '/attendance/staff/setup/calendar-add',
  'staff_calendar_edit.php': '/attendance/staff/setup/calendar-edit',
  'staff_leave_acknowledge.php': '/attendance/staff/smr-acknowledge',
  'staff_leave_approve.php': '/attendance/staff/smr-leave-approve',
  'staff_permission_approve.php': '/attendance/staff/smr-permission-approve',
  'staff_defaulter_approve.php': '/attendance/staff/smr-defaulter-approve',
  'staff_lpd_report.php': '/attendance/staff/smr-lpd-report',
  'staff_holiday_roster.php': '/attendance/staff/holiday-roster',
  'staff_compensation.php': '/attendance/staff/compensation',
  'teaching_staff_att_report.php': '/attendance/staff/teaching-month-report',
  'staff_yearly_report.php': '/attendance/staff/yearly-report',
  'clear_icache.php': '/attendance/staff/clear-icache',
  'staff_att_chart.php': '/attendance/staff/att-chart',
  'staff_att_chart_modified.php': '/attendance/staff/att-chart-modified',
  'staff_att_chart_combine.php': '/attendance/staff/att-chart-combined',
  'staff_academic_calendar.php': '/attendance/staff/setup/working-day',
  'staff_att_time.php': '/attendance/staff/setup/att-time',
  'staff_att_time_report.php': '/attendance/staff/att-time-report',
  'staff_cl_el.php': '/attendance/staff/available-cl',
  'staff_att_transport.php': '/attendance/staff/att-transport',
  'available_leave.php': '/attendance/staff/available-leave',
  'student_mattendance.php': '/attendance/students/daily',
  'attendance_report.php': '/attendance/students/report',
  'attendance_report_quartely.php': '/attendance/students/report/quarterly',
  'attendance_report_quartely_v1.php': '/attendance/students/report/quarterly',
  'student_bio_att.php': '/attendance/students/biometric-report',
  'holiday_report.php': '/attendance/students/holiday-report',
  'stu_leave_approval.php': '/attendance/students/smr-leave-request',
  'student_leave_approval.php': '/attendance/students/smr-dept-leave',
  'stu_permission_approval.php': '/attendance/students/smr-permission',
  'stu_defaulter_approval.php': '/attendance/students/smr-defaulter',
  'student_lpd_report.php': '/attendance/students/smr-lpd-report',
  'stu_leave_approval_setup.php': '/attendance/students/smr-setup',
  'pg_attendance_setup.php': '/attendance/students/pg-att-setup',
  'pg_holiday_roster_add.php': '/attendance/students/pg-holiday-roster-add',
  'pg_holiday_roster_edit.php': '/attendance/students/pg-holiday-roster-edit',
  'pg_mattendance.php': '/attendance/students/pg-manual-att',
  'pg_attendance_report.php': '/attendance/students/pg-reports-att',
  'pg_attendance_punch_add.php': '/attendance/students/pg-punch-entry',
  'pg_attendance_punch.php': '/attendance/students/pg-punch',
  'staff_incharge_setup.php': '/attendance/students/year-incharge',
  'attendance_ug_report.php': '/attendance/students/ug-att-report',
  'intern_att_setup.php': '/attendance/students/intern-att-setup',
  'intern_holiday_roster_add.php': '/attendance/students/intern-holiday-roster-add',
  'intern_holiday_roster_edit.php': '/attendance/students/intern-holiday-roster-edit',
  'intern_mattendance.php': '/attendance/students/intern-manual-att',
  'istudent_att_report.php': '/attendance/students/intern-reports-att',
  'istudent_att_card.php': '/attendance/students/intern-att-statement',
  'staff_live_attendance.php': '/attendance/staff/punch',
  'student_fee_slip_new.php': '/fees/collection',
  'student_fee_slip.php': '/fees/collection',
  'student_fee_slip_new1.php': '/fees/collection',
  'student_fee_slip_new_26122023.php': '/fees/collection',
  'student_fee_add_new.php': '/fees/slips/pending',
  'student_fee_add.php': '/fees/slips/pending',
  'student_fee_add_new_v1.php': '/fees/slips/pending',
  'student_fee_add_new_220322.php': '/fees/slips/pending',
  'student_fee_add_new_bak.php': '/fees/slips/pending',
  'student_fee_delete.php': '/fees/slips/approved',
  'fee_delete_request.php': '/fees/delete/request',
  'fee_delete_request_more.php': '/fees/delete/request',
  'fee_delete_approve.php': '/fees/delete/approve',
  'fee_delete_report.php': '/fees/delete/report',
  'student_fee_report.php': '/fees/report/collection',
  'student_fee_report_v1.php': '/fees/report/collection',
  'student_fee_paid.php': '/fees/history',
  'fee_dashboard.php': '/fees/dashboard',
  'fee_dashboard_v1.php': '/fees/dashboard',
  'fee_dashboard_v2.php': '/fees/dashboard',
  'fee_report_dashboard.php': '/fees/dashboard',
  'fee_report_dashboard_v1.php': '/fees/dashboard',
  'fee_dashboard_report_v1.php': '/fees/dashboard',
  'fee_dashboard_report_v2.php': '/fees/dashboard',
  'fee_label_config.php': '/fees/setup/label',
  'fee_type_config.php': '/fees/setup/type',
  'fee_bank_config.php': '/fees/setup/bank',
  'fee_fine_config.php': '/fees/setup/fine',
  'fee_name_config.php': '/fees/setup/name',
  'fee_name_config_v1.php': '/fees/setup/name',
  'fee_scholarship_received.php': '/fees/setup/scholarship',
  'dme_fee_approve.php': '/fees/setup/dme-approve',
  'acmec_fee_scholarship.php': '/fees/setup/acmec-scholarship',
  'student_acmec_config.php': '/fees/acmec-config',
  'fee_pending_sms.php': '/fees/pending-sms',
  'fee_pending_sms_12092023.php': '/fees/pending-sms',
  'fee_pending_sms_bak.php': '/fees/pending-sms',
  'fee_pending_sms_v1.php': '/fees/pending-letter',
  'fee_pending_student.php': '/fees/pending-letter',
  'subject_master.php': '/academic/setup/subject-master',
  'course_add.php': '/academic/setup/course-add',
  'course_edit.php': '/academic/setup/course-edit',
  'academic.php': '/academic/setup/academic-years',
  'subject_setup.php': '/academic/setup/subject-setup',
  'subject_batch.php': '/academic/setup/subject-batch',
  'academic_calendar.php': '/academic/setup/academic-calendar',
  'subject_schedule.php': '/academic/setup/subject-schedule',
  'subject_unit_setup_v2.php': '/academic/setup/subject-unit',
  'academic_admission_setup.php': '/academic/setup/admission-exam',
  'master_setup.php': '/academic/setup/master-setup',
  'subject_report.php': '/academic/reports/subject-report',
  'timetable_class_report.php': '/academic/reports/timetable-report',
  'class_time_table_batch_report.php': '/academic/reports/batch-timetable-report',
  'exam_name_config.php': '/exam/setup/exam-names',
  'term_exam_setup.php': '/exam/setup/exam-setup',
  'term_exam_nodue.php': '/exam/setup/exam-nodue',
  'term_mark_entry.php': '/exam/setup/mark-entry',
  'exam_batch.php': '/exam/setup/exam-batch',
  'exam_dashboard.php': '/exam/dashboard',
  'student/exam_statement.php': '/exam/student-statement',
  'term_exam_examiners.php': '/exam/setup/exam-examiners',
  'term_exam_att_certificate.php': '/exam/reports/exam-attendance-certificate',
  'term_examiner_setup.php': '/exam/setup/examiner-setup',
  'camp_activity_add.php': '/exam/setup/camp-activity-add',
  'camp_activity_edit.php': '/exam/setup/camp-activity-edit',
  'camp_activity_type.php': '/exam/setup/camp-activity-type',
  'term_attendance_entry.php': '/exam/setup/attendance-entry',
  'term_attendance_report.php': '/exam/reports/attendance-report',
  'term_sheets_upload.php': '/exam/setup/sheets-upload',
  'term_sheets_status.php': '/exam/reports/sheets-status',
  'term_mark_sheet_status.php': '/exam/reports/mark-sheet-status',
  'term_mark_sheet_received.php': '/exam/reports/mark-sheet-received',
  'term_report.php': '/exam/reports/term-report',
  'term_report_statement.php': '/exam/reports/term-statement',
  'term_progress_card.php': '/exam/reports/progress-card',
  'tt_config.php': '/academic/setup/tt-config',
  'subject_dashboard.php': '/academic/reports/subject-dashboard',
  'period_setup.php': '/academic/setup/period-setup',
  'machine_room_add.php': '/kiosk/setup/machine-room-add',
  'machine_room_edit.php': '/kiosk/setup/machine-room-edit',
  'class_time_table.php': '/academic/reports/class-timetable',
  'class_time_table_v3.php': '/academic/reports/class-timetable-v3',
  'tt_config_v3.php': '/academic/setup/tt-config-v3',
  'subject_schedule_report.php': '/academic/reports/subject-schedule-report',
  'internship_schedule.php': '/academic/setup/internship-schedule',
  'batch_color_setup.php': '/academic/setup/batch-color',
  'feedback_config.php': '/academic/setup/feedback-config-ug',
  'feedback_config_pg.php': '/academic/setup/feedback-config-pg',
  'feedback_dashboard.php': '/academic/reports/feedback-dashboard',
  'feedback_report.php': '/academic/reports/feedback-report-ug',
  'feedback_topic.php': '/academic/setup/feedback-topics',
  'feedback_report_pg.php': '/academic/reports/feedback-report-pg',
  'subject_timing.php': '/academic/reports/subject-timing',
  'subject_handle.php': '/academic/reports/subject-handle',
  'staff_period_completed.php': '/academic/reports/staff-period-completed',
  'department_period_completed.php': '/academic/reports/department-period-completed',
  'subject_handle1.php': '/academic/reports/subject-handle-grid',
  'term_mark_sheet.php': '/exam/setup/mark-sheet',
  'term_exam_schedule.php': '/exam/setup/exam-schedule',
  'term_marks_upload.php': '/exam/setup/marks-upload',
  'term_exam_sch_print.php': '/exam/reports/schedule-print',
  'term_exam_Inviliga_sch_print.php': '/exam/reports/invigilator-print',
  'term_report_analysis.php': '/exam/reports/report-analysis',
  'term_report_analysis_v1.php': '/exam/reports/report-analysis-v1',
  'exam_sms.php': '/exam/setup/exam-sms',
  'omr_style_config.php': '/exam/setup/omr-config',
  'account_add.php': '/admin/setup/account-add',
  'account_edit.php': '/admin/setup/account-edit',
  'access.php': '/admin/setup/access-restriction',
  'department_authentication.php': '/admin/setup/dept-auth',
  'authentication_add.php': '/admin/setup/menu-auth',
  'dashboard_access.php': '/admin/setup/dashboard-access',
  'change_password.php': '/admin/setup/change-password',
  'otp_account_reset.php': '/admin/setup/otp-reset',
  'committee_access.php': '/admin/setup/committee-access',
  'department_authentication_v1.php': '/admin/setup/dept-auth-v1',
  'staff_authentication_add.php': '/admin/setup/staff-auth-hod',
  'staff_page_authentication_add.php': '/admin/setup/staff-auth-page',
  'log_dashboard.php': '/dashboard/log',
  'log_details.php': '/admin/log-details',
  'account_list.php': '/admin/users',
  'student_activities_add.php': '/admin-office/setup/student-activities-add',
  'student_activities_edit.php': '/admin-office/setup/student-activities-edit',
  'staff_activities_add.php': '/admin-office/setup/staff-activities-add',
  'staff_activities_edit.php': '/admin-office/setup/staff-activities-edit',
  'courier_add.php': '/admin-office/setup/courier-add',
  'courier_edit.php': '/admin-office/setup/courier-edit',
  'courier_report.php': '/admin-office/setup/courier-report',
  'incident_add.php': '/admin-office/setup/incident-add',
  'incident_edit.php': '/admin-office/setup/incident-edit',
  'incident_report.php': '/admin-office/setup/incident-report',
  'events_group_add.php': '/admin-office/setup/events-group-add',
  'payroll_dashboard.php': '/payroll/dashboard',
  'payroll_individual_report.php': '/payroll/individual-report',
  'payroll_consolidated_report.php': '/payroll/consolidated-report',
  'salary_summary.php': '/payroll/salary-summary',
  'salary_statement.php': '/payroll/salary-statement',
  'payroll_individual_setup.php': '/payroll/setup/individual-setup',
  'payroll_cron_setup.php': '/payroll/setup/cron-setup',
  'payroll_group_report.php': '/payroll/group-report',
  'staff_payroll_setup.php': '/payroll/setup/payroll-config',
  'staff_pfesi_setup.php': '/payroll/setup/pf-esi-setup',
  'staff_salary_setup.php': '/payroll/setup/salary-add',
  'staff_salary_report.php': '/payroll/setup/salary-report',
  'salary_advance_add.php': '/payroll/setup/salary-advance-add',
  'salary_advance_edit.php': '/payroll/setup/salary-advance-close',
  'salary_arrear_add.php': '/payroll/setup/salary-arrear-add',
  'salary_arrear_edit.php': '/payroll/setup/salary-arrear-release',
  'staff_deduction_add.php': '/payroll/setup/other-deduction',
  'staff_lop_deduction.php': '/payroll/setup/lop-deduction',
  'staff_tds_add.php': '/payroll/setup/tds-add',
  'staff_cheque_add.php': '/payroll/setup/cheque-payment',
  'security_deposit_deduction_add.php': '/payroll/setup/security-deposit-add',
  'security_deposit_deduction_close.php': '/payroll/setup/security-deposit-close',
  'generate_payroll.php': '/payroll/generate-payroll',
  'payroll_report.php': '/payroll/att-report',
  'payroll_monthly_report.php': '/payroll/monthly-report',
  'staff_tax_report.php': '/payroll/tax-report',
  'payroll_close.php': '/payroll/setup/payroll-close',
  'payroll_individual_report1.php': '/payroll/individual-bundle',
  'payroll_individual_report3.php': '/payroll/consolidated-report',
  'stipend_payroll_report.php': '/payroll/stipend/report',
  'stipend_salary_statement.php': '/payroll/stipend/statement',
  'stipend_payroll_individual_report1.php': '/payroll/stipend/individual-report',
  'stipend_payroll_individual_report3.php': '/payroll/stipend/individual-pdf',
  'stipend_generate_payroll.php': '/payroll/stipend/generate-payroll',
  'stipend_amount_setup.php': '/payroll/stipend/setup/amount-setup',
  'stipend_deduction_add.php': '/payroll/stipend/setup/deduction-add',
  'stipend_payroll_close.php': '/payroll/stipend/setup/payroll-close',
  'stipend_payroll_att_report.php': '/payroll/stipend/att-report',
  // Settings submenu (native React at /settings/setup/*)
  'staff_dept_setup.php': '/settings/setup/designation',
  'staff_dept_order.php': '/settings/setup/d-order',
  'staff_profile_setup.php': '/settings/setup/staff-master',
  'staff_edu_allied.php': '/settings/setup/staff-edu-master',
  'approval_setup.php': '/settings/setup/approval',
  'sms_approval_setup.php': '/settings/setup/college',
  'hospital_sms_approval.php': '/settings/setup/hospital',
  'task_sms_approval.php': '/settings/setup/budget',
  'print_setup.php': '/settings/setup/print-setup',
  'print_style.php': '/settings/setup/print-style',
  'lession_plan_setup.php': '/settings/setup/lesson-plan',
  'salary_signature.php': '/settings/setup/signature',
  'sms_cron_setup.php': '/settings/setup/sms-cron',
  // Library
  'dashboard_library.php': '/library/setup/dashboard',
  'library_book_cate.php': '/library/setup/book-category',
  'library_book_add.php': '/library/setup/book-add',
  'library_book_edit.php': '/library/setup/book-edit',
  'library_book_report.php': '/library/setup/book-report',
  'resources_report.php': '/library/setup/resources-report',
  'resources_barcode.php': '/library/setup/resources-barcode',
  'resource_transfer.php': '/library/setup/resource-transfer',
  'supplier_add.php': '/library/setup/supplier-add',
  'supplier_edit.php': '/library/setup/supplier-edit',
  'transaction_setup.php': '/library/setup/transaction-setup',
  'library_transaction1.php': '/library/setup/transaction-issue',
  'library_transaction.php': '/library/setup/transaction-return',
  'transaction_report.php': '/library/setup/transaction-report',
  'library_entry_report.php': '/library/setup/entry-report',
  'library_attendance.php': '/library/setup/attendance',
  'library_att_entry.php': '/library/setup/att-entry',
  'lib_attendance_report.php': '/library/setup/att-report',
  // Hostel
  'dashboard_hostel.php': '/hostel/setup/dashboard',
  'block_setup.php': '/hostel/setup/block-setup',
  'room_setup_add.php': '/hostel/setup/room-setup-add',
  'room_setup_edit.php': '/hostel/setup/room-setup-edit',
  'room_rental_setup.php': '/hostel/setup/room-rental-setup',
  'transport_add.php': '/hostel/setup/transport-add',
  'transport_edit.php': '/hostel/setup/transport-edit',
  'transport_stopping_setup.php': '/hostel/setup/transport-stopping-setup',
  'transport_fee_config.php': '/hostel/setup/transport-fee-config',
  'student_hostel.php': '/hostel/setup/student-hostel',
  'hostel_att_setup.php': '/hostel/setup/att-setup',
  'hostel_attendance_report.php': '/hostel/setup/attendance-report',
  'hostel_pass_approval.php': '/hostel/setup/pass-approval',
  'hostel_student_report.php': '/hostel/setup/pass-report',
  'staff_rental_hostel.php': '/hostel/setup/staff-rental',
  // Circular
  'circular_dashboard.php': '/circular/setup/dashboard',
  'circular_setup.php': '/circular/setup/setup',
  'circular_add.php': '/circular/setup/add',
  'circular_edit.php': '/circular/setup/edit',
  'circular_approve.php': '/circular/setup/approve',
  'circular_report.php': '/circular/setup/report',
  'circular_print_student.php': '/circular/setup/print-student',
  'circular_print_staff.php': '/circular/setup/print-staff',
  'circular_print_department.php': '/circular/setup/print-department',
  // SMS
  'student_sms.php': '/sms/setup/student-sms',
  'staff_sms.php': '/sms/setup/staff-sms',
  'group_sms.php': '/sms/setup/group-sms',
  'group_add.php': '/sms/setup/group-add',
  'group_edit.php': '/sms/setup/group-edit',
  'parent_meeting_sms.php': '/sms/setup/parent-meeting-sms',
  'student_sms_history.php': '/sms/setup/sms-history',
  'sms_template.php': '/sms/setup/sms-template-edit',
  'sms_template_add.php': '/sms/setup/sms-template-add',
  'sms_template_edit.php': '/sms/setup/sms-template-edit',
  // Web CMS
  'web_aboutus_v1.php': '/web/setup/about-us',
  'web_departments_v1.php': '/web/setup/departments',
  'web_lms_v1.php': '/web/setup/lms',
  'web_journal_v1.php': '/web/setup/journal',
  'web_facilities_v1.php': '/web/setup/facilities',
  'web_aaadar_v1.php': '/web/setup/aaadar',
  'web_research_v1.php': '/web/setup/research',
  'web_academic_v1.php': '/web/setup/academic',
  'web_iqac_v1.php': '/web/setup/iqac',
  'web_out_reach_v1.php': '/web/setup/outreach',
  'home_slider_widget_edit.php': '/web/setup/slider-animation',
  'photos_add.php': '/web/setup/photos-add',
  'photos_edit.php': '/web/setup/photos-edit',
  'staff_web_display_order_setup.php': '/web/setup/staff-display-order',
  'website_doc_upload.php': '/web/setup/doc-upload',
  'web_research_news_add.php': '/web/setup/research-program-add',
  'web_research_news_edit.php': '/web/setup/research-program-edit',
  'festival_event_add.php': '/web/setup/event-add',
  'festival_event_edit.php': '/web/setup/event-edit',
  'event_category.php': '/web/setup/event-type',
  // TV
  'tv/dashboard.php': '/tv/dashboard',
  'tv/tv_slider_widget.php': '/tv/setup/slider-widget',
  'tv_slider_widget.php': '/tv/setup/slider-widget',
  'tv_slider_config.php': '/tv/setup/slider-config',
  'tv_dashboard_access.php': '/tv/setup/dashboard-access',
  'tv_slider_access.php': '/tv/setup/slider-access',
  'tv_photo_gallery.php': '/tv/setup/photo-gallery',
  'tv_video_gallery.php': '/tv/setup/video-gallery',
  'tv_api_gallery.php': '/tv/setup/api-gallery',
  'tv_youtube_gallery.php': '/tv/setup/youtube-gallery',
  'tv_live_video.php': '/tv/setup/live-video',
  'tv_print_style.php': '/tv/setup/print-style',
  // Kiosk
  'machine_access.php': '/kiosk/setup/machine-access',
  'machine_room_add.php': '/kiosk/setup/machine-room-add',
  'machine_room_edit.php': '/kiosk/setup/machine-room-edit',
  'student_machine_password.php': '/kiosk/setup/student-password',
  'staff_machine_password.php': '/kiosk/setup/staff-password',
  'slider_widget.php': '/kiosk/setup/machine-slider',
  'slider_widget_edit.php': '/kiosk/setup/slider-widget',
  'att_menu.php': '/kiosk/setup/att-menu',
  'att_menu_access.php': '/kiosk/setup/att-menu-access',
  'att_instruction.php': '/kiosk/setup/att-instruction',
  'staff_mpassword_reset.php': '/kiosk/setup/staff-pin-reset',
  'student_mpassword_reset.php': '/kiosk/setup/student-pin-reset',
  'm_att_statement.php': '/kiosk/setup/att-statement',
  'announcement_add.php': '/kiosk/setup/announcement-add',
  'announcement_edit.php': '/kiosk/setup/announcement-edit',
  'm_recepit_setup.php': '/kiosk/setup/receipt-setup',
  // Committee
  'committee_dashboard.php': '/committee/setup/dashboard',
  'event_committee_report.php': '/committee/setup/committee-report',
  'event_committee_add.php': '/committee/setup/committee-add',
  'event_committee_edit.php': '/committee/setup/committee-edit',
  'event_committee_member.php': '/committee/setup/committee-member',
  'event_committee_designation.php': '/committee/setup/designation',
  'committee_event_type.php': '/committee/setup/event-type',
  'task_category_setup.php': '/committee/setup/task-category',
  't_client_add.php': '/committee/setup/client-add',
  't_client_edit.php': '/committee/setup/client-edit',
  'task_colour_setup.php': '/committee/setup/task-colour',
  'task_type_setup.php': '/committee/setup/task-type',
  'task_wtype_setup.php': '/committee/setup/task-wtype',
  'task_participator_setup.php': '/committee/setup/task-participator',
  'task_miscellaneous_setup.php': '/committee/setup/task-misc',
  'task_document_type.php': '/committee/setup/task-doc-type',
  'task_time_sheet_setup.php': '/committee/setup/task-time-sheet',
  'task_budget_expenses.php': '/committee/setup/task-budget-expenses',
  'task_event_organization.php': '/committee/setup/task-event-org',
  'st_task_dashboard.php': '/committee/setup/task-dashboard',
  'st_task_allocation_approved.php': '/committee/setup/task-allocation',
  'st_task_allocation_approved_v2.php': '/committee/setup/task-allocation-v2',
  'task_manage_report.php': '/committee/setup/task-manage-report',
  'task_document.php': '/committee/setup/task-document',
  'task_budget_approved.php': '/committee/setup/task-budget-approved',
  'approve_event.php': '/committee/setup/approve-event',
  'approve_event_report.php': '/committee/setup/approve-event-report',
  'approve_reschedule_event_v1.php': '/committee/setup/approve-reschedule',
  'tv_academic_event.php': '/committee/setup/tv-academic-event',
  'tv_academic_print.php': '/committee/setup/tv-academic-print',
  // Certificates
  'student_internship.php': '/certificates/setup/internship-schedule',
  'aaadar_implant.php': '/certificates/setup/implant-cert',
  'tc_details.php': '/certificates/setup/tc-details',
  'certificate_generate.php': '/certificates/setup/generate',
  'tc_approve_add.php': '/certificates/setup/tc-request-add',
  'tc_generate.php': '/certificates/setup/tc-generate',
  'create_crequest.php': '/certificates/setup/cert-request',
  'aaadar_laser.php': '/certificates/setup/laser-cert',
  'certificate_approve.php': '/certificates/setup/approve',
  'certificate_setup.php': '/certificates/setup/setup',
  'internship_generate.php': '/certificates/setup/internship-generate',
  'tc_approve_edit.php': '/certificates/setup/tc-request-edit',
  'certificate_receipt_add.php': '/certificates/setup/receipt-add',
  'student_internship_photo.php': '/certificates/setup/internship-photo',
  'certificate_receipt_edit.php': '/certificates/setup/receipt-edit',
  'certificate_receipt_report.php': '/certificates/setup/receipt-report',
  'dashboard_certificate.php': '/certificates',
  // NAAC
  'naac_qual.php': '/naac/setup/qual',
  'naac_quan.php': '/naac/setup/quan',
  'naac_quan_report.php': '/naac/setup/quan-report',
  'naac_quan_detailed_report.php': '/naac/setup/quan-detailed-report',
  // Student portfolio
  'student_portfolio_dashboard.php': '/portfolio/dashboard',
  'student_portfolia_individual_report.php': '/portfolio/individual-report',
  'student_portfolia_individual_report_v1.php': '/portfolio/individual-report',
  // E-Learning
  'elearn_dashboard.php': '/elearning/dashboard',
  'elearn_setup.php': '/elearning/setup/elearn-setup',
  'elearn_report.php': '/elearning/setup/elearn-report',
  'staff/subject_test.php': '/elearning/setup/subject-test',
  'staff/subject_report.php': '/elearning/setup/subject-report',
};

function normalizeLegacyPath(legacyLink) {
  return String(legacyLink || '').replace(/^\//, '').trim().split('?')[0];
}

/**
 * Stable, URL-friendly key derived from a legacy PHP filename - used only to
 * disambiguate which sidebar link is active when several share one modern route
 * (e.g. dashboard.php / dashboard_task.php / edashboard.php all -> /dashboard).
 * Deliberately not the raw filename: it shouldn't show a ".php" name in the URL bar.
 */
export function cleanLegacyKey(legacyLink) {
  return normalizeLegacyPath(legacyLink)
    .replace(/\.php$/i, '')
    .replace(/[/_]/g, '-');
}

/** Sidebar labels for legacy links that share generic names (e.g. Report / Config). */
const MENU_LABEL_OVERRIDES = {
  'class_time_table_v3.php': 'Report (New)',
  'tt_config_v3.php': 'Config (New)',
  // Provisional (temporary) admission flow — named distinctly from the
  // permanent "New Profile" (student_profile_add.php) to avoid confusion.
  'student_profile_temp_add.php': 'Provisional Admission — New',
  'student_profile_temp_edit.php': 'Provisional Admission — Edit',
  'student_profile_temp_affidavit.php': 'Provisional Admission — Affidavit',
};

export function resolveMenuLabel(legacyLink, defaultName) {
  const key = normalizeLegacyPath(legacyLink);
  return MENU_LABEL_OVERRIDES[key] || defaultName;
}

/** Modern paths that multiple legacy menu links resolve to (e.g. add + edit → same screen). */
const ROUTE_LEGACY_PATHS = Object.entries(LEGACY_ROUTE_MAP).reduce((acc, [legacy, route]) => {
  const pathOnly = route.split('?')[0];
  if (!acc[pathOnly]) acc[pathOnly] = new Set();
  acc[pathOnly].add(legacy);
  return acc;
}, {});

function sharedLegacyPathsForRoute(modernPath) {
  const legacies = ROUTE_LEGACY_PATHS[modernPath];
  return legacies && legacies.size > 1 ? [...legacies] : null;
}

/** All modern route paths from the legacy map (for precise active matching). */
const ALL_MODERN_PATHS = new Set(
  Object.values(LEGACY_ROUTE_MAP).map((route) => route.split('?')[0]),
);

/** Search/list routes that also own `/module/:numericId` profile pages only. */
const PROFILE_LIST_ROUTES = {
  '/students': /^\/students\/\d+$/,
  '/staff': /^\/staff\/\d+$/,
};

function isPathOwnedBySpecificRoute(menuPath, pathname) {
  for (const registered of ALL_MODERN_PATHS) {
    if (registered === menuPath) continue;
    if (!registered.startsWith(`${menuPath}/`)) continue;
    if (pathname === registered || pathname.startsWith(`${registered}/`)) return true;
  }
  return false;
}

function pathnameMatchesMenuRoute(menuPath, pathname) {
  if (pathname === menuPath) return true;

  const profilePattern = PROFILE_LIST_ROUTES[menuPath];
  if (profilePattern?.test(pathname)) return true;

  if (!pathname.startsWith(`${menuPath}/`)) return false;

  // e.g. /students/id-card must not activate the /students (Edit Profile) item
  if (isPathOwnedBySpecificRoute(menuPath, pathname)) return false;

  return true;
}

export function resolveMenuLink(legacyLink) {
  if (!legacyLink || legacyLink === '#') return null;
  const [path, query] = legacyLink.replace(/^\//, '').trim().split('?');
  const modern = LEGACY_ROUTE_MAP[path];
  if (!modern) return null;
  return query ? `${modern}?${query}` : modern;
}

/** Menu href — adds `view=` when several sidebar items share one modern route. */
export function buildMenuHref(legacyLink) {
  const modern = resolveMenuLink(legacyLink);
  if (!modern) return null;
  const pathOnly = modern.split('?')[0];
  if (!sharedLegacyPathsForRoute(pathOnly)) return modern;
  const legacyKey = cleanLegacyKey(legacyLink);
  const params = new URLSearchParams(modern.includes('?') ? modern.split('?')[1] : '');
  params.set('view', legacyKey);
  return `${pathOnly}?${params.toString()}`;
}

/** Active state for sidebar items — avoids highlighting every item that shares a route. */
export function isMenuLinkActive(legacyLink, pathname, search = '') {
  const modern = resolveMenuLink(legacyLink);
  if (!modern) return false;
  const pathOnly = modern.split('?')[0];
  if (!pathnameMatchesMenuRoute(pathOnly, pathname)) return false;
  const shared = sharedLegacyPathsForRoute(pathOnly);
  if (!shared) return true;
  const legacyKey = cleanLegacyKey(legacyLink);
  const currentLegacy = new URLSearchParams(search).get('view');
  if (currentLegacy) return currentLegacy === legacyKey;
  return false;
}
