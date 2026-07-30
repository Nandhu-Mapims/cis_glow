import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { toDateInputValue } from '../../../utils/dateInputs';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import {
  CurriculumFilterCard,
  CurriculumFilterRow,
  CurriculumSetupCard,
  GroupedSelect,
  OptionPills,
} from './curriculumReportUi';

export default function InternshipScheduleSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('internship-schedule');
  const [courseKey, setCourseKey] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.batchNo) setBatchNo(String(data.batchNo));
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setBatchNo('');
    await load({ courseKey: value });
  };

  const onBatchChange = async (value) => {
    setBatchNo(value);
    await load({ courseKey, batchNo: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, {
    department: '', fromDate: '', toDate: '', fromTime: '', toTime: '', roomNo: '',
  }]);

  const handleSave = async (e) => {
    e.preventDefault();
    await save({ courseKey, batchNo: Number(batchNo), rows });
  };

  const batchPills = (data?.batchOptions || []).map((b) => ({
    value: b.value,
    label: b.label,
  }));

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />

      <CurriculumFilterCard>
        <CurriculumFilterRow label="Course">
          <GroupedSelect
            options={data?.courseOptions}
            value={courseKey}
            disabled={busy}
            placeholder="--Select Course--"
            onChange={onCourseChange}
          />
        </CurriculumFilterRow>
        {courseKey && batchPills.length ? (
          <CurriculumFilterRow label="Batch">
            <OptionPills
              options={batchPills}
              value={batchNo}
              disabled={busy}
              onChange={onBatchChange}
            />
          </CurriculumFilterRow>
        ) : null}
      </CurriculumFilterCard>

      {batchNo ? (
        <form onSubmit={handleSave}>
          <CurriculumSetupCard title="Internship schedule">
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0">
                <thead>
                  <tr><th>Department</th><th>From</th><th>To</th><th>Time</th><th>Room No</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <select className="form-select form-select-sm" value={row.department} onChange={(e) => updateRow(i, { department: e.target.value })}>
                          <option value="">--</option>
                          {(data?.departmentOptions || []).map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="date" className="form-control form-control-sm" value={toDateInputValue(row.fromDate)} onChange={(e) => updateRow(i, { fromDate: e.target.value })} /></td>
                      <td><input type="date" className="form-control form-control-sm" value={toDateInputValue(row.toDate)} onChange={(e) => updateRow(i, { toDate: e.target.value })} /></td>
                      <td className="text-nowrap">
                        <input className="form-control form-control-sm d-inline-block" style={{ width: '5.5rem' }} value={row.fromTime} onChange={(e) => updateRow(i, { fromTime: e.target.value })} />
                        {' – '}
                        <input className="form-control form-control-sm d-inline-block" style={{ width: '5.5rem' }} value={row.toTime} onChange={(e) => updateRow(i, { toTime: e.target.value })} />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={row.roomNo}
                          onChange={(e) => updateRow(i, { roomNo: e.target.value })}
                        >
                          <option value="">--Select--</option>
                          {(data?.roomGroups || []).map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.options.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CurriculumSetupCard>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-info btn-sm" onClick={addRow}>Add row</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}
    </>
  );
}
