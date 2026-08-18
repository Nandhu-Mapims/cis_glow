import { useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmModal from '../../../components/ConfirmModal';
import { useToast } from '../../../components/ToastProvider';

function PasswordFields({ busy, editId, onSave }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const type = show ? 'text' : 'password';

  return (
    <form
      className="mt-4 border-top pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          edit_row_id: editId,
          password,
          confirm_password: confirmPassword,
          Submit3: 'Save',
        });
      }}
    >
      <h4>Change Password</h4>
      <div className="row g-3 mt-1">
        <div className="col-md-4">
          <label className="form-label" htmlFor="new_password">New Password</label>
          <input
            id="new_password"
            type={type}
            className="form-control"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="confirm_new_password">Confirm Password</label>
          <input
            id="confirm_new_password"
            type={type}
            className="form-control"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setShow((v) => !v)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save Password</button>
    </form>
  );
}

function AccountEditDetail({ data, busy, onLoad, onSave }) {
  const user = data.user;
  const [profile, setProfile] = useState({
    member_name: user.memberName,
    address_mobile: user.addressMobile,
    address_email: user.addressEmail,
    hd_photo: user.photo,
  });
  const [photoFile, setPhotoFile] = useState(null);

  return (
    <div>
      <div className="text-end mb-3">
        <button
          type="button"
          className="btn btn-link"
          onClick={() => onLoad({}, { search: data.listContext?.search, page: data.listContext?.page })}
        >
          Back to list
        </button>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const files = [];
          if (photoFile) {
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(photoFile);
            });
            files.push({ field: 'photo', name: photoFile.name, data: base64 });
          }
          await onSave({
            edit_row_id: user.id,
            Submit0: 'Save',
            ...profile,
            remove_photo: profile.hd_photo ? '0' : '1',
          }, files);
        }}
      >
        <h4>Basic Information</h4>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Staff ID</label>
            <div className="form-control-plaintext">{user.memberId}</div>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="edit_member_name">Member Name</label>
            <input
              id="edit_member_name"
              className="form-control"
              required
              value={profile.member_name}
              onChange={(e) => setProfile((p) => ({ ...p, member_name: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="edit_mobile">Mobile</label>
            <input
              id="edit_mobile"
              className="form-control"
              value={profile.address_mobile}
              onChange={(e) => setProfile((p) => ({ ...p, address_mobile: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="edit_email">Email</label>
            <input
              id="edit_email"
              type="email"
              className="form-control"
              value={profile.address_email}
              onChange={(e) => setProfile((p) => ({ ...p, address_email: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="edit_photo">Photo</label>
            <input
              id="edit_photo"
              type="file"
              className="form-control"
              accept="image/jpeg,image/png,image/gif"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
            {user.photoUrl && profile.hd_photo && (
              <div className="mt-2 d-flex align-items-center gap-2">
                <img src={user.photoUrl} alt="" width="30" height="30" />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setProfile((p) => ({ ...p, hd_photo: '' }))}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <template className="col-md-6 d-none">
            <label className="form-label">Your Secret Code</label>
            <div className="form-control-plaintext font-monospace">{user.currentPassword || '—'}</div>
          </template>
        </div>
        <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save</button>
      </form>

      <PasswordFields busy={busy} editId={user.id} onSave={onSave} />

      <div className="mt-3 d-flex gap-2">
        <Link to={`/admin/setup/menu-auth?uid=${user.id}`} className="btn btn-success btn-sm">Menu Authentication</Link>
        <Link to={`/admin/setup/dashboard-access?uid=${user.id}`} className="btn btn-success btn-sm">Dashboard Access</Link>
      </div>
    </div>
  );
}

function AccountList({ data, busy, onLoad, onSave }) {
  const toast = useToast();
  const [pendingUser, setPendingUser] = useState(null);

  const confirmDelete = async () => {
    if (!pendingUser) return;
    try {
      await onSave({ delete: 'Confirm', confirm: pendingUser.id, search: data.search, page: data.page });
      toast.success(`Deleted user ${pendingUser.memberId}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setPendingUser(null);
    }
  };

  return (
    <div>
      <form
        className="row g-2 mb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const search = new FormData(e.currentTarget).get('search');
          await onLoad({ search }, { page: 1 });
        }}
      >
        <div className="col-md-6">
          <input
            className="form-control"
            placeholder="Search member ID or name"
            defaultValue={data.search || ''}
            name="search"
          />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-outline-primary" disabled={busy}>Search</button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Member Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.users?.length ? data.users.map((user) => (
              <tr key={user.id}>
                <td>{user.memberId}</td>
                <td>{user.memberName}</td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary me-2"
                    disabled={busy}
                    onClick={() => onLoad({ edit_row_id: user.id })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={busy}
                    onClick={() => setPendingUser(user)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="text-muted">No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data.total > data.limit && (
        <div className="d-flex justify-content-between align-items-center">
          <span className="text-muted small">
            Showing page {data.page} of {Math.ceil(data.total / data.limit)}
          </span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={busy || data.page <= 1}
              onClick={() => onLoad({ search: data.search }, { page: data.page - 1 })}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={busy || data.page >= Math.ceil(data.total / data.limit)}
              onClick={() => onLoad({ search: data.search }, { page: data.page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        show={Boolean(pendingUser)}
        title="Delete user?"
        message={pendingUser ? `Delete user account "${pendingUser.memberName}" (${pendingUser.memberId})? This cannot be undone.` : ''}
        confirmLabel="Delete User"
        tone="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setPendingUser(null)}
      />
    </div>
  );
}

export default function AccountEditSetup({ data, busy, onLoad, onSave }) {
  if (!data) return null;

  if (data.mode === 'edit') {
    return <AccountEditDetail data={data} busy={busy} onLoad={onLoad} onSave={onSave} />;
  }

  return <AccountList data={data} busy={busy} onLoad={onLoad} onSave={onSave} />;
}
