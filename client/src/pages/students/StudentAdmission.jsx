import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';
import { FormActionBar, FormSection, FormSectionNav, useScrollSpy } from '../../components/FormShell';
import ConfirmModal from '../../components/ConfirmModal';

const EMPTY_MARK = { program: '', board: '', registerNo: '', yearOfPassing: '', totalMarks: '' };

// Section order mirrors the form + drives the scroll-spy jump nav.
const SECTIONS = [
  { id: 'admission', title: 'Admission' },
  { id: 'identity', title: 'Identity & Names' },
  { id: 'personal', title: 'Personal Details' },
  { id: 'parents', title: 'Parents' },
  { id: 'guardian', title: 'Guardian' },
  { id: 'scholarship', title: 'Scholarship' },
  { id: 'contact', title: 'Contact' },
  { id: 'permanent-address', title: 'Permanent Address' },
  { id: 'communication-address', title: 'Communication Address' },
  { id: 'bank', title: 'Bank Details' },
  { id: 'marks', title: 'Mark Sheets' },
];

const INITIAL_FORM = {
  applicationNo: '',
  admissionNo: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  admissionSource: '',
  academicYear: '',
  courseName: 'U.G',
  courseId: '',
  arNumber: '',
  arRank: '',
  neetRollNo: '',
  neetScore: '',
  studentTitle: '',
  studentName: '',
  studentInitial: '',
  fatherTitle: '',
  fatherName: '',
  motherTitle: '',
  motherName: '',
  aadharNo: '',
  rollNo: '',
  bregisterNo: '',
  registerNo: '',
  emisNo: '',
  umisNo: '',
  gender: 'Male',
  dateOfBirth: '',
  bloodGroup: '',
  donateBlood: 0,
  religion: '',
  community: '',
  caste: '',
  nationality: 'Indian',
  fatherOccupation: '',
  fatherIncome: '',
  motherOccupation: '',
  motherIncome: '',
  stayingWith: 0,
  guardianRelation: '',
  guardianName: '',
  guardianNo: '',
  guardianEmail: '',
  guardianAddress: '',
  guardianCity: '',
  guardianPincode: '',
  tfReceiptDate: '',
  tfReceiptNo: '',
  tfAmount: '',
  scholarship: 0,
  casteScholarship: '',
  firstGraduate: 0,
  acmecScholorship: 0,
  acmecAmount: '',
  acmecApproved: '',
  mobileNo: '',
  fatherMobile: '',
  motherMobile: '',
  contactNo: '',
  personalEmail: '',
  fatherEmail: '',
  doorNo: '',
  street: '',
  post: '',
  taluk: '',
  district: '',
  state: 'Tamil Nadu',
  pincode: '',
  sameAsPermanent: 0,
  cDoorNo: '',
  cStreet: '',
  cPost: '',
  cTaluk: '',
  cDistrict: '',
  cState: 'Tamil Nadu',
  cPincode: '',
  bAcNo: '',
  bAcName: '',
  bName: '',
  bBranch: '',
  bIfsc: '',
};

