import React, { useId, useMemo, useState } from 'react';
import { YearCountRow } from '../api';
import { downloadExcelFile } from '../excelExport';
import { UiStrings } from '../i18n';

export interface TrendSeriesItem {
  query: string;
  color: string;
  rows: YearCountRow[];
  countMode?: string | null;
  clientMs: number;
  serverMs?: number;
}

interface TrendChartProps {
  t: UiStrings;
  seriesList: TrendSeriesItem[];
  pendingQueries: string[];
  loading: boolean;
}

type MetricType =
  | 'perMillion'
  | 'cohort'
  | 'concentration'
  | 'docShare'
  | 'total';

export const SERIES_COLORS = [
  '#4d2857', // NB Plomme / Aubergine
  '#c0392b', // Varm karminrød
  '#1f6f78', // Dyp petrol
  '#c86d25', // Oker / rav
  '#2e6f40', // Skoggrønn
  '#5b4b8a', // Dyp fiolett
];

export const TrendChart: React.FC<TrendChartProps> = ({
  t,
  seriesList,
  pendingQueries,
  loading,
}) => {
  const tableCaptionId = useId();
  const metricGroupName = useId();
  const smoothSelectId = useId();
  const fromYearInputId = useId();
  const toYearInputId = useId();
  const strokeWidthSliderId = useId();
  const strokeAlphaSliderId = useId();

  const [metric, setMetric] = useState<MetricType>('perMillion');
  const [smoothing, setSmoothing] = useState<number>(5);
  const [yearFromInput, setYearFromInput] = useState<string>('');
  const [yearToInput, setYearToInput] = useState<string>('');
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const [showStyleBox, setShowStyleBox] = useState<boolean>(false);
  const [lineWidth, setLineWidth] = useState<number>(2.4);
  const [lineAlpha, setLineAlpha] = useState<number>(0.92);
  const [fillArea, setFillArea] = useState<boolean>(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dataBounds = useMemo(() => {
    if (seriesList.length === 0) return { min: 1473, max: 2026 };
    const baseRows = seriesList[0].rows;
    const firstWithBooks = baseRows.findIndex((r) => r.books > 0);
    if (firstWithBooks === -1) return { min: 1473, max: 2026 };
    let lastWithBooks = baseRows.length - 1;
    while (lastWithBooks > firstWithBooks && baseRows[lastWithBooks].books === 0) {
      lastWithBooks--;
    }
    return {
      min: baseRows[firstWithBooks].year,
      max: baseRows[lastWithBooks].year,
    };
  }, [seriesList]);

  const years = useMemo(() => {
    if (seriesList.length === 0) return [];
    const baseRows = seriesList[0].rows;
    const firstWithBooks = baseRows.findIndex((r) => r.books > 0);
    if (firstWithBooks === -1) return [];
    let lastWithBooks = baseRows.length - 1;
    while (lastWithBooks > firstWithBooks && baseRows[lastWithBooks].books === 0) {
      lastWithBooks--;
    }
    const parsedFrom = parseInt(yearFromInput.trim(), 10);
    const parsedTo = parseInt(yearToInput.trim(), 10);
    const loYear =
      !Number.isNaN(parsedFrom) && parsedFrom >= 1000
        ? parsedFrom
        : baseRows[firstWithBooks].year;
    const hiYear =
      !Number.isNaN(parsedTo) && parsedTo >= 1000
        ? parsedTo
        : baseRows[lastWithBooks].year;

    return baseRows
      .slice(firstWithBooks, lastWithBooks + 1)
      .map((r) => r.year)
      .filter((y) => y >= loYear && y <= hiYear);
  }, [seriesList, yearFromInput, yearToInput]);

  const computedSeries = useMemo(() => {
    const base = seriesList.map((item) => {
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

      const half = smoothing <= 1 ? 0 : Math.floor(smoothing / 2);

      // Glattede basisverdier (brukes også for Kohort og Dispersjon over vinduet)
      const smoothedPerMillion = alignedRows.map((_, idx) => {
        const lo = Math.max(0, idx - half);
        const hi = Math.min(alignedRows.length - 1, idx + half);
        let sum = 0;
        for (let i = lo; i <= hi; i++) sum += alignedRows[i].perMillion;
        return sum / (hi - lo + 1);
      });

      const values = alignedRows.map((_, idx) => {
        const lo = Math.max(0, idx - half);
        const hi = Math.min(alignedRows.length - 1, idx + half);
        const count = hi - lo + 1;

        if (metric === 'perMillion' || metric === 'cohort') {
          return smoothedPerMillion[idx];
        }
        if (metric === 'total') {
          let sum = 0;
          for (let i = lo; i <= hi; i++) sum += alignedRows[i].total;
          return sum / count;
        }
        if (metric === 'docShare') {
          let sum = 0;
          for (let i = lo; i <= hi; i++) {
            const r = alignedRows[i];
            sum += r.books > 0 ? (r.docs / r.books) * 100 : 0;
          }
          return sum / count;
        }
        // concentration: total / docs (gjennomsnittlig antall treff per bok med treff)
        let sumDocs = 0;
        let sumTotal = 0;
        for (let i = lo; i <= hi; i++) {
          sumDocs += alignedRows[i].docs;
          sumTotal += alignedRows[i].total;
        }
        return sumDocs > 0 ? sumTotal / sumDocs : 0;
      });

      const totalHits = alignedRows.reduce((acc, r) => acc + r.total, 0);
      const totalDocs = alignedRows.reduce((acc, r) => acc + r.docs, 0);
      const overallConcentration = totalDocs > 0 ? totalHits / totalDocs : 0;

      return {
        ...item,
        alignedRows,
        values,
        totalHits,
        totalDocs,
        overallConcentration,
      };
    });

    // Hvis Kohort er valgt, normaliser hvert år slik at kurvene summerer til 100 %
    if (metric === 'cohort' && base.length > 0) {
      return base.map((s) => ({
        ...s,
        values: s.values.map((v, idx) => {
          const yearSum = base.reduce((acc, other) => acc + other.values[idx], 0);
          return yearSum > 0 ? (v / yearSum) * 100 : 0;
        }),
      }));
    }

    return base;
  }, [seriesList, years, metric, smoothing]);

  const buildExportMatrix = (): (string | number)[][] => {
    const header: (string | number)[] = ['year', 'books', 'tokens'];
    computedSeries.forEach((s) => {
      header.push(
        `${s.query}_total`,
        `${s.query}_docs`,
        `${s.query}_perMillion`,
        `${s.query}_docShare_pct`,
        `${s.query}_hits_per_doc`
      );
      if (computedSeries.length > 1) {
        header.push(`${s.query}_cohort_pct`);
      }
    });
    const matrix: (string | number)[][] = [header];
    years.forEach((y, idx) => {
      const baseRow = computedSeries[0].alignedRows[idx];
      const rowCells: (string | number)[] = [y, baseRow.books, baseRow.tokens];
      const yearTotalHits = computedSeries.reduce(
        (acc, s) => acc + s.alignedRows[idx].total,
        0
      );
      computedSeries.forEach((s) => {
        const r = s.alignedRows[idx];
        const docShare =
          r.books > 0 ? Number(((r.docs / r.books) * 100).toFixed(2)) : 0;
        const conc = r.docs > 0 ? Number((r.total / r.docs).toFixed(2)) : 0;
        rowCells.push(r.total, r.docs, r.perMillion, docShare, conc);
        if (computedSeries.length > 1) {
          const cohortPct =
            yearTotalHits > 0
              ? Number(((r.total / yearTotalHits) * 100).toFixed(2))
              : 0;
          rowCells.push(cohortPct);
        }
      });
      matrix.push(rowCells);
    });
    return matrix;
  };

  const exportExcel = () => {
    if (computedSeries.length === 0 || years.length === 0) return;
    const matrix = buildExportMatrix();
    const safeName = computedSeries
      .map((s) => s.query.replace(/\s+/g, '_'))
      .join('_');
    downloadExcelFile(`trender_${safeName}.xlsx`, matrix);
  };

  const exportPng = () => {
    if (computedSeries.length === 0 || years.length === 0) return;

    const scale = 2; // 2x Retina-oppløsning (1840px bred)
    const legendHeight = 36 + Math.ceil(computedSeries.length / 2) * 24;
    const totalH = height + legendHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Hent aktive temafarger fra rot-elementet
    const rootStyle = getComputedStyle(document.documentElement);
    const bgSurface = rootStyle.getPropertyValue('--surface').trim() || '#ffffff';
    const textMain = rootStyle.getPropertyValue('--text').trim() || '#1e1c1a';
    const textMuted = rootStyle.getPropertyValue('--text-muted').trim() || '#615b53';
    const borderSubtle =
      rootStyle.getPropertyValue('--border-subtle').trim() || '#e4ded5';

    // Bakgrunn
    ctx.fillStyle = bgSurface;
    ctx.fillRect(0, 0, width, totalH);

    // Topptekst / Legend i PNG
    ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
    let lx = padLeft;
    let ly = 22;
    for (const s of computedSeries) {
      const label = `${s.query} (${s.totalHits.toLocaleString('nb-NO')} treff · ${s.totalDocs.toLocaleString('nb-NO')} bøker)`;
      const textW = ctx.measureText(label).width + 28;
      if (lx + textW > width - padRight && lx > padLeft) {
        lx = padLeft;
        ly += 22;
      }
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(lx + 5, ly - 4, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = textMain;
      ctx.fillText(label, lx + 15, ly);
      lx += textW;
    }

    ctx.save();
    ctx.translate(0, legendHeight);

    // Horisontale rutenettlinjer og Y-etiketter
    ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    yTicks.forEach((tVal, idx) => {
      const y = getY(tVal);
      ctx.strokeStyle = borderSubtle;
      ctx.lineWidth = 1;
      if (idx > 0) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = textMuted;
      const yLabel =
        metric === 'total'
          ? Math.round(tVal).toLocaleString('nb-NO')
          : metric === 'cohort' || metric === 'docShare'
          ? `${tVal.toFixed(0)} %`
          : tVal.toFixed(tVal >= 10 ? 1 : 2);
      ctx.fillText(yLabel, padLeft - 8, y + 4);
    });
    ctx.setLineDash([]);

    // X-aksetikker
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(years.length / 10));
    years.forEach((yr, idx) => {
      const isLast = idx === years.length - 1;
      const isStep = idx % step === 0;
      if (!isStep && !isLast) return;
      if (isStep && !isLast && years.length - 1 - idx < Math.floor(step * 0.6)) {
        return;
      }
      const x = getX(idx);
      ctx.strokeStyle = textMuted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padTop + plotH);
      ctx.lineTo(x, padTop + plotH + 6);
      ctx.stroke();

      ctx.fillStyle = textMuted;
      ctx.fillText(String(yr), x, height - 10);
    });

    // Kurver (og evt. flatefyll)
    for (const s of computedSeries) {
      if (s.values.length === 0) continue;
      if (fillArea) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.4, lineAlpha * 0.22);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(getX(0), padTop + plotH);
        s.values.forEach((v, i) => {
          ctx.lineTo(getX(i), getY(v));
        });
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
      const safeName = computedSeries
        .map((s) => s.query.replace(/[^\wæøåÆØÅ-]+/g, '_'))
        .join('_')
        .slice(0, 60);
      a.href = url;
      a.download = `trend_${safeName || 'dhlab'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
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
    if (metric === 'cohort') return 100;
    let m = 0.0001;
    for (const s of computedSeries) {
      for (const v of s.values) {
        if (v > m) m = v;
      }
    }
    return m;
  }, [computedSeries, metric]);

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
    if (metric === 'docShare' || metric === 'cohort') return `${v.toFixed(1)} %`;
    if (metric === 'concentration') return `${v.toFixed(2)} treff/bok`;
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
          <legend className="visually-hidden">Metric</legend>
          <div className="radio-row">
            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-pm`}
                name={metricGroupName}
                checked={metric === 'perMillion'}
                onChange={() => setMetric('perMillion')}
              />
              <label htmlFor={`${metricGroupName}-pm`}>{t.metricPpm}</label>
            </span>

            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-cohort`}
                name={metricGroupName}
                checked={metric === 'cohort'}
                onChange={() => setMetric('cohort')}
              />
              <label htmlFor={`${metricGroupName}-cohort`}>{t.metricCohort}</label>
            </span>

            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-doc`}
                name={metricGroupName}
                checked={metric === 'docShare'}
                onChange={() => setMetric('docShare')}
              />
              <label htmlFor={`${metricGroupName}-doc`}>
                {t.metricCoverage}
              </label>
            </span>

            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-conc`}
                name={metricGroupName}
                checked={metric === 'concentration'}
                onChange={() => setMetric('concentration')}
              />
              <label htmlFor={`${metricGroupName}-conc`}>
                {t.metricIntensity}
              </label>
            </span>

            <span className="radio-item">
              <input
                type="radio"
                id={`${metricGroupName}-tot`}
                name={metricGroupName}
                checked={metric === 'total'}
                onChange={() => setMetric('total')}
              />
              <label htmlFor={`${metricGroupName}-tot`}>{t.metricTotal}</label>
            </span>
          </div>
        </fieldset>

        <div className="trend-controls-right">
          <div className="field-inline">
            <label htmlFor={fromYearInputId}>{t.yearLabel}:</label>
            <input
              id={fromYearInputId}
              type="text"
              inputMode="numeric"
              className="year-input"
              placeholder={String(dataBounds.min)}
              value={yearFromInput}
              onChange={(e) => setYearFromInput(e.target.value)}
              aria-label={t.fromYear}
              style={{ inlineSize: '4.3rem' }}
            />
            <span>–</span>
            <input
              id={toYearInputId}
              type="text"
              inputMode="numeric"
              className="year-input"
              placeholder={String(dataBounds.max)}
              value={yearToInput}
              onChange={(e) => setYearToInput(e.target.value)}
              aria-label={t.toYear}
              style={{ inlineSize: '4.3rem' }}
            />
          </div>

          <div className="field-inline">
            <label htmlFor={smoothSelectId}>{t.smoothingLabel}</label>
            <select
              id={smoothSelectId}
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
            >
              <option value={1}>{t.smooth1}</option>
              <option value={3}>{t.smooth3}</option>
              <option value={5}>{t.smooth5}</option>
              <option value={11}>{t.smooth11}</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            aria-expanded={showStyleBox}
            onClick={() => setShowStyleBox((v) => !v)}
            disabled={computedSeries.length === 0}
            title="Juster linjetykkelse, gjennomsiktighet (alpha) og fyll"
          >
            Kurvestil ▾
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowNumbers((v) => !v)}
            disabled={computedSeries.length === 0}
          >
            {showNumbers ? t.hideNumbers : t.showNumbers}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={exportPng}
            disabled={computedSeries.length === 0 || years.length === 0}
            title="Last ned høyoppløselig PNG av grafen"
          >
            PNG
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={exportExcel}
            disabled={computedSeries.length === 0 || years.length === 0}
          >
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {showStyleBox && computedSeries.length > 0 && (
        <div className="curve-style-toolbox" role="region" aria-label="Kurvestil">
          <div className="slider-wrap">
            <label htmlFor={strokeWidthSliderId}>
              Tykkelse: <strong>{lineWidth.toFixed(1)} px</strong>
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
              Alpha (dekkevne): <strong>{Math.round(lineAlpha * 100)} %</strong>
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
            <label htmlFor={`${strokeAlphaSliderId}-fill`}>Fyll under kurve</label>
          </div>

          <button
            type="button"
            className="btn-tiny"
            onClick={() => {
              setLineWidth(2.4);
              setLineAlpha(0.92);
              setFillArea(false);
            }}
          >
            Nullstill
          </button>
        </div>
      )}

      {computedSeries.length === 0 && pendingQueries.length > 0 && (
        <div className="series-legend-row" role="status" aria-live="polite">
          {pendingQueries.map((pq) => (
            <div key={pq} className="series-legend-card series-pending">
              <span className="spinner-mini" aria-hidden="true" />
              <span>
                Beregner <code>{pq}</code>…
              </span>
            </div>
          ))}
        </div>
      )}

      {computedSeries.length > 0 && years.length > 0 && (
        <>
          <figure className="chart-figure">
            <div className="chart-compact-key" aria-hidden="true">
              {computedSeries.map((s) => (
                <span key={s.query} className="chart-compact-key-item">
                  <span
                    className="series-swatch"
                    style={{ background: s.color }}
                  />
                  <code>{s.query}</code>
                </span>
              ))}
              {pendingQueries.map((pq) => (
                <span key={pq} className="chart-compact-key-item series-pending">
                  <span className="spinner-mini" />
                  <code>{pq}</code>…
                </span>
              ))}
            </div>

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
                        : metric === 'cohort' || metric === 'docShare'
                        ? `${t.toFixed(0)} %`
                        : t.toFixed(t >= 10 ? 1 : 2)}
                    </text>
                  </g>
                );
              })}

              {years.map((y, idx) => {
                const step = Math.max(1, Math.floor(years.length / 10));
                const isLast = idx === years.length - 1;
                const isStep = idx % step === 0;
                // Unngå at nest siste tikk og siste tikk (f.eks. 2020 og 2025) overlapper
                if (!isStep && !isLast) return null;
                if (isStep && !isLast && years.length - 1 - idx < Math.floor(step * 0.6)) {
                  return null;
                }
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

              {computedSeries.map((s) => {
                if (s.values.length === 0) return null;
                const linePath = s.values
                  .map(
                    (v, i) =>
                      `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(v).toFixed(1)}`
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
                  <g key={s.query}>
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
                  <strong>
                    {t.yearLabel} {hoveredYear}:
                  </strong>
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
                        ({r.total.toLocaleString('nb-NO')} · {r.docs} {t.booksUnit})
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span>
                  {metric === 'concentration'
                    ? t.hoverHintIntensity
                    : metric === 'docShare'
                    ? t.hoverHintCoverage
                    : metric === 'cohort'
                    ? t.hoverHintCohort
                    : t.hoverHintPpm}
                </span>
              )}
            </figcaption>
          </figure>

          {/* Detaljer for hvert søkeuttrykk UNDER trendlinjen */}
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
                  {s.totalHits.toLocaleString('nb-NO')} treff ·{' '}
                  {s.totalDocs.toLocaleString('nb-NO')} bøker (
                  {s.overallConcentration.toFixed(1)} treff/bok)
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

          {showNumbers && (
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
                        <code>{s.query}</code> (verdi / treff / bøker)
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
                            const v = s.values[idx] ?? 0;
                            return (
                              <td key={s.query}>
                                <strong>{formatMetric(v)}</strong>{' '}
                                <span className="muted">
                                  ({r.total.toLocaleString('nb-NO')} i {r.docs})
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
          )}
        </>
      )}

      {!loading && computedSeries.length === 0 && (
        <div className="empty-box">Ingen årsdata funnet for dette søket/korpuset.</div>
      )}
    </div>
  );
};
