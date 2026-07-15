import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import StaffPageShell, { STAFF_BREADCRUMB_HUB } from './StaffPageShell';
import { FormActionBar, FormSection, FormSectionNav, useScrollSpy } from '../../components/FormShell';
import {
  buildRecordsForm,
  EducationTab,
  ExperienceTab,
  FormInput,
  FormSelect,
  SkillsTab,
} from './StaffProfileSections';

// Section order mirrors the form + drives the scroll-spy jump nav (matches StudentAdmission.jsx).
const SECTIONS = [
  { id: 'staff', title: 'Staff Details' },
  { id: 'personal', title: 'Personal Details' },
  { id: 'contact', title: 'Contact' },
  { id: 'job', title: 'Job Details' },
  { id: 'registration', title: 'Council Registration' },
  { id: 'address', title: 'Permanent Address' },
  { id: 'education', title: 'Education' },
  { id: 'experience', title: 'Experience' },
  { id: 'activities', title: 'Activities & Skills' },
  { id: 'bank', title: 'Bank Details' },
];

const FIELD_COL = 'col-md-4';

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
  const navigate = useNavigate();
  const { settings, menu } = useOutletContext();
  const [options, setOptions] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [idStatus, setIdStatus] = useState(null);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState(() => buildRecordsForm({}));

  const activeSection = useScrollSpy(SECTIONS.map((s) => s.id), !loading);

  useEffect(() => {
    const load = async () => {
      try {
        const optionsRes = await api.get('/api/staff/admission/options');
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

  return (
    <StaffPageShell
      settings={settings}
      menu={menu}
      loading={loading}
      dashboardTitle="New Staff"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        STAFF_BREADCRUMB_HUB,
        { label: 'New Profile' },
      ]}
      title="Staff Registration"
      actions={<Link to="/staff/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>}
      notice={(
        <>
          {error && <div className="alert alert-danger mb-0">{error}</div>}
          {createdCreds && (
            <div className="alert alert-success mb-0">
              Staff <strong>{createdCreds.staffId}</strong> created successfully.
              {' '}Temp password: <strong>{createdCreds.tempPassword}</strong>
              {' '}· PIN: <strong>{createdCreds.tempPin}</strong>
              <div className="mt-2">
                <Link to={`/staff/${createdCreds.profileId}`} className="btn btn-sm btn-primary">Open profile</Link>
              </div>
            </div>
          )}
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="cis-form-layout">
        <FormSectionNav sections={SECTIONS} activeId={activeSection} />
        <div className="cis-form-main">
          <FormSection id="staff" title="Staff Details">
            <div className={FIELD_COL}>
              <label className="form-label" htmlFor="staffId">Staff ID <span className="text-danger">*</span></label>
              <input
                id="staffId"
                className="form-control"
                value={form.staffId}
                maxLength={7}
                required
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                onBlur={checkStaffId}
              />
              {options?.lastStaffId && (
                <div className="cis-searchbar-hint mb-0 mt-1">
                  Last Staff ID is <strong>{options.lastStaffId}</strong>
                </div>
              )}
              <button type="button" className="btn btn-link btn-sm px-0" onClick={checkStaffId}>
                Check availability
              </button>
              {idStatus === 'available' && <div className="small text-success">Available</div>}
              {idStatus === 'taken' && <div className="small text-danger">Not available</div>}
            </div>
            <div className={FIELD_COL}>
              <label className="form-label">Title <span className="text-danger">*</span></label>
              <div className="d-flex flex-wrap gap-3 pt-1">
                {(options?.titles || ['Dr', 'Mr', 'Mrs', 'Ms']).map((title) => (
                  <label key={title} className="d-inline-flex align-items-center gap-2">
                    <input
                      type="radio"
                      name="staffTitle"
                      checked={form.staffTitle === title}
                      onChange={() => setForm((f) => ({ ...f, staffTitle: title }))}
                    />
                    {title}
                  </label>
                ))}
              </div>
            </div>
            <div className={FIELD_COL}>
              <label className="form-label" htmlFor="staffName">Staff Name <span className="text-danger">*</span></label>
              <input
                id="staffName"
                className="form-control"
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
              className={FIELD_COL}
            />
          </FormSection>

          <FormSection id="personal" title="Personal Details">
            <div className="col-12">
              <label className="form-label">Gender <span className="text-danger">*</span></label>
              <div className="d-flex flex-wrap gap-3 pt-1">
                {['Male', 'Female', 'Transgender'].map((g) => (
                  <label key={g} className="d-inline-flex align-items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      checked={form.gender === g}
                      onChange={() => setForm((f) => ({ ...f, gender: g }))}
                    />
                    {g}
                  </label>
                ))}
              </div>
            </div>
            <FormInput label="Date of Birth" value={form.dateOfBirth} onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))} type="date" className={FIELD_COL} />
            <FormSelect label="Blood Group" value={form.bloodGroup} onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))} options={options?.bloodGroups} className={FIELD_COL} />
            <FormSelect label="Religion" value={form.religion} onChange={(v) => setForm((f) => ({ ...f, religion: v }))} options={options?.religions} className={FIELD_COL} />
            <FormSelect label="Community" value={form.community} onChange={(v) => setForm((f) => ({ ...f, community: v }))} options={options?.communities} className={FIELD_COL} />
            <FormInput label="Caste" value={form.caste} onChange={(v) => setForm((f) => ({ ...f, caste: v }))} className={FIELD_COL} />
            <div className={FIELD_COL}>
              <label className="form-label">Marital Status</label>
              <div className="d-flex flex-wrap gap-3 pt-1">
                {['Unmarried', 'Married'].map((m) => (
                  <label key={m} className="d-inline-flex align-items-center gap-2">
                    <input
                      type="radio"
                      name="maritalStatus"
                      checked={form.maritalStatus === m}
                      onChange={() => setForm((f) => ({ ...f, maritalStatus: m }))}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          <FormSection id="contact" title="Contact">
            <FormInput label={fatherLabel} value={form.fatherName} onChange={(v) => setForm((f) => ({ ...f, fatherName: v }))} className={FIELD_COL} />
            <FormInput label="Mobile 1" value={form.mobile1} onChange={(v) => setForm((f) => ({ ...f, mobile1: v }))} className={FIELD_COL} />
            <FormInput label="Mobile 2" value={form.mobile2} onChange={(v) => setForm((f) => ({ ...f, mobile2: v }))} className={FIELD_COL} />
            <FormInput label="Email" value={form.emailId} onChange={(v) => setForm((f) => ({ ...f, emailId: v }))} className={FIELD_COL} />
          </FormSection>

          <FormSection id="job" title="Job Details">
            <FormInput label="Date of Joining" value={form.joinedDate} onChange={(v) => setForm((f) => ({ ...f, joinedDate: v }))} type="date" className={FIELD_COL} />
            <FormSelect label="Category" value={form.jobCategory} onChange={(v) => setForm((f) => ({ ...f, jobCategory: v }))} options={options?.categories} className={FIELD_COL} />
            <FormSelect
              label="Department"
              value={form.departmentId}
              onChange={(v) => setForm((f) => ({ ...f, departmentId: v, designationId: '' }))}
              options={options?.departments}
              className={FIELD_COL}
            />
            <FormSelect
              label="Designation"
              value={form.designationId}
              onChange={(v) => setForm((f) => ({ ...f, designationId: v }))}
              options={designations.map((d) => ({ id: String(d.id), name: d.name }))}
              className={FIELD_COL}
            />
            <div className="col-12">
              <label className="form-label">Levels</label>
              <div className="d-flex flex-wrap gap-2">
                {(options?.levels || []).map((level) => (
                  <label key={level} className="d-inline-flex align-items-center gap-2 border rounded-pill px-3 py-1">
                    <input
                      type="checkbox"
                      checked={form.classTypes.includes(level)}
                      onChange={() => toggleLevel(level)}
                    />
                    {level}
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          <FormSection id="registration" title="Dental Council Registration">
            <FormInput label="Reg. No." value={form.regNo} onChange={(v) => setForm((f) => ({ ...f, regNo: v }))} className={FIELD_COL} />
            <FormInput label="Reg. Date" value={form.regDate} onChange={(v) => setForm((f) => ({ ...f, regDate: v }))} type="date" className={FIELD_COL} />
            <FormSelect label="State Dental Council" value={form.dentalCouncil} onChange={(v) => setForm((f) => ({ ...f, dentalCouncil: v }))} options={regCouncils} className={FIELD_COL} />
            <FormInput label="Aadhar No" value={form.aadharNo} onChange={(v) => setForm((f) => ({ ...f, aadharNo: v }))} className={FIELD_COL} />
            <FormInput label="PAN No." value={form.panNo} onChange={(v) => setForm((f) => ({ ...f, panNo: v }))} className={FIELD_COL} />
          </FormSection>

          <FormSection id="address" title="Permanent Address">
            <FormInput label="Door No." value={form.doorNo} onChange={(v) => setForm((f) => ({ ...f, doorNo: v }))} className={FIELD_COL} />
            <FormInput label="Street" value={form.street} onChange={(v) => setForm((f) => ({ ...f, street: v }))} className={FIELD_COL} />
            <FormInput label="Post" value={form.post} onChange={(v) => setForm((f) => ({ ...f, post: v }))} className={FIELD_COL} />
            <FormInput label="Taluk" value={form.taluk} onChange={(v) => setForm((f) => ({ ...f, taluk: v }))} className={FIELD_COL} />
            <FormInput label="District" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} className={FIELD_COL} />
            <FormSelect label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} options={(options?.states || []).map((s) => ({ id: s, name: s }))} className={FIELD_COL} />
            <FormInput label="Pincode" value={form.pincode} onChange={(v) => setForm((f) => ({ ...f, pincode: v }))} className={FIELD_COL} />
          </FormSection>

          <FormSection id="education" title="Educational Qualification" grid={false}>
            <EducationTab records={records} setRecords={setRecords} options={options} variant="admission" embedded />
          </FormSection>

          <FormSection id="experience" title="Work Experience" grid={false}>
            <ExperienceTab records={records} setRecords={setRecords} options={options} variant="admission" embedded />
          </FormSection>

          <FormSection id="activities" title="Activities & Skills">
            <div className="col-md-6">
              <h3 className="cis-formsection-title mb-2" style={{ fontSize: '0.8125rem' }}>Extension Activities</h3>
              <SkillsTab records={records} setRecords={setRecords} options={options} groupKeys={['extra_curricular']} showLanguages={false} embedded />
            </div>
            <div className="col-md-6">
              <h3 className="cis-formsection-title mb-2" style={{ fontSize: '0.8125rem' }}>Add-on Skill Sets</h3>
              <SkillsTab records={records} setRecords={setRecords} options={options} groupKeys={['extra_skills']} showLanguages={false} embedded />
            </div>
          </FormSection>

          <FormSection id="bank" title="Bank Details">
            <FormInput label="A/c No." value={form.bankAcNo} onChange={(v) => setForm((f) => ({ ...f, bankAcNo: v }))} className={FIELD_COL} />
            <FormInput label="A/c Name" value={form.bankAcName} onChange={(v) => setForm((f) => ({ ...f, bankAcName: v }))} className={FIELD_COL} />
            <FormSelect label="Bank Name" value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} options={options?.banks} className={FIELD_COL} />
            <FormInput label="Branch" value={form.bankBranch} onChange={(v) => setForm((f) => ({ ...f, bankBranch: v }))} className={FIELD_COL} />
            <FormInput label="IFSC Code" value={form.bankIfsc} onChange={(v) => setForm((f) => ({ ...f, bankIfsc: v }))} className={FIELD_COL} />
            <FormInput label="PF A/c No." value={form.pfAcNo} onChange={(v) => setForm((f) => ({ ...f, pfAcNo: v }))} className={FIELD_COL} />
          </FormSection>

          <FormActionBar note={<span>Fields marked <span className="text-danger">*</span> are required.</span>}>
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/staff')} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || idStatus === 'taken' || !!createdCreds}>
              {saving ? 'Saving…' : 'Create New Profile'}
            </button>
          </FormActionBar>
        </div>
      </form>
    </StaffPageShell>
  );
}
