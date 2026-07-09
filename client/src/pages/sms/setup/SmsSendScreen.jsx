import { useEffect, useMemo, useState } from 'react';

function parseValidMobiles(value) {
  const text = String(value || '');
  const found = [];
  const add = (part) => {
    const digits = String(part || '').replace(/\D/g, '');
    let normalized = null;
    if (digits.length === 10 && /^[6-9]/.test(digits)) normalized = digits;
    else if (digits.length === 12 && digits.startsWith('91')) {
      const local = digits.slice(-10);
      if (/^[6-9]/.test(local)) normalized = local;
    }
    if (normalized && !found.includes(normalized)) found.push(normalized);
  };
  for (const part of text.split(/[,\n\r;]+/)) {
    if (part.trim()) add(part.trim());
  }
  for (const match of text.match(/\b[6-9]\d{9}\b/g) || []) add(match);
  return found;
}

function parseMobileDetail(line) {
  const match = String(line).match(/^(\d{6,})\s*\((.+)\)$/);
  if (match) {
    const mobile = parseValidMobiles(match[1])[0];
    return mobile ? { mobile, name: match[2].trim() } : null;
  }
  const mobile = parseValidMobiles(line)[0];
  return mobile ? { mobile, name: '' } : null;
}

function recipientsFromData(mobileDetails, mobiles) {
  if (mobileDetails?.length) {
    return mobileDetails.map(parseMobileDetail).filter(Boolean);
  }
  return parseValidMobiles(mobiles).map((mobile) => ({ mobile, name: '' }));
}

function countMobiles(value) {
  return parseValidMobiles(value).length;
}

function mobilesFromRecipients(recipients) {
  return recipients.map((r) => r.mobile).join(',');
}

