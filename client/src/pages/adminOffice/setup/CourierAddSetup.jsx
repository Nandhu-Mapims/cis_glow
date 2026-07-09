import { useEffect, useState } from 'react';
import CourierFields from './CourierFields';

export default function CourierAddSetup({ data, busy, onSave }) {
  const [form, setForm] = useState(data?.form || {});
  useEffect(() => { if (data?.form) setForm(data.form); }, [data?.form]);
  if (!data) return null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <CourierFields form={form} setForm={setForm} departmentOptions={data.departmentOptions} busy={busy} />
      <div className="mt-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>Submit</button>
      </div>
    </form>
  );
}
