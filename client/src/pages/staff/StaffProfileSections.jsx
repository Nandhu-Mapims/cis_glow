import { FormSection } from '../../components/FormShell';

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Field({ label, value }) {
  return (
    <div className="col-md-4">
      <div className="cis-view-label">{label}</div>
      <div className="cis-view-value">{value || '—'}</div>
    </div>
  );
}

export function optionLabel(list, id) {
  if (!id) return '—';
  const found = (list || []).find((o) => String(o.id) === String(id));
  return found?.name || found?.shortName || id;
}

export function FormInput({ label, value, onChange, type = 'text', className = 'col-md-4 mb-3' }) {
  return (
    <div className={className}>
      <label className="form-label small">{label}</label>
      <input className="form-control form-control-sm" type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  options = [],
  optionValue = 'id',
  optionLabelKey = 'name',
  className = 'col-md-4 mb-3',
}) {
  const list = Array.isArray(options) ? options : [];
  const displayValue = value == null ? '' : String(value);

  const optionText = (o) => {
    if (o == null || typeof o !== 'object') return String(o ?? '');
    return String(
      o[optionLabelKey]
      ?? o.name
      ?? o.label
      ?? o.shortName
      ?? o.id
      ?? '',
    );
  };

  return (
    <div className={className}>
      <label className="form-label small">{label}</label>
      <select className="form-select form-select-sm" value={displayValue} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {list.map((o) => {
          const optValue = o?.[optionValue] ?? o;
          const key = String(optValue);
          return (
            <option key={key} value={key}>
              {optionText(o)}
            </option>
          );
        })}
      </select>
    </div>
  );
}

const EMPTY_EDU = {
  courseId: '', degreeId: '', majorId: '', courseTypeId: '', yop: '', percentage: '',
  institution: '', universityId: '', regNo: '', regDate: '', regCouncilId: '', attempt: '1', attachment: '',
};

const EMPTY_EXP = {
  institutionTypeId: '', institution: '', location: '', experienceTypeId: '',
  fromDate: '', toDate: '', description: '', totalExperience: '', attachment: '',
};

const EMPTY_AWARD = { year: '', title: '', notes: '' };

