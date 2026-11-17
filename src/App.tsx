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
} from './api';
import { ConcordanceView } from './components/ConcordanceView';
import { CorpusBuilder } from './components/CorpusBuilder';
import { CountSeriesItem, OverviewTab } from './components/OverviewTab';
import { SERIES_COLORS, TrendChart, TrendSeriesItem } from './components/TrendChart';

type TabId = 'overview' | 'concordance' | 'trends';

const RECENT_STORAGE_KEY = 'neo_dhlab_recent_queries_v1';
const SAVED_CORPORA_KEY = 'neo_dhlab_saved_corpora_v1';
const THEME_VOLUME_KEY = 'neo_dhlab_theme_volume_v1';

type ThemeVolume = 'calm' | 'peach' | 'dark';

function loadThemeVolume(): ThemeVolume {
  try {
    const val = localStorage.getItem(THEME_VOLUME_KEY);
    if (val === 'calm' || val === 'peach' || val === 'dark') return val;
  } catch {
    // ignore storage errors
  }
  return 'calm';
}

interface SavedCorpusEntry {
  id: string;
  label: string;
  corpusToken: string;
  size: number;
  sourceDescription: string;
  savedAt: string;
}

function loadSavedCorpora(): SavedCorpusEntry[] {
  try {
    const raw = localStorage.getItem(SAVED_CORPORA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore storage errors
  }
  return [];
}

const DEFAULT_RECENT_QUERIES: string[] = [
  'demokrati, diktatur',
  'demokrati diktatur',
  'demokrati ^diktatur',
  '"i forhold til"',
  'krig fred Europa',
  'sjarken og, ^sjarken og',
  'og i',
  'og',
];

function loadRecentQueries(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return DEFAULT_RECENT_QUERIES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_RECENT_QUERIES;
}

export const App: React.FC = () => {
  const searchInputId = useId();
  const windowSliderId = useId();
  const symmetricCheckId = useId();

  const [baseUrl] = useState<string>(DEFAULT_BASE_URL);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthMs, setHealthMs] = useState<number | null>(null);
  const [themeVolume, setThemeVolume] = useState<ThemeVolume>(loadThemeVolume);

  const handleThemeChange = (next: ThemeVolume) => {
    setThemeVolume(next);
    try {
      localStorage.setItem(THEME_VOLUME_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  // Corpus context state
  const [corpus, setCorpus] = useState<ActiveCorpus>({
    enabled: false,
    label: 'Hele samlingen',
    corpusToken: null,
    filterIds: [],
    size: 0,
    sourceDescription: '',
  });
  const [corpusDialogOpen, setCorpusDialogOpen] = useState<boolean>(false);
  const [savedCorpora, setSavedCorpora] = useState<SavedCorpusEntry[]>(loadSavedCorpora);
  const [corpusMenuOpen, setCorpusMenuOpen] = useState<boolean>(false);

  // Active option tab ABOVE the search input
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Search expression state + recent queries in localStorage
  const [queryText, setQueryText] = useState<string>('demokrati, diktatur');
  const [windowSize, setWindowSize] = useState<number>(5);
  const [symmetric, setSymmetric] = useState<boolean>(true);
  const [recentQueries, setRecentQueries] = useState<string[]>(loadRecentQueries);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);

  // Counting state
  const [countItems, setCountItems] = useState<CountSeriesItem[]>([]);
  const [pendingCountQueries, setPendingCountQueries] = useState<string[]>([]);
  const [countLoading, setCountLoading] = useState<boolean>(false);
  const [countError, setCountError] = useState<string | null>(null);

  // Trend state
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

  const abortRef = useRef<AbortController | null>(null);

  const startNewRequest = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return ctrl.signal;
  };

  const rememberQuery = useCallback((q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setRecentQueries((prev) => {
      const next = [clean, ...prev.filter((item) => item !== clean)].slice(0, 15);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

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
    [baseUrl, corpus, parsedList]
  );

  // 2. Sequential trend queue
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
    [baseUrl, corpus, endYear, parsedList, startYear]
  );

  // 3. Concordance query
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
        const { data, clientMs } = await fetchConcordancePublic(
          baseUrl,
          customParsed,
          customCorpus,
          opts,
          signal
        );
        setConcData(data);
        setConcMs(clientMs);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setConcError(err instanceof Error ? err.message : String(err));
      } finally {
        setConcLoading(false);
      }
    },
    [activeConcParsed, baseUrl, concOptions, corpus]
  );

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
    setHistoryOpen(false);
    rememberQuery(queryText);
    if (activeTab !== 'trends') setTrendSeries([]);
    if (activeTab !== 'concordance') setConcData(null);
    if (activeTab !== 'overview') setCountItems([]);
    runForActiveTab(parsedList, activeTab, corpus);
  };

  const handleSelectQuery = (q: string) => {
    setQueryText(q);
    setHistoryOpen(false);
    rememberQuery(q);
    const nextList = parseMultiSearchQuery(q, windowSize, symmetric).filter(
      (p) => p.terms.length > 0
    );
    if (activeTab !== 'trends') setTrendSeries([]);
    if (activeTab !== 'concordance') setConcData(null);
    if (activeTab !== 'overview') setCountItems([]);
    runForActiveTab(nextList, activeTab, corpus);
  };

  const handleCorpusUpdate = (nextCorpus: ActiveCorpus) => {
    setCorpus(nextCorpus);
    setCorpusMenuOpen(false);
    if (nextCorpus.enabled && nextCorpus.corpusToken && nextCorpus.size > 0) {
      setSavedCorpora((prev) => {
        const entry: SavedCorpusEntry = {
          id: `${Date.now()}`,
          label: nextCorpus.label,
          corpusToken: nextCorpus.corpusToken!,
          size: nextCorpus.size,
          sourceDescription: nextCorpus.sourceDescription,
          savedAt: new Date().toLocaleDateString('nb-NO'),
        };
        const filtered = prev.filter(
          (c) =>
            c.corpusToken !== entry.corpusToken && c.label !== entry.label
        );
        const next = [entry, ...filtered].slice(0, 25);
        try {
          localStorage.setItem(SAVED_CORPORA_KEY, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    }
    setTrendSeries([]);
    setConcData(null);
    setCountItems([]);
    runForActiveTab(parsedList, activeTab, nextCorpus);
  };

  const handleDeleteSavedCorpus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedCorpora((prev) => {
      const next = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem(SAVED_CORPORA_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
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

  const anyMultiWord = parsedList.some(
    (p) => p.matchMode !== 'sequence' && p.terms.length >= 2
  );

  return (
    <div className="nb-page" data-volume={themeVolume}>
      <header className="nb-header">
        <div className="nb-header__wrapper">
          <a
            href="https://www.nb.no/"
            target="_blank"
            rel="noreferrer"
            className="nb-brand-link"
            aria-label="Nasjonalbiblioteket"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 17 24"
              height="22"
              width="16"
              aria-hidden="true"
              className="nb-brand-logo"
            >
              <path d="M1.4 7.8c.6 0 1.1-.5 1.1-1.1s-.5-1-1.1-1C.8 5.7.3 6.2.3 6.8c0 .5.5 1 1.1 1zM12.2 23.7c.6 0 1.1-.5 1.1-1.1 0-.6-.5-1.1-1.1-1.1-.6 0-1.1.5-1.1 1.1 0 .7.5 1.1 1.1 1.1zM4.1.3v19.8h12.6V.3H4.1zm2.7 7.5c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1zm5.3 10.6c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm0-5.3c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm0-5.3c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1z" />
            </svg>
            <span className="nb-brand-main">Nasjonalbiblioteket</span>
            <span className="nb-brand-sub">DHLAB · Korpusmotor</span>
          </a>

          <div className="header-right">
            <select
              aria-label="Fargevolum (NB stilmanual)"
              className="volume-select"
              value={themeVolume}
              onChange={(e) =>
                handleThemeChange(e.target.value as ThemeVolume)
              }
            >
              <option value="calm">Profil: Rolig (N-gram)</option>
              <option value="peach">Profil: NB Fersken 20</option>
              <option value="dark">Profil: NB Aubergine (Mørk)</option>
            </select>

            <span
              className={`status-pill ${
                health?.status === 'ok' ? 'status-ok' : 'status-wait'
              }`}
            >
              <span className="status-dot" aria-hidden="true" />
              {health?.status === 'ok' ? `${healthMs} ms` : 'API'}
            </span>
          </div>
        </div>
      </header>

      <div className="app-shell">

      {/* KORPUS-KONTEKST */}
      <section className="context-bar-card" aria-label="Korpus (kontekst for søket)">
        <div className="context-bar-row">
          <div className="context-step-info">
            <span className="step-badge">Korpus</span>
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
                <span className="muted">(713 913 bøker · 38,5 mrd. ord)</span>
              </div>
            )}
          </div>

          <div className="context-actions" style={{ position: 'relative' }}>
            {savedCorpora.length > 0 && (
              <button
                type="button"
                className="history-dropdown-btn"
                aria-expanded={corpusMenuOpen}
                onClick={() => setCorpusMenuOpen((v) => !v)}
              >
                Mine korpus ({savedCorpora.length}) ▾
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCorpusMenuOpen(false);
                setCorpusDialogOpen(true);
              }}
            >
              {corpus.size > 0 ? 'Nytt / endre korpus…' : 'Definer korpus…'}
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
                Hele samlingen
              </button>
            )}

            {corpusMenuOpen && (
              <div
                className="history-menu"
                style={{
                  insetInlineStart: 'auto',
                  insetInlineEnd: 0,
                  inlineSize: 'min(420px, 90vw)',
                }}
                role="listbox"
                aria-label="Mine lagrede korpus"
              >
                <div className="history-menu-header">
                  <span>Mine korpus (lagret i nettleseren)</span>
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() => setCorpusMenuOpen(false)}
                  >
                    Lukk
                  </button>
                </div>
                <button
                  type="button"
                  className="history-item-btn"
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
                  <strong>Hele boksamlingen</strong>{' '}
                  <span className="muted">(713 913 bøker)</span>
                </button>
                {savedCorpora.map((sc) => (
                  <div
                    key={sc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.4rem',
                    }}
                  >
                    <button
                      type="button"
                      className="history-item-btn"
                      style={{ flex: 1 }}
                      onClick={() =>
                        handleCorpusUpdate({
                          enabled: true,
                          label: sc.label,
                          corpusToken: sc.corpusToken,
                          filterIds: [],
                          size: sc.size,
                          sourceDescription: sc.sourceDescription,
                        })
                      }
                    >
                      <strong>{sc.label}</strong>{' '}
                      <span className="muted">
                        ({sc.size.toLocaleString('nb-NO')} bøker)
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-tiny"
                      aria-label={`Slett ${sc.label}`}
                      onClick={(e) => handleDeleteSavedCorpus(sc.id, e)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
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
      />

      {/* HOVEDKORT: OPSJONER ØVERST -> SØKEFELT UNDER -> RESULTAT */}
      <main className="main-workspace">
        <div className="tabs">
          {/* Opsjoner i større font over søkefeltet */}
          <div
            role="tablist"
            aria-label="Velg analysemodus"
            className="tablist prominent-tablist"
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

          {/* Søkefelt inne i arbeidsflaten under opsjonene */}
          <search className="inline-search-bar" aria-label="Søk i valgt modus">
            <form onSubmit={handleFormSubmit} className="command-form">
              <div className="omnibox-wrapper">
                <label htmlFor={searchInputId} className="visually-hidden">
                  Søkeuttrykk
                </label>
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

                  <button
                    type="button"
                    className="history-dropdown-btn"
                    aria-label="Vis siste søk"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((v) => !v)}
                  >
                    Siste søk ▾
                  </button>

                  <button
                    type="submit"
                    className="btn-submit-search"
                    disabled={isBusy || parsedList.length === 0}
                  >
                    {isBusy ? 'Søker…' : 'Søk'}
                  </button>
                </div>

                {/* Dropdown med siste søk fra localStorage */}
                {historyOpen && (
                  <div className="history-menu" role="listbox" aria-label="Siste søk">
                    <div className="history-menu-header">
                      <span>Siste søk (lagret i nettleseren)</span>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => setHistoryOpen(false)}
                      >
                        Lukk
                      </button>
                    </div>
                    {recentQueries.map((rq) => (
                      <button
                        key={rq}
                        type="button"
                        className="history-item-btn"
                        onClick={() => handleSelectQuery(rq)}
                      >
                        <code>{rq}</code>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="search-options-row">
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {parsedList.length > 1
                    ? `${parsedList.length} uttrykk (komma-separert)`
                    : parsedList[0]?.predictedModeLabel}
                </span>

                <fieldset className="window-fieldset">
                  <legend className="visually-hidden">Nærhetsvindu</legend>
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

          {/* Aktiv fane-resultat */}
          {activeTab === 'overview' && (
            <div role="tabpanel" aria-labelledby="tab-overview">
              <OverviewTab
                baseUrl={baseUrl}
                items={countItems}
                pendingQueries={pendingCountQueries}
                corpus={corpus}
                loading={countLoading}
                error={countError}
                onFetchConcordanceFor={(targetParsed) => {
                  setSelectedConcQuery(targetParsed);
                  setActiveTab('concordance');
                  void executeConcordanceSearch(targetParsed, concOptions, corpus);
                }}
                onSelectQuery={handleSelectQuery}
                onSwitchTab={handleTabSelect}
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
      </div>
    </div>
  );
};
