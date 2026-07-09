import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import StaffAttachments from '../../components/staff/StaffAttachments';
import {
  AwardsTab,
  buildProfileForm,
  buildRecordsForm,
  EducationTab,
  ExperienceTab,
  OverviewTab,
  PersonalEditTab,
  readFileAsBase64,
  SkillsTab,
} from './StaffProfileSections';

export default function StaffProfile() {
  const { id } = useParams();
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [options, setOptions] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({});
  const [records, setRecords] = useState({ education: [], experience: [], awards: [], languageIds: [], activities: {} });
  const [statusForm, setStatusForm] = useState({});
  const [statusFile, setStatusFile] = useState(null);
  const [legacyNotice, setLegacyNotice] = useState(null);

  const loadProfile = async () => {
    const profileRes = await api.get(`/api/staff/${id}`);
    setProfile(profileRes.data);
    setForm(buildProfileForm(profileRes.data));
    setRecords(buildRecordsForm(profileRes.data));
    setStatusForm({
      releavingDate: profileRes.data.releavingDate || '',
      releavingInfo: profileRes.data.releavingInfo || '',
      releavingAttachment: profileRes.data.releavingAttachment || '',
    });
    setStatusFile(null);
    return profileRes.data;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        try {
          const optionsRes = await api.get('/api/staff/profile-options');
          setOptions(optionsRes.data);
        } catch {
          setOptions({});
        }
        await loadProfile();
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load staff profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const loadLegacyForm = async () => {
    setLegacyNotice(null);
    try {
      const res = await api.get(`/api/staff/${id}/legacy-form`);
      setLegacyNotice(res.data?.note || 'Legacy form is not available in the modern app.');
    } catch (err) {
      setLegacyNotice(
        err.response?.data?.note
          || 'Use the tabs on this page to manage this staff profile.',
      );
    }
  };

  useEffect(() => {
    setLegacyNotice(null);
  }, [id]);

  useEffect(() => {
    if (tab === 'legacy' && !legacyNotice) {
      loadLegacyForm();
    }
  }, [tab, id, legacyNotice]);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setError(null);
    setMessage(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/api/staff/${id}`, form);
      setProfile(res.data);
      setForm(buildProfileForm(res.data));
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecords = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/api/staff/${id}/records`, records);
      setProfile(res.data);
      setRecords(buildRecordsForm(res.data));
      setMessage('Records updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Records update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        releavingDate: statusForm.releavingDate,
        releavingInfo: statusForm.releavingInfo,
        releavingAttachment: statusForm.releavingAttachment,
      };
      if (statusFile) {
        const dataBase64 = await readFileAsBase64(statusFile);
        payload.releavingAttachmentUpload = { filename: statusFile.name, dataBase64 };
      }
      const res = await api.patch(`/api/staff/${id}/status`, payload);
      setProfile(res.data);
      setStatusForm({
        releavingDate: res.data.releavingDate || '',
        releavingInfo: res.data.releavingInfo || '',
        releavingAttachment: res.data.releavingAttachment || '',
      });
      setStatusFile(null);
      setMessage('Status updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Status update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout settings={settings} menu={menu}>
        <div className="p-4">Loading staff profile...</div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout settings={settings} menu={menu}>
        <div className="alert alert-danger">{error || 'Staff not found'}</div>
        <Link to="/staff" className="btn btn-link">Back to search</Link>
      </DashboardLayout>
    );
  }

  const tabs = [
    ['overview', 'Overview'],
    ['edit', 'Edit'],
    ['education', 'Education'],
    ['experience', 'Experience'],
    ['awards', 'Awards'],
    ['skills', 'Skills'],
    ['attachments', 'Attachments'],
    ['status', 'Status'],
    ['legacy', 'Legacy Form'],
  ];

  const recordTabs = new Set(['education', 'experience', 'awards', 'skills']);

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/staff">Staff</Link></li>
          <li className="breadcrumb-item active">{profile.staffId}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div className="d-flex gap-3">
          {profile.photoUrl && (
            <img src={profile.photoUrl} alt="" width={98} height={119} className="border rounded object-fit-cover" />
          )}
          <div>
            <h4 className="mb-1">
              {profile.displayName || `${profile.staffName} ${profile.staffInitial}`.trim()}
              {profile.resigned && <span className="ms-2 badge text-bg-secondary">Resigned</span>}
            </h4>
            <div className="text-muted">{profile.staffId}</div>
            <div className="small">
              {profile.currentRoleLabel || profile.designationName || profile.jobCategoryName || '—'}
            </div>
            {profile.jobCategoryName && profile.currentRoleLabel && (
              <div className="text-muted small">{profile.jobCategoryName}</div>
            )}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link
            to="/staff/setup/designation-edit"
            state={{ staffId: profile.id }}
            className="btn btn-outline-primary btn-sm"
          >
            Designation Edit
          </Link>
          <Link
            to={`/attendance/staff?staffId=${encodeURIComponent(profile.staffId || '')}`}
            className="btn btn-outline-secondary btn-sm"
          >
            Attendance
          </Link>
          <Link to="/staff" className="btn btn-info btn-sm text-white">Search</Link>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <ul className="nav nav-tabs mb-3 flex-wrap">
        {tabs.map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link ${tab === key ? 'active' : ''}`}
              onClick={() => switchTab(key)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'overview' && <OverviewTab profile={profile} />}

      {tab === 'edit' && (
        <>
          <PersonalEditTab form={form} setForm={setForm} options={options || {}} />
          <div className="mt-3">
            <button type="button" className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </>
      )}

      {tab === 'education' && <EducationTab records={records} setRecords={setRecords} options={options} />}
      {tab === 'experience' && <ExperienceTab records={records} setRecords={setRecords} options={options} />}
      {tab === 'awards' && <AwardsTab records={records} setRecords={setRecords} />}
      {tab === 'skills' && <SkillsTab records={records} setRecords={setRecords} options={options} />}

      {recordTabs.has(tab) && (
        <div className="mt-3">
          <button type="button" className="btn btn-primary" onClick={handleSaveRecords} disabled={saving}>
            {saving ? 'Saving...' : 'Save records'}
          </button>
        </div>
      )}

      {tab === 'attachments' && <StaffAttachments staffRowId={id} />}

      {tab === 'status' && (
        <div className="card shadow-sm">
          <div className="card-body col-lg-6">
            <div className="mb-3">
              <label className="form-label">Relieving date</label>
              <input
                type="date"
                className="form-control"
                value={statusForm.releavingDate || ''}
                onChange={(e) => setStatusForm((prev) => ({ ...prev, releavingDate: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Relieving reason</label>
              <textarea
                className="form-control"
                rows={4}
                value={statusForm.releavingInfo || ''}
                onChange={(e) => setStatusForm((prev) => ({ ...prev, releavingInfo: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Resignation letter</label>
              <input
                type="file"
                className="form-control"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                onChange={(e) => setStatusFile(e.target.files?.[0] || null)}
              />
              {profile.releavingAttachmentUrl && !statusFile && (
                <p className="small mt-2 mb-0">
                  Current:{' '}
                  <a href={profile.releavingAttachmentUrl} target="_blank" rel="noreferrer">
                    {profile.releavingAttachment}
                  </a>
                </p>
              )}
            </div>
            <button type="button" className="btn btn-primary" onClick={handleStatusSave} disabled={saving}>
              {saving ? 'Saving...' : 'Update status'}
            </button>
          </div>
        </div>
      )}

      {tab === 'legacy' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="alert alert-info mb-0">
              {legacyNotice || 'The legacy PHP staff form has been replaced by the tabs on this page.'}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
