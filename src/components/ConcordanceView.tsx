import React, { useId } from 'react';
import { ConcordanceResponse, ParsedQuery } from '../api';
import { downloadExcelFile } from '../excelExport';
import { UiStrings } from '../i18n';

interface ConcordanceViewProps {
  t: UiStrings;
  queryText: string;
  parsed: ParsedQuery;
  parsedList: ParsedQuery[];
  onSelectParsed: (p: ParsedQuery) => void;
  data: ConcordanceResponse | null;
  clientMs: number | null;
  loading: boolean;
  error: string | null;
  limit: number;
  before: number;
  after: number;
  onOptionsChange: (opts: { limit: number; before: number; after: number }) => void;
  onFetch: () => void;
}

export const ConcordanceView: React.FC<ConcordanceViewProps> = ({
  t,
  queryText,
  parsed,
  parsedList,
  onSelectParsed,
  data,
  clientMs,
  loading,
  error,
  limit,
  before,
  after,
  onOptionsChange,
  onFetch,
}) => {
  const captionId = useId();
  const limitSelectId = useId();

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
      ['dhlabid', 'left', 'hit', 'right'],
      ...data.rows.map((r) => [r.dhlabid, r.left, r.hit, r.right]),
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
                <th scope="col" className="col-dhlabid">
                  dhlabid
                </th>
                <th scope="col" className="col-left">
                  {t.colLeft}
                </th>
                <th scope="col" className="col-hit">
                  {t.colHit}
                </th>
                <th scope="col" className="col-right">
                  {t.colRight}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => {
                const { leftNode, hitNode, rightNode } = renderSegmentedRow(row);
                return (
                  <tr key={`${row.dhlabid}-${i}`}>
                    <th scope="row" className="col-dhlabid">
                      <code>{row.dhlabid}</code>
                    </th>
                    <td className="col-left">{leftNode}</td>
                    <td className="col-hit">{hitNode}</td>
                    <td className="col-right">{rightNode}</td>
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
