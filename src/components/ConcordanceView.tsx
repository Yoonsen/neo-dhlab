import React, { useId } from 'react';
import {
  BookMetadataRow,
  buildNbItemUrl,
  ConcordanceResponse,
  normalizeAuthorName,
  ParsedQuery,
} from '../api';
import { downloadExcelFile } from '../excelExport';
import { UiStrings } from '../i18n';

interface ConcordanceViewProps {
  t: UiStrings;
  queryText: string;
  parsed: ParsedQuery;
  parsedList: ParsedQuery[];
  onSelectParsed: (p: ParsedQuery) => void;
  data: ConcordanceResponse | null;
  metadataById: Record<number, BookMetadataRow>;
  clientMs: number | null;
  loading: boolean;
  error: string | null;
  limit: number;
  before: number;
  after: number;
  onOptionsChange: (opts: { limit: number; before: number; after: number }) => void;
  onFetch: () => void;
  onOpenDispersionForBook: (dhlabid: number) => void;
}

export const ConcordanceView: React.FC<ConcordanceViewProps> = ({
  t,
  queryText,
  parsed,
  parsedList,
  onSelectParsed,
  data,
  metadataById,
  clientMs,
  loading,
  error,
  limit,
  before,
  after,
  onOptionsChange,
  onFetch,
  onOpenDispersionForBook,
}) => {
  const captionId = useId();
  const limitSelectId = useId();

  type ConcSortCol = 'book' | 'left' | 'hit' | 'right';
  const [sortCol, setSortCol] = React.useState<ConcSortCol | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: ConcSortCol) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const renderSortArrow = (col: ConcSortCol) => {
    if (sortCol !== col) return <span className="sort-indicator-muted">↕</span>;
    return (
      <span className="sort-indicator-active">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const sortedRows = React.useMemo(() => {
    if (!data?.rows) return [];
    if (!sortCol) return data.rows;
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...data.rows].sort((a, b) => {
      if (sortCol === 'book') {
        const ma = metadataById[a.dhlabid];
        const mb = metadataById[b.dhlabid];
        const ya = ma?.year ?? 9999;
        const yb = mb?.year ?? 9999;
        if (ya !== yb) return mul * (ya - yb);
        return mul * (ma?.title ?? '').localeCompare(mb?.title ?? '', 'nb-NO');
      }
      if (sortCol === 'hit') {
        return mul * a.hit.localeCompare(b.hit, 'nb-NO');
      }
      if (sortCol === 'right') {
        return mul * a.right.trim().localeCompare(b.right.trim(), 'nb-NO');
      }
      // sortCol === 'left': sorter på ordet nærmest treffet (siste ord i venstre kontekst!)
      const lastA = a.left.trim().split(/\s+/).pop() ?? '';
      const lastB = b.left.trim().split(/\s+/).pop() ?? '';
      return mul * lastA.localeCompare(lastB, 'nb-NO');
    });
  }, [data?.rows, metadataById, sortCol, sortDir]);

  // Finn gruppeliste fra parsed spørring slik at vi kan vise en fargeforklaring over tabellen
  const groupLabels: { label: string; isAnchor: boolean; groupIdx: number }[] =
    React.useMemo(() => {
      const rawGroups =
        parsed.termGroups && parsed.termGroups.length > 0
          ? parsed.termGroups
          : parsed.terms.map((w) => [w]);
      const anyExplicitCaret = rawGroups.some((g) =>
        g.some((w) => w.startsWith('^'))
      );
      return rawGroups.map((g, idx) => {
        const hasCaret = g.some((w) => w.startsWith('^'));
        const isAnchor =
          parsed.matchMode === 'sequence'
            ? true
            : anyExplicitCaret
            ? hasCaret
            : idx === 0;
        const cleanWords = g.map((w) => w.replace(/^\^/, ''));
        return {
          label: cleanWords.length > 1 ? cleanWords.join(' | ') : cleanWords[0] ?? '',
          isAnchor,
          groupIdx: idx,
        };
      });
    }, [parsed]);

  // Bygg opp fargede tokens i left, hit og right ved hjelp av row.marks ([tokenIndex, groupIndex])
  const renderSegmentedRow = (row: ConcordanceResponse['rows'][number]) => {
    const leftTokens = row.left ? row.left.trim().split(/\s+/).filter(Boolean) : [];
    const hitTokens = row.hit ? row.hit.trim().split(/\s+/).filter(Boolean) : [];
    const rightTokens = row.right
      ? row.right.trim().split(/\s+/).filter(Boolean)
      : [];

    const markMap = new Map<number, number>();
    if (Array.isArray(row.marks)) {
      for (const pair of row.marks) {
        if (Array.isArray(pair) && pair.length >= 2) {
          markMap.set(pair[0], pair[1]);
        }
      }
    }

    const leftStart = 0;
    const hitStart = leftTokens.length;
    const rightStart = leftTokens.length + hitTokens.length;

    const renderTokenList = (
      tokens: string[],
      baseIdx: number,
      isHitCol: boolean
    ) => {
      if (tokens.length === 0) return null;
      return tokens.map((tok, i) => {
        const globalIdx = baseIdx + i;
        const gIdx = markMap.get(globalIdx);
        const space = i < tokens.length - 1 ? ' ' : '';

        if (isHitCol) {
          const groupClass =
            gIdx !== undefined ? `g${Math.min(4, gIdx)}` : 'g0';
          return (
            <React.Fragment key={globalIdx}>
              <mark className={`conc-mark ${groupClass} anchor`}>{tok}</mark>
              {space}
            </React.Fragment>
          );
        }

        if (gIdx !== undefined) {
          const groupClass = `g${Math.min(4, gIdx)}`;
          const isAnchorIdx = row.anchor !== undefined && globalIdx === row.anchor;
          return (
            <React.Fragment key={globalIdx}>
              <mark
                className={`conc-mark ${groupClass}${
                  isAnchorIdx ? ' anchor' : ''
                }`}
              >
                {tok}
              </mark>
              {space}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={globalIdx}>
            {tok}
            {space}
          </React.Fragment>
        );
      });
    };

    return {
      leftNode: renderTokenList(leftTokens, leftStart, false),
      hitNode:
        hitTokens.length > 0 ? (
          renderTokenList(hitTokens, hitStart, true)
        ) : (
          <mark className="conc-mark g0 anchor">{row.hit}</mark>
        ),
      rightNode: renderTokenList(rightTokens, rightStart, false),
    };
  };

  const exportExcel = () => {
    if (!data || data.rows.length === 0) return;
    const matrix: (string | number)[][] = [
      ['dhlabid', 'urn', 'year', 'authors', 'title', 'left', 'hit', 'right', 'nb_url'],
      ...data.rows.map((r) => {
        const meta = metadataById[r.dhlabid];
        const nbUrl = buildNbItemUrl(meta?.urn, parsed, r.hit) ?? '';
        return [
          r.dhlabid,
          meta?.urn ?? '',
          meta?.year ?? '',
          normalizeAuthorName(meta?.authors),
          meta?.title ?? '',
          r.left,
          r.hit,
          r.right,
          nbUrl,
        ];
      }),
    ];
    downloadExcelFile(
      `konkordans_${queryText.replace(/\s+/g, '_')}.xlsx`,
      matrix
    );
  };

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
            <label htmlFor={limitSelectId}>{t.linesCountLabel}</label>
            <select
              id={limitSelectId}
              value={limit}
              onChange={(e) =>
                onOptionsChange({
                  limit: Number(e.target.value),
                  before,
                  after,
                })
              }
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={onFetch}
            disabled={loading || parsed.terms.length === 0}
          >
            {loading ? t.fetchingBtn : t.refetchBtn}
          </button>

          {data && data.rows.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
            >
              Excel (.xlsx)
            </button>
          )}
        </div>

        {data && (
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            {t.linesFromBooks(data.lines, data.books)} ·{' '}
            <strong className="speed-highlight">{clientMs} ms</strong>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {loading && !data && (
        <div role="status" aria-live="polite" className="loading-card">
          <span className="spinner" aria-hidden="true" />
          <span>Henter konkordanslinjer…</span>
        </div>
      )}

      {data && data.rows.length > 0 && groupLabels.length > 1 && (
        <div className="conc-group-legend" aria-label="Fargeforklaring for søkeord">
          {groupLabels.map((gl) => (
            <span key={gl.groupIdx} className="conc-legend-item">
              <mark
                className={`conc-mark g${Math.min(4, gl.groupIdx)}${
                  gl.isAnchor ? ' anchor' : ''
                }`}
              >
                {gl.isAnchor ? `^${gl.label}` : gl.label}
              </mark>
            </span>
          ))}
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper kwic-table-wrapper"
        >
          <table className="kwic-table">
            <caption id={captionId} className="visually-hidden">
              Konkordans for {queryText}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="col-book-meta">
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => toggleSort('book')}
                    title="Sorter på utgivelsesår / tittel"
                  >
                    <span>Bok (Nettbiblioteket)</span>
                    {renderSortArrow('book')}
                  </button>
                </th>
                <th scope="col" className="col-left">
                  <button
                    type="button"
                    className="th-sort-btn th-sort-btn-end"
                    onClick={() => toggleSort('left')}
                    title="Sorter på ordet rett til venstre for treffet"
                  >
                    <span>{t.colLeft}</span>
                    {renderSortArrow('left')}
                  </button>
                </th>
                <th scope="col" className="col-hit">
                  <button
                    type="button"
                    className="th-sort-btn th-sort-btn-center"
                    onClick={() => toggleSort('hit')}
                  >
                    <span>{t.colHit}</span>
                    {renderSortArrow('hit')}
                  </button>
                </th>
                <th scope="col" className="col-right">
                  <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => toggleSort('right')}
                    title="Sorter på ordet rett til høyre for treffet"
                  >
                    <span>{t.colRight}</span>
                    {renderSortArrow('right')}
                  </button>
                </th>
                <th scope="col" className="col-arc">
                  Bue
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const { leftNode, hitNode, rightNode } = renderSegmentedRow(row);
                const meta = metadataById[row.dhlabid];
                const nbUrl = buildNbItemUrl(meta?.urn, parsed, row.hit);
                const author = normalizeAuthorName(meta?.authors);
                const title = meta?.title?.trim() || `dhlabid ${row.dhlabid}`;
                const year = meta?.year;
                const fullTooltip = [
                  title,
                  author ? `Forfatter: ${author}` : '',
                  year ? `År: ${year}` : '',
                  meta?.urn ? `URN: ${meta.urn}` : `dhlabid: ${row.dhlabid}`,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <tr key={`${row.dhlabid}-${i}`}>
                    <th scope="row" className="col-book-meta" title={fullTooltip}>
                      {nbUrl ? (
                        <a
                          href={nbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="book-meta-link"
                        >
                          <span className="book-meta-title">{title}</span>
                          <span className="book-meta-sub">
                            {year ? `${year}` : ''}
                            {year && author ? ' · ' : ''}
                            {author || ''}
                          </span>
                        </a>
                      ) : (
                        <div className="book-meta-fallback">
                          <span className="book-meta-title">{title}</span>
                          {(year || author) && (
                            <span className="book-meta-sub">
                              {year ? `${year}` : ''}
                              {year && author ? ' · ' : ''}
                              {author || ''}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                    <td className="col-left">{leftNode}</td>
                    <td className="col-hit">{hitNode}</td>
                    <td className="col-right">{rightNode}</td>
                    <td className="col-arc">
                      <button
                        type="button"
                        className="btn-tiny arc-trigger-btn"
                        title={`Vis Vonnegut-bue (narrativ bue) i «${title}»`}
                        onClick={() => onOpenDispersionForBook(row.dhlabid)}
                      >
                        📈 Bue
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
