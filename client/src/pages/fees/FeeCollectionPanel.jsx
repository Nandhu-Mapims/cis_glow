import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { printFeeSlip } from '../../utils/printReport';
import {
  clampPayAmount,
  computeFeeCollectionTotals,
  computePendingBalanceTotal,
  computeSelectedBalanceTotal,
  groupEntriesForTabs,
  totalsPayload,
} from './feeCollectionTotals';
import { formatIndianMoney } from './feeUiHelpers';

const BANK_OPTIONS = [
  { value: 'cbi', label: 'Central Bank' },
  { value: 'axis', label: 'Axis Bank' },
  { value: 'sbi', label: 'State Bank' },
];

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function BalanceCell({ amount }) {
  const num = Number(amount) || 0;
  if (num <= 0) {
    return <span className="text-muted">0</span>;
  }
  return (
    <span className="cis-fee-balance-badge">
      {formatIndianMoney(amount)}
    </span>
  );
}

function FeeAmountCell({ entry, onAmountChange }) {
  if (entry.status === 'paid') {
    return <span className="text-muted">—</span>;
  }
  return (
    <input
      className="form-control form-control-sm text-end cis-fee-pay-input"
      value={entry.feeAmount}
      onChange={(e) => onAmountChange(entry.index, e.target.value)}
    />
  );
}

function ScholarshipHint({ entry }) {
  if (!entry.scholarshipDeducted || Number(entry.scholarshipDeducted) <= 0) {
    return null;
  }
  return (
    <small className="text-muted ms-1">
      (
      <del>{entry.scholarshipDeducted}</del>
      )
    </small>
  );
}

