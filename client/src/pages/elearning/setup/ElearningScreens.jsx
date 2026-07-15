import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../../api/client';
import { Breadcrumbs, PageHeader, PageLoading } from '../../../components/PageShell';
import DashboardLayout from '../../../layouts/DashboardLayout';

export function ElearnDashboardPage() {
  const { settings, menu } = useOutletContext();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const load = async (d = date) => {
    setLoading(true);
    const dashRes = await api.get('/api/elearning/dashboard', { params: { date: d } });
    setData(dashRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <DashboardLayout settings={settings} menu={menu}><PageLoading /></DashboardLayout>;

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'E-Learning', to: '/elearning' }, { label: 'Dashboard' }]} />
      <PageHeader title="E-Learning Dashboard" />
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); load(date); }}>
        <div className="col-md-4"><input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="col-md-2"><button className="btn btn-info" type="submit">Refresh</button></div>
      </form>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><div className="card p-3"><strong>Classes / Materials</strong><div className="fs-3">{data?.summary?.classes ?? 0}</div></div></div>
        <div className="col-md-4"><div className="card p-3"><strong>Assignments</strong><div className="fs-3">{data?.summary?.assignments ?? 0}</div></div></div>
        <div className="col-md-4"><div className="card p-3"><strong>Tests</strong><div className="fs-3">{data?.summary?.tests ?? 0}</div></div></div>
      </div>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Session</th><th>Course</th><th>Subject</th><th>Period</th><th>Active</th></tr></thead>
        <tbody>
          {(data?.sessions || []).map((s) => <tr key={s.id}><td>{s.examName}</td><td>{s.courseName}</td><td>{s.subjectId}</td><td>{s.period}</td><td>{s.active ? 'Yes' : 'No'}</td></tr>)}
        </tbody>
      </table>
    </DashboardLayout>
  );
}

export function ElearnSetupScreen({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ slots: data?.slots }); }}>
      <table className="table table-bordered table-sm">
        <thead><tr><th>Type</th><th>Year</th><th>From</th><th>To</th></tr></thead>
        <tbody>
          {(data?.slots || []).map((slot, idx) => (
            <tr key={slot.id}>
              <td>{slot.atype}</td><td>{slot.ayear}</td>
              <td><input type="time" className="form-control form-control-sm" defaultValue={String(slot.fromTime || '').slice(11, 16)} id={`from-${slot.id}`} /></td>
              <td><input type="time" className="form-control form-control-sm" defaultValue={String(slot.toTime || '').slice(11, 16)} id={`to-${slot.id}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave({
        slots: (data?.slots || []).map((slot) => ({
          id: slot.id,
          fromTime: document.getElementById(`from-${slot.id}`).value,
          toTime: document.getElementById(`to-${slot.id}`).value,
        })),
      })}
      >Save times</button>
    </form>
  );
}

export function ElearnReportScreen({ data, busy, onLoad }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [courseId, setCourseId] = useState('');
  useEffect(() => { onLoad({ date, courseId }); }, [onLoad]);
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-3"><input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="col-md-5"><select className="form-control" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">All courses</option>{(data?.courseOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="col-md-2"><button className="btn btn-info" type="button" disabled={busy} onClick={() => onLoad({ date, courseId })}>Go</button></div>
      </div>
      <table className="table table-bordered table-sm"><thead><tr><th>Session</th><th>Course</th><th>Subject</th><th>Period</th><th>Active</th></tr></thead>
        <tbody>{(data?.rows || []).map((r) => <tr key={r.id}><td>{r.examName}</td><td>{r.courseName}</td><td>{r.subjectId}</td><td>{r.period}</td><td>{r.active ? 'Yes' : 'No'}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function SubjectTestScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <div className="row g-3">
      <div className="col-md-5">
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          {['examName', 'subjectId', 'period', 'scheduleId', 'classInfo', 'materialLink1', 'assignmentLink'].map((k) => (
            <div key={k} className="mb-2"><label className="form-label">{k}</label><input className="form-control" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
          <div className="mb-2"><label className="form-label">examDate</label><input type="date" className="form-control" value={form.examDate || new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, examDate: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save session</button>
        </form>
      </div>
      <div className="col-md-7">
        <table className="table table-sm table-bordered"><thead><tr><th>Name</th><th>Date</th><th>Subject</th></tr></thead>
          <tbody>{(data?.tasks || []).map((t) => <tr key={t.id}><td>{t.examName}</td><td>{String(t.examDate || '').slice(0, 10)}</td><td>{t.subjectId}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function SubjectReportScreen({ data, busy, onLoad }) {
  const [taskId, setTaskId] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.taskId) setTaskId(data.taskId); }, [data]);
  return (
    <div>
      <select className="form-control mb-3" value={taskId} onChange={(e) => { setTaskId(e.target.value); onLoad({ taskId: e.target.value }); }}>
        <option value="">Select session</option>
        {(data?.taskOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {data?.task && <p><strong>{data.task.examName}</strong> — {String(data.task.examDate || '').slice(0, 10)} — Submitted: {data.totalSubmitted}</p>}
      <table className="table table-sm table-bordered"><thead><tr><th>Register No</th><th>Marks</th><th>Status</th></tr></thead>
        <tbody>{(data?.answers || []).map((a, i) => <tr key={i}><td>{a.registerNo}</td><td>{a.marks}</td><td>{a.status}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
