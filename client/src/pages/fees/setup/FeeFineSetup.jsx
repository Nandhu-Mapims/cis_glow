import { Fragment, useEffect, useMemo, useState } from 'react';
import SetupAlerts from './SetupAlerts';
import { toDateInputValue } from '../../../utils/dateInputs';
import { useFeeSetupApi } from './useFeeSetupApi';

export default function FeeFineSetup() {
  const {
    data, busy, error, notice, clearNotice, load, save,
  } = useFeeSetupApi('fine');
  const [yearRef, setYearRef] = useState('');
  const [academicType, setAcademicType] = useState('Regular');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.academicYearRef) setYearRef(data.academicYearRef);
    if (data?.academicType) setAcademicType(data.academicType);
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const sectionMap = useMemo(() => {
    const map = new Map();
    (data?.sections || []).forEach((section) => {
      const key = `${section.courseName}-${section.classYear}`;
      map.set(key, section.label);
    });
    return map;
  }, [data?.sections]);

  const handleGo = async (e) => {
    e.preventDefault();
    await load({ academicYearRef: yearRef, academicType });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!data?.academicYear || !data?.academicBatch) return;
    await save({
      action: 'update',
      academicYear: data.academicYear,
      academicBatch: data.academicBatch,
      academicType: data.academicType,
      rows,
    });
  };

  const renderedRows = useMemo(() => {
    let lastSection = '';
    return rows.map((row, index) => {
      const sectionKey = `${row.courseName}-${row.classYear}`;
      const sectionLabel = sectionMap.get(sectionKey);
      const showHeader = sectionLabel && sectionLabel !== lastSection;
      if (showHeader) lastSection = sectionLabel;
      return { row, index, showHeader, sectionKey, sectionLabel };
    });
  }, [rows, sectionMap]);

  return (
    <div>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
      <form className="row g-3 mb-4" onSubmit={handleGo}>
        <div className="col-md-4">
          <label className="form-label">Academic Year</label>
          <select
            className="form-select"
            value={yearRef}
            onChange={(e) => setYearRef(e.target.value)}
          >
            <option value="">--Select Year--</option>
            {(data?.academicYearOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label d-block">Academic Type</label>
          {['Regular', 'Additional', 'Break'].map((type) => (
            <label key={type} className="me-3">
              <input className="me-2"
                type="radio"
                name="academicType"
                value={type}
                checked={academicType === type}
                onChange={() => setAcademicType(type)}
              />
              {' '}
              {type}
            </label>
          ))}
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button type="submit" className="btn btn-primary" disabled={busy}>Go</button>
        </div>
      </form>

      {rows.length > 0 && (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="cis-fee-sheet-head">
                <tr>
                  <th>Type</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Fine Type</th>
                </tr>
              </thead>
              <tbody>
                {renderedRows.map(({
                  row, index, showHeader, sectionKey, sectionLabel,
                }) => (
                    <Fragment key={`${sectionKey}-${row.feeTypeId}-${index}`}>
                      {showHeader && (
                        <tr className="table-light">
                          <td colSpan={4}><strong>{sectionLabel}</strong></td>
                        </tr>
                      )}
                      <tr>
                        <td>{row.feeTypeLabel}</td>
                        <td>
                          <input
                            type="date"
                            className="form-control"
                            value={toDateInputValue(row.dueDate)}
                            onChange={(e) => updateRow(index, { dueDate: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            maxLength={10}
                            value={row.fineAmount}
                            onChange={(e) => updateRow(index, { fineAmount: e.target.value })}
                          />
                        </td>
                        <td>
                          <label className="me-3">
                            <input className="me-2"
                              type="radio"
                              name={`fineType-${index}`}
                              checked={row.fineType !== 'per_day'}
                              onChange={() => updateRow(index, { fineType: 'one_time' })}
                            />
                            {' '}One Time
                          </label>
                          <label>
                            <input className="me-2"
                              type="radio"
                              name={`fineType-${index}`}
                              checked={row.fineType === 'per_day'}
                              onChange={() => updateRow(index, { fineType: 'per_day' })}
                            />
                            {' '}Per Day
                          </label>
                        </td>
                      </tr>
                    </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-end">
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>Save</button>
          </div>
        </form>
      )}
    </div>
  );
}
