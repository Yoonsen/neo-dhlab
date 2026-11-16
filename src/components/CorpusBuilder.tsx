import React, { useEffect, useId, useRef, useState } from 'react';
import { ActiveCorpus, buildCorpusRequest } from '../api';
import { parseCorpusFile } from '../excelCorpusParser';

interface CorpusBuilderProps {
  open: boolean;
  baseUrl: string;
  corpus: ActiveCorpus;
  onCorpusChange: (next: ActiveCorpus) => void;
  onClose: () => void;
  onLog: (entry: {
    endpoint: string;
    queryText: string;
    modeLabel: string;
    total?: number;
    docs?: number;
    clientMs: number;
    payload: Record<string, unknown>;
  }) => void;
}

export const CorpusBuilder: React.FC<CorpusBuilderProps> = ({
  open,
  baseUrl,
  onCorpusChange,
  onClose,
  onLog,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileInputId = useId();
  const yearFromId = useId();
  const yearToId = useId();
  const langSelectId = useId();
  const authorInputId = useId();
  const subjectInputId = useId();
  const formSelectId = useId();
  const rawIdsId = useId();

  const [yearFrom, setYearFrom] = useState<string>('1850');
  const [yearTo, setYearTo] = useState<string>('1950');
  const [lang, setLang] = useState<string>('');
  const [literaryForm, setLiteraryForm] = useState<string>('');
  const [authorPrefix, setAuthorPrefix] = useState<string>('');
  const [subjectPrefix, setSubjectPrefix] = useState<string>('');
  const [rawIdsText, setRawIdsText] = useState<string>('');

  const [building, setBuilding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
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
        label: file.name.replace(/\.(xlsx|csv|tsv|txt)$/i, ''),
        corpusToken: data.corpusToken,
        filterIds: [],
        size: data.size,
        sourceDescription: `Roaring (${byteSize} B · ${clientMs} ms)`,
      });

      onLog({
        endpoint: '/corpus',
        queryText: file.name,
        modeLabel: 'Excel/CSV → Roaring',
        docs: data.size,
        clientMs,
        payload: {
          file: file.name,
          dhlabids: extracted.dhlabids.length,
          urns: extracted.urns.length,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBuildMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuilding(true);
    setError(null);
    try {
      // Hvis brukeren har limt inn dhlabid / URN i tekstfeltet, bruk det
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
        onLog({
          endpoint: '/corpus',
          queryText: `Liste (${pasted.length})`,
          modeLabel: 'Roaring',
          docs: data.size,
          clientMs,
          payload: req,
        });
        onClose();
        return;
      }

      // Ellers bygg fra metadata-feltene
      const nodes: Record<string, unknown>[] = [];
      const labels: string[] = [];

      const lo = parseInt(yearFrom, 10);
      const hi = parseInt(yearTo, 10);
      if (!Number.isNaN(lo) || !Number.isNaN(hi)) {
        const yNode: Record<string, unknown> = { k: 'year' };
        if (!Number.isNaN(lo)) yNode.from = lo;
        if (!Number.isNaN(hi)) yNode.to = hi;
        nodes.push(yNode);
        labels.push(`${!Number.isNaN(lo) ? lo : '*'}–${!Number.isNaN(hi) ? hi : '*'}`);
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
        nodes.push({ k: 'authors', prefix: authorPrefix.trim() });
        labels.push(`forfatter:${authorPrefix.trim()}*`);
      }
      if (subjectPrefix.trim()) {
        nodes.push({ k: 'subjects', prefix: subjectPrefix.trim() });
        labels.push(`emne:${subjectPrefix.trim()}*`);
      }

      if (nodes.length === 0) {
        throw new Error('Velg minst ett filter eller last opp en fil.');
      }

      const query = nodes.length === 1 ? nodes[0] : { and: nodes };
      const { data, clientMs } = await buildCorpusRequest(baseUrl, { query });
      const label = labels.join(' · ');

      onCorpusChange({
        enabled: true,
        label,
        corpusToken: data.corpusToken,
        filterIds: [],
        size: data.size,
        sourceDescription: `Roaring (${clientMs} ms)`,
      });

      onLog({
        endpoint: '/corpus',
        queryText: label,
        modeLabel: 'Roaring',
        docs: data.size,
        clientMs,
        payload: { query },
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
      aria-label="Definer korpus"
      onClose={onClose}
    >
      <div className="modal-header">
        <h2>Velg eller last opp korpus</h2>
        <button
          type="button"
          className="btn-icon"
          aria-label="Lukk dialog"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {error && (
        <div role="alert" className="error-banner" style={{ marginBlockEnd: '0.75rem' }}>
          {error}
        </div>
      )}

      {/* 1. Filopplasting (Excel / CSV) */}
      <div className="upload-dropzone" style={{ marginBlockEnd: '1rem' }}>
        <div className="upload-row">
          <div>
            <strong>Fra fil (.xlsx eller .csv)</strong>
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              Leser kolonnen <code>dhlabid</code> eller <code>urn</code> og lager Roaring-bitmap
            </div>
          </div>
          <label htmlFor={fileInputId} className="btn-secondary file-label-btn">
            {building ? 'Leser…' : 'Last opp fil…'}
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

      {/* 2. Enkelt metadata- eller ID-skjema */}
      <form onSubmit={(e) => void handleBuildMetadata(e)} className="modal-form">
        <div className="modal-grid">
          <div className="field-stack">
            <label htmlFor={yearFromId}>Fra år</label>
            <input
              id={yearFromId}
              type="text"
              inputMode="numeric"
              value={yearFrom}
              placeholder="1850"
              onChange={(e) => setYearFrom(e.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor={yearToId}>Til år</label>
            <input
              id={yearToId}
              type="text"
              inputMode="numeric"
              value={yearTo}
              placeholder="1950"
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor={langSelectId}>Språk</label>
            <select
              id={langSelectId}
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="">Alle språk</option>
              <option value="nob">Bokmål (nob)</option>
              <option value="nno">Nynorsk (nno)</option>
              <option value="dan">Dansk (dan)</option>
              <option value="eng">Engelsk (eng)</option>
              <option value="ger">Tysk (ger)</option>
            </select>
          </div>
          <div className="field-stack">
            <label htmlFor={formSelectId}>Litterær form</label>
            <select
              id={formSelectId}
              value={literaryForm}
              onChange={(e) => setLiteraryForm(e.target.value)}
            >
              <option value="">Alle former</option>
              <option value="Skjønnlitteratur">Skjønnlitteratur</option>
              <option value="Faglitteratur">Faglitteratur</option>
              <option value="Uklassifisert">Uklassifisert</option>
            </select>
          </div>
          <div className="field-stack">
            <label htmlFor={authorInputId}>Forfatter (starter med)</label>
            <input
              id={authorInputId}
              type="text"
              value={authorPrefix}
              placeholder="f.eks. Ibsen eller Hamsun"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setAuthorPrefix(e.target.value)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor={subjectInputId}>Emneord (starter med)</label>
            <input
              id={subjectInputId}
              type="text"
              value={subjectPrefix}
              placeholder="f.eks. Historie eller Norge"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setSubjectPrefix(e.target.value)}
            />
          </div>
        </div>

        <div className="field-stack" style={{ marginBlockStart: '0.75rem' }}>
          <label htmlFor={rawIdsId}>
            Eller lim inn <code>dhlabid</code> / <code>URN</code> direkte (valgfritt)
          </label>
          <textarea
            id={rawIdsId}
            rows={2}
            value={rawIdsText}
            onChange={(e) => setRawIdsText(e.target.value)}
            placeholder="100000100, 100000200 eller URN:NBN:no-nb_digibok_..."
          />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit" className="btn-primary" disabled={building}>
            {building ? 'Bygger korpus…' : 'Bruk korpus'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
