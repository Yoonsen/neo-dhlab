export const DEFAULT_BASE_URL = 'https://api.nb.no/dhlab/imag/ft_bok';

export interface ParsedQuery {
  raw: string;
  terms: string[];
  termGroups?: string[][];
  matchMode: 'near' | 'sequence';
  window: number;
  symmetric: boolean;
  anchorWord: string | null;
  hasWildcardOrGroup: boolean;
  predictedModeLabel: string;
  canComparePairAnchor: boolean;
  pairWords: [string, string] | null;
}

export interface NearQueryResponse {
  total: number;
  docs: number;
  countMode: 'tf' | 'pairs' | 'anchor' | 'sequence' | string;
  _engine?: 'arena' | 'python' | string;
}

export interface YearCountRow {
  year: number;
  total: number;
  docs: number;
  books: number;
  tokens: number;
  perMillion: number;
}

export interface YearCountResponse {
  rows: YearCountRow[];
  countMode?: string | null;
  _engine?: string;
  responseMs?: number;
}

export interface ConcordanceRow {
  dhlabid: number;
  left: string;
  hit: string;
  right: string;
}

export interface ConcordanceResponse {
  rows: ConcordanceRow[];
  lines: number;
  books: number;
}

export interface CorpusResponse {
  corpusToken: string;
  size: number;
  unknownUrns: number;
  unknownUrnsSample: string[];
}

export interface FacetValue {
  value: string;
  docs: number;
}

export interface FacetResponse {
  k: string;
  values: FacetValue[];
  withinSize: number | null;
}

export interface HealthResponse {
  status: string;
  version?: string;
  packed?: string;
  public?: boolean;
}

export interface ActiveCorpus {
  enabled: boolean;
  label: string;
  corpusToken: string | null;
  filterIds: number[];
  size: number;
  sourceDescription: string;
}

export interface SearchLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  queryText: string;
  modeLabel: string;
  total?: number;
  docs?: number;
  clientMs: number;
  engine?: string;
  corpusActive: boolean;
  corpusSize?: number;
  payload: Record<string, unknown>;
}

/**
 * Deler søkestrengen på komma utenfor anførselstegn ("..." / «...»).
 * Støtter \, (backslash-komma) dersom man vil søke på selve kommategnet (f.eks. ". \,").
 */
export function splitSearchExpressions(rawInput: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < rawInput.length; i++) {
    const ch = rawInput[i];
    if (ch === '\\' && i + 1 < rawInput.length && rawInput[i + 1] === ',') {
      current += ',';
      i++;
      continue;
    }
    if (!inQuotes && (ch === '"' || ch === '«')) {
      inQuotes = true;
      quoteChar = ch === '«' ? '»' : '"';
      current += ch;
      continue;
    }
    if (inQuotes && ch === quoteChar) {
      inQuotes = false;
      current += ch;
      continue;
    }
    if (!inQuotes && ch === ',') {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }
  const last = current.trim();
  if (last) parts.push(last);
  return parts;
}

export function parseMultiSearchQuery(
  rawInput: string,
  windowSize: number,
  symmetric: boolean
): ParsedQuery[] {
  const exprs = splitSearchExpressions(rawInput);
  if (exprs.length === 0) {
    return [parseSearchQuery('', windowSize, symmetric)];
  }
  return exprs.map((e) => parseSearchQuery(e, windowSize, symmetric));
}

/**
 * Oversetter søkefeltet til ft_bok-payload etter reglene i DEMO_APP_SPEC.md og PUBLIC_API_8096.md.
 */
