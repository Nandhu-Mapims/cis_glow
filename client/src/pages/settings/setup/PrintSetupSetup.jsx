import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';

const EMPTY_FORM = {
  title: '',
  subTitle: '',
  bodyTitle: '',
  category: '',
  order: 1,
  pageNote: '',
  pageNo: 'none',
  rowCount: '',
  homeHeader: false,
  innerHeader: false,
  homeHeight: 0,
  innerHeight: 0,
  footer: false,
  rightText: false,
  signature: false,
  generatedBy: false,
  approved: { id: null, name: '', designation: '' },
  checked: { id: null, name: '', designation: '' },
  verified: { id: null, name: '', designation: '' },
};

export default function PrintSetupSetup({ data, busy, onLoad, onSave }) {
  const [pageRef, setPageRef] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    setPageRef(data.pageRef || '');
    if (data.selected) {
      setForm({ ...EMPTY_FORM, ...data.selected });
    }
  }, [data]);

  const onPageChange = async (value) => {
    setPageRef(value);
    await onLoad({ pageRef: value });
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setRole = (role, patch) => setForm((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({ pageRef, form });
  };

  const groupedOptions = (data?.pageOptions || []).reduce((acc, opt) => {
    const cat = opt.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {});

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Header Title</label>
          <select className="form-select" value={pageRef} onChange={(e) => onPageChange(e.target.value)}>
            <option value="">--Select One--</option>
            <option value="add_new">Add New</option>
            {Object.entries(groupedOptions).map(([cat, opts]) => (
              <optgroup key={cat} label={cat}>
                {opts.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {data?.selected ? (
          <div className="col-md-6">
            <label className="form-label">Title</label>
            <input className="form-control" value={form.title} onChange={(e) => setField('title', e.target.value)} />
          </div>
        ) : null}
      </div>

      {data?.selected ? (
        <form onSubmit={handleSave} className="row g-3">
          <div className="col-md-6"><label className="form-label">Sub Title</label><input className="form-control" value={form.subTitle} onChange={(e) => setField('subTitle', e.target.value)} /></div>
          <div className="col-md-6"><label className="form-label">Content Title</label><input className="form-control" value={form.bodyTitle} onChange={(e) => setField('bodyTitle', e.target.value)} /></div>
          <div className="col-md-4"><label className="form-label">Category</label><input className="form-control" value={form.category} onChange={(e) => setField('category', e.target.value)} /></div>
          <div className="col-md-2"><label className="form-label">Order</label><input className="form-control" value={form.order} onChange={(e) => setField('order', e.target.value)} /></div>
          <div className="col-12"><label className="form-label">Note</label><textarea className="form-control" rows={3} value={form.pageNote} onChange={(e) => setField('pageNote', e.target.value)} /></div>
          <div className="col-md-4">
            <label className="form-label">Page No</label>
            <div>
              {['none', 'css', 'php'].map((v) => (
                <label key={v} className="me-3">
                  <input className="me-2" type="radio" name="pageNo" checked={form.pageNo === v} onChange={() => setField('pageNo', v)} />
                  {' '}{v === 'none' ? 'None' : v === 'css' ? 'Page: x' : 'Page: x of y'}
                </label>
              ))}
            </div>
          </div>
          <div className="col-md-2"><label className="form-label">Rows/page</label><input className="form-control" value={form.rowCount} onChange={(e) => setField('rowCount', e.target.value)} /></div>
          <div className="col-md-2"><label className="form-label">Home height</label><input className="form-control" value={form.homeHeight} onChange={(e) => setField('homeHeight', e.target.value)} /></div>
          <div className="col-md-2"><label className="form-label">Inner height</label><input className="form-control" value={form.innerHeight} onChange={(e) => setField('innerHeight', e.target.value)} /></div>
          {[
            ['homeHeader', 'Header first page'],
            ['innerHeader', 'Header inner page'],
            ['footer', 'Footer'],
            ['rightText', 'Right text'],
            ['signature', 'Signature block'],
            ['generatedBy', 'Generated by'],
          ].map(([key, label]) => (
            <div key={key} className="col-md-3">
              <label><input type="checkbox" checked={form[key]} onChange={(e) => setField(key, e.target.checked)} /> {label}</label>
            </div>
          ))}
          {['approved', 'checked', 'verified'].map((role) => (
            <div key={role} className="col-12">
              <h6 className="text-capitalize">{role}</h6>
              <div className="row g-2">
                <div className="col-md-4"><input className="form-control" placeholder="Name" value={form[role].name} onChange={(e) => setRole(role, { name: e.target.value })} /></div>
                <div className="col-md-4"><input className="form-control" placeholder="Designation" value={form[role].designation} onChange={(e) => setRole(role, { designation: e.target.value })} /></div>
              </div>
            </div>
          ))}
          <div className="col-12 text-end">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}
    </>
  );
}
