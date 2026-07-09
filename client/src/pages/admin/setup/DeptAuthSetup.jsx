import { useEffect, useState } from 'react';

function MultiSelect({ options = [], value = [], onChange, multiple = true }) {
  return (
    <select
      className="form-select"
      multiple={multiple}
      size={multiple ? Math.min(8, Math.max(4, options.length || 4)) : undefined}
      value={multiple ? value : (value[0] || '')}
      onChange={(e) => {
        if (multiple) {
          onChange([...e.target.selectedOptions].map((o) => o.value));
        } else {
          onChange(e.target.value ? [e.target.value] : []);
        }
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

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
          <select
            id="dept_user"
            className="form-select"
            value={data.selectedUser || ''}
            disabled={busy}
            onChange={(e) => onLoad({ user_name_ref: e.target.value })}
          >
            <option value="">--Select user--</option>
            {data.users?.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        {data.selectedUser && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="dept_name">Department</label>
            <select
              id="dept_name"
              className="form-select"
              value={data.selectedDept || ''}
              disabled={busy}
              onChange={(e) => onLoad({ user_name_ref: data.selectedUser, dept_name_ref: e.target.value })}
            >
              <option value="">--Select department--</option>
              {data.departments?.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
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
              <label className="form-label">Dept HOD</label>
              <MultiSelect
                multiple={false}
                options={data.hodOptions || []}
                value={selections.deptHod}
                onChange={(deptHod) => setSelections((s) => ({ ...s, deptHod }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Staffs</label>
              <MultiSelect
                options={data.staffOptions || []}
                value={selections.deptStaff}
                onChange={(deptStaff) => setSelections((s) => ({ ...s, deptStaff }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">U.G</label>
              <MultiSelect
                options={data.deptStudentOptions || []}
                value={selections.deptStudent}
                onChange={(deptStudent) => setSelections((s) => ({ ...s, deptStudent }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Internship</label>
              <MultiSelect
                options={data.internshipOptions || []}
                value={selections.deptInternship}
                onChange={(deptInternship) => setSelections((s) => ({ ...s, deptInternship }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">P.G</label>
              <MultiSelect
                options={data.pgOptions || []}
                value={selections.deptPg}
                onChange={(deptPg) => setSelections((s) => ({ ...s, deptPg }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Course</label>
              <MultiSelect
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
