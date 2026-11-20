import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActiveCorpus,
  BookMetadataRow,
  buildNearQueryPayload,
  checkHealth,
  ConcordanceResponse,
  DEFAULT_BASE_URL,
  fetchConcordancePublic,
  fetchMetadata,
  fetchNearCount,
  fetchYearTrend,
  HealthResponse,
  ParsedQuery,
  parseMultiSearchQuery,
  resolveEffectiveCorpus,
} from './api';
import { ConcordanceView } from './components/ConcordanceView';
import { CorpusBuilder } from './components/CorpusBuilder';
import { DispersionView } from './components/DispersionView';
import { HelpDialog } from './components/HelpDialog';
import { CountSeriesItem, OverviewTab } from './components/OverviewTab';
import { SERIES_COLORS, TrendChart, TrendSeriesItem } from './components/TrendChart';
import { TRANSLATIONS, UI_LANG_OPTIONS, UiLang } from './i18n';

type TabId = 'overview' | 'concordance' | 'trends' | 'dispersion';

const RECENT_STORAGE_KEY = 'neo_dhlab_recent_queries_v1';
const SAVED_CORPORA_KEY = 'neo_dhlab_saved_corpora_v1';
const THEME_VOLUME_KEY = 'neo_dhlab_theme_volume_v1';
const UI_LANG_KEY = 'neo_dhlab_ui_lang_v1';

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

