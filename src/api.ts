export const DEFAULT_BASE_URL = 'https://api.nb.no/dhlab/imag/ft_bok';

export type SyntaxDialect = 'native' | 'fts5' | 'elastic';

export interface ParsedQuery {
  raw: string;
  terms: string[];
  termGroups?: string[][];
  matchMode: 'near' | 'sequence';
  window: number;
  symmetric: boolean;
  anchorWord: string | null;
  hasWildcardOrGroup: boolean;
  hasOrGroup: boolean;
  predictedModeLabel: string;
  canComparePairAnchor: boolean;
  pairWords: string[] | null;
  corpusFilterClauses?: ParsedQuery[];
  syntaxDialect: SyntaxDialect;
  parseError: string | null;
}

export interface NearQueryResponse {
  total: number;
  docs: number;
  countMode: 'tf' | 'pairs' | 'anchor' | 'sequence' | 'spans' | string;
  _engine?: 'arena' | 'python' | string;
  corpusToken?: string;
  corpusSize?: number;
  sampled?: boolean;
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
  anchor?: number;
  marks?: [number, number][];
  html?: string;
}

export interface ConcordanceResponse {
  rows: ConcordanceRow[];
  lines: number;
  books: number;
}

export interface BookMetadataRow {
  dhlabid: number;
  urn?: string;
  title?: string;
  authors?: string;
  year?: number;
  publisher?: string;
  city?: string;
  langs?: string;
  subjects?: string;
  ddc?: string;
  genres?: string;
  literaryform?: string;
  doctype?: string;
}

export interface MetadataResponse {
  fields: string[];
  rows: BookMetadataRow[];
  missing: number[];
}

export interface DispersionBookResult {
  dhlabid: number;
  tokens: number;
  counts: number[][];
}

export interface DispersionResponse {
  labels: string[];
  window: number | null;
  bins: number | null;
  books: DispersionBookResult[];
  missing: number[];
  total?: number[][];
}

export interface CollocationSideMetrics {
  counts: number;
  dist: number | null;
  bdist?: number;
  sd?: number | null;
  z?: number | null;
}

export interface CollocationRow {
  word: string;
  counts: number;
  dist: number | null;
  bdist: number;
  sd?: number | null;
  z?: number | null;
  expected?: number | null;
  ratio?: number | null;
  pmi?: number | null;
  ps?: number | null;
  wps?: number | null;
  left?: CollocationSideMetrics | null;
  right?: CollocationSideMetrics | null;
  skew?: number | null;
}

export interface CollocationsDistResponse {
  rows: CollocationRow[];
  hits: number;
  books: number;
  mu0: number;
  var0?: number;
  windowTokens?: number;
  before: number;
  after: number;
  prior: number;
  minCount: number;
  distances: boolean;
  distanceMinCount: number;
  collocates: number;
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

const ESC_MAP: Record<string, string> = {
  ',': '\uE001',
  '(': '\uE002',
  ')': '\uE003',
  '{': '\uE004',
  '}': '\uE005',
  '|': '\uE006',
  '+': '\uE007',
  '"': '\uE008',
  '~': '\uE009',
  '^': '\uE00A',
  '*': '\uE00B',
  '\\': '\uE00C',
};

const UNESC_REGEX = /[\uE001-\uE00C]/g;
const UNESC_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ESC_MAP).map(([k, v]) => [v, k])
);

/**
 * Erstatter backslash-escapede spesialtegn (\, \( \) \{ \} \| \+ \" \~ \^ \* \\)
 * med interne plassholdere før syntaksparsing, slik at de behandles som vanlige tegn/ord.
 */
export function encodeEscapedChars(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      const next = input[i + 1];
      out += ESC_MAP[next] ?? next;
      i++;
    } else {
      out += input[i];
    }
  }
  return out;
}

export function decodeEscapedChars(input: string): string {
  return input.replace(UNESC_REGEX, (m) => UNESC_MAP[m] ?? m);
}

/**
 * Deler søkestrengen på komma utenfor anførselstegn ("..." / «...») og utenfor parenteser NEAR(..., 10).
 * Støtter \, (backslash-komma) og andre \-escapede spesialtegn (\(, \), \|, \+, \^, \*).
 */
export function splitSearchExpressions(rawInput: string): string[] {
  const encoded = encodeEscapedChars(rawInput);
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;

  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i];
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
    if (!inQuotes) {
      if (ch === '(' || ch === '{') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')' || ch === '}') {
        parenDepth = Math.max(0, parenDepth - 1);
        current += ch;
        continue;
      }
      if (ch === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
        continue;
      }
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
  const list = exprs.map((e) => parseSearchQuery(e, windowSize, symmetric));
  const hasFts5 = list.some((p) => p.syntaxDialect === 'fts5');
  const hasElastic = list.some((p) => p.syntaxDialect === 'elastic');
  const hasAnchor = list.some((p) => p.anchorWord !== null);

  if (hasFts5 && hasElastic) {
    const msg =
      'Syntaksfeil: Kan ikke blande FTS5-syntaks (NEAR(...)) og Elastic-syntaks ("..."~n) i samme søk.';
    return list.map((p) => ({ ...p, parseError: p.parseError || msg }));
  }
  if (hasElastic && hasAnchor) {
    const msg =
      'Syntaksfeil: Kan ikke blande Elastic-syntaks med ankermarkør (^ord) i samme søk.';
    return list.map((p) => ({ ...p, parseError: p.parseError || msg }));
  }
  return list;
}

function clampWindow(w: number): number {
  return Math.min(50, Math.max(1, w));
}

/**
 * Sjekker hvilken dialekt uttrykket bruker, og returnerer feilmelding ved syntaksfeil eller blanding av dialekter.
 */
