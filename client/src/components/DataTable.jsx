import { useId, useMemo, useState } from 'react';

/**
 * Shared ERP data table. One table component for every list/report screen so
 * they behave and look identical: sticky header, client sort, optional in-table
 * search + pagination, a responsive card view on small screens, and built-in
 * loading / empty / error states.
 *
 * Columns: [{
 *   key,            // unique key + default row accessor (row[key])
 *   header,         // column label
 *   render,         // optional (row) => node  — custom cell content
 *   sortValue,      // optional (row) => string|number  — value used for sorting
 *   sortable,       // enable sort on this column
 *   align,          // 'left' | 'center' | 'right'
 *   numeric,        // apply tabular-nums (codes, amounts, dates)
 *   primary,        // used as the card title in the mobile card view
 *   hideOnMobile,   // omit from the mobile card view
 *   width,          // optional CSS width for the column
 *   searchField,    // include this column's text in the in-table search index
 * }]
 */
export default function DataTable({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowHref, // optional (row) => string, rendered as a trailing "open" link (keeps native a11y)
  loading = false,
  error = null,
  onRetry,
  empty = {},
  caption,
  searchable = false,
  searchPlaceholder = 'Filter results…',
  pageSize = 0, // 0 disables pagination
  initialSort = null, // { key, dir: 'asc' | 'desc' }
  toolbar = null, // extra controls rendered in the toolbar (e.g. export)
  density = 'comfortable', // 'comfortable' | 'compact'
}) {
  const tableId = useId();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const searchFields = useMemo(
    () => columns.filter((c) => c.searchField).map((c) => c),
    [columns],
  );

  const cellText = (col, row) => {
    if (col.sortValue) return col.sortValue(row);
    const raw = row[col.key];
    return raw == null ? '' : raw;
  };

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const needle = query.trim().toLowerCase();
    const fields = searchFields.length ? searchFields : columns;
    return rows.filter((row) =>
      fields.some((col) => String(cellText(col, row)).toLowerCase().includes(needle)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, searchable, searchFields, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = cellText(col, a);
      const bv = cellText(col, b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const paged = useMemo(() => {
    if (!pageSize) return sorted;
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSize, page]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = Math.min(page, pageCount);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = pageSize ? Math.min(safePage * pageSize, total) : total;

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null; // third click clears sort
    });
  };

  const showToolbar = searchable || toolbar || pageSize > 0;

  return (
    <div className={`cis-dt cis-dt--${density}`}>
      {showToolbar && (
        <div className="cis-dt-toolbar">
          {searchable ? (
            <div className="cis-dt-search">
              <i className="fa fa-search" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
              {query && (
                <button type="button" className="cis-dt-search-clear" onClick={() => setQuery('')} aria-label="Clear filter">
                  <i className="fa fa-times" aria-hidden="true" />
                </button>
              )}
            </div>
          ) : <span />}
          <div className="cis-dt-toolbar-end">
            {!loading && !error && (
              <span className="cis-dt-count" aria-live="polite">
                {total}
                {total === 1 ? ' record' : ' records'}
              </span>
            )}
            {toolbar}
          </div>
        </div>
      )}

      {error ? (
        <div className="cis-dt-state cis-dt-state--error" role="alert">
          <i className="fa fa-exclamation-triangle" aria-hidden="true" />
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={onRetry}>Try again</button>
          )}
        </div>
      ) : loading ? (
        <TableSkeleton columns={columns} />
      ) : total === 0 ? (
        <EmptyState {...empty} />
      ) : (
        <>
          {/* Desktop / tablet: real table */}
          <div className="cis-dt-scroll" role="region" aria-label={caption} tabIndex={0}>
            <table className="cis-dt-table" aria-describedby={caption ? `${tableId}-cap` : undefined}>
              {caption && <caption id={`${tableId}-cap`} className="visually-hidden">{caption}</caption>}
              <thead>
                <tr>
                  {columns.map((col) => {
                    const active = sort?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        className={`${col.align ? `cis-dt-align-${col.align}` : ''}${col.sortable ? ' cis-dt-sortable' : ''}${active ? ' is-sorted' : ''}`}
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      >
                        {col.sortable ? (
                          <button type="button" className="cis-dt-sort-btn" onClick={() => toggleSort(col)}>
                            <span>{col.header}</span>
                            <i
                              className={`fa fa-${active ? (sort.dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort'} cis-dt-sort-ico`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                  {rowHref && <th className="cis-dt-action-col" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, rowIndex) => {
                  const key = getRowKey(row);
                  const clickable = Boolean(onRowClick);
                  const displayIndex = rangeStart - 1 + rowIndex;
                  return (
                    <tr
                      key={key}
                      className={clickable ? 'cis-dt-row-clickable' : undefined}
                      onClick={clickable ? () => onRowClick(row) : undefined}
                      onKeyDown={clickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
                      } : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      role={clickable ? 'button' : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`${col.align ? `cis-dt-align-${col.align}` : ''}${col.numeric ? ' cis-dt-num' : ''}${col.primary ? ' cis-dt-primary' : ''}`}
                        >
                          {col.render ? col.render(row, displayIndex) : row[col.key]}
                        </td>
                      ))}
                      {rowHref && (
                        <td className="cis-dt-action-col">
                          <a className="cis-dt-open" href={rowHref(row)} onClick={(e) => e.stopPropagation()}>
                            Open
                            <i className="fa fa-angle-right" aria-hidden="true" />
                          </a>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="cis-dt-cards">
            {paged.map((row) => {
              const key = getRowKey(row);
              const primaryCol = columns.find((c) => c.primary) || columns[0];
              const detailCols = columns.filter((c) => c !== primaryCol && !c.hideOnMobile);
              const body = (
                <>
                  <div className="cis-dt-card-title">
                    {primaryCol.render ? primaryCol.render(row) : row[primaryCol.key]}
                  </div>
                  <dl className="cis-dt-card-details">
                    {detailCols.map((col) => (
                      <div key={col.key}>
                        <dt>{col.header}</dt>
                        <dd className={col.numeric ? 'cis-dt-num' : undefined}>
                          {col.render ? col.render(row) : (row[col.key] ?? '—')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              );
              if (rowHref) {
                return <li key={key}><a className="cis-dt-card cis-dt-card--link" href={rowHref(row)}>{body}<i className="fa fa-angle-right cis-dt-card-arrow" aria-hidden="true" /></a></li>;
              }
              return (
                <li key={key}>
                  <div
                    className={onRowClick ? 'cis-dt-card cis-dt-card--link' : 'cis-dt-card'}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                  >
                    {body}
                    {onRowClick && <i className="fa fa-angle-right cis-dt-card-arrow" aria-hidden="true" />}
                  </div>
                </li>
              );
            })}
          </ul>

          {pageSize > 0 && total > pageSize && (
            <div className="cis-dt-pager">
              <span className="cis-dt-pager-info">
                Showing
                {' '}
                <strong>{rangeStart}</strong>
                –
                <strong>{rangeEnd}</strong>
                {' of '}
                <strong>{total}</strong>
              </span>
              <div className="cis-dt-pager-btns">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  Previous
                </button>
                <span className="cis-dt-pager-page">
                  Page
                  {' '}
                  {safePage}
                  {' / '}
                  {pageCount}
                </span>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TableSkeleton({ columns, rows = 6 }) {
  return (
    <div className="cis-dt-scroll" aria-hidden="true">
      <table className="cis-dt-table cis-dt-table--skeleton">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={r}>
              {columns.map((c) => (
                <td key={c.key}><span className="cis-dt-skel-bar" style={{ width: `${50 + ((r * 7 + c.key.length * 5) % 45)}%` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  icon = 'fa fa-inbox',
  title = 'Nothing to show',
  message = 'No records match the current view.',
  action = null,
}) {
  return (
    <div className="cis-dt-state cis-dt-state--empty">
      <span className="cis-dt-state-icon" aria-hidden="true"><i className={icon} /></span>
      <h3 className="cis-dt-state-title">{title}</h3>
      {message && <p className="cis-dt-state-msg">{message}</p>}
      {action}
    </div>
  );
}
