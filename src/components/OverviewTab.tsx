import React, { useState } from 'react';
import {
  ActiveCorpus,
  applyCorpusToPayload,
  describeCountMode,
  fetchNearCount,
  NearQueryResponse,
  ParsedQuery,
} from '../api';
import { downloadExcelFile } from '../excelExport';

export interface CountSeriesItem {
  parsed: ParsedQuery;
  result: NearQueryResponse;
  clientMs: number;
  payload: Record<string, unknown>;
}

interface OverviewTabProps {
  baseUrl: string;
  items: CountSeriesItem[];
  pendingQueries: string[];
  corpus: ActiveCorpus;
  loading: boolean;
  error: string | null;
  onFetchConcordanceFor: (parsed: ParsedQuery) => void;
  onSelectQuery: (q: string) => void;
  onSwitchTab: (tab: 'overview' | 'trends' | 'concordance') => void;
}

interface PairComparisonRow {
  label: string;
  querySyntax: string;
  countMode: string;
  total: number;
  docs: number;
  ms: number;
  explanation: string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  baseUrl,
  items,
  pendingQueries,
  corpus,
  loading,
  error,
  onFetchConcordanceFor,
  onSelectQuery,
  onSwitchTab,
}) => {
  const [compRows, setCompRows] = useState<PairComparisonRow[] | null>(null);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [compKey, setCompKey] = useState<string>('');

  const singleItem = items.length === 1 && pendingQueries.length === 0 ? items[0] : null;
  const parsed = singleItem?.parsed;
  const result = singleItem?.result;
  const clientMs = singleItem?.clientMs ?? null;

  const currentPairKey = parsed?.pairWords
    ? `${parsed.pairWords.join('_')}_${parsed.window}_${
        corpus.enabled ? corpus.corpusToken || corpus.filterIds.length : 'all'
      }`
    : '';

  const runPairVsAnchorComparison = async () => {
    if (!parsed?.pairWords || parsed.pairWords.length < 2) return;
    const words = parsed.pairWords;
    setCompLoading(true);
    try {
      const isMulti = words.length >= 3;
      const baseVariant = isMulti
        ? {
            label: `Spenn (${words.join(', ')})`,
            querySyntax: words.join(' '),
            terms: words,
            explanation: `Antall ikke-overlappende steder (≤ ${parsed.window} ord) der alle ${words.length} ordene står sammen.`,
          }
        : {
            label: `Par (${words[0]}, ${words[1]})`,
            querySyntax: `${words[0]} ${words[1]}`,
            terms: [words[0], words[1]],
            explanation: `Alle par (a, b) innenfor ${parsed.window} ord, symmetrisk.`,
          };

      const anchorVariants = words.map((w, idx) => {
        const anchoredTerms = words.map((tok, i) => (i === idx ? `^${tok}` : tok));
        const others = words.filter((_, i) => i !== idx).join(', ');
        return {
          label: `Anker på «${w}»`,
          querySyntax: anchoredTerms.join(' '),
          terms: anchoredTerms,
          explanation: `Forekomster av «${w}» med ${others} innenfor ${parsed.window} ord.`,
        };
      });

      const variants = [baseVariant, ...anchorVariants];
      const rows: PairComparisonRow[] = [];

      for (const v of variants) {
        const payload: Record<string, unknown> = {
          terms: v.terms,
          window: parsed.window,
        };
        if (!parsed.symmetric) payload.symmetric = false;
        applyCorpusToPayload(payload, corpus);
        const { data, clientMs: ms } = await fetchNearCount(baseUrl, payload);
        rows.push({
          label: v.label,
          querySyntax: v.querySyntax,
          countMode: data.countMode,
          total: data.total,
          docs: data.docs,
          ms,
          explanation: v.explanation,
        });
      }
      setCompRows(rows);
      setCompKey(currentPairKey);
    } finally {
      setCompLoading(false);
    }
  };

  const totalBooksInScope =
    corpus.enabled && corpus.size > 0 ? corpus.size : 713913;

  const exportCountsExcel = () => {
    const matrix: (string | number)[][] = [
      ['query', 'countMode', 'total', 'docs', 'corpusSharePct', 'ms'],
      ...items.map((item) => [
        item.parsed.raw,
        item.result.countMode,
        item.result.total,
        item.result.docs,
        Number(((item.result.docs / totalBooksInScope) * 100).toFixed(2)),
        item.clientMs,
      ]),
    ];
    downloadExcelFile('tellinger.xlsx', matrix);
  };

  return (
    <div className="panel-inner">
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div role="status" aria-live="polite" className="loading-card">
          <span className="spinner" aria-hidden="true" />
          <span>Teller i arena-indeksen…</span>
        </div>
      )}

      {/* Single expression view */}
      {singleItem && parsed && result && (
        <section className="result-hero-card" aria-label="Telle-resultat">
          <div className="result-metrics-grid">
            <div className="metric-block">
              <span className="metric-label">Antall treff</span>
              <strong className="metric-value">
                {result.total.toLocaleString('nb-NO')}
              </strong>
              <span className="metric-sub">
                {describeCountMode(result.countMode, parsed)}
              </span>
            </div>

            <div className="metric-block">
              <span className="metric-label">Bøker med treff</span>
              <strong className="metric-value">
                {result.docs.toLocaleString('nb-NO')}
              </strong>
              <span className="metric-sub">
                Dekning: {((result.docs / totalBooksInScope) * 100).toFixed(2)} % av{' '}
                {totalBooksInScope.toLocaleString('nb-NO')} bøker · Intensitet:{' '}
                {result.docs > 0 ? (result.total / result.docs).toFixed(1) : '0'} treff/bok
              </span>
            </div>

            <div className="metric-block">
              <span className="metric-label">Svartid</span>
              <strong className="metric-value speed-value">
                {clientMs !== null ? `${clientMs} ms` : '–'}
              </strong>
              <span className="metric-sub">
                Modus: <code>{result.countMode}</code> ({result._engine || 'arena'})
              </span>
            </div>
          </div>

          <div className="result-actions-bar">
            {parsed.canComparePairAnchor && parsed.pairWords && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void runPairVsAnchorComparison()}
                disabled={compLoading}
              >
                {compLoading
                  ? 'Sammenligner…'
                  : parsed.pairWords.length >= 3
                  ? `Sammenlign Spenn vs. ^anker`
                  : `Sammenlign Par vs. ^${parsed.pairWords[0]} vs. ^${parsed.pairWords[1]}`}
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={exportCountsExcel}
            >
              Last ned Excel (.xlsx)
            </button>
          </div>
        </section>
      )}

      {/* Multi-expression sequential comparison table */}
      {(items.length > 1 || (items.length >= 1 && pendingQueries.length > 0)) && (
        <section
          className="card-box"
          aria-label="Sammenligning av søkeuttrykk"
        >
          <div className="section-header-row">
            <h3>Resultater ({items.length + pendingQueries.length} søkeuttrykk)</h3>
            <div className="trend-controls-right">
              <button
                type="button"
                className="btn-secondary"
                onClick={exportCountsExcel}
                disabled={items.length === 0}
              >
                Last ned Excel (.xlsx)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onSwitchTab('trends')}
              >
                Vis som trendkurver →
              </button>
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Resultattabell"
            className="table-wrapper"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Søkeuttrykk</th>
                  <th scope="col">Tellemåte</th>
                  <th scope="col">Treff</th>
                  <th scope="col">Bøker</th>
                  <th scope="col">Dekning (doc/N)</th>
                  <th scope="col">Intensitet (treff/bok)</th>
                  <th scope="col">Tid</th>
                  <th scope="col">Konkordans</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const perBook =
                    item.result.docs > 0
                      ? (item.result.total / item.result.docs).toFixed(1)
                      : '0';
                  return (
                    <tr key={item.parsed.raw}>
                      <th scope="row">
                        <code>{item.parsed.raw}</code>
                      </th>
                      <td>
                        <span className="badge-mode">{item.result.countMode}</span>
                      </td>
                      <td>
                        <strong>{item.result.total.toLocaleString('nb-NO')}</strong>
                      </td>
                      <td>{item.result.docs.toLocaleString('nb-NO')}</td>
                      <td>
                        {((item.result.docs / totalBooksInScope) * 100).toFixed(2)} %
                      </td>
                      <td>{perBook}</td>
                      <td>
                        <span className="speed-pill">{item.clientMs} ms</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-tiny"
                          disabled={item.parsed.hasWildcardOrGroup}
                          onClick={() => onFetchConcordanceFor(item.parsed)}
                        >
                          Vis →
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {pendingQueries.map((pq) => (
                  <tr key={pq}>
                    <th scope="row">
                      <code>{pq}</code>
                    </th>
                    <td colSpan={6} className="muted">
                      <span className="spinner-mini" aria-hidden="true" /> Beregner…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Side-by-side Pair/Spans vs Anchor comparison card */}
      {singleItem &&
        parsed?.canComparePairAnchor &&
        compRows &&
        compKey === currentPairKey && (
          <section
            className="card-box comparison-section"
            aria-label="Sammenligning av tellemåter"
          >
            <div className="section-header-row">
              <h3>
                {parsed.pairWords && parsed.pairWords.length >= 3
                  ? `Spenn (spans) vs. Anker (vindu = ${parsed.window})`
                  : `Par vs. Anker (vindu = ${parsed.window})`}
              </h3>
            </div>
            <div className="comparison-cards">
              {compRows.map((row) => (
                <div key={row.querySyntax} className="comparison-card">
                  <div className="comp-card-top">
                    <span className="badge-mode">{row.countMode}</span>
                    <span className="speed-pill">{row.ms} ms</span>
                  </div>
                  <h4>{row.label}</h4>
                  <div className="comp-numbers">
                    <div>
                      <span className="muted">Treff:</span>{' '}
                      <strong>{row.total.toLocaleString('nb-NO')}</strong>
                    </div>
                    <div>
                      <span className="muted">Bøker:</span>{' '}
                      <strong>{row.docs.toLocaleString('nb-NO')}</strong>
                    </div>
                  </div>
                  <p className="comp-desc">{row.explanation}</p>
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() => onSelectQuery(row.querySyntax)}
                  >
                    Bruk dette søket
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
    </div>
  );
};