function GroupSmsFlow({
  data,
  busy,
  onLoad,
  onSave,
  groupKey,
  groupLabel,
  emptyHint = 'Select one or more groups on the left, then click Load recipients.',
  showRecipientNames = false,
  stepSelectLabel = 'Select groups',
  searchPlaceholder = 'Search groups…',
}) {
  const [selected, setSelected] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [message, setMessage] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [mobilesLoaded, setMobilesLoaded] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRawMobiles, setShowRawMobiles] = useState(false);
  const [rawMobiles, setRawMobiles] = useState('');

  useEffect(() => {
    if (!data) return;
    setSelected(data.selectedGroups || []);
    const rows = recipientsFromData(data.mobileDetails, data.mobiles);
    setRecipients(rows);
    setRawMobiles(data.mobiles || '');
    setMessage(data.message || '');
    setTemplateId(data.templateId || '');
    setMobilesLoaded(Boolean(data.mobiles));
  }, [data]);

  const groups = data?.groups || [];
  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => String(g.title || '').toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const allFilteredSelected = filteredGroups.length > 0
    && filteredGroups.every((g) => selected.includes(g.id));

  const toggleGroup = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    setMobilesLoaded(false);
  };

  const toggleAllFiltered = (checked) => {
    const ids = filteredGroups.map((g) => g.id);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return [...next];
    });
    setMobilesLoaded(false);
  };

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) => r.mobile.includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [recipients, recipientSearch]);

  const loadRecipients = async () => {
    const res = await onLoad({
      action: 'preview',
      [groupKey]: selected,
      message,
      templateId,
    });
    if (res?.mobiles != null) {
      const rows = recipientsFromData(res.mobileDetails, res.mobiles);
      setRecipients(rows);
      setRawMobiles(res.mobiles);
      setMobilesLoaded(true);
      setConfirmSend(false);
    }
  };

  const removeRecipient = (mobile) => {
    const next = recipients.filter((r) => r.mobile !== mobile);
    setRecipients(next);
    setRawMobiles(mobilesFromRecipients(next));
  };

  const applyRawMobiles = () => {
    setRecipients(parseValidMobiles(rawMobiles).map((mobile) => ({ mobile, name: '' })));
    setRawMobiles(parseValidMobiles(rawMobiles).join(','));
  };

  const applyTemplate = (tpl) => {
    setMessage(tpl.content || '');
    setTemplateId(tpl.templateId || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mobiles = mobilesFromRecipients(recipients);
    if (!mobiles) return;
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    setConfirmSend(false);
    await onSave({
      [groupKey]: selected,
      mobiles,
      message,
      templateId,
    });
  };

  const step = !mobilesLoaded ? 1 : (!message.trim() ? 2 : 3);
  const charCount = message.length;

  if (!data) return null;

  return (
    <form className="sms-send-flow" onSubmit={handleSubmit}>
      <div className="sms-send-steps mb-4">
        <div className={`sms-send-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
          <span className="sms-send-step-num">1</span>
          <span>{stepSelectLabel}</span>
        </div>
        <div className={`sms-send-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
          <span className="sms-send-step-num">2</span>
          <span>Review numbers</span>
        </div>
        <div className={`sms-send-step ${step >= 3 ? 'active' : ''}`}>
          <span className="sms-send-step-num">3</span>
          <span>Compose &amp; send</span>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-5 sms-send-col-side">
          <div className="sms-send-panel h-100">
            <div className="sms-send-panel-head">
              <h6 className="mb-0">{groupLabel}</h6>
              <span className="badge text-bg-secondary">{selected.length} selected</span>
            </div>
            <input
              type="search"
              className="form-control form-control-sm mb-3"
              placeholder={searchPlaceholder}
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
            {filteredGroups.length > 0 && (
              <label className="sms-batch-group-head mb-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={allFilteredSelected}
                  onChange={(e) => toggleAllFiltered(e.target.checked)}
                />
                <span>Select all shown</span>
              </label>
            )}
            <div className="sms-batch-list">
              {filteredGroups.map((group) => (
                <label key={group.id} className="sms-batch-option">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selected.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                  />
                  <span className="sms-batch-option-label">{group.title} ({group.mobileCount ?? 0})</span>
                </label>
              ))}
              {filteredGroups.length === 0 && (
                <p className="text-muted small mb-0">No groups match your search.</p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary w-100 mt-3"
              onClick={loadRecipients}
              disabled={busy || selected.length === 0}
            >
              {busy ? 'Loading…' : 'Load recipients'}
            </button>
          </div>
        </div>

        <div className="col-md-7 sms-send-col-main">
          {!mobilesLoaded ? (
            <div className="sms-send-empty h-100 d-flex flex-column align-items-center justify-content-center text-center">
              <div className="sms-send-empty-icon mb-3">
                <i className="fa fa-address-book" aria-hidden="true" />
              </div>
              <h6 className="mb-2">No numbers loaded yet</h6>
              <p className="text-muted small mb-0">{emptyHint}</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-4">
              <div className="sms-send-panel">
                <div className="sms-send-panel-head">
                  <h6 className="mb-0">Mobile numbers</h6>
                  <span className="badge text-bg-primary">{recipients.length} total</span>
                </div>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <input
                    type="search"
                    className="form-control form-control-sm flex-grow-1"
                    style={{ minWidth: 180 }}
                    placeholder={showRecipientNames ? 'Search name or mobile…' : 'Search mobile…'}
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setShowRawMobiles((v) => !v)}
                  >
                    {showRawMobiles ? 'Hide raw list' : 'Edit comma list'}
                  </button>
                </div>
                {showRawMobiles ? (
                  <div className="mb-3">
                    <textarea
                      className="form-control font-monospace small"
                      rows={4}
                      value={rawMobiles}
                      onChange={(e) => setRawMobiles(e.target.value)}
                      placeholder="9999999999,9999999999"
                    />
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <small className="text-muted">Total: {countMobiles(rawMobiles)}</small>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={applyRawMobiles}>
                        Apply list
                      </button>
                    </div>
                  </div>
                ) : recipients.length === 0 ? (
                  <div className="alert alert-warning mb-0">
                    No valid 10-digit mobile numbers found in the selected group(s).
                    Some groups may store message text instead of numbers — update them under <strong>SMS → Edit Group</strong>.
                  </div>
                ) : (
                  <div className="sms-recipient-table-wrap">
                    <table className="table table-sm table-hover sms-recipient-table mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: 130 }}>Mobile</th>
                          {showRecipientNames && <th>Name</th>}
                          <th style={{ width: 48 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((row) => (
                          <tr key={row.mobile}>
                            <td className="font-monospace">{row.mobile}</td>
                            {showRecipientNames && <td>{row.name || '—'}</td>}
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-link btn-sm text-danger p-0"
                                title="Remove"
                                onClick={() => removeRecipient(row.mobile)}
                              >
                                <i className="fa fa-times" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredRecipients.length === 0 && (
                          <tr>
                            <td colSpan={showRecipientNames ? 3 : 2} className="text-muted text-center py-4">No numbers match your search.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="sms-send-panel">
                <div className="sms-send-panel-head">
                  <h6 className="mb-0">Message</h6>
                </div>
                {(data.templates || []).length > 0 && (
                  <div className="mb-3">
                    <label className="form-label small text-muted mb-2">Quick templates</label>
                    <div className="d-flex flex-wrap gap-2">
                      {data.templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => applyTemplate(tpl)}
                        >
                          {tpl.sample || tpl.templateId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-md-5">
                    <label className="form-label">Template ID</label>
                    <input
                      className="form-control"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-7">
                    <label className="form-label d-flex justify-content-between">
                      <span>SMS text</span>
                      <span className="text-muted small">{charCount} chars</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {confirmSend ? (
                  <div className="alert alert-warning d-flex flex-wrap align-items-center gap-3 mt-3 mb-0">
                    <span>Send SMS to <strong>{recipients.length}</strong> number{recipients.length === 1 ? '' : 's'}?</span>
                    <div className="d-flex gap-2">
                      <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Confirm send</button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmSend(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-danger mt-3"
                    disabled={busy || recipients.length === 0 || !message.trim() || !templateId.trim()}
                  >
                    Send SMS
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

function StudentSmsFlow({
  data,
  busy,
  onLoad,
  onSave,
  groupKey,
  groupLabel,
}) {
  const [selected, setSelected] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [message, setMessage] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [mobilesLoaded, setMobilesLoaded] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRawMobiles, setShowRawMobiles] = useState(false);
  const [rawMobiles, setRawMobiles] = useState('');

  useEffect(() => {
    if (!data) return;
    setSelected(data.selectedCourses || []);
    const rows = recipientsFromData(data.mobileDetails, data.mobiles);
    setRecipients(rows);
    setRawMobiles(data.mobiles || '');
    setMessage(data.message || '');
    setTemplateId(data.templateId || '');
    setMobilesLoaded(Boolean(data.mobiles));
  }, [data]);

  const courseGroups = data?.courseGroups || [];
  const filteredGroups = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    if (!q) return courseGroups;
    return courseGroups
      .map((group) => ({
        ...group,
        options: group.options.filter(
          (opt) => opt.label.toLowerCase().includes(q) || group.label.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [courseGroups, batchSearch]);

  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);

  const toggleBatch = (value) => {
    const key = String(value);
    setSelected((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
    setMobilesLoaded(false);
  };

  const toggleGroup = (options, checked) => {
    const values = options.map((o) => String(o.value));
    setSelected((prev) => {
      const next = new Set(prev.map(String));
      values.forEach((v) => (checked ? next.add(v) : next.delete(v)));
      return [...next];
    });
    setMobilesLoaded(false);
  };

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) => r.mobile.includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [recipients, recipientSearch]);

  const loadRecipients = async () => {
    const res = await onLoad({
      action: 'preview',
      [groupKey]: selected,
      message,
      templateId,
    });
    if (res?.mobiles != null) {
      const rows = recipientsFromData(res.mobileDetails, res.mobiles);
      setRecipients(rows);
      setRawMobiles(res.mobiles);
      setMobilesLoaded(true);
      setConfirmSend(false);
    }
  };

  const removeRecipient = (mobile) => {
    const next = recipients.filter((r) => r.mobile !== mobile);
    setRecipients(next);
    setRawMobiles(mobilesFromRecipients(next));
  };

  const applyRawMobiles = () => {
    const rows = recipientsFromData([], rawMobiles);
    setRecipients(rows);
  };

  const applyTemplate = (tpl) => {
    setMessage(tpl.content || '');
    setTemplateId(tpl.templateId || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mobiles = mobilesFromRecipients(recipients);
    if (!mobiles) return;
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    setConfirmSend(false);
    await onSave({
      [groupKey]: selected,
      mobiles,
      message,
      templateId,
    });
  };

  const step = !mobilesLoaded ? 1 : (!message.trim() ? 2 : 3);
  const charCount = message.length;

  if (!data) return null;

  return (
    <form className="sms-send-flow" onSubmit={handleSubmit}>
      <div className="sms-send-steps mb-4">
        <div className={`sms-send-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
          <span className="sms-send-step-num">1</span>
          <span>Select batches</span>
        </div>
        <div className={`sms-send-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
          <span className="sms-send-step-num">2</span>
          <span>Review recipients</span>
        </div>
        <div className={`sms-send-step ${step >= 3 ? 'active' : ''}`}>
          <span className="sms-send-step-num">3</span>
          <span>Compose &amp; send</span>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-5 sms-send-col-side">
          <div className="sms-send-panel h-100">
            <div className="sms-send-panel-head">
              <h6 className="mb-0">{groupLabel}</h6>
              <span className="badge text-bg-secondary">{selected.length} selected</span>
            </div>
            <input
              type="search"
              className="form-control form-control-sm mb-3"
              placeholder="Search class or batch…"
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
            />
            <div className="sms-batch-list">
              {filteredGroups.map((group) => {
                const groupValues = group.options.map((o) => String(o.value));
                const allSelected = groupValues.length > 0 && groupValues.every((v) => selectedSet.has(v));
                const someSelected = groupValues.some((v) => selectedSet.has(v));
                return (
                  <div key={group.label} className="sms-batch-group">
                    <label className="sms-batch-group-head">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={(e) => toggleGroup(group.options, e.target.checked)}
                      />
                      <span>{group.label}</span>
                    </label>
                    <div className="sms-batch-options">
                      {group.options.map((opt) => (
                        <label key={opt.value} className="sms-batch-option">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedSet.has(String(opt.value))}
                            onChange={() => toggleBatch(opt.value)}
                          />
                          <span className="sms-batch-option-label">{opt.label.replace(/\s*\(\d+\)\s*$/, '')}</span>
                          <span className="badge rounded-pill text-bg-light border">{opt.mobileCount ?? 0}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredGroups.length === 0 && (
                <p className="text-muted small mb-0">No batches match your search.</p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary w-100 mt-3"
              onClick={loadRecipients}
              disabled={busy || selected.length === 0}
            >
              {busy ? 'Loading…' : 'Load recipients'}
            </button>
          </div>
        </div>

        <div className="col-md-7 sms-send-col-main">
          {!mobilesLoaded ? (
            <div className="sms-send-empty h-100 d-flex flex-column align-items-center justify-content-center text-center">
              <div className="sms-send-empty-icon mb-3">
                <i className="fa fa-users" aria-hidden="true" />
              </div>
              <h6 className="mb-2">No recipients loaded yet</h6>
              <p className="text-muted small mb-0">
                Select one or more class/batch rows on the left, then click <strong>Load recipients</strong>.
              </p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-4">
              <div className="sms-send-panel">
                <div className="sms-send-panel-head">
                  <h6 className="mb-0">Recipients</h6>
                  <span className="badge text-bg-primary">{recipients.length} mobile{recipients.length === 1 ? '' : 's'}</span>
                </div>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <input
                    type="search"
                    className="form-control form-control-sm flex-grow-1"
                    style={{ minWidth: 180 }}
                    placeholder="Search name or mobile…"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setShowRawMobiles((v) => !v)}
                  >
                    {showRawMobiles ? 'Hide raw list' : 'Edit comma list'}
                  </button>
                </div>
                {showRawMobiles ? (
                  <div className="mb-3">
                    <textarea
                      className="form-control font-monospace small"
                      rows={4}
                      value={rawMobiles}
                      onChange={(e) => setRawMobiles(e.target.value)}
                      placeholder="9999999999,9999999999"
                    />
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <small className="text-muted">Max 100 numbers. Total: {countMobiles(rawMobiles)}</small>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={applyRawMobiles}>
                        Apply list
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sms-recipient-table-wrap">
                    <table className="table table-sm table-hover sms-recipient-table mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: 130 }}>Mobile</th>
                          <th>Student</th>
                          <th style={{ width: 48 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((row) => (
                          <tr key={row.mobile}>
                            <td className="font-monospace">{row.mobile}</td>
                            <td>{row.name || '—'}</td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-link btn-sm text-danger p-0"
                                title="Remove"
                                onClick={() => removeRecipient(row.mobile)}
                              >
                                <i className="fa fa-times" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredRecipients.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-muted text-center py-4">No recipients match your search.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="sms-send-panel">
                <div className="sms-send-panel-head">
                  <h6 className="mb-0">Message</h6>
                </div>
                {(data.templates || []).length > 0 && (
                  <div className="mb-3">
                    <label className="form-label small text-muted mb-2">Quick templates</label>
                    <div className="d-flex flex-wrap gap-2">
                      {data.templates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => applyTemplate(tpl)}
                        >
                          {tpl.sample || tpl.templateId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-md-5">
                    <label className="form-label">Template ID</label>
                    <input
                      className="form-control"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-7">
                    <label className="form-label d-flex justify-content-between">
                      <span>SMS text</span>
                      <span className="text-muted small">{charCount} chars</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {confirmSend ? (
                  <div className="alert alert-warning d-flex flex-wrap align-items-center gap-3 mt-3 mb-0">
                    <span>Send SMS to <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? '' : 's'}?</span>
                    <div className="d-flex gap-2">
                      <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Confirm send</button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmSend(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-danger mt-3"
                    disabled={busy || recipients.length === 0 || !message.trim() || !templateId.trim()}
                  >
                    Send SMS
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

export default function SmsSendScreen({
  data,
  busy,
  onLoad,
  onSave,
  groupKey = 'selectedCourses',
  groupLabel = 'Recipients',
  studentMode = false,
  groupMode = false,
  emptyHint,
  showRecipientNames = false,
  stepSelectLabel,
  searchPlaceholder,
}) {
  if (studentMode) {
    return (
      <StudentSmsFlow
        data={data}
        busy={busy}
        onLoad={onLoad}
        onSave={onSave}
        groupKey={groupKey}
        groupLabel={groupLabel}
      />
    );
  }

  if (groupMode) {
    return (
      <GroupSmsFlow
        data={data}
        busy={busy}
        onLoad={onLoad}
        onSave={onSave}
        groupKey={groupKey}
        groupLabel={groupLabel}
        emptyHint={emptyHint}
        showRecipientNames={showRecipientNames}
        stepSelectLabel={stepSelectLabel}
        searchPlaceholder={searchPlaceholder}
      />
    );
  }

  if (!data) return null;

  return (
    <GroupSmsFlow
      data={data}
      busy={busy}
      onLoad={onLoad}
      onSave={onSave}
      groupKey={groupKey}
      groupLabel={groupLabel}
    />
  );
}
