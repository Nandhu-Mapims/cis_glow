import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';

export default function CollegeSmsSetup({ data, busy, onLoad, onSave }) {
  const [groups, setGroups] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.groups) setGroups(data.groups);
  }, [data]);

  const toggleItem = (id) => {
    setGroups((prev) => prev.map((group) => ({
      ...group,
      items: group.items.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    })));
  };

  const toggleGroup = (groupLabel, checked) => {
    setGroups((prev) => prev.map((group) => (
      group.label === groupLabel
        ? { ...group, items: group.items.map((item) => ({ ...item, enabled: checked })) }
        : group
    )));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const items = groups.flatMap((g) => g.items);
    await onSave({ items });
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <form onSubmit={handleSave}>
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <h5>
              <label className="mb-0">
                <input
                  type="checkbox"
                  checked={group.items.every((i) => i.enabled)}
                  onChange={(e) => toggleGroup(group.label, e.target.checked)}
                />
                {' '}{group.label}
              </label>
            </h5>
            <div className="row g-2">
              {group.items.map((item) => (
                <div key={item.id} className="col-md-3">
                  <label className="d-block">
                    <input type="checkbox" checked={item.enabled} onChange={() => toggleItem(item.id)} />
                    {' '}{item.title}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="text-end">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
    </>
  );
}