function formDateValue(value) {
  if (!value || String(value).startsWith('0000-')) return '';
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function formSelectValue(value) {
  return value == null ? '' : String(value);
}

export function buildProfileForm(p) {
  return {
    staffId: p.staffId ?? '',
    staffName: p.staffName ?? '',
    staffInitial: p.staffInitial ?? '',
    staffTitle: p.staffTitle ?? '',
    gender: p.gender ?? '',
    bloodGroup: formSelectValue(p.bloodGroup),
    religion: formSelectValue(p.religion),
    community: formSelectValue(p.community),
    caste: p.caste ?? '',
    maritalStatus: p.maritalStatus ?? '',
    fatherName: p.fatherName ?? '',
    spouseName: p.spouseName ?? '',
    mobile1: p.mobile1 ?? '',
    mobile2: p.mobile2 ?? '',
    landlineNo: p.landlineNo ?? '',
    emailId: p.emailId ?? '',
    joinedDate: formDateValue(p.joinedDate),
    jobCategoryId: formSelectValue(p.jobCategoryId),
    departmentId: formSelectValue(p.departmentId),
    classTypes: p.classTypes || [],
    unitType: p.unitType ?? '',
    jobType: p.jobType ?? 'Full Time',
    payrollType: p.payrollType ?? 'academic',
    attCategory: formSelectValue(p.attCategory),
    attenAuth: !!p.attenAuth,
    doorNo: p.doorNo ?? '',
    street: p.street ?? '',
    post: p.post ?? '',
    taluk: p.taluk ?? '',
    district: p.district ?? '',
    state: p.state ?? '',
    country: p.country ?? 'India',
    pincode: p.pincode ?? '',
    usesQuartersAddress: !!p.usesQuartersAddress,
    quartersDate: formDateValue(p.quartersDate),
    cDoorNo: p.cDoorNo ?? '',
    cStreet: p.cStreet ?? '',
    cPost: p.cPost ?? '',
    cTaluk: p.cTaluk ?? '',
    cDistrict: p.cDistrict ?? '',
    cState: p.cState ?? '',
    cPincode: p.cPincode ?? '',
    aadharNo: p.aadharNo ?? '',
    panNo: p.panNo ?? '',
    passportNo: p.passportNo ?? '',
    drivingLic: p.drivingLic ?? '',
    voterId: p.voterId ?? '',
    ebProof: p.ebProof ?? '',
    rentalAgree: p.rentalAgree ?? '',
    bankAcNo: p.bankAcNo ?? '',
    bankAcName: p.bankAcName ?? '',
    bankName: formSelectValue(p.bankName),
    bankBranch: p.bankBranch ?? '',
    bankIfsc: p.bankIfsc ?? '',
    pfAcNo: p.pfAcNo ?? '',
    pfUan: p.pfUan ?? '',
    esiNo: p.esiNo ?? '',
    appoiOrderNo: p.appoiOrderNo ?? '',
    appoiOrderDate: formDateValue(p.appoiOrderDate),
    salary1: p.salary1 ?? '',
    preAppNo: p.preAppNo ?? '',
    preRelivNo: p.preRelivNo ?? '',
    preExpNo: p.preExpNo ?? '',
    pvtClinicName: p.pvtClinicName ?? '',
    pvtClinicCity: p.pvtClinicCity ?? '',
    pvtClinicRemarks: p.pvtClinicRemarks ?? '',
  };
}

export function buildRecordsForm(p) {
  return {
    education: (p.education?.length ? p.education : [{ ...EMPTY_EDU }]).map((r) => ({ ...EMPTY_EDU, ...r })),
    experience: (p.experience?.length ? p.experience : [{ ...EMPTY_EXP }]).map((r) => ({ ...EMPTY_EXP, ...r })),
    awards: (p.awards?.length ? p.awards : [{ ...EMPTY_AWARD }]).map((r) => ({ ...EMPTY_AWARD, ...r })),
    languageIds: p.languageIds || [],
    activities: p.activities || {},
  };
}

export function OverviewTab({ profile }) {
  const levels = (profile.classTypes || []).join(', ');
  const address = [profile.doorNo, profile.street, profile.post, profile.district, profile.state, profile.pincode]
    .filter(Boolean).join(', ');
  const commAddress = [profile.cDoorNo, profile.cStreet, profile.cPost, profile.cDistrict, profile.cState, profile.cPincode]
    .filter(Boolean).join(', ');

  return (
    <div className="cis-form-main">
      <FormSection id="ov-employment" title="Employment" grid>
        <Field label="Joined" value={profile.joinedDate} />
        <Field label="Payroll category" value={profile.jobCategoryName} />
        <Field label="Department" value={profile.currentDepartmentName || profile.departmentName} />
        <Field label="Designation" value={profile.currentDesignationName || profile.designationName} />
        <Field label="Unit" value={profile.unitType} />
        <Field label="Levels" value={levels} />
        <Field label="Job type" value={profile.jobType} />
        <Field label="Payroll type" value={profile.payrollType} />
        <Field label="Attendance category" value={profile.attCategoryName} />
        <Field label="Att. authentication" value={profile.attenAuth ? 'Yes' : 'No'} />
        <Field label="Appointment order" value={profile.appoiOrderNo} />
        <Field label="Appointment date" value={profile.appoiOrderDate} />
        <Field label="Starting pay" value={profile.salary1} />
        <Field label="Relieving date" value={profile.releavingDate} />
      </FormSection>

      <FormSection id="ov-personal" title="Personal" grid>
        <Field label="DOB" value={profile.dateOfBirth} />
        <Field label="PAN" value={profile.panNo} />
        <Field label="Bank A/c" value={profile.bankAcNo} />
      </FormSection>

      <FormSection id="ov-contact" title="Contact & Address" grid>
        <Field label="Email" value={profile.emailId} />
        <Field label="Mobile" value={profile.mobile1} />
        <Field label="Alternate mobile" value={profile.mobile2} />
        <Field label="Address" value={address} />
        <Field label="Communication address" value={profile.usesQuartersAddress ? `Quarters${commAddress ? `: ${commAddress}` : ''}` : commAddress} />
      </FormSection>

      <FormSection id="ov-history" title="Department / Designation History" grid={false}>
        {profile.designations?.length ? (
          <div className="cis-dt-scroll">
            <table className="cis-dt-table">
              <thead>
                <tr><th>Designation</th><th>Department</th><th>Unit</th><th>From</th><th>To</th></tr>
              </thead>
              <tbody>
                {profile.designations.map((d) => (
                  <tr key={d.id}>
                    <td>{d.designationName || d.designationId}</td>
                    <td>{d.departmentName || '—'}</td>
                    <td>{d.unitType || '—'}</td>
                    <td className="cis-dt-num">{d.fromDate || '?'}</td>
                    <td className="cis-dt-num">{d.toDate || 'present'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <span className="text-muted">No designation records.</span>
        )}
      </FormSection>
    </div>
  );
}

export function PersonalEditTab({ form, setForm, options }) {
  const toggleLevel = (level) => {
    setForm((prev) => {
      const set = new Set(prev.classTypes || []);
      if (set.has(level)) set.delete(level);
      else set.add(level);
      return { ...prev, classTypes: [...set] };
    });
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h6 className="mb-3">Staff &amp; job</h6>
        <div className="row">
          <FormInput label="Staff ID" value={form.staffId} onChange={(v) => setForm((p) => ({ ...p, staffId: v }))} />
          <FormSelect label="Title" value={form.staffTitle} onChange={(v) => setForm((p) => ({ ...p, staffTitle: v }))} options={(options?.titles || []).map((t) => ({ id: t, name: t }))} />
          <FormInput label="Name" value={form.staffName} onChange={(v) => setForm((p) => ({ ...p, staffName: v }))} />
          <FormInput label="Initial" value={form.staffInitial} onChange={(v) => setForm((p) => ({ ...p, staffInitial: v }))} />
          <FormInput label="Joined date" value={form.joinedDate} onChange={(v) => setForm((p) => ({ ...p, joinedDate: v }))} type="date" />
          <FormSelect label="Category" value={form.jobCategoryId} onChange={(v) => setForm((p) => ({ ...p, jobCategoryId: v }))} options={options?.categories} />
          <FormSelect label="Department" value={form.departmentId} onChange={(v) => setForm((p) => ({ ...p, departmentId: v }))} options={options?.departments} />
          <div className="col-md-4 mb-3">
            <label className="form-label small">Unit</label>
            <div className="d-flex gap-3 pt-1">
              {['I', 'II'].map((u) => (
                <label key={u} className="small">
                  <input className="me-2" type="radio" name="unitType" checked={form.unitType === u} onChange={() => setForm((p) => ({ ...p, unitType: u }))} />
                  {' '}{u}
                </label>
              ))}
            </div>
          </div>
          <div className="col-md-8 mb-3">
            <label className="form-label small">Levels</label>
            <div className="d-flex flex-wrap gap-2">
              {(options?.levels || []).map((level) => (
                <label key={level} className="small border rounded px-2 py-1">
                  <input type="checkbox" checked={(form.classTypes || []).includes(level)} onChange={() => toggleLevel(level)} />
                  {' '}{level}
                </label>
              ))}
            </div>
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label small">Job type</label>
            <div className="d-flex gap-3 pt-1">
              {['Full Time', 'Part Time'].map((jt) => (
                <label key={jt} className="small">
                  <input className="me-2" type="radio" name="jobType" checked={form.jobType === jt} onChange={() => setForm((p) => ({ ...p, jobType: jt }))} />
                  {' '}{jt}
                </label>
              ))}
            </div>
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label small">Payroll type</label>
            <div className="d-flex gap-3 pt-1">
              {['academic', 'fixed'].map((pt) => (
                <label key={pt} className="small">
                  <input className="me-2" type="radio" name="payrollType" checked={form.payrollType === pt} onChange={() => setForm((p) => ({ ...p, payrollType: pt, attCategory: '' }))} />
                  {' '}{pt}
                </label>
              ))}
            </div>
          </div>
          <FormSelect
            label="Attendance category"
            value={form.attCategory}
            onChange={(v) => setForm((p) => ({ ...p, attCategory: v }))}
            options={form.payrollType === 'fixed' ? options?.payrollTypes : options?.attendanceTypes}
            optionLabelKey={form.payrollType === 'fixed' ? 'name' : 'label'}
          />
          <div className="col-md-4 mb-3 d-flex align-items-end">
            <label className="small mb-2">
              <input type="checkbox" checked={!!form.attenAuth} onChange={(e) => setForm((p) => ({ ...p, attenAuth: e.target.checked }))} />
              {' '}Attendance authentication
            </label>
          </div>
        </div>

        <h6 className="mb-3 mt-2">Personal</h6>
        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label small">Gender</label>
            <div className="d-flex gap-3 pt-1">
              {['Male', 'Female'].map((g) => (
                <label key={g} className="small">
                  <input className="me-2" type="radio" name="gender" checked={form.gender === g} onChange={() => setForm((p) => ({ ...p, gender: g }))} />
                  {' '}{g}
                </label>
              ))}
            </div>
          </div>
          <FormSelect label="Blood group" value={form.bloodGroup} onChange={(v) => setForm((p) => ({ ...p, bloodGroup: v }))} options={options?.bloodGroups} />
          <FormSelect label="Religion" value={form.religion} onChange={(v) => setForm((p) => ({ ...p, religion: v }))} options={options?.religions} />
          <FormSelect label="Community" value={form.community} onChange={(v) => setForm((p) => ({ ...p, community: v }))} options={options?.communities} />
          <FormInput label="Caste" value={form.caste} onChange={(v) => setForm((p) => ({ ...p, caste: v }))} />
          <div className="col-md-4 mb-3">
            <label className="form-label small">Marital status</label>
            <div className="d-flex gap-3 pt-1">
              {['Unmarried', 'Married'].map((m) => (
                <label key={m} className="small">
                  <input className="me-2" type="radio" name="maritalStatus" checked={form.maritalStatus === m} onChange={() => setForm((p) => ({ ...p, maritalStatus: m }))} />
                  {' '}{m}
                </label>
              ))}
            </div>
          </div>
          <FormInput label="Father name" value={form.fatherName} onChange={(v) => setForm((p) => ({ ...p, fatherName: v }))} />
          <FormInput label="Spouse name" value={form.spouseName} onChange={(v) => setForm((p) => ({ ...p, spouseName: v }))} />
          <FormInput label="Mobile 1" value={form.mobile1} onChange={(v) => setForm((p) => ({ ...p, mobile1: v }))} />
          <FormInput label="Mobile 2" value={form.mobile2} onChange={(v) => setForm((p) => ({ ...p, mobile2: v }))} />
          <FormInput label="Landline" value={form.landlineNo} onChange={(v) => setForm((p) => ({ ...p, landlineNo: v }))} />
          <FormInput label="Email" value={form.emailId} onChange={(v) => setForm((p) => ({ ...p, emailId: v }))} />
        </div>

        <h6 className="mb-3 mt-2">Permanent address</h6>
        <div className="row">
          <FormInput label="Door no" value={form.doorNo} onChange={(v) => setForm((p) => ({ ...p, doorNo: v }))} />
          <FormInput label="Street" value={form.street} onChange={(v) => setForm((p) => ({ ...p, street: v }))} />
          <FormInput label="Post" value={form.post} onChange={(v) => setForm((p) => ({ ...p, post: v }))} />
          <FormInput label="Taluk" value={form.taluk} onChange={(v) => setForm((p) => ({ ...p, taluk: v }))} />
          <FormInput label="District" value={form.district} onChange={(v) => setForm((p) => ({ ...p, district: v }))} />
          <FormSelect label="State" value={form.state} onChange={(v) => setForm((p) => ({ ...p, state: v }))} options={(options?.states || []).map((s) => ({ id: s, name: s }))} />
          <FormInput label="Pincode" value={form.pincode} onChange={(v) => setForm((p) => ({ ...p, pincode: v }))} />
        </div>

        <h6 className="mb-3 mt-2">Communication / quarters</h6>
        <div className="row">
          <div className="col-12 mb-2">
            <label className="small">
              <input type="checkbox" checked={!!form.usesQuartersAddress} onChange={(e) => setForm((p) => ({ ...p, usesQuartersAddress: e.target.checked }))} />
              {' '}Use quarters as communication address
            </label>
          </div>
          {form.usesQuartersAddress && (
            <FormInput label="Quarters date" value={form.quartersDate} onChange={(v) => setForm((p) => ({ ...p, quartersDate: v }))} type="date" className="col-md-4 mb-3" />
          )}
          <FormInput label="Comm. door no" value={form.cDoorNo} onChange={(v) => setForm((p) => ({ ...p, cDoorNo: v }))} />
          <FormInput label="Comm. street" value={form.cStreet} onChange={(v) => setForm((p) => ({ ...p, cStreet: v }))} />
          <FormInput label="Comm. post" value={form.cPost} onChange={(v) => setForm((p) => ({ ...p, cPost: v }))} />
          <FormInput label="Comm. district" value={form.cDistrict} onChange={(v) => setForm((p) => ({ ...p, cDistrict: v }))} />
          <FormInput label="Comm. state" value={form.cState} onChange={(v) => setForm((p) => ({ ...p, cState: v }))} />
          <FormInput label="Comm. pincode" value={form.cPincode} onChange={(v) => setForm((p) => ({ ...p, cPincode: v }))} />
        </div>

        <h6 className="mb-3 mt-2">Photo ID &amp; bank</h6>
        <div className="row">
          <FormInput label="Aadhar" value={form.aadharNo} onChange={(v) => setForm((p) => ({ ...p, aadharNo: v }))} />
          <FormInput label="PAN" value={form.panNo} onChange={(v) => setForm((p) => ({ ...p, panNo: v }))} />
          <FormInput label="Passport" value={form.passportNo} onChange={(v) => setForm((p) => ({ ...p, passportNo: v }))} />
          <FormInput label="Driving licence" value={form.drivingLic} onChange={(v) => setForm((p) => ({ ...p, drivingLic: v }))} />
          <FormInput label="Voter ID" value={form.voterId} onChange={(v) => setForm((p) => ({ ...p, voterId: v }))} />
          <FormInput label="Electricity service no" value={form.ebProof} onChange={(v) => setForm((p) => ({ ...p, ebProof: v }))} />
          <FormInput label="Quarters / rental agreement" value={form.rentalAgree} onChange={(v) => setForm((p) => ({ ...p, rentalAgree: v }))} />
          <FormInput label="Bank A/c no" value={form.bankAcNo} onChange={(v) => setForm((p) => ({ ...p, bankAcNo: v }))} />
          <FormInput label="A/c name" value={form.bankAcName} onChange={(v) => setForm((p) => ({ ...p, bankAcName: v }))} />
          <FormSelect label="Bank" value={form.bankName} onChange={(v) => setForm((p) => ({ ...p, bankName: v }))} options={options?.banks} />
          <FormInput label="Branch" value={form.bankBranch} onChange={(v) => setForm((p) => ({ ...p, bankBranch: v }))} />
          <FormInput label="IFSC" value={form.bankIfsc} onChange={(v) => setForm((p) => ({ ...p, bankIfsc: v }))} />
          <FormInput label="PF A/c no" value={form.pfAcNo} onChange={(v) => setForm((p) => ({ ...p, pfAcNo: v }))} />
          <FormInput label="PF UAN" value={form.pfUan} onChange={(v) => setForm((p) => ({ ...p, pfUan: v }))} />
          <FormInput label="ESI no" value={form.esiNo} onChange={(v) => setForm((p) => ({ ...p, esiNo: v }))} />
        </div>

        <h6 className="mb-3 mt-2">Appointment &amp; previous employment</h6>
        <div className="row">
          <FormInput label="Appointment order no" value={form.appoiOrderNo} onChange={(v) => setForm((p) => ({ ...p, appoiOrderNo: v }))} />
          <FormInput label="Appointment order date" value={form.appoiOrderDate} onChange={(v) => setForm((p) => ({ ...p, appoiOrderDate: v }))} type="date" />
          <FormInput label="Starting pay" value={form.salary1} onChange={(v) => setForm((p) => ({ ...p, salary1: v }))} />
          <FormInput label="Prev. appointment order" value={form.preAppNo} onChange={(v) => setForm((p) => ({ ...p, preAppNo: v }))} />
          <FormInput label="Prev. relieving order" value={form.preRelivNo} onChange={(v) => setForm((p) => ({ ...p, preRelivNo: v }))} />
          <FormInput label="Prev. experience certificate" value={form.preExpNo} onChange={(v) => setForm((p) => ({ ...p, preExpNo: v }))} />
          <FormInput label="Private clinic name" value={form.pvtClinicName} onChange={(v) => setForm((p) => ({ ...p, pvtClinicName: v }))} />
          <FormInput label="Clinic city" value={form.pvtClinicCity} onChange={(v) => setForm((p) => ({ ...p, pvtClinicCity: v }))} />
          <div className="col-md-8 mb-3">
            <label className="form-label small">Private practice details</label>
            <textarea className="form-control form-control-sm" rows={2} value={form.pvtClinicRemarks || ''} onChange={(e) => setForm((p) => ({ ...p, pvtClinicRemarks: e.target.value }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RowTable({ columns, rows, onChange, onAdd, onRemove, emptyRow }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-bordered align-middle">
        <thead className="table-secondary">
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || `row-${i}`}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.type === 'select' ? (
                    <select className="form-select form-select-sm" value={row[c.key] || ''} onChange={(e) => onChange(i, c.key, e.target.value)}>
                      <option value="">--</option>
                      {(c.options || []).map((o) => <option key={o.id} value={o.id}>{o.shortName || o.name}</option>)}
                    </select>
                  ) : (
                    <input
                      className="form-control form-control-sm"
                      type={c.type || 'text'}
                      value={row[c.key] || ''}
                      min={c.type === 'date' && c.minKey ? row[c.minKey] || undefined : undefined}
                      max={c.type === 'date' && c.maxKey ? row[c.maxKey] || undefined : undefined}
                      onChange={(e) => onChange(i, c.key, e.target.value)}
                    />
                  )}
                </td>
              ))}
              <td className="text-nowrap">
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onRemove(i)} disabled={rows.length <= 1}>−</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onAdd(emptyRow)}>+ Add row</button>
    </div>
  );
}

export function EducationTab({ records, setRecords, options, variant, embedded = false }) {
  const edu = options?.education || {};
  const update = (i, key, val) => setRecords((p) => ({
    ...p,
    education: p.education.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)),
  }));
  const allColumns = [
    { key: 'courseId', label: 'Course', type: 'select', options: edu.courses },
    { key: 'degreeId', label: 'Degree', type: 'select', options: edu.degrees },
    { key: 'majorId', label: 'Major', type: 'select', options: edu.majors },
    { key: 'courseTypeId', label: 'Stream', type: 'select', options: edu.courseTypes },
    { key: 'yop', label: 'YOP' },
    { key: 'percentage', label: '%' },
    { key: 'institution', label: 'Institution' },
    { key: 'universityId', label: 'Board/Univ.', type: 'select', options: edu.universities },
    { key: 'regNo', label: 'Reg no' },
    { key: 'regDate', label: 'Reg date', type: 'date' },
    { key: 'regCouncilId', label: 'Council', type: 'select', options: edu.regCouncils },
    { key: 'attempt', label: '#Atp' },
  ];
  const columns = variant === 'admission'
    ? allColumns.filter((c) => !['regNo', 'regDate', 'regCouncilId'].includes(c.key))
    : allColumns;

  const body = (
    <RowTable
      rows={records.education}
      emptyRow={EMPTY_EDU}
      onAdd={(row) => setRecords((p) => ({ ...p, education: [...p.education, { ...row }] }))}
      onRemove={(i) => setRecords((p) => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }))}
      onChange={update}
      columns={columns}
    />
  );
  if (embedded) {
    return <div className="card-body">{body}</div>;
  }
  return (
    <div className="card shadow-sm">
      <div className="card-body">{body}</div>
    </div>
  );
}

