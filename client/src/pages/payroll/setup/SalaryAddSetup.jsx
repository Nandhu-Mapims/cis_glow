import { useEffect, useMemo, useState } from 'react';

function monthRefToInputValue(mmYyyy) {
  if (!mmYyyy || !/^\d{2}-\d{4}$/.test(mmYyyy)) return '';
  const [mm, yyyy] = mmYyyy.split('-');
  return `${yyyy}-${mm}`;
}

function inputValueToMonthRef(yyyyMm) {
  if (!yyyyMm) return '';
  const [yyyy, mm] = yyyyMm.split('-');
  return `${mm}-${yyyy}`;
}

function sumRowAmounts(row, policy) {
  const parts = [
    policy.basicPay ? row.basicPay : 0,
    policy.basicMargin ? row.basicMargin : 0,
    policy.dAllowance ? row.dAllowance : 0,
    policy.hraAllowance ? row.hraAllowance : 0,
    policy.mAllowance ? row.mAllowance : 0,
    policy.cAllowance ? row.cAllowance : 0,
  ];
  return parts.reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function SalaryRow({
  row,
  index,
  policy,
  onAmountChange,
  onDelete,
  canDelete,
  onRemoveExtra,
}) {
  const rowKey = row.id || `new-${index}`;
  const amounts = {
    basicPay: row.basicPay ?? '',
    basicMargin: row.basicMargin ?? '',
    dAllowance: row.dAllowance ?? '',
    hraAllowance: row.hraAllowance ?? '',
    mAllowance: row.mAllowance ?? '',
    cAllowance: row.cAllowance ?? '',
  };
  const total = row.totalAmount ?? sumRowAmounts(amounts, policy);

  const amountInput = (name, policyKey, value) => {
    if (!policy[policyKey]) return <input type="hidden" name={name} value={value || '0'} />;
    return (
      <input
        name={name}
        className="form-control form-control-sm"
        style={{ width: `${name == 'basic_pay' ? '100px' : '80px'}` }}
        defaultValue={value}
        onChange={(e) => onAmountChange(rowKey)}
      />
    );
  };

  return (
    <tr>
      <td className="text-center">{index + 1}</td>
      <td>
        <input type="hidden" name="g_id" value={row.id || ''} />
        <input
          name="from_date"
          type="month"
          className="form-control form-control-sm"
          defaultValue={monthRefToInputValue(row.fromDate)}
          onChange={(e) => {
            e.target.dataset.monthRef = inputValueToMonthRef(e.target.value);
          }}
        />
      </td>
      <td>
        <input
          name="to_date"
          type="month"
          className="form-control form-control-sm"
          defaultValue={monthRefToInputValue(row.toDate)}
        />
      </td>
      <td className="text-center">
        {policy.pfCalculation ? (
          <input
            type="checkbox"
            name={`pf_calculation_${index}`}
            defaultChecked={Number(row.pfCalculation) === 1}
            value="1"
          />
        ) : (
          <input type="hidden" name={`pf_calculation_${index}`} value="0" />
        )}
      </td>
      <td className="text-center">
        {policy.esiCalculation ? (
          <input
            type="checkbox"
            name={`esi_calculation_${index}`}
            defaultChecked={Number(row.esiCalculation) === 1}
            value="1"
          />
        ) : (
          <input type="hidden" name={`esi_calculation_${index}`} value="0" />
        )}
      </td>
      <td>{amountInput('basic_pay', 'basicPay', amounts.basicPay)}</td>
      <td>{amountInput('basic_margin', 'basicMargin', amounts.basicMargin)}</td>
      <td>{amountInput('d_allowance', 'dAllowance', amounts.dAllowance)}</td>
      <td>{amountInput('hra_allowance', 'hraAllowance', amounts.hraAllowance)}</td>
      <td>{amountInput('m_allowance', 'mAllowance', amounts.mAllowance)}</td>
      <td>{amountInput('c_allowance', 'cAllowance', amounts.cAllowance)}</td>
      <td>
        <input
          name="total_amount"
          className="form-control form-control-sm"
          readOnly
          defaultValue={total}
          data-total-for={rowKey}
        />
      </td>
      <td className="text-center">
        {canDelete && row.id ? (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(row.id)} title="Delete row">
            <i className="fa fa-trash" />
          </button>
        ) : null}
        {canDelete && !row.id && onRemoveExtra ? (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRemoveExtra} title="Remove this blank row">
            <i className="fa fa-trash" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

export default function SalaryAddSetup({ data, load, save, busy }) {
  const [searchBy, setSearchBy] = useState('name');
  const [searchInput, setSearchInput] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [extraRows, setExtraRows] = useState(0);
  const [deleteRowId, setDeleteRowId] = useState(null);

  const profile = data?.profile;
  const policy = data?.policyFlags || data?.policy || {};
  const staffList = data?.staffList || data?.searchResults || [];
  const salaryRows = data?.salaryRows || [];

  useEffect(() => {
    setSearchBy(data?.searchBy || 'name');
    setSearchInput(data?.searchInput ?? data?.searchQuery ?? '');
    setSearchCategory(data?.searchCategory || '');
    setExtraRows(0);
  }, [data?.searchBy, data?.searchInput, data?.searchCategory, data?.searchQuery, profile?.id]);

  const displayRows = useMemo(() => {
    const base = salaryRows.length
      ? salaryRows
      : [{ id: '', fromDate: '', toDate: '', basicPay: '', basicMargin: '', dAllowance: '', hraAllowance: '', mAllowance: '', cAllowance: '', totalAmount: '', pfCalculation: 0, esiCalculation: 0 }];
    const extras = Array.from({ length: extraRows }, (_, i) => ({
      id: '',
      key: `extra-${i}`,
      fromDate: '',
      toDate: '',
      basicPay: '',
      basicMargin: '',
      dAllowance: '',
      hraAllowance: '',
      mAllowance: '',
      cAllowance: '',
      totalAmount: '',
      pfCalculation: 0,
      esiCalculation: 0,
    }));
    return [...base, ...extras];
  }, [salaryRows, extraRows]);

  const filterFields = () => ({
    search_by: searchBy,
    search_input: searchInput,
    search_category: searchCategory,
  });

  const onGo = async (e) => {
    e?.preventDefault();
    await load(filterFields());
  };

  const onSelectStaff = (id) => load({ staff_id: id, ...filterFields() });

  const onAmountChange = (rowKey) => {
    const totalInput = document.querySelector(`input[data-total-for="${rowKey}"]`);
    if (!totalInput) return;
    const tr = totalInput.closest('tr');
    if (!tr) return;
    const sumFields = ['basic_pay', 'basic_margin', 'd_allowance', 'hra_allowance', 'm_allowance', 'c_allowance'];
    let sum = 0;
    sumFields.forEach((name) => {
      const input = tr.querySelector(`input[name="${name}"]`);
      if (input && input.type !== 'hidden') sum += Number(input.value) || 0;
    });
    totalInput.value = sum;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const fields = {
      Submit: 'Update',
      staff_id: profile?.id,
      st_id: profile?.id,
      b_ac_no: form.get('b_ac_no'),
      b_ac_name: form.get('b_ac_name'),
      b_name: form.get('b_name'),
      b_branch: form.get('b_branch'),
      b_ifsc: form.get('b_ifsc'),
      pan_no: form.get('pan_no'),
      pfa_no: form.get('pfa_no'),
      pf_uan: form.get('pf_uan'),
      esi_no: form.get('esi_no'),
      g_id: form.getAll('g_id'),
      from_date: [],
      to_date: [],
      basic_pay: form.getAll('basic_pay'),
      basic_margin: form.getAll('basic_margin'),
      d_allowance: form.getAll('d_allowance'),
      hra_allowance: form.getAll('hra_allowance'),
      m_allowance: form.getAll('m_allowance'),
      c_allowance: form.getAll('c_allowance'),
      total_amount: form.getAll('total_amount'),
      pf_calculation: [],
      esi_calculation: [],
    };

    const fromInputs = e.target.querySelectorAll('input[name="from_date"]');
    const toInputs = e.target.querySelectorAll('input[name="to_date"]');
    fromInputs.forEach((input) => {
      fields.from_date.push(inputValueToMonthRef(input.value));
    });
    toInputs.forEach((input) => {
      fields.to_date.push(inputValueToMonthRef(input.value));
    });

    displayRows.forEach((_, index) => {
      const pf = form.get(`pf_calculation_${index}`);
      const esi = form.get(`esi_calculation_${index}`);
      fields.pf_calculation.push(pf ? '1' : '0');
      fields.esi_calculation.push(esi ? '1' : '0');
    });

    await save(fields);
  };

  const onConfirmDelete = async () => {
    if (!deleteRowId || !profile?.id) return;
    await save({
      delete: 'Confirm',
      confirm: deleteRowId,
      staff_id: profile.id,
      st_id: profile.id,
    });
    setDeleteRowId(null);
  };

  const staffButtonClass = (staff) => {
    if (staff.selected) return 'btn btn-sm btn-outline-success w-100 text-start mb-1';
    if (!staff.hasCurrentSalary) return 'btn btn-sm btn-outline-danger w-100 text-start mb-1';
    return 'btn btn-sm btn-outline-secondary w-100 text-start mb-1';
  };

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <div className="card h-100">
          <div className="card-header py-2"><strong>Filter</strong></div>
          <div className="card-body">
            <div className="mb-2">
              <div className="form-label">Search by</div>
              <div className="d-flex flex-column gap-1">
                <label className="form-check-label"><input type="radio" className="form-check-input me-1" name="search_by_ui" checked={searchBy === 'name'} onChange={() => setSearchBy('name')} /> Name</label>
                <label className="form-check-label"><input type="radio" className="form-check-input me-1" name="search_by_ui" checked={searchBy === 'staff_id'} onChange={() => setSearchBy('staff_id')} /> Staff ID</label>
                <label className="form-check-label"><input type="radio" className="form-check-input me-1" name="search_by_ui" checked={searchBy === 'category'} onChange={() => setSearchBy('category')} /> Category</label>
              </div>
            </div>
            {searchBy === 'category' ? (
              <select className="form-select mb-2" value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}>
                <option value="">--Select--</option>
                {(data?.categoryOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input className="form-control mb-2" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={searchBy === 'staff_id' ? 'Staff ID' : 'Name'} />
            )}
            <button type="button" className="btn btn-info btn-sm w-100 mb-3" onClick={onGo} disabled={busy}>Go</button>
            <div className="staff-result-pane" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {staffList.map((staff) => (
                <button key={staff.id} type="button" className={staffButtonClass(staff)} onClick={() => onSelectStaff(staff.id)}>
                  {staff.staffId} — {staff.name}
                </button>
              ))}
              {data?.searched && staffList.length === 0 && (
                <p className="text-danger small mb-0">No details found...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        {!profile ? (
          <p className="text-muted mb-0">Select a staff member from the list to edit salary and bank details.</p>
        ) : (
          <form key={profile.id} onSubmit={onSubmit}>
            <div className="card mb-3">
              <div className="card-header py-2"><strong>Staff</strong></div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-8">
                    <div className="mb-2"><strong>{profile.name}</strong> | {profile.staffId}</div>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label">PAN No.</label>
                        <input name="pan_no" className="form-control" defaultValue={profile.bank?.panNo ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Bank A/c No.</label>
                        <input name="b_ac_no" className="form-control" defaultValue={profile.bank?.acNo ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">A/c Name</label>
                        <input name="b_ac_name" className="form-control" defaultValue={profile.bank?.acName ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Branch</label>
                        <input name="b_branch" className="form-control" defaultValue={profile.bank?.branch ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Bank Name</label>
                        <select name="b_name" className="form-select" defaultValue={profile.bank?.bankName ?? ''}>
                          <option value="">--Select--</option>
                          {(data?.bankOptions || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">IFSC Code</label>
                        <input name="b_ifsc" className="form-control" defaultValue={profile.bank?.ifsc ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">PF Acc.No.</label>
                        <input name="pfa_no" className="form-control" defaultValue={profile.bank?.pfAcNo ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">PF UAN</label>
                        <input name="pf_uan" className="form-control" defaultValue={profile.bank?.pfUan ?? ''} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">ESI Number</label>
                        <input name="esi_no" className="form-control" defaultValue={profile.bank?.esiNo ?? ''} />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4 text-center">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={profile.name} style={{ maxWidth: '120px', maxHeight: '150px' }} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header py-2"><strong>Salary</strong></div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle mb-2">
                    <thead className="table-light">
                      <tr>
                        <th>S.No.</th>
                        <th>From</th>
                        <th>To</th>
                        <th>PF</th>
                        <th>ESI</th>
                        <th className="w-25">Basic</th>
                        <th>Margin</th>
                        <th>D.A</th>
                        <th>HRA</th>
                        <th>Medical</th>
                        <th>Conveyance</th>
                        <th>Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, index) => (
                        <SalaryRow
                          key={row.id || row.key || `row-${index}`}
                          row={row}
                          index={index}
                          policy={policy}
                          onAmountChange={onAmountChange}
                          onDelete={setDeleteRowId}
                          onRemoveExtra={!row.id ? () => setExtraRows((n) => Math.max(0, n - 1)) : undefined}
                          canDelete
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-end">
                  <button type="button" className="btn btn-sm btn-info" onClick={() => setExtraRows((n) => n + 1)} title="Add row">+</button>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>

            {deleteRowId ? (
              <div className="modal show d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.35)' }}>
                <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Confirm</h5>
                      <button type="button" className="btn-close" onClick={() => setDeleteRowId(null)} />
                    </div>
                    <div className="modal-body">Are you sure to delete this salary row?</div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDeleteRowId(null)}>Close</button>
                      <button type="button" className="btn btn-warning" onClick={onConfirmDelete} disabled={busy}>Confirm</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
