import React, { useEffect, useId, useRef, useState } from 'react';
import {
  ActiveCorpus,
  buildCorpusRequest,
  buildNearQueryPayload,
  FacetValue,
  fetchCorpusFacets,
  fetchNearCount,
  parseSearchQuery,
  splitTopLevelAnd,
} from '../api';
import { parseCorpusFile } from '../excelCorpusParser';
import { UiStrings } from '../i18n';

interface CorpusBuilderProps {
  open: boolean;
  t: UiStrings;
  baseUrl: string;
  corpus: ActiveCorpus;
  onCorpusChange: (next: ActiveCorpus) => void;
  onClose: () => void;
}

export const CorpusBuilder: React.FC<CorpusBuilderProps> = ({
  open,
  t,
  baseUrl,
  corpus,
  onCorpusChange,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileInputId = useId();
  const corpusNameId = useId();
  const textQueryId = useId();
  const textWindowId = useId();
  const yearFromId = useId();
  const yearToId = useId();
  const langSelectId = useId();
  const authorInputId = useId();
  const subjectInputId = useId();
  const ddcInputId = useId();
  const formSelectId = useId();
  const rawIdsId = useId();

  const [customName, setCustomName] = useState<string>('');
  const [textFilter, setTextFilter] = useState<string>('');
  const [textWindow, setTextWindow] = useState<number>(5);
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [lang, setLang] = useState<string>('');
  const [literaryForm, setLiteraryForm] = useState<string>('');
  const [authorPrefix, setAuthorPrefix] = useState<string>('');
  const [authorExact, setAuthorExact] = useState<string>('');
  const [authorSuggestions, setAuthorSuggestions] = useState<FacetValue[]>([]);
  const [subjectPrefix, setSubjectPrefix] = useState<string>('');
  const [subjectExact, setSubjectExact] = useState<string>('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<FacetValue[]>([]);
  const [ddcPrefix, setDdcPrefix] = useState<string>('');
  const [ddcExact, setDdcExact] = useState<string>('');
  const [ddcSuggestions, setDdcSuggestions] = useState<FacetValue[]>([]);
  const [rawIdsText, setRawIdsText] = useState<string>('');

  const [building, setBuilding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Autofullføring for forfatter etter 2+ tegn
  useEffect(() => {
    const q = authorPrefix.trim();
    if (!open || q.length < 2 || q === authorExact) {
      setAuthorSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const cap = q.charAt(0).toUpperCase() + q.slice(1);
      fetchCorpusFacets(baseUrl, { k: 'authors', prefix: cap, limit: 12 })
        .then(({ data }) => {
          if (!cancelled) setAuthorSuggestions(data.values ?? []);
        })
        .catch(() => {
          if (!cancelled) setAuthorSuggestions([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authorExact, authorPrefix, baseUrl, open]);

  // Autofullføring for emne etter 2+ tegn
  useEffect(() => {
    const q = subjectPrefix.trim();
    if (!open || q.length < 2 || q === subjectExact) {
      setSubjectSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const cap = q.charAt(0).toUpperCase() + q.slice(1);
      fetchCorpusFacets(baseUrl, { k: 'subjects', prefix: cap, limit: 12 })
        .then(({ data }) => {
          if (!cancelled) setSubjectSuggestions(data.values ?? []);
        })
        .catch(() => {
          if (!cancelled) setSubjectSuggestions([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [baseUrl, open, subjectExact, subjectPrefix]);

  // Autofullføring for Dewey (ddc) etter 1+ siffer
  useEffect(() => {
    const q = ddcPrefix.trim().replace(/\*+$/, '');
    if (!open || q.length < 1 || q === ddcExact) {
      setDdcSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchCorpusFacets(baseUrl, { k: 'ddc', prefix: q, limit: 12 })
        .then(({ data }) => {
          if (!cancelled) setDdcSuggestions(data.values ?? []);
        })
        .catch(() => {
          if (!cancelled) setDdcSuggestions([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [baseUrl, ddcExact, ddcPrefix, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleFileUpload = async (file: File) => {
    setBuilding(true);
    setError(null);
    try {
      const extracted = await parseCorpusFile(file);
      if (extracted.dhlabids.length === 0 && extracted.urns.length === 0) {
        throw new Error(
          `Fant ingen gyldige dhlabid eller URN i «${file.name}».`
        );
      }

      const req: { dhlabids?: number[]; urns?: string[] } = {};
      if (extracted.dhlabids.length > 0) req.dhlabids = extracted.dhlabids;
      if (extracted.urns.length > 0) req.urns = extracted.urns;

      const { data, clientMs } = await buildCorpusRequest(baseUrl, req);
      const byteSize = Math.round((data.corpusToken.length * 3) / 4);

      onCorpusChange({
        enabled: true,
        label:
          customName.trim() || file.name.replace(/\.(xlsx|csv|tsv|txt)$/i, ''),
        corpusToken: data.corpusToken,
        filterIds: [],
        size: data.size,
        sourceDescription: `Roaring (${byteSize} B · ${clientMs} ms)`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuilding(true);
    setError(null);
    try {
      // 1. Hvis brukeren har limt inn dhlabid / URN i tekstfeltet
      const pasted = rawIdsText
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (pasted.length > 0) {
        const urns = pasted.filter((t) => t.toUpperCase().startsWith('URN:'));
        const ids = pasted
          .filter((t) => /^\d+$/.test(t))
          .map((t) => parseInt(t, 10));
        if (urns.length === 0 && ids.length === 0) {
          throw new Error('Fant ingen gyldige dhlabid eller URN i listen.');
        }
        const req: { dhlabids?: number[]; urns?: string[] } = {};
        if (ids.length > 0) req.dhlabids = ids;
        if (urns.length > 0) req.urns = urns;
        const { data, clientMs } = await buildCorpusRequest(baseUrl, req);
        onCorpusChange({
          enabled: true,
          label: `ID-liste (${data.size.toLocaleString('nb-NO')} bøker)`,
          corpusToken: data.corpusToken,
          filterIds: [],
          size: data.size,
          sourceDescription: `Roaring (${clientMs} ms)`,
        });
        onClose();
        return;
      }

      // 2. Samle metadatakriterier hvis noen er satt
      const nodes: Record<string, unknown>[] = [];
      const labels: string[] = [];

      const lo = parseInt(yearFrom, 10);
      const hi = parseInt(yearTo, 10);
      if (!Number.isNaN(lo) || !Number.isNaN(hi)) {
        const yNode: Record<string, unknown> = { k: 'year' };
        if (!Number.isNaN(lo)) yNode.from = lo;
        if (!Number.isNaN(hi)) yNode.to = hi;
        nodes.push(yNode);
        labels.push(
          `${!Number.isNaN(lo) ? lo : '*'}–${!Number.isNaN(hi) ? hi : '*'}`
        );
      }
      if (lang) {
        nodes.push({ k: 'lang_doc', v: lang });
        labels.push(lang);
      }
      if (literaryForm) {
        nodes.push({ k: 'literaryform', v: literaryForm });
        labels.push(literaryForm);
      }
      if (authorPrefix.trim()) {
        const rawA = authorPrefix.trim();
        if (authorExact && rawA === authorExact) {
          nodes.push({ k: 'authors', v: authorExact });
          labels.push(`forfatter:${authorExact}`);
        } else {
          const capA = rawA.charAt(0).toUpperCase() + rawA.slice(1);
          nodes.push({ k: 'authors', prefix: capA });
          labels.push(`forfatter:${capA}*`);
        }
      }
      if (subjectPrefix.trim()) {
        const rawS = subjectPrefix.trim();
        if (subjectExact && rawS === subjectExact) {
          nodes.push({ k: 'subjects', v: subjectExact });
          labels.push(`emne:${subjectExact}`);
        } else {
          const capS = rawS.charAt(0).toUpperCase() + rawS.slice(1);
          nodes.push({ k: 'subjects', prefix: capS });
          labels.push(`emne:${capS}*`);
        }
      }
      if (ddcPrefix.trim()) {
        const rawD = ddcPrefix.trim().replace(/\*+$/, '');
        if (ddcExact && rawD === ddcExact && !ddcPrefix.includes('*')) {
          nodes.push({ k: 'ddc', v: ddcExact });
          labels.push(`ddk:${ddcExact}`);
        } else {
          nodes.push({ k: 'ddc', prefix: rawD });
          labels.push(`ddk:${rawD}*`);
        }
      }

      let metaCorpusToken: string | null = null;
      let metaSize = 0;
      let totalMs = 0;

      if (nodes.length > 0) {
        const query = nodes.length === 1 ? nodes[0] : { and: nodes };
        const { data, clientMs } = await buildCorpusRequest(baseUrl, { query });
        metaCorpusToken = data.corpusToken;
        metaSize = data.size;
        totalMs += clientMs;
      }

      // 3. Hvis brukeren har skrevet søkeuttrykk (f.eks. NEAR(a b, 5) AND NEAR(c d, 10) eller doc WHERE ... / {doc | ...}) for å avgrense korpuset
      let cleanText = textFilter.trim();
      const setDocMatch = cleanText.match(/^\{\s*doc\s*\|\s*([^{}]+?)\s*\}$/i);
      if (setDocMatch) {
        cleanText = setDocMatch[1].trim();
      } else if (/^doc\s+WHERE\s+/i.test(cleanText)) {
        cleanText = cleanText.replace(/^doc\s+WHERE\s+/i, '').trim();
      }
      if (cleanText) {
        const clauses = splitTopLevelAnd(cleanText);
        let curToken = metaCorpusToken;
        let curSize = metaSize;
        let lastSampled = false;
        let lastTotalDocs = 0;

        for (const clauseText of clauses) {
          const parsedText = parseSearchQuery(clauseText, textWindow, true);
          const tempCorpus: ActiveCorpus = curToken
            ? {
                enabled: true,
                label: '',
                corpusToken: curToken,
                filterIds: [],
                size: curSize,
                sourceDescription: '',
              }
            : {
                enabled: false,
                label: '',
                corpusToken: null,
                filterIds: [],
                size: 0,
                sourceDescription: '',
              };

          const nearPayload = buildNearQueryPayload(parsedText, tempCorpus, {
            returnCorpus: true,
            maxCorpusDocs: 100000,
          });
          const { data: nearData, clientMs: nearMs } = await fetchNearCount(
            baseUrl,
            nearPayload
          );
          totalMs += nearMs;

          if (!nearData.corpusToken) {
            throw new Error(
              `Søket «${clauseText}» treffer ${nearData.docs.toLocaleString(
                'nb-NO'
              )} bøker, men serveren returnerte ikke corpusToken.`
            );
          }
          curToken = nearData.corpusToken;
          curSize = nearData.corpusSize ?? nearData.docs;
          lastTotalDocs = nearData.docs;
          lastSampled = Boolean(nearData.sampled);
        }

        const sampledNote = lastSampled
          ? ` (utvalg av ${lastTotalDocs.toLocaleString('nb-NO')})`
          : '';
        labels.push(`tekst:«${cleanText}»`);
        onCorpusChange({
          enabled: true,
          label: customName.trim() || labels.join(' · '),
          corpusToken: curToken,
          filterIds: [],
          size: curSize,
          sourceDescription: `Roaring fra søk${sampledNote} (${totalMs} ms)`,
        });
        onClose();
        return;
      }

      if (!metaCorpusToken) {
        throw new Error('Velg minst ett filter, søkeuttrykk eller last opp en fil.');
      }

      onCorpusChange({
        enabled: true,
        label: customName.trim() || labels.join(' · '),
        corpusToken: metaCorpusToken,
        filterIds: [],
        size: metaSize,
        sourceDescription: `Roaring (${totalMs} ms)`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="corpus-modal"
      aria-label={t.corpusModalTitle}
      onClose={onClose}
    >
      <div className="modal-header">
        <h2>{t.corpusModalTitle}</h2>
        <button
          type="button"
          className="btn-icon"
          aria-label={t.closeBtn}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="error-banner"
          style={{ marginBlockEnd: '0.85rem' }}
        >
          {error}
        </div>
      )}

      {/* 1. Filopplasting (Excel / CSV) */}
      <div className="upload-dropzone" style={{ marginBlockEnd: '1rem' }}>
        <div className="upload-row">
          <div>
            <strong>{t.uploadFileTitle}</strong>
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              {t.uploadFileSub}
            </div>
          </div>
          <label htmlFor={fileInputId} className="btn-secondary file-label-btn">
            {building ? t.readingBtn : t.chooseFileBtn}
          </label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".xlsx,.csv,.tsv,.txt"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileUpload(f);
            }}
          />
        </div>
      </div>

      <form onSubmit={(e) => void handleBuild(e)} className="modal-form">
        <div className="field-stack" style={{ marginBlockEnd: '0.85rem' }}>
          <label htmlFor={corpusNameId}>{t.corpusNameLabel}</label>
          <input
            id={corpusNameId}
            type="text"
            value={customName}
            placeholder={t.corpusNamePlaceholder}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </div>

        {/* 2. Begrens på søkeuttrykk (near_query eller enkeltord) */}
        <div className="field-stack" style={{ marginBlockEnd: '0.85rem' }}>
          <label htmlFor={textQueryId}>{t.textFilterLabel}</label>
          <div className="input-with-btn">
            <input
              id={textQueryId}
              type="text"
              value={textFilter}
              placeholder='demokrati diktatur / NEAR(skib storm, 10)'
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setTextFilter(e.target.value)}
            />
            <div className="field-inline" style={{ flex: 'none' }}>
              <label htmlFor={textWindowId}>{t.windowLabel}</label>
              <input
                id={textWindowId}
                type="text"
                inputMode="numeric"
                className="year-input"
                style={{ inlineSize: '3.5rem' }}
                value={textWindow}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setTextWindow(v);
                }}
              />
            </div>
          </div>
        </div>

        {/* 3. Metadata */}
        <div className="modal-grid">
          <div className="field-stack">
            <label htmlFor={yearFromId}>{t.fromYear}</label>
            <input
              id={yearFromId}
              type="text"
              inputMode="numeric"
              value={yearFrom}
              placeholder="Alle (f.eks. 1650 / 1800)"
              onChange={(e) => setYearFrom(e.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor={yearToId}>{t.toYear}</label>
            <input
              id={yearToId}
              type="text"
              inputMode="numeric"
              value={yearTo}
              placeholder="Alle (f.eks. 1850 / 2026)"
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor={langSelectId}>{t.langLabel}</label>
            <select
              id={langSelectId}
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="">{t.allLangs}</option>
              <option value="nob">Bokmål (nob)</option>
              <option value="nno">Nynorsk (nno)</option>
              <option value="dan">Dansk (dan)</option>
              <option value="eng">English (eng)</option>
              <option value="ger">Deutsch (ger)</option>
            </select>
          </div>
          <div className="field-stack">
            <label htmlFor={formSelectId}>{t.formLabel}</label>
            <select
              id={formSelectId}
              value={literaryForm}
              onChange={(e) => setLiteraryForm(e.target.value)}
            >
              <option value="">{t.allForms}</option>
              <option value="Skjønnlitteratur">Skjønnlitteratur</option>
              <option value="Faglitteratur">Faglitteratur</option>
              <option value="Uklassifisert">Uklassifisert</option>
            </select>
          </div>
          <div className="field-stack" style={{ position: 'relative' }}>
            <label htmlFor={authorInputId}>{t.authorLabel}</label>
            <input
              id={authorInputId}
              type="text"
              value={authorPrefix}
              placeholder="Fosse / Ibsen / Hamsun"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => {
                setAuthorPrefix(e.target.value);
                setAuthorExact('');
              }}
            />
            {authorSuggestions.length > 0 && (
              <div className="facet-suggest-list" role="listbox" aria-label="Forfatterforslag">
                {authorSuggestions.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className="facet-suggest-item"
                    onClick={() => {
                      setAuthorPrefix(f.value);
                      setAuthorExact(f.value);
                      setAuthorSuggestions([]);
                    }}
                  >
                    <span>{f.value}</span>
                    <span className="muted">({f.docs.toLocaleString('nb-NO')})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field-stack" style={{ position: 'relative' }}>
            <label htmlFor={subjectInputId}>{t.subjectLabel}</label>
            <input
              id={subjectInputId}
              type="text"
              value={subjectPrefix}
              placeholder="Historie / Norge"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => {
                setSubjectPrefix(e.target.value);
                setSubjectExact('');
              }}
            />
            {subjectSuggestions.length > 0 && (
              <div className="facet-suggest-list" role="listbox" aria-label="Emneforslag">
                {subjectSuggestions.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className="facet-suggest-item"
                    onClick={() => {
                      setSubjectPrefix(f.value);
                      setSubjectExact(f.value);
                      setSubjectSuggestions([]);
                    }}
                  >
                    <span>{f.value}</span>
                    <span className="muted">({f.docs.toLocaleString('nb-NO')})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field-stack" style={{ position: 'relative' }}>
            <label htmlFor={ddcInputId}>Dewey / DDK (starter med)</label>
            <input
              id={ddcInputId}
              type="text"
              value={ddcPrefix}
              placeholder="641 (mat) / 839.82 / 948.1"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => {
                setDdcPrefix(e.target.value);
                setDdcExact('');
              }}
            />
            {ddcSuggestions.length > 0 && (
              <div className="facet-suggest-list" role="listbox" aria-label="Dewey-forslag">
                {ddcSuggestions.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className="facet-suggest-item"
                    onClick={() => {
                      setDdcPrefix(f.value);
                      setDdcExact(f.value);
                      setDdcSuggestions([]);
                    }}
                  >
                    <span>
                      <code>{f.value}</code>
                    </span>
                    <span className="muted">({f.docs.toLocaleString('nb-NO')})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="field-stack" style={{ marginBlockStart: '0.75rem' }}>
          <label htmlFor={rawIdsId}>{t.pasteIdsLabel}</label>
          <textarea
            id={rawIdsId}
            rows={2}
            value={rawIdsText}
            onChange={(e) => setRawIdsText(e.target.value)}
            placeholder="100000100, 100000200 / URN:NBN:no-nb_digibok_..."
          />
        </div>

        <div className="modal-footer">
          {corpus.corpusToken && (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginInlineEnd: 'auto' }}
              onClick={() => {
                void navigator.clipboard.writeText(corpus.corpusToken!);
              }}
            >
              {t.copyTokenBtn}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.cancelBtn}
          </button>
          <button type="submit" className="btn-primary" disabled={building}>
            {building ? t.buildingCorpusBtn : t.applyCorpusBtn}
          </button>
        </div>
      </form>
    </dialog>
  );
};
