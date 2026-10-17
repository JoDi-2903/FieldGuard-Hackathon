import { SENSOR_META } from '../data/farmDetails.js';

const STATUS_COLOR = { ok: '#2FAB16', warn: '#E08400', alert: '#CF0033' };

// 7-day time series: line, light area underneath, and a dot on today's value.
function Trend({ values, color }) {
  const w = 120;
  const h = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => (i / (values.length - 1)) * w;
  const y = (v) => h - 5 - ((v - min) / span) * (h - 12);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg className="sensor__trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={color} opacity="0.05" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last])} r="3" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// One KPI tile: what is measured, today's value (WHH figure style), what it means, 7-day trend.
export default function SensorTile({ id, reading }) {
  const meta = SENSOR_META[id];
  const color = STATUS_COLOR[reading.status];
  return (
    <div className={`sensor is-${reading.status}`}>
      <span className="sensor__label">
        <i className="sensor__dot" style={{ background: color }} />
        {meta.label}
      </span>
      <span className="sensor__value" style={{ color }}>
        {reading.value}
        <span className="sensor__unit">{meta.unit}</span>
      </span>
      <span className="sensor__note" style={{ color: reading.status === 'ok' ? undefined : color }}>
        {reading.note}
      </span>
      <Trend values={reading.history} color={color} />
      <span className="sensor__axis">
        <span>7 days ago</span>
        <span>today</span>
      </span>
    </div>
  );
}
