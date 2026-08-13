import { useEffect, useState, Fragment } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { Breadcrumbs, PageHeader, PageLoading } from '../../components/PageShell';
import DashboardLayout from '../../layouts/DashboardLayout';
import SearchableSelect from '../../components/SearchableSelect';

function StudentDetail({ detail }) {
  if (!detail) {
    return <p className="text-danger">No details found...</p>;
  }

  const { student, seminars, publications } = detail;

  return (
    <div>
      <section className="card mb-3">
        <div className="card-header">Student</div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-8">
              <div className="mb-2"><strong>Name:</strong> {student.name}</div>
              <div className="mb-2"><strong>Roll No:</strong> {student.registerNo}</div>
              <div><strong>Course:</strong> {student.academicYear} | {student.courseName}</div>
            </div>
            <div className="col-md-4 text-center">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.name} width={80} height={100} />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="card mb-3">
        <div className="card-header">Seminars &amp; Conference</div>
        <div className="card-body table-responsive">
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Particular</th>
                <th>Type</th>
                <th>Location</th>
                <th>From - To Date</th>
                <th>Web Links</th>
              </tr>
            </thead>
            <tbody>
              {seminars.length ? seminars.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.particular}</td>
                  <td>{row.type}</td>
                  <td>{row.location}</td>
                  <td>{row.fromDate}{row.toDate ? ` to ${row.toDate}` : ''}</td>
                  <td>
                    {row.links.map((link, j) => (
                      <a key={j} href={link} target="_blank" rel="noreferrer" className="me-2">
                        Link{j + 1}
                      </a>
                    ))}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-muted">No records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">Publications</div>
        <div className="card-body table-responsive">
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Journal</th>
                <th>Name of Publication &amp; Title</th>
                <th>Title of the Paper &amp; Author Name</th>
                <th>Location</th>
                <th>Month &amp; Year</th>
                <th>Volume &amp; Page No</th>
                <th>Points</th>
                <th>Category</th>
                <th>Authorship</th>
                <th>Web Links</th>
                <th>Attachment</th>
              </tr>
            </thead>
            <tbody>
              {publications.length ? publications.map((row, i) => (
                <Fragment key={i}>
                  <tr key={`${i}-a`}>
                    <td rowSpan={2}>{i + 1}</td>
                    <td>{row.journal}</td>
                    <td>{row.publicationName}<br /><strong>{row.title}</strong></td>
                    <td>{row.author}</td>
                    <td>{row.location}</td>
                    <td>{row.monthYear}</td>
                    <td>{row.volumePage}</td>
                    <td>{row.points}</td>
                    <td>{row.category}</td>
                    <td>{row.authorship}</td>
                    <td rowSpan={2}>
                      {row.links.map((link, j) => (
                        <a key={j} href={link} target="_blank" rel="noreferrer" className="d-block">
                          Link{j + 1}
                        </a>
                      ))}
                    </td>
                    <td rowSpan={2}>
                      {row.attachment ? (
                        <a href={row.attachment} target="_blank" rel="noreferrer">view</a>
                      ) : null}
                    </td>
                  </tr>
                  <tr key={`${i}-b`}>
                    <td colSpan={9}>{row.abstract}</td>
                  </tr>
                </Fragment>
              )) : (
                <tr><td colSpan={12} className="text-muted">No records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function PortfolioIndividualReportPage() {
  const { settings, menu } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({
    searchBy: 'roll_no',
    searchInput: '',
    searchCourse: '',
    studentId: null,
  });

  const load = async (payload = {}) => {
    setBusy(true);
    const nextFields = { ...fields, ...payload };
    const reportRes = await api.post('/api/portfolio/individual-report/load', { fields: nextFields });
    setData(reportRes.data);
    setFields({
      searchBy: reportRes.data.searchBy,
      searchInput: reportRes.data.searchInput,
      searchCourse: reportRes.data.searchCourse,
      studentId: reportRes.data.studentId,
    });
    setLoading(false);
    setBusy(false);
  };

  const selectStudent = async (studentId) => {
    setBusy(true);
    try {
      const res = await api.get(`/api/portfolio/individual-report/student/${studentId}`);
      setData((prev) => ({
        ...prev,
        studentId,
        students: (prev?.students || []).map((s) => ({ ...s, selected: s.id === studentId })),
        detail: res.data.detail,
      }));
      setFields((prev) => ({ ...prev, studentId }));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <DashboardLayout settings={settings} menu={menu}><PageLoading /></DashboardLayout>;

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <Breadcrumbs items={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Student Portfolio', to: '/portfolio' },
        { label: 'Portfolia Report' },
      ]} />
      <PageHeader
        title="Portfolia Report"
        actions={<Link to="/portfolio" className="btn btn-outline-secondary btn-sm">Back</Link>}
      />

      <div className="row">
        <div className="col-lg-3">
          <section className="card">
            <div className="card-header">Filter</div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Search By</label>
                <div>
                  <label className="me-3">
                    <input className="me-2"
                      type="radio"
                      name="searchBy"
                      value="roll_no"
                      checked={fields.searchBy === 'roll_no'}
                      onChange={() => setFields({ ...fields, searchBy: 'roll_no' })}
                    />
                    {' '}Roll No
                  </label>
                  <label>
                    <input className="me-2"
                      type="radio"
                      name="searchBy"
                      value="batch"
                      checked={fields.searchBy === 'batch'}
                      onChange={() => setFields({ ...fields, searchBy: 'batch' })}
                    />
                    {' '}Batch
                  </label>
                </div>
              </div>

              {fields.searchBy === 'roll_no' ? (
                <div className="input-group mb-3">
                  <input
                    className="form-control"
                    placeholder="Roll No. separated by ,"
                    value={fields.searchInput}
                    onChange={(e) => setFields({ ...fields, searchInput: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-info"
                    disabled={busy}
                    onClick={() => load({ searchInput: fields.searchInput, studentId: null })}
                  >
                    Go
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  <SearchableSelect
                    groups={(data?.courseOptions || []).map((course) => ({
                      label: `${course.courseName} | ${course.label}`,
                      options: course.batchOptions,
                    }))}
                    value={fields.searchCourse}
                    onChange={(val) => load({ searchCourse: val, studentId: null })}
                    placeholder="--Select--"
                    searchPlaceholder="Search course / batch..."
                  />
                </div>
              )}

              <div className="d-flex flex-column gap-1">
                {busy && !data?.students?.length ? <span className="text-muted">Loading...</span> : null}
                {(data?.students || []).map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className={`btn btn-sm text-start ${student.selected ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => selectStudent(student.id)}
                  >
                    {student.registerNo} - {student.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="col-lg-9">
          {busy && data?.detail ? <p className="text-muted">Loading...</p> : null}
          <StudentDetail detail={data?.detail} />
        </div>
      </div>
    </DashboardLayout>
  );
}
