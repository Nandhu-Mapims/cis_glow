import { useEffect, useState } from 'react';

export default function ParentMeetingSmsScreen({ data, busy, onLoad, onSave }) {
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [meetingName, setMeetingName] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    setSelectedCourses(data.selectedCourses || []);
    setMeetingName(data.meetingName || '');
    setMeetingDate(data.meetingDate || '');
  }, [data]);

  const preview = async () => {
    await onLoad({
      action: 'preview',
      search_course: selectedCourses,
      meeting_name: meetingName,
      meeting_date: meetingDate,
    });
  };

  return (
    <div className="cis-setup-form">
      <div className="mb-3">
        <label className="form-label">Class</label>
        <select
          multiple
          className="form-control"
          size={10}
          value={selectedCourses}
          onChange={(e) => setSelectedCourses([...e.target.selectedOptions].map((o) => o.value))}
        >
          {(data?.courseOptions || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Meeting Title</label>
          <input className="form-control" value={meetingName} onChange={(e) => setMeetingName(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Date &amp; Time</label>
          <input
            type="datetime-local"
            className="form-control"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
          />
        </div>
      </div>

      <button type="button" className="btn btn-outline-info btn-sm mb-3" disabled={busy} onClick={preview}>
        Preview recipients
      </button>

      {data?.recipientCount > 0 && (
        <div className="alert alert-info">
          {data.recipientCount}
          {' '}
          parent mobile(s) ready to send.
        </div>
      )}

      {data?.recipients?.length > 0 && (
        <div className="table-responsive mb-3">
          <table className="table table-sm table-bordered">
            <thead>
              <tr>
                <th>Register No</th>
                <th>Student</th>
                <th>Parent Mobile</th>
              </tr>
            </thead>
            <tbody>
              {data.recipients.slice(0, 50).map((row) => (
                <tr key={`${row.registerNo}-${row.mobile}`}>
                  <td>{row.registerNo}</td>
                  <td>{row.studentName}</td>
                  <td>{row.mobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.recipients.length > 50 && (
            <p className="text-muted small">Showing first 50 of {data.recipients.length} recipients.</p>
          )}
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({
            search_course: selectedCourses,
            meeting_name: meetingName,
            meeting_date: meetingDate,
            mobiles: data?.mobiles,
            templateId: data?.templateId,
          });
        }}
      >
        <button
          type="submit"
          className="btn btn-danger"
          disabled={busy || !data?.recipientCount || !meetingName || !meetingDate}
        >
          Send SMS
        </button>
      </form>
    </div>
  );
}
