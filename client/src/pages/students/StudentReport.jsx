import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { FormActionBar, FormSection } from '../../components/FormShell';
import { extractReportBodyHtml, printReportHtml } from '../../utils/printReport';
import { cachedGet } from '../../utils/idbCache';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';

export default function StudentReport() {
  const { settings, menu } = useOutletContext();
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
  const [fieldFilter, setFieldFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Field catalog + course/batch options are reference data (changes only when
        // someone adds a course or a new academic year starts), not per-report data —
        // cache them so a refresh doesn't re-pay this round trip every time.
        const payload = await cachedGet(
          'students/reports/builder-meta',
          async () => {
            const [fieldsRes, filtersRes] = await Promise.all([
              api.get('/api/students/reports/fields'),
              api.get('/api/students/reports/filters'),
            ]);
            return { fieldGroups: fieldsRes.data.groups || [], filters: filtersRes.data };
          },
          {
            ttlMs: 24 * 60 * 60_000,
            onCache: (cached) => {
              if (cancelled) return;
              setFieldGroups(cached.fieldGroups);
              setFilters(cached.filters);
              setDataLoading(false);
            },
            onFresh: (fresh) => {
              if (cancelled) return;
              setFieldGroups(fresh.fieldGroups);
              setFilters(fresh.filters);
            },
          },
        );
        if (cancelled) return;
        setFieldGroups(payload.fieldGroups);
        setFilters(payload.filters);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Unable to load report builder');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
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

  const toggleField = (field) => {
    setError(null);
    setSelectedFields((prev) => (
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    ));
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

  // `presetWin` (for format 'html') is a blank window opened synchronously in the button's
  // onClick, before this async function starts — window.open() called after an `await`
  // is no longer considered a direct result of the user's click and gets popup-blocked,
  // which is what produced "Unable to open the print window" here.
  const generateReport = async (format, presetWin) => {
    if (selectedFields.length === 0) {
      presetWin?.close();
      setError('Please select at least one field.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      if (format === 'html') {
        // Same filters + same columns as a previous run → replay instantly from
        // IndexedDB instead of re-querying the DB; a background refetch still runs
        // (unless the cache is still within ttlMs) and quietly updates the on-page
        // preview if the underlying data changed. The actual print only fires once,
        // using whichever data this ends up resolving with — see below.
        const cacheKey = `students/reports/generate:${JSON.stringify(buildPayload())}`;
        const data = await cachedGet(
          cacheKey,
          async () => (await api.post('/api/students/reports/generate', { ...buildPayload(), format })).data,
          {
            ttlMs: 5 * 60_000,
            onCache: (cached) => setPreviewHtml(cached.html || ''),
            onFresh: (fresh) => setPreviewHtml(fresh.html || ''),
          },
        );
        const html = data.html || '';
        setPreviewHtml(html);
        printReportHtml(extractReportBodyHtml(html), 'default', presetWin);
        return;
      }

      const res = await api.post('/api/students/reports/generate', {
        ...buildPayload(),
        format,
      });

      // A download-attribute anchor click isn't treated as a popup, so it isn't subject
      // to the same block — unlike window.open(), it works fine after an await.
      if (res.data.downloadUrl) {
        const link = document.createElement('a');
        link.href = res.data.downloadUrl;
        link.download = res.data.filename || '';
        document.body.appendChild(link);
        link.click();
        link.remove();
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
    } catch (err) {
      presetWin?.close();
      setError(err.response?.data?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const pageAlerts = (
    <>
      {error && <div className="alert alert-danger mb-0">{error}</div>}
    </>
  );

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={dataLoading}
      error={null}
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
      notice={error ? pageAlerts : null}
    >
      <div className="cis-student-report-page student-report-page">
        <FormSection
          id="report-scope"
          title="Report scope"
          description="Choose which cohort of students the report should cover."
        >
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
            <div className="d-flex flex-wrap gap-3 pt-1">
              <label className="d-inline-flex align-items-center gap-2">
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
                Batch
              </label>
              <label className="d-inline-flex align-items-center gap-2">
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
                Year
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
            <label className="form-label">Show</label>
            <div className="d-flex flex-wrap gap-3 pt-1">
              {['Regular', 'Discontinue', 'All'].map((value) => (
                <label key={value} className="d-inline-flex align-items-center gap-2">
                  <input
                    type="radio"
                    name="discontinued"
                    value={value}
                    checked={discontinued === value}
                    onChange={() => setDiscontinued(value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label">Report title</label>
            <input
              className="form-control"
              placeholder="Optional heading shown on the printout"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Print options</label>
            <div className="d-flex flex-wrap gap-3 pt-1">
              <label className="d-inline-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  checked={showHeader}
                  onChange={(e) => setShowHeader(e.target.checked)}
                />
                College header
              </label>
              <label className="d-inline-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  checked={showSerialNo}
                  onChange={(e) => setShowSerialNo(e.target.checked)}
                />
                Serial no. column
              </label>
            </div>
          </div>
        </FormSection>

        <FormSection
          id="report-fields"
          title="Choose columns"
          description="Tick the details you want in the report. Reorder them on the right."
          grid={false}
        >
          <div className="cis-report-picker">
            <div className="cis-report-picker-list">
              <div className="cis-report-search">
                <input
                  className="form-control"
                  placeholder="Search fields…"
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                />
              </div>
              <div className="cis-report-checklist">
                {(() => {
                  const q = fieldFilter.trim().toLowerCase();
                  const groups = fieldGroups
                    .map((g) => ({
                      ...g,
                      shown: q ? g.fields.filter((f) => f.toLowerCase().includes(q)) : g.fields,
                    }))
                    .filter((g) => g.shown.length);
                  if (!groups.length) {
                    return <p className="text-muted small mb-0 px-1">No fields match “{fieldFilter}”.</p>;
                  }
                  return groups.map((group) => {
                    const allIn = group.fields.every((f) => selectedFields.includes(f));
                    return (
                      <div key={group.name} className="cis-report-group">
                        <div className="cis-report-group-head">
                          <span>{group.name}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0"
                            onClick={() => (allIn
                              ? setSelectedFields((prev) => prev.filter((f) => !group.fields.includes(f)))
                              : addGroupFields(group))}
                          >
                            {allIn ? 'Clear group' : 'Select all'}
                          </button>
                        </div>
                        {group.shown.map((field) => (
                          <label key={field} className="cis-report-check">
                            <input
                              type="checkbox"
                              checked={selectedFields.includes(field)}
                              onChange={() => toggleField(field)}
                            />
                            <span>{field}</span>
                          </label>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="cis-report-custom mt-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Add a custom field…"
                  value={customField}
                  onChange={(e) => setCustomField(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addField(customField);
                      setCustomField('');
                    }
                  }}
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

            <div className="cis-report-picker-order">
              <div className="cis-report-order-head">
                <span>Report columns ({selectedFields.length})</span>
                {selectedFields.length > 0 && (
                  <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={clearFields}>
                    Clear all
                  </button>
                )}
              </div>
              {selectedFields.length === 0 ? (
                <div className="cis-report-empty">
                  <span className="cis-report-empty-icon" aria-hidden="true">▤</span>
                  <p className="mb-0">No columns yet — tick fields on the left.</p>
                </div>
              ) : (
                <ol className="report-selected-fields">
                  {selectedFields.map((field, index) => (
                    <li key={`${field}-${index}`}>
                      <span className="report-selected-index">{index + 1}</span>
                      <span className="report-selected-name">{field}</span>
                      <span className="report-selected-actions">
                        <button type="button" title="Move up" onClick={() => moveField(index, -1)} disabled={index === 0}>↑</button>
                        <button
                          type="button"
                          title="Move down"
                          onClick={() => moveField(index, 1)}
                          disabled={index === selectedFields.length - 1}
                        >
                          ↓
                        </button>
                        <button type="button" title="Remove" onClick={() => removeField(index)}>×</button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </FormSection>

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

        <FormActionBar
          note={selectedFields.length === 0
            ? 'Select at least one field to generate a report.'
            : `${selectedFields.length} column${selectedFields.length === 1 ? '' : 's'} selected`}
        >
          <button type="button" className="btn btn-outline-secondary" onClick={clearFields}>
            Clear fields
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={generating}
            onClick={() => generateReport('xls')}
          >
            Export XLS
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={generating}
            onClick={() => generateReport('html', window.open('', '_blank'))}
          >
            {generating ? 'Generating…' : 'Print report'}
          </button>
        </FormActionBar>
      </div>
    </StudentPageShell>
  );
}
