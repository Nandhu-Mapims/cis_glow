import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import { CurriculumReportSkeleton } from './curriculumReportUi';

function formatDayLabel(day) {
  if (!day) return '';
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function PeriodCell({ period, cellId, onChange, disabled }) {
  if (!period) return <td />;
  const isBreak = period.periodList === 'Break' || period.startPeriod === 'Break';

  if (isBreak) {
    return (
      <td colSpan={period.colspan || 1} className="period-setup-cell period-setup-cell-break">
        <div className="period-setup-period-label">Break</div>
      </td>
    );
  }

  return (
    <td colSpan={period.colspan || 1} className="period-setup-cell">
      <div className="period-setup-period-label">P: {period.periodList}</div>
      <div className="period-setup-session">
        <label className="me-2">
          <input
            type="radio"
            name={`session-${cellId}`}
            checked={period.session !== 'afternoon'}
            disabled={disabled}
            onChange={() => onChange({ session: 'forenoon' })}
          />
          {' '}FN
        </label>
        <label>
          <input
            type="radio"
            name={`session-${cellId}`}
            checked={period.session === 'afternoon'}
            disabled={disabled}
            onChange={() => onChange({ session: 'afternoon' })}
          />
          {' '}AN
        </label>
      </div>
      <div className="input-group input-group-sm period-setup-time">
        <span className="input-group-text">F</span>
        <input
          className="form-control"
          placeholder="HH:MM"
          value={period.fromTime || ''}
          disabled={disabled}
          onChange={(e) => onChange({ fromTime: e.target.value })}
        />
      </div>
      <div className="input-group input-group-sm period-setup-time">
        <span className="input-group-text">T</span>
        <input
          className="form-control"
          placeholder="HH:MM"
          value={period.toTime || ''}
          disabled={disabled}
          onChange={(e) => onChange({ toTime: e.target.value })}
        />
      </div>
    </td>
  );
}

export default function PeriodSetupSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('period-setup');
  const [courseKey, setCourseKey] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [periodPerDay, setPeriodPerDay] = useState('');
  const [breakPeriod, setBreakPeriod] = useState('');
  const [dayRows, setDayRows] = useState([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.selectedDays) setSelectedDays(data.selectedDays);
    if (data?.periodPerDay) setPeriodPerDay(String(data.periodPerDay));
    if (data?.breakPeriod != null) setBreakPeriod(String(data.breakPeriod));
    if (data?.dayRows) setDayRows(data.dayRows);
  }, [data]);

  const slotCount = Number(periodPerDay) || dayRows[0]?.periods?.length || 0;
  const canPreview = courseKey && selectedDays.length > 0 && Number(periodPerDay) > 0;
  const showTimetablePanel = dayRows.length > 0 || previewing;

  const runPreview = async () => {
    if (!canPreview) return;
    setPreviewing(true);
    try {
      await load({
        courseKey,
        selectedDays,
        periodPerDay: Number(periodPerDay),
        breakPeriod,
        action: 'change',
        preview: true,
        dayRows,
      });
    } finally {
      setPreviewing(false);
    }
  };

  const previewButtonLabel = (label) => {
    if (!previewing) return label;
    return (
      <>
        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        Refreshing…
      </>
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      courseKey,
      selectedDays,
      periodPerDay: Number(periodPerDay),
      breakPeriod,
      dayRows,
    });
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const updateCombined = (dayIndex, combined) => {
    setDayRows((prev) => prev.map((row, index) => (
      index === dayIndex ? { ...row, combined } : row
    )));
  };

  const updatePeriod = (dayIndex, periodIndex, patch) => {
    setDayRows((prev) => prev.map((row, index) => {
      if (index !== dayIndex) return row;
      return {
        ...row,
        periods: row.periods.map((period, pIndex) => (
          pIndex === periodIndex ? { ...period, ...patch } : period
        )),
      };
    }));
  };

  const courseOptionsByGroup = (data?.courseOptions || []).reduce((groups, option) => {
    const key = option.group || 'Courses';
    if (!groups[key]) groups[key] = [];
    groups[key].push(option);
    return groups;
  }, {});

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setDayRows([]);
    await load({ courseKey: value });
  };
  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy && !previewing} />

      <div className="card shadow-sm mb-3 period-setup-card">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Category</label>
              <select className="form-select" value={courseKey} disabled={busy} onChange={(e) => onCourseChange(e.target.value)}>
                <option value="">--Select--</option>
                {Object.entries(courseOptionsByGroup).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {courseKey ? (
        <form onSubmit={handleSave}>
          <div className="card shadow-sm mb-3 period-setup-card">
            <div className="card-header fw-semibold">Schedule Settings</div>
            <div className="card-body">
              <label className="form-label fw-semibold">Days</label>
              <div className="period-setup-day-group mb-3">
                {(data?.dayOptions || []).map((d) => {
                  const active = selectedDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => toggleDay(d.value)}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <div className="row g-3 align-items-end">
                <div className="col-sm-6 col-md-3">
                  <label className="form-label">Period per day</label>
                  <input
                    className="form-control"
                    inputMode="numeric"
                    value={periodPerDay}
                    onChange={(e) => setPeriodPerDay(e.target.value)}
                  />
                </div>
                <div className="col-sm-6 col-md-4">
                  <label className="form-label">Break period</label>
                  <input
                    className="form-control"
                    placeholder="E.g. 3,6,9"
                    value={breakPeriod}
                    onChange={(e) => setBreakPeriod(e.target.value)}
                  />
                  <div className="form-text">Comma-separated slot numbers</div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <button
                    type="button"
                    className="btn btn-info w-100"
                    disabled={previewing || !canPreview}
                    onClick={runPreview}
                  >
                    {previewButtonLabel('Preview')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showTimetablePanel ? (
            <div className="card shadow-sm mb-3 period-setup-card">
              <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
                <span>Period Timetable</span>
                <span className="text-muted small">
                  {previewing && !dayRows.length
                    ? 'Building timetable…'
                    : `${dayRows.length} day(s) · ${slotCount} slot(s)`}
                </span>
              </div>
              <div className="card-body p-0 period-setup-panel-body">
                {previewing ? (
                  <div className="academic-report-loading" aria-live="polite" aria-busy="true">
                    <div className="spinner-border text-primary" role="status" aria-hidden="true" />
                    <span>Updating timetable…</span>
                  </div>
                ) : null}
                {dayRows.length > 0 ? (
                  <div className={`table-responsive ${previewing ? 'is-refreshing' : ''}`}>
                    <table className="table table-bordered period-setup-grid mb-0">
                      <thead>
                        <tr>
                          <th className="period-setup-day-col">Day</th>
                          <th className="period-setup-combined-col">
                            Combined
                            <div className="fw-normal small text-muted">E.g. (1,2,3)</div>
                          </th>
                          {Array.from({ length: slotCount }, (_, i) => (
                            <th key={i} className="period-setup-slot-col text-center">{i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows.map((dayRow, dayIndex) => (
                          <tr key={dayRow.day}>
                            <td className="period-setup-day-col fw-semibold">{formatDayLabel(dayRow.day)}</td>
                            <td className="period-setup-combined-col">
                              <input
                                className="form-control form-control-sm"
                                value={dayRow.combined || ''}
                                placeholder="(1,2)"
                                disabled={previewing}
                                onChange={(e) => updateCombined(dayIndex, e.target.value)}
                              />
                            </td>
                            {(dayRow.periods || []).map((period, periodIndex) => (
                              <PeriodCell
                                key={`${dayRow.day}-${periodIndex}`}
                                cellId={`${dayRow.day}-${periodIndex}`}
                                period={period}
                                disabled={previewing}
                                onChange={(patch) => updatePeriod(dayIndex, periodIndex, patch)}
                              />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : previewing ? (
                  <div className="p-3">
                    <CurriculumReportSkeleton />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {canPreview && dayRows.length > 0 ? (
            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy || previewing}>Save All</button>
              <button
                type="button"
                className="btn btn-outline-info"
                disabled={previewing || !canPreview}
                onClick={runPreview}
              >
                {previewButtonLabel('Change')}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </>
  );
}
