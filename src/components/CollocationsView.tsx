import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ActiveCorpus,
  CollocationRow,
  CollocationsDistResponse,
  fetchCollocationsDist,
  ParsedQuery,
  resolveEffectiveCorpus,
} from '../api';
import { downloadExcelFile } from '../excelExport';
import { UiStrings } from '../i18n';

interface CollocationsViewProps {
  t: UiStrings;
  baseUrl: string;
  corpus: ActiveCorpus;
  parsed: ParsedQuery;
  parsedList: ParsedQuery[];
  onSelectParsed: (p: ParsedQuery) => void;
  onInspectInConcordance: (collocateWord: string) => void;
}

type DirectionMode = 'both' | 'before' | 'after' | 'split';
type SortBy = 'word' | 'counts' | 'bdist' | 'dist';
type SortDir = 'asc' | 'desc';

const DEFAULT_PUNCT_STOP = new Set([
  '.',
  ',',
  ':',
  ';',
  '!',
  '?',
  '-',
  '–',
  '—',
  '"',
  '«',
  '»',
  '(',
  ')',
  '[',
  ']',
  "'",
  '/',
]);

export const CollocationsView: React.FC<CollocationsViewProps> = ({
  t,
  baseUrl,
  corpus,
  parsed,
  parsedList,
  onSelectParsed,
  onInspectInConcordance,
}) => {
  const dirSelectId = useId();
  const winSelectId = useId();
  const sampleSelectId = useId();
  const perBookSelectId = useId();
  const filterInputId = useId();
  const foldCheckId = useId();
  const hidePunctCheckId = useId();
  const captionId = useId();

  const [dirMode, setDirMode] = useState<DirectionMode>('both');
  const [collWindow, setCollWindow] = useState<number>(5);
  const [foldCase, setFoldCase] = useState<boolean>(true);
  const [hidePunct, setHidePunct] = useState<boolean>(true);
  const [sampleSize, setSampleSize] = useState<number>(5000);
  const [perBook, setPerBook] = useState<number>(10);
  const [sortBy, setSortBy] = useState<SortBy>('counts');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [wordFilter, setWordFilter] = useState<string>('');

  const handleHeaderSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      // Naturlig standardretning: høyest frekvens først ('desc'), men lavest avstand / A–Å først ('asc')
      setSortDir(col === 'counts' ? 'desc' : 'asc');
    }
  };

  const renderSortArrow = (col: SortBy) => {
    if (sortBy !== col) return <span className="sort-indicator-muted">↕</span>;
    return (
      <span className="sort-indicator-active">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const getAriaSort = (
    col: SortBy
  ): 'ascending' | 'descending' | 'none' => {
    if (sortBy !== col) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  const [mainData, setMainData] = useState<CollocationsDistResponse | null>(null);
  const [beforeData, setBeforeData] = useState<CollocationsDistResponse | null>(null);
  const [afterData, setAfterData] = useState<CollocationsDistResponse | null>(null);
  const [clientMs, setClientMs] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Oppdater medgått tid mens /collocations_dist jobber på serveren
  useEffect(() => {
    if (!loading) {
      setElapsedSec(0);
      return;
    }
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setElapsedSec((performance.now() - t0) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [loading]);

  // Hent kollokasjoner når aktivt uttrykk, korpus eller kollokasjonsinnstillinger endres
  useEffect(() => {
    if (!parsed || parsed.terms.length === 0) {
      setMainData(null);
      setBeforeData(null);
      setAfterData(null);
      return;
    }

    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { corpus: effCorpus, extraMs } = await resolveEffectiveCorpus(
          baseUrl,
          parsed,
          corpus,
          ctrl.signal
        );
        if (ctrl.signal.aborted) return;

        if (dirMode === 'split') {
          const t0 = performance.now();
          const [resBefore, resAfter] = await Promise.all([
            fetchCollocationsDist(
              baseUrl,
              parsed,
              effCorpus,
              {
                before: collWindow,
                after: 0,
                fold: foldCase,
                sampleSize,
                perBook,
                limit: 1000,
              },
              ctrl.signal
            ),
            fetchCollocationsDist(
              baseUrl,
              parsed,
              effCorpus,
              {
                before: 0,
                after: collWindow,
                fold: foldCase,
                sampleSize,
                perBook,
                limit: 1000,
              },
              ctrl.signal
            ),
          ]);
          if (ctrl.signal.aborted) return;
          setBeforeData(resBefore.data);
          setAfterData(resAfter.data);
          setMainData(null);
          setClientMs(Math.round(performance.now() - t0) + extraMs);
        } else {
          const before = dirMode === 'after' ? 0 : collWindow;
          const after = dirMode === 'before' ? 0 : collWindow;
          const { data, clientMs: cMs } = await fetchCollocationsDist(
            baseUrl,
            parsed,
            effCorpus,
            {
              before,
              after,
              fold: foldCase,
              sampleSize,
              perBook,
              limit: 1500,
            },
            ctrl.signal
          );
          if (ctrl.signal.aborted) return;
          setMainData(data);
          setBeforeData(null);
          setAfterData(null);
          setClientMs(cMs + extraMs);
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => ctrl.abort();
  }, [baseUrl, collWindow, corpus, dirMode, foldCase, parsed, perBook, sampleSize]);

  // Filtrer og sorter en liste med CollocationRow
  const processRows = (
    rows: CollocationRow[] | undefined,
    mu0: number
  ): CollocationRow[] => {
    if (!rows) return [];
    const q = wordFilter.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (hidePunct && DEFAULT_PUNCT_STOP.has(r.word)) return false;
      if (q && !r.word.toLowerCase().includes(q)) return false;
      return true;
    });

    const mul = sortDir === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'word') {
        return mul * a.word.localeCompare(b.word, 'nb-NO');
      }
      if (sortBy === 'counts') {
        if (a.counts !== b.counts) return mul * (a.counts - b.counts);
        return a.bdist - b.bdist;
      }
      if (sortBy === 'bdist') {
        const aValid = a.dist !== null && Math.abs(a.bdist - mu0) > 1e-4;
        const bValid = b.dist !== null && Math.abs(b.bdist - mu0) > 1e-4;
        // Rader uten gyldig avstand (dist === null) legges alltid nederst uansett retning
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        if (a.bdist !== b.bdist) return mul * (a.bdist - b.bdist);
        return b.counts - a.counts;
      }
      // sortBy === 'dist'
      const aValid = a.dist !== null;
      const bValid = b.dist !== null;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      const aDist = a.dist ?? 999;
      const bDist = b.dist ?? 999;
      if (aDist !== bDist) return mul * (aDist - bDist);
      return b.counts - a.counts;
    });
  };

  const processedMain = useMemo(
    () => processRows(mainData?.rows, mainData?.mu0 ?? 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hidePunct, mainData, sortBy, sortDir, wordFilter]
  );

  const processedBefore = useMemo(
    () => processRows(beforeData?.rows, beforeData?.mu0 ?? 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beforeData, hidePunct, sortBy, sortDir, wordFilter]
  );

  const processedAfter = useMemo(
    () => processRows(afterData?.rows, afterData?.mu0 ?? 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [afterData, hidePunct, sortBy, sortDir, wordFilter]
  );

  const formatDistVal = (val: number | null, mu0: number, isBdist: boolean) => {
    if (val === null) return '—';
    if (isBdist && Math.abs(val - mu0) < 1e-4) return '—';
    return val.toFixed(2);
  };

  const exportExcel = () => {
    if (dirMode === 'split') {
      if (!beforeData || !afterData) return;
      const maxLen = Math.max(processedBefore.length, processedAfter.length);
      const matrix: (string | number)[][] = [
        [
          'foran_ord',
          'foran_antall',
          'foran_dist',
          'foran_bdist',
          'etter_ord',
          'etter_antall',
          'etter_dist',
          'etter_bdist',
        ],
      ];
      for (let i = 0; i < maxLen; i++) {
        const b = processedBefore[i];
        const a = processedAfter[i];
        matrix.push([
          b?.word ?? '',
          b?.counts ?? '',
          b && b.dist !== null ? b.dist : '',
          b && b.dist !== null ? b.bdist : '',
          a?.word ?? '',
          a?.counts ?? '',
          a && a.dist !== null ? a.dist : '',
          a && a.dist !== null ? a.bdist : '',
        ]);
      }
      downloadExcelFile(
        `kollokasjoner_foran_etter_${parsed.raw.replace(/\s+/g, '_')}.xlsx`,
        matrix
      );
      return;
    }

    if (!mainData || processedMain.length === 0) return;
    const matrix: (string | number)[][] = [
      ['word', 'counts', 'share_of_hits_pct', 'dist', 'bdist', 'mu0'],
      ...processedMain.map((r) => [
        r.word,
        r.counts,
        mainData.hits > 0 ? Number(((r.counts / mainData.hits) * 100).toFixed(2)) : 0,
        r.dist !== null ? r.dist : '',
        r.dist !== null ? r.bdist : '',
        mainData.mu0,
      ]),
    ];
    downloadExcelFile(
      `kollokasjoner_${parsed.raw.replace(/\s+/g, '_')}.xlsx`,
      matrix
    );
  };

  const activeStats = mainData ?? beforeData;

  return (
    <div className="panel-inner">
      <div className="conc-toolbar">
        <div className="conc-controls">
          {parsedList.length > 1 && (
            <div className="field-inline">
              <span>{t.exprLabel}</span>
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
            <label htmlFor={dirSelectId}>Retning:</label>
            <select
              id={dirSelectId}
              value={dirMode}
              onChange={(e) => setDirMode(e.target.value as DirectionMode)}
            >
              <option value="both">Begge sider (±{collWindow} ord)</option>
              <option value="split">Foran | Etter (side om side)</option>
              <option value="before">Kun foran (−{collWindow} ord)</option>
              <option value="after">Kun etter (+{collWindow} ord)</option>
            </select>
          </div>

          <div className="field-inline">
            <label htmlFor={winSelectId}>Vindu:</label>
            <select
              id={winSelectId}
              value={collWindow}
              onChange={(e) => setCollWindow(Number(e.target.value))}
            >
              <option value={1}>±1 ord</option>
              <option value={2}>±2 ord</option>
              <option value={3}>±3 ord</option>
              <option value={5}>±5 ord</option>
              <option value={10}>±10 ord</option>
              <option value={15}>±15 ord</option>
              <option value={20}>±20 ord</option>
              <option value={25}>±25 ord</option>
              <option value={35}>±35 ord</option>
              <option value={50}>±50 ord</option>
            </select>
          </div>

          <div className="field-inline" title="Antall treff i utvalget (sampleSize)">
            <label htmlFor={sampleSelectId}>Utvalg (treff):</label>
            <select
              id={sampleSelectId}
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
            >
              <option value={1000}>1 000</option>
              <option value={2000}>2 000</option>
              <option value={5000}>5 000</option>
              <option value={15000}>15 000</option>
              <option value={30000}>30 000</option>
              <option value={50000}>50 000</option>
            </select>
          </div>

          <div
            className="field-inline"
            title="Maks antall treff per bok (perBook). 1 = bredest spredning over flest mulig bøker, 10–50 = raskere oppslag i færre bøker."
          >
            <label htmlFor={perBookSelectId}>Treff/bok:</label>
            <select
              id={perBookSelectId}
              value={perBook}
              onChange={(e) => setPerBook(Number(e.target.value))}
            >
              <option value={1}>1 (flest bøker)</option>
              <option value={3}>3 pr. bok</option>
              <option value={5}>5 pr. bok</option>
              <option value={10}>10 pr. bok</option>
              <option value={25}>25 pr. bok</option>
              <option value={50}>50 pr. bok</option>
            </select>
          </div>

          <div className="checkbox-inline">
            <input
              id={foldCheckId}
              type="checkbox"
              checked={foldCase}
              onChange={(e) => setFoldCase(e.target.checked)}
            />
            <label htmlFor={foldCheckId}>Slå sammen A/a</label>
          </div>

          <div className="checkbox-inline">
            <input
              id={hidePunctCheckId}
              type="checkbox"
              checked={hidePunct}
              onChange={(e) => setHidePunct(e.target.checked)}
            />
            <label htmlFor={hidePunctCheckId}>Skjul tegn</label>
          </div>

          <div className="field-inline">
            <label htmlFor={filterInputId} className="visually-hidden">
              Filtrer ord i kollokasjonslisten
            </label>
            <input
              id={filterInputId}
              type="search"
              placeholder="Filtrer kollokat…"
              value={wordFilter}
              onChange={(e) => setWordFilter(e.target.value)}
              style={{ inlineSize: '150px' }}
            />
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={exportExcel}
            disabled={
              loading ||
              (!mainData && !beforeData)
            }
          >
            Excel (.xlsx)
          </button>
        </div>

        {activeStats && (
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {activeStats.hits.toLocaleString('nb-NO')} treff fra{' '}
            {activeStats.books.toLocaleString('nb-NO')} {t.booksUnit} · μ₀ ={' '}
            <strong>{activeStats.mu0.toFixed(2)}</strong> ·{' '}
            <strong className="speed-highlight">{clientMs} ms</strong>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {loading && (
        <div role="status" aria-live="polite" className="coll-progress-card">
          <div className="coll-progress-top">
            <span className="spinner" aria-hidden="true" />
            <div>
              <strong>
                Beregner kollokasjoner og avstander (<code>dist</code> /{' '}
                <code>bdist</code>) for «{parsed.raw}»…
              </strong>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                Utvalg: opptil {sampleSize.toLocaleString('nb-NO')} treff (maks{' '}
                {perBook} pr. bok, vindu ±{collWindow} ord) ·{' '}
                <strong>{elapsedSec.toFixed(1)} s</strong>
              </div>
            </div>
          </div>
          <div className="coll-progress-track" aria-hidden="true">
            <div className="coll-progress-fill" />
          </div>
        </div>
      )}

      {/* 1. ENKELTTABELL (Begge sider, Kun foran eller Kun etter) */}
      {dirMode !== 'split' && mainData && (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper"
        >
          <table>
            <caption id={captionId} className="visually-hidden">
              Kollokasjoner for {parsed.raw}
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" aria-sort={getAriaSort('word')}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => handleHeaderSort('word')}
                  >
                    <span>Kollokat (ord)</span>
                    {renderSortArrow('word')}
                  </button>
                </th>
                <th scope="col" aria-sort={getAriaSort('counts')}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => handleHeaderSort('counts')}
                  >
                    <span>Antall (counts)</span>
                    {renderSortArrow('counts')}
                  </button>
                </th>
                <th scope="col" aria-sort={getAriaSort('counts')}>
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => handleHeaderSort('counts')}
                  >
                    <span>Andel av treff</span>
                    {renderSortArrow('counts')}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={getAriaSort('dist')}
                  title="Snittavstand i antall ord fra målordet/ankeret (1.00 = rett ved siden av)"
                >
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => handleHeaderSort('dist')}
                  >
                    <span>Snittavstand (dist)</span>
                    {renderSortArrow('dist')}
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={getAriaSort('bdist')}
                  title={`Bayesiansk avstand trukket mot nøytral avstand μ₀ = ${mainData.mu0.toFixed(
                    2
                  )}. Lavere enn μ₀ betyr at ordet står tett inntil søkeordet.`}
                >
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => handleHeaderSort('bdist')}
                  >
                    <span>Nærhet (bdist, μ₀={mainData.mu0.toFixed(1)})</span>
                    {renderSortArrow('bdist')}
                  </button>
                </th>
                <th scope="col">Konkordans</th>
              </tr>
            </thead>
            <tbody>
              {processedMain.slice(0, 400).map((row, idx) => {
                const validDist =
                  row.dist !== null &&
                  Math.abs(row.bdist - mainData.mu0) > 1e-4;
                const sharePct =
                  mainData.hits > 0
                    ? ((row.counts / mainData.hits) * 100).toFixed(1)
                    : '0.0';
                // Beregn en nærhetsindikator (hvor mye nærmere 1.0 ordet ligger enn mu0)
                const closenessRatio =
                  validDist && mainData.mu0 > 1
                    ? Math.max(
                        0,
                        Math.min(
                          1,
                          (mainData.mu0 - row.bdist) / (mainData.mu0 - 1)
                        )
                      )
                    : 0;

                return (
                  <tr key={row.word}>
                    <td className="muted">{idx + 1}</td>
                    <th scope="row">
                      <code>{row.word}</code>
                    </th>
                    <td>
                      <strong>{row.counts.toLocaleString('nb-NO')}</strong>
                    </td>
                    <td className="muted">{sharePct} %</td>
                    <td>{formatDistVal(row.dist, mainData.mu0, false)}</td>
                    <td>
                      <div className="bdist-cell">
                        <strong>
                          {formatDistVal(row.bdist, mainData.mu0, true)}
                        </strong>
                        {validDist && closenessRatio > 0.05 && (
                          <span
                            className="closeness-bar"
                            style={{
                              inlineSize: `${Math.round(closenessRatio * 56)}px`,
                            }}
                            title={`Tett på ankeret (bdist ${row.bdist.toFixed(
                              2
                            )} vs. nøytral μ₀ ${mainData.mu0.toFixed(2)})`}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => onInspectInConcordance(row.word)}
                      >
                        {t.showBtn}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. DELT VISNING: FORAN | ETTER SIDE OM SIDE */}
      {dirMode === 'split' && beforeData && afterData && (
        <div className="split-collocations-grid">
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Ord foran søkeordet">
            <table>
              <caption className="table-caption">
                ← Foran «{parsed.anchorWord ?? parsed.terms[0]?.replace(/^\^/, '')}» (−{collWindow} ord · μ₀={beforeData.mu0.toFixed(1)})
              </caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={getAriaSort('word')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('word')}
                    >
                      <span>Ord foran</span>
                      {renderSortArrow('word')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={getAriaSort('counts')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('counts')}
                    >
                      <span>Antall</span>
                      {renderSortArrow('counts')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={getAriaSort('dist')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('dist')}
                    >
                      <span>dist</span>
                      {renderSortArrow('dist')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={getAriaSort('bdist')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('bdist')}
                    >
                      <span>bdist</span>
                      {renderSortArrow('bdist')}
                    </button>
                  </th>
                  <th scope="col">KWIC</th>
                </tr>
              </thead>
              <tbody>
                {processedBefore.slice(0, 200).map((row) => (
                  <tr key={row.word}>
                    <th scope="row">
                      <code>{row.word}</code>
                    </th>
                    <td>
                      <strong>{row.counts.toLocaleString('nb-NO')}</strong>
                    </td>
                    <td>{formatDistVal(row.dist, beforeData.mu0, false)}</td>
                    <td>
                      <strong>
                        {formatDistVal(row.bdist, beforeData.mu0, true)}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => onInspectInConcordance(row.word)}
                      >
                        {t.showBtn}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Ord etter søkeordet">
            <table>
              <caption className="table-caption">
                Etter «{parsed.anchorWord ?? parsed.terms[0]?.replace(/^\^/, '')}» → (+{collWindow} ord · μ₀={afterData.mu0.toFixed(1)})
              </caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={getAriaSort('word')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('word')}
                    >
                      <span>Ord etter</span>
                      {renderSortArrow('word')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={getAriaSort('counts')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('counts')}
                    >
                      <span>Antall</span>
                      {renderSortArrow('counts')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={getAriaSort('dist')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('dist')}
                    >
                      <span>dist</span>
                      {renderSortArrow('dist')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={getAriaSort('bdist')}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleHeaderSort('bdist')}
                    >
                      <span>bdist</span>
                      {renderSortArrow('bdist')}
                    </button>
                  </th>
                  <th scope="col">KWIC</th>
                </tr>
              </thead>
              <tbody>
                {processedAfter.slice(0, 200).map((row) => (
                  <tr key={row.word}>
                    <th scope="row">
                      <code>{row.word}</code>
                    </th>
                    <td>
                      <strong>{row.counts.toLocaleString('nb-NO')}</strong>
                    </td>
                    <td>{formatDistVal(row.dist, afterData.mu0, false)}</td>
                    <td>
                      <strong>
                        {formatDistVal(row.bdist, afterData.mu0, true)}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => onInspectInConcordance(row.word)}
                      >
                        {t.showBtn}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
