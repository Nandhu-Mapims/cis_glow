import { useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';

export default function MenuAuthSetup({ data, busy, onLoad, onSave }) {
  const [filterQuery, setFilterQuery] = useState('');

  if (!data) return null;

  const selectedUser = data.selectedUser || '';
  const copiedFromUser = data.copiedFromUser || '';
  const checkedIds = new Set(
    data.menuGroups?.flatMap((g) => g.items.filter((i) => i.checked).map((i) => String(i.menuId))) || [],
  );
  const copySourceLabel = copiedFromUser
    ? data.users?.find((u) => u.value === copiedFromUser)?.label
    : '';

  // Menu items stay mounted regardless of the filter (CSS display:none, not
  // array filtering) so their checked state -- native, uncontrolled
  // checkboxes -- survives while the admin edits the search text.
  const normalizedFilter = filterQuery.trim().toLowerCase();
  const visibleGroups = (data.menuGroups || []).map((group) => {
    const groupNameMatches = !normalizedFilter || group.mainMenu.toLowerCase().includes(normalizedFilter);
    const items = group.items.map((item) => ({
      ...item,
      visible: groupNameMatches || item.label.toLowerCase().includes(normalizedFilter),
    }));
    return { ...group, visible: items.some((i) => i.visible), items };
  });
  const hasAnyMatch = visibleGroups.some((g) => g.visible);

  return (
    <div className="admin-native-form">
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="menu_user">Select User</label>
          <SearchableSelect
            id="menu_user"
            options={data.users || []}
            value={selectedUser}
            disabled={busy}
            searchPlaceholder="Search by username or name..."
            onChange={(val) => onLoad({ member_id: val })}
          />
        </div>

        {selectedUser && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="menu_copy_source">
              Copy permissions from (optional)
            </label>
            <SearchableSelect
              id="menu_copy_source"
              options={data.users?.filter((u) => u.value !== selectedUser) || []}
              value={copiedFromUser}
              disabled={busy}
              placeholder="--This user's own permissions--"
              searchPlaceholder="Search by username or name..."
              onChange={(val) => onLoad({ member_id: selectedUser, copy_from_user: val })}
            />
          </div>
        )}
      </div>

      {selectedUser && copiedFromUser && (
        <div className="alert alert-info">
          Showing permissions copied from <strong>{copySourceLabel || `user ${copiedFromUser}`}</strong>.
          Nothing is saved yet — review the checkboxes below, adjust as needed, then click Save to
          apply them to the selected user.
        </div>
      )}

      {selectedUser && (
        <form
          // Remount when the target user or copy source changes so the
          // uncontrolled checkboxes' defaultChecked re-applies (React won't
          // re-run defaultChecked on an update since menuId keys are stable
          // across reloads for the same target user).
          key={`${selectedUser}:${copiedFromUser}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const a_auth = [...form.querySelectorAll('input[name="a_auth"]:checked')].map((el) => el.value);
            await onSave({
              member_id: selectedUser,
              user_id_ref: selectedUser,
              a_auth,
              Submit: 'Save',
            });
          }}
        >
          <div className="row g-2 align-items-center mb-3">
            <div className="col-md-6">
              <label className="form-check mb-0">
                <input
                  type="checkbox"
                  className="form-check-input me-2"
                  onChange={(e) => {
                    formToggleAll(e.target.checked);
                  }}
                />
                <span className="form-check-label">Check all main menus</span>
              </label>
            </div>
            <div className="col-md-6">
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Filter menu items by name..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>
          </div>

          {!hasAnyMatch && (
            <p className="text-muted">No menu items match &quot;{filterQuery}&quot;.</p>
          )}

          {visibleGroups.map((group) => (
            <div
              key={group.mainMenu}
              className="mb-4"
              style={{ display: group.visible ? undefined : 'none' }}
            >
              <h5>{group.mainMenu}</h5>
              <div className="row g-2">
                {group.items.map((item) => (
                  <div
                    key={item.menuId}
                    className="col-md-3"
                    style={{ display: item.visible ? undefined : 'none' }}
                  >
                    <label className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input me-2"
                        name="a_auth"
                        value={item.menuId}
                        defaultChecked={checkedIds.has(String(item.menuId))}
                      />
                      <span className="form-check-label">{item.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      )}
    </div>
  );
}

function formToggleAll(checked) {
  document.querySelectorAll('input[name="a_auth"]').forEach((el) => {
    el.checked = checked;
  });
}
