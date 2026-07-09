/** Prisma select shapes that omit legacy zero-date timestamp columns (updated_dt). */

export const basicSetupCourseSelect = {
  id: true,
  start_number: true,
  c_order: true,
  full_part_time: true,
  course_name: true,
  degree_name: true,
  degree_short_name: true,
  course_department: true,
  department_name: true,
  department_short_name: true,
  dept_sname: true,
  year_of_start: true,
  course_duration: true,
  total_semester: true,
  semester_per_year: true,
  del: true,
};

export const ciaExamNameSelect = {
  id: true,
  exam_order: true,
  exam_name: true,
  exam_month: true,
  del: true,
};

export const staffDeptMasterSelect = {
  id: true,
  name: true,
  s_name: true,
  d_order: true,
  d_dept: true,
  category: true,
  course_id: true,
  college: true,
  del: true,
};

export const subjectMasterSelect = {
  id: true,
  category: true,
  category_name: true,
  category_sname: true,
  sub_category: true,
  category_order: true,
  del: true,
};

export const lessonPlanSetupSelect = {
  id: true,
  category: true,
  name: true,
  l_type: true,
  l_order: true,
  del: true,
};

export const blocksTbSelect = {
  id: true,
  block_name: true,
  del: true,
};

export const roomsTbSelect = {
  id: true,
  block_id: true,
  room_name: true,
  machine_id: true,
  machine_ip: true,
  remarks: true,
  del: true,
};

/** Omits legacy invalid Date columns (pap_eva_frm, pap_eva_to). */
export const ciaSetupSelect = {
  id: true,
  course_name: true,
  academic_year: true,
  academic_type: true,
  exam_name: true,
  session_fn: true,
  session_an: true,
  pap_eva_time: true,
  exam_internal: true,
  exam_viva: true,
  exam_external: true,
  mark_option: true,
  exam_status: true,
  del: true,
};

export const bookCategorySelect = {
  id: true,
  category: true,
  category_name: true,
  category_order: true,
  del: true,
};

/** Omits invalid legacy Date columns when reading academic year slots. */
export const basicSetupAcademicSelect = {
  id: true,
  course_name: true,
  academic_year: true,
  academic_batch: true,
  del: true,
};

export const staffDesgOrderSelect = {
  id: true,
  name: true,
  d_order: true,
  del: true,
};

export const eduSetupTbSelect = {
  id: true,
  category: true,
  category_name: true,
  category_sname: true,
  sub_category: true,
  category_order: true,
  del: true,
};

export const eduAlliedTbSelect = {
  id: true,
  category: true,
  sub_category: true,
  category_name: true,
  category_sname: true,
  category_order: true,
  del: true,
};

export const printSetupTbSelect = {
  id: true,
  title: true,
  sub_title: true,
  body_title: true,
  category: true,
  p_order: true,
  page_note: true,
  home_header: true,
  inner_header: true,
  home_height: true,
  inner_height: true,
  footer: true,
  right_text: true,
  generated_by: true,
  approved_by: true,
  checked_by: true,
  verified_by: true,
  page_no: true,
  row_count: true,
  signature: true,
  del: true,
};

export const printSignatureTbSelect = {
  id: true,
  print_id: true,
  category: true,
  staff_name: true,
  staff_designation: true,
  staff_order: true,
  print_format: true,
  del: true,
};

export const courierTbSelect = {
  id: true,
  courier_inout: true,
  category: true,
  courier_from: true,
  courier_to: true,
  c_type: true,
  courier_no: true,
  courier_company: true,
  h_name: true,
  h_designation: true,
  courier_note: true,
  item_name: true,
  quantity: true,
  courier_receiver: true,
  del: true,
};

export const incidentTbSelect = {
  id: true,
  incident_category: true,
  incident_title: true,
  incident_location: true,
  first_aid_by: true,
  incident_details: true,
  del: true,
};

export const eventTbSelect = {
  id: true,
  academic_year: true,
  event_name: true,
  event_for: true,
  event_type: true,
  event_category: true,
  event_venue: true,
  event_content_1: true,
  event_participants_no: true,
  event_participants_name: true,
  c_completed: true,
  del: true,
};

export const eventParticipantTbSelect = {
  id: true,
  event_id: true,
  prize_name: true,
  house_name: true,
  student_list: true,
  student_name_list: true,
  del: true,
};
