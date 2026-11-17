import React, { useId } from 'react';
import { ConcordanceResponse, ParsedQuery } from '../api';
import { downloadExcelFile } from '../excelExport';

interface ConcordanceViewProps {
  queryText: string;
  parsed: ParsedQuery;
  parsedList: ParsedQuery[];
  onSelectParsed: (p: ParsedQuery) => void;
  data: ConcordanceResponse | null;
  clientMs: number | null;
  loading: boolean;
  error: string | null;
  limit: number;
  before: number;
  after: number;
  onOptionsChange: (opts: { limit: number; before: number; after: number }) => void;
  onFetch: () => void;
}

export const ConcordanceView: React.FC<ConcordanceViewProps> = ({
  queryText,
  parsed,
  parsedList,
  onSelectParsed,
  data,
  clientMs,
  loading,
  error,
  limit,
  before,
  after,
  onOptionsChange,
  onFetch,
}) => {
  const captionId = useId();
  const limitSelectId = useId();

  const exportExcel = () => {
    if (!data || data.rows.length === 0) return;
    const matrix: (string | number)[][] = [
      ['dhlabid', 'left', 'hit', 'right'],
      ...data.rows.map((r) => [r.dhlabid, r.left, r.hit, r.right]),
    ];
    downloadExcelFile(
      `konkordans_${queryText.replace(/\s+/g, '_')}.xlsx`,
      matrix
    );
  };

  return (
    <div className="panel-inner">
      <div className="conc-toolbar">
        <div className="conc-controls">
          {parsedList.length > 1 && (
            <div className="field-inline">
              <span>Uttrykk:</span>
              {parsedList.map((p) => (
                <button
                  key={p.raw}
                  type="button"
                  className={`example-chip ${
                    p.raw === parsed.raw ? 'example-chip-active' : ''
                  }`}
                  onClick={() => onSelectParsed(p)}
                >
                  <code>{p.raw}</code>
                </button>
              ))}
            </div>
          )}

          <div className="field-inline">
            <label htmlFor={limitSelectId}>Antall linjer</label>
            <select
              id={limitSelectId}
              value={limit}
              onChange={(e) =>
                onOptionsChange({
                  limit: Number(e.target.value),
                  before,
                  after,
                })
              }
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={onFetch}
            disabled={loading || parsed.terms.length === 0 || parsed.hasWildcardOrGroup}
          >
            {loading ? 'Henter…' : 'Hent på nytt'}
          </button>

          {data && data.rows.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
            >
              Excel (.xlsx)
            </button>
          )}
        </div>

        {data && (
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {data.lines} linjer fra {data.books} bøker ·{' '}
            <strong className="speed-highlight">{clientMs} ms</strong>
          </div>
        )}
      </div>

      {parsed.hasWildcardOrGroup && (
        <div role="alert" className="error-banner">
          Wildcard (<code>*</code>) støttes i tellinger og trender, men ikke i konkordans.
        </div>
      )}

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {loading && !data && (
        <div role="status" aria-live="polite" className="loading-card">
          <span className="spinner" aria-hidden="true" />
          <span>Henter konkordanslinjer…</span>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper kwic-table-wrapper"
        >
          <table className="kwic-table">
            <caption id={captionId} className="visually-hidden">
              Konkordans for {queryText}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="col-dhlabid">
                  dhlabid
                </th>
                <th scope="col" className="col-left">
                  Venstre kontekst
                </th>
                <th scope="col" className="col-hit">
                  Treff
                </th>
                <th scope="col" className="col-right">
                  Høyre kontekst
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={`${row.dhlabid}-${i}`}>
                  <th scope="row" className="col-dhlabid">
                    <code>{row.dhlabid}</code>
                  </th>
                  <td className="col-left">{row.left}</td>
                  <td className="col-hit">
                    <mark className="kwic-hit">{row.hit}</mark>
                  </td>
                  <td className="col-right">{row.right}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
