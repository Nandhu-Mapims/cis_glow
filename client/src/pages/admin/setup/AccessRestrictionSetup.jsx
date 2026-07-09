import { useEffect, useState } from 'react';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AccessRestrictionSetup({ data, busy, onLoad, onSave }) {
  const [access, setAccess] = useState(null);

  useEffect(() => {
    if (data?.access) setAccess(data.access);
    else if (data?.selectedMember && !data.globalUser) {
      setAccess({
        accessId: null,
        localAccess: false,
        randomKey: 1,
        randomKeys: ['', '', '', ''],
        dateBase: false,
        dayBase: true,
        fromDate: '',
        toDate: '',
        allowFromTime: '',
        allowToTime: '',
        days: DAY_LABELS.map((label, idx) => ({ value: idx + 1, label, checked: true })),
      });
    }
  }, [data]);

  if (!data) return null;

  const selectedMember = data.selectedMember || '';

  return (
    <div className="admin-native-form">
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="member_id">Select Member</label>
          <select
            id="member_id"
            className="form-select"
            value={selectedMember}
            disabled={busy}
            onChange={(e) => onLoad({ member_id: e.target.value })}
          >
            <option value="">--Select--</option>
            {data.members?.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {data.globalUser && (
        <p className="text-muted">Global users are not restricted on this screen.</p>
      )}

      {selectedMember && !data.globalUser && access && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const day = {};
            access.days.forEach((d, idx) => {
              if (d.checked) day[idx] = String(d.value);
            });
            await onSave({
              member_id: selectedMember,
              access_id: access.accessId || '',
              local_access: access.localAccess ? '1' : '0',
              random_key: String(access.randomKey),
              random_key_1: access.randomKeys[0] || '',
              random_key_2: access.randomKeys[1] || '',
              random_key_3: access.randomKeys[2] || '',
              random_key_4: access.randomKeys[3] || '',
              date_base: access.dateBase ? '1' : '0',
              day_base: access.dayBase ? '1' : '0',
              from_date: access.fromDate,
              to_date: access.toDate,
              a_from_time: access.allowFromTime,
              a_to_time: access.allowToTime,
              day,
              Submit: 'Save',
            });
          }}
        >
          <h4>Access Method</h4>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={access.localAccess}
                  onChange={(e) => setAccess((a) => ({ ...a, localAccess: e.target.checked }))}
                />
                <span className="form-check-label">By Login Key</span>
              </label>
              <select
                className="form-select mt-2"
                value={access.randomKey}
                onChange={(e) => setAccess((a) => ({ ...a, randomKey: Number(e.target.value) }))}
              >
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {access.randomKeys.map((val, idx) => (
                <input
                  key={idx}
                  className="form-control mt-2"
                  placeholder={`k${idx + 1}`}
                  value={val}
                  onChange={(e) => setAccess((a) => {
                    const randomKeys = [...a.randomKeys];
                    randomKeys[idx] = e.target.value;
                    return { ...a, randomKeys };
                  })}
                />
              ))}
            </div>

            <div className="col-md-4">
              <label className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={access.dayBase}
                  onChange={(e) => setAccess((a) => ({
                    ...a,
                    dayBase: e.target.checked,
                    dateBase: e.target.checked ? false : a.dateBase,
                  }))}
                />
                <span className="form-check-label">By Day</span>
              </label>
              <div className="mt-2">
                {access.days.map((day, idx) => (
                  <label key={day.value} className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={day.checked}
                      onChange={(e) => setAccess((a) => {
                        const days = [...a.days];
                        days[idx] = { ...days[idx], checked: e.target.checked };
                        return { ...a, days };
                      })}
                    />
                    <span className="form-check-label">{day.label}</span>
                  </label>
                ))}
              </div>
              <div className="d-flex gap-2 mt-2">
                <input
                  className="form-control"
                  placeholder="From HH:MM"
                  value={access.allowFromTime}
                  onChange={(e) => setAccess((a) => ({ ...a, allowFromTime: e.target.value }))}
                />
                <input
                  className="form-control"
                  placeholder="To HH:MM"
                  value={access.allowToTime}
                  onChange={(e) => setAccess((a) => ({ ...a, allowToTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="col-md-4">
              <label className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={access.dateBase}
                  onChange={(e) => setAccess((a) => ({
                    ...a,
                    dateBase: e.target.checked,
                    dayBase: e.target.checked ? false : a.dayBase,
                  }))}
                />
                <span className="form-check-label">By Date &amp; Time</span>
              </label>
              <input
                className="form-control mt-2"
                placeholder="From dd-mm-yyyy HH:MM"
                value={access.fromDate}
                onChange={(e) => setAccess((a) => ({ ...a, fromDate: e.target.value }))}
              />
              <input
                className="form-control mt-2"
                placeholder="To dd-mm-yyyy HH:MM"
                value={access.toDate}
                onChange={(e) => setAccess((a) => ({ ...a, toDate: e.target.value }))}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-danger mt-4" disabled={busy}>Save</button>
        </form>
      )}
    </div>
  );
}
