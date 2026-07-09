import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useShellData } from '../../hooks/useShellData';
import { extractReportBodyHtml, printReportHtml } from '../../utils/printReport';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';

export default function StudentReport() {
  const { settings, menu, loading: shellLoading, error: shellError, reload: reloadShell } = useShellData();
  const [fieldGroups, setFieldGroups] = useState([]);
  const [filters, setFilters] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');

  const [courseName, setCourseName] = useState('All---All');
  const [searchBy, setSearchBy] = useState('batch');
  const [academicYear, setAcademicYear] = useState('All');
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
        const [fieldsRes, filtersRes] = await Promise.all([
          api.get('/api/students/reports/fields'),
          api.get('/api/students/reports/filters'),
        ]);
        setFieldGroups(fieldsRes.data.groups || []);
        setFilters(filtersRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load report builder');
      } finally {
        setDataLoading(false);
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

  const clearFields = () => {
    setSelectedFields([]);
    setPreviewHtml('');
    setError(null);
  };

  const buildPayload = () => ({
    courseName,
    searchBy,
    academicYear,
    reportTitle,
    showHeader,
    showSerialNo,
    discontinued,
    fields: selectedFields,
  });

  const generateReport = async (format) => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/students/reports/generate', {
        ...buildPayload(),
        format,
      });

      if (format === 'xls') {
        if (res.data.downloadUrl) {
          window.open(res.data.downloadUrl, '_blank');
        } else if (res.data.csv) {
          const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = res.data.filename || 'student_report.csv';
          link.click();
          URL.revokeObjectURL(url);
        } else {
          setError('Export file was not created');
        }
        return;
      }

      const html = res.data.html || '';
      setPreviewHtml(html);
      printReportHtml(extractReportBodyHtml(html));
    } catch (err) {
      setError(err.response?.data?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const pageAlerts = (
    <>
      {shellError && <div className="alert alert-warning mb-0">{shellError}</div>}
      {error && <div className="alert alert-danger mb-0">{error}</div>}
    </>
  );

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={shellLoading || dataLoading}
      error={shellError && !settings ? shellError : null}
      onRetry={reloadShell}
      dashboardTitle="Student Report"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
        { label: 'Export Report' },
      ]}
      title="Student Export Report"
      legacy="student_profile_export.php"
      actions={(
        <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
      )}
      notice={(shellError && settings) || error ? pageAlerts : null}
    >
      <div className="cis-student-report-page student-report-page">
        <section className="card cis-student-screen-card mb-3">
          <div className="card-header">Filter</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Course</label>
                <select
                  className="form-select"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                >
                  {(filters?.courseOptions || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  {(filters?.groupedCourses || []).map((group) => (
                    <optgroup key={group.courseName} label={group.courseName}>
                      {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Search by</label>
                <div>
                  <label className="me-3">
                    <input
                      type="radio"
                      name="searchBy"
                      value="batch"
                      checked={searchBy === 'batch'}
                      onChange={() => {
                        setSearchBy('batch');
                        setAcademicYear('All');
                      }}
                    />
                    {' '}Batch
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="searchBy"
                      value="year"
                      checked={searchBy === 'year'}
                      onChange={() => {
                        setSearchBy('year');
                        setAcademicYear('All___');
                      }}
                    />
                    {' '}Year
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">{searchBy === 'year' ? 'Year' : 'Batch'}</label>
                <select
                  className="form-select"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                >
                  {(searchBy === 'year' ? filters?.yearOptions : filters?.batchOptions || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Title</label>
                <input
                  className="form-control"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Options</label>
                <div className="d-flex flex-wrap gap-3">
                  <label>
                    <input
                      type="checkbox"
                      checked={showHeader}
                      onChange={(e) => setShowHeader(e.target.checked)}
                    />
                    {' '}Header
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showSerialNo}
                      onChange={(e) => setShowSerialNo(e.target.checked)}
                    />
                    {' '}S.No.
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">Show</label>
                <div className="d-flex flex-wrap gap-3">
                  {['Regular', 'Discontinue', 'All'].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="discontinued"
                        value={value}
                        checked={discontinued === value}
                        onChange={() => setDiscontinued(value)}
                      />
                      {' '}{value}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={generating}
                onClick={() => generateReport('html')}
              >
                {generating ? 'Generating…' : 'Print'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={generating}
                onClick={() => generateReport('xls')}
              >
                Export XLS
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={clearFields}>
                Clear fields
              </button>
            </div>
          </div>
        </section>

        <div className="row g-3">
          <div className="col-lg-8">
            <section className="card cis-student-screen-card">
              <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>Select required fields</span>
                <div className="d-flex gap-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Custom field name"
                    value={customField}
                    onChange={(e) => setCustomField(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      addField(customField);
                      setCustomField('');
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="card-body report-field-catalog">
                {fieldGroups.map((group) => (
                  <div key={group.name} className="report-field-group">
                    <button
                      type="button"
                      className="report-field-group-title"
                      onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
                    >
                      {group.name}
                      <span className="ms-2 text-white-50 small">({group.fields.length})</span>
                    </button>
                    {expandedGroup === group.name && (
                      <div className="report-field-group-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mb-2"
                          onClick={() => addGroupFields(group)}
                        >
                          Add all
                        </button>
                        <div className="report-field-list">
                          {group.fields.map((field) => (
                            <button
                              key={field}
                              type="button"
                              className="report-field-chip"
                              onClick={() => addField(field)}
                            >
                              {field}
                            </button>
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
            <section className="card cis-student-screen-card">
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
                          <button
                            type="button"
                            onClick={() => moveField(index, 1)}
                            disabled={index === selectedFields.length - 1}
                          >
                            ↓
                          </button>
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
          <section className="card cis-student-report-output mt-3">
            <div className="card-header">Preview</div>
            <div className="card-body p-0">
              <iframe
                title="Student report preview"
                className="student-report-preview-frame"
                srcDoc={previewHtml}
              />
            </div>
          </section>
        )}
      </div>
    </StudentPageShell>
  );
}
