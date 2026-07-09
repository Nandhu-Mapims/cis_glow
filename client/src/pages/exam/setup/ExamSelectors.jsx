import SetupAlerts from '../../fees/setup/SetupAlerts';

function groupOptions(options) {
  const groups = new Map();
  for (const opt of options || []) {
    const g = opt.group || 'Exams';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(opt);
  }
  return [...groups.entries()];
}

export function ExamSelector({ label = 'Exam', value, options, onChange, disabled }) {
  const grouped = groupOptions(options);
  return (
    <div className="mb-3 row g-2">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className="col-sm-4">
        <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">--Select Exam--</option>
          {grouped.map(([group, opts]) => (
            <optgroup key={group} label={group}>
              {opts.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

export function CourseSemesterSelector({ courseGroups, value, onChange, disabled }) {
  if (!courseGroups?.length) return null;
  return (
    <>
      {courseGroups.map((group) => (
        <div key={group.courseId} className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">{group.degreeLabel}</label>
          <div className="col-sm-10 d-flex flex-wrap gap-3">
            {group.semesters.map((sem) => (
              <label key={sem.value} className="form-check-label">
                <input
                  type="radio"
                  className="form-check-input me-1"
                  name="course_semester"
                  value={sem.value}
                  checked={value === sem.value}
                  onChange={() => onChange(sem.value)}
                  disabled={disabled}
                />
                {sem.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function CourseYearSelector({ label = 'Course & Academic year', options, value, onChange, disabled, wide = false }) {
  const grouped = groupOptions(options);
  return (
    <div className="mb-3 row g-2">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className={wide ? 'col-sm-8' : 'col-sm-4'}>
        <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">--Select Course--</option>
          {grouped.map(([group, opts]) => (
            <optgroup key={group} label={group}>
              {opts.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ExamSetupShell({ notice, error, busy, onDismissNotice, children }) {
  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={onDismissNotice} />
      {children}
    </>
  );
}