export default function FeeCollectionPanel() {
  const [searchParams] = useSearchParams();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registerNo, setRegisterNo] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useTransientNotice(4000);
  const [studentName, setStudentName] = useState('');
  const [courseLabel, setCourseLabel] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [entries, setEntries] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [feeTypeTabs, setFeeTypeTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [discounts, setDiscounts] = useState({});
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payBank, setPayBank] = useState('cbi');
  const [receiptHtml, setReceiptHtml] = useState('');

  useEffect(() => {
    const roll = searchParams.get('registerNo')?.trim();
    if (roll) setRegisterNo(roll.toUpperCase());
  }, [searchParams]);

  const tabGroups = useMemo(
    () => groupEntriesForTabs(entries, feeTypeTabs),
    [entries, feeTypeTabs],
  );

  const totals = useMemo(
    () => computeFeeCollectionTotals(entries, discounts),
    [entries, discounts],
  );

  const hasPending = entries.some((e) => e.status === 'pending');
  const selectedCount = entries.filter((e) => e.selected && e.status === 'pending').length;
  const totalBalanceDue = useMemo(() => computePendingBalanceTotal(entries), [entries]);
  const selectedBalanceDue = useMemo(() => computeSelectedBalanceTotal(entries), [entries]);

  const resetSheet = () => {
    setStudentName('');
    setCourseLabel('');
    setPhotoUrl(null);
    setMeta(null);
    setEntries([]);
    setFeeTypes([]);
    setFeeTypeTabs([]);
    setActiveTab('');
    setDiscounts({});
    setReceiptHtml('');
  };

  const loadSheet = async (e) => {
    e?.preventDefault?.();
    const roll = registerNo.trim().toUpperCase();
    if (!roll) {
      setError('Register number is required');
      return;
    }
    setGenerating(true);
    setError(null);
    setMessage('');
    setReceiptHtml('');
    try {
      const res = await api.post('/api/fees/collection/sheet', {
        registerNo: roll,
        paidDate: toDisplayDate(paidDate),
      });
      setStudentName(res.data.studentName || '');
      setCourseLabel(res.data.courseLabel || '');
      setPhotoUrl(res.data.photoUrl || null);
      setMeta(res.data.meta || null);
      setEntries((res.data.entries || []).map((entry) => ({
        ...entry,
        selected: entry.selected ?? false,
      })));
      setFeeTypes(res.data.feeTypes || []);
      const tabs = res.data.feeTypeTabs || [];
      setFeeTypeTabs(tabs);
      setActiveTab(tabs[0]?.id || '');
      setDiscounts({});
      if (res.data.message) setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load fee sheet');
      resetSheet();
    } finally {
      setGenerating(false);
    }
  };

  const toggleEntry = (index) => {
    setEntries((prev) => prev.map((entry) => (
      entry.index === index && entry.status !== 'paid'
        ? { ...entry, selected: !entry.selected }
        : entry
    )));
  };

  const toggleAllInType = (feeType, checked) => {
    setEntries((prev) => prev.map((entry) => (
      entry.feeType === feeType && entry.status === 'pending'
        ? { ...entry, selected: checked }
        : entry
    )));
  };

  const updateAmount = (index, value) => {
    setEntries((prev) => prev.map((entry) => {
      if (entry.index !== index) return entry;
      return { ...entry, feeAmount: String(clampPayAmount(value, entry.balanceAmount)) };
    }));
  };

  const updateDiscount = (feeType, field, value) => {
    setDiscounts((prev) => ({
      ...prev,
      [feeType]: { ...prev[feeType], [field]: value },
    }));
  };

  const generateSlip = async () => {
    if (!meta || !hasPending) {
      setError('Load a student fee sheet first');
      return;
    }
    if (selectedCount === 0) {
      setError('Select at least one fee line');
      return;
    }
    if (totals.grandTotal <= 0) {
      setError('Total amount must be greater than zero');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const res = await api.put('/api/fees/collection/sheet', {
        meta,
        entries,
        feeTypes,
        paidDate: toDisplayDate(paidDate),
        payBank,
        totals: totalsPayload(totals.byType),
      });
      setMessage(res.data.message || 'Fee slip generated');
      if (res.data.receiptHtml) {
        setReceiptHtml(res.data.receiptHtml);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to generate slip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cis-fee-collection">
      {error && <div className="alert alert-danger alert-dismissible fade show"><span>{error}</span><button type="button" className="btn-close" aria-label="Close" onClick={() => setError(null)} /></div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form className="card shadow-sm cis-fee-collection-search" onSubmit={loadSheet}>
        <div className="card-body">
          <label className="form-label" htmlFor="fee-collection-roll">
            Roll No
            <span className="text-danger">*</span>
          </label>
          <div className="d-flex flex-wrap align-items-stretch gap-2">
            <input
              id="fee-collection-roll"
              className="form-control cis-fee-roll-input"
              value={registerNo}
              maxLength={10}
              autoComplete="off"
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => setRegisterNo(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn btn-primary cis-fee-go-btn" disabled={generating}>
              {generating ? 'Loading…' : 'Go'}
            </button>
          </div>
        </div>
      </form>

      {studentName && (
        <div className="cis-fee-collection-hero card shadow-sm">
          <div className="card-body d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1">
              <h3 className="cis-fee-student-name mb-1">{studentName}</h3>
              <p className="text-muted mb-0">
                {meta?.registerNo || registerNo}
                {courseLabel ? ` | ${courseLabel}` : ''}
              </p>
            </div>
            {photoUrl && (
              <img
                src={photoUrl}
                alt=""
                className="cis-fee-student-photo"
                width={100}
                height={120}
              />
            )}
          </div>
        </div>
      )}

      {tabGroups.length > 0 && (
        <div className="row g-3 cis-fee-collection-workspace">
          <div className="col-lg-9">
            <section className="card shadow-sm">
              <div className="card-header cis-fee-tab-header">
                <ul className="nav nav-tabs card-header-tabs">
                  {tabGroups.map((tab) => (
                    <li className="nav-item" key={tab.id}>
                      <button
                        type="button"
                        className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        {tab.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-body p-0">
                {tabGroups.map((tab) => {
                  const pendingRows = tab.sections.flatMap((s) => s.rows).filter((r) => r.status === 'pending');
                  const allSelected = pendingRows.length > 0 && pendingRows.every((r) => r.selected);
                  return (
                  <div
                    key={tab.id}
                    className={`cis-fee-tab-panel ${activeTab === tab.id ? '' : 'd-none'}`}
                  >
                    <div className="table-responsive">
                      <table className="table table-bordered table-sm mb-0 cis-fee-sheet-table">
                        <thead>
                          <tr className="cis-fee-sheet-head">
                            <th style={{ width: '4rem' }}>
                              <label className="cis-fee-check-label mb-0">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  disabled={!pendingRows.length}
                                  onChange={(e) => toggleAllInType(tab.id, e.target.checked)}
                                />
                                {' '}
                                Paid
                              </label>
                            </th>
                            <th>Type</th>
                            <th className="text-end">Fee</th>
                            <th className="text-end">Balance</th>
                            <th className="text-end" style={{ width: '7rem' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tab.sections.map((section) => (
                            <Fragment key={section.key}>
                              <tr className="cis-fee-section-row">
                                <td colSpan={5}>
                                  <strong>{section.label}</strong>
                                </td>
                              </tr>
                              {section.rows.map((entry) => (
                                <tr
                                  key={entry.index}
                                  className={entry.status === 'paid' ? 'cis-fee-row-paid' : ''}
                                >
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={entry.status === 'paid' ? true : entry.selected}
                                      disabled={entry.status === 'paid'}
                                      onChange={() => toggleEntry(entry.index)}
                                    />
                                  </td>
                                  <td>{entry.feeNameLabel || entry.label}</td>
                                  <td className="text-end">
                                    {formatIndianMoney(entry.originalFeeAmount || entry.tfeeAmount)}
                                    <ScholarshipHint entry={entry} />
                                  </td>
                                  <td className="text-end">
                                    <BalanceCell amount={entry.balanceAmount} />
                                  </td>
                                  <td className="text-end">
                                    <FeeAmountCell entry={entry} onAmountChange={updateAmount} />
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="cis-fee-sheet-foot">
                            <td colSpan={3} className="text-end fw-semibold">Balance Amount</td>
                            <td className="text-end fw-bold">
                              {formatIndianMoney(
                                pendingRows.reduce((s, r) => s + (Number(r.balanceAmount) || 0), 0),
                              )}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="cis-fee-type-summary p-3 border-top">
                      <div className="row g-2 align-items-center">
                        <div className="col-sm-3">
                          <label className="form-label small mb-1">Type total</label>
                          <input
                            className="form-control form-control-sm text-end cis-fee-total-readonly"
                            readOnly
                            value={formatIndianMoney(totals.byType[tab.id]?.total ?? 0)}
                          />
                        </div>
                        <div className="col-sm-2">
                          <label className="form-label small mb-1">Fee</label>
                          <input
                            className="form-control form-control-sm text-end"
                            readOnly
                            value={formatIndianMoney(totals.byType[tab.id]?.fee ?? 0)}
                          />
                        </div>
                        <div className="col-sm-2">
                          <label className="form-label small mb-1">Fine</label>
                          <input
                            className="form-control form-control-sm text-end"
                            readOnly
                            value={formatIndianMoney(totals.byType[tab.id]?.fine ?? 0)}
                          />
                        </div>
                        <div className="col-sm-2">
                          <label className="form-label small mb-1">Concession</label>
                          <input
                            className="form-control form-control-sm text-end"
                            value={discounts[tab.id]?.amount ?? ''}
                            onChange={(e) => updateDiscount(tab.id, 'amount', e.target.value)}
                          />
                        </div>
                        <div className="col-sm-3">
                          {Number(discounts[tab.id]?.amount) > 0 && (
                            <>
                              <label className="form-label small mb-1">Concession details</label>
                              <input
                                className="form-control form-control-sm"
                                value={discounts[tab.id]?.details ?? ''}
                                onChange={(e) => updateDiscount(tab.id, 'details', e.target.value)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="card-footer cis-fee-collection-actions">
                <div className="mb-3">
                  <span className="form-label d-block mb-2">Bank</span>
                  <div className="d-flex flex-wrap gap-3">
                    {BANK_OPTIONS.map((opt) => (
                      <label key={opt.value} className="cis-fee-bank-option">
                        <input
                          className="me-2"
                          type="radio"
                          name="pay_bank"
                          value={opt.value}
                          checked={payBank === opt.value}
                          onChange={() => setPayBank(opt.value)}
                        />
                        {' '}
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={saving || !hasPending || selectedCount === 0 || totals.grandTotal <= 0}
                  onClick={generateSlip}
                >
                  {saving ? 'Generating…' : 'Generate Slip'}
                </button>
                {(selectedCount === 0 || totals.grandTotal <= 0) && hasPending && (
                  <p className="text-muted small mt-2 mb-0">
                    Select fee lines and enter amounts to generate a slip.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="col-lg-3">
            <aside className="card shadow-sm cis-fee-collection-sidebar">
              <div className="card-header">Payment Summary</div>
              <div className="card-body">
                <div className="cis-fee-sidebar-stat mb-3">
                  <span className="cis-fee-sidebar-stat-label">Total balance due</span>
                  <span className="cis-fee-sidebar-stat-value">{formatIndianMoney(totalBalanceDue)}</span>
                </div>
                <div className="cis-fee-sidebar-stat mb-3">
                  <span className="cis-fee-sidebar-stat-label">Selected balance</span>
                  <span className="cis-fee-sidebar-stat-value">{formatIndianMoney(selectedBalanceDue)}</span>
                </div>
                <label className="form-label small text-muted mb-1">Collecting now</label>
                <input
                  className="form-control form-control-lg text-end cis-fee-grand-total mb-3"
                  readOnly
                  value={formatIndianMoney(totals.grandTotal)}
                />
                <label className="form-label" htmlFor="fee-collection-date">Date</label>
                <input
                  id="fee-collection-date"
                  type="date"
                  className="form-control"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
                <p className="text-muted small mt-2 mb-0">
                  Change date and click Go to recalculate fines.
                </p>
                {selectedCount > 0 && (
                  <p className="small mt-3 mb-0">
                    {selectedCount}
                    {' '}
                    line(s) selected
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {receiptHtml && (
        <div className="cis-fee-slip-preview card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Bank slip preview</span>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => printFeeSlip(receiptHtml)}
            >
              Print Slip
            </button>
          </div>
          <div
            className="card-body overflow-auto cis-fee-slip-preview-body"
            dangerouslySetInnerHTML={{ __html: receiptHtml }}
          />
        </div>
      )}
    </div>
  );
}
