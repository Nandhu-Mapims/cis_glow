import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';

export default function PrintStyleSetup({ data, busy, onLoad, onSave }) {
  const [content, setContent] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.content !== undefined) setContent(data.content); }, [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({ content });
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <form onSubmit={handleSave}>
        <div className="mb-3">
          <label className="form-label">Style (salary.css)</label>
          <textarea className="form-control font-monospace" rows={18} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="text-end">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
    </>
  );
}
