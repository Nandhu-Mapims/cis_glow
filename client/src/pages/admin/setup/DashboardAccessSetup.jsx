import { useEffect, useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';

export default function DashboardAccessSetup({ data, busy, onLoad, onSave }) {
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    if (data?.widgets) setWidgets(data.widgets);
  }, [data]);

  if (!data) return null;

  const selectedUser = data.selectedUser || '';

  return (
    <div className="admin-native-form">
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="dash_user">Select User</label>
          <SearchableSelect
            id="dash_user"
            options={data.users || []}
            value={selectedUser}
            disabled={busy}
            searchPlaceholder="Search by username or name..."
            onChange={(val) => onLoad({ a_id: val })}
          />
        </div>

        {selectedUser && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="dash_copy_source">
              Copy widgets from (optional)
            </label>
            <SearchableSelect
              id="dash_copy_source"
              options={data.users?.filter((u) => u.value !== selectedUser) || []}
              value={data.copiedFromUser || ''}
              disabled={busy}
              placeholder="--This user's own widgets--"
              searchPlaceholder="Search by username or name..."
              onChange={(val) => onLoad({ a_id: selectedUser, copy_from_user: val })}
            />
          </div>
        )}
      </div>

      {selectedUser && data.copiedFromUser && (
        <div className="alert alert-info">
          Showing widgets copied from{' '}
          <strong>{data.users?.find((u) => u.value === data.copiedFromUser)?.label || `user ${data.copiedFromUser}`}</strong>.
          Nothing is saved yet — review below, adjust as needed, then Save to apply to the selected user.
        </div>
      )}

      {selectedUser && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const payload = {
              a_id: selectedUser,
              Submit: 'Update',
              form_reset: String(Date.now()),
              dashboard_list: {},
              box_order: {},
              enable_disable: {},
              row_id: {},
            };
            widgets.forEach((widget, idx) => {
              payload.dashboard_list[idx] = widget.widgetName;
              payload.box_order[idx] = widget.order === '' ? '' : String(widget.order);
              if (widget.enabled) payload.enable_disable[idx] = '1';
              if (widget.rowId) payload.row_id[idx] = String(widget.rowId);
            });
            await onSave(payload);
          }}
        >
          <div className="d-flex gap-3 mb-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setWidgets((rows) => rows.map((w) => ({ ...w, enabled: true })))}
            >
              Check all
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setWidgets((rows) => rows.map((w, i) => ({ ...w, order: i + 1 })))}
            >
              Fill default order
            </button>
          </div>

          <div className="row g-2">
            {widgets.map((widget, idx) => (
              <div key={widget.widgetName} className="col-md-6">
                <div className="border rounded p-2 d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    checked={widget.enabled}
                    onChange={(e) => setWidgets((rows) => {
                      const next = [...rows];
                      next[idx] = { ...next[idx], enabled: e.target.checked };
                      return next;
                    })}
                  />
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: 70 }}
                    value={widget.order}
                    onChange={(e) => setWidgets((rows) => {
                      const next = [...rows];
                      next[idx] = { ...next[idx], order: e.target.value };
                      return next;
                    })}
                  />
                  <span className="small">{widget.label}</span>
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-danger mt-4" disabled={busy}>Save</button>
        </form>
      )}
    </div>
  );
}
