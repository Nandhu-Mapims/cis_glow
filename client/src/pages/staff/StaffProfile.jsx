import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import api from '../../api/client';
import UserAvatar from '../../components/UserAvatar';
import { FormActionBar, FormSection } from '../../components/FormShell';
import StaffAttachments from '../../components/staff/StaffAttachments';
import StaffPageShell, { STAFF_BREADCRUMB_HUB } from './StaffPageShell';
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

const TABS = [
  ['overview', 'Overview', 'fa fa-id-badge'],
  ['edit', 'Edit', 'fa fa-pencil'],
  ['education', 'Education', 'fa fa-graduation-cap'],
  ['experience', 'Experience', 'fa fa-briefcase'],
  ['awards', 'Awards', 'fa fa-trophy'],
  ['skills', 'Skills', 'fa fa-star'],
  ['attachments', 'Attachments', 'fa fa-paperclip'],
  ['status', 'Status', 'fa fa-exchange'],
  ['legacy', 'Legacy Form', 'fa fa-file-text-o'],
];

const RECORD_TABS = new Set(['education', 'experience', 'awards', 'skills']);

export default function StaffProfile() {
  const { id } = useParams();
  const { settings, menu } = useOutletContext();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fullName = profile ? (profile.displayName || `${profile.staffName || ''} ${profile.staffInitial || ''}`.trim()) : '';
  const roleLabel = profile ? (profile.currentRoleLabel || profile.designationName || profile.jobCategoryName || '—') : '';

  const alerts = (message || error) ? (
    <>
      {message && <div className="alert alert-success mb-0">{message}</div>}
      {error && <div className="alert alert-danger mb-0">{error}</div>}
    </>
  ) : null;

  return (
    <StaffPageShell
      settings={settings}
      menu={menu}
      loading={loading}
      error={!profile ? error : null}
      dashboardTitle="Staff Profile"
      breadcrumbs={profile ? [
        { label: 'Home', to: '/dashboard' },
        STAFF_BREADCRUMB_HUB,
        { label: 'Search', to: '/staff' },
        { label: profile.staffId },
      ] : [
        { label: 'Home', to: '/dashboard' },
        STAFF_BREADCRUMB_HUB,
      ]}
      title={fullName || 'Staff Profile'}
      subtitle={profile ? (
        <>
          {profile.staffId}
          {profile.jobCategoryName ? ` · ${profile.jobCategoryName}` : ''}
        </>
      ) : undefined}
      actions={profile ? (
        <>
          <Link
            to="/staff/setup/designation-edit"
            state={{ staffId: profile.id }}
            className="btn btn-outline-secondary btn-sm"
          >
            Designation Edit
          </Link>
          <Link
            to={`/attendance/staff?staffId=${encodeURIComponent(profile.staffId || '')}`}
            className="btn btn-outline-secondary btn-sm"
          >
            Attendance
          </Link>
          <Link to="/staff" className="btn btn-outline-primary btn-sm">Search</Link>
        </>
      ) : (
        <Link to="/staff" className="btn btn-outline-secondary btn-sm">Back to search</Link>
      )}
      notice={alerts}
    >
      {profile && (
        <>
          <div className="cis-staff-hero">
            <UserAvatar name={fullName} photoUrl={profile.photoUrl} size={72} className="cis-staff-hero-avatar" />
            <div className="cis-staff-hero-body">
              <div className="cis-staff-hero-nameline">
                <h2 className="cis-staff-hero-name">{fullName}</h2>
                <span className={`cis-status-pill ${profile.resigned ? 'is-released' : 'is-active'}`}>
                  <i className={`fa fa-${profile.resigned ? 'sign-out' : 'check-circle'}`} aria-hidden="true" />
                  {profile.resigned ? 'Resigned' : 'Active'}
                </span>
              </div>
              <dl className="cis-staff-hero-facts">
                <div><dt>Staff ID</dt><dd className="cis-dt-num">{profile.staffId || '—'}</dd></div>
                <div><dt>Role</dt><dd>{roleLabel}</dd></div>
                <div><dt>Department</dt><dd>{profile.currentDepartmentName || profile.departmentName || '—'}</dd></div>
                <div><dt>Category</dt><dd>{profile.jobCategoryName || '—'}</dd></div>
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
              </button>
            ))}
          </div>

          {tab === 'overview' && <OverviewTab profile={profile} />}

          {tab === 'edit' && (
            <div className="cis-form-main">
              <FormSection id="edit-personal" title="Edit Profile" grid={false}>
                <PersonalEditTab form={form} setForm={setForm} options={options || {}} />
              </FormSection>
              <FormActionBar note={<span>Editing {fullName}</span>}>
                <button type="button" className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </FormActionBar>
            </div>
          )}

          {RECORD_TABS.has(tab) && (
            <div className="cis-form-main">
              <FormSection id={`edit-${tab}`} title={TABS.find(([key]) => key === tab)[1]} grid={false}>
                {tab === 'education' && <EducationTab records={records} setRecords={setRecords} options={options} embedded />}
                {tab === 'experience' && <ExperienceTab records={records} setRecords={setRecords} options={options} embedded />}
                {tab === 'awards' && <AwardsTab records={records} setRecords={setRecords} embedded />}
                {tab === 'skills' && <SkillsTab records={records} setRecords={setRecords} options={options} embedded />}
              </FormSection>
              <FormActionBar note={<span>Editing {fullName}</span>}>
                <button type="button" className="btn btn-primary" onClick={handleSaveRecords} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Records'}
                </button>
              </FormActionBar>
            </div>
          )}

          {tab === 'attachments' && <StaffAttachments staffRowId={id} />}

          {tab === 'status' && (
            <form onSubmit={(e) => { e.preventDefault(); handleStatusSave(); }} className="cis-form-main">
              <FormSection
                id="status"
                title="Transfer / Relieve"
                description="Set a relieving date to mark this staff member as resigned. Leave blank to keep them active."
                grid
              >
                <div className="col-md-4">
                  <label className="form-label" htmlFor="staff-releaving-date">Relieving Date</label>
                  <input
                    id="staff-releaving-date"
                    type="date"
                    className="form-control"
                    value={statusForm.releavingDate || ''}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, releavingDate: e.target.value }))}
                  />
                </div>
                <div className="col-md-8">
                  <label className="form-label" htmlFor="staff-releaving-attachment">Resignation Letter</label>
                  <input
                    id="staff-releaving-attachment"
                    type="file"
                    className="form-control"
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                    onChange={(e) => setStatusFile(e.target.files?.[0] || null)}
                  />
                  {profile.releavingAttachmentUrl && !statusFile && (
                    <p className="cis-searchbar-hint mb-0 mt-1">
                      Current:
                      {' '}
                      <a href={profile.releavingAttachmentUrl} target="_blank" rel="noreferrer">
                        {profile.releavingAttachment}
                      </a>
                    </p>
                  )}
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="staff-releaving-info">Relieving Reason</label>
                  <textarea
                    id="staff-releaving-info"
                    className="form-control"
                    rows={4}
                    value={statusForm.releavingInfo || ''}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, releavingInfo: e.target.value }))}
                  />
                </div>
              </FormSection>
              <FormActionBar note={<span>Current status: <strong>{profile.resigned ? 'Resigned' : 'Active'}</strong></span>}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Update Status'}
                </button>
              </FormActionBar>
            </form>
          )}

          {tab === 'legacy' && (
            <div className="cis-form-main">
              <FormSection id="legacy" title="Legacy Form" grid={false}>
                <div className="alert alert-info mb-0">
                  {legacyNotice || 'The legacy PHP staff form has been replaced by the tabs on this page.'}
                </div>
              </FormSection>
            </div>
          )}
        </>
      )}
    </StaffPageShell>
  );
}
