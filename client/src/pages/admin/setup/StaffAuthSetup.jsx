import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';

const MODE_COPY = {
  hod: {
    userLabel: 'Select HOD',
    hint: 'Staff with attendance authentication enabled.',
    empty: 'Choose an HOD to configure portal menu access.',
  },
  page: {
    userLabel: 'Select Staff',
    hint: 'Regular staff without HOD attendance authentication.',
    empty: 'Choose a staff member to configure portal menu access.',
  },
};

export default function StaffAuthSetup({ data, busy, onLoad, onSave }) {
  const [checked, setChecked] = useState({});

  useEffect(() => {
    const next = {};
    data?.menuGroups?.forEach((group) => {
      group.items.forEach((item) => {
        next[item.menuId] = item.checked;
      });
    });
    setChecked(next);
  }, [data?.menuGroups]);

  const copy = MODE_COPY[data?.mode] || MODE_COPY.page;
  const menuItems = useMemo(
    () => data?.menuGroups?.flatMap((g) => g.items) || [],
    [data?.menuGroups],
  );
  const selectedCount = menuItems.filter((item) => checked[item.menuId]).length;
  const allChecked = menuItems.length > 0 && selectedCount === menuItems.length;

  if (!data) return null;

  const setAll = (value) => {
    const next = {};
    menuItems.forEach((item) => {
      next[item.menuId] = value;
    });
    setChecked(next);
  };

  const toggleItem = (menuId, value) => {
    setChecked((prev) => ({ ...prev, [menuId]: value }));
  };

  return (
    <div className="staff-auth-setup admin-native-form">
      <div className="staff-auth-picker card border-0 shadow-sm">
        <div className="card-body">
          <label className="form-label mb-1" htmlFor="staff_auth_user">{copy.userLabel}</label>
          <p className="text-muted small mb-2">{copy.hint}</p>
          <SearchableSelect
            id="staff_auth_user"
            options={data.staffOptions || []}
            value={data.selectedStaff || ''}
            disabled={busy}
            searchPlaceholder="Search by name..."
            onChange={(val) => onLoad({ staff_id: val })}
          />

          {data.selectedStaff && (
            <>
              <label className="form-label mb-1 mt-3" htmlFor="staff_auth_copy_source">
                Copy permissions from (optional)
              </label>
              <SearchableSelect
                id="staff_auth_copy_source"
                options={data.staffOptions?.filter((s) => s.value !== data.selectedStaff) || []}
                value={data.copiedFromStaff || ''}
                disabled={busy}
                placeholder="--This person's own permissions--"
                searchPlaceholder="Search by name..."
                onChange={(val) => onLoad({ staff_id: data.selectedStaff, copy_from_staff: val })}
              />
            </>
          )}
        </div>
      </div>

      {data.selectedStaff && data.copiedFromStaff && (
        <div className="alert alert-info mt-3">
          Showing permissions copied from{' '}
          <strong>
            {data.staffOptions?.find((s) => s.value === data.copiedFromStaff)?.label || `user ${data.copiedFromStaff}`}
          </strong>
          . Nothing is saved yet — review below, adjust as needed, then Save to apply to the selected person.
        </div>
      )}

      {!data.selectedStaff && (
        <div className="staff-auth-empty text-muted">{copy.empty}</div>
      )}

      {data.selectedStaff && (
        <form
          className="staff-auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const menu_id = [];
            const user_row_id = [];
            const a_auth = [];
            menuItems.forEach((item) => {
              menu_id.push(String(item.menuId));
              user_row_id.push(item.rowId ? String(item.rowId) : '');
              a_auth.push(checked[item.menuId] ? '1' : '0');
            });
            await onSave({
              staff_id: data.selectedStaff,
              menu_id,
              user_row_id,
              a_auth,
              Submit: 'Save',
            });
          }}
        >
          <div className="staff-auth-toolbar card border-0 shadow-sm">
            <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <div className="staff-auth-summary">
                  <span className="staff-auth-summary-count">{selectedCount}</span>
                  <span className="text-muted">of {menuItems.length} menus enabled</span>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || allChecked}
                  onClick={() => setAll(true)}
                >
                  Check all
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || selectedCount === 0}
                  onClick={() => setAll(false)}
                >
                  Clear all
                </button>
                <button type="submit" className="btn btn-sm btn-danger" disabled={busy}>
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="staff-auth-grid">
            {data.menuGroups?.map((group) => (
              <section key={group.mainMenu} className="staff-auth-module card border-0 shadow-sm">
                <div className="staff-auth-module-head">{group.mainMenu}</div>
                <div className="staff-auth-module-body">
                  {group.items.map((item) => {
                    const isOn = Boolean(checked[item.menuId]);
                    return (
                      <label
                        key={item.menuId}
                        className={`staff-auth-item${isOn ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isOn}
                          onChange={(e) => toggleItem(item.menuId, e.target.checked)}
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="staff-auth-footer">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      )}
    </div>
  );
}
