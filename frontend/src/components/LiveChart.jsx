import { STATUS_COLOR } from '../data/sensorMetrics.js';

const W = 600;
const H = 140;
const hhmmss = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// One live metric: latest value (WHH figure style), what it means, and the time series
// with its blight threshold. Lines scale with the panel; labels stay HTML so they don't stretch.
export default function LiveChart({ metric, readings }) {
  const values = readings.map((r) => r[metric.key]).filter((v) => v != null);
  const latest = values[values.length - 1];
  const status = latest == null ? 'ok' : metric.status(latest);
  const color = STATUS_COLOR[status];

  // zoom to the data and its reference lines, padded, but never beyond the physical range
  const refs = [...(metric.lines ?? []).map((l) => l.at), ...(metric.band ? [metric.band.from, metric.band.to] : [])];
  const span = [...values, ...refs];
  const lo = metric.binary ? 0 : Math.max(metric.domain[0], Math.min(...span) - metric.pad);
  const hi = metric.binary ? 1 : Math.min(metric.domain[1], Math.max(...span) + metric.pad);
  const y = (v) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const x = (i) => (values.length > 1 ? (i / (values.length - 1)) * W : W);

  let line = '';
  values.forEach((v, i) => {
    if (metric.binary && i > 0) line += ` ${x(i)},${y(values[i - 1])}`; // step chart for wet/dry
    line += ` ${x(i)},${y(v)}`;
  });
  const pct = (v) => `${(y(v) / H) * 100}%`;

  const wetShare = metric.binary && values.length ? Math.round((values.filter(Boolean).length / values.length) * 100) : null;

  return (
    <div className={`live-chart is-${status}`}>
      <div className="live-chart__head">
        <span className="live-chart__label">
          <i className="sensor__dot" style={{ background: color }} />
          {metric.label}
        </span>
        <span className="live-chart__value" style={{ color }}>
          {latest == null ? '–' : metric.binary ? (latest ? 'Wet' : 'Dry') : latest.toFixed(metric.decimals)}
          {!metric.binary && <span className="live-chart__unit">{metric.unit}</span>}
        </span>
        <span className="live-chart__note" style={{ color: status === 'ok' ? undefined : color }}>
          {latest == null ? 'No data' : metric.note(latest)}
          {wetShare != null && ` · wet ${wetShare} % of the window`}
        </span>
      </div>

      <div className="live-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {metric.band && (
            <rect x="0" width={W} y={y(metric.band.to)} height={y(metric.band.from) - y(metric.band.to)} fill="#E08400" opacity="0.08" />
          )}
          {(metric.lines ?? []).map((l) => (
            <line key={l.at} x1="0" x2={W} y1={y(l.at)} y2={y(l.at)} stroke="#CF0033" strokeDasharray="5 5" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.6" />
          ))}
          {line && (
            <>
              <polygon points={`0,${H}${line} ${W},${H}`} fill={color} opacity="0.04" />
              <polyline points={line.trim()} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {/* labels + the newest point, positioned in % so they don't stretch with the svg */}
        {(metric.lines ?? []).map((l) => (
          <span key={l.at} className="live-chart__mark" style={{ top: pct(l.at) }}>
            {l.label}
          </span>
        ))}
        {metric.band && (
          <span className="live-chart__mark is-band" style={{ top: pct(metric.band.to) }}>
            {metric.band.label}
          </span>
        )}
        {latest != null && <span className="live-chart__now" style={{ top: pct(latest), background: color }} />}
        {metric.binary && (
          <>
            <span className="live-chart__axis-y" style={{ top: pct(1) }}>wet</span>
            <span className="live-chart__axis-y" style={{ top: pct(0) }}>dry</span>
          </>
        )}
      </div>

      <div className="live-chart__time">
        <span>{readings[0] ? hhmmss(readings[0].deviceTimestamp) : ''}</span>
        <span>{readings.length ? `${readings.length} readings` : ''}</span>
        <span>{readings.length ? hhmmss(readings[readings.length - 1].deviceTimestamp) : ''}</span>
      </div>
    </div>
  );
}