function loadUiLang(): UiLang {
  try {
    const val = localStorage.getItem(UI_LANG_KEY) as UiLang | null;
    if (val && val in TRANSLATIONS) return val;
  } catch {
    // ignore storage errors
  }
  return 'no';
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
  'NEAR(skib storm, 10)',
  '(skib OR skip) storm',
  '"demokrati diktatur"~10',
  '"i forhold til"',
  'krig fred Europa',
  'sjarken og, ^sjarken og',
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
  const [uiLang, setUiLang] = useState<UiLang>(loadUiLang);
  const t = TRANSLATIONS[uiLang];

  const handleThemeChange = (next: ThemeVolume) => {
    setThemeVolume(next);
    try {
      localStorage.setItem(THEME_VOLUME_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const handleLangChange = (next: UiLang) => {
    setUiLang(next);
    document.documentElement.lang = next === 'no' ? 'nb' : next;
    try {
      localStorage.setItem(UI_LANG_KEY, next);
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
  const [helpDialogOpen, setHelpDialogOpen] = useState<boolean>(false);
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

  // Bibliografisk metadata-cache (dhlabid -> BookMetadataRow) + valgte bøker for narrativ bue
  const [metadataById, setMetadataById] = useState<Record<number, BookMetadataRow>>({});
  const [dispersionBookIds, setDispersionBookIds] = useState<number[]>([]);
  const [submittedDispParsedList, setSubmittedDispParsedList] = useState<ParsedQuery[]>(
    () => parseMultiSearchQuery('demokrati, diktatur', 5, true)
  );

  const mergeMetadataRows = useCallback((rows: BookMetadataRow[]) => {
    if (!rows || rows.length === 0) return;
    setMetadataById((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        next[r.dhlabid] = { ...next[r.dhlabid], ...r };
      }
      return next;
    });
  }, []);

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

  const allParsedList = useMemo(
    () => parseMultiSearchQuery(queryText, windowSize, symmetric),
    [queryText, windowSize, symmetric]
  );

  const anyParseError = useMemo(
    () => allParsedList.find((p) => p.parseError)?.parseError ?? null,
    [allParsedList]
  );

  const activeDialect = useMemo(() => {
    if (
      allParsedList.some(
        (p) =>
          p.syntaxDialect === 'fts5' &&
          (/\bWHERE\b/.test(p.raw) ||
            /^\s*\{.+\|.+\}\s*$/.test(p.raw) ||
            /\^\S+/.test(p.raw) ||
            /,\s*\+\d+/.test(p.raw) ||
            /,\s*(?:false|true|asym|sym|ordered|->)\s*\)/i.test(p.raw))
      )
    ) {
      return 'FTS5+';
    }
    if (allParsedList.some((p) => p.syntaxDialect === 'fts5')) return 'FTS5';
    if (allParsedList.some((p) => p.syntaxDialect === 'elastic')) return 'Elastic';
    return null;
  }, [allParsedList]);

  const parsedList = useMemo(
    () => allParsedList.filter((p) => p.terms.length > 0 && !p.parseError),
    [allParsedList]
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
          const { corpus: effCorpus, extraMs } = await resolveEffectiveCorpus(
            baseUrl,
            itemParsed,
            customCorpus,
            signal
          );
          if (signal.aborted) return;
          const payload = buildNearQueryPayload(itemParsed, effCorpus);
          const { data, clientMs } = await fetchNearCount(baseUrl, payload, signal);
          if (signal.aborted) return;

          setCountItems((prev) => [
            ...prev,
            {
              parsed: itemParsed,
              result: data,
              clientMs: clientMs + extraMs,
              payload,
            },
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
          const { corpus: effCorpus, extraMs } = await resolveEffectiveCorpus(
            baseUrl,
            itemParsed,
            customCorpus,
            signal
          );
          if (signal.aborted) return;
          const payload = buildNearQueryPayload(itemParsed, effCorpus, {
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
              clientMs: clientMs + extraMs,
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
        const { corpus: effCorpus, extraMs } = await resolveEffectiveCorpus(
          baseUrl,
          customParsed,
          customCorpus,
          signal
        );
        const { data, clientMs } = await fetchConcordancePublic(
          baseUrl,
          customParsed,
          effCorpus,
          opts,
          signal
        );
        setConcData(data);
        setConcMs(clientMs + extraMs);

        // Hent bibliografiske metadata for alle unike dhlabid i konkordansen i ett raskt kall
        const uniqueIds = Array.from(new Set(data.rows.map((r) => r.dhlabid)));
        if (uniqueIds.length > 0) {
          fetchMetadata(
            baseUrl,
            {
              dhlabids: uniqueIds.slice(0, 1000),
              fields: ['urn', 'title', 'authors', 'year'],
            },
            signal
          )
            .then(({ data: metaRes }) => {
              if (!signal.aborted && metaRes.rows) {
                mergeMetadataRows(metaRes.rows);
              }
            })
            .catch(() => {});
        }
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
    setSubmittedDispParsedList(targetList);
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
    if (nextTab === 'dispersion') {
      setSubmittedDispParsedList(parsedList);
    } else if (nextTab === 'trends' && trendSeries.length === 0) {
      void executeTrendQueue(parsedList, startYear, endYear, corpus);
    } else if (
      nextTab === 'concordance' &&
      !concData &&
      activeConcParsed
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
    dispersion: null,
  });

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: t.tabCounts },
    { id: 'concordance', label: t.tabConcordance },
    { id: 'trends', label: t.tabTrends },
    { id: 'dispersion', label: 'Vonnegut-bue' },
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

  const anyMultiWord =
    !activeDialect &&
    parsedList.some((p) => p.matchMode !== 'sequence' && p.terms.length >= 2);

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
            <span className="nb-brand-sub">{t.brandSub}</span>
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
              <option value="calm">{t.profileCalm}</option>
              <option value="peach">{t.profilePeach}</option>
              <option value="dark">{t.profileDark}</option>
            </select>

            <button
              type="button"
              className="info-header-btn"
              onClick={() => setHelpDialogOpen(true)}
              aria-label={t.helpTitle}
              title={t.helpTitle}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{t.helpBtn}</span>
            </button>

            <div className="lang-globe-wrap" title={t.langLabel}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="globe-icon"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <select
                aria-label={t.langLabel}
                className="lang-select"
                value={uiLang}
                onChange={(e) => handleLangChange(e.target.value as UiLang)}
              >
                {UI_LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code} title={l.label}>
                    {l.short}
                  </option>
                ))}
              </select>
            </div>

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
      <section className="context-bar-card" aria-label={t.corpusBadge}>
        <div className="context-bar-row">
          <div className="context-step-info">
            <span className="step-badge">{t.corpusBadge}</span>
            {corpus.enabled && corpus.size > 0 ? (
              <div className="corpus-active-summary">
                <strong>{corpus.label}</strong>
                <span className="badge-accent">
                  {corpus.size.toLocaleString('nb-NO')} {t.booksUnit}
                </span>
                <span className="muted">{corpus.sourceDescription}</span>
              </div>
            ) : (
              <div className="corpus-active-summary">
                <strong>{t.wholeCollection}</strong>
                <span className="muted">(713 913 {t.booksUnit} · {t.billionWords})</span>
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
                {t.myCorpora} ({savedCorpora.length}) ▾
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
              {corpus.size > 0 ? t.editCorpus : t.defineCorpus}
            </button>

            {corpus.size > 0 && (
              <button
                type="button"
                className="btn-tiny"
                onClick={() =>
                  handleCorpusUpdate({
                    enabled: false,
                    label: t.resetCorpus,
                    corpusToken: null,
                    filterIds: [],
                    size: 0,
                    sourceDescription: '',
                  })
                }
              >
                {t.resetCorpus}
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
                aria-label={t.myCorpora}
              >
                <div className="history-menu-header">
                  <span>{t.myCorpora}</span>
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() => setCorpusMenuOpen(false)}
                  >
                    {t.closeBtn}
                  </button>
                </div>
                <button
                  type="button"
                  className="history-item-btn"
                  onClick={() =>
                    handleCorpusUpdate({
                      enabled: false,
                      label: t.resetCorpus,
                      corpusToken: null,
                      filterIds: [],
                      size: 0,
                      sourceDescription: '',
                    })
                  }
                >
                  <strong>{t.wholeCollection}</strong>{' '}
                  <span className="muted">(713 913 {t.booksUnit})</span>
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
                        ({sc.size.toLocaleString('nb-NO')} {t.booksUnit})
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
        t={t}
        onCorpusChange={handleCorpusUpdate}
        onClose={() => setCorpusDialogOpen(false)}
      />

      <HelpDialog
        open={helpDialogOpen}
        t={t}
        onClose={() => setHelpDialogOpen(false)}
        onTryQuery={handleSelectQuery}
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
            {tabs.map((tabItem, idx) => {
              const selected = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  ref={(el) => {
                    tabRefs.current[tabItem.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${tabItem.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  {...(selected
                    ? ({ focusgroupstart: '' } as Record<string, string>)
                    : {})}
                  onClick={() => handleTabSelect(tabItem.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  {tabItem.label}
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
                    placeholder={t.searchPlaceholder}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="search"
                    onChange={(e) => setQueryText(e.target.value)}
                  />

                  <button
                    type="button"
                    className="history-dropdown-btn"
                    aria-label={t.recentSearches}
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((v) => !v)}
                  >
                    {t.recentSearches}
                  </button>

                  <button
                    type="submit"
                    className="btn-submit-search"
                    disabled={isBusy || parsedList.length === 0 || Boolean(anyParseError)}
                  >
                    {isBusy ? t.searchingBtn : t.searchBtn}
                  </button>
                </div>

                {anyParseError && (
                  <div
                    role="alert"
                    className="error-banner"
                    style={{ marginBlockStart: '0.5rem', fontSize: '0.875rem' }}
                  >
                    {anyParseError}
                  </div>
                )}

                {/* Dropdown med siste søk fra localStorage */}
                {historyOpen && (
                  <div className="history-menu" role="listbox" aria-label={t.recentSearchesHeader}>
                    <div className="history-menu-header">
                      <span>{t.recentSearchesHeader}</span>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => setHistoryOpen(false)}
                      >
                        {t.closeBtn}
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
                  {activeDialect && (
                    <span className="badge-mode" style={{ marginInlineEnd: '0.45rem' }}>
                      {activeDialect}
                    </span>
                  )}
                  {anyParseError
                    ? t.fixSyntaxHint
                    : parsedList.length > 1
                    ? `${parsedList.length} ${t.expressionsCount}`
                    : parsedList[0]?.predictedModeLabel}
                </span>

                <fieldset className="window-fieldset">
                  <legend className="visually-hidden">{t.windowLabel}</legend>
                  <div className="slider-wrap">
                    <label htmlFor={windowSliderId}>
                      {t.windowLabel}: <strong>{windowSize}</strong>
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
                    <label htmlFor={symmetricCheckId}>{t.symmetricLabel}</label>
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
                t={t}
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
                metadataById={metadataById}
                clientMs={concMs}
                loading={concLoading}
                error={concError}
                limit={concOptions.limit}
                before={concOptions.before}
                after={concOptions.after}
                t={t}
                onOptionsChange={setConcOptions}
                onFetch={() =>
                  void executeConcordanceSearch(activeConcParsed, concOptions, corpus)
                }
                onOpenDispersionForBook={(dhlabid) => {
                  setSubmittedDispParsedList(parsedList);
                  setDispersionBookIds((prev) =>
                    prev.includes(dhlabid)
                      ? prev
                      : [dhlabid, ...prev].slice(0, 10)
                  );
                  setActiveTab('dispersion');
                }}
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
                t={t}
              />
            </div>
          )}

          {activeTab === 'dispersion' && (
            <div role="tabpanel" aria-labelledby="tab-dispersion">
              <DispersionView
                t={t}
                baseUrl={baseUrl}
                corpus={corpus}
                parsedList={submittedDispParsedList}
                selectedBookIds={dispersionBookIds}
                onSelectedBookIdsChange={setDispersionBookIds}
                knownMetadata={metadataById}
                onNewMetadata={mergeMetadataRows}
                candidateBookIdsFromConcordance={
                  concData
                    ? Array.from(new Set(concData.rows.map((r) => r.dhlabid)))
                    : []
                }
              />
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
};