export function ExperienceTab({ records, setRecords, options, variant, embedded = false }) {
  const exp = options?.experience || {};
  const update = (i, key, val) => setRecords((p) => ({
    ...p,
    experience: p.experience.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)),
  }));
  const allColumns = [
    { key: 'institution', label: 'Name' },
    { key: 'location', label: 'Job title' },
    { key: 'institutionTypeId', label: 'Inst. type', type: 'select', options: exp.institutionTypes },
    { key: 'experienceTypeId', label: 'Exp. type', type: 'select', options: exp.experienceTypes },
    { key: 'fromDate', label: 'From', type: 'date', maxKey: 'toDate' },
    { key: 'toDate', label: 'To', type: 'date', minKey: 'fromDate' },
    { key: 'description', label: 'Description' },
    { key: 'totalExperience', label: 'Total years' },
  ];
  const columns = variant === 'admission'
    ? allColumns.filter((c) => !['institutionTypeId', 'experienceTypeId', 'totalExperience'].includes(c.key))
    : allColumns;
  const body = (
    <RowTable
      rows={records.experience}
      emptyRow={EMPTY_EXP}
      onAdd={(row) => setRecords((p) => ({ ...p, experience: [...p.experience, { ...row }] }))}
      onRemove={(i) => setRecords((p) => ({ ...p, experience: p.experience.filter((_, idx) => idx !== i) }))}
      onChange={update}
      columns={columns}
    />
  );
  if (embedded) {
    return <div className="card-body">{body}</div>;
  }
  return (
    <div className="card shadow-sm">
      <div className="card-body">{body}</div>
    </div>
  );
}

