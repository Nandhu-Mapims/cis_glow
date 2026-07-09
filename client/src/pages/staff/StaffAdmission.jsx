import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  buildRecordsForm,
  EducationTab,
  ExperienceTab,
  FormInput,
  FormSelect,
  SkillsTab,
} from './StaffProfileSections';

function Section({ title, children, className = 'col-md-4' }) {
  return (
    <div className={className}>
      <div className="card shadow-sm h-100">
        <div className="card-header fw-semibold">{title}</div>
        <div className="card-body row g-3">{children}</div>
      </div>
    </div>
  );
}

const initialForm = () => ({
  staffId: '',
  joinedDate: new Date().toISOString().slice(0, 10),
  staffTitle: 'Dr',
  staffName: '',
  staffInitial: '',
  gender: 'Male',
  dateOfBirth: '',
  bloodGroup: '',
  religion: '',
  community: '',
  caste: '',
  maritalStatus: 'Unmarried',
  fatherName: '',
  mobile1: '',
  mobile2: '',
  emailId: '',
  jobCategory: '',
  departmentId: '',
  designationId: '',
  classTypes: [],
  regNo: '',
  regDate: '',
  dentalCouncil: '',
  aadharNo: '',
  panNo: '',
  doorNo: '',
  street: '',
  post: '',
  taluk: '',
  district: '',
  state: '',
  pincode: '',
  bankAcNo: '',
  bankAcName: '',
  bankName: '',
  bankBranch: '',
  bankIfsc: '',
  pfAcNo: '',
  jobType: 'Full Time',
  payrollType: 'academic',
  attendanceCategory: '',
});

