import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import SetupAlerts from './SetupAlerts';
import FeeMultiDropdown from '../FeeMultiDropdown';
import { useFeeSetupApi } from './useFeeSetupApi';

function normalizeRow(row) {
  return {
    ...row,
    feeType: String(row.feeType ?? ''),
    feeBank: String(row.feeBank ?? ''),
    feeFor: String(row.feeFor ?? ''),
    feeName: String(row.feeName ?? ''),
    academicTypes: Array.isArray(row.academicTypes) ? row.academicTypes.map(String) : ['Regular'],
    feeCaste: Array.isArray(row.feeCaste) ? row.feeCaste.map(String) : [],
    feeInclude: row.feeInclude === 'except' ? 'except' : '',
  };
}

function optionLabel(options, value, fallback = '--Select--') {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label || fallback;
}

function SetupSelect({
  value,
  options,
  placeholder = '--Select--',
  disabled = false,
  onChange,
}) {
  const label = optionLabel(options, value, placeholder);
  return (
    <select
      className="form-select form-select-sm cis-fee-name-select"
      value={value}
      disabled={disabled}
      title={label}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function emptyRow(classYear, order = 1) {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    classYear,
    feeOrder: order,
    feeType: '',
    feeBank: '',
    feeFor: '',
    academicTypes: ['Regular'],
    feeInclude: '',
    feeCaste: [],
    feeName: '',
    feeAmount: '',
    feeScholarship: '',
    feeDiscount: '',
    locked: false,
  };
}

export default function FeeNameSetup() {
  const {
    data, busy, error, notice, clearNotice, load, save,
  } = useFeeSetupApi('name');
  const [courseRef, setCourseRef] = useState('');
  const [activeTab, setActiveTab] = useState(1);
  const [tabs, setTabs] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const lookups = data?.lookups || {};

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.courseRef) setCourseRef(data.courseRef);
    if (data?.tabs?.length) {
      setTabs(data.tabs.map((tab) => ({
        ...tab,
        rows: tab.rows.map((row) => normalizeRow({
          ...row,
          key: row.id ? `id-${row.id}` : `new-${tab.classYear}-${row.feeOrder}`,
        })),
      })));
      setActiveTab(data.tabs[0]?.classYear || 1);
    } else {
      setTabs([]);
    }
  }, [data]);

  const handleBatchChange = async (value) => {
    setCourseRef(value);
    if (value) await load({ courseId: value });
  };

  const currentTab = tabs.find((t) => t.classYear === activeTab);
  const currentRows = currentTab?.rows || [];

  const setCurrentRows = (updater) => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.classYear !== activeTab) return tab;
      const nextRows = typeof updater === 'function' ? updater(tab.rows) : updater;
      return { ...tab, rows: nextRows };
    }));
  };

  const updateRow = (index, patch) => {
    setCurrentRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setCurrentRows((rows) => [...rows, emptyRow(activeTab, rows.length + 1)]);
  };

  const isScholarLabel = (labelId) => (lookups.scholarLabelIds || []).includes(Number(labelId));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!data?.courseId || !data?.admissionYear) return;
    const allRows = tabs.flatMap((tab) => tab.rows);
    await save({
      action: 'update',
      courseId: data.courseId,
      admissionYear: data.admissionYear,
      courseRef,
      rows: allRows,
    });
  };

  const handleDelete = async () => {
    await save({ action: 'delete', id: deleteId, courseRef });
    setDeleteId(null);
  };

  return (
    <div>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
      <div className="mb-4">
        <label className="form-label">Batch <span className="text-danger">*</span></label>
        <select
          className="form-select"
          value={courseRef}
          onChange={(e) => handleBatchChange(e.target.value)}
        >
          <option value="">--Select--</option>
          {(data?.batchGroups || []).map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {tabs.length > 0 && (
        <form onSubmit={handleSave}>
          <ul className="nav nav-tabs mb-3 cis-fee-tab-header">
            {tabs.map((tab) => (
              <li className="nav-item" key={tab.classYear}>
                <button
                  type="button"
                  className={`nav-link${activeTab === tab.classYear ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.classYear)}
                >
                  {tab.classYear}
                  {' '}
                  Year
                </button>
              </li>
            ))}
          </ul>

          <div className="table-responsive">
            <table className="table table-bordered align-middle small cis-fee-name-table cis-fee-setup-table">
              <thead className="cis-fee-sheet-head">
                <tr>
                  <th className="cis-fee-col-order">D.Order</th>
                  <th className="cis-fee-col-select">Type</th>
                  <th className="cis-fee-col-select">Bank</th>
                  <th className="cis-fee-col-select">Admission</th>
                  <th className="cis-fee-col-select">Academic Type</th>
                  <th className="cis-fee-col-check">Except</th>
                  <th className="cis-fee-col-select">Scholarship Community</th>
                  <th className="cis-fee-col-select">Name</th>
                  <th className="cis-fee-col-amount">Amount</th>
                  <th className="cis-fee-col-amount">Scholarship</th>
                  <th className="cis-fee-col-amount">Spl Discount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {currentRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-muted">No fee rows. Click + to add.</td>
                  </tr>
                )}
                {currentRows.map((row, index) => (
                  <tr
                    key={row.key || row.id || index}
                    className={row.locked ? 'cis-fee-name-row-locked' : undefined}
                  >
                    <td>
                      {row.locked ? (
                        <span className="cis-fee-locked-order" title="Used in fee collection">
                          <i className="fa fa-lock" aria-hidden="true" />
                          {row.feeOrder}
                        </span>
                      ) : (
                        <input
                          type="text"
                          className="form-control form-control-sm dorder"
                          maxLength={3}
                          value={row.feeOrder}
                          onChange={(e) => updateRow(index, { feeOrder: e.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      <SetupSelect
                        value={row.feeType}
                        options={lookups.feeTypes || []}
                        disabled={row.locked}
                        onChange={(feeType) => updateRow(index, { feeType })}
                      />
                    </td>
                    <td>
                      <SetupSelect
                        value={row.feeBank}
                        options={lookups.feeBanks || []}
                        placeholder="--Select--"
                        disabled={row.locked}
                        onChange={(feeBank) => updateRow(index, { feeBank })}
                      />
                    </td>
                    <td>
                      <SetupSelect
                        value={row.feeFor}
                        options={lookups.feeForOptions || []}
                        placeholder="All"
                        disabled={row.locked}
                        onChange={(feeFor) => updateRow(index, { feeFor })}
                      />
                    </td>
                    <td>
                      <FeeMultiDropdown
                        value={row.academicTypes || []}
                        options={lookups.academicTypeOptions || []}
                        disabled={row.locked}
                        minSelected={1}
                        onChange={(academicTypes) => updateRow(index, { academicTypes })}
                      />
                    </td>
                    <td className="text-center cis-fee-col-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={row.feeInclude === 'except'}
                        disabled={row.locked}
                        onChange={(e) => updateRow(index, {
                          feeInclude: e.target.checked ? 'except' : '',
                        })}
                      />
                    </td>
                    <td>
                      <FeeMultiDropdown
                        value={row.feeCaste || []}
                        options={lookups.casteOptions || []}
                        placeholder="All"
                        disabled={row.locked}
                        onChange={(feeCaste) => updateRow(index, { feeCaste })}
                      />
                    </td>
                    <td>
                      <SetupSelect
                        value={row.feeName}
                        options={lookups.feeLabels || []}
                        disabled={row.locked}
                        onChange={(feeName) => {
                          const scholar = isScholarLabel(feeName);
                          updateRow(index, {
                            feeName,
                            feeScholarship: scholar ? row.feeScholarship : '',
                          });
                        }}
                      />
                    </td>
                    <td>
                      {row.locked ? row.feeAmount : (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          maxLength={70}
                          value={row.feeAmount}
                          onChange={(e) => updateRow(index, { feeAmount: e.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        maxLength={70}
                        value={row.feeScholarship}
                        readOnly={!row.locked && !isScholarLabel(row.feeName)}
                        onChange={(e) => updateRow(index, { feeScholarship: e.target.value })}
                      />
                    </td>
                    <td>
                      {row.locked ? row.feeDiscount : (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          maxLength={70}
                          value={row.feeDiscount}
                          onChange={(e) => updateRow(index, { feeDiscount: e.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      {row.id && !row.locked ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRow}>+</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
          </div>

          <ConfirmModal
            show={Boolean(deleteId)}
            message="Are you sure to delete..."
            onClose={() => setDeleteId(null)}
            onConfirm={handleDelete}
            busy={busy}
          />
        </form>
      )}
    </div>
  );
}
