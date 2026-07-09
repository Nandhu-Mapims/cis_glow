import { useState } from 'react';

function generatePassword(length = 6) {
  const keylist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789!@#%*+';
  let temp = '';
  for (let i = 0; i < length; i += 1) {
    temp += keylist.charAt(Math.floor(Math.random() * keylist.length));
  }
  return temp;
}

export default function AccountAddForm({ busy, onSave }) {
  const [form, setForm] = useState({
    member_name: '',
    address_mobile: '',
    address_email: '',
    username: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    const result = await onSave({ ...form, Submit: 'Save' });
    if (result?.success !== false) {
      setForm({
        member_name: '',
        address_mobile: '',
        address_email: '',
        username: '',
        password: '',
        confirm_password: '',
      });
      setShowPassword(false);
    }
  };

  const inputType = showPassword ? 'text' : 'password';

  return (
    <form onSubmit={onSubmit} className="admin-native-form">
      <h4 className="mb-3">Basic Information</h4>

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="member_name">
            Member Name <span className="text-danger">*</span>
          </label>
          <input
            id="member_name"
            className="form-control"
            maxLength={70}
            required
            value={form.member_name}
            onChange={(e) => update('member_name', e.target.value)}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="address_mobile">Mobile</label>
          <input
            id="address_mobile"
            type="tel"
            className="form-control"
            maxLength={15}
            value={form.address_mobile}
            onChange={(e) => update('address_mobile', e.target.value)}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="address_email">Email</label>
          <input
            id="address_email"
            type="email"
            className="form-control"
            maxLength={70}
            value={form.address_email}
            onChange={(e) => update('address_email', e.target.value)}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="username">
            Username <span className="text-danger">*</span>
          </label>
          <input
            id="username"
            className="form-control"
            autoComplete="off"
            required
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="d-flex gap-2">
            <input
              id="password"
              type={inputType}
              className="form-control"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              className="btn btn-outline-info"
              onClick={() => {
                const pass = generatePassword(6);
                update('password', pass);
                update('confirm_password', pass);
                setShowPassword(true);
              }}
            >
              Generate
            </button>
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="confirm_password">Confirm Password</label>
          <input
            id="confirm_password"
            type={inputType}
            className="form-control"
            required
            value={form.confirm_password}
            onChange={(e) => update('confirm_password', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 d-flex gap-2">
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={busy}
          onClick={() => {
            setForm({
              member_name: '',
              address_mobile: '',
              address_email: '',
              username: '',
              password: '',
              confirm_password: '',
            });
            setShowPassword(false);
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
