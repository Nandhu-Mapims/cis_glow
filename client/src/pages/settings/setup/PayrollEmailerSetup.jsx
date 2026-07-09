import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

function formatCronDay(day) {
  const value = Number(day);
  if (!value || value < 1 || value > 31) return '01';
  return String(value).padStart(2, '0');
}

function emptyContact() {
  return { key: `new-${Date.now()}`, name: '', email: '' };
}

export default function PayrollEmailerSetup({ data, busy, onLoad, onSave }) {
  const [cronRef, setCronRef] = useState('');
  const [cronTitle, setCronTitle] = useState('');
  const [cronStatus, setCronStatus] = useState(false);
  const [cronDay, setCronDay] = useState('');
  const [contacts, setContacts] = useState([emptyContact()]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    setCronRef(data.cronRef || '');
    setCronTitle(data.cronTitle || '');
    setCronStatus(Boolean(data.cronStatus));
    setCronDay(data.cronDay ?? '');
    setContacts((data.contacts || []).length
      ? data.contacts.map((c) => ({ ...c, key: `id-${c.id}` }))
      : [emptyContact()]);
  }, [data]);

  const onCronChange = async (value) => {
    setCronRef(value);
    await onLoad({ cronRef: value });
  };

  const updateContact = (index, patch) => {
    setContacts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      cronRef,
      cronTitle,
      cronStatus,
      cronDay,
      contacts: contacts.map(({ id, name, email }) => ({ id, name, email })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, cronRef });
    setDeleteId(null);
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Cron Type</label>
          <select className="form-select" value={cronRef} onChange={(e) => onCronChange(e.target.value)}>
            <option value="">--Select One--</option>
            {(data?.cronOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Title</label>
          <input className="form-control" value={cronTitle} onChange={(e) => setCronTitle(e.target.value)} />
        </div>
        <div className="col-md-2">
          <label className="form-label d-block">Status</label>
          <label className="form-check-label">
            <input type="checkbox" className="form-check-input me-1" checked={cronStatus} onChange={(e) => setCronStatus(e.target.checked)} />
            Yes
          </label>
        </div>
        <div className="col-md-2">
          <label className="form-label">Day</label>
          <select className="form-select" value={formatCronDay(cronDay)} onChange={(e) => setCronDay(e.target.value)}>
            {DAY_OPTIONS.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
      </div>

      {cronRef ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>Name</th><th>Email</th><th /></tr>
              </thead>
              <tbody>
                {contacts.map((row, index) => (
                  <tr key={row.key}>
                    <td><input className="form-control" value={row.name} onChange={(e) => updateContact(index, { name: e.target.value })} /></td>
                    <td><input className="form-control" value={row.email} onChange={(e) => updateContact(index, { email: e.target.value })} /></td>
                    <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setContacts((prev) => [...prev, emptyContact()])}>+</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={handleDelete} busy={busy} />
    </>
  );
}
