export default function WorkingDaySetup({ data, busy, onSave }) {
  const days = data?.days || [];
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const updated = days.map((day, i) => ({
        ...day,
        academic_events: form.get(`events_${i}`) || day.academic_events,
        comments: form.get(`comments_${i}`) || day.comments,
      }));
      onSave({ calendar_month: data?.calendar_month, days: updated, Submit: 'Update' });
    }}>
      <p className="text-muted small">Month: {data?.calendar_month}</p>
      <div className="table-responsive" style={{ maxHeight: '60vh' }}>
        <table className="table table-sm table-bordered">
          <thead className="table-light sticky-top"><tr><th>Date</th><th>Event</th><th>Comments</th></tr></thead>
          <tbody>
            {days.map((day, i) => (
              <tr key={day.academic_date}>
                <td>{day.academic_date}</td>
                <td><input className="form-control form-control-sm" name={`events_${i}`} defaultValue={day.academic_events} /></td>
                <td><input className="form-control form-control-sm" name={`comments_${i}`} defaultValue={day.comments} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="submit" className="btn btn-primary mt-2" disabled={busy}>Save Month</button>
    </form>
  );
}
