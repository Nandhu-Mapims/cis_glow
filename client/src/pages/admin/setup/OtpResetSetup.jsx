import { useState } from 'react';

export default function OtpResetSetup({ data, busy, onSave }) {
  const [selected, setSelected] = useState(new Set());

  if (!data?.accounts) return null;

  const allIds = data.accounts.map((a) => String(a.id));
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));

  return (
    <div className="admin-native-form">
      <p className="text-muted small mb-3">
        Red labels indicate the password has not yet been changed after reset.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({
            a_auth: [...selected],
            Submit: 'Reset',
          });
          setSelected(new Set());
        }}
      >
        <div className="mb-3">
          <label className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              checked={allChecked}
              disabled={busy}
              onChange={(e) => {
                setSelected(e.target.checked ? new Set(allIds) : new Set());
              }}
            />
            <span className="form-check-label">Check all</span>
          </label>
        </div>

        <div className="row g-2 mb-4">
          {data.accounts.map((account) => (
            <div key={account.id} className="col-md-3">
              <label className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={selected.has(String(account.id))}
                  disabled={busy}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(String(account.id));
                      else next.delete(String(account.id));
                      return next;
                    });
                  }}
                />
                <span className={`form-check-label${account.pendingReset ? ' text-danger' : ''}`}>
                  {account.memberName}
                  {' '}
                  (
                  {account.memberId}
                  )
                </span>
              </label>
            </div>
          ))}
        </div>

        <button type="submit" className="btn btn-danger" disabled={busy || selected.size === 0}>
          Reset Password
        </button>
      </form>
    </div>
  );
}
