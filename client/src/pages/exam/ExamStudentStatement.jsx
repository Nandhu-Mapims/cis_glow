import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { serializeLegacyForm } from '../../utils/legacyFormSerialize';
import { printReportHtml } from '../../utils/printReport';
import './ExamSetupPage.css';

export default function ExamStudentStatement() {
  const containerRef = useRef(null);
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [registerNo, setRegisterNo] = useState('');
  const [activeRegisterNo, setActiveRegisterNo] = useState('');
  const [studentLabel, setStudentLabel] = useState('');
  const [html, setHtml] = useState('');

  const loadStatement = useCallback(async (roll, fields = {}) => {
    const trimmed = String(roll || '').trim();
    if (!trimmed) {
      setError('Enter a register number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/exam/student-statement', {
        registerNo: trimmed,
        fields,
      });
      setHtml(res.data.html || '');
      setActiveRegisterNo(trimmed);
      setStudentLabel(res.data.student?.name || trimmed);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load student exam statement');
      setHtml('');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !html) return undefined;

    const form = root.querySelector('#signupForm');
    if (!form) return undefined;

    const onSubmit = async (event) => {
      event.preventDefault();
      const fields = serializeLegacyForm(form, event.submitter);
      await loadStatement(activeRegisterNo, fields);
    };

    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [html, activeRegisterNo, loadStatement]);

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Student Exam Statement' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/exam">Examination</Link></li>
          <li className="breadcrumb-item active">Student Statement</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Student Exam Statement</h3>
          <p className="text-muted small mb-0">
            Legacy: student/exam_statement.php
            {studentLabel ? ` — ${studentLabel}` : ''}
          </p>
        </div>
        <div className="d-flex gap-2">
          {html && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => printReportHtml(html)}
            >
              Print
            </button>
          )}
          <Link to="/exam/reports" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <form
            className="row g-2 align-items-end"
            onSubmit={(event) => {
              event.preventDefault();
              loadStatement(registerNo);
            }}
          >
            <div className="col-sm-4">
              <label htmlFor="registerNo" className="form-label small mb-1">Register number</label>
              <input
                id="registerNo"
                className="form-control form-control-sm"
                value={registerNo}
                onChange={(event) => setRegisterNo(event.target.value)}
                placeholder="e.g. 20UG001"
              />
            </div>
            <div className="col-sm-auto">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Load statement
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <div className="card shadow-sm exam-setup-card">
        <div className="card-body exam-student-statement-root" ref={containerRef}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            !busy && (
              <p className="text-muted mb-0">
                Enter a student register number to view their CIA marks statement.
              </p>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
