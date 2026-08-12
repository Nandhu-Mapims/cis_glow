import { useEffect, useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import CheckListSelect from '../../../components/CheckListSelect';

function selectedValues(options) {
  return options?.filter((o) => o.selected).map((o) => o.value) || [];
}

export default function DeptAuthSetup({ data, busy, onLoad, onSave }) {
  const [selections, setSelections] = useState({
    deptHod: [],
    deptStaff: [],
    deptStudent: [],
    deptInternship: [],
    deptPg: [],
    courseIds: [],
  });

  useEffect(() => {
    if (!data?.selectedDept) return;
    setSelections({
      deptHod: selectedValues(data.hodOptions),
      deptStaff: selectedValues(data.staffOptions),
      deptStudent: selectedValues(data.deptStudentOptions),
      deptInternship: selectedValues(data.internshipOptions),
      deptPg: selectedValues(data.pgOptions),
      courseIds: selectedValues(data.courseOptions),
    });
  }, [data]);

  if (!data) return null;

  return (
    <div className="admin-native-form">
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="dept_user">User</label>
          <SearchableSelect
            id="dept_user"
            options={data.users || []}
            value={data.selectedUser || ''}
            disabled={busy}
            searchPlaceholder="Search by username or name..."
            onChange={(val) => onLoad({ user_name_ref: val })}
          />
        </div>
        {data.selectedUser && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="dept_name">Department</label>
            <SearchableSelect
              id="dept_name"
              options={data.departments || []}
              value={data.selectedDept || ''}
              disabled={busy}
              searchPlaceholder="Search departments..."
              onChange={(val) => onLoad({ user_name_ref: data.selectedUser, dept_name_ref: val })}
            />
          </div>
        )}
      </div>

      {data.selectedDept && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              user_name_ref: data.selectedUser,
              dept_name_ref: data.selectedDept,
              r_id: data.recordId ? String(data.recordId) : '',
              dept_hod: selections.deptHod,
              dept_staff: selections.deptStaff,
              dept_student: selections.deptStudent,
              dept_internship: selections.deptInternship,
              dept_pg: selections.deptPg,
              course_id: selections.courseIds,
              form_reset: String(Date.now()),
              Submit: 'Save',
            });
          }}
        >
          <div className="row g-3">
            <div className="col-md-6">
              <span className="form-label" id="dept_hod_label">Dept HOD</span>
              <CheckListSelect
                aria-labelledby="dept_hod_label"
                multiple={false}
                options={data.hodOptions || []}
                value={selections.deptHod}
                onChange={(deptHod) => setSelections((s) => ({ ...s, deptHod }))}
              />
            </div>
            <div className="col-md-6">
              <span className="form-label" id="dept_staff_label">Staffs</span>
              <CheckListSelect
                aria-labelledby="dept_staff_label"
                options={data.staffOptions || []}
                value={selections.deptStaff}
                onChange={(deptStaff) => setSelections((s) => ({ ...s, deptStaff }))}
              />
            </div>
            <div className="col-md-6">
              <span className="form-label" id="dept_ug_label">U.G</span>
              <CheckListSelect
                aria-labelledby="dept_ug_label"
                options={data.deptStudentOptions || []}
                value={selections.deptStudent}
                onChange={(deptStudent) => setSelections((s) => ({ ...s, deptStudent }))}
              />
            </div>
            <div className="col-md-6">
              <span className="form-label" id="dept_internship_label">Internship</span>
              <CheckListSelect
                aria-labelledby="dept_internship_label"
                options={data.internshipOptions || []}
                value={selections.deptInternship}
                onChange={(deptInternship) => setSelections((s) => ({ ...s, deptInternship }))}
              />
            </div>
            <div className="col-md-6">
              <span className="form-label" id="dept_pg_label">P.G</span>
              <CheckListSelect
                aria-labelledby="dept_pg_label"
                options={data.pgOptions || []}
                value={selections.deptPg}
                onChange={(deptPg) => setSelections((s) => ({ ...s, deptPg }))}
              />
            </div>
            <div className="col-md-6">
              <span className="form-label" id="dept_course_label">Course</span>
              <CheckListSelect
                aria-labelledby="dept_course_label"
                options={data.courseOptions || []}
                value={selections.courseIds}
                onChange={(courseIds) => setSelections((s) => ({ ...s, courseIds }))}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-danger mt-4" disabled={busy}>Save</button>
        </form>
      )}
    </div>
  );
}