function Field({ label, required = false, children, className = 'col-md-4' }) {
  return (
    <div className={className}>
      <label className="form-label">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function StudentAdmission() {
  const navigate = useNavigate();
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [degrees, setDegrees] = useState([]);
  const [options, setOptions] = useState({
    courseTypes: ['U.G', 'P.G'],
    academicYears: [],
    quotas: [],
    bloodGroups: [],
    religions: [],
    communities: [],
    studentTitles: [],
    fatherTitles: [],
    motherTitles: [],
    banks: [],
    states: [],
    markPrograms: ['X', 'XII', 'NEET', 'U.G', 'P.G', 'Other'],
  });
  const [form, setForm] = useState(INITIAL_FORM);
  const [markSheets, setMarkSheets] = useState([{ ...EMPTY_MARK }]);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const activeSection = useScrollSpy(SECTIONS.map((s) => s.id), !loading);

  const set = (key, value) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Warn before losing entered data on refresh / tab close.
  useEffect(() => {
    const handler = (e) => {
      if (dirty && !saving) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saving]);

  const leave = () => navigate('/students');
  const handleCancel = () => {
    if (dirty) setConfirmLeave(true);
    else leave();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/students/admission/options');
        if (cancelled) return;
        const data = res.data || {};
        setOptions((prev) => ({ ...prev, ...data }));
        setForm((prev) => ({
          ...prev,
          academicYear: settings?.ugAcademicYear || data.academicYears?.[0] || prev.academicYear,
          courseName: data.courseTypes?.[0] || prev.courseName,
          admissionSource: data.quotas?.[0]?.value || '',
          studentTitle: data.studentTitles?.[0]?.value || '',
          fatherTitle: data.fatherTitles?.[0]?.value || '',
          motherTitle: data.motherTitles?.[0]?.value || '',
        }));
      } catch {
        if (!cancelled) {
          setForm((prev) => ({
            ...prev,
            academicYear: settings?.ugAcademicYear || prev.academicYear,
          }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.academicYear || !form.courseName) {
      setDegrees([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/students/admission/degrees', {
          params: { academicYear: form.academicYear, courseName: form.courseName },
        });
        if (!cancelled) setDegrees(res.data.options || []);
      } catch {
        if (!cancelled) setDegrees([]);
      }
    })();
    return () => { cancelled = true; };
  }, [form.academicYear, form.courseName]);

  useEffect(() => {
    if (!form.sameAsPermanent) return;
    setForm((prev) => ({
      ...prev,
      cDoorNo: prev.doorNo,
      cStreet: prev.street,
      cPost: prev.post,
      cTaluk: prev.taluk,
      cDistrict: prev.district,
      cState: prev.state,
      cPincode: prev.pincode,
    }));
  }, [
    form.sameAsPermanent,
    form.doorNo,
    form.street,
    form.post,
    form.taluk,
    form.district,
    form.state,
    form.pincode,
  ]);

  const courseTypeOptions = useMemo(
    () => (options.courseTypes?.length ? options.courseTypes : ['U.G', 'P.G']),
    [options.courseTypes],
  );

  const onCourseTypeChange = (courseName) => {
    const year = courseName === 'P.G'
      ? settings?.pgAcademicYear
      : settings?.ugAcademicYear;
    setForm((prev) => ({
      ...prev,
      courseName,
      academicYear: year || prev.academicYear,
      courseId: '',
    }));
  };

  const updateMark = (index, key, value) => {
    setDirty(true);
    setMarkSheets((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  const addMarkRow = () => { setDirty(true); setMarkSheets((rows) => [...rows, { ...EMPTY_MARK }]); };
  const removeMarkRow = (index) => { setDirty(true); setMarkSheets((rows) => rows.filter((_, i) => i !== index)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        rollNo: form.rollNo || form.registerNo,
        donateBlood: form.donateBlood ? 1 : 0,
        stayingWith: form.stayingWith ? 1 : 0,
        scholarship: form.scholarship ? 1 : 0,
        firstGraduate: form.firstGraduate ? 1 : 0,
        acmecScholorship: form.acmecScholorship ? 1 : 0,
        casteScholarship: form.scholarship ? form.casteScholarship : '',
        markSheets,
      };
      const res = await api.post('/api/students', payload);
      setDirty(false); // saved — release the unsaved-changes guard before navigating
      navigate(`/students/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Admission failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={loading}
      dashboardTitle="New Student"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
        { label: 'New Profile' },
      ]}
      title="Student Admission"
      legacy="student_profile_add.php"
      actions={(
        <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
      )}
      notice={error ? <div className="alert alert-danger mb-0">{error}</div> : null}
    >
      <form onSubmit={handleSubmit} className="cis-form-layout">
        <FormSectionNav sections={SECTIONS} activeId={activeSection} />
        <div className="cis-form-main">
        <FormSection id="admission" title="Admission Details">
          <Field label="Application No">
            <input className="form-control" value={form.applicationNo} onChange={(e) => set('applicationNo', e.target.value)} maxLength={20} />
          </Field>
          <Field label="Admission No" required>
            <input className="form-control" value={form.admissionNo} onChange={(e) => set('admissionNo', e.target.value)} maxLength={20} required />
          </Field>
          <Field label="Admission Date" required>
            <input type="date" className="form-control" value={form.admissionDate} onChange={(e) => set('admissionDate', e.target.value)} required />
          </Field>
          <Field label="Source" className="col-12">
            <div className="d-flex flex-wrap gap-3 pt-1">
              {(options.quotas || []).map((q) => (
                <label key={q.value} className="d-inline-flex align-items-center gap-2">
                  <input
                    type="radio"
                    name="admissionSource"
                    checked={String(form.admissionSource) === String(q.value)}
                    onChange={() => set('admissionSource', q.value)}
                  />
                  {q.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Batch" required>
            <select className="form-select" value={form.academicYear} onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value, courseId: '' }))} required>
              <option value="">-- Select --</option>
              {(options.academicYears || []).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </Field>
          <Field label="Degree" required>
            <select className="form-select" value={form.courseName} onChange={(e) => onCourseTypeChange(e.target.value)} required>
              {courseTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Course" required>
            <select className="form-select" value={form.courseId} onChange={(e) => set('courseId', e.target.value)} required>
              <option value="">-- Select --</option>
              {degrees.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="AR No">
            <input className="form-control" value={form.arNumber} onChange={(e) => set('arNumber', e.target.value)} maxLength={20} />
          </Field>
          <Field label="AR Rank">
            <input className="form-control" value={form.arRank} onChange={(e) => set('arRank', e.target.value)} maxLength={20} />
          </Field>
          <Field label="NEET Roll No">
            <input className="form-control" value={form.neetRollNo} onChange={(e) => set('neetRollNo', e.target.value)} maxLength={10} />
          </Field>
          <Field label="NEET Score">
            <input className="form-control" value={form.neetScore} onChange={(e) => set('neetScore', e.target.value)} maxLength={3} />
          </Field>
        </FormSection>

        <FormSection id="identity" title="Identity & Names" description="Student and parent names, and statutory identifiers.">
          <Field label="Student Title" className="col-12">
            <div className="d-flex flex-wrap gap-3 pt-1">
              {(options.studentTitles || []).map((t) => (
                <label key={t.value} className="d-inline-flex align-items-center gap-2">
                  <input type="radio" name="studentTitle" checked={form.studentTitle === t.value} onChange={() => set('studentTitle', t.value)} />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Student Name" required>
            <input className="form-control" value={form.studentName} onChange={(e) => set('studentName', e.target.value)} maxLength={155} required />
          </Field>
          <Field label="Student Initial">
            <input className="form-control" value={form.studentInitial} onChange={(e) => set('studentInitial', e.target.value)} maxLength={20} />
          </Field>
          <Field label="Father Title" className="col-md-2">
            <select className="form-select" value={form.fatherTitle} onChange={(e) => set('fatherTitle', e.target.value)}>
              <option value="">--</option>
              {(options.fatherTitles || []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Father Name" className="col-md-4">
            <input className="form-control" value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} maxLength={155} />
          </Field>
          <Field label="Mother Title" className="col-md-2">
            <select className="form-select" value={form.motherTitle} onChange={(e) => set('motherTitle', e.target.value)}>
              <option value="">--</option>
              {(options.motherTitles || []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Mother Name" className="col-md-4">
            <input className="form-control" value={form.motherName} onChange={(e) => set('motherName', e.target.value)} maxLength={155} />
          </Field>
          <Field label="Aadhar No" required>
            <input className="form-control" value={form.aadharNo} onChange={(e) => set('aadharNo', e.target.value)} maxLength={12} required />
          </Field>
          <Field label="Roll No" required>
            <input className="form-control" value={form.rollNo} onChange={(e) => set('rollNo', e.target.value)} maxLength={20} required />
          </Field>
          <Field label="University Register No">
            <input className="form-control" value={form.bregisterNo} onChange={(e) => set('bregisterNo', e.target.value)} maxLength={20} />
          </Field>
          <Field label="Register No" required>
            <input className="form-control" value={form.registerNo} onChange={(e) => set('registerNo', e.target.value)} maxLength={20} required />
          </Field>
          <Field label="EMIS No">
            <input className="form-control" value={form.emisNo} onChange={(e) => set('emisNo', e.target.value)} maxLength={20} />
          </Field>
          <Field label="UMIS No">
            <input className="form-control" value={form.umisNo} onChange={(e) => set('umisNo', e.target.value)} maxLength={20} />
          </Field>
        </FormSection>

        <FormSection id="personal" title="Personal Details">
          <Field label="Gender" className="col-12">
            <div className="d-flex flex-wrap gap-3 pt-1">
              {['Male', 'Female', 'Transgender'].map((g) => (
                <label key={g} className="d-inline-flex align-items-center gap-2">
                  <input type="radio" name="gender" checked={form.gender === g} onChange={() => set('gender', g)} />
                  {g}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Date of Birth">
            <input type="date" className="form-control" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </Field>
          <Field label="Blood Group">
            <select className="form-select" value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
              <option value="">-- Select --</option>
              {(options.bloodGroups || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Willingness to donate Blood">
            <label className="d-inline-flex align-items-center gap-2 pt-2">
              <input type="checkbox" checked={!!form.donateBlood} onChange={(e) => set('donateBlood', e.target.checked ? 1 : 0)} />
              Yes
            </label>
          </Field>
          <Field label="Religion">
            <select className="form-select" value={form.religion} onChange={(e) => set('religion', e.target.value)}>
              <option value="">-- Select --</option>
              {(options.religions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Community">
            <select className="form-select" value={form.community} onChange={(e) => set('community', e.target.value)}>
              <option value="">-- Select --</option>
              {(options.communities || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Caste">
            <input className="form-control" value={form.caste} onChange={(e) => set('caste', e.target.value)} maxLength={70} />
          </Field>
          <Field label="Nationality">
            <input className="form-control" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} maxLength={70} />
          </Field>
        </FormSection>

        <FormSection id="parents" title="Parents — Occupation & Income">
          <Field label="Father Occupation">
            <input className="form-control" value={form.fatherOccupation} onChange={(e) => set('fatherOccupation', e.target.value)} maxLength={155} />
          </Field>
          <Field label="Father Income" required>
            <input className="form-control" value={form.fatherIncome} onChange={(e) => set('fatherIncome', e.target.value)} maxLength={10} required />
          </Field>
          <Field label="Mother Occupation">
            <input className="form-control" value={form.motherOccupation} onChange={(e) => set('motherOccupation', e.target.value)} maxLength={155} />
          </Field>
          <Field label="Mother Income" required>
            <input className="form-control" value={form.motherIncome} onChange={(e) => set('motherIncome', e.target.value)} maxLength={10} required />
          </Field>
        </FormSection>

        <FormSection id="guardian" title="Guardian">
          <Field label="Staying with Guardian">
            <label className="d-inline-flex align-items-center gap-2 pt-2">
              <input type="checkbox" checked={!!form.stayingWith} onChange={(e) => set('stayingWith', e.target.checked ? 1 : 0)} />
              Yes
            </label>
          </Field>
          <Field label="Relation">
            <input className="form-control" value={form.guardianRelation} onChange={(e) => set('guardianRelation', e.target.value)} maxLength={70} />
          </Field>
          <Field label="Guardian Name">
            <input className="form-control" value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} maxLength={100} />
          </Field>
          <Field label="Guardian Mobile">
            <input className="form-control" value={form.guardianNo} onChange={(e) => set('guardianNo', e.target.value)} maxLength={15} />
          </Field>
          <Field label="Guardian Email">
            <input type="email" className="form-control" value={form.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} maxLength={100} />
          </Field>
          <Field label="Guardian Address" className="col-md-8">
            <textarea className="form-control" rows={2} value={form.guardianAddress} onChange={(e) => set('guardianAddress', e.target.value)} />
          </Field>
          <Field label="City">
            <input className="form-control" value={form.guardianCity} onChange={(e) => set('guardianCity', e.target.value)} maxLength={70} />
          </Field>
          <Field label="Pincode">
            <input className="form-control" value={form.guardianPincode} onChange={(e) => set('guardianPincode', e.target.value)} maxLength={6} />
          </Field>
        </FormSection>

        <FormSection id="scholarship" title="Scholarship">
          <Field label="DME Tuition Fees Date">
            <input type="date" className="form-control" value={form.tfReceiptDate} onChange={(e) => set('tfReceiptDate', e.target.value)} />
          </Field>
          <Field label="Receipt No.">
            <input className="form-control" value={form.tfReceiptNo} onChange={(e) => set('tfReceiptNo', e.target.value)} maxLength={20} />
          </Field>
          <Field label="Amount">
            <input className="form-control" value={form.tfAmount} onChange={(e) => set('tfAmount', e.target.value)} maxLength={20} />
          </Field>
          <Field label="Scholarship">
            <label className="d-inline-flex align-items-center gap-2 pt-2">
              <input type="checkbox" checked={!!form.scholarship} onChange={(e) => set('scholarship', e.target.checked ? 1 : 0)} />
              Yes
            </label>
          </Field>
          {form.scholarship ? (
            <Field label="Scholarship Type" className="col-12">
              <div className="d-flex flex-wrap gap-3 pt-1">
                {[
                  ['scst', 'SC/ST'],
                  ['sca', 'SCA'],
                  ['bc', 'BC'],
                  ['mbc', 'MBC'],
                ].map(([value, label]) => (
                  <label key={value} className="d-inline-flex align-items-center gap-2">
                    <input
                      type="radio"
                      name="casteScholarship"
                      checked={form.casteScholarship === value}
                      onChange={() => set('casteScholarship', value)}
                    />
                    {label}
                  </label>
                ))}
                <label className="d-inline-flex align-items-center gap-2">
                  <input type="checkbox" checked={!!form.firstGraduate} onChange={(e) => set('firstGraduate', e.target.checked ? 1 : 0)} />
                  First Graduate
                </label>
              </div>
            </Field>
          ) : null}
          <Field label="ACMEC Scholarship">
            <label className="d-inline-flex align-items-center gap-2 pt-2">
              <input type="checkbox" checked={!!form.acmecScholorship} onChange={(e) => set('acmecScholorship', e.target.checked ? 1 : 0)} />
              Yes
            </label>
          </Field>
          {form.acmecScholorship ? (
            <>
              <Field label="ACMEC Amount">
                <input className="form-control" value={form.acmecAmount} onChange={(e) => set('acmecAmount', e.target.value)} maxLength={20} />
              </Field>
              <Field label="Approved by">
                <input className="form-control" value={form.acmecApproved} onChange={(e) => set('acmecApproved', e.target.value)} maxLength={20} />
              </Field>
            </>
          ) : null}
        </FormSection>

        <FormSection id="contact" title="Contact">
          <Field label="Student Mobile No">
            <input className="form-control" value={form.mobileNo} onChange={(e) => set('mobileNo', e.target.value)} maxLength={15} />
          </Field>
          <Field label="Father's Mobile No.">
            <input className="form-control" value={form.fatherMobile} onChange={(e) => set('fatherMobile', e.target.value)} maxLength={15} />
          </Field>
          <Field label="Mother's Mobile No.">
            <input className="form-control" value={form.motherMobile} onChange={(e) => set('motherMobile', e.target.value)} maxLength={15} />
          </Field>
          <Field label="Telephone No">
            <input className="form-control" value={form.contactNo} onChange={(e) => set('contactNo', e.target.value)} maxLength={15} />
          </Field>
          <Field label="Student Email">
            <input type="email" className="form-control" value={form.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} maxLength={100} />
          </Field>
          <Field label="Father's Email">
            <input type="email" className="form-control" value={form.fatherEmail} onChange={(e) => set('fatherEmail', e.target.value)} maxLength={100} />
          </Field>
        </FormSection>

        <FormSection id="permanent-address" title="Permanent Address">
          <Field label="Door No.">
            <input className="form-control" value={form.doorNo} onChange={(e) => set('doorNo', e.target.value)} maxLength={155} />
          </Field>
          <Field label="Street">
            <input className="form-control" value={form.street} onChange={(e) => set('street', e.target.value)} maxLength={255} />
          </Field>
          <Field label="Post">
            <input className="form-control" value={form.post} onChange={(e) => set('post', e.target.value)} maxLength={70} />
          </Field>
          <Field label="Taluk">
            <input className="form-control" value={form.taluk} onChange={(e) => set('taluk', e.target.value)} maxLength={70} />
          </Field>
          <Field label="District">
            <input className="form-control" value={form.district} onChange={(e) => set('district', e.target.value)} maxLength={70} />
          </Field>
          <Field label="State">
            <select className="form-select" value={form.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">-- Select --</option>
              {(options.states || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Pincode">
            <input className="form-control" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} maxLength={6} />
          </Field>
        </FormSection>

        <FormSection
          id="communication-address"
          title="Communication Address"
          action={(
            <label className="small mb-0 d-inline-flex align-items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.sameAsPermanent}
                onChange={(e) => set('sameAsPermanent', e.target.checked ? 1 : 0)}
              />
              Same as P.Addr.
            </label>
          )}
        >
          <Field label="Door No.">
            <input className="form-control" value={form.cDoorNo} onChange={(e) => set('cDoorNo', e.target.value)} maxLength={155} disabled={!!form.sameAsPermanent} />
          </Field>
          <Field label="Street">
            <input className="form-control" value={form.cStreet} onChange={(e) => set('cStreet', e.target.value)} maxLength={255} disabled={!!form.sameAsPermanent} />
          </Field>
          <Field label="Post">
            <input className="form-control" value={form.cPost} onChange={(e) => set('cPost', e.target.value)} maxLength={70} disabled={!!form.sameAsPermanent} />
          </Field>
          <Field label="Taluk">
            <input className="form-control" value={form.cTaluk} onChange={(e) => set('cTaluk', e.target.value)} maxLength={70} disabled={!!form.sameAsPermanent} />
          </Field>
          <Field label="District">
            <input className="form-control" value={form.cDistrict} onChange={(e) => set('cDistrict', e.target.value)} maxLength={70} disabled={!!form.sameAsPermanent} />
          </Field>
          <Field label="State">
            <select className="form-select" value={form.cState} onChange={(e) => set('cState', e.target.value)} disabled={!!form.sameAsPermanent}>
              <option value="">-- Select --</option>
              {(options.states || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Pincode">
            <input className="form-control" value={form.cPincode} onChange={(e) => set('cPincode', e.target.value)} maxLength={6} disabled={!!form.sameAsPermanent} />
          </Field>
        </FormSection>

        <FormSection id="bank" title="Bank Details">
          <Field label="A/c No.">
            <input className="form-control" value={form.bAcNo} onChange={(e) => set('bAcNo', e.target.value)} maxLength={255} />
          </Field>
          <Field label="A/c Name">
            <input className="form-control" value={form.bAcName} onChange={(e) => set('bAcName', e.target.value)} maxLength={70} />
          </Field>
          <Field label="Bank Name">
            <select className="form-select" value={form.bName} onChange={(e) => set('bName', e.target.value)}>
              <option value="">-- Select --</option>
              {(options.banks || []).map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Branch">
            <input className="form-control" value={form.bBranch} onChange={(e) => set('bBranch', e.target.value)} maxLength={70} />
          </Field>
          <Field label="IFSC Code">
            <input className="form-control" value={form.bIfsc} onChange={(e) => set('bIfsc', e.target.value)} maxLength={70} />
          </Field>
        </FormSection>

        <FormSection
          id="marks"
          title="Mark Sheets"
          action={(
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={addMarkRow}
            >
              + Add row
            </button>
          )}
        >
          <div className="col-12 table-responsive">
            <table className="table table-bordered table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '8%' }}>S.No.</th>
                  <th style={{ width: '18%' }}>Class/Program</th>
                  <th style={{ width: '28%' }}>Board/University</th>
                  <th style={{ width: '16%' }}>Register No.</th>
                  <th style={{ width: '14%' }}>Passed Out</th>
                  <th style={{ width: '10%' }}>%</th>
                  <th style={{ width: '6%' }} />
                </tr>
              </thead>
              <tbody>
                {markSheets.map((row, index) => (
                  <tr key={`mark-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <select className="form-select form-select-sm" value={row.program} onChange={(e) => updateMark(index, 'program', e.target.value)}>
                        <option value="">--Select--</option>
                        {(options.markPrograms || []).map((p) => <option key={p} value={p}>{p === 'X' ? '10th' : p === 'XII' ? '12th' : p}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="form-control form-control-sm" value={row.board} onChange={(e) => updateMark(index, 'board', e.target.value)} maxLength={155} />
                    </td>
                    <td>
                      <input className="form-control form-control-sm" value={row.registerNo} onChange={(e) => updateMark(index, 'registerNo', e.target.value)} maxLength={70} />
                    </td>
                    <td>
                      <input className="form-control form-control-sm" value={row.yearOfPassing} onChange={(e) => updateMark(index, 'yearOfPassing', e.target.value)} maxLength={4} placeholder="YYYY" />
                    </td>
                    <td>
                      <input className="form-control form-control-sm" value={row.totalMarks} onChange={(e) => updateMark(index, 'totalMarks', e.target.value)} maxLength={5} />
                    </td>
                    <td>
                      {markSheets.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeMarkRow(index)}
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSection>

          <FormActionBar
            note={dirty
              ? <span className="cis-formbar-note is-dirty"><i className="fa fa-circle me-1" aria-hidden="true" style={{ fontSize: '0.5rem', verticalAlign: 'middle' }} /> Unsaved changes</span>
              : <span>Fields marked <span className="text-danger">*</span> are required.</span>}
          >
            <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create New Profile'}
            </button>
          </FormActionBar>
        </div>
      </form>

      <ConfirmModal
        show={confirmLeave}
        title="Discard this admission?"
        message="You have unsaved changes. Leaving now will discard everything entered on this form."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={leave}
        onClose={() => setConfirmLeave(false)}
      />
    </StudentPageShell>
  );
}
