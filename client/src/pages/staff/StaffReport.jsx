import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../students/StudentReport.css';

export default function StaffReport() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [fieldGroups, setFieldGroups] = useState([]);
  const [filters, setFilters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');

  const [categoryId, setCategoryId] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [showHeader, setShowHeader] = useState(false);
  const [showSerialNo, setShowSerialNo] = useState(false);
  const [discontinued, setDiscontinued] = useState('Regular');
  const [selectedFields, setSelectedFields] = useState([]);
  const [customField, setCustomField] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, fieldsRes, filtersRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get('/api/staff/reports/fields'),
          api.get('/api/staff/reports/filters'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        setFieldGroups(fieldsRes.data.groups || []);
        setFilters(filtersRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load report builder');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addField = (field) => {
    const name = String(field || '').trim();
    if (!name || selectedFields.includes(name)) return;
    setSelectedFields((prev) => [...prev, name]);
    setError(null);
  };

  const addGroupFields = (group) => {
    setSelectedFields((prev) => {
      const next = [...prev];
      group.fields.forEach((field) => {
        if (!next.includes(field)) next.push(field);
      });
      return next;
    });
  };

  const removeField = (index) => {
    setSelectedFields((prev) => prev.filter((_, i) => i !== index));
  };

  const moveField = (index, direction) => {
    setSelectedFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const generateReport = async (format) => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/staff/reports/generate', {
        categoryId,
        reportTitle,
        showHeader,
        showSerialNo,
        discontinued,
        fields: selectedFields,
        format,
      });

      if (format === 'xls') {
        if (res.data.downloadUrl) window.open(res.data.downloadUrl, '_blank');
        else setError('Excel file was not created');
        return;
      }

      setPreviewHtml(res.data.html || '');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(res.data.html || '');
        printWindow.document.close();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout settings={settings} menu={menu}>
        <div className="p-4">Loading report builder…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <div className="student-report-page">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/staff">Staff</Link></li>
            <li className="breadcrumb-item active">Export Report</li>
          </ol>
        </nav>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">Staff Export Report</h4>
          <Link to="/staff" className="btn btn-outline-secondary btn-sm">Back to search</Link>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <section className="card mb-3">
          <div className="card-header">Filter</div>
          <div className="card-body row g-3">
            <div className="col-md-4">
              <label className="form-label">Category</label>
              <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {(filters?.categoryOptions || []).map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Title</label>
              <input className="form-control" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Show</label>
              <div className="d-flex flex-wrap gap-3">
                {['Regular', 'Discontinue', 'All'].map((value) => (
                  <label key={value}>
                    <input type="radio" name="discontinued" value={value} checked={discontinued === value} onChange={() => setDiscontinued(value)} />
                    {' '}{value}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label">Options</label>
              <div className="d-flex gap-3">
                <label><input type="checkbox" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} /> Header</label>
                <label><input type="checkbox" checked={showSerialNo} onChange={(e) => setShowSerialNo(e.target.checked)} /> S.No.</label>
              </div>
            </div>
            <div className="col-12 d-flex gap-2">
              <button type="button" className="btn btn-danger" disabled={generating} onClick={() => generateReport('html')}>Print</button>
              <button type="button" className="btn btn-danger" disabled={generating} onClick={() => generateReport('xls')}>Export XLS</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => { setSelectedFields([]); setPreviewHtml(''); }}>Clear fields</button>
            </div>
          </div>
        </section>

        <div className="row g-3">
          <div className="col-lg-8">
            <section className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Select required fields</span>
                <div className="d-flex gap-2">
                  <input className="form-control form-control-sm" placeholder="Custom field" value={customField} onChange={(e) => setCustomField(e.target.value)} />
                  <button type="button" className="btn btn-sm btn-info text-white" onClick={() => { addField(customField); setCustomField(''); }}>Add</button>
                </div>
              </div>
              <div className="card-body report-field-catalog">
                {fieldGroups.map((group) => (
                  <div key={group.name} className="report-field-group">
                    <button type="button" className="report-field-group-title" onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}>
                      {group.name}
                    </button>
                    {expandedGroup === group.name && (
                      <div className="report-field-group-actions p-2">
                        <button type="button" className="btn btn-sm btn-outline-primary mb-2" onClick={() => addGroupFields(group)}>Add all</button>
                        <div className="report-field-list">
                          {group.fields.map((field) => (
                            <button key={field} type="button" className="report-field-chip" onClick={() => addField(field)}>{field}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="col-lg-4">
            <section className="card">
              <div className="card-header">Selected fields ({selectedFields.length})</div>
              <div className="card-body">
                {selectedFields.length === 0 ? (
                  <p className="text-muted mb-0">Place your fields here.</p>
                ) : (
                  <ol className="report-selected-fields">
                    {selectedFields.map((field, index) => (
                      <li key={`${field}-${index}`}>
                        <span>{field}</span>
                        <span className="report-selected-actions">
                          <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0}>↑</button>
                          <button type="button" onClick={() => moveField(index, 1)} disabled={index === selectedFields.length - 1}>↓</button>
                          <button type="button" onClick={() => removeField(index)}>×</button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          </div>
        </div>

        {previewHtml && (
          <section className="card mt-3">
            <div className="card-header">Preview</div>
            <div className="card-body student-report-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
