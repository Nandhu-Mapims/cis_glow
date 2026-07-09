import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import {
  CurriculumFilterCard,
  CurriculumFilterRow,
  CurriculumSetupCard,
  OptionPills,
} from './curriculumReportUi';

function emptyRow(order = 1) {
  return { key: `new-${order}`, id: null, order, name: '' };
}

export default function FeedbackTopicSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('feedback-topics');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.category) setCategory(data.category);
    if (data?.rows) {
      setRows(data.rows.map((row, i) => ({
        ...row,
        key: row.id ? `id-${row.id}` : `new-${i}`,
      })));
    }
  }, [data]);

  const onCategoryChange = async (value) => {
    setCategory(value);
    await load({ category: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow(prev.length + 1)]);

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      action: 'update',
      category,
      rows: rows.map(({ id, order, name }) => ({ id, order, name })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await save({ action: 'delete', id: deleteId, category });
    setDeleteId(null);
  };

  const categoryPills = (data?.categoryOptions || []).map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />

      <CurriculumFilterCard>
        <CurriculumFilterRow label="Category">
          <OptionPills
            options={categoryPills}
            value={category}
            disabled={busy}
            onChange={onCategoryChange}
          />
        </CurriculumFilterRow>
      </CurriculumFilterCard>

      {category ? (
        <form onSubmit={handleSave}>
          <CurriculumSetupCard title="Feedback topics">
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0">
                <thead>
                  <tr><th>Order</th><th>Name</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.key}>
                      <td style={{ width: '6rem' }}>
                        <input className="form-control form-control-sm" value={row.order} onChange={(e) => updateRow(i, { order: e.target.value })} />
                      </td>
                      <td>
                        <input className="form-control form-control-sm" value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                      </td>
                      <td style={{ width: '5rem' }}>
                        {row.id ? (
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteId(row.id)}>Del</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CurriculumSetupCard>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-info btn-sm" onClick={addRow}>Add topic</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal show={Boolean(deleteId)} onClose={() => setDeleteId(null)} onConfirm={handleDelete} message="Delete this topic?" />
    </>
  );
}
