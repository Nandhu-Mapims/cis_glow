export default function MenuAuthSetup({ data, busy, onLoad, onSave }) {
  if (!data) return null;

  const selectedUser = data.selectedUser || '';
  const checkedIds = new Set(
    data.menuGroups?.flatMap((g) => g.items.filter((i) => i.checked).map((i) => String(i.menuId))) || [],
  );

  return (
    <div className="admin-native-form">
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="menu_user">Select User</label>
          <select
            id="menu_user"
            className="form-select"
            value={selectedUser}
            disabled={busy}
            onChange={(e) => onLoad({ member_id: e.target.value })}
          >
            <option value="">--Select One--</option>
            {data.users?.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedUser && (
        <form
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
          <div className="mb-3">
            <label className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                onChange={(e) => {
                  formToggleAll(e.target.checked);
                }}
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
                        className="form-check-input"
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