function detectAndValidateDialect(expr: string): {
  dialect: SyntaxDialect;
  error: string | null;
} {
  // 1b. Hvis uttrykket er på mengdebygger-formen { ground | predikat }, gjør det om til ground WHERE predikat
  const setBuilderMatch = expr.trim().match(/^\{\s*([^|{}]+?)\s*\|\s*([^{}]+?)\s*\}$/);
  const s = setBuilderMatch
    ? `${setBuilderMatch[1].trim()} WHERE ${setBuilderMatch[2].trim()}`
    : expr.trim();
  if (!s) return { dialect: 'native', error: null };

  // 1. Sjekk ubalanserte anførselstegn
  const doubleQuotes = (s.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) {
    return {
      dialect: 'native',
      error: 'Syntaksfeil: Uavsluttet anførselstegn (") i søkeuttrykket.',
    };
  }
  const openGuillemets = (s.match(/«/g) || []).length;
  const closeGuillemets = (s.match(/»/g) || []).length;
  if (openGuillemets !== closeGuillemets) {
    return {
      dialect: 'native',
      error: 'Syntaksfeil: Ubalanserte anførselstegn (« ») i søkeuttrykket.',
    };
  }

  // 2. Sjekk ubalanserte parenteser
  let depth = 0;
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth < 0) {
          return {
            dialect: 'fts5',
            error: 'Syntaksfeil: Lukkeparentes ")" uten tilhørende "(".',
          };
        }
      }
    }
  }
  if (depth !== 0) {
    return {
      dialect: 'fts5',
      error: 'Syntaksfeil: Uavsluttet parentes "(" i søkeuttrykket.',
    };
  }

  // 3. Oppdag spesifikke markører for hver dialekt
  const hasFts5Near = /\bNEAR\s*\(/.test(s);
  const hasWhere = /\bWHERE\b/.test(s);
  const hasElasticTilde = /["»]\s*~\s*\d*/.test(s) || /\S+~\d*/.test(s);
  const hasElasticNearSlash = /\bNEAR\/\d*/.test(s);
  const hasNativeAnchor = /(?:^|\s|\()\^\S+/.test(s);
  const hasBoolOps = /\b(?:AND|OR|NOT)\b/.test(s);

  const isFts5 =
    hasWhere ||
    hasFts5Near ||
    (hasBoolOps && !hasElasticTilde && !hasElasticNearSlash);
  const isElastic = hasElasticTilde || hasElasticNearSlash;

  // 4. Forby blanding av FTS5 og Elastic (men tillat ^anker og WHERE som utvidelse i FTS5!)
  if ((hasFts5Near || hasWhere) && isElastic) {
    return {
      dialect: 'fts5',
      error:
        'Syntaksfeil: Kan ikke blande FTS5/WHERE (NEAR(...)) og Elastic-syntaks ("..."~n eller NEAR/n) i samme søk.',
    };
  }
  if (isElastic && hasNativeAnchor) {
    return {
      dialect: 'elastic',
      error:
        'Syntaksfeil: Kan ikke blande Elastic-nærhet ("..."~n) med ankermarkør (^ord).',
    };
  }

  // 5. Valider boolske operatorer (WHERE, AND, OR, NOT)
  if (/\bNOT\b/.test(s)) {
    return {
      dialect: isElastic ? 'elastic' : 'fts5',
      error:
        'NOT støttes ikke i nærhetssøk på posisjonsnivå.',
    };
  }
  if (/^(?:AND|OR|WHERE)\b|\b(?:AND|OR|WHERE)$/.test(s)) {
    return {
      dialect: isElastic ? 'elastic' : 'fts5',
      error:
        'Syntaksfeil: Uttrykket kan ikke starte eller slutte med WHERE / AND / OR.',
    };
  }
  if (/\b(?:AND|OR|WHERE)\s+(?:AND|OR|WHERE)\b/.test(s)) {
    return {
      dialect: isElastic ? 'elastic' : 'fts5',
      error: 'Syntaksfeil: To logiske operatorer (WHERE / AND / OR) rett etter hverandre.',
    };
  }

  // 6. Valider FTS5 NEAR(...) (støtter både NEAR(a b, 10) og NEAR(a, b, 10) samt +10 / asym og ^anker)
  if (hasFts5Near) {
    const nearMatches = Array.from(s.matchAll(/\^?\bNEAR\s*\(([^()]*)\)/g));
    if (nearMatches.length === 0) {
      return {
        dialect: 'fts5',
        error: 'Syntaksfeil i FTS5 NEAR(...): nøstede parenteser inni NEAR støttes ikke.',
      };
    }
    for (const m of nearMatches) {
      const inner = m[1].trim();
      const commaParts = inner
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const symTokens = [
        'true',
        'false',
        'sym',
        'asym',
        'ordered',
        '->',
        '0',
        '1',
      ];
      let hasSymArg = false;
      let hasWinArg = false;
      let termParts = [...commaParts];

      if (
        termParts.length >= 2 &&
        symTokens.includes(termParts[termParts.length - 1].toLowerCase()) &&
        /^\+?\d+$/.test(termParts[termParts.length - 2])
      ) {
        hasSymArg = true;
        termParts.pop();
      }

      if (
        termParts.length >= 2 &&
        /^\+?\d+$/.test(termParts[termParts.length - 1])
      ) {
        hasWinArg = true;
        const winStr = termParts.pop()!;
        const w = parseInt(winStr, 10);
        if (w < 1 || w > 50) {
          return {
            dialect: 'fts5',
            error: `FTS5 NEAR-avstand (${w}) må være mellom 1 og 50.`,
          };
        }
      } else if (
        termParts.length === 2 &&
        !/\s/.test(termParts[0]) &&
        !/^\+?\d+$/.test(termParts[1]) &&
        /\s/.test(inner) &&
        !hasWhere
      ) {
        // F.eks. NEAR(a b, abc) der 2. del etter komma skulle vært et tall
        const firstTokens = termParts[0].split(/\s+/).filter(Boolean);
        if (firstTokens.length >= 2) {
          return {
            dialect: 'fts5',
            error: `Syntaksfeil i FTS5 NEAR(...): avstanden «${termParts[1]}» må være et heltall (1–50, evt. +10 for asymmetrisk).`,
          };
        }
      }

      void hasSymArg;
      void hasWinArg;

      const words = termParts
        .join(' ')
        .split(/\s+/)
        .filter(Boolean);

      // Hvis uttrykket bruker WHERE (f.eks. a WHERE NEAR(b, 10)), kan venstresiden fylle inn 1. argument,
      // ellers krever NEAR minst 2 søkeord
      const minWords = hasWhere ? 1 : 2;
      if (words.length < minWords) {
        return {
          dialect: 'fts5',
          error:
            'Syntaksfeil: FTS5 NEAR(...) krever minst to søkeord, f.eks. NEAR(skib, storm, 10) eller a WHERE NEAR(a, b, 10).',
        };
      }
    }
    return { dialect: 'fts5', error: null };
  }

  // 7. Valider Elastic "..."~N og NEAR/N
  if (isElastic) {
    if (hasElasticTilde) {
      const tildeMatch = s.match(/^(?:"([^"]+)"|«([^»]+)»)\s*~\s*(\d+)?$/);
      if (!tildeMatch) {
        return {
          dialect: 'elastic',
          error:
            'Syntaksfeil i Elastic-nærhet: bruk formen "ord1 ord2"~10 (anførselstegn rundt ordene etterfulgt av ~tall).',
        };
      }
      if (!tildeMatch[3]) {
        return {
          dialect: 'elastic',
          error: 'Syntaksfeil: Angi avstand etter ~, f.eks. "demokrati diktatur"~10.',
        };
      }
      const w = parseInt(tildeMatch[3], 10);
      if (w < 1 || w > 50) {
        return {
          dialect: 'elastic',
          error: `Nærhetsvinduet (${w}) må være mellom 1 og 50.`,
        };
      }
      const innerWords = (tildeMatch[1] ?? tildeMatch[2] ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (innerWords.length < 2) {
        return {
          dialect: 'elastic',
          error: 'Elastic nærhetssøk ("..."~N) krever minst to ord i anførselstegn.',
        };
      }
    }
    if (hasElasticNearSlash && !/\bNEAR\/\d+\b/.test(s)) {
      return {
        dialect: 'elastic',
        error: 'Syntaksfeil: Angi heltall etter NEAR/, f.eks. demokrati NEAR/10 diktatur.',
      };
    }
    return { dialect: 'elastic', error: null };
  }

  return { dialect: isFts5 ? 'fts5' : 'native', error: null };
}

/**
 * Deler et uttrykk på toppnivå ALL-CAPS 'WHERE' (utenfor parenteser og anførselstegn).
 * Returnerer { ground, predicate } eller null hvis ingen toppnivå WHERE finnes.
 */
export function splitTopLevelWhere(
  expr: string
): { ground: string; predicate: string } | null {
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (!inQuotes && (ch === '"' || ch === '«')) {
      inQuotes = true;
      quoteChar = ch === '«' ? '»' : '"';
      continue;
    }
    if (inQuotes && ch === quoteChar) {
      inQuotes = false;
      continue;
    }
    if (!inQuotes) {
      const ch = expr[i];
      if (!inQuotes && (ch === '(' || ch === '{')) {
        parenDepth++;
        continue;
      }
      if (!inQuotes && (ch === ')' || ch === '}')) {
        parenDepth = Math.max(0, parenDepth - 1);
        continue;
      }
      if (parenDepth === 0 && expr.slice(i, i + 7) === ' WHERE ') {
        const ground = expr.slice(0, i).trim();
        const predicate = expr.slice(i + 7).trim();
        if (ground && predicate) {
          return { ground, predicate };
        }
      }
    }
  }
  return null;
}

/**
 * Deler et uttrykk på toppnivå ALL-CAPS 'AND' (utenfor parenteser og anførselstegn).
 */
export function splitTopLevelAnd(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
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
    if (!inQuotes) {
      if (ch === '(' || ch === '{') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')' || ch === '}') {
        parenDepth = Math.max(0, parenDepth - 1);
        current += ch;
        continue;
      }
      if (
        parenDepth === 0 &&
        expr.slice(i, i + 5) === ' AND '
      ) {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
        i += 4;
        continue;
      }
    }
    current += ch;
  }
  const last = current.trim();
  if (last) parts.push(last);
  return parts;
}

