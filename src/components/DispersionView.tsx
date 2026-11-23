import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActiveCorpus,
  BookMetadataRow,
  buildCorpusRequest,
  buildNbItemUrl,
  DispersionBookResult,
  DispersionResponse,
  fetchDispersion,
  fetchMetadata,
  normalizeAuthorName,
  ParsedQuery,
} from '../api';
import { downloadExcelFile } from '../excelExport';
import { UiStrings } from '../i18n';
import { SERIES_COLORS } from './TrendChart';

interface DispersionViewProps {
  t: UiStrings;
  baseUrl: string;
  corpus: ActiveCorpus;
  parsedList: ParsedQuery[];
  selectedBookIds: number[];
  onSelectedBookIdsChange: (ids: number[]) => void;
  knownMetadata: Record<number, BookMetadataRow>;
  onNewMetadata: (rows: BookMetadataRow[]) => void;
  candidateBookIdsFromConcordance: number[];
}

type AxisMode = 'bins' | 'window';
type MultiBookLayout = 'sum' | 'concat' | 'stack';
type ValueMetric = 'per1000' | 'raw';

export const DispersionView: React.FC<DispersionViewProps> = ({
  t,
  baseUrl,
  corpus,
  parsedList,
  selectedBookIds,
  onSelectedBookIdsChange,
  knownMetadata,
  onNewMetadata,
  candidateBookIdsFromConcordance,
}) => {
  const modeSelectId = useId();
  const smoothSelectId = useId();
  const bookPickerInputId = useId();
  const strokeWidthSliderId = useId();
  const strokeAlphaSliderId = useId();

  const [axisMode, setAxisMode] = useState<AxisMode>('bins');
  const [binsCount, setBinsCount] = useState<number>(100);
  const [windowTokens, setWindowTokens] = useState<number>(1000);
  const [multiLayout, setMultiLayout] = useState<MultiBookLayout>('concat');
  const [valueMetric, setValueMetric] = useState<ValueMetric>('per1000');
  const [smoothing, setSmoothing] = useState<number>(5);

  const [showStyleBox, setShowStyleBox] = useState<boolean>(false);
  const [lineWidth, setLineWidth] = useState<number>(2.4);
  const [lineAlpha, setLineAlpha] = useState<number>(0.92);
  const [fillArea, setFillArea] = useState<boolean>(true);

  const [dispData, setDispData] = useState<DispersionResponse | null>(null);
  const [dispMs, setDispMs] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [corpusSampleBooks, setCorpusSampleBooks] = useState<BookMetadataRow[]>([]);
  const [authorSearchBooks, setAuthorSearchBooks] = useState<BookMetadataRow[]>([]);
  const [bookSearchText, setBookSearchText] = useState<string>('');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Per-bok cache for /dispersion slik at vi aldri henter allerede beregnede bøker på nytt når man legger til/fjerner en bok!
  const bookDispCacheRef = useRef<
    Map<string, { labels: string[]; window: number | null; bins: number | null; book: DispersionBookResult }>
  >(new Map());

  // Trekk ut opptil 10 søkeord / OR-grupper fra alle uttrykkene i søkefeltet
  const dispersionGroups = useMemo(() => {
    const groups: string[][] = [];
    const seen = new Set<string>();

    for (const p of parsedList) {
      const rawGroups =
        p.termGroups && p.termGroups.length > 0
          ? p.termGroups
          : p.terms.map((w) => [w]);
      for (const g of rawGroups) {
        const cleaned = g
          .map((w) => w.replace(/^\^/, '').trim())
          .filter(Boolean);
        if (cleaned.length === 0) continue;
        const key = cleaned.join('|').toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          groups.push(cleaned);
        }
        if (groups.length >= 10) break;
      }
      if (groups.length >= 10) break;
    }
    return groups;
  }, [parsedList]);

  // Hent et utvalg bøker fra aktivt korpus (hvis korpuset har <= 1000 bøker) eller konkordans-kandidater
  useEffect(() => {
    let cancelled = false;
    const loadCandidateBooks = async () => {
      try {
        if (corpus.enabled && corpus.corpusToken && corpus.size > 0 && corpus.size <= 1000) {
          const { data } = await fetchMetadata(baseUrl, {
            corpusToken: corpus.corpusToken,
            fields: ['urn', 'title', 'authors', 'year'],
          });
          if (!cancelled && data.rows.length > 0) {
            onNewMetadata(data.rows);
            const sorted = [...data.rows].sort(
              (a, b) => (a.year ?? 9999) - (b.year ?? 9999)
            );
            setCorpusSampleBooks(sorted);
            if (selectedBookIds.length === 0) {
              onSelectedBookIdsChange([sorted[0].dhlabid]);
            }
          }
        } else if (candidateBookIdsFromConcordance.length > 0) {
          const missingIds = candidateBookIdsFromConcordance.filter(
            (id) => !knownMetadata[id]
          );
          if (missingIds.length > 0) {
            const { data } = await fetchMetadata(baseUrl, {
              dhlabids: missingIds.slice(0, 200),
              fields: ['urn', 'title', 'authors', 'year'],
            });
            if (!cancelled && data.rows.length > 0) {
              onNewMetadata(data.rows);
            }
          }
          if (!cancelled && selectedBookIds.length === 0) {
            onSelectedBookIdsChange([candidateBookIdsFromConcordance[0]]);
          }
        }
      } catch {
        // ignore metadata prefetch error
      }
    };
    void loadCandidateBooks();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    baseUrl,
    candidateBookIdsFromConcordance,
    corpus.corpusToken,
    corpus.enabled,
    corpus.size,
  ]);

  // Sikre at vi har metadata for alle valgte bøker
  useEffect(() => {
    const missing = selectedBookIds.filter((id) => !knownMetadata[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    fetchMetadata(baseUrl, {
      dhlabids: missing,
      fields: ['urn', 'title', 'authors', 'year'],
    })
      .then(({ data }) => {
        if (!cancelled && data.rows.length > 0) {
          onNewMetadata(data.rows);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [baseUrl, knownMetadata, onNewMetadata, selectedBookIds]);

  // Sorter valgte bøker kronologisk på utgivelsesår når flere bøker vises
  const orderedSelectedIds = useMemo(() => {
    return [...selectedBookIds].sort((a, b) => {
      const ya = knownMetadata[a]?.year ?? 9999;
      const yb = knownMetadata[b]?.year ?? 9999;
      if (ya !== yb) return ya - yb;
      return a - b;
    });
  }, [knownMetadata, selectedBookIds]);

  // Kjør /dispersion når valgte bøker, ordgrupper eller modus endres (henter KUN bøker som ikke allerede ligger i bookDispCacheRef!)
  useEffect(() => {
    if (orderedSelectedIds.length === 0 || dispersionGroups.length === 0) {
      setDispData(null);
      return;
    }

    const useBins =
      axisMode === 'bins' ||
      (orderedSelectedIds.length > 1 && multiLayout === 'sum');
    const querySignature = JSON.stringify({
      groups: dispersionGroups,
      mode: useBins ? `bins:${binsCount}` : `win:${Math.max(100, windowTokens)}`,
    });

    const targetIds = orderedSelectedIds.slice(0, 10);
    const missingIds = targetIds.filter(
      (id) => !bookDispCacheRef.current.has(`${querySignature}::${id}`)
    );

    const buildFromCache = (): DispersionResponse | null => {
      const books: DispersionBookResult[] = [];
      let labels: string[] = dispersionGroups.map((g) => g.join('|'));
      let winVal: number | null = useBins ? null : Math.max(100, windowTokens);
      let binsVal: number | null = useBins ? binsCount : null;

      for (const id of targetIds) {
        const hit = bookDispCacheRef.current.get(`${querySignature}::${id}`);
        if (hit) {
          books.push(hit.book);
          labels = hit.labels;
          winVal = hit.window;
          binsVal = hit.bins;
        }
      }
      if (books.length === 0) return null;
      return {
        labels,
        window: winVal,
        bins: binsVal,
        books,
        missing: [],
      };
    };

    // Vis det vi allerede har i cachen umiddelbart uten å blanke ut grafen!
    const partial = buildFromCache();
    if (partial) {
      setDispData(partial);
    }

    if (missingIds.length === 0) {
      setDispMs(0);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const req: {
          dhlabids: number[];
          terms?: string[];
          termGroups?: string[][];
          window?: number;
          bins?: number;
        } = {
          dhlabids: missingIds,
        };
        const anyGroupMulti = dispersionGroups.some((g) => g.length > 1);
        if (anyGroupMulti) {
          req.termGroups = dispersionGroups;
        } else {
          req.terms = dispersionGroups.map((g) => g[0]);
        }

        if (useBins) {
          req.bins = binsCount;
        } else {
          req.window = Math.max(100, windowTokens);
        }

        const { data, clientMs } = await fetchDispersion(
          baseUrl,
          req,
          ctrl.signal
        );
        for (const b of data.books) {
          bookDispCacheRef.current.set(`${querySignature}::${b.dhlabid}`, {
            labels: data.labels,
            window: data.window,
            bins: data.bins,
            book: b,
          });
        }
        const merged = buildFromCache();
        if (merged) {
          setDispData(merged);
        } else {
          setDispData(data);
        }
        setDispMs(clientMs);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => ctrl.abort();
  }, [
    axisMode,
    baseUrl,
    binsCount,
    dispersionGroups,
    multiLayout,
    orderedSelectedIds,
    windowTokens,
  ]);

  // Når brukeren skriver 2+ bokstaver i bok-søkefeltet (f.eks. "Fosse"), søk etter forfatter via /corpus/facets
  // slik at korpuset holder seg under /metadata sin grense på 1000 bøker!
  useEffect(() => {
    const q = bookSearchText.trim();
    if (q.length < 2 || /^\d+$/.test(q)) {
      setAuthorSearchBooks([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const cap = q.charAt(0).toUpperCase() + q.slice(1);
        const req: { query: Record<string, unknown>; corpusToken?: string } = {
          query: { k: 'authors', prefix: `${cap} ` },
        };
        if (corpus.enabled && corpus.corpusToken) {
          req.corpusToken = corpus.corpusToken;
        }
        // Søk både på "Etternavn ," og "Etternavn," (som unngår f.eks. Fossestøl/Fossen når man søker Fosse, og holder antall bøker <= 1000)
        const queryNode: Record<string, unknown> = {
          or: [
            { k: 'authors', prefix: `${cap} ,` },
            { k: 'authors', prefix: `${cap},` },
          ],
        };
        req.query = queryNode;
        let { data: cRes } = await buildCorpusRequest(baseUrl, req);
        // Hvis aktivt korpus ikke inneholdt denne forfatteren, prøv i hele samlingen
        if (cRes.size === 0 && req.corpusToken) {
          const globalRes = await buildCorpusRequest(baseUrl, { query: queryNode });
          if (globalRes.data.size > 0 && globalRes.data.size <= 1000) {
            cRes = globalRes.data;
          }
        }
        if (cRes.size === 0 || cRes.size > 1000) {
          // Fallback til vanlig prefix hvis brukersøket allerede inneholder komma/fornavn eller var kort
          const fbReq: { query: Record<string, unknown>; corpusToken?: string } = {
            query: { k: 'authors', prefix: cap },
          };
          if (corpus.enabled && corpus.corpusToken) {
            fbReq.corpusToken = corpus.corpusToken;
          }
          const fb = await buildCorpusRequest(baseUrl, fbReq);
          if (fb.data.size > 0 && fb.data.size <= 1000) {
            cRes = fb.data;
          }
        }
        if (cancelled || !cRes.corpusToken || cRes.size === 0 || cRes.size > 1000) {
          if (!cancelled) setAuthorSearchBooks([]);
          return;
        }
        const { data: mRes } = await fetchMetadata(baseUrl, {
          corpusToken: cRes.corpusToken,
          fields: ['urn', 'title', 'authors', 'year'],
        });
        if (!cancelled && mRes.rows) {
          onNewMetadata(mRes.rows);
          setAuthorSearchBooks(mRes.rows);
        }
      } catch {
        if (!cancelled) setAuthorSearchBooks([]);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [baseUrl, bookSearchText, corpus.corpusToken, corpus.enabled, onNewMetadata]);

  // Tilgjengelige bøker å velge fra (kombinasjon av korpusbøker, forfattersøk og konkordansbøker)
  const selectableBooks = useMemo(() => {
    const map = new Map<number, BookMetadataRow>();
    for (const b of authorSearchBooks) {
      map.set(b.dhlabid, b);
    }
    for (const b of corpusSampleBooks) {
      if (!map.has(b.dhlabid)) map.set(b.dhlabid, b);
    }
    for (const id of candidateBookIdsFromConcordance) {
      if (!map.has(id)) {
        map.set(id, knownMetadata[id] ?? { dhlabid: id });
      }
    }
    for (const id of selectedBookIds) {
      if (!map.has(id)) {
        map.set(id, knownMetadata[id] ?? { dhlabid: id });
      }
    }
    const all = Array.from(map.values()).sort(
      (a, b) => (a.year ?? 9999) - (b.year ?? 9999)
    );
    const qTokens = bookSearchText
      .trim()
      .toLowerCase()
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (qTokens.length === 0) return all;
    return all.filter((b) => {
      const str = `${b.dhlabid} ${b.year ?? ''} ${b.title ?? ''} ${
        b.authors ?? ''
      }`.toLowerCase();
      return qTokens.every((tok) => str.includes(tok));
    });
  }, [
    authorSearchBooks,
    bookSearchText,
    candidateBookIdsFromConcordance,
    corpusSampleBooks,
    knownMetadata,
    selectedBookIds,
  ]);

  const toggleBook = (id: number) => {
    if (selectedBookIds.includes(id)) {
      onSelectedBookIdsChange(selectedBookIds.filter((x) => x !== id));
    } else if (selectedBookIds.length < 10) {
      onSelectedBookIdsChange([...selectedBookIds, id]);
    }
  };

  const handleAddManualId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bookSearchText.trim();
    if (/^\d{8,10}$/.test(trimmed)) {
      const id = parseInt(trimmed, 10);
      if (!selectedBookIds.includes(id) && selectedBookIds.length < 10) {
        onSelectedBookIdsChange([...selectedBookIds, id]);
        setBookSearchText('');
      }
    }
  };

  // Hjelpefunksjon for glatting (glidende snitt) av en tallrekke
  const smoothArray = (arr: number[], win: number): number[] => {
    const half = win <= 1 ? 0 : Math.floor(win / 2);
    if (half === 0) return arr;
    return arr.map((_, idx) => {
      const lo = Math.max(0, idx - half);
      const hi = Math.min(arr.length - 1, idx + half);
      let s = 0;
      for (let i = lo; i <= hi; i++) s += arr[i];
      return s / (hi - lo + 1);
    });
  };

  // Konverter rå counts for en bok til enten per 1000 ord eller råtall, og glatt
  const normalizeBookSeries = (
    countsForGroup: number[],
    totalBookTokens: number,
    winParam: number | null
  ): number[] => {
    const nSegments = Math.max(1, countsForGroup.length);
    const rawOrPer1000 = countsForGroup.map((c, idx) => {
      if (valueMetric === 'raw') return c;
      if (winParam) {
        // Siste vindu kan være kortere
        const isLast = idx === nSegments - 1;
        const rem = totalBookTokens - idx * winParam;
        const segTokens = isLast && rem > 0 ? rem : winParam;
        return segTokens > 0 ? (c / segTokens) * 1000 : 0;
      }
      const segTokens = totalBookTokens / nSegments;
      return segTokens > 0 ? (c / segTokens) * 1000 : 0;
    });
    return smoothArray(rawOrPer1000, smoothing);
  };

  // Sorter bøker i dispData i samme kronologiske rekkefølge som orderedSelectedIds
  const orderedDispBooks = useMemo(() => {
    if (!dispData) return [];
    const byId = new Map(dispData.books.map((b) => [b.dhlabid, b]));
    return orderedSelectedIds
      .map((id) => byId.get(id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b));
  }, [dispData, orderedSelectedIds]);

  // Bygg serier for hovedgrafen (enten 1 bok, sum over bøker, eller konkatenert forfatterskap etter hverandre)
  const mainChartData = useMemo(() => {
    if (!dispData || orderedDispBooks.length === 0) return null;

    // Tilfelle A: Sum / Snitt oppå hverandre (0–100 % av boka)
    if (orderedDispBooks.length > 1 && multiLayout === 'sum') {
      const nBins = dispData.bins ?? orderedDispBooks[0].counts[0]?.length ?? 100;
      const totalTokensAll = orderedDispBooks.reduce((acc, b) => acc + b.tokens, 0);
      const series = dispData.labels.map((label, gIdx) => {
        const sumCounts = new Array<number>(nBins).fill(0);
        for (const b of orderedDispBooks) {
          const cArr = b.counts[gIdx] ?? [];
          for (let i = 0; i < nBins; i++) {
            sumCounts[i] += cArr[i] ?? 0;
          }
        }
        const rawHits = sumCounts.reduce((a, v) => a + v, 0);
        const values = normalizeBookSeries(sumCounts, totalTokensAll, null);
        return {
          label,
          color: SERIES_COLORS[gIdx % SERIES_COLORS.length],
          values,
          rawCounts: sumCounts,
          totalHits: rawHits,
        };
      });
      return {
        kind: 'sum' as const,
        xCount: nBins,
        boundaries: [] as { startIdx: number; endIdx: number; dhlabid: number; label: string }[],
        series,
      };
    }

    // Tilfelle B: Etter hverandre (utvikling fra bok til bok på én felles tidslinje) eller én enkelt bok
    if (orderedDispBooks.length === 1 || multiLayout === 'concat') {
      const boundaries: {
        startIdx: number;
        endIdx: number;
        dhlabid: number;
        label: string;
      }[] = [];
      let cursor = 0;
      for (const b of orderedDispBooks) {
        const len = b.counts[0]?.length ?? 0;
        const meta = knownMetadata[b.dhlabid];
        const shortTitle = (meta?.title ?? `${b.dhlabid}`).slice(0, 26);
        const yr = meta?.year ? `${meta.year} · ` : '';
        boundaries.push({
          startIdx: cursor,
          endIdx: cursor + len - 1,
          dhlabid: b.dhlabid,
          label: `${yr}${shortTitle}`,
        });
        cursor += len;
      }

      const series = dispData.labels.map((label, gIdx) => {
        const concatValues: number[] = [];
        const concatRaw: number[] = [];
        let totalHits = 0;

        for (const b of orderedDispBooks) {
          const cArr = b.counts[gIdx] ?? [];
          for (const c of cArr) totalHits += c;
          concatRaw.push(...cArr);
          const norm = normalizeBookSeries(cArr, b.tokens, dispData.window);
          concatValues.push(...norm);
        }

        return {
          label,
          color: SERIES_COLORS[gIdx % SERIES_COLORS.length],
          values: concatValues,
          rawCounts: concatRaw,
          totalHits,
        };
      });

      return {
        kind: 'concat' as const,
        xCount: Math.max(1, cursor),
        boundaries,
        series,
      };
    }

    return null;
  }, [
    dispData,
    knownMetadata,
    multiLayout,
    orderedDispBooks,
    smoothing,
    valueMetric,
  ]);

  // SVG dimensions
  const width = 920;
  const height = 340;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 28;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = useMemo(() => {
    let m = 0.0001;
    if (mainChartData) {
      for (const s of mainChartData.series) {
        for (const v of s.values) {
          if (v > m) m = v;
        }
      }
    } else if (dispData && orderedDispBooks.length > 0) {
      for (const b of orderedDispBooks) {
        dispData.labels.forEach((_, gIdx) => {
          const vals = normalizeBookSeries(
            b.counts[gIdx] ?? [],
            b.tokens,
            dispData.window
          );
          for (const v of vals) if (v > m) m = v;
        });
      }
    }
    return m;
  }, [dispData, mainChartData, orderedDispBooks, smoothing, valueMetric]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t);

  const exportPng = () => {
    if (!mainChartData || mainChartData.xCount === 0) return;
    const scale = 2;
    const legendHeight = 42;
    const totalH = height + legendHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    const rootStyle = getComputedStyle(document.documentElement);
    const bgSurface = rootStyle.getPropertyValue('--surface').trim() || '#ffffff';
    const textMain = rootStyle.getPropertyValue('--text').trim() || '#1e1c1a';
    const textMuted = rootStyle.getPropertyValue('--text-muted').trim() || '#615b53';
    const borderSubtle =
      rootStyle.getPropertyValue('--border-subtle').trim() || '#e4ded5';

    ctx.fillStyle = bgSurface;
    ctx.fillRect(0, 0, width, totalH);

    // Tittel + Legend
    ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
    let lx = padLeft;
    const ly = 24;
    for (const s of mainChartData.series) {
      const lbl = `${s.label} (${s.totalHits.toLocaleString('nb-NO')} treff)`;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(lx + 5, ly - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = textMain;
      ctx.fillText(lbl, lx + 15, ly);
      lx += ctx.measureText(lbl).width + 32;
    }

    ctx.save();
    ctx.translate(0, legendHeight);

    const getX = (idx: number) =>
      mainChartData.xCount <= 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (mainChartData.xCount - 1)) * plotW;
    const getY = (val: number) => padTop + plotH - (val / maxVal) * plotH;

    // Rutenett
    ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    yTicks.forEach((tv, idx) => {
      const y = getY(tv);
      ctx.strokeStyle = borderSubtle;
      ctx.lineWidth = 1;
      if (idx > 0) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = textMuted;
      ctx.fillText(
        valueMetric === 'raw' ? tv.toFixed(1) : tv.toFixed(2),
        padLeft - 8,
        y + 4
      );
    });
    ctx.setLineDash([]);

    // Bokgrenser hvis flere bøker etter hverandre
    if (mainChartData.boundaries.length > 1) {
      ctx.textAlign = 'center';
      for (let bIdx = 0; bIdx < mainChartData.boundaries.length; bIdx++) {
        const b = mainChartData.boundaries[bIdx];
        if (bIdx > 0) {
          const bx = getX(b.startIdx);
          ctx.strokeStyle = textMuted;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(bx, padTop);
          ctx.lineTo(bx, padTop + plotH);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const midX = (getX(b.startIdx) + getX(b.endIdx)) / 2;
        ctx.fillStyle = textMuted;
        ctx.fillText(b.label, midX, padTop - 8);
      }
    }

    // Kurver
    for (const s of mainChartData.series) {
      if (s.values.length === 0) continue;
      if (fillArea) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.4, lineAlpha * 0.22);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(getX(0), padTop + plotH);
        s.values.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
        ctx.lineTo(getX(s.values.length - 1), padTop + plotH);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = lineAlpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = getX(i);
        const y = getY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `narrativ_bue_${orderedSelectedIds.join('_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const exportExcel = () => {
    if (!dispData || orderedDispBooks.length === 0) return;
    const header: (string | number)[] = [
      'dhlabid',
      'year',
      'title',
      'authors',
      'segment',
      'book_tokens',
      ...dispData.labels.map((l) => `${l} (rå)`),
      ...dispData.labels.map((l) => `${l} (glattet)`),
    ];
    const rows: (string | number)[][] = [header];

    for (const b of orderedDispBooks) {
      const meta = knownMetadata[b.dhlabid];
      const nSeg = b.counts[0]?.length ?? 0;
      const smoothedPerGroup = dispData.labels.map((_, gIdx) =>
        normalizeBookSeries(b.counts[gIdx] ?? [], b.tokens, dispData.window)
      );
      for (let i = 0; i < nSeg; i++) {
        rows.push([
          b.dhlabid,
          meta?.year ?? '',
          meta?.title ?? '',
          normalizeAuthorName(meta?.authors),
          i + 1,
          b.tokens,
          ...dispData.labels.map((_, gIdx) => b.counts[gIdx]?.[i] ?? 0),
          ...dispData.labels.map((_, gIdx) =>
            Number((smoothedPerGroup[gIdx]?.[i] ?? 0).toFixed(3))
          ),
        ]);
      }
    }
    downloadExcelFile(
      `narrativ_bue_${orderedSelectedIds.join('_')}.xlsx`,
      rows
    );
  };

  return (
    <div className="panel-inner">
      {/* 1. BOKVELGER FRA KORPUS / KONKORDANS */}
      <section className="arc-book-selector-card" aria-label={t.tabDispersion}>
        <div className="arc-book-header">
          <div>
            <strong>{t.dispHeaderTitle(orderedSelectedIds.length)}</strong>{' '}
            <span className="muted" style={{ fontSize: '0.84rem' }}>
              {t.dispHeaderSub}
            </span>
          </div>

          <form onSubmit={handleAddManualId} className="field-inline">
            <label htmlFor={bookPickerInputId} className="visually-hidden">
              {t.dispFilterPlaceholder}
            </label>
            <input
              id={bookPickerInputId}
              type="search"
              placeholder={t.dispFilterPlaceholder}
              value={bookSearchText}
              onChange={(e) => setBookSearchText(e.target.value)}
              style={{ inlineSize: '250px', fontSize: '0.84rem' }}
            />
            {/^\d{8,10}$/.test(bookSearchText.trim()) && (
              <button type="submit" className="btn-tiny">
                {t.dispAddIdBtn}
              </button>
            )}
          </form>
        </div>

        {/* Valgte bøker som aktive piller med lenke til Nettbiblioteket */}
        {orderedSelectedIds.length > 0 && (
          <div className="selected-books-strip">
            {orderedSelectedIds.map((id) => {
              const meta = knownMetadata[id];
              const author = normalizeAuthorName(meta?.authors);
              const title = meta?.title?.trim() || `dhlabid ${id}`;
              const nbUrl = buildNbItemUrl(meta?.urn, parsedList[0] ?? {
                raw: '',
                terms: [],
                matchMode: 'near',
                window: 5,
                symmetric: true,
                anchorWord: null,
                hasWildcardOrGroup: false,
                hasOrGroup: false,
                predictedModeLabel: '',
                canComparePairAnchor: false,
                pairWords: null,
                syntaxDialect: 'native',
                parseError: null,
              });
              return (
                <div key={id} className="selected-book-pill">
                  <div className="selected-book-info">
                    {nbUrl ? (
                      <a
                        href={nbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="selected-book-link"
                        title={title}
                      >
                        <strong>{title}</strong>
                      </a>
                    ) : (
                      <strong>{title}</strong>
                    )}
                    <span className="muted">
                      {meta?.year ? `${meta.year}` : ''}
                      {meta?.year && author ? ' · ' : ''}
                      {author ? author.slice(0, 32) : `(${id})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pill-clear-btn"
                    aria-label={`${t.closeBtn} ${title}`}
                    onClick={() => toggleBook(id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {orderedSelectedIds.length > 1 && (
              <button
                type="button"
                className="btn-tiny"
                onClick={() => onSelectedBookIdsChange([orderedSelectedIds[0]])}
              >
                {t.dispKeepFirstBtn}
              </button>
            )}
          </div>
        )}

        {/* Nedtrekksliste / Kompakt rutenett med bøker fra korpuset eller konkordansen */}
        {selectableBooks.length > 0 && (
          <div className="candidate-books-scroll">
            {selectableBooks.slice(0, 200).map((b) => {
              const active = selectedBookIds.includes(b.dhlabid);
              const author = normalizeAuthorName(b.authors);
              const title = b.title?.trim() || `dhlabid ${b.dhlabid}`;
              return (
                <button
                  key={b.dhlabid}
                  type="button"
                  className={`candidate-book-chip ${
                    active ? 'candidate-book-chip-active' : ''
                  }`}
                  onClick={() => toggleBook(b.dhlabid)}
                  title={`${title} (${b.year ?? '?'}) – ${author}`}
                >
                  <span className="candidate-year">{b.year ?? '—'}</span>
                  <span className="candidate-title">{title}</span>
                  {author && <span className="candidate-author">{author}</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. VERKTØYLINJE FOR NARRATIV BUE */}
      <div className="trend-toolbar">
        <div className="conc-controls">
          <div className="field-inline">
            <label htmlFor={modeSelectId}>{t.dispAxisLabel}</label>
            <select
              id={modeSelectId}
              value={axisMode}
              onChange={(e) => setAxisMode(e.target.value as AxisMode)}
            >
              <option value="bins">{t.dispAxisBins(binsCount)}</option>
              <option value="window">{t.dispAxisWindow(windowTokens)}</option>
            </select>
          </div>

          {axisMode === 'bins' ? (
            <div className="field-inline">
              <label htmlFor={`${modeSelectId}-bins`}>{t.dispPartsLabel}</label>
              <select
                id={`${modeSelectId}-bins`}
                value={binsCount}
                onChange={(e) => setBinsCount(Number(e.target.value))}
              >
                <option value={20}>{t.dispPartsOption(20)}</option>
                <option value={50}>{t.dispPartsOption(50)}</option>
                <option value={100}>{t.dispPartsOption(100)} (%)</option>
                <option value={200}>{t.dispPartsOption(200)}</option>
              </select>
            </div>
          ) : (
            <div className="field-inline">
              <label htmlFor={`${modeSelectId}-win`}>{t.dispWordsPerWinLabel}</label>
              <select
                id={`${modeSelectId}-win`}
                value={windowTokens}
                onChange={(e) => setWindowTokens(Number(e.target.value))}
              >
                <option value={250}>250 {t.wordsUnit}</option>
                <option value={500}>500 {t.wordsUnit}</option>
                <option value={1000}>1 000 {t.wordsUnit}</option>
                <option value={2500}>2 500 {t.wordsUnit}</option>
                <option value={5000}>5 000 {t.wordsUnit}</option>
              </select>
            </div>
          )}

          {orderedSelectedIds.length > 1 && (
            <div className="field-inline">
              <label htmlFor={`${modeSelectId}-layout`}>{t.dispMultiBooksLabel}</label>
              <select
                id={`${modeSelectId}-layout`}
                value={multiLayout}
                onChange={(e) =>
                  setMultiLayout(e.target.value as MultiBookLayout)
                }
              >
                <option value="concat">{t.dispMultiConcat}</option>
                <option value="stack">{t.dispMultiStack}</option>
                <option value="sum">{t.dispMultiSum}</option>
              </select>
            </div>
          )}

          <div className="field-inline">
            <label htmlFor={`${modeSelectId}-metric`}>{t.dispMetricLabel}</label>
            <select
              id={`${modeSelectId}-metric`}
              value={valueMetric}
              onChange={(e) => setValueMetric(e.target.value as ValueMetric)}
            >
              <option value="per1000">{t.dispMetricPer1k}</option>
              <option value="raw">{t.dispMetricRaw}</option>
            </select>
          </div>
        </div>

        <div className="trend-controls-right">
          <div className="field-inline">
            <label htmlFor={smoothSelectId}>{t.smoothingLabel}:</label>
            <select
              id={smoothSelectId}
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
            >
              <option value={1}>{t.dispSmooth1}</option>
              <option value={3}>{t.dispSmooth3}</option>
              <option value={5}>{t.dispSmooth5}</option>
              <option value={9}>{t.dispSmooth9}</option>
              <option value={15}>{t.dispSmooth15}</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            aria-expanded={showStyleBox}
            onClick={() => setShowStyleBox((v) => !v)}
          >
            {t.curveStyleBtn}
          </button>

          {mainChartData && (
            <button
              type="button"
              className="btn-secondary"
              onClick={exportPng}
            >
              PNG
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={exportExcel}
            disabled={!dispData || orderedDispBooks.length === 0}
          >
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {showStyleBox && (
        <div className="curve-style-toolbox" role="region" aria-label={t.curveStyleBtn}>
          <div className="slider-wrap">
            <label htmlFor={strokeWidthSliderId}>
              {t.curveThicknessLabel} <strong>{lineWidth.toFixed(1)} px</strong>
            </label>
            <input
              id={strokeWidthSliderId}
              type="range"
              min={0.8}
              max={6}
              step={0.2}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
            />
          </div>

          <div className="slider-wrap">
            <label htmlFor={strokeAlphaSliderId}>
              {t.curveAlphaLabel} <strong>{Math.round(lineAlpha * 100)} %</strong>
            </label>
            <input
              id={strokeAlphaSliderId}
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={lineAlpha}
              onChange={(e) => setLineAlpha(Number(e.target.value))}
            />
          </div>

          <div className="checkbox-inline">
            <input
              id={`${strokeAlphaSliderId}-fill`}
              type="checkbox"
              checked={fillArea}
              onChange={(e) => setFillArea(e.target.checked)}
            />
            <label htmlFor={`${strokeAlphaSliderId}-fill`}>{t.curveFillLabel}</label>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {loading && !dispData && (
        <div role="status" aria-live="polite" className="loading-card">
          <span className="spinner" aria-hidden="true" />
          <span>{t.dispLoading}</span>
        </div>
      )}

      {/* Legend med søkeordene */}
      {dispData && orderedDispBooks.length > 0 && (
        <div className="series-legend-row">
          {dispData.labels.map((lbl, gIdx) => {
            const color = SERIES_COLORS[gIdx % SERIES_COLORS.length];
            const totalHits = orderedDispBooks.reduce(
              (acc, b) =>
                acc + (b.counts[gIdx]?.reduce((s, c) => s + c, 0) ?? 0),
              0
            );
            return (
              <div key={lbl} className="series-legend-card">
                <span
                  className="series-swatch"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <strong>
                  <code>{lbl}</code>
                </strong>
                <span className="muted">
                  {totalHits.toLocaleString('nb-NO')} {t.colHits.toLowerCase()} ·{' '}
                  {orderedDispBooks.length}{' '}
                  {orderedDispBooks.length === 1 ? t.bookSingularUnit : t.booksUnit} (
                  {orderedDispBooks
                    .reduce((acc, b) => acc + b.tokens, 0)
                    .toLocaleString('nb-NO')}{' '}
                  {t.wordsUnit})
                </span>
              </div>
            );
          })}
          {dispMs !== null && <span className="speed-pill">{dispMs} ms</span>}
        </div>
      )}

      {/* 3A. HOVEDGRAF (1 bok, etter hverandre, eller sum oppå hverandre) */}
      {mainChartData && mainChartData.xCount > 0 && (
        <figure className="chart-figure">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="trend-svg"
            role="img"
            aria-label="Narrativ bue gjennom teksten"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {yTicks.map((tv, idx) => {
              const y = padTop + plotH - (tv / maxVal) * plotH;
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    x2={width - padRight}
                    y1={y}
                    y2={y}
                    stroke="var(--border-subtle)"
                    strokeDasharray={idx === 0 ? undefined : '4 4'}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="chart-axis-text"
                  >
                    {valueMetric === 'raw' ? tv.toFixed(1) : tv.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Skillelinjer og boktitler ved flere bøker etter hverandre */}
            {mainChartData.boundaries.length > 1 &&
              mainChartData.boundaries.map((b, bIdx) => {
                const getX = (i: number) =>
                  mainChartData.xCount <= 1
                    ? padLeft + plotW / 2
                    : padLeft + (i / (mainChartData.xCount - 1)) * plotW;
                const startX = getX(b.startIdx);
                const endX = getX(b.endIdx);
                const midX = (startX + endX) / 2;
                return (
                  <g key={b.dhlabid}>
                    {bIdx > 0 && (
                      <line
                        x1={startX}
                        x2={startX}
                        y1={padTop}
                        y2={padTop + plotH}
                        stroke="var(--accent)"
                        strokeWidth={1.2}
                        strokeDasharray="4 3"
                      />
                    )}
                    <text
                      x={midX}
                      y={padTop - 8}
                      textAnchor="middle"
                      className="chart-axis-text"
                      style={{ fontWeight: 600 }}
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

            {/* X-aksetikker */}
            {Array.from({ length: 11 }, (_, k) => k * 10).map((pct) => {
              const idx = Math.round(
                (pct / 100) * Math.max(0, mainChartData.xCount - 1)
              );
              const x =
                mainChartData.xCount <= 1
                  ? padLeft + plotW / 2
                  : padLeft + (idx / (mainChartData.xCount - 1)) * plotW;
              const label =
                axisMode === 'bins' || mainChartData.kind === 'sum'
                  ? `${pct} %`
                  : `${idx + 1}`;
              return (
                <g key={pct}>
                  <line
                    x1={x}
                    x2={x}
                    y1={padTop + plotH}
                    y2={padTop + plotH + 6}
                    stroke="var(--text-muted)"
                  />
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className="chart-axis-text"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Selve kurvene */}
            {mainChartData.series.map((s) => {
              if (s.values.length === 0) return null;
              const getX = (i: number) =>
                mainChartData.xCount <= 1
                  ? padLeft + plotW / 2
                  : padLeft + (i / (mainChartData.xCount - 1)) * plotW;
              const getY = (val: number) =>
                padTop + plotH - (val / maxVal) * plotH;

              const linePath = s.values
                .map(
                  (v, i) =>
                    `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(
                      v
                    ).toFixed(1)}`
                )
                .join(' ');
              const areaPath = fillArea
                ? `${linePath} L${getX(s.values.length - 1).toFixed(1)},${(
                    padTop + plotH
                  ).toFixed(1)} L${getX(0).toFixed(1)},${(
                    padTop + plotH
                  ).toFixed(1)} Z`
                : '';

              return (
                <g key={s.label}>
                  {fillArea && (
                    <path
                      d={areaPath}
                      fill={s.color}
                      fillOpacity={Math.min(0.4, lineAlpha * 0.22)}
                    />
                  )}
                  <path
                    d={linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={lineWidth}
                    strokeOpacity={lineAlpha}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* Hover-markør */}
            {hoverIdx !== null && hoverIdx < mainChartData.xCount && (
              <g>
                {(() => {
                  const hx =
                    mainChartData.xCount <= 1
                      ? padLeft + plotW / 2
                      : padLeft +
                        (hoverIdx / (mainChartData.xCount - 1)) * plotW;
                  return (
                    <>
                      <line
                        x1={hx}
                        x2={hx}
                        y1={padTop}
                        y2={padTop + plotH}
                        stroke="var(--text-muted)"
                        strokeDasharray="3 3"
                      />
                      {mainChartData.series.map((s) => {
                        const v = s.values[hoverIdx] ?? 0;
                        const hy = padTop + plotH - (v / maxVal) * plotH;
                        return (
                          <circle
                            key={s.label}
                            cx={hx}
                            cy={hy}
                            r={4.5}
                            fill={s.color}
                            stroke="var(--surface)"
                            strokeWidth={2}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </g>
            )}

            {/* Usynlige hover-striper */}
            {Array.from({ length: mainChartData.xCount }, (_, idx) => {
              const sliceW = plotW / Math.max(1, mainChartData.xCount);
              const x =
                mainChartData.xCount <= 1
                  ? padLeft
                  : padLeft +
                    (idx / (mainChartData.xCount - 1)) * plotW -
                    sliceW / 2;
              return (
                <rect
                  key={idx}
                  x={Math.max(padLeft, x)}
                  y={padTop}
                  width={sliceW}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              );
            })}
          </svg>

          <figcaption className="chart-caption">
            {hoverIdx !== null && hoverIdx < mainChartData.xCount ? (
              <div className="hover-multi-readout">
                <strong>
                  {t.dispHoverSegment(
                    hoverIdx + 1,
                    mainChartData.xCount,
                    Math.round(
                      ((hoverIdx + 1) / Math.max(1, mainChartData.xCount)) * 100
                    )
                  )}
                </strong>
                {mainChartData.series.map((s) => (
                  <span key={s.label} className="hover-series-chip">
                    <span
                      className="series-swatch"
                      style={{ background: s.color }}
                    />
                    <code>{s.label}</code>:{' '}
                    <strong>
                      {(s.values[hoverIdx] ?? 0).toFixed(2)}{' '}
                      {valueMetric === 'per1000'
                        ? t.dispPer1kUnit
                        : t.colHits.toLowerCase()}
                    </strong>{' '}
                    ({t.dispRawLabel}: {s.rawCounts[hoverIdx] ?? 0})
                  </span>
                ))}
              </div>
            ) : (
              <span>{t.dispHoverHint}</span>
            )}
          </figcaption>
        </figure>
      )}

      {/* 3B. STABLET VISNING (UNDER HVERANDRE: ÉN BUE PER BOK) */}
      {dispData &&
        orderedDispBooks.length > 1 &&
        multiLayout === 'stack' && (
          <div className="stacked-arcs-list">
            {orderedDispBooks.map((b) => {
              const meta = knownMetadata[b.dhlabid];
              const title = meta?.title?.trim() || `dhlabid ${b.dhlabid}`;
              const author = normalizeAuthorName(meta?.authors);
              const nSeg = Math.max(1, b.counts[0]?.length ?? 1);
              const miniH = 140;
              const miniPadTop = 14;
              const miniPadBot = 24;
              const miniPlotH = miniH - miniPadTop - miniPadBot;

              return (
                <figure key={b.dhlabid} className="chart-figure stacked-arc-card">
                  <div className="stacked-arc-title">
                    <strong>
                      {meta?.year ? `${meta.year} · ` : ''}
                      {title}
                    </strong>{' '}
                    <span className="muted">
                      {author ? `${author} · ` : ''}
                      {b.tokens.toLocaleString('nb-NO')} {t.wordsUnit}
                    </span>
                  </div>
                  <svg
                    viewBox={`0 0 ${width} ${miniH}`}
                    className="trend-svg"
                    style={{ aspectRatio: `${width} / ${miniH}` }}
                  >
                    {[0, 0.5, 1].map((tv, idx) => {
                      const y = miniPadTop + miniPlotH - tv * miniPlotH;
                      return (
                        <line
                          key={idx}
                          x1={padLeft}
                          x2={width - padRight}
                          y1={y}
                          y2={y}
                          stroke="var(--border-subtle)"
                          strokeDasharray={idx === 0 ? undefined : '4 4'}
                        />
                      );
                    })}
                    {dispData.labels.map((lbl, gIdx) => {
                      const vals = normalizeBookSeries(
                        b.counts[gIdx] ?? [],
                        b.tokens,
                        dispData.window
                      );
                      if (vals.length === 0) return null;
                      const color = SERIES_COLORS[gIdx % SERIES_COLORS.length];
                      const getX = (i: number) =>
                        nSeg <= 1
                          ? padLeft + plotW / 2
                          : padLeft + (i / (nSeg - 1)) * plotW;
                      const getY = (val: number) =>
                        miniPadTop + miniPlotH - (val / maxVal) * miniPlotH;
                      const linePath = vals
                        .map(
                          (v, i) =>
                            `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(
                              v
                            ).toFixed(1)}`
                        )
                        .join(' ');
                      const areaPath = fillArea
                        ? `${linePath} L${getX(vals.length - 1).toFixed(
                            1
                          )},${(miniPadTop + miniPlotH).toFixed(1)} L${getX(
                            0
                          ).toFixed(1)},${(miniPadTop + miniPlotH).toFixed(1)} Z`
                        : '';
                      return (
                        <g key={lbl}>
                          {fillArea && (
                            <path
                              d={areaPath}
                              fill={color}
                              fillOpacity={Math.min(0.4, lineAlpha * 0.22)}
                            />
                          )}
                          <path
                            d={linePath}
                            fill="none"
                            stroke={color}
                            strokeWidth={lineWidth}
                            strokeOpacity={lineAlpha}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </figure>
              );
            })}
          </div>
        )}

      {orderedSelectedIds.length === 0 && !loading && (
        <div className="empty-box">{t.dispEmptyHint}</div>
      )}
    </div>
  );
};
