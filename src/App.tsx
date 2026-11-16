import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActiveCorpus,
  buildNearQueryPayload,
  checkHealth,
  ConcordanceResponse,
  DEFAULT_BASE_URL,
  fetchConcordancePublic,
  fetchNearCount,
  fetchYearTrend,
  HealthResponse,
  ParsedQuery,
  parseMultiSearchQuery,
  SearchLogEntry,
} from './api';
import { ConcordanceView } from './components/ConcordanceView';
import { CorpusBuilder } from './components/CorpusBuilder';
import { CountSeriesItem, OverviewTab } from './components/OverviewTab';
import { SERIES_COLORS, TrendChart, TrendSeriesItem } from './components/TrendChart';

type TabId = 'overview' | 'concordance' | 'trends';

const EXAMPLE_QUERIES: string[] = [
  'og',
  'og i',
  '"i forhold til"',
  'demokrati, diktatur',
  'demokrati diktatur',
  'demokrati ^diktatur',
  'sjarken og, ^sjarken og',
];

export const App: React.FC = () => {
  const searchInputId = useId();
  const windowSliderId = useId();
  const symmetricCheckId = useId();

  const [baseUrl] = useState<string>(DEFAULT_BASE_URL);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthMs, setHealthMs] = useState<number | null>(null);

  // Step 1: Corpus context state
  const [corpus, setCorpus] = useState<ActiveCorpus>({
    enabled: false,
    label: 'Hele samlingen',
    corpusToken: null,
    filterIds: [],
    size: 0,
    sourceDescription: '',
  });
  const [corpusDialogOpen, setCorpusDialogOpen] = useState<boolean>(false);

  // Step 2: Search expression state (supports comma-separated expressions)
  const [queryText, setQueryText] = useState<string>('demokrati, diktatur');
  const [windowSize, setWindowSize] = useState<number>(5);
  const [symmetric, setSymmetric] = useState<boolean>(true);

  // Step 3: Active analysis tab [Telling | Konkordans | Trender]
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Counting state (supports 1 or more sequential expressions)
  const [countItems, setCountItems] = useState<CountSeriesItem[]>([]);
  const [pendingCountQueries, setPendingCountQueries] = useState<string[]>([]);
  const [countLoading, setCountLoading] = useState<boolean>(false);
  const [countError, setCountError] = useState<string | null>(null);

  // Trend state (supports 1 or more sequential curves)
  const [trendSeries, setTrendSeries] = useState<TrendSeriesItem[]>([]);
  const [pendingTrendQueries, setPendingTrendQueries] = useState<string[]>([]);
  const [trendLoading, setTrendLoading] = useState<boolean>(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [startYear] = useState<number>(1800);
  const [endYear] = useState<number>(2025);

  // Concordance state
  const [selectedConcQuery, setSelectedConcQuery] = useState<ParsedQuery | null>(null);
  const [concData, setConcData] = useState<ConcordanceResponse | null>(null);
  const [concMs, setConcMs] = useState<number | null>(null);
  const [concLoading, setConcLoading] = useState<boolean>(false);
  const [concError, setConcError] = useState<string | null>(null);
  const [concOptions, setConcOptions] = useState<{
    limit: number;
    before: number;
    after: number;
  }>({
    limit: 30,
    before: 10,
    after: 10,
  });

  // Compact search log
  const [searchLog, setSearchLog] = useState<SearchLogEntry[]>([]);

  // AbortController so only 1 sequential queue runs at a time
  const abortRef = useRef<AbortController | null>(null);

  const startNewRequest = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return ctrl.signal;
  };

  const parsedList = useMemo(
    () =>
      parseMultiSearchQuery(queryText, windowSize, symmetric).filter(
        (p) => p.terms.length > 0
      ),
    [queryText, windowSize, symmetric]
  );

  const activeConcParsed = useMemo(() => {
    if (
      selectedConcQuery &&
      parsedList.some((p) => p.raw === selectedConcQuery.raw)
    ) {
      return selectedConcQuery;
    }
    return parsedList[0] ?? parseMultiSearchQuery('', windowSize, symmetric)[0];
  }, [parsedList, selectedConcQuery, symmetric, windowSize]);

  const appendLog = useCallback(
    (entry: {
      endpoint: string;
      queryText: string;
      modeLabel: string;
      total?: number;
      docs?: number;
      clientMs: number;
      engine?: string;
      payload: Record<string, unknown>;
    }) => {
      const timeStr = new Date().toTimeString().slice(0, 8);
      setSearchLog((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: timeStr,
          endpoint: entry.endpoint,
          queryText: entry.queryText,
          modeLabel: entry.modeLabel,
          total: entry.total,
          docs: entry.docs,
          clientMs: entry.clientMs,
          engine: entry.engine,
          corpusActive: corpus.enabled && corpus.size > 0,
          corpusSize: corpus.enabled ? corpus.size : undefined,
          payload: entry.payload,
        },
        ...prev.slice(0, 14),
      ]);
    },
    [corpus.enabled, corpus.size]
  );

  useEffect(() => {
    checkHealth(baseUrl)
      .then(({ data, clientMs }) => {
        setHealth(data);
        setHealthMs(clientMs);
      })
      .catch(() => setHealth(null));
  }, [baseUrl]);

  // 1. Sequential counting queue
  const executeCountQueue = useCallback(
    async (list = parsedList, customCorpus = corpus) => {
      if (list.length === 0) return;
      const signal = startNewRequest();
      setCountLoading(true);
      setCountError(null);
      setCountItems([]);
      setPendingCountQueries(list.map((p) => p.raw));

      try {
        for (let i = 0; i < list.length; i++) {
          if (signal.aborted) return;
          const itemParsed = list[i];
          const payload = buildNearQueryPayload(itemParsed, customCorpus);
          const { data, clientMs } = await fetchNearCount(baseUrl, payload, signal);
          if (signal.aborted) return;

          setCountItems((prev) => [
            ...prev,
            { parsed: itemParsed, result: data, clientMs, payload },
          ]);
          setPendingCountQueries(list.slice(i + 1).map((p) => p.raw));

          appendLog({
            endpoint: '/near_query',
            queryText: itemParsed.raw,
            modeLabel: data.countMode || itemParsed.predictedModeLabel,
            total: data.total,
            docs: data.docs,
            clientMs,
            engine: data._engine,
            payload,
          });
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setCountError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!signal.aborted) {
          setPendingCountQueries([]);
          setCountLoading(false);
        }
      }
    },
    [appendLog, baseUrl, corpus, parsedList]
  );

  // 2. Sequential trend queue (curves appear one by one as calculated)
  const executeTrendQueue = useCallback(
    async (
      list = parsedList,
      sYear = startYear,
      eYear = endYear,
      customCorpus = corpus
    ) => {
      if (list.length === 0) return;
      const signal = startNewRequest();
      setTrendLoading(true);
      setTrendError(null);
      setTrendSeries([]);
      setPendingTrendQueries(list.map((p) => p.raw));

      try {
        for (let i = 0; i < list.length; i++) {
          if (signal.aborted) return;
          const itemParsed = list[i];
          const payload = buildNearQueryPayload(itemParsed, customCorpus, {
            startYear: sYear,
            endYear: eYear,
          });
          const { data, clientMs } = await fetchYearTrend(baseUrl, payload, signal);
          if (signal.aborted) return;

          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          setTrendSeries((prev) => [
            ...prev,
            {
              query: itemParsed.raw,
              color,
              rows: data.rows,
              countMode: data.countMode,
              clientMs,
              serverMs: data.responseMs,
            },
          ]);
          setPendingTrendQueries(list.slice(i + 1).map((p) => p.raw));

          appendLog({
            endpoint: 'year-count',
            queryText: itemParsed.raw,
            modeLabel: 'Trend',
            clientMs,
            engine: data._engine,
            payload: { ...payload, mode: 'year-count' },
          });
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setTrendError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!signal.aborted) {
          setPendingTrendQueries([]);
          setTrendLoading(false);
        }
      }
    },
    [appendLog, baseUrl, corpus, endYear, parsedList, startYear]
  );

  // 3. Concordance query (for one chosen expression)
  const executeConcordanceSearch = useCallback(
    async (
      customParsed = activeConcParsed,
      opts = concOptions,
      customCorpus = corpus
    ) => {
      if (!customParsed || customParsed.terms.length === 0) return;
      const signal = startNewRequest();
      setConcLoading(true);
      setConcError(null);
      try {
        const { data, clientMs, payload } = await fetchConcordancePublic(
          baseUrl,
          customParsed,
          customCorpus,
          opts,
          signal
        );
        setConcData(data);
        setConcMs(clientMs);
        appendLog({
          endpoint: '/concordance_public',
          queryText: customParsed.raw,
          modeLabel: `${data.lines} linjer`,
          total: data.lines,
          docs: data.books,
          clientMs,
          payload,
        });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setConcError(err instanceof Error ? err.message : String(err));
      } finally {
        setConcLoading(false);
      }
    },
    [activeConcParsed, appendLog, baseUrl, concOptions, corpus]
  );

  // Run ONLY the active tab's query queue
  const runForActiveTab = (
    targetList = parsedList,
    tab = activeTab,
    targetCorpus = corpus
  ) => {
    if (tab === 'overview') {
      void executeCountQueue(targetList, targetCorpus);
    } else if (tab === 'trends') {
      void executeTrendQueue(targetList, startYear, endYear, targetCorpus);
    } else if (tab === 'concordance') {
      const targetConc = targetList[0];
      if (targetConc) {
        setSelectedConcQuery(targetConc);
        void executeConcordanceSearch(targetConc, concOptions, targetCorpus);
      }
    }
  };

  useEffect(() => {
    void executeCountQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'trends') setTrendSeries([]);
    if (activeTab !== 'concordance') setConcData(null);
    if (activeTab !== 'overview') setCountItems([]);
    runForActiveTab(parsedList, activeTab, corpus);
  };

  const handleRunExample = (exampleQuery: string) => {
    setQueryText(exampleQuery);
    const nextList = parseMultiSearchQuery(
      exampleQuery,
      windowSize,
      symmetric
    ).filter((p) => p.terms.length > 0);
    if (activeTab !== 'trends') setTrendSeries([]);
    if (activeTab !== 'concordance') setConcData(null);
    if (activeTab !== 'overview') setCountItems([]);
    runForActiveTab(nextList, activeTab, corpus);
  };

  const handleCorpusUpdate = (nextCorpus: ActiveCorpus) => {
    setCorpus(nextCorpus);
    setTrendSeries([]);
    setConcData(null);
    setCountItems([]);
    runForActiveTab(parsedList, activeTab, nextCorpus);
  };

  const handleTabSelect = (nextTab: TabId) => {
    setActiveTab(nextTab);
    if (nextTab === 'trends' && trendSeries.length === 0) {
      void executeTrendQueue(parsedList, startYear, endYear, corpus);
    } else if (
      nextTab === 'concordance' &&
      !concData &&
      activeConcParsed &&
      !activeConcParsed.hasWildcardOrGroup
    ) {
      void executeConcordanceSearch(activeConcParsed, concOptions, corpus);
    } else if (nextTab === 'overview' && countItems.length === 0) {
      void executeCountQueue(parsedList, corpus);
    }
  };

  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    overview: null,
    concordance: null,
    trends: null,
  });

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Telling' },
    { id: 'concordance', label: 'Konkordans' },
    { id: 'trends', label: 'Trender' },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = tabs[nextIdx];
      tabRefs.current[targetTab.id]?.focus();
      handleTabSelect(targetTab.id);
    }
  };

  const isBusy = countLoading || trendLoading || concLoading;

  const badgeLabel =
    parsedList.length > 1
      ? `${parsedList.length} søk i sekvens`
      : parsedList[0]?.predictedModeLabel ?? 'Skriv søkeord';

  const anyMultiWord = parsedList.some(
    (p) => p.matchMode !== 'sequence' && p.terms.length >= 2
  );

  return (
    <div className="app-shell">
      <header className="compact-header">
        <div className="brand-group">
          <span className="brand-badge">ft_bok</span>
          <h1>Korpusmotor (Arena)</h1>
        </div>
        <span
          className={`status-pill ${health?.status === 'ok' ? 'status-ok' : 'status-wait'}`}
        >
          <span className="status-dot" aria-hidden="true" />
          {health?.status === 'ok' ? `API klar (${healthMs} ms)` : 'API'}
        </span>
      </header>

      {/* STEG 1: KORPUS (KONTEKST FOR SØK) */}
      <section className="context-bar-card" aria-label="Steg 1: Korpus (kontekst for søket)">
        <div className="context-bar-row">
          <div className="context-step-info">
            <span className="step-badge">1. Korpus</span>
            {corpus.enabled && corpus.size > 0 ? (
              <div className="corpus-active-summary">
                <strong>{corpus.label}</strong>
                <span className="badge-accent">
                  {corpus.size.toLocaleString('nb-NO')} bøker
                </span>
                <span className="muted">{corpus.sourceDescription}</span>
              </div>
            ) : (
              <div className="corpus-active-summary">
                <strong>Hele boksamlingen</strong>
                <span className="tab-badge">713 913 bøker · 38,5 mrd. tokens</span>
              </div>
            )}
          </div>

          <div className="context-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCorpusDialogOpen(true)}
            >
              {corpus.size > 0 ? 'Endre korpus…' : 'Velg / last opp korpus…'}
            </button>

            {corpus.size > 0 && (
              <button
                type="button"
                className="btn-tiny"
                onClick={() =>
                  handleCorpusUpdate({
                    enabled: false,
                    label: 'Hele samlingen',
                    corpusToken: null,
                    filterIds: [],
                    size: 0,
                    sourceDescription: '',
                  })
                }
              >
                Nullstill
              </button>
            )}
          </div>
        </div>
      </section>

      <CorpusBuilder
        open={corpusDialogOpen}
        baseUrl={baseUrl}
        corpus={corpus}
        onCorpusChange={handleCorpusUpdate}
        onClose={() => setCorpusDialogOpen(false)}
        onLog={appendLog}
      />

      {/* STEG 2: SØKEUTTRYKK */}
      <search className="command-dock" aria-label="Steg 2: Søkeuttrykk">
        <form onSubmit={handleFormSubmit} className="command-form">
          <div className="omnibox-row">
            <div className="step-header-inline">
              <span className="step-badge">2. Søkeuttrykk</span>
              <label htmlFor={searchInputId} className="command-label-inline">
                Enkeltord, ordpar, <code>^anker</code> eller <code>"frase"</code> – bruk komma (<code>,</code>) for å sammenligne flere
              </label>
            </div>
            <div className="omnibox-container">
              <input
                id={searchInputId}
                name="q"
                type="search"
                className="omnibox-input"
                value={queryText}
                placeholder='Søk: demokrati, diktatur eller demokrati ^diktatur, "i forhold til"'
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                onChange={(e) => setQueryText(e.target.value)}
              />
              <span className="syntax-live-badge">{badgeLabel}</span>
              <button
                type="submit"
                className="btn-submit-search"
                disabled={isBusy || parsedList.length === 0}
              >
                {isBusy ? 'Kjører…' : 'Søk'}
              </button>
            </div>
          </div>

          <div className="subbar-row">
            <div className="examples-bar" aria-label="Eksempelsøk">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`example-chip ${
                    queryText.trim() === q ? 'example-chip-active' : ''
                  }`}
                  onClick={() => handleRunExample(q)}
                >
                  <code>{q}</code>
                </button>
              ))}
            </div>

            <fieldset className="window-fieldset">
              <legend className="visually-hidden">Vindu</legend>
              <div className="slider-wrap">
                <label htmlFor={windowSliderId}>
                  Vindu: <strong>{windowSize}</strong>
                </label>
                <input
                  id={windowSliderId}
                  type="range"
                  min={1}
                  max={50}
                  value={windowSize}
                  disabled={!anyMultiWord}
                  onChange={(e) => setWindowSize(Number(e.target.value))}
                />
              </div>
              <div className="checkbox-inline">
                <input
                  type="checkbox"
                  id={symmetricCheckId}
                  checked={symmetric}
                  disabled={!anyMultiWord}
                  onChange={(e) => setSymmetric(e.target.checked)}
                />
                <label htmlFor={symmetricCheckId}>Symmetrisk</label>
              </div>
            </fieldset>
          </div>
        </form>
      </search>

      {/* STEG 3: VELG ANALYSE [TELLING | KONKORDANS | TRENDER] */}
      <main className="main-workspace">
        <div className="tabs">
          <div className="tabs-header-bar">
            <span className="step-badge">3. Analyse</span>
            <div
              role="tablist"
              aria-label="Velg mellom Telling, Konkordans og Trender"
              className="tablist"
              {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
            >
              {tabs.map((t, idx) => {
                const selected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      tabRefs.current[t.id] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    {...(selected
                      ? ({ focusgroupstart: '' } as Record<string, string>)
                      : {})}
                    onClick={() => handleTabSelect(t.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'overview' && (
            <div role="tabpanel" aria-labelledby="tab-overview">
              <OverviewTab
                baseUrl={baseUrl}
                items={countItems}
                pendingQueries={pendingCountQueries}
                corpus={corpus}
                loading={countLoading}
                error={countError}
                concData={concData}
                concMs={concMs}
                concLoading={concLoading}
                onFetchConcordanceFor={(targetParsed) => {
                  setSelectedConcQuery(targetParsed);
                  setActiveTab('concordance');
                  void executeConcordanceSearch(targetParsed, concOptions, corpus);
                }}
                onSelectQuery={handleRunExample}
                onSwitchTab={handleTabSelect}
                onLog={appendLog}
              />
            </div>
          )}

          {activeTab === 'concordance' && (
            <div role="tabpanel" aria-labelledby="tab-concordance">
              <ConcordanceView
                queryText={activeConcParsed.raw}
                parsed={activeConcParsed}
                parsedList={parsedList}
                onSelectParsed={(p) => {
                  setSelectedConcQuery(p);
                  void executeConcordanceSearch(p, concOptions, corpus);
                }}
                data={concData}
                clientMs={concMs}
                loading={concLoading}
                error={concError}
                limit={concOptions.limit}
                before={concOptions.before}
                after={concOptions.after}
                onOptionsChange={setConcOptions}
                onFetch={() =>
                  void executeConcordanceSearch(activeConcParsed, concOptions, corpus)
                }
              />
            </div>
          )}

          {activeTab === 'trends' && (
            <div role="tabpanel" aria-labelledby="tab-trends">
              {trendError && (
                <div className="panel-inner">
                  <div role="alert" className="error-banner">
                    {trendError}
                  </div>
                </div>
              )}
              <TrendChart
                seriesList={trendSeries}
                pendingQueries={pendingTrendQueries}
                loading={trendLoading}
              />
            </div>
          )}
        </div>
      </main>

      {/* Compact horizontal log strip at the bottom */}
      {searchLog.length > 0 && (
        <footer className="log-footer" aria-label="Siste søk og svartider">
          <span className="log-footer-title">Siste kall:</span>
          <div className="log-strip">
            {searchLog.slice(0, 6).map((item) => (
              <span key={item.id} className="log-pill">
                <code>{item.queryText}</code>
                <span className="muted">({item.endpoint})</span>
                <strong className="log-ms-inline">{item.clientMs} ms</strong>
              </span>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
};
