import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import api from '../../api/client';
import StudentAttachments from '../../components/students/StudentAttachments';
import UserAvatar from '../../components/UserAvatar';
import { FormActionBar, FormSection } from '../../components/FormShell';
import ConfirmModal from '../../components/ConfirmModal';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';

// Edit fields grouped into meaningful sections (was a flat 37-field grid).
const EDIT_SECTIONS = [
  { id: 'identity', title: 'Identity', fields: [['registerNo', 'Register No'], ['studentName', 'Name'], ['studentInitial', 'Initial'], ['studentTitle', 'Title'], ['aadharNo', 'Aadhar']] },
  { id: 'personal', title: 'Personal', fields: [['gender', 'Gender'], ['bloodGroup', 'Blood Group'], ['religion', 'Religion'], ['community', 'Community'], ['caste', 'Caste'], ['nationality', 'Nationality']] },
  { id: 'family', title: 'Family', fields: [['fatherName', 'Father Name'], ['fatherTitle', 'Father Title'], ['motherName', 'Mother Name'], ['motherTitle', 'Mother Title']] },
  { id: 'contact', title: 'Contact', fields: [['mobileNo', 'Mobile'], ['contactNo', 'Contact'], ['fatherMobile', 'Father Mobile'], ['motherMobile', 'Mother Mobile'], ['fatherEmail', 'Father Email'], ['personalEmail', 'Personal Email']] },
  { id: 'permanent', title: 'Permanent Address', fields: [['doorNo', 'Door No'], ['street', 'Street'], ['post', 'Post'], ['district', 'District'], ['state', 'State'], ['pincode', 'Pincode']] },
  { id: 'communication', title: 'Communication Address', fields: [['cDoorNo', 'Comm. Door No'], ['cStreet', 'Comm. Street'], ['cPost', 'Comm. Post'], ['cDistrict', 'Comm. District'], ['cState', 'Comm. State'], ['cPincode', 'Comm. Pincode']] },
  { id: 'guardian', title: 'Guardian', fields: [['guardianName', 'Guardian Name'], ['guardianNo', 'Guardian Mobile'], ['guardianEmail', 'Guardian Email'], ['guardianRelation', 'Guardian Relation']] },
];

const EDIT_FIELDS = EDIT_SECTIONS.flatMap((s) => s.fields);

const TABS = [
  ['overview', 'Overview', 'fa fa-id-badge'],
  ['edit', 'Edit', 'fa fa-pencil'],
  ['attachments', 'Attachments', 'fa fa-paperclip'],
  ['status', 'Status', 'fa fa-exchange'],
];

function buildFormFromProfile(p) {
  return EDIT_FIELDS.reduce((acc, [key]) => {
    acc[key] = p[key] ?? '';
    return acc;
  }, {});
}

