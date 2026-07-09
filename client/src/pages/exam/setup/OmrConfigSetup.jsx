import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useExamSetupApi } from './useExamSetupApi';

const emptyForm = {
  marginFirstPage: '',
  marginSecondPage: '',
  qrTop: '',
  qrLeft: '',
  regTop: '',
  regLeft: '',
  rightWidth: '',
  shadedPercent: '',
};

export default function OmrConfigSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('omr-config');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.marginFirstPage !== undefined) {
      setForm({
        marginFirstPage: data.marginFirstPage || '',
        marginSecondPage: data.marginSecondPage || '',
        qrTop: data.qrTop || '',
        qrLeft: data.qrLeft || '',
        regTop: data.regTop || '',
        regLeft: data.regLeft || '',
        rightWidth: data.rightWidth || '',
        shadedPercent: data.shadedPercent || '',
      });
    }
  }, [data]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await save(form);
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-12"><h5>Design</h5></div>
        <div className="col-md-4">
          <label className="form-label">Page 1 Top (px)</label>
          <input className="form-control" required maxLength={4} value={form.marginFirstPage} onChange={(e) => setField('marginFirstPage', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Page 2 Top (px)</label>
          <input className="form-control" required maxLength={4} value={form.marginSecondPage} onChange={(e) => setField('marginSecondPage', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">QR Top (px)</label>
          <input className="form-control" required maxLength={4} value={form.qrTop} onChange={(e) => setField('qrTop', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">QR Left (px)</label>
          <input className="form-control" required maxLength={4} value={form.qrLeft} onChange={(e) => setField('qrLeft', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Register No. Top (px)</label>
          <input className="form-control" required maxLength={4} value={form.regTop} onChange={(e) => setField('regTop', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Register No. Left (px)</label>
          <input className="form-control" required maxLength={4} value={form.regLeft} onChange={(e) => setField('regLeft', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Right Width (px)</label>
          <input className="form-control" required maxLength={4} value={form.rightWidth} onChange={(e) => setField('rightWidth', e.target.value)} />
        </div>

        <div className="col-12"><h5>Reader</h5></div>
        <div className="col-md-4">
          <label className="form-label">Shaded Percentage (%)</label>
          <input className="form-control" required maxLength={4} value={form.shadedPercent} onChange={(e) => setField('shadedPercent', e.target.value)} />
        </div>

        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
    </>
  );
}
