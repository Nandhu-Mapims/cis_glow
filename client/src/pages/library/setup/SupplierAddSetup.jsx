import { useEffect, useState } from 'react';

export default function SupplierAddSetup({ busy, onSave }) {
  const [form, setForm] = useState({ supplierName: '', contactName: '', contactNo: '', address: '' });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="row g-3">
      {[
        ['supplierName', 'Supplier Name *', true],
        ['contactName', 'Contact Person', false],
        ['contactNo', 'Contact No', false],
        ['address', 'Address', false],
      ].map(([key, label, required]) => (
        <div key={key} className="col-md-6">
          <label className="form-label">{label}</label>
          <input className="form-control" value={form[key]} onChange={(e) => set(key, e.target.value)} required={required} />
        </div>
      ))}
      <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button></div>
    </form>
  );
}
