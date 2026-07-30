import { useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { printReportHtml } from '../../utils/printReport';
import AlumniEditPanel from './AlumniEditPanel';
import AlumniIdCardPanel from './AlumniIdCardPanel';
import AddressLabelPanel from './AddressLabelPanel';
import CollageGeneratePanel from './CollageGeneratePanel';
import CollageImagePanel from './CollageImagePanel';
import PromotePanel from './PromotePanel';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';
import { STUDENT_SCREEN_META } from './studentModuleMeta';
import { useStudentScreenApi } from './useStudentModuleApi';
import DataTable from '../../components/DataTable';

const SAVE_SCREENS = new Set([
  'photo-upload',
  'attachments-upload',
  'attachments-view',
  'temp-admission-add',
  'temp-admission-edit',
  'academic-promotion',
  'collage-image',
]);

const ATTACHMENT_UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.gif,.doc,.docx,.pdf';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StudentAttachmentsPanel({ data, busy, onLoad, onSave, searchMore, readOnly, autoLoadStudentId }) {
  const [q, setQ] = useState('');
  const catalog = data?.catalog;
  const [items, setItems] = useState([]);
  const [fileUrls, setFileUrls] = useState({});
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Deep-link support: the attachments report links straight to a student's
  // upload/view screen via ?studentId=, instead of forcing a manual re-search.
  useEffect(() => {
    if (autoLoadStudentId) onLoad({ studentId: autoLoadStudentId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadStudentId]);

  useEffect(() => {
    if (catalog?.types) {
      setItems(catalog.types.map((t) => ({
        attachId: t.attachId,
        attachNo: t.attachNo || '',
        attachFile: t.attachFile || '',
        recordId: t.recordId,
      })));
      setFileUrls(Object.fromEntries(catalog.types.map((t, i) => [i, t.fileUrl || null])));
    }
  }, [catalog]);

  const handleFile = async (index, file) => {
    if (!file || !catalog) return;
    setUploadingIndex(index);
    setUploadError(null);
    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await api.post(`/api/students/${catalog.studentId}/attachments/upload`, {
        filename: file.name,
        dataBase64,
      });
      setItems((p) => p.map((r, j) => (j === index ? { ...r, attachFile: res.data.filename } : r)));
      setFileUrls((p) => ({ ...p, [index]: res.data.url }));
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by register no..." /></div>
        <div className="col-md-2">
          <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={async () => {
            const res = await searchMore({ by: 'roll', q });
            const first = (Array.isArray(res) ? res : res?.students || [])[0];
            if (first) onLoad({ studentId: first.id });
          }}>Search</button>
        </div>
      </div>
      {catalog && (
        <form onSubmit={(e) => { e.preventDefault(); if (!readOnly) onSave({ studentId: catalog.studentId, items }); }}>
          <p><strong>Student #{catalog.studentId}</strong></p>
          {!readOnly && <p className="text-muted small">Supported: jpg, png, gif, doc, docx, pdf</p>}
          {uploadError && <div className="alert alert-danger py-2">{uploadError}</div>}
          <div className="table-responsive cis-dt-wrap">
            <table className="cis-dt-table table-sm">
              <thead><tr><th>Attachment</th><th>Number</th><th>File</th></tr></thead>
              <tbody>
                {catalog.types.map((t, i) => (
                  <tr key={t.attachId}>
                    <td>{t.name}</td>
                    <td>
                      <input className="form-control form-control-sm" readOnly={readOnly} value={items[i]?.attachNo || ''} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, attachNo: e.target.value } : r))} />
                    </td>
                    <td>
                      {fileUrls[i]
                        ? <a href={fileUrls[i]} target="_blank" rel="noreferrer">{items[i]?.attachFile || 'View'}</a>
                        : <span className="text-muted small">No file</span>}
                      {!readOnly && (
                        <input
                          type="file"
                          className="form-control form-control-sm mt-1"
                          accept={ATTACHMENT_UPLOAD_ACCEPT}
                          disabled={uploadingIndex === i}
                          onChange={(e) => handleFile(i, e.target.files?.[0])}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && <button type="submit" className="btn btn-primary" disabled={busy || uploadingIndex !== null}>Save Attachments</button>}
        </form>
      )}
    </div>
  );
}

const ATTACHMENT_STATUS = {
  pending: { label: 'Pending', className: 'bg-danger-soft' },
  in_review: { label: 'In Review', className: 'bg-info-soft' },
  complete: { label: 'Complete', className: 'bg-success-soft' },
};

function AttachmentStatusBadge({ status }) {
  const meta = ATTACHMENT_STATUS[status] || ATTACHMENT_STATUS.pending;
  return <span className={`badge cis-attachment-status ${meta.className}`}>{meta.label}</span>;
}

function AttachmentsReportPanel({ data, busy, onGenerate }) {
  const [searchBy, setSearchBy] = useState('roll_no');
  const [searchInput, setSearchInput] = useState('');
  const [searchCourse, setSearchCourse] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate({ search_by: searchBy, search_input: searchInput, search_course: searchCourse, Submit: 'Generate' });
  };

  const columns = [
    { key: 'sno', header: 'S.No', width: '4rem', render: (row, displayIndex) => displayIndex + 1 },
    { key: 'registerNo', header: 'Register No', primary: true, sortable: true, searchField: true, numeric: true, render: (row) => row.registerNo },
    { key: 'name', header: 'Full Name', sortable: true, searchField: true, render: (row) => row.name },
    { key: 'fileCount', header: 'File Count', align: 'center', sortable: true, numeric: true, render: (row) => row.fileCount },
    { key: 'status', header: 'Status', align: 'center', sortable: true, sortValue: (row) => row.status, render: (row) => <AttachmentStatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <div className="d-flex justify-content-end gap-2">
          {row.fileCount === 0 ? (
            <Link to={`/students/attachments-upload?studentId=${row.id}`} className="cis-attachment-action">Upload</Link>
          ) : (
            <Link to={`/students/attachments-view?studentId=${row.id}`} className="cis-attachment-action">View All</Link>
          )}
          <Link to={`/students/${row.id}`} className="cis-attachment-action-icon" title="Open student profile" aria-label="Open student profile">
            <i className="fa fa-eye" aria-hidden="true" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="cis-page">
      <section className="cis-formsection">
        <header className="cis-formsection-head">
          <h2 className="cis-formsection-title"><i className="fa fa-filter me-2" aria-hidden="true" />Report Filters</h2>
        </header>
        <form className="cis-formsection-body row g-3" onSubmit={handleSubmit}>
          <div className="col-md-3">
            <label className="form-label" htmlFor="ar-search-by">Search by</label>
            <select
              id="ar-search-by"
              className="form-select"
              value={searchBy}
              onChange={(e) => {
                setSearchBy(e.target.value);
                setSearchInput('');
                setSearchCourse('');
              }}
            >
              <option value="roll_no">Register No</option>
              <option value="batch">Batch</option>
            </select>
          </div>
          {searchBy === 'roll_no' && (
            <div className="col-md-5">
              <label className="form-label" htmlFor="ar-search-input">Register nos / batch value</label>
              <input
                id="ar-search-input"
                className="form-control"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Register nos (comma) or batch value"
              />
            </div>
          )}
          {searchBy === 'batch' && (
            <div className="col-md-5">
              <label className="form-label" htmlFor="ar-search-course">Course / batch</label>
              <select id="ar-search-course" className="form-select" value={searchCourse} onChange={(e) => setSearchCourse(e.target.value)}>
                <option value="">Course / batch</option>
                {(data?.courses || []).flatMap((c) => (c.batchOptions || []).map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                )))}
              </select>
            </div>
          )}
          <div className="col-md-4 d-flex align-items-end">
            <button type="submit" className="btn btn-primary text-nowrap w-100" disabled={busy}>
              <i className="fa fa-refresh me-1" aria-hidden="true" />
              Generate Report
            </button>
          </div>
        </form>
      </section>

      {data?.students && (
        <section className="card cis-student-report-output">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h2 className="cis-dt-title mb-0">Student Attachments Report</h2>
            <span className="cis-dt-count">
              {data.students.length}
              {data.students.length === 1 ? ' student' : ' students'}
            </span>
          </div>
          <div className="card-body">
            <DataTable
              columns={columns}
              rows={data.students}
              getRowKey={(row) => row.id}
              loading={busy}
              caption="Student Attachments Report"
              searchable={data.students.length > 8}
              searchPlaceholder="Filter by register no or name…"
              pageSize={10}
              empty={{ icon: 'fa fa-folder-open-o', title: 'No students found', message: 'Adjust the filters and generate the report again.' }}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function formFieldsFromDom(formEl, state) {
  const fd = new FormData(formEl);
  const fromForm = {};
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) continue;
    fromForm[key] = value;
  }
  return { ...state, ...fromForm };
}

function PhotoBulkUploadFields({ busy, onSave }) {
  const [items, setItems] = useState([]);
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const handleFiles = async (e) => {
    const files = [...(e.target.files || [])];
    setResults(null);
    const read = await Promise.all(files.map((f) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, data: reader.result });
      reader.readAsDataURL(f);
    })));
    setItems(read);
  };

  const handleSave = async () => {
    if (!items.length) return;
    setSaving(true);
    try {
      const result = await onSave({ files: items });
      if (result?.results) setResults(result.results);
      if (result?.success) {
        setItems([]);
        setInputKey((k) => k + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col-12 cis-photo-bulk-upload mt-3 pt-3 border-top">
      <p className="cis-screen-filters-head mb-2">Bulk upload — file name is the register no (e.g. 24CSE001.jpg)</p>
      <div className="row g-3">
        <div className="col-md-8">
          <input
            key={inputKey}
            type="file"
            className="form-control"
            accept=".png,.jpg,.jpeg"
            multiple
            onChange={handleFiles}
          />
          {items.length > 0 && <p className="small text-muted mt-1 mb-0">{items.length} file(s) selected</p>}
        </div>
        <div className="col-md-4 d-flex align-items-start">
          <button
            type="button"
            className="btn btn-primary w-100"
            disabled={busy || saving || !items.length}
            onClick={handleSave}
          >
            {saving ? 'Uploading…' : `Upload ${items.length || ''} photo${items.length === 1 ? '' : 's'}`.trim()}
          </button>
        </div>
      </div>
      {results && (
        <ul className="list-unstyled small mt-2 mb-0">
          {results.map((r, i) => (
            <li key={`${r.name}-${i}`} className={r.success ? 'text-success' : 'text-danger'}>
              {r.name} {r.success ? `→ saved as ${r.savedAs}` : `— ${r.error}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhotoUploadFields({ busy, searchMore, onSave }) {
  const [regNo, setRegNo] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [student, setStudent] = useState(null);
  const [file, setFile] = useState(null);

  const runSearch = async () => {
    const q = regNo.trim();
    if (q.length < 3) {
      setSearchError('Type at least 3 digits of the register no.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setMatches([]);
    setStudent(null);
    try {
      const res = await searchMore({ by: 'roll', q });
      const list = Array.isArray(res) ? res : res?.students || [];
      if (!list.length) setSearchError('No student found for that register no.');
      else if (list.length === 1) setStudent(list[0]);
      else setMatches(list);
    } catch {
      setSearchError('Unable to search for that student.');
    } finally {
      setSearching(false);
    }
  };

  const pickStudent = (s) => {
    setStudent(s);
    setMatches([]);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, data: reader.result });
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!student || !file) return;
    const result = await onSave({ registerNo: student.registerNo, file });
    if (result?.success) {
      setFile(null);
      setRegNo('');
      setStudent(null);
    }
  };

  return (
    <>
      <div className="col-md-5">
        <label className="form-label">Register no</label>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            value={regNo}
            placeholder="Register no (min 3 digits)"
            onChange={(e) => setRegNo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
          />
          <button type="button" className="btn btn-outline-primary text-nowrap" disabled={busy || searching || regNo.trim().length < 3} onClick={runSearch}>
            {searching ? 'Searching…' : 'Find student'}
          </button>
        </div>
        {searchError && <p className="text-danger small mt-1 mb-0">{searchError}</p>}
        {matches.length > 0 && (
          <ul className="list-group mt-1">
            {matches.map((m) => (
              <li key={m.id} className="list-group-item list-group-item-action p-2">
                <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => pickStudent(m)}>
                  {m.name} ({m.registerNo})
                </button>
              </li>
            ))}
          </ul>
        )}
        {student && (
          <p className="small mt-1 mb-0">
            Selected: <strong>{student.name}</strong> ({student.registerNo})
          </p>
        )}
      </div>
      <div className="col-md-5">
        <label className="form-label">Photo (PNG/JPG, any file name)</label>
        <input type="file" className="form-control" accept=".png,.jpg,.jpeg" disabled={!student} onChange={handleFile} />
      </div>
      <div className="col-md-2 d-flex align-items-end">
        <button type="button" className="btn btn-primary w-100" disabled={busy || !student || !file} onClick={handleSave}>
          Save
        </button>
      </div>
    </>
  );
}

function ScreenFilters({ screen, meta, data, onGenerate, onSave, busy, searchMore }) {
  const [fields, setFields] = useState({});
  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const searchBy = fields.search_by || 'roll_no';
  const studentSearch = (
    <>
      <div className="col-md-2">
        <label className="form-label">Search by</label>
        <select className="form-select" name="search_by" value={searchBy} onChange={(e) => set('search_by', e.target.value)}>
          <option value="roll_no">Register No</option>
          <option value="batch">Batch</option>
        </select>
      </div>
      {searchBy === 'roll_no' && (
        <div className="col-md-4">
          <label className="form-label">Register nos / batch value</label>
          <input
            className="form-control"
            name="search_input"
            placeholder="Register no (min 3 digits) or comma-separated list"
            value={fields.search_input || ''}
            onChange={(e) => set('search_input', e.target.value)}
          />
        </div>
      )}
      {searchBy === 'batch' && (
        <div className="col-md-3">
          <label className="form-label">Course / batch</label>
          <select
            className="form-select"
            name="search_course"
            value={fields.search_course || ''}
            onChange={(e) => set('search_course', e.target.value)}
          >
            <option value="">Course / batch</option>
            {(data?.courses || []).flatMap((c) => (c.batchOptions || []).map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            )))}
          </select>
        </div>
      )}
    </>
  );

  return (
    <form className="row g-3 mb-3 cis-screen-filters" onSubmit={(e) => {
      e.preventDefault();
      const submitAction = meta.type === 'alumni-filter' ? 'Search' : 'Generate';
      const payload = { ...formFieldsFromDom(e.currentTarget, fields), Submit: submitAction };
      if (SAVE_SCREENS.has(screen)) onSave(payload);
      else onGenerate(payload);
    }}>
      <div className="col-12">
        <p className="cis-screen-filters-head">{meta.type === 'upload' ? 'Upload' : 'Filters'}</p>
      </div>
      {(meta.type === 'student-search-report' || meta.type === 'course-report') && studentSearch}
      {meta.type === 'course-year-report' && (
        <>
          <div className="col-md-4">
            <label className="form-label">Course / batch</label>
            <select className="form-select" onChange={(e) => set('search_course', e.target.value)}>
              <option value="">Course / batch</option>
              {(data?.courses || []).flatMap((c) => (c.batchOptions || []).map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              )))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Year</label>
            <input className="form-control" placeholder="Year" onChange={(e) => set('search_year', e.target.value)} />
          </div>
        </>
      )}
      {meta.type === 'application-report' && (
        <div className="col-md-4">
          <label className="form-label">Application no</label>
          <input className="form-control" placeholder="Application no" onChange={(e) => set('application_no', e.target.value)} />
        </div>
      )}
      {meta.type === 'upload' && (
        <>
          <PhotoUploadFields busy={busy} searchMore={searchMore} onSave={onSave} />
          <PhotoBulkUploadFields busy={busy} onSave={onSave} />
        </>
      )}
      {meta.type === 'alumni-search' && (
        <>
          <div className="col-md-2">
            <label className="form-label">From date</label>
            <input type="date" className="form-control" value={fields.from_date || ''} max={fields.to_date || undefined} onChange={(e) => set('from_date', e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">To date</label>
            <input type="date" className="form-control" value={fields.to_date || ''} min={fields.from_date || undefined} onChange={(e) => set('to_date', e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Find</label>
            <input className="form-control" placeholder="Find" onChange={(e) => set('find', e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Field</label>
            <select className="form-select" onChange={(e) => set('field', e.target.value)}>
              <option value="">Field</option>
              {Object.entries(data?.fieldLabels || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </>
      )}
      {meta.type === 'alumni-filter' && (
        <>
          <div className="col-12"><div className="cis-student-filter-heading">Filter</div></div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">From date</label>
            <input
              type="date"
              name="from_date"
              className="form-control"
              value={fields.from_date ?? data?.filters?.from_date ?? ''}
              max={fields.to_date ?? data?.filters?.to_date ?? undefined}
              onChange={(e) => set('from_date', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">To date</label>
            <input
              type="date"
              name="to_date"
              className="form-control"
              value={fields.to_date ?? data?.filters?.to_date ?? ''}
              min={fields.from_date ?? data?.filters?.from_date ?? undefined}
              onChange={(e) => set('to_date', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">Year of pass</label>
            <select
              name="a_year"
              className="form-select"
              value={fields.a_year ?? data?.filters?.a_year ?? ''}
              onChange={(e) => set('a_year', e.target.value)}
            >
              <option value="">Year of pass</option>
              {(data?.yopOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small text-muted mb-1">Course</label>
            <select
              name="a_class"
              className="form-select"
              value={fields.a_class ?? data?.filters?.a_class ?? ''}
              onChange={(e) => set('a_class', e.target.value)}
            >
              <option value="">Select course</option>
              {(data?.courseOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {meta.type === 'alumni-find' && (
        <div className="col-md-4">
          <label className="form-label">Name or register no</label>
          <input className="form-control" name="find" placeholder="Name or reg no" onChange={(e) => set('find', e.target.value)} />
        </div>
      )}
      {meta.type === 'temp-form' && (
        <>
          <div className="col-md-3">
            <label className="form-label">Application no *</label>
            <input className="form-control" placeholder="Application no" onChange={(e) => set('application_no', e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Student name</label>
            <input className="form-control" placeholder="Student name" onChange={(e) => set('student_name', e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Register no</label>
            <input className="form-control" placeholder="Register no" onChange={(e) => set('register_no', e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Mobile</label>
            <input className="form-control" placeholder="Mobile" onChange={(e) => set('mobile_no', e.target.value)} />
          </div>
        </>
      )}
      {meta.type === 'temp-form-search' && (
        <>
          <div className="col-md-3">
            <label className="form-label">Application no</label>
            <input className="form-control" placeholder="Application no" onChange={(e) => set('application_no', e.target.value)} />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => onGenerate({ application_no: fields.application_no })}>Load</button>
          </div>
          {data?.profile && (
            <>
              <div className="col-md-3">
                <label className="form-label">Name</label>
                <input className="form-control" defaultValue={data.profile.studentName} placeholder="Name" onChange={(e) => set('student_name', e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Register no</label>
                <input className="form-control" defaultValue={data.profile.registerNo} placeholder="Register no" onChange={(e) => set('register_no', e.target.value)} />
              </div>
              <input type="hidden" value={data.profile.id} onChange={() => set('student_id', data.profile.id)} />
            </>
          )}
        </>
      )}
      {meta.type === 'academic-form' && (
        <>
          <div className="col-md-3">
            <label className="form-label">Register no</label>
            <input className="form-control" placeholder="Register no" onChange={(e) => set('register_no', e.target.value)} />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => onGenerate({ register_no: fields.register_no })}>Load</button>
          </div>
        </>
      )}
      {meta.type === 'alumni-form' && (
        <>
          <div className="col-md-3">
            <label className="form-label">Alumni reg no</label>
            <input className="form-control" placeholder="Alumni reg no" onChange={(e) => set('reg_no', e.target.value)} />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => onGenerate({ reg_no: fields.reg_no })}>Load</button>
          </div>
        </>
      )}
      {!['attachments', 'attachments-view', 'collage-image', 'alumni-form', 'promote-form', 'upload'].includes(meta.type) && (
        <div className="col-md-2 d-flex align-items-end">
          <button type="submit" className="btn btn-primary w-100" disabled={busy}>
            {SAVE_SCREENS.has(screen) ? 'Save' : meta.type === 'alumni-filter' ? 'Search' : 'Generate'}
          </button>
        </div>
      )}
    </form>
  );
}

export default function StudentScreenPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const studentIdParam = searchParams.get('studentId');
  const pathSlug = location.pathname.replace(/^\/students\//, '');
  const screen = STUDENT_SCREEN_META[pathSlug] ? pathSlug : null;
  const meta = screen ? STUDENT_SCREEN_META[screen] : null;
  const { data, busy, error, notice, load, save, searchMore } = useStudentScreenApi(screen || 'id-card');
  const { settings, menu } = useOutletContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) {
      setReady(true);
      return;
    }
    setReady(false);
    load().finally(() => setReady(true));
  }, [screen, meta, load]);

  const pageLoading = meta && !ready;

  const hasAlerts = Boolean(notice || error);

  if (!meta) {
    return (
      <StudentPageShell
        settings={settings}
        menu={menu}
        loading={false}
        error={null}
        dashboardTitle="Student"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          STUDENT_BREADCRUMB_HUB,
          { label: 'Screen' },
        ]}
        title="Unknown screen"
      >
        <div className="alert alert-danger mb-3">Unknown student screen.</div>
        <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Back to module hub</Link>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={pageLoading}
      error={null}
      dashboardTitle={meta.title}
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
        { label: meta.title },
      ]}
      title={meta.title}
      legacy={meta.legacy}
      actions={(
        data?.reportHtml && screen !== 'alumni-id-card' ? (
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => printReportHtml(data.reportHtml)}
          >
            Print
          </button>
        ) : null
      )}
      notice={hasAlerts ? (
        <>
          {notice && <div className="alert alert-success mb-0">{notice}</div>}
          {error && <div className="alert alert-danger mb-0">{error}</div>}
        </>
      ) : null}
    >
      {screen === 'attachments-report' ? (
        <AttachmentsReportPanel data={data} busy={busy} onGenerate={load} />
      ) : screen === 'alumni-edit' ? (
        <AlumniEditPanel data={data} busy={busy} onLoad={load} onSave={save} />
      ) : screen === 'alumni-id-card' ? (
        <AlumniIdCardPanel data={data} busy={busy} onGenerate={load} />
      ) : screen === 'collage-generate' ? (
        <CollageGeneratePanel data={data} busy={busy} onGenerate={load} />
      ) : screen === 'collage-image' ? (
        <CollageImagePanel data={data} busy={busy} onSave={save} onReload={load} />
      ) : (
      <div className="card cis-student-screen-card mb-3">
        <div className="card-body">
          {screen === 'promote' && (
            <PromotePanel data={data} busy={busy} onReload={load} onPromote={save} />
          )}
          {screen === 'address-label' && (
            <AddressLabelPanel data={data} busy={busy} onGenerate={load} />
          )}
          {screen !== 'promote' && screen !== 'address-label' && screen !== 'alumni-id-card' && screen !== 'collage-generate' && screen !== 'collage-image' && meta.type !== 'attachments' && meta.type !== 'attachments-view' && meta.type !== 'collage-image' && (
            <ScreenFilters screen={screen} meta={meta} data={data} busy={busy} onGenerate={load} onSave={save} searchMore={searchMore} />
          )}
          {(screen === 'attachments-upload' || screen === 'attachments-view') && (
            <StudentAttachmentsPanel
              data={data}
              busy={busy}
              onLoad={load}
              onSave={save}
              searchMore={searchMore}
              readOnly={screen === 'attachments-view'}
              autoLoadStudentId={studentIdParam}
            />
          )}
          {meta.type === 'academic-form' && data?.academics?.length > 0 && (
            <div className="table-responsive cis-dt-wrap mt-3">
              <table className="cis-dt-table table-sm">
                <thead><tr><th>Year</th><th>Batch</th><th>Current Year</th><th>Type</th><th>Register</th></tr></thead>
                <tbody>
                  {data.academics.map((a) => (
                    <tr key={a.id}><td>{a.academicYear}</td><td>{a.academicBatch}</td><td>{a.currentYear}</td><td>{a.academicType}</td><td>{a.registerNo}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      {data?.reportHtml && meta.type !== 'upload' && screen !== 'alumni-id-card' && screen !== 'attachments-report' && (
        <div className="card cis-student-report-output">
          <div className="card-body report-html" dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
        </div>
      )}
    </StudentPageShell>
  );
}
