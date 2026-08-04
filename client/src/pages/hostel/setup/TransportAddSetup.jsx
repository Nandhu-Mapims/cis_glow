import { useEffect, useState } from 'react';

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ field: 'photo', name: file.name, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TransportAddSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({
    vehicleId: '', regNumber: '', vehicleType: 'Bus', capacity: '',
    route: '', contact: '', tripCount: '1', stopIds: [],
  });
  const [photo, setPhoto] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleStop = (id) => {
    const sid = String(id);
    setForm((prev) => ({
      ...prev,
      stopIds: prev.stopIds.includes(sid)
        ? prev.stopIds.filter((s) => s !== sid)
        : [...prev.stopIds, sid],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const files = photo ? [await fileToPayload(photo)] : [];
    await onSave(form, files);
    setPhoto(null);
  };

  return (
    <form onSubmit={handleSubmit} className="row g-3">
      <div className="col-md-4">
        <label className="form-label">Vehicle Id *</label>
        <input className="form-control" value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} required />
      </div>
      <div className="col-md-4">
        <label className="form-label">Vehicle No *</label>
        <input className="form-control" value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} required />
      </div>
      <div className="col-md-4">
        <label className="form-label">Vehicle Type</label>
        <div className="d-flex gap-3 pt-2">
          {['Bus', 'Van', 'Auto'].map((type) => (
            <label key={type}>
              <input className="me-2" type="radio" name="vehicleType" checked={form.vehicleType === type} onChange={() => set('vehicleType', type)} /> {type}
            </label>
          ))}
        </div>
      </div>
      <div className="col-md-4">
        <label className="form-label">Capacity *</label>
        <input type="number" className="form-control" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required />
      </div>
      <div className="col-md-4">
        <label className="form-label">Photo</label>
        <input type="file" className="form-control" accept="image/png,image/jpeg,image/gif" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Trip *</label>
        <select className="form-select" value={form.tripCount} onChange={(e) => set('tripCount', e.target.value)}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}</option>)}
        </select>
      </div>
      <div className="col-md-6">
        <label className="form-label">Route</label>
        <input className="form-control" value={form.route} onChange={(e) => set('route', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Contact</label>
        <input className="form-control" value={form.contact} onChange={(e) => set('contact', e.target.value)} />
      </div>
      <div className="col-12">
        <label className="form-label">Stops *</label>
        <div className="row g-2">
          {data?.stops?.map((stop) => (
            <div key={stop.id} className="col-md-4">
              <label>
                <input
                  type="checkbox"
                  checked={form.stopIds.includes(String(stop.id))}
                  onChange={() => toggleStop(stop.id)}
                />{' '}
                {stop.name}
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="col-12">
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </div>
    </form>
  );
}

export { fileToPayload };
