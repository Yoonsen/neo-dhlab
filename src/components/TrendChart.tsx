import React, { useId, useMemo, useState } from 'react';
import { YearCountRow } from '../api';

export interface TrendSeriesItem {
  query: string;
  color: string;
  rows: YearCountRow[];
  countMode?: string | null;
  clientMs: number;
  serverMs?: number;
}

interface TrendChartProps {
  seriesList: TrendSeriesItem[];
  pendingQueries: string[];
  loading: boolean;
}

type MetricType = 'perMillion' | 'total' | 'docShare';

export const SERIES_COLORS = [
  '#0b57d0',
  '#d93025',
  '#188038',
  '#e37400',
  '#9334e6',
  '#007b83',
];

export const TrendChart: React.FC<TrendChartProps> = ({
  seriesList,
  pendingQueries,
  loading,
}) => {
  const tableCaptionId = useId();
  const metricGroupName = useId();
  const smoothSelectId = useId();

  const [metric, setMetric] = useState<MetricType>('perMillion');
  const [smoothing, setSmoothing] = useState<number>(5);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Finn felles årsakse på tvers av alle beregnede serier (trim tomme start/sluttår der books === 0)
  const years = useMemo(() => {
    if (seriesList.length === 0) return [];
    const baseRows = seriesList[0].rows;
    const firstWithBooks = baseRows.findIndex((r) => r.books > 0);
    if (firstWithBooks === -1) return [];
    let lastWithBooks = baseRows.length - 1;
    while (lastWithBooks > firstWithBooks && baseRows[lastWithBooks].books === 0) {
      lastWithBooks--;
    }
    return baseRows.slice(firstWithBooks, lastWithBooks + 1).map((r) => r.year);
  }, [seriesList]);

  // Beregn glattet tallserie for hver kurve langs den felles årsaksen
  const computedSeries = useMemo(() => {
    return seriesList.map((item) => {
      const byYear = new Map<number, YearCountRow>();
      item.rows.forEach((r) => byYear.set(r.year, r));

      const alignedRows = years.map(
        (y) =>
          byYear.get(y) ?? {
            year: y,
            total: 0,
            docs: 0,
            books: 0,
            tokens: 0,
            perMillion: 0,
          }
      );

      const rawValues = alignedRows.map((r) => {
        if (metric === 'perMillion') return r.perMillion;
        if (metric === 'total') return r.total;
        return r.books > 0 ? (r.docs / r.books) * 100 : 0;
      });

      const smoothed =
        smoothing <= 1
          ? rawValues
          : rawValues.map((_, idx) => {
              const half = Math.floor(smoothing / 2);
              const lo = Math.max(0, idx - half);
              const hi = Math.min(rawValues.length - 1, idx + half);
              let sum = 0;
              for (let i = lo; i <= hi; i++) sum += rawValues[i];
              return sum / (hi - lo + 1);
            });

      const totalHits = alignedRows.reduce((acc, r) => acc + r.total, 0);
      const totalDocs = alignedRows.reduce((acc, r) => acc + r.docs, 0);

      return {
        ...item,
        alignedRows,
        values: smoothed,
        totalHits,
        totalDocs,
      };
    });
  }, [seriesList, years, metric, smoothing]);

  const exportCsv = () => {
    if (computedSeries.length === 0 || years.length === 0) return;
    const cols = ['year', 'books', 'tokens'];
    computedSeries.forEach((s) => {
      const safe = s.query.replace(/[,"]/g, '');
      cols.push(`${safe}_total`, `${safe}_docs`, `${safe}_perMillion`);
    });
    const lines = [cols.join(',')];
    years.forEach((y, idx) => {
      const baseRow = computedSeries[0].alignedRows[idx];
      const rowCells: (string | number)[] = [y, baseRow.books, baseRow.tokens];
      computedSeries.forEach((s) => {
        const r = s.alignedRows[idx];
        rowCells.push(r.total, r.docs, r.perMillion);
      });
      lines.push(rowCells.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trender_${computedSeries.map((s) => s.query).join('_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG dimensions
  const width = 920;
  const height = 340;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = useMemo(() => {
    let m = 0.0001;
    for (const s of computedSeries) {
      for (const v of s.values) {
        if (v > m) m = v;
      }
    }
    return m;
  }, [computedSeries]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t);

  const getX = (idx: number) => {
    if (years.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (years.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    return padTop + plotH - (val / maxVal) * plotH;
  };

  const formatMetric = (v: number) => {
    if (metric === 'total') return Math.round(v).toLocaleString('nb-NO');
    if (metric === 'docShare') return `${v.toFixed(2)} %`;
    return v.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const hoveredYear = hoverIndex !== null ? years[hoverIndex] : null;

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
            disabled={computedSeries.length === 0 || years.length === 0}
          >
            Last ned CSV
          </button>
        </div>
      </div>

      {/* Legend cards showing finished series + any pending series in queue */}
      <div className="series-legend-row" role="status" aria-live="polite">
        {computedSeries.map((s) => (
          <div key={s.query} className="series-legend-card">
            <span
              className="series-swatch"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <strong>
              <code>{s.query}</code>
            </strong>
            <span className="muted">
              {s.totalHits.toLocaleString('nb-NO')} treff i{' '}
              {s.totalDocs.toLocaleString('nb-NO')} bøker
            </span>
            <span className="speed-pill">{s.clientMs} ms</span>
          </div>
        ))}

        {pendingQueries.map((pq) => (
          <div key={pq} className="series-legend-card series-pending">
            <span className="spinner-mini" aria-hidden="true" />
            <span>
              Beregner <code>{pq}</code>…
            </span>
          </div>
        ))}
      </div>

      {computedSeries.length > 0 && years.length > 0 && (
        <>
          <figure className="chart-figure">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="trend-svg"
              role="img"
              aria-label={`Trendkurver for ${computedSeries
                .map((s) => s.query)
                .join(', ')}`}
              onMouseLeave={() => setHoverIndex(null)}
            >
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

              {years.map((y, idx) => {
                const step = Math.max(1, Math.floor(years.length / 10));
                if (idx % step !== 0 && idx !== years.length - 1) return null;
                const x = getX(idx);
                return (
                  <g key={y}>
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
                      {y}
                    </text>
                  </g>
                );
              })}

              {/* Render each series line */}
              {computedSeries.map((s) => {
                const linePath = s.values
                  .map(
                    (v, i) =>
                      `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(v).toFixed(1)}`
                  )
                  .join(' ');
                return (
                  <path
                    key={s.query}
                    d={linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Hover crosshair & dots for all series */}
              {hoverIndex !== null && (
                <g>
                  <line
                    x1={getX(hoverIndex)}
                    x2={getX(hoverIndex)}
                    y1={padTop}
                    y2={padTop + plotH}
                    stroke="var(--text-muted)"
                    strokeDasharray="3 3"
                  />
                  {computedSeries.map((s) => {
                    const val = s.values[hoverIndex] ?? 0;
                    return (
                      <circle
                        key={s.query}
                        cx={getX(hoverIndex)}
                        cy={getY(val)}
                        r={4.5}
                        fill={s.color}
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    );
                  })}
                </g>
              )}

              {/* Invisible interactive slices */}
              {years.map((y, idx) => {
                const sliceW = plotW / Math.max(1, years.length);
                const x = getX(idx) - sliceW / 2;
                return (
                  <rect
                    key={y}
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
              {hoverIndex !== null && hoveredYear !== null ? (
                <div className="hover-multi-readout">
                  <strong>År {hoveredYear}:</strong>
                  {computedSeries.map((s) => {
                    const r = s.alignedRows[hoverIndex];
                    const v = s.values[hoverIndex] ?? 0;
                    return (
                      <span key={s.query} className="hover-series-chip">
                        <span
                          className="series-swatch"
                          style={{ background: s.color }}
                        />
                        <code>{s.query}</code>: <strong>{formatMetric(v)}</strong>{' '}
                        ({r.total.toLocaleString('nb-NO')} treff i {r.docs} bøker)
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span>
                  Hold pekeren over grafen for å sammenligne verdier per år. Skriv komma mellom søkeuttrykk for å legge til flere linjer.
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
                Årstabell ({years[0]}–{years[years.length - 1]})
              </caption>
              <thead>
                <tr>
                  <th scope="col">År</th>
                  <th scope="col">Bøker i korpus</th>
                  {computedSeries.map((s) => (
                    <th key={s.query} scope="col">
                      <code>{s.query}</code> (per mill. / treff)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years
                  .slice()
                  .reverse()
                  .map((y) => {
                    const idx = years.indexOf(y);
                    const baseRow = computedSeries[0].alignedRows[idx];
                    return (
                      <tr key={y}>
                        <th scope="row">{y}</th>
                        <td>{baseRow.books.toLocaleString('nb-NO')}</td>
                        {computedSeries.map((s) => {
                          const r = s.alignedRows[idx];
                          return (
                            <td key={s.query}>
                              <strong>{r.perMillion.toFixed(2)}</strong>{' '}
                              <span className="muted">
                                ({r.total.toLocaleString('nb-NO')})
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && computedSeries.length === 0 && (
        <div className="empty-box">Ingen årsdata funnet for dette søket/korpuset.</div>
      )}
    </div>
  );
};
