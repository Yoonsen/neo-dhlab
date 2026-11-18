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
 * Deler søkestrengen på komma utenfor anførselstegn ("..." / «...») og utenfor parenteser NEAR(..., 10).
 * Støtter \, (backslash-komma) dersom man vil søke på selve kommategnet.
 */
export function splitSearchExpressions(rawInput: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;

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
    if (!inQuotes) {
      if (ch === '(') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')') {
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
  if ((hasFts5 || hasElastic) && hasAnchor) {
    const msg =
      'Syntaksfeil: Kan ikke blande FTS5/Elastic-syntaks med ankermarkør (^ord) i samme søk.';
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
  const s = expr.trim();
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
  const hasElasticTilde = /["»]\s*~\s*\d*/.test(s) || /\S+~\d*/.test(s);
  const hasElasticNearSlash = /\bNEAR\/\d*/.test(s);
  const hasNativeAnchor = /(?:^|\s|\()\^\S+/.test(s);
  const hasBoolOps = /\b(?:AND|OR|NOT)\b/.test(s);

  const isFts5 = hasFts5Near || (hasBoolOps && !hasElasticTilde && !hasElasticNearSlash);
  const isElastic = hasElasticTilde || hasElasticNearSlash;

  // 4. Forby blanding av dialekter
  if (hasFts5Near && isElastic) {
    return {
      dialect: 'fts5',
      error:
        'Syntaksfeil: Kan ikke blande FTS5 (NEAR(...)) og Elastic-syntaks ("..."~n eller NEAR/n) i samme søk.',
    };
  }
  if (hasFts5Near && hasNativeAnchor) {
    return {
      dialect: 'fts5',
      error:
        'Syntaksfeil: Kan ikke blande FTS5 NEAR(...) med ankermarkør (^ord).',
    };
  }
  if (isElastic && hasNativeAnchor) {
    return {
      dialect: 'elastic',
      error:
        'Syntaksfeil: Kan ikke blande Elastic-nærhet ("..."~n) med ankermarkør (^ord).',
    };
  }

  // 5. Valider boolske operatorer (AND, OR, NOT)
  if (/\bNOT\b/.test(s)) {
    return {
      dialect: isElastic ? 'elastic' : 'fts5',
      error:
        'NOT støttes ikke i nærhetssøk på posisjonsnivå.',
    };
  }
  if (/^(?:AND|OR)\b|\b(?:AND|OR)$/.test(s)) {
    return {
      dialect: isElastic ? 'elastic' : 'fts5',
      error:
        'Syntaksfeil: Uttrykket kan ikke starte eller slutte med AND / OR.',
    };
  }
  if (/\b(?:AND|OR)\s+(?:AND|OR)\b/.test(s)) {
    return {
      dialect: isElastic ? 'elastic' : 'fts5',
      error: 'Syntaksfeil: To boolske operatorer (AND / OR) rett etter hverandre.',
    };
  }

  // 6. Valider FTS5 NEAR(...)
  if (hasFts5Near) {
    const nearMatches = Array.from(s.matchAll(/\bNEAR\s*\(([^()]*)\)/g));
    if (nearMatches.length === 0) {
      return {
        dialect: 'fts5',
        error: 'Syntaksfeil i FTS5 NEAR(...): nøstede parenteser inni NEAR støttes ikke.',
      };
    }
    for (const m of nearMatches) {
      let inner = m[1].trim();
      const commaParts = inner.split(',');
      if (commaParts.length > 2) {
        return {
          dialect: 'fts5',
          error: 'Syntaksfeil i FTS5 NEAR(...): kun ett komma før avstandstallet, f.eks. NEAR(a b, 10).',
        };
      }
      if (commaParts.length === 2) {
        const winStr = commaParts[1].trim();
        if (!/^\d+$/.test(winStr)) {
          return {
            dialect: 'fts5',
            error: `Syntaksfeil i FTS5 NEAR(...): avstanden «${winStr}» må være et heltall (1–50).`,
          };
        }
        const w = parseInt(winStr, 10);
        if (w < 1 || w > 50) {
          return {
            dialect: 'fts5',
            error: `FTS5 NEAR-avstand (${w}) må være mellom 1 og 50.`,
          };
        }
        inner = commaParts[0].trim();
      }
      const words = inner.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        return {
          dialect: 'fts5',
          error: 'Syntaksfeil: FTS5 NEAR(...) krever minst to søkeord, f.eks. NEAR(skib storm, 10).',
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
      if (ch === '(') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')') {
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
  defaultWindow: number
): {
  groups: string[][];
  effectiveWindow: number;
  usedExplicitSyntax: boolean;
} {
  let working = expr.trim();
  let effectiveWindow = defaultWindow;
  let usedExplicitSyntax = false;

  // 1. Sjekk om hele uttrykket er pakket i FTS5 NEAR(...)
  const nearFuncMatch = working.match(/^NEAR\s*\(([\s\S]+)\)$/);
  if (nearFuncMatch) {
    usedExplicitSyntax = true;
    let inner = nearFuncMatch[1].trim();
    // Sjekk om det slutter med ", <tall>" på toppnivå
    const trailingWin = inner.match(/^(.*),\s*(\d+)\s*$/);
    if (trailingWin) {
      inner = trailingWin[1].trim();
      effectiveWindow = clampWindow(parseInt(trailingWin[2], 10));
    }
    working = inner;
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

  return { groups, effectiveWindow, usedExplicitSyntax };
}

/**
 * Oversetter søkefeltet (vanlig dhlab-syntaks, FTS5, Elastic/Nettbiblioteket eller NB N-gram) til ft_bok-payload.
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
      raw: trimmed,
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

  // 0. Sjekk om uttrykket er sammensatt med toppnivå AND der minst ett ledd er NEAR(...) / "..."~N / frase
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
        raw: trimmed,
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
        raw: trimmed,
        terms: [],
        predictedModeLabel: mixErr,
        parseError: mixErr,
      };
    }
    const primary = subQueries[subQueries.length - 1];
    const filters = subQueries.slice(0, -1);
    return {
      ...primary,
      raw: trimmed,
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
      raw: trimmed,
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
    const cleanTerms = inner
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => (t.startsWith('^') && t.length > 1 ? t.slice(1) : t));
    return {
      raw: trimmed,
      terms: cleanTerms,
      matchMode: 'sequence',
      window: windowSize,
      symmetric,
      anchorWord: null,
      hasWildcardOrGroup: false,
      hasOrGroup: false,
      predictedModeLabel: `Frase i rekkefølge (${cleanTerms.length} ord)`,
      canComparePairAnchor: false,
      pairWords: null,
      syntaxDialect: 'native',
      parseError: null,
    };
  }

  // 3. Parse CNF-grupper (håndterer vanlig syntaks, FTS5 NEAR/OR/AND, Elastic og NB N-gram)
  const { groups, effectiveWindow, usedExplicitSyntax } = parseCnfGroups(
    trimmed,
    windowSize
  );

  if (groups.length === 0) {
    return {
      raw: trimmed,
      terms: [],
      matchMode: 'near',
      window: effectiveWindow,
      symmetric,
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
  const hasWildcard = groups.some((g) => g.some((w) => w.includes('*')));
  const hasWildcardOrGroup = hasOrGroup || hasWildcard;

  // Flate terms (første ord i hver gruppe hvis ikke OR brukes)
  const flatTerms = groups.map((g) => g[0]);

  let anchorWord: string | null = null;
  for (const g of groups) {
    for (const tok of g) {
      if (tok.startsWith('^') && tok.length > 1) {
        anchorWord = tok.slice(1);
        break;
      }
    }
    if (anchorWord) break;
  }

  const groupLabels = groups.map((g) =>
    g.length > 1 ? `(${g.join(' | ')})` : g[0].replace(/^\^(?=.+)/, '')
  );

  let predictedModeLabel = '';
  if (groups.length === 1) {
    predictedModeLabel = hasOrGroup
      ? `OR-gruppe: ${groupLabels[0]} (tf)`
      : `Forekomster av «${groupLabels[0]}» (tf)`;
  } else if (groups.length === 2) {
    if (anchorWord) {
      predictedModeLabel = `Anker på «${anchorWord}» innenfor ${effectiveWindow} ord`;
    } else {
      predictedModeLabel = `${
        usedExplicitSyntax ? 'FTS5/Nærhet' : 'Par'
      }: ${groupLabels.join(' · ')} innenfor ${effectiveWindow} ord`;
    }
  } else {
    if (anchorWord) {
      predictedModeLabel = `Anker på «${anchorWord}» med ${
        groups.length - 1
      } grupper innenfor ${effectiveWindow} ord`;
    } else {
      predictedModeLabel = `Spenn (spans): alle ${groups.length} ledd innenfor ${effectiveWindow} ord`;
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
    raw: trimmed,
    terms: flatTerms,
    termGroups: hasWildcardOrGroup ? groups : undefined,
    matchMode: 'near',
    window: effectiveWindow,
    symmetric,
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
      maxCorpusDocs: 100000,
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
  if (parsed.hasWildcardOrGroup) {
    throw new Error(
      'Wildcard (*) og OR-grupper støttes i tellinger og trender, men ikke i offentlig konkordans (/concordance_public).'
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
