import { useRef, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useExamSetupApi } from './useExamSetupApi';

async function readFilesAsBase64(fileList) {
  const files = [];
  for (let i = 0; i < fileList.length; i += 1) {
    const file = fileList[i];
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    files.push({
      field: 'upload[]',
      index: i,
      filename: file.name,
      type: file.type,
      content,
    });
  }
  return files;
}

export default function MarksUploadSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('marks-upload');
  const fileRef = useRef(null);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [results, setResults] = useState([]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const fileList = fileRef.current?.files;
    if (!fileList?.length) {
      setUploadError('Please attach at least one marksheet image');
      return;
    }
    setUploadError(null);
    setUploadNotice(null);
    const files = await readFilesAsBase64(fileList);
    const res = await save({ Submit: 'Upload' }, files);
    if (res?.results) setResults(res.results);
    if (res?.success) setUploadNotice(res.message || 'Upload completed');
    else if (res?.message) setUploadError(res.message);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <SetupAlerts notice={notice || uploadNotice} error={error || uploadError} busy={busy} />
      <form onSubmit={handleUpload}>
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Attach Marksheet</label>
          <div className="col-sm-4">
            <input ref={fileRef} type="file" className="form-control" accept=".jpg,.jpeg,.gif" multiple />
          </div>
        </div>
        <button type="submit" className="btn btn-danger btn-lg" disabled={busy}>Upload Mark Sheet</button>
      </form>

      {results.length ? (
        <div className="mt-3">
          {results.map((r) => (
            <div key={r.filename} className={`alert ${r.success ? 'alert-success' : 'alert-danger'} py-2`}>
              <strong>{r.filename}:</strong> {r.message}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
