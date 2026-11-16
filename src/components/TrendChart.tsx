import React, { useId, useMemo, useState } from 'react';
import { YearCountRow } from '../api';

interface TrendChartProps {
  rows: YearCountRow[];
  queryText: string;
  countMode?: string | null;
  clientMs: number | null;
  serverMs?: number;
  loading: boolean;
}

type MetricType = 'perMillion' | 'total' | 'docShare';

export const TrendChart: React.FC<TrendChartProps> = ({
  rows,
  queryText,
  countMode,
  clientMs,
  serverMs,
  loading,
}) => {
  const tableCaptionId = useId();
  const metricGroupName = useId();
  const smoothSelectId = useId();

  const [metric, setMetric] = useState<MetricType>('perMillion');
  const [smoothing, setSmoothing] = useState<number>(5);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const filteredRows = useMemo(() => {
    // Trim ledende og avsluttende år der korpuset har 0 bøker, slik at kurven følger korpuset automatisk
    const firstWithBooks = rows.findIndex((r) => r.books > 0);
    if (firstWithBooks === -1) return [];
    let lastWithBooks = rows.length - 1;
    while (lastWithBooks > firstWithBooks && rows[lastWithBooks].books === 0) {
      lastWithBooks--;
    }
    return rows.slice(firstWithBooks, lastWithBooks + 1);
  }, [rows]);

  const series = useMemo(() => {
    const rawValues = filteredRows.map((r) => {
      if (metric === 'perMillion') return r.perMillion;
      if (metric === 'total') return r.total;
      return r.books > 0 ? (r.docs / r.books) * 100 : 0;
    });

    if (smoothing <= 1) return rawValues;
    const half = Math.floor(smoothing / 2);
    return rawValues.map((_, idx) => {
      const lo = Math.max(0, idx - half);
      const hi = Math.min(rawValues.length - 1, idx + half);
      let sum = 0;
      for (let i = lo; i <= hi; i++) sum += rawValues[i];
      return sum / (hi - lo + 1);
    });
  }, [filteredRows, metric, smoothing]);

  const summary = useMemo(() => {
    let totalHits = 0;
    let totalDocs = 0;
    let peakYear = 0;
    let peakVal = -1;
    filteredRows.forEach((r, idx) => {
      totalHits += r.total;
      totalDocs += r.docs;
      if (series[idx] > peakVal) {
        peakVal = series[idx];
        peakYear = r.year;
      }
    });
    const minYear = filteredRows[0]?.year;
    const maxYear = filteredRows[filteredRows.length - 1]?.year;
    return { totalHits, totalDocs, peakYear, peakVal, minYear, maxYear };
  }, [filteredRows, series]);

  const exportCsv = () => {
    const header = 'year,total,docs,books,tokens,perMillion\n';
    const body = filteredRows
      .map(
        (r) =>
          `${r.year},${r.total},${r.docs},${r.books},${r.tokens},${r.perMillion}`
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend_${queryText.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG dimensions
  const width = 920;
  const height = 320;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(...series, 0.0001);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t);

  const getX = (idx: number) => {
    if (filteredRows.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (filteredRows.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    return padTop + plotH - (val / maxVal) * plotH;
  };

  const linePath =
    filteredRows.length > 0
      ? series
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(v).toFixed(1)}`)
          .join(' ')
      : '';

  const areaPath =
    filteredRows.length > 1
      ? `${linePath} L${getX(filteredRows.length - 1).toFixed(1)},${(
          padTop + plotH
        ).toFixed(1)} L${getX(0).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`
      : '';

  const hoveredRow = hoverIndex !== null ? filteredRows[hoverIndex] : null;
  const hoveredVal = hoverIndex !== null ? series[hoverIndex] : null;

  const formatMetric = (v: number) => {
    if (metric === 'total') return Math.round(v).toLocaleString('nb-NO');
    if (metric === 'docShare') return `${v.toFixed(2)} %`;
    return v.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="panel-inner">
      <div className="trend-toolbar">
        <fieldset className="radio-fieldset">
          <legend>Måltall i kurven</legend>
          <div className="radio-row">
            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-pm`}
                name={metricGroupName}
                checked={metric === 'perMillion'}
                onChange={() => setMetric('perMillion')}
              />
              <label htmlFor={`${metricGroupName}-pm`}>Per million ord</label>
            </span>
            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-tot`}
                name={metricGroupName}
                checked={metric === 'total'}
                onChange={() => setMetric('total')}
              />
              <label htmlFor={`${metricGroupName}-tot`}>Absolutt antall</label>
            </span>
            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-doc`}
                name={metricGroupName}
                checked={metric === 'docShare'}
                onChange={() => setMetric('docShare')}
              />
              <label htmlFor={`${metricGroupName}-doc`}>Andel bøker (%)</label>
            </span>
          </div>
        </fieldset>

        <div className="trend-controls-right">
          <div className="field-inline">
            <label htmlFor={smoothSelectId}>Glatting</label>
            <select
              id={smoothSelectId}
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
            >
              <option value={1}>Ingen (1 år)</option>
              <option value={3}>3-års snitt</option>
              <option value={5}>5-års snitt</option>
              <option value={11}>11-års snitt</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
          >
            Last ned CSV
          </button>
        </div>
      </div>

      {loading && (
        <div role="status" aria-live="polite" className="loading-card">
          <span className="spinner" aria-hidden="true" />
          <span>Beregner årstrender i arena-indeksen…</span>
        </div>
      )}

      {!loading && filteredRows.length > 0 && (
        <>
          <div className="kpi-strip">
            <div className="kpi-mini">
              <span className="kpi-mini-label">
                Sum treff ({summary.minYear}–{summary.maxYear})
              </span>
              <strong className="kpi-mini-val">
                {summary.totalHits.toLocaleString('nb-NO')}
              </strong>
            </div>
            <div className="kpi-mini">
              <span className="kpi-mini-label">Bøker med treff</span>
              <strong className="kpi-mini-val">
                {summary.totalDocs.toLocaleString('nb-NO')}
              </strong>
            </div>
            <div className="kpi-mini">
              <span className="kpi-mini-label">
                Toppår ({smoothing > 1 ? `${smoothing}-års snitt` : 'enkeltår'})
              </span>
              <strong className="kpi-mini-val">
                {summary.peakYear > 0
                  ? `${summary.peakYear} (${formatMetric(summary.peakVal)})`
                  : '–'}
              </strong>
            </div>
            <div className="kpi-mini">
              <span className="kpi-mini-label">Svartid (year-count)</span>
              <strong className="kpi-mini-val speed-highlight">
                {clientMs !== null ? `${clientMs} ms` : '–'}
                {serverMs ? ` (server ${serverMs} ms)` : ''}
              </strong>
            </div>
          </div>

          <figure className="chart-figure">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="trend-svg"
              role="img"
              aria-label={`Trendkurve for ${queryText}`}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {yTicks.map((t, idx) => {
                const y = getY(t);
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
                      {metric === 'total'
                        ? Math.round(t).toLocaleString('nb-NO')
                        : t.toFixed(t >= 10 ? 1 : 2)}
                    </text>
                  </g>
                );
              })}

              {filteredRows.map((r, idx) => {
                const step = Math.max(1, Math.floor(filteredRows.length / 10));
                if (idx % step !== 0 && idx !== filteredRows.length - 1) return null;
                const x = getX(idx);
                return (
                  <g key={r.year}>
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
                      {r.year}
                    </text>
                  </g>
                );
              })}

              {areaPath && <path d={areaPath} fill="url(#trendAreaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {hoverIndex !== null && hoveredVal !== null && (
                <g>
                  <line
                    x1={getX(hoverIndex)}
                    x2={getX(hoverIndex)}
                    y1={padTop}
                    y2={padTop + plotH}
                    stroke="var(--accent)"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(hoveredVal)}
                    r={5}
                    fill="var(--accent)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                </g>
              )}

              {filteredRows.map((r, idx) => {
                const sliceW = plotW / Math.max(1, filteredRows.length);
                const x = getX(idx) - sliceW / 2;
                return (
                  <rect
                    key={r.year}
                    x={Math.max(padLeft, x)}
                    y={padTop}
                    width={sliceW}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(idx)}
                  />
                );
              })}
            </svg>

            <figcaption className="chart-caption">
              {hoveredRow && hoveredVal !== null ? (
                <div>
                  <strong>År {hoveredRow.year}:</strong>{' '}
                  <span>{formatMetric(hoveredVal)}</span> ·{' '}
                  <span>{hoveredRow.total.toLocaleString('nb-NO')} treff</span> i{' '}
                  <span>
                    {hoveredRow.docs.toLocaleString('nb-NO')} av{' '}
                    {hoveredRow.books.toLocaleString('nb-NO')} bøker
                  </span>{' '}
                  ({(hoveredRow.tokens / 1e6).toFixed(1)} mill. tokens)
                </div>
              ) : (
                <span>
                  Hold pekeren over grafen for detaljer per år. Tellemåte:{' '}
                  <code>{countMode || 'arena'}</code>.
                </span>
              )}
            </figcaption>
          </figure>

          <div
            tabIndex={0}
            role="region"
            aria-labelledby={tableCaptionId}
            className="table-wrapper"
          >
            <table>
              <caption id={tableCaptionId} className="table-caption">
                Årstabell for «{queryText}» ({filteredRows.length} år)
              </caption>
              <thead>
                <tr>
                  <th scope="col">År</th>
                  <th scope="col">Per million ord</th>
                  <th scope="col">Antall treff (total)</th>
                  <th scope="col">Bøker med treff (docs)</th>
                  <th scope="col">Bøker i korpus (books)</th>
                  <th scope="col">Tokens i korpus</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows
                  .slice()
                  .reverse()
                  .map((r) => (
                    <tr key={r.year}>
                      <th scope="row">{r.year}</th>
                      <td>{r.perMillion.toFixed(3)}</td>
                      <td>{r.total.toLocaleString('nb-NO')}</td>
                      <td>{r.docs.toLocaleString('nb-NO')}</td>
                      <td>{r.books.toLocaleString('nb-NO')}</td>
                      <td>{r.tokens.toLocaleString('nb-NO')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && filteredRows.length === 0 && (
        <div className="empty-box">Ingen årsdata funnet for dette søket/korpuset.</div>
      )}
    </div>
  );
};
