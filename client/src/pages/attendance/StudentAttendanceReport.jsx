import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import ReportPrintBar from '../../components/ReportPrintBar';
import ChipMultiSelect from '../../components/ChipMultiSelect';
import DashboardLayout from '../../layouts/DashboardLayout';
import { buildAttendanceReportPrintHtml } from '../../utils/attendanceReportPrint';
import '../students/StudentReport.css';

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function defaultFromDate(monthsBack) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function mergeReportRows(html, rowsByFlag) {
  let result = html;
  Object.entries(rowsByFlag || {}).forEach(([flag, rows]) => {
    if (!rows) return;
    result = result.replace(
      new RegExp(`(<table[^>]*id="payroll_${flag}"[\\s\\S]*?<tbody>)([\\s\\S]*?)(</tbody>)`, 'i'),
      `$1$2${rows}$3`,
    );
  });
  return result;
}

export default function StudentAttendanceReport({ variant = 'standard' }) {
  const isQuarterly = variant === 'quarterly';
  const { settings, menu } = useOutletContext();
  const [academicYears, setAcademicYears] = useState([]);
  const [courseGroups, setCourseGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [fromDate, setFromDate] = useState(() => defaultFromDate(isQuarterly ? 2 : 1));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState('Monthly');
  const [html, setHtml] = useState('');
  const [printMeta, setPrintMeta] = useState(null);
  const [bannerUrl, setBannerUrl] = useState('');

  const loadFilters = useCallback(async (year, courses = []) => {
    setLoadingFilters(true);
    try {
      const res = await api.post('/api/attendance/students/report/filters', {
        academicYear: year,
        courses,
      });
      setCourseGroups(res.data.courses || []);
      setSubjects(res.data.subjects || []);
      setError(null);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load filters');
      return null;
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const yearsRes = await api.get('/api/attendance/students/report/years');
        const year = yearsRes.data.defaultAcademicYear || yearsRes.data.academicYears?.[0] || '';
        setAcademicYears(yearsRes.data.academicYears || []);
        setAcademicYear(year);
        if (year) {
          await loadFilters(year);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadFilters]);

  const changeCourses = (next) => {
    setSelectedCourses(next);
    setSelectedSubjects([]);
    loadFilters(academicYear, next);
  };

  const changeAcademicYear = async (year) => {
    setAcademicYear(year);
    setSelectedCourses([]);
    setSelectedSubjects([]);
    await loadFilters(year);
  };

  const generate = async (e) => {
    e.preventDefault();
    if (!selectedCourses.length || !selectedSubjects.length) {
      setError('Select at least one course and one subject');
      return;
    }
    setGenerating(true);
    setError(null);
    setHtml('');
    setPrintMeta(null);
    setBannerUrl('');
    setProgress(null);
    try {
      const setupRes = await api.post('/api/attendance/students/report/setup', {
        academicYear,
        courses: selectedCourses,
        subjects: selectedSubjects,
        fromDate: toDisplayDate(fromDate),
        toDate: toDisplayDate(toDate),
        reportType,
        variant: isQuarterly ? 'quarterly' : 'standard',
      });
      const setup = setupRes.data;
      const total = setup.jobs?.length || 0;
      if (!total) {
        setError('No students found for the selected filters');
        return;
      }

      const batchSize = 10;
      let offset = 0;
      let mergedHtml = setup.headerHtml || '';

      setProgress({ processed: 0, total, phase: 'preparing' });

      while (offset < total) {
        setProgress({ processed: offset, total, phase: 'generating' });
        const genRes = await api.post('/api/attendance/students/report/generate', {
          setup,
          offset,
          limit: batchSize,
          clearCache: offset === 0,
          variant: isQuarterly ? 'quarterly' : 'standard',
        });
        mergedHtml = mergeReportRows(mergedHtml, genRes.data.rowsByFlag);
        offset = genRes.data.nextOffset ?? offset + batchSize;
        if (!genRes.data.truncated) break;
      }

      setHtml(mergedHtml);
      setPrintMeta(setup.printMeta || null);
      setBannerUrl(setup.bannerUrl || '');
      setProgress({ processed: total, total, phase: 'done' });
    } catch (err) {
      setError(err.response?.data?.message || 'Report failed');
      setHtml('');
    } finally {
      setGenerating(false);
    }
  };

  const buildPrintHtml = () => {
    if (!printMeta) return html;
    return buildAttendanceReportPrintHtml({
      title: printMeta.title,
      subtitleLine1: printMeta.subtitleLine1,
      dateRange: printMeta.dateRange,
      bannerUrl,
      tablesHtml: html,
      singleCourse: printMeta.singleCourse,
    });
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
          <li className="breadcrumb-item active">
            {isQuarterly ? 'Student Quarterly Report' : 'Student Subject Report'}
          </li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">
          {isQuarterly ? 'Student Quarterly Attendance Report' : 'Student Subject-wise Attendance Report'}
        </h4>
        <Link to="/attendance" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {generating && progress && (
        <div className="alert alert-info">
          {progress.phase === 'preparing'
            ? 'Preparing report…'
            : `Generating report… ${progress.processed} / ${progress.total} students`}
        </div>
      )}
      <form className="card mb-3" onSubmit={generate}>
        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label">Academic Year</label>
              <select
                className="form-select"
                value={academicYear}
                onChange={(e) => changeAcademicYear(e.target.value)}
              >
                {academicYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {!isQuarterly && (
              <div className="col-md-2">
                <label className="form-label">Report Type</label>
                <select className="form-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option value="Monthly">Monthly</option>
                  <option value="Consolidated">Consolidated</option>
                </select>
              </div>
            )}
            <div className="col-md-2">
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Courses {loadingFilters && <span className="text-muted small">(loading…)</span>}</label>
            <ChipMultiSelect
              options={courseGroups.flatMap((group) => (group.options || []).map((opt) => ({
                ...opt,
                group: group.groupLabel,
              })))}
              value={selectedCourses}
              onChange={changeCourses}
              searchPlaceholder="Search courses..."
            />
          </div>

          {selectedCourses.length > 0 && (
            <div className="mb-3">
              <label className="form-label">Subjects</label>
              {subjects.length === 0 ? (
                <p className="text-muted small mb-0">No subjects found for the selected course(s).</p>
              ) : (
                <ChipMultiSelect
                  options={subjects}
                  value={selectedSubjects}
                  onChange={setSelectedSubjects}
                  searchPlaceholder="Search subjects..."
                  listHeight={200}
                />
              )}
            </div>
          )}

          <button type="submit" className="btn btn-danger" disabled={generating || loadingFilters}>
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </form>

      {html && (
        <>
          <ReportPrintBar html={buildPrintHtml()} printMode="student-attendance-report" />
          <div className="card shadow-sm student-report-page">
            <div className="card-body student-report-preview overflow-auto" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