export function parseSearchQuery(
  rawInput: string,
  windowSize: number,
  symmetric: boolean
): ParsedQuery {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      raw: '',
      terms: [],
      matchMode: 'near',
      window: windowSize,
      symmetric,
      anchorWord: null,
      hasWildcardOrGroup: false,
      predictedModeLabel: 'Skriv inn ett eller flere søkeord',
      canComparePairAnchor: false,
      pairWords: null,
    };
  }

  // Sjekk om hele søket står i anførselstegn ("..." eller «...») -> matchMode: "sequence"
  const isQuotedPhrase =
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 2) ||
    (trimmed.startsWith('«') && trimmed.endsWith('»') && trimmed.length > 2);

  const inner = isQuotedPhrase ? trimmed.slice(1, -1).trim() : trimmed;
  const rawTokens = inner.split(/\s+/).filter(Boolean);

  if (isQuotedPhrase) {
    const cleanTerms = rawTokens.map((t) =>
      t.startsWith('^') && t.length > 1 ? t.slice(1) : t
    );
    return {
      raw: trimmed,
      terms: cleanTerms,
      matchMode: 'sequence',
      window: windowSize,
      symmetric,
      anchorWord: null,
      hasWildcardOrGroup: false,
      predictedModeLabel: `Frase i rekkefølge (${cleanTerms.length} ord)`,
      canComparePairAnchor: false,
      pairWords: null,
    };
  }

  // Sjekk anker (^ord rett foran et ord; en enslig ^ er et vanlig tegn)
  let anchorWord: string | null = null;
  for (const tok of rawTokens) {
    if (tok.startsWith('^') && tok.length > 1) {
      anchorWord = tok.slice(1);
      break;
    }
  }

  // Sjekk wildcard (*) eller OR-gruppe (a|b)
  const hasWildcardOrGroup = rawTokens.some(
    (t) => t.includes('*') || (t.includes('|') && t.length > 1)
  );
  const termGroups = hasWildcardOrGroup
    ? rawTokens.map((t) =>
        t
          .replace(/^\^(?=.+)/, '')
          .split('|')
          .filter(Boolean)
      )
    : undefined;

  const bareWords = rawTokens.map((t) =>
    t.startsWith('^') && t.length > 1 ? t.slice(1) : t
  );

  let predictedModeLabel = '';
  if (rawTokens.length === 1) {
    predictedModeLabel = hasWildcardOrGroup
      ? `Wildcard / OR-gruppe (python-vei)`
      : `Forekomster av «${bareWords[0]}» (tf)`;
  } else if (rawTokens.length === 2) {
    if (anchorWord) {
      const otherWord = bareWords.find((w) => w !== anchorWord) ?? bareWords[0];
      predictedModeLabel = `Anker på «${anchorWord}» med «${otherWord}» innenfor ${windowSize} ord`;
    } else {
      predictedModeLabel = `Par av «${bareWords[0]}» og «${bareWords[1]}» innenfor ${windowSize} ord (${
        symmetric ? 'symmetrisk' : 'ordnet A → B'
      })`;
    }
  } else {
    predictedModeLabel = `${rawTokens.length} ord i nærhet innenfor ${windowSize} ord (python-vei)`;
  }

  const canComparePairAnchor =
    rawTokens.length === 2 && !hasWildcardOrGroup && !isQuotedPhrase;
  const pairWords: [string, string] | null = canComparePairAnchor
    ? [bareWords[0], bareWords[1]]
    : null;

  return {
    raw: trimmed,
    terms: rawTokens,
    termGroups,
    matchMode: 'near',
    window: windowSize,
    symmetric,
    anchorWord,
    hasWildcardOrGroup,
    predictedModeLabel,
    canComparePairAnchor,
    pairWords,
  };
}

export function buildNearQueryPayload(
  parsed: ParsedQuery,
  corpus: ActiveCorpus,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (parsed.hasWildcardOrGroup && parsed.termGroups) {
    payload.termGroups = parsed.termGroups;
  } else {
    payload.terms = parsed.terms;
  }

  if (parsed.matchMode === 'sequence') {
    payload.matchMode = 'sequence';
  } else if (parsed.terms.length >= 2) {
    payload.window = parsed.window;
    if (!parsed.symmetric) {
      payload.symmetric = false;
    }
  }

  applyCorpusToPayload(payload, corpus);

  if (extra) {
    Object.assign(payload, extra);
  }
  return payload;
}

export function applyCorpusToPayload(
  payload: Record<string, unknown>,
  corpus: ActiveCorpus
): void {
  if (!corpus.enabled) return;
  if (corpus.corpusToken) {
    payload.corpusToken = corpus.corpusToken;
  } else if (corpus.filterIds.length > 0) {
    payload.useFilter = true;
    payload.filterIds = corpus.filterIds;
  }
}

export function formatFriendlyError(status: number, detail: string): string {
  if (status === 404) {
    return `Fant ingen treff i ordlisten (${detail || 'ordet finnes ikke i samlingen'}).`;
  }
  if (status === 400) {
    return `Ugyldig spørring eller grense overskredet (400): ${
      detail || 'Sjekk vindusstørrelse, kun én ^-markør, og ingen * i konkordans.'
    }`;
  }
  if (status === 403) {
    return `Endepunktet eller modusen er sperret på den offentlige instansen (403): ${detail}`;
  }
  if (status === 422) {
    return `Parameter utenfor gyldig område (422): ${detail}`;
  }
  if (status === 503 || status === 502 || status === 504) {
    return `Korpusmotoren er midlertidig utilgjengelig eller tidsavbrutt (${status}).`;
  }
  return `Feil fra server (${status}): ${detail}`;
}

