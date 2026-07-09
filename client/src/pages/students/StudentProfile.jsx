import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import StudentAttachments from '../../components/students/StudentAttachments';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';

function Field({ label, value }) {
  return (
    <div className="col-md-4 mb-3">
      <div className="text-muted small">{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

const EDIT_FIELDS = [
  ['registerNo', 'Register No'],
  ['studentName', 'Name'],
  ['studentInitial', 'Initial'],
  ['studentTitle', 'Title'],
  ['gender', 'Gender'],
  ['bloodGroup', 'Blood Group'],
  ['religion', 'Religion'],
  ['community', 'Community'],
  ['caste', 'Caste'],
  ['nationality', 'Nationality'],
  ['aadharNo', 'Aadhar'],
  ['fatherName', 'Father Name'],
  ['fatherTitle', 'Father Title'],
  ['motherName', 'Mother Name'],
  ['motherTitle', 'Mother Title'],
  ['mobileNo', 'Mobile'],
  ['contactNo', 'Contact'],
  ['fatherMobile', 'Father Mobile'],
  ['motherMobile', 'Mother Mobile'],
  ['fatherEmail', 'Father Email'],
  ['personalEmail', 'Personal Email'],
  ['doorNo', 'Door No'],
  ['street', 'Street'],
  ['post', 'Post'],
  ['district', 'District'],
  ['state', 'State'],
  ['pincode', 'Pincode'],
  ['cDoorNo', 'Comm. Door No'],
  ['cStreet', 'Comm. Street'],
  ['cPost', 'Comm. Post'],
  ['cDistrict', 'Comm. District'],
  ['cState', 'Comm. State'],
  ['cPincode', 'Comm. Pincode'],
  ['guardianName', 'Guardian Name'],
  ['guardianNo', 'Guardian Mobile'],
  ['guardianEmail', 'Guardian Email'],
  ['guardianRelation', 'Guardian Relation'],
];

function buildFormFromProfile(p) {
  return EDIT_FIELDS.reduce((acc, [key]) => {
    acc[key] = p[key] ?? '';
    return acc;
  }, {});
}

export default function StudentProfile() {
  const { id } = useParams();
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({});
  const [statusForm, setStatusForm] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, profileRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get(`/api/students/${id}`),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/api/students/${id}`, form);
      setProfile(res.data);
      setForm(buildFormFromProfile(res.data));
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
          <div className="cis-student-profile-hero">
            <div className="cis-student-profile-identity">
              {profile.photoUrl && (
                <img
                  src={profile.photoUrl}
                  alt={fullName}
                  className="cis-student-profile-photo"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div>
                <h2 className="cis-student-profile-name">{fullName}</h2>
                <p className="cis-student-profile-meta">
                  {profile.registerNo}
                  {profile.admissionNo ? ` · Admission ${profile.admissionNo}` : ''}
                </p>
                {profile.course && (
                  <p className="cis-student-profile-course">
                    {profile.course.degreeName}
                    {profile.course.departmentName && profile.course.departmentName !== '-'
                      ? ` — ${profile.course.departmentName}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          <ul className="nav cis-student-tabs mb-1">
            {[
              ['overview', 'Overview'],
              ['edit', 'Edit'],
              ['attachments', 'Attachments'],
              ['status', 'Status'],
            ].map(([key, label]) => (
              <li key={key} className="nav-item">
                <button
                  type="button"
                  className={`nav-link ${tab === key ? 'active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          {tab === 'overview' && (
            <>
              <div className="card mb-3">
                <div className="card-header">Personal</div>
                <div className="card-body row">
                  <Field label="Register No" value={profile.registerNo} />
                  <Field label="Gender" value={profile.gender} />
                  <Field label="Date of Birth" value={profile.dateOfBirth} />
                  <Field label="Blood Group" value={profile.bloodGroup} />
                  <Field label="Religion" value={profile.religion} />
                  <Field label="Community" value={profile.community} />
                  <Field label="Caste" value={profile.caste} />
                  <Field label="Aadhar" value={profile.aadharNo} />
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header">Family & Contact</div>
                <div className="card-body row">
                  <Field label="Father" value={`${profile.fatherTitle || ''} ${profile.fatherName || ''}`.trim()} />
                  <Field label="Mother" value={`${profile.motherTitle || ''} ${profile.motherName || ''}`.trim()} />
                  <Field label="Mobile" value={profile.mobileNo} />
                  <Field label="Father Mobile" value={profile.fatherMobile} />
                  <Field label="Personal Email" value={profile.personalEmail} />
                  <Field label="Address" value={[profile.doorNo, profile.street, profile.post, profile.district, profile.state, profile.pincode].filter(Boolean).join(', ')} />
                </div>
              </div>

              {profile.academics?.length > 0 && (
                <div className="card mb-3">
                  <div className="card-header">Academic Records</div>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Batch</th>
                          <th>Current Year</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.academics.map((a) => (
                          <tr key={a.id}>
                            <td>{a.academicYear}</td>
                            <td>{a.batch}</td>
                            <td>{a.currentYear}</td>
                            <td>{a.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'edit' && (
            <form className="card cis-student-form-card mb-3" onSubmit={handleSave}>
              <div className="card-header">Edit Profile</div>
              <div className="card-body row g-3">
                {EDIT_FIELDS.map(([key, label]) => (
                  <div key={key} className="col-md-4">
                    <label className="form-label" htmlFor={key}>{label}</label>
                    <input
                      id={key}
                      className="form-control"
                      value={form[key] || ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="card-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Update'}
                </button>
              </div>
            </form>
          )}

          {tab === 'attachments' && <StudentAttachments studentId={id} />}

          {tab === 'status' && (
            <form className="card cis-student-form-card mb-3" onSubmit={handleStatusSave}>
              <div className="card-header">Transfer / Discontinue</div>
              <div className="card-body row g-3">
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
              </div>
              <div className="card-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Update Status'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </StudentPageShell>
  );
}
