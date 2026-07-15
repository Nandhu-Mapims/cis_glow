import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';

function resolvePhotoUrl(path) {
  if (!path || path.startsWith('http')) return path;
  if (path.startsWith('/')) return path;
  return `/legacy/${path.replace(/^\.\.\//, '')}`;
}

export default function StaffLivePunch() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const clearForm = () => {
    setStaffId('');
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  };

  const punch = async (e) => {
    e?.preventDefault();
    const id = staffId.trim();
    if (!id) {
      setError('Staff ID is required');
      return;
    }
    setPunching(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post('/api/attendance/staff/punch', { staffId: id });
      setResult(res.data);
      setStaffId('');
    } catch (err) {
      setError(err.response?.data?.message || 'Punch failed');
    } finally {
      setPunching(false);
      inputRef.current?.focus();
    }
  };

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance">Attendance</Link></li>
          <li className="breadcrumb-item active">Staff Live Punch</li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Staff Live Attendance Punch</h4>
        <Link to="/attendance" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      <p className="text-muted small">
        Scan or type a staff ID and press Enter to record an in/out punch.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card mb-3" onSubmit={punch}>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Staff ID</label>
            <input
              ref={inputRef}
              className="form-control form-control-lg"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              disabled={punching}
              autoComplete="off"
            />
          </div>
          <div className="col-md-4 d-flex gap-2">
            <button type="submit" className="btn btn-danger" disabled={punching}>
              {punching ? 'Recording...' : 'Punch'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={clearForm}>
              Clear
            </button>
          </div>
        </div>
      </form>

      {result && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3 align-items-center">
              <div className="col-md-8">
                <h5 className="mb-1">{result.name}</h5>
                <p className="mb-1 text-muted">{result.designation}</p>
                <p className="mb-1"><strong>{result.inOut}</strong> — {result.timestamp}</p>
              </div>
              {result.photoUrl && (
                <div className="col-md-4 text-center">
                  <img
                    src={resolvePhotoUrl(result.photoUrl)}
                    alt="Staff"
                    className="img-thumbnail"
                    style={{ maxHeight: 160 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
