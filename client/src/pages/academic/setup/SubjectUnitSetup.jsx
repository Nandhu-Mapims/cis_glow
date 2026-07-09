import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

export default function SubjectUnitSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('subject-unit');
  const [departmentId, setDepartmentId] = useState('');
  const [courseUnitKey, setCourseUnitKey] = useState('');
  const [unitId, setUnitId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [unitOrder, setUnitOrder] = useState(1);
  const [chapters, setChapters] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.departmentId) setDepartmentId(data.departmentId);
    if (data?.courseUnitKey) setCourseUnitKey(data.courseUnitKey);
    if (data?.unitId) setUnitId(data.unitId);
    if (data?.unit) {
      setUnitName(data.unit.name || '');
      setUnitOrder(data.unit.order || 1);
    }
    if (data?.chapters) {
      setChapters(data.chapters.map((c, i) => ({ ...c, key: c.id ? `id-${c.id}` : `new-${i}` })));
    }
  }, [data]);

  const reload = (patch = {}) => load({
    department_id: patch.departmentId ?? departmentId,
    course_name: patch.courseUnitKey ?? courseUnitKey,
    unit_name_ref: patch.unitId ?? unitId,
  });

  const courseOptionsByGroup = (data?.courseUnitOptions || []).reduce((groups, option) => {
    const key = option.group || 'Courses';
    if (!groups[key]) groups[key] = [];
    groups[key].push(option);
    return groups;
  }, {});

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Department</label>
        <div className="col-sm-4">
          <select className="form-select" value={departmentId} onChange={async (e) => {
            setDepartmentId(e.target.value);
            setCourseUnitKey('');
            setUnitId('');
            await reload({ departmentId: e.target.value, courseUnitKey: '', unitId: '' });
          }}>
            <option value="">--Select--</option>
            {(data?.departmentOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {departmentId ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Course</label>
          <div className="col-sm-6">
            <select className="form-select" value={courseUnitKey} disabled={busy} onChange={async (e) => {
              setCourseUnitKey(e.target.value);
              setUnitId('');
              await reload({ courseUnitKey: e.target.value, unitId: '' });
            }}>
              <option value="">--Select--</option>
              {Object.entries(courseOptionsByGroup).map(([group, options]) => (
                <optgroup key={group} label={group}>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {data?.courseSelection ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Unit</label>
          <div className="col-sm-4">
            <select className="form-select" value={unitId} onChange={async (e) => {
              setUnitId(e.target.value);
              await reload({ unitId: e.target.value });
            }}>
              <option value="">--Select--</option>
              <option value="add_new">+ Add new unit</option>
              {(data?.unitOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {(unitId === 'add_new' || (unitId && data?.unit)) ? (
        <form onSubmit={async (e) => {
          e.preventDefault();
          await save({
            scope: data.scope,
            courseUnitKey,
            unitId,
            unitName,
            unitOrder,
            chapters: chapters.map(({ id, name, order, materialLink }) => ({ id, name, order, materialLink })),
          });
        }}>
          <div className="row g-2 mb-3">
            <div className="col-sm-4">
              {unitId === 'add_new' ? (
                <select className="form-select" value={unitName} onChange={(e) => {
                  const preset = (data?.unitPresets || []).find((p) => p.value === e.target.value);
                  setUnitName(e.target.value);
                  if (preset) setUnitOrder(preset.order);
                }}>
                  {(data?.unitPresets || []).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              ) : (
                <input className="form-control" value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="Unit name" />
              )}
            </div>
            <div className="col-sm-2">
              <input className="form-control" type="number" value={unitOrder} onChange={(e) => setUnitOrder(e.target.value)} placeholder="Order" />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>S.No.</th><th>Topic</th><th>Order</th><th /></tr>
              </thead>
              <tbody>
                {chapters.map((row, index) => (
                  <tr key={row.key}>
                    <td>{index + 1}</td>
                    <td><input className="form-control" value={row.name} onChange={(e) => setChapters((prev) => prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))} /></td>
                    <td><input className="form-control" value={row.order} onChange={(e) => setChapters((prev) => prev.map((r, i) => (i === index ? { ...r, order: e.target.value } : r)))} /></td>
                    <td>
                      {row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : (
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setChapters((prev) => prev.filter((_, i) => i !== index))}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setChapters((prev) => [...prev, { key: `new-${Date.now()}`, name: '', order: prev.length + 1 }])}>+ Topic</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await save({
            action: 'delete',
            id: deleteId,
            departmentId,
            courseUnitKey,
            unitId,
          });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </>
  );
}
