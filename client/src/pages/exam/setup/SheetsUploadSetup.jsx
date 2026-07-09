import { useEffect, useRef, useState } from 'react';
import { ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function SheetsUploadSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('sheets-upload');
  const [batchId, setBatchId] = useState(null);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.batchId) setBatchId(data.batchId);
    if (data?.results) setResults(data.results);
  }, [data]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;

    setProgress(0);
    setResults([]);
    let currentBatch = batchId;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'gif'].includes(ext || '')) {
        setResults((prev) => [...prev, { filename: file.name, success: false, message: 'Unsupported file type!' }]);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setResults((prev) => [...prev, { filename: file.name, success: false, message: 'File is too big, it should be less than 10 MB.' }]);
        continue;
      }

      const content = await fileToBase64(file);
      const res = await save(
        { batchId: currentBatch },
        [{ filename: file.name, content }],
      );
      if (res?.batchId) currentBatch = res.batchId;
      if (res?.results) setResults((prev) => [...prev, ...res.results]);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setBatchId(currentBatch);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Attach Marksheet</label>
        <div className="col-sm-4">
          <input ref={fileRef} type="file" className="form-control" accept=".jpg,.jpeg,.gif" multiple onChange={handleFiles} disabled={busy} />
        </div>
      </div>

      {progress > 0 && progress < 100 ? (
        <div className="progress mb-3"><div className="progress-bar" style={{ width: `${progress}%` }}>{progress}%</div></div>
      ) : null}

      {batchId ? (
        <div className="alert alert-info py-2">
          Batch #{batchId} — <a href={`/exam/reports/sheets-status?batchId=${batchId}`}>View upload status</a>
        </div>
      ) : null}

      {results.length ? (
        <ul className="list-unstyled">
          {results.map((row) => (
            <li key={row.filename} className={row.success ? 'text-success' : 'text-danger'}>
              {row.filename}: {row.message || (row.success ? 'Uploaded' : 'Failed')}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="small text-danger">
        <strong>NOTE:</strong><br />
        1. Upload *.gif, *.jpg format file only.<br />
        2. Individual files size should be less than 10 MB.<br />
        3. Sheet should be scanned in 300 dpi, black &amp; white color.<br />
        4. Sheet should not be skew.
      </div>
    </ExamSetupShell>
  );
}
