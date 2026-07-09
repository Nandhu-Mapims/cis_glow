import { useEffect, useState } from 'react';

function BlockSelect({ groups, value, onChange, required }) {
  return (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">--Select--</option>
      {groups?.map((group) => (
        <optgroup key={group.type} label={group.type}>
          {group.blocks.map((block) => (
            <option key={block.id} value={block.id}>{block.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function RoomSetupAddSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ blockId: '', roomNo: '', roomName: '', floorName: '', bedCount: '' });

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.nextRoomNo) {
      setForm((prev) => ({ ...prev, roomNo: prev.roomNo || data.nextRoomNo }));
    }
  }, [data]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="row g-3"
    >
      <div className="col-md-6">
        <label className="form-label">Block *</label>
        <BlockSelect groups={data?.blockGroups} value={form.blockId} onChange={(v) => set('blockId', v)} required />
      </div>
      <div className="col-md-6">
        <label className="form-label">Room No *</label>
        <input className="form-control" value={form.roomNo} onChange={(e) => set('roomNo', e.target.value)} required />
      </div>
      <div className="col-md-6">
        <label className="form-label">Room Name</label>
        <input className="form-control" value={form.roomName} onChange={(e) => set('roomName', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Floor</label>
        <input className="form-control" value={form.floorName} onChange={(e) => set('floorName', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Bed</label>
        <input className="form-control" value={form.bedCount} onChange={(e) => set('bedCount', e.target.value)} />
      </div>
      <div className="col-12">
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </div>
    </form>
  );
}

export { BlockSelect };
