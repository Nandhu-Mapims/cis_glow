import { useMemo, useState } from 'react';
import ChipMultiSelect from '../../components/ChipMultiSelect';

export default function AddressLabelPanel({ data, busy, onGenerate }) {
  const [searchBy, setSearchBy] = useState(data?.filters?.search_by || 'batch');
  const [displayOpt, setDisplayOpt] = useState(data?.filters?.display_opt || 'Regular');
  const [selectedBatch, setSelectedBatch] = useState(data?.filters?.search_course || []);
  const [selectedYear, setSelectedYear] = useState(data?.filters?.search_year || []);

  const groups = useMemo(
    () => (searchBy === 'year' ? (data?.yearGroups || []) : (data?.batchGroups || [])),
    [searchBy, data?.yearGroups, data?.batchGroups],
  );

  const selected = searchBy === 'year' ? selectedYear : selectedBatch;
  const setSelected = searchBy === 'year' ? setSelectedYear : setSelectedBatch;

  const submit = (e) => {
    e.preventDefault();
    onGenerate({
      Submit: 'Update',
      search_by: searchBy,
      display_opt: displayOpt,
      search_course: selectedBatch,
      search_year: selectedYear,
    });
  };

  return (
    <form className="cis-address-label-filters" onSubmit={submit}>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="cis-student-filter-heading">Filter</div>

          <div className="mb-3">
            <div className="form-label">Search By</div>
            <div className="d-flex flex-wrap gap-3">
              <label className="mb-0">
                <input
                  type="radio"
                  name="search_by"
                  value="batch"
                  checked={searchBy === 'batch'}
                  onChange={() => setSearchBy('batch')}
                />
                {' '}Batch
              </label>
              <label className="mb-0">
                <input
                  type="radio"
                  name="search_by"
                  value="year"
                  checked={searchBy === 'year'}
                  onChange={() => setSearchBy('year')}
                />
                {' '}Year
              </label>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="address-label-courses">
              {searchBy === 'year' ? 'Year' : 'Batch'}
            </label>
            <ChipMultiSelect
              options={groups.flatMap((group) => (group.options || []).map((opt) => ({ value: opt.value, label: opt.label, group: group.label })))}
              value={selected}
              onChange={setSelected}
              emptySelectionText={`No ${searchBy === 'year' ? 'years' : 'batches'} selected`}
              emptySearchText="No matches found."
              listHeight={360}
            />
          </div>

          <div className="mb-3">
            <div className="form-label">Show</div>
            <div className="d-flex flex-wrap gap-3">
              {['Regular', 'Discontinue', 'All'].map((value) => (
                <label key={value} className="mb-0">
                  <input
                    type="radio"
                    name="display_opt"
                    value={value}
                    checked={displayOpt === value}
                    onChange={() => setDisplayOpt(value)}
                  />
                  {' '}{value}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Generating…' : 'Generate labels'}
          </button>
        </div>

        <div className="col-lg-8">
          <div className="text-muted small mb-2">
            Selected: {selected.length}
            {typeof data?.count === 'number' && data.reportHtml ? ` · Labels: ${data.count}` : ''}
          </div>
          {!data?.reportHtml && (
            <div className="cis-report-empty">
              <span className="cis-report-empty-icon" aria-hidden="true">✉</span>
              <p className="mb-0">
                Choose Batch or Year, select one or more options, then generate printable address labels.
              </p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
