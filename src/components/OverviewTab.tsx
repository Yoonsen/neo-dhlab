import React, { useState } from 'react';
import {
  ActiveCorpus,
  applyCorpusToPayload,
  ConcordanceResponse,
  describeCountMode,
  fetchNearCount,
  NearQueryResponse,
  ParsedQuery,
} from '../api';

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
  concData: ConcordanceResponse | null;
  concMs: number | null;
  concLoading: boolean;
  onFetchConcordanceFor: (parsed: ParsedQuery) => void;
  onSelectQuery: (q: string) => void;
  onSwitchTab: (tab: 'overview' | 'trends' | 'concordance') => void;
  onLog: (entry: {
    endpoint: string;
    queryText: string;
    modeLabel: string;
    total?: number;
    docs?: number;
    clientMs: number;
    engine?: string;
    payload: Record<string, unknown>;
  }) => void;
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
  onLog,
}) => {
  const [compRows, setCompRows] = useState<PairComparisonRow[] | null>(null);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [compKey, setCompKey] = useState<string>('');

  const singleItem = items.length === 1 && pendingQueries.length === 0 ? items[0] : null;
  const parsed = singleItem?.parsed;
  const result = singleItem?.result;
  const clientMs = singleItem?.clientMs ?? null;
  const lastPayload = singleItem?.payload ?? null;

  const currentPairKey = parsed?.pairWords
    ? `${parsed.pairWords[0]}_${parsed.pairWords[1]}_${parsed.window}_${
        corpus.enabled ? corpus.corpusToken || corpus.filterIds.length : 'all'
      }`
    : '';

  const runPairVsAnchorComparison = async () => {
    if (!parsed?.pairWords) return;
    const [w1, w2] = parsed.pairWords;
    setCompLoading(true);
    try {
      const variants = [
        {
          label: `Par (${w1}, ${w2})`,
          querySyntax: `${w1} ${w2}`,
          terms: [w1, w2],
          explanation: `Alle par (a, b) innenfor ${parsed.window} ord, symmetrisk: near(${w1}, ${w2}) = near(${w2}, ${w1}).`,
        },
        {
          label: `Anker på «${w1}»`,
          querySyntax: `^${w1} ${w2}`,
          terms: [`^${w1}`, w2],
          explanation: `Forekomster av «${w1}» med minst én «${w2}» innenfor ${parsed.window} ord.`,
        },
        {
          label: `Anker på «${w2}»`,
          querySyntax: `${w1} ^${w2}`,
          terms: [w1, `^${w2}`],
          explanation: `Forekomster av «${w2}» med minst én «${w1}» innenfor ${parsed.window} ord.`,
        },
      ];

      const rows: PairComparisonRow[] = [];
      for (const v of variants) {
        const payload: Record<string, unknown> = {
          terms: v.terms,
          window: parsed.window,
        };
        if (!parsed.symmetric) payload.symmetric = false;
        applyCorpusToPayload(payload, corpus);
        const { data, clientMs: ms } = await fetchNearCount(baseUrl, payload);
        onLog({
          endpoint: '/near_query',
          queryText: v.querySyntax,
          modeLabel: `${data.countMode} (w=${parsed.window})`,
          total: data.total,
          docs: data.docs,
          clientMs: ms,
          engine: data._engine,
          payload,
        });
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
          <span>Teller i 103 arena-shards (38,5 mrd. tokens)…</span>
        </div>
      )}

      {/* Single expression view */}
      {singleItem && parsed && result && (
        <section className="result-hero-card" aria-label="Telle-resultat">
          <div className="result-metrics-grid">
            <div className="metric-block">
              <span className="metric-label">Totalt antall treff (`total`)</span>
              <strong className="metric-value">
                {result.total.toLocaleString('nb-NO')}
              </strong>
              <span className="metric-sub">
                {describeCountMode(result.countMode, parsed)}
              </span>
            </div>

            <div className="metric-block">
              <span className="metric-label">Bøker med treff (`docs`)</span>
              <strong className="metric-value">
                {result.docs.toLocaleString('nb-NO')}
              </strong>
              <span className="metric-sub">
                av {totalBooksInScope.toLocaleString('nb-NO')} bøker (
                {((result.docs / totalBooksInScope) * 100).toFixed(2)} %)
              </span>
            </div>

            <div className="metric-block speed-block">
              <span className="metric-label">Målt svartid i nettleseren</span>
              <strong className="metric-value speed-value">
                {clientMs !== null ? `${clientMs} ms` : '–'}
              </strong>
              <span className="metric-sub">
                {clientMs !== null ? `${(clientMs / 1000).toFixed(2)} s` : ''} · Motor:{' '}
                <code>{result._engine || 'arena'}</code> · Modus:{' '}
                <code>{result.countMode}</code>
              </span>
            </div>
          </div>

          <div className="result-actions-bar">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onFetchConcordanceFor(parsed)}
              disabled={parsed.hasWildcardOrGroup}
            >
              Vis eksempler i Konkordans →
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSwitchTab('trends')}
            >
              Se trendkurve per år →
            </button>

            {parsed.canComparePairAnchor && parsed.pairWords && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void runPairVsAnchorComparison()}
                disabled={compLoading}
              >
                {compLoading
                  ? 'Sammenligner Par vs. Anker…'
                  : `Sammenlign Par vs. ^${parsed.pairWords[0]} vs. ^${parsed.pairWords[1]}`}
              </button>
            )}

            {lastPayload && (
              <details className="payload-details">
                <summary>Vis sendt JSON-payload</summary>
                <pre tabIndex={0} role="region" aria-label="JSON-payload">
                  <code>{JSON.stringify(lastPayload, null, 2)}</code>
                </pre>
              </details>
            )}
          </div>
        </section>
      )}

      {/* Multi-expression sequential comparison table */}
      {(items.length > 1 || (items.length >= 1 && pendingQueries.length > 0)) && (
        <section
          className="card-box"
          aria-label="Sammenligning av flere søkeuttrykk"
        >
          <div className="section-header-row">
            <div>
              <h3>Sammenligning ({items.length + pendingQueries.length} søkeuttrykk)</h3>
              <p className="section-help">
                Kjøres sekvensielt etter hverandre mot arena-indeksen.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSwitchTab('trends')}
            >
              Sammenlign alle som trendkurver →
            </button>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Resultattabell for søkeuttrykk"
            className="table-wrapper"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Søkeuttrykk</th>
                  <th scope="col">Tellemåte</th>
                  <th scope="col">Treff (`total`)</th>
                  <th scope="col">Bøker (`docs`)</th>
                  <th scope="col">Andel av korpus</th>
                  <th scope="col">Motor & tid</th>
                  <th scope="col">Konkordans</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
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
                    <td>
                      <span className="speed-pill">{item.clientMs} ms</span>{' '}
                      <span className="muted">({item.result._engine || 'arena'})</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-tiny"
                        disabled={item.parsed.hasWildcardOrGroup}
                        onClick={() => onFetchConcordanceFor(item.parsed)}
                      >
                        Eksempler →
                      </button>
                    </td>
                  </tr>
                ))}

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

      {/* Side-by-side Pair vs Anchor comparison card */}
      {singleItem &&
        parsed?.canComparePairAnchor &&
        compRows &&
        compKey === currentPairKey && (
          <section
            className="card-box comparison-section"
            aria-label="Sammenligning av Par- og Ankertelling"
          >
            <div className="section-header-row">
              <div>
                <h3>Par vs. Anker-sammenligning (vindu = {parsed.window} ord)</h3>
                <p className="section-help">
                  Viser forskjellen mellom symmetrisk partelling (<code>pairs</code>) og ankertelling (
                  <code>^ord</code>). Antall bøker (<code>docs</code>) er alltid identisk.
                </p>
              </div>
            </div>
            <div className="comparison-cards">
              {compRows.map((row) => (
                <div key={row.querySyntax} className="comparison-card">
                  <div className="comp-card-top">
                    <span className="badge-mode">{row.countMode}</span>
                    <span className="speed-pill">{row.ms} ms</span>
                  </div>
                  <h4>{row.label}</h4>
                  <p className="comp-syntax">
                    Søk: <code>{row.querySyntax}</code>
                  </p>
                  <div className="comp-numbers">
                    <div>
                      <span className="muted">Treff (total):</span>{' '}
                      <strong>{row.total.toLocaleString('nb-NO')}</strong>
                    </div>
                    <div>
                      <span className="muted">Bøker (docs):</span>{' '}
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
