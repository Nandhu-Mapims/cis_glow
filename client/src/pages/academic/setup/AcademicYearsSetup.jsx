import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

const emptyForm = {
  institutionName: '',
  institutionName2: '',
  institutionShortName: '',
  institutionAddress: '',
  institutionPhone: '',
  institutionEmail: '',
  ugAcademicYear: '',
  ugaAcademicYear: '',
  ugOddEvenSem: 1,
  pgAcademicYear: '',
  pgOddEvenSem: 1,
  examAcademicYears: [],
  ugFromDate: '',
  ugToDate: '',
  ugaFromDate: '',
  ugaToDate: '',
  pgFromDate: '',
  pgToDate: '',
};

function DateRangeFields({ fromKey, toKey, form, setField, disabled }) {
  const updateFrom = (value) => {
    setField(fromKey, value);
    if (value && form[toKey] && value > form[toKey]) setField(toKey, value);
  };
  const updateTo = (value) => {
    setField(toKey, value);
    if (value && form[fromKey] && value < form[fromKey]) setField(fromKey, value);
  };

  return (
    <div className="row g-2">
      <div className="col-6">
        <label className="form-label small text-muted mb-1">From</label>
        <input
          type="date"
          className="form-control form-control-sm"
          value={form[fromKey] || ''}
          disabled={disabled}
          onChange={(e) => updateFrom(e.target.value)}
        />
      </div>
      <div className="col-6">
        <label className="form-label small text-muted mb-1">To</label>
        <input
          type="date"
          className="form-control form-control-sm"
          value={form[toKey] || ''}
          min={form[fromKey] || undefined}
          disabled={disabled}
          onChange={(e) => updateTo(e.target.value)}
        />
      </div>
    </div>
  );
}

function SemesterToggle({ value, onChange, disabled }) {
  return (
    <div className="d-flex gap-3">
      <label className="form-check mb-0">
        <input
          type="radio"
          className="form-check-input"
          checked={Number(value) === 1}
          disabled={disabled}
          onChange={() => onChange(1)}
        />
        <span className="form-check-label">Odd</span>
      </label>
      <label className="form-check mb-0">
        <input
          type="radio"
          className="form-check-input"
          checked={Number(value) === 2}
          disabled={disabled}
          onChange={() => onChange(2)}
        />
        <span className="form-check-label">Even</span>
      </label>
    </div>
  );
}

function YearSlotCard({
  title,
  yearKey,
  yearOptions,
  fromKey,
  toKey,
  semKey,
  showSemester = false,
  form,
  setField,
  busy,
}) {
  return (
    <div className="academic-year-slot card border-0 shadow-sm h-100">
      <div className="academic-year-slot-head">{title}</div>
      <div className="card-body d-flex flex-column gap-3">
        <div>
          <label className="form-label">Academic Year</label>
          <select
            className="form-select form-select-sm"
            required
            value={form[yearKey]}
            disabled={busy}
            onChange={(e) => setField(yearKey, e.target.value)}
          >
            <option value="">-- Select --</option>
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <DateRangeFields
          fromKey={fromKey}
          toKey={toKey}
          form={form}
          setField={setField}
          disabled={busy}
        />
        {showSemester && (
          <div>
            <label className="form-label">Odd/Even Semester</label>
            <SemesterToggle
              value={form[semKey]}
              onChange={(v) => setField(semKey, v)}
              disabled={busy}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcademicYearsSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('academic-years');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data?.id && data?.ugYearOptions && !data.institutionName) return;
    if (data && (data.id || data.institutionName !== undefined)) {
      setForm({
        id: data.id,
        institutionName: data.institutionName || '',
        institutionName2: data.institutionName2 || '',
        institutionShortName: data.institutionShortName || '',
        institutionAddress: data.institutionAddress || '',
        institutionPhone: data.institutionPhone || '',
        institutionEmail: data.institutionEmail || '',
        ugAcademicYear: data.ugAcademicYear || '',
        ugaAcademicYear: data.ugaAcademicYear || '',
        ugOddEvenSem: data.ugOddEvenSem || 1,
        pgAcademicYear: data.pgAcademicYear || '',
        pgOddEvenSem: data.pgOddEvenSem || 1,
        examAcademicYears: data.examAcademicYears || [],
        ugAcId: data.ugAcId,
        ugFromDate: data.ugFromDate || '',
        ugToDate: data.ugToDate || '',
        ugaAcId: data.ugaAcId,
        ugaFromDate: data.ugaFromDate || '',
        ugaToDate: data.ugaToDate || '',
        pgAcId: data.pgAcId,
        pgFromDate: data.pgFromDate || '',
        pgToDate: data.pgToDate || '',
      });
    }
  }, [data]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await save(form);
  };

  const onExamYearsChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setField('examAcademicYears', selected);
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <form onSubmit={handleSubmit} className="academic-years-setup">
        <div className="row g-3 mb-2">
          <div className="col-lg-4">
            <YearSlotCard
              title="U.G"
              yearKey="ugAcademicYear"
              yearOptions={data?.ugYearOptions || []}
              fromKey="ugFromDate"
              toKey="ugToDate"
              semKey="ugOddEvenSem"
              showSemester
              form={form}
              setField={setField}
              busy={busy}
            />
          </div>
          <div className="col-lg-4">
            <YearSlotCard
              title="U.G Additional"
              yearKey="ugaAcademicYear"
              yearOptions={data?.ugYearOptions || []}
              fromKey="ugaFromDate"
              toKey="ugaToDate"
              form={form}
              setField={setField}
              busy={busy}
            />
          </div>
          <div className="col-lg-4">
            <YearSlotCard
              title="P.G"
              yearKey="pgAcademicYear"
              yearOptions={data?.pgYearOptions || []}
              fromKey="pgFromDate"
              toKey="pgToDate"
              semKey="pgOddEvenSem"
              showSemester
              form={form}
              setField={setField}
              busy={busy}
            />
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <label className="form-label" htmlFor="exam_years">Exam Academic Year</label>
            <p className="text-muted small mb-2">Hold Ctrl (Cmd on Mac) to select multiple years.</p>
            <select
              id="exam_years"
              className="form-select"
              multiple
              size={6}
              value={form.examAcademicYears}
              disabled={busy}
              onChange={onExamYearsChange}
            >
              {(data?.examYearOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="academic-year-slot-head">Institution Details</div>
          <div className="card-body row g-3">
            <div className="col-md-6">
              <label className="form-label">Institution Name</label>
              <input className="form-control" value={form.institutionName} disabled={busy} onChange={(e) => setField('institutionName', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Institution Name (line 2)</label>
              <input className="form-control" value={form.institutionName2} disabled={busy} onChange={(e) => setField('institutionName2', e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Institution Short Name</label>
              <input className="form-control" value={form.institutionShortName} disabled={busy} onChange={(e) => setField('institutionShortName', e.target.value)} />
            </div>
            <div className="col-md-8">
              <label className="form-label">Institution Address</label>
              <textarea className="form-control" rows={2} value={form.institutionAddress} disabled={busy} onChange={(e) => setField('institutionAddress', e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Phone</label>
              <input className="form-control" value={form.institutionPhone} disabled={busy} onChange={(e) => setField('institutionPhone', e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.institutionEmail} disabled={busy} onChange={(e) => setField('institutionEmail', e.target.value)} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </form>
    </>
  );
}
