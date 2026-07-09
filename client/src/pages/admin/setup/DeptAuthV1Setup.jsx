import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function MultiSelect({ options = [], value = [], onChange, groups = null }) {
  if (groups?.length) {
    return (
      <select
        className="form-select"
        multiple
        size={12}
        value={value}
        onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
      >
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <select
      className="form-select"
      multiple
      size={Math.min(10, Math.max(4, options.length || 4))}
      value={value}
      onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
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

function selectedFromGroups(groups) {
  return groups?.flatMap((g) => g.options.filter((o) => o.selected).map((o) => o.value)) || [];
}

export default function DeptAuthV1Setup({ data, busy, onLoad, onSave }) {
  const [selections, setSelections] = useState({
    deptIds: [],
    deptStaff: [],
    deptStudent: [],
    deptInternship: [],
    deptPg: [],
    courseIds: [],
  });

  useEffect(() => {
    if (!data?.selectedStaff) return;
    setSelections({
      deptIds: selectedValues(data.departments),
      deptStaff: selectedFromGroups(data.staffGroups),
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
        <div className="col-md-8">
          <label className="form-label" htmlFor="dept_v1_user">Staff (HOD)</label>
          <select
            id="dept_v1_user"
            className="form-select"
            value={data.selectedStaff || ''}
            disabled={busy}
            onChange={(e) => onLoad({ user_name_ref: e.target.value })}
          >
            <option value="">--Select user--</option>
            {data.users?.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>

      {data.selectedStaff && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              user_name_ref: data.selectedStaff,
              r_id: data.recordId ? String(data.recordId) : '',
              dept_name_ref: selections.deptIds,
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
              <label className="form-label">Department</label>
              <MultiSelect
                options={data.departments || []}
                value={selections.deptIds}
                onChange={(deptIds) => setSelections((s) => ({ ...s, deptIds }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Staffs</label>
              <MultiSelect
                groups={data.staffGroups || []}
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

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            <Link
              to={`/admin/setup/staff-auth-hod?uid=${data.selectedStaff}`}
              className="btn btn-success btn-sm"
            >
              Menu Authentication
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
