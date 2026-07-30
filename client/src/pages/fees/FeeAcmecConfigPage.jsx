import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { toDateInputValue } from '../../utils/dateInputs';
import SetupAlerts from './setup/SetupAlerts';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['acmec-config'];

export default function FeeAcmecConfigPage() {
  const { settings, menu } = useOutletContext();
  const [initLoading, setInitLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice(4000);
  const [fields, setFields] = useState({
    searchBy: 'roll_no',
    searchInput: '',
    searchCourse: '',
    studentId: null,
  });
  const [form, setForm] = useState({
    scholarShip: false,
    casteScholarship: '',
    firstGraduate: false,
    acmecTrust: false,
    tfReceiptDate: '',
    tfReceiptNo: '',
    tfAmount: '',
    acmecScholarship: false,
    acmecAmount: '',
    acmecApproved: '',
  });

  const load = async (payload = {}) => {
    setBusy(true);
    setError(null);
    const nextFields = { ...fields, ...payload };
    const res = await api.post('/api/fees/acmec-config/load', { fields: nextFields });
    setData(res.data);
    setFields({
      searchBy: res.data.searchBy,
      searchInput: res.data.searchInput,
      searchCourse: res.data.searchCourse,
      studentId: res.data.studentId,
    });
    if (res.data.detail?.form) setForm(res.data.detail.form);
    setBusy(false);
  };

  const init = async () => {
    try {
      await load();
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const selectStudent = async (studentId) => {
    setBusy(true);
    try {
      const res = await api.post('/api/fees/acmec-config/load', { fields: { ...fields, studentId } });
      setData(res.data);
      setFields((prev) => ({ ...prev, studentId }));
      if (res.data.detail?.form) setForm(res.data.detail.form);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post('/api/fees/acmec-config/save', {
        studentId: data?.detail?.student?.id,
        registerNo: data?.detail?.student?.registerNo,
        form,
      });
      if (res.data.message) setNotice(res.data.message);
      setData(res.data);
      if (res.data.detail?.form) setForm(res.data.detail.form);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const patchForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={initLoading}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('acmec-config')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      <div className="row">
        <div className="col-lg-3">
          <section className="card mb-3 shadow-sm cis-fee-filter-card">
            <div className="card-header py-2">Student search</div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Search By</label>
                <div>
                  <label className="me-3">
                    <input type="radio" checked={fields.searchBy === 'roll_no'} onChange={() => setFields({ ...fields, searchBy: 'roll_no' })} /> Roll No
                  </label>
                  <label>
                    <input type="radio" checked={fields.searchBy === 'batch'} onChange={() => setFields({ ...fields, searchBy: 'batch' })} /> Batch
                  </label>
                </div>
              </div>
              {fields.searchBy === 'roll_no' ? (
                <div className="input-group mb-3">
                  <input className="form-control" placeholder="Roll No. separated by ," value={fields.searchInput} onChange={(e) => setFields({ ...fields, searchInput: e.target.value })} />
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => load({ searchInput: fields.searchInput, studentId: null })}>Go</button>
                </div>
              ) : (
                <select className="form-select mb-3" value={fields.searchCourse} onChange={(e) => load({ searchCourse: e.target.value, studentId: null })}>
                  <option value="">--Select--</option>
                  {(data?.courseOptions || []).map((course) => (
                    <optgroup key={course.id} label={`${course.courseName} | ${course.label}`}>
                      {course.batchOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              <div className="d-flex flex-column gap-1">
                {(data?.students || []).map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className={`btn btn-sm text-start ${student.selected ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => selectStudent(student.id)}
                  >
                    {student.registerNo} - {student.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="col-lg-9">
          <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={() => setNotice('')} />
          {data?.detail ? (
            <form onSubmit={handleSave}>
              <section className="card mb-3 shadow-sm cis-fee-collection-hero">
                <div className="card-header py-2">Student</div>
                <div className="card-body">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <h5 className="cis-fee-student-name mb-1">{data.detail.student.name}</h5>
                      <p className="text-muted mb-0">{data.detail.student.registerNo}</p>
                      <p className="text-muted small mb-0">{data.detail.student.academicYear} | {data.detail.student.courseName}</p>
                    </div>
                    <div className="col-md-4 text-center">
                      {data.detail.student.photoUrl ? (
                        <img className="cis-fee-student-photo" src={data.detail.student.photoUrl} alt={data.detail.student.name} width={80} height={100} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <div className="row">
                <div className="col-md-4">
                  <section className="card mb-3">
                    <div className="card-header">DME Fees</div>
                    <div className="card-body">
                      <div className="mb-2">
                        <label className="form-label">Date</label>
                        <input type="date" className="form-control" value={toDateInputValue(form.tfReceiptDate)} onChange={(e) => patchForm('tfReceiptDate', e.target.value)} />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">Receipt No.</label>
                        <input className="form-control" value={form.tfReceiptNo} onChange={(e) => patchForm('tfReceiptNo', e.target.value)} />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">Amount</label>
                        <input className="form-control" value={form.tfAmount} onChange={(e) => patchForm('tfAmount', e.target.value)} />
                      </div>
                    </div>
                  </section>
                </div>

                <div className="col-md-4">
                  <section className="card mb-3">
                    <div className="card-header">Scholarship</div>
                    <div className="card-body">
                      <label className="d-block mb-2">
                        <input type="checkbox" checked={form.scholarShip} onChange={(e) => patchForm('scholarShip', e.target.checked)} /> Scholarship
                      </label>
                      {form.scholarShip ? (
                        <>
                          {['scst', 'sca', 'bc', 'mbc'].map((val) => (
                            <label key={val} className="me-2">
                              <input type="radio" name="cSship" checked={form.casteScholarship === val} onChange={() => patchForm('casteScholarship', val)} /> {val.toUpperCase()}
                            </label>
                          ))}
                          <label className="d-block mt-2">
                            <input type="checkbox" checked={form.firstGraduate} onChange={(e) => patchForm('firstGraduate', e.target.checked)} /> First Graduate
                          </label>
                        </>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="col-md-4">
                  <section className="card mb-3">
                    <div className="card-header">ACMEC Scholarship</div>
                    <div className="card-body">
                      <label className="d-block mb-2">
                        <input type="checkbox" checked={form.acmecScholarship} onChange={(e) => patchForm('acmecScholarship', e.target.checked)} /> Eligible
                      </label>
                      <div className="mb-2">
                        <label className="form-label">Amount</label>
                        <input className="form-control" value={form.acmecAmount} onChange={(e) => patchForm('acmecAmount', e.target.value)} />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">Approved</label>
                        <input className="form-control" value={form.acmecApproved} onChange={(e) => patchForm('acmecApproved', e.target.value)} />
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
            </form>
          ) : (
            <div className="card shadow-sm cis-fee-empty-state">
              <div className="card-body">
                <i className="fa fa-user" aria-hidden="true" />
                <p className="mb-0">Search and select a student to configure ACMEC/scholarship details.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </FeePageShell>
  );
}
