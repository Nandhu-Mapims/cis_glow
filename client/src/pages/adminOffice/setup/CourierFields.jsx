export default function CourierFields({ form, setForm, departmentOptions, busy }) {
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const cType = form.cType || 'Postal';

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <label className="form-label">Date &amp; Time</label>
        <input type="datetime-local" className="form-control" value={form.courierDate || ''} disabled={busy} onChange={(e) => update('courierDate', e.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">In / Out</label>
        <select className="form-select" value={form.courierInout || 'In'} disabled={busy} onChange={(e) => update('courierInout', e.target.value)}>
          <option value="In">In</option>
          <option value="Out">Out</option>
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">Department</label>
        <select className="form-select" value={form.category || ''} disabled={busy} onChange={(e) => update('category', e.target.value)}>
          <option value="">--Select--</option>
          {departmentOptions?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="col-md-6">
        <label className="form-label">From</label>
        <input className="form-control" value={form.fromName || ''} disabled={busy} onChange={(e) => update('fromName', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">To</label>
        <input className="form-control" value={form.toName || ''} disabled={busy} onChange={(e) => update('toName', e.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Type</label>
        <select className="form-select" value={cType} disabled={busy} onChange={(e) => update('cType', e.target.value)}>
          <option value="Postal">Postal</option>
          <option value="Courier">Courier</option>
          <option value="Hand">Hand</option>
        </select>
      </div>
      {cType !== 'Hand' && (
        <>
          <div className="col-md-4">
            <label className="form-label">Courier No</label>
            <input className="form-control" value={form.courierNo || ''} disabled={busy} onChange={(e) => update('courierNo', e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Courier Company</label>
            <input className="form-control" value={form.courierCompany || ''} disabled={busy} onChange={(e) => update('courierCompany', e.target.value)} />
          </div>
        </>
      )}
      {cType === 'Hand' && (
        <>
          <div className="col-md-4">
            <label className="form-label">Hand Name</label>
            <input className="form-control" value={form.hName || ''} disabled={busy} onChange={(e) => update('hName', e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Designation</label>
            <input className="form-control" value={form.hDesignation || ''} disabled={busy} onChange={(e) => update('hDesignation', e.target.value)} />
          </div>
        </>
      )}
      <div className="col-md-6">
        <label className="form-label">Item</label>
        <input className="form-control" value={form.itemName || ''} disabled={busy} onChange={(e) => update('itemName', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Quantity</label>
        <input className="form-control" value={form.quantity || ''} disabled={busy} onChange={(e) => update('quantity', e.target.value)} />
      </div>
      <div className="col-12">
        <label className="form-label">Receiver / Sender</label>
        <input className="form-control" value={form.courierReceiver || ''} disabled={busy} onChange={(e) => update('courierReceiver', e.target.value)} />
      </div>
    </div>
  );
}
