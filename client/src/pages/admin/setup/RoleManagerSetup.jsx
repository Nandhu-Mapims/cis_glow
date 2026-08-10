import { useRef } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';

export default function RoleManagerSetup({ data, busy, onLoad, onSave }) {
  const nameRef = useRef(null);
  const descRef = useRef(null);

  if (!data) return null;

  const selectedRoleId = data.selectedRoleId || '';
  const isNew = Boolean(data.isNew);
  const checkedIds = new Set(
    data.menuGroups?.flatMap((g) => g.items.filter((i) => i.checked).map((i) => String(i.menuId))) || [],
  );
  const roleSelectOptions = [
    { value: 'new', label: '+ Create new role' },
    ...(data.roles || []),
  ];

  return (
    <div className="admin-native-form">
      <p className="text-muted">
        Define a role once, then assign it to any number of users on the{' '}
        <strong>Assign Roles</strong> screen instead of re-ticking the same menu boxes per person.
      </p>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="role_select">Select Role</label>
          <SearchableSelect
            id="role_select"
            options={roleSelectOptions}
            value={selectedRoleId}
            disabled={busy}
            searchPlaceholder="Search roles..."
            onChange={(val) => onLoad({ role_id: val })}
          />
        </div>
      </div>

      {selectedRoleId && (
        <form
          key={`${selectedRoleId}:${isNew ? 'new' : 'edit'}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const a_auth = [...form.querySelectorAll('input[name="a_auth"]:checked')].map((el) => el.value);
            await onSave({
              role_id: selectedRoleId,
              role_name: nameRef.current?.value || '',
              description: descRef.current?.value || '',
              a_auth,
            });
          }}
        >
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label" htmlFor="role_name">Role Name</label>
              <input
                id="role_name"
                ref={nameRef}
                type="text"
                className="form-control"
                defaultValue={data.roleName || ''}
                placeholder="e.g. Librarian, Accountant, HOD"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="role_desc">Description</label>
              <input
                id="role_desc"
                ref={descRef}
                type="text"
                className="form-control"
                defaultValue={data.description || ''}
                placeholder="Optional — what this role is for"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-check">
              <input
                type="checkbox"
                className="form-check-input me-2"
                onChange={(e) => formToggleAll(e.target.checked)}
              />
              <span className="form-check-label">Check all main menus</span>
            </label>
          </div>

          {data.menuGroups?.map((group) => (
            <div key={group.mainMenu} className="mb-4">
              <h5>{group.mainMenu}</h5>
              <div className="row g-2">
                {group.items.map((item) => (
                  <div key={item.menuId} className="col-md-3">
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

          <button type="submit" className="btn btn-danger" disabled={busy}>Save Role</button>
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