export function AwardsTab({ records, setRecords, embedded = false }) {
  const update = (i, key, val) => setRecords((p) => ({
    ...p,
    awards: p.awards.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)),
  }));
  const body = (
    <RowTable
      rows={records.awards}
      emptyRow={EMPTY_AWARD}
      onAdd={(row) => setRecords((p) => ({ ...p, awards: [...p.awards, { ...row }] }))}
      onRemove={(i) => setRecords((p) => ({ ...p, awards: p.awards.filter((_, idx) => idx !== i) }))}
      onChange={update}
      columns={[
        { key: 'year', label: 'Year' },
        { key: 'title', label: 'Appreciation received' },
        { key: 'notes', label: 'Summary' },
      ]}
    />
  );
  if (embedded) return body;
  return (
    <div className="card shadow-sm">
      <div className="card-body">{body}</div>
    </div>
  );
}

export function SkillsTab({ records, setRecords, options, groupKeys, showLanguages = true, embedded = false }) {
  const toggleLanguage = (langId) => {
    setRecords((p) => {
      const set = new Set(p.languageIds || []);
      const id = String(langId);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...p, languageIds: [...set] };
    });
  };

  const toggleActivity = (groupKey, activityId, subOptions = []) => {
    setRecords((p) => {
      const list = [...(p.activities?.[groupKey] || [])];
      const idx = list.findIndex((a) => String(a.activityId) === String(activityId));
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push({ activityId: String(activityId), activityTypes: subOptions.length === 1 ? [subOptions[0]] : [] });
      }
      return { ...p, activities: { ...p.activities, [groupKey]: list } };
    });
  };

  const isActivityChecked = (groupKey, activityId) => (
    (records.activities?.[groupKey] || []).some((a) => String(a.activityId) === String(activityId))
  );

  const body = (
    <>
      {showLanguages && (
        <>
          <h6>Languages known</h6>
          <div className="d-flex flex-wrap gap-2 mb-4">
            {(options?.languages || []).map((lang) => (
              <label key={lang.id} className="small border rounded px-2 py-1">
                <input type="checkbox" checked={(records.languageIds || []).includes(String(lang.id))} onChange={() => toggleLanguage(lang.id)} />
                {' '}{lang.shortName || lang.name}
              </label>
            ))}
          </div>
        </>
      )}
      {(options?.activityGroups || [])
        .filter((group) => !groupKeys || groupKeys.includes(group.key))
        .map((group) => (
          <div key={group.key} className="mb-4">
            {!(embedded && groupKeys?.length === 1) && <h6>{group.label}</h6>}
            <div className="row g-2">
              {(group.items || []).map((item) => {
                const subs = String(item.subCategory || '').split(',').map((s) => s.trim()).filter(Boolean);
                const checked = isActivityChecked(group.key, item.id);
                const selected = (records.activities?.[group.key] || []).find((a) => String(a.activityId) === String(item.id));
                return (
                  <div key={item.id} className="col-md-6">
                    <label className="small d-block mb-1">
                      <input type="checkbox" checked={checked} onChange={() => toggleActivity(group.key, item.id, subs)} />
                      {' '}{item.shortName || item.name}
                    </label>
                    {checked && subs.length > 0 && (
                      <select
                        multiple
                        className="form-select form-select-sm"
                        value={selected?.activityTypes || []}
                        onChange={(e) => {
                          const vals = [...e.target.selectedOptions].map((o) => o.value);
                          setRecords((p) => ({
                            ...p,
                            activities: {
                              ...p.activities,
                              [group.key]: (p.activities?.[group.key] || []).map((a) => (
                                String(a.activityId) === String(item.id) ? { ...a, activityTypes: vals } : a
                              )),
                            },
                          }));
                        }}
                      >
                        {subs.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </>
  );

  if (embedded) {
    return <div className="card-body">{body}</div>;
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body">{body}</div>
    </div>
  );
}
