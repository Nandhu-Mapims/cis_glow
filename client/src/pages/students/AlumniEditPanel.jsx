import { useEffect, useState } from 'react';

function normalizeGender(value) {
  const g = String(value || '').toLowerCase();
  if (g === 'male' || g === 'female') return g;
  return '';
}

export default function AlumniEditPanel({ data, busy, onLoad, onSave }) {
  const alumni = data?.alumni;
  const [searchBy, setSearchBy] = useState('name');
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (alumni) {
      setForm({ ...alumni });
      setSearchInput(alumni.regNo || searchInput);
      setSelectedId(alumni.id || data?.selectedAlumniId || null);
    } else if (!data?.notFound) {
      setForm(null);
    }
  }, [alumni, data?.notFound, data?.selectedAlumniId]);

  useEffect(() => {
    if (data?.selectedAlumniId) setSelectedId(data.selectedAlumniId);
  }, [data?.selectedAlumniId]);

  const handleSearch = async () => {
    const query = searchInput.trim();
    if (!query) return;
    await onLoad({
      search_by: searchBy,
      search_input: query,
    });
  };

  const handleSelectAlumni = async (id) => {
    setSelectedId(id);
    // Carry the currently displayed (possibly filtered) list along so the server can
    // echo it back instead of replacing it with the full unfiltered roster.
    await onLoad({ alumni_id: id, alumniList: data?.alumniList });
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const reloadClasses = async (next) => {
    const payload = {
      course: next.course,
      yop: next.yop,
      alumniList: data?.alumniList,
    };
    if (next.id) {
      await onLoad({ ...payload, alumni_id: next.id });
    } else {
      await onLoad({
        ...payload,
        search_by: 'roll_no',
        search_input: next.regNo,
      });
    }
  };

  const alumniList = data?.alumniList || [];

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <div className="card cis-student-screen-card h-100">
          <div className="card-header">Filter</div>
          <div className="card-body">
            <label className="form-label small text-muted mb-2">Search by</label>
            <div className="d-flex flex-column gap-1 mb-3">
              <label className="mb-0">
                <input className="me-2"
                  type="radio"
                  name="alumni_search_by"
                  value="name"
                  checked={searchBy === 'name'}
                  onChange={() => setSearchBy('name')}
                />
                {' '}Name
              </label>
              <label className="mb-0">
                <input className="me-2"
                  type="radio"
                  name="alumni_search_by"
                  value="roll_no"
                  checked={searchBy === 'roll_no'}
                  onChange={() => setSearchBy('roll_no')}
                />
                {' '}Register No
              </label>
            </div>
            <div className="input-group mb-3">
              <input
                className="form-control"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder={searchBy === 'roll_no' ? 'Register no' : 'Name'}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !searchInput.trim()}
                onClick={handleSearch}
              >
                Go
              </button>
            </div>
            <div className="cis-alumni-result-list">
              {alumniList.length === 0 && (
                <p className="text-muted small mb-0">No alumni to list.</p>
              )}
              {alumniList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cis-alumni-result-btn${selectedId === item.id ? ' is-active' : ''}`}
                  disabled={busy}
                  onClick={() => handleSelectAlumni(item.id)}
                >
                  {item.regNo ? `${item.regNo} - ${item.name}` : item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        {data?.notFound && (
          <div className="alert alert-warning mb-3">{data.message || 'No alumni profile found.'}</div>
        )}

        {data?.fromStudent && form && (
          <div className="alert alert-info mb-3">
            No alumni record exists yet. Profile prefilled from student register no {form.regNo}.
          </div>
        )}

        {!form && !data?.notFound && (
          <div className="cis-report-empty">
            <span className="cis-report-empty-icon" aria-hidden="true">🎓</span>
            <p className="mb-0">Search or select an alumni profile from the list to begin editing.</p>
          </div>
        )}

        {form && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                isNew: form.isNew,
                student_id: form.id,
                reg_no: form.regNo,
                name: form.name,
                email: form.email,
                mobile: form.mobile,
                address: form.address,
                course: form.course,
                dept: form.dept,
                yop: form.yop,
                pgd: form.pgd,
                cp: form.cp,
                ws: form.ws,
                gender: form.gender,
                dob: form.dob,
              });
            }}
          >
            <div className="row g-3">
              <div className="col-md-6">
                <div className="card cis-student-screen-card h-100">
                  <div className="card-header">Personal Information</div>
                  <div className="card-body row g-3">
                    <div className="col-12">
                      <label className="form-label">Name *</label>
                      <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Register No *</label>
                      <input className="form-control" value={form.regNo} onChange={(e) => set('regNo', e.target.value)} required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Gender</label>
                      <div className="d-flex gap-3">
                        <label className="mb-0">
                          <input className="me-2"
                            type="radio"
                            name="gender"
                            value="male"
                            checked={normalizeGender(form.gender) === 'male'}
                            onChange={() => set('gender', 'male')}
                          />
                          {' '}Male
                        </label>
                        <label className="mb-0">
                          <input className="me-2"
                            type="radio"
                            name="gender"
                            value="female"
                            checked={normalizeGender(form.gender) === 'female'}
                            onChange={() => set('gender', 'female')}
                          />
                          {' '}Female
                        </label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Date of Birth</label>
                      <input type="date" className="form-control" value={form.dob || ''} onChange={(e) => set('dob', e.target.value)} />
                    </div>
                    {form.photoUrl && (
                      <div className="col-12">
                        <label className="form-label">Photo</label>
                        <div><a href={form.photoUrl} target="_blank" rel="noreferrer">View photo</a></div>
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label">E-Mail</label>
                      <input type="email" className="form-control" value={form.email} onChange={(e) => set('email', e.target.value)} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Mobile</label>
                      <input className="form-control" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Address</label>
                      <textarea className="form-control" rows={3} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card cis-student-screen-card h-100">
                  <div className="card-header">Alumni Information</div>
                  <div className="card-body row g-3">
                    <div className="col-12">
                      <label className="form-label">Year of Passing</label>
                      <select
                        className="form-select"
                        value={form.yop || ''}
                        onChange={async (e) => {
                          const yop = e.target.value;
                          const next = { ...form, yop };
                          set('yop', yop);
                          await reloadClasses(next);
                        }}
                      >
                        <option value="">-- YOP --</option>
                        {(data?.yopOptions || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Degree</label>
                      <select
                        className="form-select"
                        value={form.course || ''}
                        onChange={async (e) => {
                          const course = e.target.value;
                          const next = { ...form, course };
                          set('course', course);
                          await reloadClasses(next);
                        }}
                      >
                        <option value="">-- Degree --</option>
                        {(data?.courseOptions || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Course</label>
                      <select className="form-select" value={form.dept || ''} onChange={(e) => set('dept', e.target.value)}>
                        <option value="">-- Select Course --</option>
                        {(data?.classOptions || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">PG Details (If Any)</label>
                      <input className="form-control" value={form.pgd || ''} onChange={(e) => set('pgd', e.target.value)} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Clinical Practice (If Any)</label>
                      <input className="form-control" value={form.cp || ''} onChange={(e) => set('cp', e.target.value)} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Current Working Status (If Any)</label>
                      <textarea className="form-control" rows={3} value={form.ws || ''} onChange={(e) => set('ws', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary mt-3" disabled={busy}>
              {form.isNew ? 'Create Alumni Profile' : 'Update Profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