export default function StaffAdmission() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [options, setOptions] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [idStatus, setIdStatus] = useState(null);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState(() => buildRecordsForm({}));

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, optionsRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get('/api/staff/admission/options'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        setOptions(optionsRes.data);
        const titles = optionsRes.data?.titles || [];
        if (titles.length) {
          setForm((f) => ({
            ...f,
            staffTitle: titles.includes('Dr') ? 'Dr' : titles[0],
          }));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.departmentId) {
      setDesignations([]);
      return;
    }
    const load = async () => {
      try {
        const res = await api.get('/api/staff/admission/designations', {
          params: { departmentId: form.departmentId },
        });
        setDesignations(res.data.designations || []);
      } catch {
        setDesignations([]);
      }
    };
    load();
  }, [form.departmentId]);

  const checkStaffId = async () => {
    if (!form.staffId.trim()) {
      setIdStatus(null);
      return;
    }
    try {
      const res = await api.get('/api/staff/admission/check-id', {
        params: { staffId: form.staffId.trim() },
      });
      setIdStatus(res.data.available ? 'available' : 'taken');
    } catch {
      setIdStatus(null);
    }
  };

  const toggleLevel = (level) => {
    setForm((prev) => {
      const exists = prev.classTypes.includes(level);
      return {
        ...prev,
        classTypes: exists
          ? prev.classTypes.filter((l) => l !== level)
          : [...prev.classTypes, level],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setCreatedCreds(null);
    try {
      const res = await api.post('/api/staff', {
        ...form,
        education: records.education,
        experience: records.experience,
        activities: records.activities,
      });
      if (res.data?.tempPassword) {
        setCreatedCreds({
          staffId: form.staffId,
          tempPassword: res.data.tempPassword,
          tempPin: res.data.tempPin,
          profileId: res.data.id,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  const fatherLabel = form.maritalStatus === 'Married' ? "Spouse's name" : "Father's name";
  const regCouncils = (options?.education?.regCouncils || []).map((r) => ({
    id: String(r.id),
    name: r.name,
  }));

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center vh-100 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'New Staff' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/staff">Staff</Link></li>
          <li className="breadcrumb-item active">New Profile</li>
        </ol>
      </nav>

      <h3 className="dashboard-title mb-4">Staff Registration</h3>
      {error && <div className="alert alert-danger">{error}</div>}
      {createdCreds && (
        <div className="alert alert-success">
          Staff <strong>{createdCreds.staffId}</strong> created successfully.
          {' '}Temp password: <strong>{createdCreds.tempPassword}</strong>
          {' '}· PIN: <strong>{createdCreds.tempPin}</strong>
          <div className="mt-2">
            <Link to={`/staff/${createdCreds.profileId}`} className="btn btn-sm btn-primary">Open profile</Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="row g-3 mb-3">
          <Section title="Staff Details">
            <div className="col-12">
              <label className="form-label small">Staff ID <span className="text-danger">*</span></label>
              <input
                className="form-control form-control-sm"
                value={form.staffId}
                maxLength={7}
                required
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                onBlur={checkStaffId}
              />
              {options?.lastStaffId && (
                <div className="small text-muted mt-1">
                  Last Staff ID is <strong>{options.lastStaffId}</strong>
                </div>
              )}
              <button type="button" className="btn btn-link btn-sm px-0" onClick={checkStaffId}>
                Check availability
              </button>
              {idStatus === 'available' && <div className="small text-success">Available</div>}
              {idStatus === 'taken' && <div className="small text-danger">Not available</div>}
            </div>
            <div className="col-12">
              <label className="form-label small">Title <span className="text-danger">*</span></label>
              <div className="d-flex flex-wrap gap-3">
                {(options?.titles || ['Dr', 'Mr', 'Mrs', 'Ms']).map((title) => (
                  <label key={title} className="small">
                    <input
                      type="radio"
                      name="staffTitle"
                      checked={form.staffTitle === title}
                      onChange={() => setForm((f) => ({ ...f, staffTitle: title }))}
                    />
                    {' '}{title}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-12">
              <label className="form-label small">Staff name <span className="text-danger">*</span></label>
              <input
                className="form-control form-control-sm"
                value={form.staffName}
                required
                maxLength={155}
                onChange={(e) => setForm((f) => ({ ...f, staffName: e.target.value }))}
              />
            </div>
            <FormInput
              label="Initial"
              value={form.staffInitial}
              onChange={(v) => setForm((f) => ({ ...f, staffInitial: v }))}
              className="col-12"
            />
          </Section>

          <Section title="Personal 1">
            <div className="col-12">
              <label className="form-label small">Gender <span className="text-danger">*</span></label>
              <div className="d-flex flex-wrap gap-3">
                {['Male', 'Female', 'Transgender'].map((g) => (
                  <label key={g} className="small">
                    <input
                      type="radio"
                      name="gender"
                      checked={form.gender === g}
                      onChange={() => setForm((f) => ({ ...f, gender: g }))}
                    />
                    {' '}{g === 'Transgender' ? 'Trans' : g}
                  </label>
                ))}
              </div>
            </div>
            <FormInput label="DOB" value={form.dateOfBirth} onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))} type="date" className="col-12" />
            <FormSelect label="Blood group" value={form.bloodGroup} onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))} options={options?.bloodGroups} className="col-12" />
            <FormSelect label="Religion" value={form.religion} onChange={(v) => setForm((f) => ({ ...f, religion: v }))} options={options?.religions} className="col-12" />
            <FormSelect label="Community" value={form.community} onChange={(v) => setForm((f) => ({ ...f, community: v }))} options={options?.communities} className="col-12" />
            <FormInput label="Caste" value={form.caste} onChange={(v) => setForm((f) => ({ ...f, caste: v }))} className="col-12" />
            <div className="col-12">
              <label className="form-label small">Marital status</label>
              <div className="d-flex gap-3">
                {['Unmarried', 'Married'].map((m) => (
                  <label key={m} className="small">
                    <input
                      type="radio"
                      name="maritalStatus"
                      checked={form.maritalStatus === m}
                      onChange={() => setForm((f) => ({ ...f, maritalStatus: m }))}
                    />
                    {' '}{m}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Personal 2">
            <FormInput label={fatherLabel} value={form.fatherName} onChange={(v) => setForm((f) => ({ ...f, fatherName: v }))} className="col-12" />
            <FormInput label="Mobile 1" value={form.mobile1} onChange={(v) => setForm((f) => ({ ...f, mobile1: v }))} className="col-12" />
            <FormInput label="Mobile 2" value={form.mobile2} onChange={(v) => setForm((f) => ({ ...f, mobile2: v }))} className="col-12" />
            <FormInput label="Email" value={form.emailId} onChange={(v) => setForm((f) => ({ ...f, emailId: v }))} className="col-12" />
          </Section>
        </div>

        <div className="row g-3 mb-3">
          <Section title="Job Details">
            <FormInput label="Date of joining" value={form.joinedDate} onChange={(v) => setForm((f) => ({ ...f, joinedDate: v }))} type="date" className="col-12" />
            <FormSelect label="Category" value={form.jobCategory} onChange={(v) => setForm((f) => ({ ...f, jobCategory: v }))} options={options?.categories} className="col-12" />
            <FormSelect
              label="Department"
              value={form.departmentId}
              onChange={(v) => setForm((f) => ({ ...f, departmentId: v, designationId: '' }))}
              options={options?.departments}
              className="col-12"
            />
            <FormSelect
              label="Designation"
              value={form.designationId}
              onChange={(v) => setForm((f) => ({ ...f, designationId: v }))}
              options={designations.map((d) => ({ id: String(d.id), name: d.name }))}
              className="col-12"
            />
            <div className="col-12">
              <label className="form-label small">Levels</label>
              <div className="d-flex flex-wrap gap-2">
                {(options?.levels || []).map((level) => (
                  <label key={level} className="small border rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={form.classTypes.includes(level)}
                      onChange={() => toggleLevel(level)}
                    />
                    {' '}{level}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Dental Council Registration Details">
            <FormInput label="Reg. no." value={form.regNo} onChange={(v) => setForm((f) => ({ ...f, regNo: v }))} className="col-12" />
            <FormInput label="Reg. date" value={form.regDate} onChange={(v) => setForm((f) => ({ ...f, regDate: v }))} type="date" className="col-12" />
            <FormSelect label="State dental council" value={form.dentalCouncil} onChange={(v) => setForm((f) => ({ ...f, dentalCouncil: v }))} options={regCouncils} className="col-12" />
            <FormInput label="Aadhar no" value={form.aadharNo} onChange={(v) => setForm((f) => ({ ...f, aadharNo: v }))} className="col-12" />
            <FormInput label="PAN no." value={form.panNo} onChange={(v) => setForm((f) => ({ ...f, panNo: v }))} className="col-12" />
          </Section>

          <Section title="Permanent Address">
            <FormInput label="Door no." value={form.doorNo} onChange={(v) => setForm((f) => ({ ...f, doorNo: v }))} className="col-12" />
            <FormInput label="Street" value={form.street} onChange={(v) => setForm((f) => ({ ...f, street: v }))} className="col-12" />
            <FormInput label="Post" value={form.post} onChange={(v) => setForm((f) => ({ ...f, post: v }))} className="col-12" />
            <FormInput label="Taluk" value={form.taluk} onChange={(v) => setForm((f) => ({ ...f, taluk: v }))} className="col-12" />
            <FormInput label="District" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} className="col-12" />
            <FormSelect label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} options={(options?.states || []).map((s) => ({ id: s, name: s }))} className="col-12" />
            <FormInput label="Pincode" value={form.pincode} onChange={(v) => setForm((f) => ({ ...f, pincode: v }))} className="col-12" />
          </Section>
        </div>

        <div className="mb-3">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Educational Qualification</div>
            <EducationTab records={records} setRecords={setRecords} options={options} variant="admission" embedded />
          </div>
        </div>

        <div className="mb-3">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Work Experience</div>
            <ExperienceTab records={records} setRecords={setRecords} options={options} variant="admission" embedded />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold">Extension Activities</div>
              <SkillsTab
                records={records}
                setRecords={setRecords}
                options={options}
                groupKeys={['extra_curricular']}
                showLanguages={false}
                embedded
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold">Add-on Skill Sets</div>
              <SkillsTab
                records={records}
                setRecords={setRecords}
                options={options}
                groupKeys={['extra_skills']}
                showLanguages={false}
                embedded
              />
            </div>
          </div>
          <Section title="Bank Details" className="col-md-4">
            <FormInput label="A/c no." value={form.bankAcNo} onChange={(v) => setForm((f) => ({ ...f, bankAcNo: v }))} className="col-12" />
            <FormInput label="A/c name" value={form.bankAcName} onChange={(v) => setForm((f) => ({ ...f, bankAcName: v }))} className="col-12" />
            <FormSelect label="Bank name" value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} options={options?.banks} className="col-12" />
            <FormInput label="Branch" value={form.bankBranch} onChange={(v) => setForm((f) => ({ ...f, bankBranch: v }))} className="col-12" />
            <FormInput label="IFSC code" value={form.bankIfsc} onChange={(v) => setForm((f) => ({ ...f, bankIfsc: v }))} className="col-12" />
            <FormInput label="PF acc. no." value={form.pfAcNo} onChange={(v) => setForm((f) => ({ ...f, pfAcNo: v }))} className="col-12" />
          </Section>
        </div>

        <div className="d-flex gap-2 mb-4">
          <button type="submit" className="btn btn-danger btn-lg" disabled={saving || idStatus === 'taken' || !!createdCreds}>
            {saving ? 'Saving...' : 'Create New Profile'}
          </button>
          <Link to="/staff" className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </DashboardLayout>
  );
}
