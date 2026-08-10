import SearchableSelect from '../../../components/SearchableSelect';

export default function AssignRolesSetup({ data, busy, onLoad, onSave }) {
  if (!data) return null;

  const selectedUser = data.selectedUser || '';
  const checkedRoleIds = new Set(
    data.roleChecklist?.filter((r) => r.checked).map((r) => String(r.roleId)) || [],
  );

  return (
    <div className="admin-native-form">
      <p className="text-muted">
        Assign one or more roles to this user. Assigning a role grants its menu items
        immediately. Removing a role does <strong>not</strong> revoke access already granted —
        use <strong>Menu Permissions</strong> to remove specific items by hand.
      </p>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="assign_user">Select User</label>
          <SearchableSelect
            id="assign_user"
            options={data.users || []}
            value={selectedUser}
            disabled={busy}
            searchPlaceholder="Search by username or name..."
            onChange={(val) => onLoad({ member_id: val })}
          />
        </div>
      </div>

      {selectedUser && (
        <form
          key={selectedUser}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const a_roles = [...form.querySelectorAll('input[name="a_roles"]:checked')].map((el) => el.value);
            await onSave({ member_id: selectedUser, a_roles });
          }}
        >
          {!data.roleChecklist?.length && (
            <p className="text-muted">
              No roles exist yet. Create one on the <strong>Role Manager</strong> screen first.
            </p>
          )}

          <div className="row g-2 mb-4">
            {data.roleChecklist?.map((role) => (
              <div key={role.roleId} className="col-md-4">
                <label className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input me-2"
                    name="a_roles"
                    value={role.roleId}
                    defaultChecked={checkedRoleIds.has(String(role.roleId))}
                  />
                  <span className="form-check-label">
                    {role.label}
                    {role.description ? <small className="text-muted d-block">{role.description}</small> : null}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      )}
    </div>
  );
}
