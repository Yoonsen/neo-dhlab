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

interface OverviewTabProps {
  baseUrl: string;
  parsed: ParsedQuery;
  corpus: ActiveCorpus;
  result: NearQueryResponse | null;
  clientMs: number | null;
  lastPayload: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  concData: ConcordanceResponse | null;
  concMs: number | null;
  concLoading: boolean;
  onFetchConcordance: () => void;
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
  parsed,
  corpus,
  result,
  clientMs,
  lastPayload,
  loading,
  error,
  concData,
  concMs,
  concLoading,
  onFetchConcordance,
  onSelectQuery,
  onSwitchTab,
  onLog,
}) => {
  const [compRows, setCompRows] = useState<PairComparisonRow[] | null>(null);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [compKey, setCompKey] = useState<string>('');

  const currentPairKey = parsed.pairWords
    ? `${parsed.pairWords[0]}_${parsed.pairWords[1]}_${parsed.window}_${corpus.enabled ? corpus.corpusToken || corpus.filterIds.length : 'all'}`
    : '';

  const runPairVsAnchorComparison = async () => {
    if (!parsed.pairWords) return;
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
          explanation: `Forekomster av «${w1}» som har minst én «${w2}» innenfor ${parsed.window} ord (alltid ≤ tf for «${w1}»).`,
        },
        {
          label: `Anker på «${w2}»`,
          querySyntax: `${w1} ^${w2}`,
          terms: [w1, `^${w2}`],
          explanation: `Forekomster av «${w2}» som har minst én «${w1}» innenfor ${parsed.window} ord (alltid ≤ tf for «${w2}»).`,
        },
      ];

      const results = await Promise.all(
        variants.map(async (v) => {
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
          return {
            label: v.label,
            querySyntax: v.querySyntax,
            countMode: data.countMode,
            total: data.total,
            docs: data.docs,
            ms,
            explanation: v.explanation,
          };
        })
      );
      setCompRows(results);
      setCompKey(currentPairKey);
    } finally {
      setCompLoading(false);
    }
  };

  return (
    <div className="panel-inner">
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {loading && (
        <div role="status" aria-live="polite" className="loading-card">
          <span className="spinner" aria-hidden="true" />
          <span>Teller i 103 arena-shards (38,5 mrd. tokens)…</span>
        </div>
      )}

      {result && !loading && (
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
                {corpus.enabled && corpus.size > 0
                  ? `av ${corpus.size.toLocaleString('nb-NO')} bøker i aktivt korpus (${(
                      (result.docs / corpus.size) *
                      100
                    ).toFixed(2)} %)`
                  : `av 713 913 bøker i samlingen (${(
                      (result.docs / 713913) *
                      100
                    ).toFixed(2)} %)`}
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
              onClick={onFetchConcordance}
              disabled={concLoading || parsed.hasWildcardOrGroup}
            >
              {concLoading
                ? 'Henter 30 eksempler…'
                : concData
                ? 'Oppdater 30 eksempler under'
                : 'Vis 30 eksempler (konkordans)'}
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

      {/* Side-by-side Pair vs Anchor comparison card */}
      {parsed.canComparePairAnchor &&
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

      {/* Inline Concordance Preview right under the counting result (as requested in DEMO_APP_SPEC.md item 4) */}
      {concData && (
        <section
          className="card-box inline-conc-section"
          aria-label="Eksempler fra samlingen"
        >
          <div className="section-header-row">
            <div>
              <h3>
                Eksempler fra konkordansen ({concData.lines} linjer fra{' '}
                {concData.books} bøker)
              </h3>
              <span className="muted">
                Hentet fra <code>/concordance_public</code> på {concMs} ms
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSwitchTab('concordance')}
            >
              Åpne i full Konkordans-fane →
            </button>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-label="Konkordanslinjer"
            className="table-wrapper kwic-table-wrapper"
          >
            <table className="kwic-table">
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
                {concData.rows.map((row, idx) => (
                  <tr key={`${row.dhlabid}-${idx}`}>
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
        </section>
      )}
    </div>
  );
};
