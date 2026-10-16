import { SENSOR_META } from '../data/farmDetails.js';

const STATUS_COLOR = { ok: '#2FAB16', warn: '#FF9E11', alert: '#CF0033' };

function Sparkline({ values, color }) {
  const w = 100;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`);
  return (
    <svg className="sensor__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function SensorTile({ id, reading }) {
  const meta = SENSOR_META[id];
  const color = STATUS_COLOR[reading.status];
  return (
    <div className={`sensor is-${reading.status}`}>
      <div className="sensor__label">{meta.label}</div>
      <div className="sensor__value">
        {reading.value}
        <span className="sensor__unit">{meta.unit}</span>
      </div>
      <Sparkline values={reading.history} color={color} />
      <div className="sensor__note" style={{ color: reading.status === 'ok' ? undefined : color }}>
        {reading.note}
      </div>
    </div>
  );
}
