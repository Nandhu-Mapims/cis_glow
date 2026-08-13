import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import CheckListSelect from '../../components/CheckListSelect';
import { printFeePendingLetter } from '../../utils/printReport';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['pending-letter'];

export default function FeePendingLetter() {
  const { settings, menu } = useOutletContext();
  const [initLoading, setInitLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [classGroups, setClassGroups] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [result, setResult] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const formRes = await api.get('/api/fees/pending-letter/form');
        setClassGroups(formRes.data.classGroups || []);
        setClassOptions(formRes.data.classOptions || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to initialize pending letter');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/fees/pending-letter/generate', { selectedClasses });
      setResult(res.data);
      setClassGroups(res.data.classGroups || classGroups);
      setClassOptions(res.data.classOptions || classOptions);
      setHasGenerated(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to generate letters');
      setResult(null);
      setHasGenerated(false);
    } finally {
      setBusy(false);
    }
  };

  const printLetters = () => {
    printFeePendingLetter(result?.lettersHtml);
  };

  const letterCount = result?.count || 0;

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={initLoading}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('pending-letter')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card shadow-sm mb-3 cis-fee-filter-card" onSubmit={generate}>
        <div className="card-header py-2">Class selection</div>
        <div className="card-body">
          <span className="form-label" id="fee_letter_classes_label">
            Class <span className="text-danger">*</span>
          </span>
          <CheckListSelect
            aria-labelledby="fee_letter_classes_label"
            value={selectedClasses}
            groups={classGroups.length ? classGroups : null}
            options={classOptions}
            searchPlaceholder="Search classes..."
            onChange={(next) => {
              setSelectedClasses(next);
              setHasGenerated(false);
              setResult(null);
            }}
          />
          <div className="mt-3 d-flex flex-wrap gap-2 align-items-center">
            <button type="submit" className="btn btn-primary" disabled={busy || !selectedClasses.length}>
              {busy ? 'Generating…' : 'Go'}
            </button>
            {hasGenerated && letterCount > 0 && (
              <button type="button" className="btn btn-info" onClick={printLetters}>
                Print
              </button>
            )}
          </div>
        </div>
      </form>

      {busy && (
        <div className="card shadow-sm mb-3 cis-fee-results-card">
          <div className="card-body text-muted">
            Generating fee reminder letters… this may take a few seconds for large classes.
          </div>
        </div>
      )}

      {hasGenerated && letterCount > 0 && (
        <div className="card shadow-sm cis-fee-results-card cis-fee-letter-results">
          <div className="card-header py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span>Fee reminder letters</span>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={printLetters}>
              Print
            </button>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <strong>Total No. of Students:</strong>
              {' '}
              {letterCount}
            </div>
            <div
              className="cis-fee-letter-preview overflow-auto"
              dangerouslySetInnerHTML={{ __html: result.lettersHtml }}
            />
          </div>
        </div>
      )}

      {hasGenerated && !letterCount && !busy && (
        <div className="alert alert-warning mb-3">
          No pending fee letters found for the selected class(es). Students may have no outstanding fees or no parent mobile on file.
        </div>
      )}

      {!hasGenerated && !busy && (
        <div className="card shadow-sm cis-fee-empty-state">
          <div className="card-body">
            <i className="fa fa-envelope-o" aria-hidden="true" />
            <p className="mb-0">Select classes and click Go to generate printable fee reminder letters.</p>
          </div>
        </div>
      )}
    </FeePageShell>
  );
}
