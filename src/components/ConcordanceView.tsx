import React, { useId } from 'react';
import { ConcordanceResponse, ParsedQuery } from '../api';

interface ConcordanceViewProps {
  queryText: string;
  parsed: ParsedQuery;
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
  const contextSelectId = useId();

  const hitWordsCount =
    parsed.matchMode === 'sequence' ? Math.max(1, parsed.terms.length) : 1;
  const maxContextEach = Math.max(1, Math.floor((25 - hitWordsCount) / 2));

  return (
    <div className="panel-inner">
      <div className="conc-toolbar">
        <div className="conc-info">
          <strong>Offentlig konkordans (`/concordance_public`)</strong>
          <span className="muted">
            Maks 25 ord per linje (klippet ved avsnitt) · Maks 10 % av hver bok · Fast server-seed
          </span>
        </div>

        <div className="conc-controls">
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
              <option value={20}>20 linjer (raskest)</option>
              <option value={30}>30 linjer (anbefalt i demo)</option>
              <option value={50}>50 linjer</option>
              <option value={100}>100 linjer</option>
              <option value={200}>200 linjer (maks)</option>
            </select>
          </div>

          <div className="field-inline">
            <label htmlFor={contextSelectId}>Kontekst (før/etter)</label>
            <select
              id={contextSelectId}
              value={Math.min(before, maxContextEach)}
              onChange={(e) => {
                const v = Number(e.target.value);
                onOptionsChange({ limit, before: v, after: v });
              }}
            >
              {[5, 8, 10, 12]
                .filter((v) => v <= maxContextEach)
                .map((v) => (
                  <option key={v} value={v}>
                    ±{v} ord
                  </option>
                ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={onFetch}
            disabled={loading || parsed.terms.length === 0 || parsed.hasWildcardOrGroup}
          >
            {loading ? 'Henter eksempler…' : 'Hent eksempler'}
          </button>
        </div>
      </div>

      {parsed.hasWildcardOrGroup && (
        <div role="alert" className="error-banner">
          Wildcard (<code>*</code>) støttes i tellinger, men er ikke tillatt i <code>/concordance_public</code> (gir 400).
        </div>
      )}

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {data && (
        <div className="kpi-strip">
          <div className="kpi-mini">
            <span className="kpi-mini-label">Viste linjer</span>
            <strong className="kpi-mini-val">{data.lines}</strong>
          </div>
          <div className="kpi-mini">
            <span className="kpi-mini-label">Unike bøker i utvalget</span>
            <strong className="kpi-mini-val">{data.books}</strong>
          </div>
          <div className="kpi-mini">
            <span className="kpi-mini-label">Trefford (anker/frase)</span>
            <strong className="kpi-mini-val">
              {parsed.anchorWord ?? parsed.terms[0] ?? '–'}
            </strong>
          </div>
          <div className="kpi-mini">
            <span className="kpi-mini-label">Målt svartid</span>
            <strong className="kpi-mini-val speed-highlight">
              {clientMs !== null ? `${clientMs} ms (${(clientMs / 1000).toFixed(2)} s)` : '–'}
            </strong>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="empty-box">
          Trykk <strong>«Hent eksempler»</strong> for å hente {limit} konkordanslinjer for «{queryText}».
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
            <caption id={captionId} className="table-caption">
              Konkordansutvalg for «{queryText}» ({data.lines} linjer fra {data.books} bøker)
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