/**
 * Tokeniserer et uttrykk til grupper og ALL-CAPS operatorer (OR, AND, NEAR, NEAR/n).
 * Støtter:
 * - FTS5: NEAR(a b, 10), a OR b, (a OR b) AND c, ord*
 * - Elastic / Nettbiblioteket: "a b"~10, a NEAR/10 b, (a OR b) (c OR d)
 * - NB N-gram: a+b+c, (a b) (c d)
 */
function parseCnfGroups(
  expr: string,
  defaultWindow: number,
  defaultSymmetric: boolean
): {
  groups: string[][];
  effectiveWindow: number;
  effectiveSymmetric: boolean;
  usedExplicitSyntax: boolean;
  clauseAnchored: boolean;
} {
  let working = expr.trim();
  let effectiveWindow = defaultWindow;
  let effectiveSymmetric = defaultSymmetric;
  let usedExplicitSyntax = false;
  let clauseAnchored = false;

  if (working.startsWith('^NEAR') && /^(\^NEAR)\s*\(/.test(working)) {
    clauseAnchored = true;
    working = working.slice(1).trim();
  }

  // 1. Sjekk om hele uttrykket er pakket i FTS5 NEAR(...)
  // Støtter både NEAR(a b, 10) og NEAR(a, b, 10) samt +10 / asym
  const nearFuncMatch = working.match(/^NEAR\s*\(([\s\S]+)\)$/);
  if (nearFuncMatch) {
    usedExplicitSyntax = true;
    const inner = nearFuncMatch[1].trim();
    const parts = inner
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const symTokens = [
      'true',
      'false',
      'sym',
      'asym',
      'ordered',
      '->',
      '0',
      '1',
    ];
    if (
      parts.length >= 2 &&
      symTokens.includes(parts[parts.length - 1].toLowerCase()) &&
      /^\+?\d+$/.test(parts[parts.length - 2])
    ) {
      const symArg = parts.pop()!.toLowerCase();
      if (['false', 'asym', 'ordered', '->', '0'].includes(symArg)) {
        effectiveSymmetric = false;
      } else if (['true', 'sym', '1'].includes(symArg)) {
        effectiveSymmetric = true;
      }
    }

    if (parts.length >= 2 && /^\+?\d+$/.test(parts[parts.length - 1])) {
      const winRaw = parts.pop()!;
      effectiveWindow = clampWindow(parseInt(winRaw, 10));
      if (winRaw.startsWith('+')) {
        effectiveSymmetric = false;
      }
    } else {
      // Standard FTS5 NEAR(a b) uten oppgitt tall har avstand 10
      effectiveWindow = 10;
    }

    working = parts.join(' ');
  }

  // 2. Del opp i parentesgrupper (...) eller enkelt-tokens
  type TokenItem =
    | { kind: 'op'; op: 'OR' | 'AND' | 'NEAR'; win?: number }
    | { kind: 'group'; words: string[] };

  const items: TokenItem[] = [];
  let i = 0;

  const splitGroupToken = (tok: string): string[] => {
    const clean = tok.replace(/^["«]|["»]$/g, '').trim();
    if (!clean) return [];
    // Hvis tokenet inneholder | eller + (som i skib|skip eller bil+bilen+biler)
    if ((clean.includes('|') || clean.includes('+')) && clean.length > 1) {
      usedExplicitSyntax = true;
      const isAnchored = clean.startsWith('^') && clean.length > 1;
      const body = isAnchored ? clean.slice(1) : clean;
      const parts = body
        .split(/[+|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (isAnchored && parts.length > 0) {
        parts[0] = `^${parts[0]}`;
      }
      return parts;
    }
    return [clean];
  };

  while (i < working.length) {
    while (i < working.length && /\s/.test(working[i])) i++;
    if (i >= working.length) break;

    // Evt. ^ rett foran en parentes: ^(skib OR skip)
    let prefixAnchor = false;
    if (working[i] === '^' && working[i + 1] === '(') {
      prefixAnchor = true;
      i++;
    }

    if (working[i] === '(') {
      usedExplicitSyntax = true;
      let depth = 0;
      const start = i + 1;
      while (i < working.length) {
        if (working[i] === '(') depth++;
        else if (working[i] === ')') {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      const inside = working.slice(start, i).trim();
      if (i < working.length && working[i] === ')') i++;

      const rawInsideTokens = inside
        .split(/[\s,|]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t !== 'OR');
      const words: string[] = [];
      for (const rt of rawInsideTokens) {
        words.push(...splitGroupToken(rt));
      }
      if (prefixAnchor && words.length > 0 && !words[0].startsWith('^')) {
        words[0] = `^${words[0]}`;
      }
      if (words.length > 0) {
        items.push({ kind: 'group', words });
      }
      continue;
    }

    // Vanlig token (eller anførselstegn-token inni et større uttrykk)
    if (working[i] === '"' || working[i] === '«') {
      const closeChar = working[i] === '«' ? '»' : '"';
      const start = i + 1;
      i++;
      while (i < working.length && working[i] !== closeChar) i++;
      const quoted = working.slice(start, i).trim();
      if (i < working.length) i++;
      if (quoted) {
        // Hvis det er flere ord i anførselstegn inni et NEAR/AND-uttrykk, legg hvert ord som egen gruppe
        for (const w of quoted.split(/\s+/).filter(Boolean)) {
          items.push({ kind: 'group', words: [w] });
        }
      }
      continue;
    }

    const start = i;
    while (i < working.length && !/\s/.test(working[i]) && working[i] !== '(') {
      i++;
    }
    const rawTok = working.slice(start, i).trim();
    if (!rawTok) continue;

    // Sjekk ALL-CAPS operatorer: OR, AND, NEAR, NEAR/10, NOT
    if (rawTok === 'OR') {
      usedExplicitSyntax = true;
      items.push({ kind: 'op', op: 'OR' });
    } else if (rawTok === 'AND') {
      usedExplicitSyntax = true;
      items.push({ kind: 'op', op: 'AND' });
    } else if (rawTok === 'NEAR' || /^NEAR\/\d+$/.test(rawTok)) {
      usedExplicitSyntax = true;
      const slashMatch = rawTok.match(/^NEAR\/(\d+)$/);
      items.push({
        kind: 'op',
        op: 'NEAR',
        win: slashMatch ? clampWindow(parseInt(slashMatch[1], 10)) : undefined,
      });
    } else {
      const words = splitGroupToken(rawTok);
      if (words.length > 0) {
        items.push({ kind: 'group', words });
      }
    }
  }

  // 3. Slå sammen grupper som har OR mellom seg, og håndter AND / NEAR
  const groups: string[][] = [];
  let mergeNextWithOr = false;
  let sawExplicitAnd = false;
  let sawExplicitNearWin = false;

  for (const item of items) {
    if (item.kind === 'op') {
      if (item.op === 'OR') {
        mergeNextWithOr = true;
      } else if (item.op === 'AND') {
        sawExplicitAnd = true;
      } else if (item.op === 'NEAR') {
        if (item.win !== undefined) {
          effectiveWindow = item.win;
          sawExplicitNearWin = true;
        }
      }
      continue;
    }

    if (mergeNextWithOr && groups.length > 0) {
      groups[groups.length - 1].push(...item.words);
      mergeNextWithOr = false;
    } else {
      groups.push([...item.words]);
      mergeNextWithOr = false;
    }
  }

  // Hvis brukeren skrev eksplisitt AND (f.eks. "skib AND storm") uten NEAR-tall,
  // bruk maks nærhetsvindu (50) som tilnærming til dokument-AND på arena
  if (sawExplicitAnd && !sawExplicitNearWin && !nearFuncMatch) {
    effectiveWindow = 50;
  }

  return {
    groups,
    effectiveWindow,
    effectiveSymmetric,
    usedExplicitSyntax,
    clauseAnchored,
  };
}

/**
 * Oversetter søkefeltet (vanlig dhlab-syntaks, FTS5, Elastic/Nettbiblioteket eller NB N-gram) til ft_bok-payload.
 */
export function parseSearchQuery(
  rawInput: string,
  windowSize: number,
  symmetric: boolean
): ParsedQuery {
  const displayRaw = decodeEscapedChars(rawInput.trim());
  const trimmed = encodeEscapedChars(rawInput.trim());
  if (!trimmed) {
    return {
      raw: '',
      terms: [],
      matchMode: 'near',
      window: windowSize,
      symmetric,
      anchorWord: null,
      hasWildcardOrGroup: false,
      hasOrGroup: false,
      predictedModeLabel: 'Skriv inn ett eller flere søkeord',
      canComparePairAnchor: false,
      pairWords: null,
      syntaxDialect: 'native',
      parseError: null,
    };
  }

  const { dialect, error: dialectError } = detectAndValidateDialect(trimmed);
  if (dialectError) {
    return {
      raw: displayRaw,
      terms: [],
      matchMode: 'near',
      window: windowSize,
      symmetric,
      anchorWord: null,
      hasWildcardOrGroup: false,
      hasOrGroup: false,
      predictedModeLabel: dialectError,
      canComparePairAnchor: false,
      pairWords: null,
      syntaxDialect: dialect,
      parseError: dialectError,
    };
  }

  // 0a. Semijoin / Mengdebygger: <ground> WHERE <predikat>  eller  { ground | predikat }
  // Venstresiden (ground) er objektet som telles og vises; høyresiden (predikat) er true/false-filter.
  const setBuilderMatch = trimmed.match(/^\{\s*([^|{}]+?)\s*\|\s*([^{}]+?)\s*\}$/);
  const normalizedWhereInput = setBuilderMatch
    ? `${setBuilderMatch[1].trim()} WHERE ${setBuilderMatch[2].trim()}`
    : trimmed;
  const whereSplit = splitTopLevelWhere(normalizedWhereInput);
  if (whereSplit) {
    const rawGround = whereSplit.ground.replace(/^\^/, '').trim();
    const rawPred = whereSplit.predicate.trim();
    const predClauses = splitTopLevelAnd(rawPred);

    // Spesialtilfelle: doc WHERE <predikat> ({ doc | predikat })
    if (rawGround.toLowerCase() === 'doc') {
      const subQueries = predClauses.map((p) =>
        parseSearchQuery(p, windowSize, symmetric)
      );
      const firstErr = subQueries.find((sq) => sq.parseError);
      if (firstErr) {
        return { ...firstErr, raw: trimmed };
      }
      const primary = subQueries[subQueries.length - 1];
      const filters = subQueries.slice(0, -1);
      return {
        ...primary,
        raw: trimmed,
        syntaxDialect: 'fts5',
        parseError: null,
        corpusFilterClauses: filters.length > 0 ? filters : undefined,
        predictedModeLabel: `{doc | ${rawPred}} (dokumentfilter)`,
      };
    }

    // Sjekk om et av AND-leddene i predikatet er et NEAR(...)-predikat som kan binde ground-termen som ^anker
    let boundPrimary: ParsedQuery | null = null;
    const docFilterClauses: ParsedQuery[] = [];

    for (const clause of predClauses) {
      const cTrim = clause.trim();
      const isNearClause = /^NEAR\s*\(/i.test(cTrim) || /\bNEAR\/\d+\b/.test(cTrim);

      if (isNearClause) {
        const parsedClause = parseSearchQuery(cTrim, windowSize, symmetric);
        if (parsedClause.parseError) {
          return { ...parsedClause, raw: trimmed };
        }
        const bareGround = rawGround.replace(/^["«]|["»]$/g, '').trim();
        const bareTerms = parsedClause.terms.map((t) =>
          t.replace(/^\^/, '')
        );
        const matchIdx = bareTerms.findIndex(
          (t) => t.toLowerCase() === bareGround.toLowerCase()
        );

        if (!boundPrimary) {
          if (matchIdx !== -1) {
            // Ground-ordet finnes inne i NEAR(a b c, 10) -> bind det som ^anker!
            const anchoredTerms = bareTerms.map((t, idx) =>
              idx === matchIdx ? `^${t}` : t
            );
            let anchoredGroups = parsedClause.termGroups;
            if (anchoredGroups) {
              anchoredGroups = anchoredGroups.map((g, idx) =>
                idx === matchIdx
                  ? g.map((w, wIdx) =>
                      wIdx === 0 && !w.startsWith('^') ? `^${w}` : w
                    )
                  : g.map((w) => w.replace(/^\^/, ''))
              );
            }
            boundPrimary = {
              ...parsedClause,
              terms: anchoredTerms,
              termGroups: anchoredGroups,
              anchorWord: bareTerms[matchIdx],
              syntaxDialect: 'fts5',
            };
            continue;
          } else if (bareTerms.length >= 1 && !/\s/.test(bareGround)) {
            // Brukeren skrev kortformen: a WHERE NEAR(b, 10) -> sett inn ^a som første ledd i NEAR!
            const anchoredTerms = [`^${bareGround}`, ...bareTerms];
            const anchoredGroups = parsedClause.termGroups
              ? [[`^${bareGround}`], ...parsedClause.termGroups]
              : undefined;
            boundPrimary = {
              ...parsedClause,
              terms: anchoredTerms,
              termGroups: anchoredGroups,
              anchorWord: bareGround,
              canComparePairAnchor:
                anchoredTerms.length >= 2 &&
                anchoredTerms.length <= 5 &&
                !parsedClause.hasWildcardOrGroup,
              pairWords:
                anchoredTerms.length >= 2 &&
                anchoredTerms.length <= 5 &&
                !parsedClause.hasWildcardOrGroup
                  ? [bareGround, ...bareTerms]
                  : null,
              syntaxDialect: 'fts5',
            };
            continue;
          }
        } else if (
          matchIdx !== -1 &&
          parsedClause.window === boundPrimary.window &&
          parsedClause.symmetric === boundPrimary.symmetric &&
          !parsedClause.hasWildcardOrGroup &&
          !boundPrimary.hasWildcardOrGroup
        ) {
          // Brukeren skrev a WHERE NEAR(a b, 10) AND NEAR(a c, 10) med samme anker og vindu
          // -> slå sammen til NEAR(^a b c, 10) på samme ankerforekomst!
          const extraTerms = bareTerms.filter(
            (_, idx) => idx !== matchIdx
          );
          const prevPrimary: ParsedQuery = boundPrimary;
          const mergedTerms: string[] = [...prevPrimary.terms];
          for (const et of extraTerms) {
            if (
              !mergedTerms.some(
                (mt: string) =>
                  mt.replace(/^\^/, '').toLowerCase() === et.toLowerCase()
              )
            ) {
              mergedTerms.push(et);
            }
          }
          boundPrimary = {
            ...prevPrimary,
            terms: mergedTerms,
            pairWords:
              mergedTerms.length >= 2 && mergedTerms.length <= 5
                ? mergedTerms.map((t: string) => t.replace(/^\^/, ''))
                : null,
          };
          continue;
        }
      }

      // Øvrige predikat-ledd er dokument-/korpusbetingelser
      const parsedFilter = parseSearchQuery(cTrim, windowSize, symmetric);
      if (parsedFilter.parseError) {
        return { ...parsedFilter, raw: trimmed };
      }
      docFilterClauses.push(parsedFilter);
    }

    if (!boundPrimary) {
      const parsedGround = parseSearchQuery(rawGround, windowSize, symmetric);
      if (parsedGround.parseError) {
        return { ...parsedGround, raw: trimmed };
      }
      boundPrimary = parsedGround;
    }

    return {
      ...boundPrimary,
      raw: displayRaw,
      syntaxDialect: 'fts5',
      parseError: null,
      corpusFilterClauses:
        docFilterClauses.length > 0 ? docFilterClauses : undefined,
      predictedModeLabel: decodeEscapedChars(`{${rawGround} | ${rawPred}}`),
    };
  }

  // 0b. Sjekk om uttrykket er sammensatt med toppnivå AND der minst ett ledd er NEAR(...) / "..."~N / frase
  // f.eks. NEAR(a b, 5) AND NEAR(c d, 10) -> kjedes på korpus-/dokumentnivå via returnCorpus!
  const andParts = splitTopLevelAnd(trimmed);
  if (
    andParts.length > 1 &&
    andParts.some(
      (p) =>
        /^NEAR\s*\(/i.test(p) ||
        /\bNEAR\/\d+\b/.test(p) ||
        /~\s*\d+$/.test(p) ||
        /^["«].+["»]$/.test(p) ||
        p.trim().split(/\s+/).length >= 2
    )
  ) {
    const subQueries = andParts.map((p) =>
      parseSearchQuery(p, windowSize, symmetric)
    );
    const firstErr = subQueries.find((sq) => sq.parseError);
    if (firstErr) {
      return {
        ...firstErr,
        raw: displayRaw,
      };
    }
    // Sjekk at alle ledd i AND-kjeden bruker kompatibel dialekt (ikke blander FTS5 og Elastic)
    const hasFtsSub = subQueries.some((sq) => sq.syntaxDialect === 'fts5');
    const hasElSub = subQueries.some((sq) => sq.syntaxDialect === 'elastic');
    if (hasFtsSub && hasElSub) {
      const mixErr =
        'Syntaksfeil: Kan ikke blande FTS5-ledd og Elastic-ledd i samme AND-uttrykk.';
      return {
        ...subQueries[0],
        raw: displayRaw,
        terms: [],
        predictedModeLabel: mixErr,
        parseError: mixErr,
      };
    }
    // Hvis ett av leddene i AND-kjeden er merket med ^ (f.eks. ^NEAR(a b, 5) AND NEAR(c d, 10) eller NEAR(a ^b, 5) AND ...),
    // blir det forankrede leddet hoveduttrykket (som telles / vises i konkordans), og de øvrige blir korpusfilter!
    let primaryIdx = subQueries.findIndex(
      (sq, idx) =>
        andParts[idx].trim().startsWith('^') || sq.anchorWord !== null
    );
    if (primaryIdx === -1) {
      primaryIdx = subQueries.length - 1;
    }
    const primary = subQueries[primaryIdx];
    const filters = subQueries.filter((_, idx) => idx !== primaryIdx);
    return {
      ...primary,
      raw: displayRaw,
      syntaxDialect: hasFtsSub ? 'fts5' : hasElSub ? 'elastic' : primary.syntaxDialect,
      parseError: null,
      corpusFilterClauses: filters,
      predictedModeLabel: `Korpus-AND (${filters
        .map((f) => f.raw)
        .join(' ∩ ')}) → ${primary.predictedModeLabel}`,
    };
  }

  // 1. Elastic / Nettbiblioteket nærhetssøk: "ord1 ord2"~10
  const tildeProxMatch = trimmed.match(/^(?:"([^"]+)"|«([^»]+)»)\s*~\s*(\d+)$/);
  if (tildeProxMatch) {
    const inner = (tildeProxMatch[1] ?? tildeProxMatch[2] ?? '').trim();
    const explicitWin = clampWindow(parseInt(tildeProxMatch[3], 10));
    const innerParsed = parseSearchQuery(inner, explicitWin, symmetric);
    return {
      ...innerParsed,
      raw: displayRaw,
      syntaxDialect: 'elastic',
      predictedModeLabel: `Elastic nærhet (~${explicitWin}): ${innerParsed.terms.join(' · ')}`,
    };
  }

  // 2. Eksakt frase i anførselstegn ("i forhold til" uten ~N og uten andre ledd utenfor)
  const isQuotedPhrase =
    ((trimmed.startsWith('"') &&
      trimmed.endsWith('"') &&
      !trimmed.slice(1, -1).includes('"')) ||
      (trimmed.startsWith('«') &&
        trimmed.endsWith('»') &&
        !trimmed.slice(1, -1).includes('»'))) &&
    trimmed.length > 2;

  if (isQuotedPhrase) {
    const inner = trimmed.slice(1, -1).trim();
    const { groups: phraseGroups } = parseCnfGroups(inner, windowSize, symmetric);
    const hasPhraseOr = phraseGroups.some((g) => g.length > 1);
    const hasPhraseWildcard = phraseGroups.some((g) =>
      g.some((w) => w.includes('*'))
    );
    const hasWildcardOrGroup = hasPhraseOr || hasPhraseWildcard;
    const cleanTerms = phraseGroups.map((g) =>
      decodeEscapedChars(
        g[0].startsWith('^') && g[0].length > 1 ? g[0].slice(1) : g[0]
      )
    );
    return {
      raw: displayRaw,
      terms: cleanTerms,
      termGroups: hasWildcardOrGroup
        ? phraseGroups.map((g) =>
            g.map((w) =>
              decodeEscapedChars(
                w.startsWith('^') && w.length > 1 ? w.slice(1) : w
              )
            )
          )
        : undefined,
      matchMode: 'sequence',
      window: windowSize,
      symmetric,
      anchorWord: null,
      hasWildcardOrGroup,
      hasOrGroup: hasPhraseOr,
      predictedModeLabel: `Frase i rekkefølge (${cleanTerms.length} ledd)`,
      canComparePairAnchor: false,
      pairWords: null,
      syntaxDialect: 'native',
      parseError: null,
    };
  }

  // 3. Parse CNF-grupper (håndterer vanlig syntaks, FTS5 NEAR/OR/AND, Elastic og NB N-gram)
  const {
    groups: rawGroups,
    effectiveWindow,
    effectiveSymmetric,
    usedExplicitSyntax,
  } = parseCnfGroups(trimmed, windowSize, symmetric);

  const groups = rawGroups.map((g) => g.map((w) => decodeEscapedChars(w)));

  if (groups.length === 0) {
    return {
      raw: displayRaw,
      terms: [],
      matchMode: 'near',
      window: effectiveWindow,
      symmetric: effectiveSymmetric,
      anchorWord: null,
      hasWildcardOrGroup: false,
      hasOrGroup: false,
      predictedModeLabel: 'Skriv inn ett eller flere søkeord',
      canComparePairAnchor: false,
      pairWords: null,
      syntaxDialect: dialect,
      parseError: null,
    };
  }

  const hasOrGroup = groups.some((g) => g.length > 1);
  const hasWildcard = rawGroups.some((g) => g.some((w) => w.includes('*')));
  const hasWildcardOrGroup = hasOrGroup || hasWildcard;

  // Flate terms (første ord i hver gruppe hvis ikke OR brukes)
  const flatTerms = groups.map((g) => g[0]);

  let anchorWord: string | null = null;
  for (let gIdx = 0; gIdx < rawGroups.length; gIdx++) {
    const rg = rawGroups[gIdx];
    for (let tIdx = 0; tIdx < rg.length; tIdx++) {
      const tok = rg[tIdx];
      if (tok.startsWith('^') && tok.length > 1) {
        anchorWord = decodeEscapedChars(tok.slice(1));
        break;
      }
    }
    if (anchorWord) break;
  }

  const groupLabels = groups.map((g) =>
    g.length > 1 ? `(${g.join(' | ')})` : g[0].replace(/^\^(?=.+)/, '')
  );

  const symSuffix = !effectiveSymmetric ? ' (ordnet A → B)' : '';

  let predictedModeLabel = '';
  if (groups.length === 1) {
    predictedModeLabel = hasOrGroup
      ? `OR-gruppe: ${groupLabels[0]} (tf)`
      : `Forekomster av «${groupLabels[0]}» (tf)`;
  } else if (groups.length === 2) {
    if (anchorWord) {
      predictedModeLabel = `Anker på «${anchorWord}» innenfor ${effectiveWindow} ord${symSuffix}`;
    } else {
      predictedModeLabel = `${
        usedExplicitSyntax ? 'FTS5/Nærhet' : 'Par'
      }: ${groupLabels.join(' · ')} innenfor ${effectiveWindow} ord${symSuffix}`;
    }
  } else {
    if (anchorWord) {
      predictedModeLabel = `Anker på «${anchorWord}» med ${
        groups.length - 1
      } grupper innenfor ${effectiveWindow} ord${symSuffix}`;
    } else {
      predictedModeLabel = `Spenn (spans): alle ${groups.length} ledd innenfor ${effectiveWindow} ord${symSuffix}`;
    }
  }

  const bareWords = flatTerms.map((t) =>
    t.startsWith('^') && t.length > 1 ? t.slice(1) : t
  );

  const canComparePairAnchor =
    groups.length >= 2 &&
    groups.length <= 5 &&
    !hasWildcardOrGroup &&
    !isQuotedPhrase;
  const pairWords: string[] | null = canComparePairAnchor ? bareWords : null;

  return {
    raw: displayRaw,
    terms: flatTerms,
    termGroups: hasWildcardOrGroup ? groups : undefined,
    matchMode: 'near',
    window: effectiveWindow,
    symmetric: effectiveSymmetric,
    anchorWord,
    hasWildcardOrGroup,
    hasOrGroup,
    predictedModeLabel,
    canComparePairAnchor,
    pairWords,
    syntaxDialect: dialect,
    parseError: null,
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

/**
 * Hvis spørringen har kjedede AND-ledd på korpusnivå (f.eks. NEAR(a b, 5) AND NEAR(c d, 10)),
 * evalueres filterleddene sekvensielt med returnCorpus: true for å snitte dokument-bitmapet.
 */
export async function resolveEffectiveCorpus(
  baseUrl: string,
  parsed: ParsedQuery,
  baseCorpus: ActiveCorpus,
  signal?: AbortSignal
): Promise<{ corpus: ActiveCorpus; extraMs: number }> {
  if (!parsed.corpusFilterClauses || parsed.corpusFilterClauses.length === 0) {
    return { corpus: baseCorpus, extraMs: 0 };
  }
  let current = baseCorpus;
  let extraMs = 0;
  for (const clause of parsed.corpusFilterClauses) {
    const payload = buildNearQueryPayload(clause, current, {
      returnCorpus: true,
      maxCorpusDocs: 1000000,
    });
    const { data, clientMs } = await fetchNearCount(baseUrl, payload, signal);
    extraMs += clientMs;
    if (data.corpusToken) {
      current = {
        enabled: true,
        label: `${current.enabled ? `${current.label} ∩ ` : ''}${clause.raw}`,
        corpusToken: data.corpusToken,
        filterIds: [],
        size: data.corpusSize ?? data.docs,
        sourceDescription: 'Kjedet korpus-AND',
      };
    }
  }
  return { corpus: current, extraMs };
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
    before,
    after,
    limit: Math.min(2000, Math.max(1, options.limit)),
  };

  if (parsed.hasWildcardOrGroup && parsed.termGroups) {
    payload.termGroups = parsed.termGroups;
  } else {
    payload.terms = parsed.terms;
  }

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

export async function fetchMetadata(
  baseUrl: string,
  req: {
    dhlabids?: number[];
    corpusToken?: string;
    fields?: string[];
  },
  signal?: AbortSignal
): Promise<{ data: MetadataResponse; clientMs: number }> {
  return timedPost<MetadataResponse>(
    baseUrl,
    '/metadata',
    {
      ...req,
      fields: req.fields ?? ['urn', 'title', 'authors', 'year'],
    },
    signal
  );
}

export async function fetchDispersion(
  baseUrl: string,
  req: {
    dhlabids?: number[];
    corpusToken?: string;
    terms?: string[];
    termGroups?: string[][];
    maxVariants?: number;
    window?: number;
    bins?: number;
  },
  signal?: AbortSignal
): Promise<{ data: DispersionResponse; clientMs: number }> {
  return timedPost<DispersionResponse>(baseUrl, '/dispersion', req, signal);
}

export async function fetchCollocationsDist(
  baseUrl: string,
  parsed: ParsedQuery,
  corpus: ActiveCorpus,
  options: {
    before: number;
    after: number;
    fold?: boolean;
    sampleSize?: number;
    perBook?: number;
    minCount?: number;
    prior?: number;
    limit?: number;
    sides?: boolean;
    expected?: boolean;
  },
  signal?: AbortSignal
): Promise<{ data: CollocationsDistResponse; clientMs: number }> {
  const payload: Record<string, unknown> = {
    before: Math.min(50, Math.max(0, options.before)),
    after: Math.min(50, Math.max(0, options.after)),
    fold: options.fold ?? true,
    sampleSize: options.sampleSize ?? 5000,
    perBook: options.perBook ?? 10,
    minCount: Math.max(2, options.minCount ?? 2),
    prior: options.prior ?? 2,
    limit: options.limit ?? 1500,
    expected: options.expected ?? true,
  };
  if (options.sides !== undefined) {
    payload.sides = options.sides;
  }

  if (parsed.hasWildcardOrGroup && parsed.termGroups) {
    payload.termGroups = parsed.termGroups;
  } else {
    payload.terms = parsed.terms;
  }

  if (parsed.matchMode === 'sequence') {
    payload.matchMode = 'sequence';
  } else if (parsed.terms.length >= 2) {
    payload.window = Math.min(50, parsed.window);
    if (!parsed.symmetric) {
      payload.symmetric = false;
    }
  }

  applyCorpusToPayload(payload, corpus);

  return timedPost<CollocationsDistResponse>(
    baseUrl,
    '/collocations_dist',
    payload,
    signal
  );
}

/**
 * Normaliserer forfatternavn fra metadata (fjerner ekstra mellomrom før komma og ledende/etterfølgende '/').
 */
export function normalizeAuthorName(rawAuthor?: string): string {
  if (!rawAuthor) return '';
  return rawAuthor
    .replace(/^\s*\/\s*|\s*\/\s*$/g, '')
    .replace(/\s+,/g, ',')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
}

/**
 * Oversetter et ParsedQuery til Nettbibliotekets searchText-parameter (Elastic / Lucene-format)
 * så langt det lar seg gjøre, slik at klikk på boklenken åpner boka med søkeordene markert.
 */
export function buildNbSearchText(
  parsed: ParsedQuery,
  fallbackHit?: string
): string {
  const cleanWord = (w: string) => w.replace(/^\^/, '').trim();
  const groups =
    parsed.termGroups && parsed.termGroups.length > 0
      ? parsed.termGroups.map((g) => g.map(cleanWord).filter(Boolean))
      : parsed.terms.map((t) => [cleanWord(t)]).filter((g) => g[0]);

  if (groups.length === 0) {
    return fallbackHit ? fallbackHit.trim() : '';
  }

  // Eksakt frase: "i forhold til"
  if (parsed.matchMode === 'sequence') {
    const flat = groups.map((g) => g[0]);
    return `"${flat.join(' ')}"`;
  }

  // Enkeltord eller én OR-gruppe
  if (groups.length === 1) {
    const g = groups[0];
    if (g.length === 1) return g[0];
    return g.join(' OR ');
  }

  // Flere ord utan OR-grupper -> Elastic nærhetssøk "ord1 ord2"~window
  const allSingle = groups.every((g) => g.length === 1 && !g[0].includes('*'));
  if (allSingle) {
    const words = groups.map((g) => g[0]);
    return `"${words.join(' ')}"~${parsed.window}`;
  }

  // Hvis det er OR-grupper eller wildcards i nærhet, send første ord fra hver gruppe i ~window
  const primaryWords = groups.map((g) => g[0]);
  return `"${primaryWords.join(' ')}"~${parsed.window}`;
}

export function buildNbItemUrl(
  urn: string | undefined,
  parsed: ParsedQuery,
  fallbackHit?: string
): string | null {
  if (!urn) return null;
  const cleanUrn = urn.startsWith('URN:')
    ? urn
    : urn.startsWith('digibok_')
    ? `URN:NBN:no-nb_${urn}`
    : /^\d{13}$/.test(urn)
    ? `URN:NBN:no-nb_digibok_${urn}`
    : urn;
  const searchText = buildNbSearchText(parsed, fallbackHit);
  const base = `https://www.nb.no/items/${encodeURIComponent(cleanUrn)}`;
  return searchText
    ? `${base}?searchText=${encodeURIComponent(searchText)}`
    : base;
}

export function describeCountMode(
  countMode: string | undefined,
  parsed: ParsedQuery
): string {
  switch (countMode) {
    case 'tf':
      return parsed.hasOrGroup
        ? `OR-gruppe – sum av posisjoner (tf)`
        : `Enkeltord – totalt antall forekomster (tf)`;
    case 'pairs':
      return `Ordpar innenfor ${parsed.window} ord (${
        parsed.symmetric ? 'symmetrisk A ↔ B' : 'ordnet A → B'
      })`;
    case 'spans':
      return `Spenn (spans): ikke-overlappende steder der alle ${parsed.terms.length} ledd står innenfor ${parsed.window} ord`;
    case 'anchor':
      return parsed.terms.length >= 3
        ? `Anker på «${parsed.anchorWord ?? parsed.terms[0]}» med alle de andre leddene innenfor ${parsed.window} ord`
        : `Anker på «${parsed.anchorWord ?? parsed.terms[0]}» innenfor ${parsed.window} ord`;
    case 'sequence':
      return `Eksakt frase i rekkefølge (${parsed.terms.length} ord)`;
    default:
      return parsed.predictedModeLabel;
  }
}