async function timedPost<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ data: T; clientMs: number }> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const t0 = performance.now();
  const res = await fetch(`${cleanBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const clientMs = Math.round(performance.now() - t0);

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      if (typeof errJson?.detail === 'string') {
        detail = errJson.detail;
      } else if (errJson?.detail) {
        detail = JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(formatFriendlyError(res.status, detail));
  }

  const data = (await res.json()) as T;
  return { data, clientMs };
}

export async function checkHealth(
  baseUrl: string
): Promise<{ data: HealthResponse; clientMs: number }> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const t0 = performance.now();
  const res = await fetch(`${cleanBase}/health`, { method: 'GET' });
  const clientMs = Math.round(performance.now() - t0);
  if (!res.ok) {
    throw new Error(`Health-sjekk feilet (${res.status})`);
  }
  const data = (await res.json()) as HealthResponse;
  return { data, clientMs };
}

export async function fetchNearCount(
  baseUrl: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ data: NearQueryResponse; clientMs: number }> {
  return timedPost<NearQueryResponse>(baseUrl, '/near_query', payload, signal);
}

export async function fetchYearTrend(
  baseUrl: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ data: YearCountResponse; clientMs: number }> {
  return timedPost<YearCountResponse>(
    baseUrl,
    '/near_query',
    { ...payload, mode: 'year-count' },
    signal
  );
}

export async function fetchConcordancePublic(
  baseUrl: string,
  parsed: ParsedQuery,
  corpus: ActiveCorpus,
  options: { before: number; after: number; limit: number },
  signal?: AbortSignal
): Promise<{
  data: ConcordanceResponse;
  clientMs: number;
  payload: Record<string, unknown>;
}> {
  if (parsed.hasWildcardOrGroup) {
    throw new Error(
      'Wildcard (*) og OR-grupper støttes ikke i offentlig konkordans (/concordance_public).'
    );
  }
  const hitTokenCount =
    parsed.matchMode === 'sequence' ? parsed.terms.length : 1;
  const maxContextBudget = Math.max(0, 25 - hitTokenCount);
  let before = Math.min(options.before, maxContextBudget);
  let after = Math.min(options.after, maxContextBudget - before);
  if (before + hitTokenCount + after > 25) {
    before = Math.floor(maxContextBudget / 2);
    after = maxContextBudget - before;
  }

  const payload: Record<string, unknown> = {
    terms: parsed.terms,
    before,
    after,
    limit: Math.min(200, Math.max(1, options.limit)),
  };

  if (parsed.matchMode === 'sequence') {
    payload.matchMode = 'sequence';
  } else if (parsed.terms.length >= 2) {
    payload.window = Math.min(24, parsed.window);
    if (!parsed.symmetric) {
      payload.symmetric = false;
    }
  }

  applyCorpusToPayload(payload, corpus);

  const { data, clientMs } = await timedPost<ConcordanceResponse>(
    baseUrl,
    '/concordance_public',
    payload,
    signal
  );
  return { data, clientMs, payload };
}

export async function buildCorpusRequest(
  baseUrl: string,
  req: {
    query?: Record<string, unknown>;
    dhlabids?: number[];
    urns?: string[];
    corpusToken?: string;
  }
): Promise<{ data: CorpusResponse; clientMs: number }> {
  return timedPost<CorpusResponse>(baseUrl, '/corpus', req);
}

export async function fetchCorpusFacets(
  baseUrl: string,
  req: {
    k: string;
    prefix?: string;
    limit?: number;
    corpusToken?: string;
    query?: Record<string, unknown>;
  }
): Promise<{ data: FacetResponse; clientMs: number }> {
  return timedPost<FacetResponse>(baseUrl, '/corpus/facets', req);
}

export function describeCountMode(
  countMode: string | undefined,
  parsed: ParsedQuery
): string {
  switch (countMode) {
    case 'tf':
      return `Enkeltord – totalt antall forekomster (tf)`;
    case 'pairs':
      return `Ordpar innenfor ${parsed.window} ord (${
        parsed.symmetric ? 'symmetrisk A ↔ B' : 'ordnet A → B'
      })`;
    case 'anchor':
      return `Anker på «${parsed.anchorWord ?? parsed.terms[0]}» innenfor ${
        parsed.window
      } ord`;
    case 'sequence':
      return `Eksakt frase i rekkefølge (${parsed.terms.length} ord)`;
    default:
      return parsed.predictedModeLabel;
  }
}
