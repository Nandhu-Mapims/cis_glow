import { useEffect, useState } from 'react';

function generatePassword(length = 8) {
  const keylist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789!@#%*+';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += keylist.charAt(Math.floor(Math.random() * keylist.length));
  }
  return value;
}

export default function ChangePasswordSetup({ data, busy, onSave }) {
  const [profile, setProfile] = useState({
    memberName: '',
    addressMobile: '',
    addressEmail: '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setProfile({
        memberName: data.user.memberName || '',
        addressMobile: data.user.addressMobile || '',
        addressEmail: data.user.addressEmail || '',
      });
    }
  }, [data?.user]);

  if (!data?.user) return null;

  const pwdType = showPassword ? 'text' : 'password';

  return (
    <div className="admin-native-form">
      <section className="mb-4">
        <h4 className="mb-3">Basic Information</h4>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              action: 'profile',
              member_name: profile.memberName,
              address_mobile: profile.addressMobile,
              address_email: profile.addressEmail,
            });
          }}
        >
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Username</label>
              <input className="form-control" value={data.user.memberId} readOnly />
            </div>
            <div className="col-md-8">
              <label className="form-label">Name</label>
              <input className="form-control" required value={profile.memberName} disabled={busy} onChange={(e) => setProfile((p) => ({ ...p, memberName: e.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Mobile</label>
              <input className="form-control" value={profile.addressMobile} disabled={busy} onChange={(e) => setProfile((p) => ({ ...p, addressMobile: e.target.value }))} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={profile.addressEmail} disabled={busy} onChange={(e) => setProfile((p) => ({ ...p, addressEmail: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save Profile</button>
        </form>
      </section>

      <section className="border-top pt-4">
        <h4 className="mb-3">Change Password</h4>
        <div className="mb-3 text-muted small">
          Current password:
          {' '}
          <span className="font-monospace">{data.user.currentPassword || '—'}</span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              action: 'password',
              password,
              confirm_password: confirmPassword,
            });
            setPassword('');
            setConfirmPassword('');
          }}
        >
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">New Password</label>
              <input type={pwdType} className="form-control" required value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Confirm Password</label>
              <input type={pwdType} className="form-control" required value={confirmPassword} disabled={busy} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="col-md-4 d-flex align-items-end gap-2">
              <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                className="btn btn-outline-info"
                disabled={busy}
                onClick={() => {
                  const generated = generatePassword(8);
                  setPassword(generated);
                  setConfirmPassword(generated);
                  setShowPassword(true);
                }}
              >
                Generate
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save Password</button>
        </form>
      </section>
    </div>
  );
}
