import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import { CurriculumSetupCard } from './curriculumReportUi';

function normalizeHex(val) {
  return String(val || '').replace(/^#/, '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);
}

function hexCss(val, fallback = '#ffffff') {
  const h = normalizeHex(val);
  return h.length === 6 ? `#${h}` : fallback;
}

function contrastText(hex) {
  const h = normalizeHex(hex);
  if (h.length !== 6) return '#000000';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#000000' : '#ffffff';
}

export default function BatchColorSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('batch-color');
  const [rows, setRows] = useState([]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.rows) setRows(data.rows); }, [data]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      rows: rows.map((row) => ({
        ...row,
        backColor: normalizeHex(row.backColor),
        foreColor: normalizeHex(row.foreColor),
      })),
    });
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <form onSubmit={handleSave}>
        <CurriculumSetupCard title="Batch Color">
          <div className="table-responsive" style={{ maxWidth: '36rem' }}>
            <table className="table table-bordered table-sm mb-0 curriculum-batch-color-table">
              <thead className="table-secondary">
                <tr>
                  <th style={{ width: '40%' }}>Batch</th>
                  <th style={{ width: '30%' }}>Background</th>
                  <th style={{ width: '30%' }}>Foreground</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.batchNo}>
                    <td className="align-middle">Batch {row.batchLabel}</td>
                    <td>
                      <input
                        className="form-control form-control-sm curriculum-batch-color-input"
                        type="text"
                        maxLength={6}
                        value={normalizeHex(row.backColor)}
                        style={{
                          backgroundColor: hexCss(row.backColor),
                          color: normalizeHex(row.foreColor).length === 6
                            ? hexCss(row.foreColor)
                            : contrastText(row.backColor),
                        }}
                        onChange={(e) => updateRow(i, { backColor: normalizeHex(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm curriculum-batch-color-input"
                        type="text"
                        maxLength={6}
                        value={normalizeHex(row.foreColor)}
                        style={{
                          backgroundColor: hexCss(row.foreColor),
                          color: contrastText(row.foreColor),
                        }}
                        onChange={(e) => updateRow(i, { foreColor: normalizeHex(e.target.value) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CurriculumSetupCard>
        <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
      </form>
    </>
  );
}
