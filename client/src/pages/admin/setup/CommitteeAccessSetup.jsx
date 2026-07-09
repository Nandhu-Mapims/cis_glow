import { useEffect, useState } from 'react';

function MultiSelect({ options = [], value = [], onChange }) {
  return (
    <select
      className="form-select"
      multiple
      size={Math.min(10, Math.max(4, options.length || 4))}
      value={value}
      onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function selectedValues(options) {
  return options?.filter((o) => o.selected).map((o) => o.value) || [];
}

export default function CommitteeAccessSetup({ data, busy, onLoad, onSave }) {
  const [committees, setCommittees] = useState([]);

  useEffect(() => {
    setCommittees(selectedValues(data?.committeeOptions));
  }, [data?.committeeOptions]);

  if (!data) return null;

  return (
    <div className="admin-native-form">
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="committee_user">User</label>
          <select
            id="committee_user"
            className="form-select"
            value={data.selectedUser || ''}
            disabled={busy}
            onChange={(e) => onLoad({ user_name_ref: e.target.value })}
          >
            <option value="">--Select user--</option>
            {data.users?.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>

      {data.selectedUser && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              user_name_ref: data.selectedUser,
              r_id: data.recordId ? String(data.recordId) : '',
              event_committee: committees,
              form_reset: String(Date.now()),
              Submit: 'Save',
            });
          }}
        >
          <div className="mb-3">
            <label className="form-label">Committee</label>
            <MultiSelect
              options={data.committeeOptions || []}
              value={committees}
              onChange={setCommittees}
            />
          </div>
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      )}
    </div>
  );
}