function ViewField({ label, value }) {
  return (
    <div className="col-md-4">
      <div className="cis-view-label">{label}</div>
      <div className="cis-view-value">{value || '—'}</div>
    </div>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const { settings, menu } = useOutletContext();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({});
  const [statusForm, setStatusForm] = useState({});
  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const profileRes = await api.get(`/api/students/${id}`);
        setProfile(profileRes.data);
        setForm(buildFormFromProfile(profileRes.data));
        setStatusForm({
          releavingDate: profileRes.data.releavingDate || '',
          releavingInfo: profileRes.data.releavingInfo || '',
          releavingYear: profileRes.data.releavingYear || '',
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load student');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Guard unsaved edits on refresh / tab close.
  useEffect(() => {
    const handler = (e) => { if (dirty && !saving) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saving]);

  const setField = (key, value) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const switchTab = (next) => {
    if (tab === 'edit' && dirty && next !== 'edit') {
      setPendingTab(next);
      return;
    }
    setTab(next);
  };

  const discardAndSwitch = () => {
    setForm(buildFormFromProfile(profile));
    setDirty(false);
    setTab(pendingTab);
    setPendingTab(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/api/students/${id}`, form);
      setProfile(res.data);
      setForm(buildFormFromProfile(res.data));
      setDirty(false);
      setMessage('Profile updated successfully.');
      setTab('overview');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.patch(`/api/students/${id}/status`, statusForm);
      setProfile(res.data);
      setStatusForm({
        releavingDate: res.data.releavingDate || '',
        releavingInfo: res.data.releavingInfo || '',
        releavingYear: res.data.releavingYear || '',
      });
      setMessage('Status updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Status update failed');
    } finally {
      setSaving(false);
    }
  };

  const fullName = profile
    ? `${profile.studentTitle || ''} ${profile.studentName || ''} ${profile.studentInitial || ''}`.trim()
    : '';

  // "Active" unless a real releaving date exists (legacy zero-dates count as active).
  const released = useMemo(() => {
    const d = profile?.releavingDate;
    return Boolean(d && !String(d).startsWith('0000') && d !== '—');
  }, [profile]);

  const alerts = (message || error) ? (
    <>
      {message && <div className="alert alert-success mb-0">{message}</div>}
      {error && <div className="alert alert-danger mb-0">{error}</div>}
    </>
  ) : null;

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={loading}
      dashboardTitle="Student Profile"
      breadcrumbs={profile ? [
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
        { label: 'Edit Profile', to: '/students' },
        { label: profile.registerNo },
      ] : [
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
      ]}
      title={fullName || 'Student Profile'}
      subtitle={profile ? (
        <>
          {profile.registerNo}
          {profile.admissionNo ? ` · Admission ${profile.admissionNo}` : ''}
          {profile.course?.degreeName ? ` · ${profile.course.degreeName}` : ''}
        </>
      ) : undefined}
      actions={profile ? (
        <>
          <Link
            to={`/fees/history?registerNo=${encodeURIComponent(profile.registerNo || '')}`}
            className="btn btn-outline-secondary btn-sm"
          >
            Fee History
          </Link>
          <Link to="/students" className="btn btn-outline-primary btn-sm">Search</Link>
        </>
      ) : (
        <Link to="/students" className="btn btn-outline-secondary btn-sm">Back to search</Link>
      )}
      notice={alerts}
    >
      {profile && (
        <>
          <div className="cis-student-hero">
            <UserAvatar name={fullName} photoUrl={profile.photoUrl} size={72} className="cis-student-hero-avatar" />
            <div className="cis-student-hero-body">
              <div className="cis-student-hero-nameline">
                <h2 className="cis-student-hero-name">{fullName}</h2>
                <span className={`cis-status-pill ${released ? 'is-released' : 'is-active'}`}>
                  <i className={`fa fa-${released ? 'sign-out' : 'check-circle'}`} aria-hidden="true" />
                  {released ? 'Released' : 'Active'}
                </span>
              </div>
              <dl className="cis-student-hero-facts">
                <div><dt>Register No</dt><dd className="cis-dt-num">{profile.registerNo || '—'}</dd></div>
                <div><dt>Admission No</dt><dd className="cis-dt-num">{profile.admissionNo || '—'}</dd></div>
                <div>
                  <dt>Course</dt>
                  <dd>
                    {profile.course?.degreeName || '—'}
                    {profile.course?.departmentName && profile.course.departmentName !== '-' ? ` · ${profile.course.departmentName}` : ''}
                  </dd>
                </div>
                <div><dt>Batch</dt><dd>{profile.academicYear || profile.academics?.[0]?.academicYear || '—'}</dd></div>
              </dl>
            </div>
          </div>

          <div className="cis-tabbar" role="tablist" aria-label="Profile sections">
            {TABS.map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`cis-tab${tab === key ? ' is-active' : ''}`}
                onClick={() => switchTab(key)}
              >
                <i className={icon} aria-hidden="true" />
                {label}
                {key === 'edit' && dirty ? <span className="cis-tab-dot" aria-label="unsaved" /> : null}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="cis-form-main">
              <FormSection id="ov-personal" title="Personal" grid>
                <ViewField label="Register No" value={profile.registerNo} />
                <ViewField label="Gender" value={profile.gender} />
                <ViewField label="Date of Birth" value={profile.dateOfBirth} />
                <ViewField label="Blood Group" value={profile.bloodGroup} />
                <ViewField label="Religion" value={profile.religion} />
                <ViewField label="Community" value={profile.community} />
                <ViewField label="Caste" value={profile.caste} />
                <ViewField label="Aadhar" value={profile.aadharNo} />
              </FormSection>

              <FormSection id="ov-contact" title="Family & Contact" grid>
                <ViewField label="Father" value={`${profile.fatherTitle || ''} ${profile.fatherName || ''}`.trim()} />
                <ViewField label="Mother" value={`${profile.motherTitle || ''} ${profile.motherName || ''}`.trim()} />
                <ViewField label="Mobile" value={profile.mobileNo} />
                <ViewField label="Father Mobile" value={profile.fatherMobile} />
                <ViewField label="Personal Email" value={profile.personalEmail} />
                <ViewField label="Address" value={[profile.doorNo, profile.street, profile.post, profile.district, profile.state, profile.pincode].filter(Boolean).join(', ')} />
              </FormSection>

              {profile.academics?.length > 0 && (
                <FormSection id="ov-academics" title="Academic Records" grid={false}>
                  <div className="cis-dt-scroll">
                    <table className="cis-dt-table">
                      <thead>
                        <tr><th>Year</th><th>Batch</th><th>Current Year</th><th>Type</th></tr>
                      </thead>
                      <tbody>
                        {profile.academics.map((a) => (
                          <tr key={a.id}>
                            <td className="cis-dt-num">{a.academicYear}</td>
                            <td>{a.batch}</td>
                            <td className="cis-dt-num">{a.currentYear}</td>
                            <td>{a.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FormSection>
              )}
            </div>
          )}

          {tab === 'edit' && (
            <form onSubmit={handleSave} className="cis-form-main">
              {EDIT_SECTIONS.map((section) => (
                <FormSection key={section.id} id={`edit-${section.id}`} title={section.title} grid>
                  {section.fields.map(([key, label]) => (
                    <div key={key} className="col-md-4">
                      <label className="form-label" htmlFor={key}>{label}</label>
                      <input
                        id={key}
                        className="form-control"
                        value={form[key] || ''}
                        onChange={(e) => setField(key, e.target.value)}
                      />
                    </div>
                  ))}
                </FormSection>
              ))}
              <FormActionBar
                note={dirty
                  ? <span className="cis-formbar-note is-dirty"><i className="fa fa-circle me-1" aria-hidden="true" style={{ fontSize: '0.5rem', verticalAlign: 'middle' }} /> Unsaved changes</span>
                  : <span>Editing {fullName}</span>}
              >
                <button type="button" className="btn btn-outline-secondary" disabled={saving || !dirty} onClick={() => { setForm(buildFormFromProfile(profile)); setDirty(false); }}>
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Update Profile'}
                </button>
              </FormActionBar>
            </form>
          )}

          {tab === 'attachments' && <StudentAttachments studentId={id} />}

          {tab === 'status' && (
            <form onSubmit={handleStatusSave} className="cis-form-main">
              <FormSection
                id="status"
                title="Transfer / Discontinue"
                description="Set a releaving date to mark this student as released. Leave blank to keep the student active."
                grid
              >
                <div className="col-md-4">
                  <label className="form-label" htmlFor="releavingDate">Releaving Date</label>
                  <input
                    id="releavingDate"
                    type="date"
                    className="form-control"
                    value={statusForm.releavingDate || ''}
                    onChange={(e) => setStatusForm({ ...statusForm, releavingDate: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="releavingYear">Releaving Year</label>
                  <input
                    id="releavingYear"
                    type="number"
                    className="form-control"
                    value={statusForm.releavingYear || ''}
                    onChange={(e) => setStatusForm({ ...statusForm, releavingYear: e.target.value })}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="releavingInfo">Releaving Info</label>
                  <textarea
                    id="releavingInfo"
                    className="form-control"
                    rows={3}
                    value={statusForm.releavingInfo || ''}
                    onChange={(e) => setStatusForm({ ...statusForm, releavingInfo: e.target.value })}
                  />
                </div>
              </FormSection>
              <FormActionBar note={<span>Current status: <strong>{released ? 'Released' : 'Active'}</strong></span>}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Update Status'}
                </button>
              </FormActionBar>
            </form>
          )}

          <ConfirmModal
            show={Boolean(pendingTab)}
            title="Discard unsaved changes?"
            message="You've edited this profile but not saved. Switching tabs will discard those changes."
            confirmLabel="Discard changes"
            cancelLabel="Keep editing"
            onConfirm={discardAndSwitch}
            onClose={() => setPendingTab(null)}
          />
        </>
      )}
    </StudentPageShell>
  );
}
