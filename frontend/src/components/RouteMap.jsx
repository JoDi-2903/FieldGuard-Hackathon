import { FARMS, FIELD_OFFICE } from '../data/farms.js';
import { VISIT_TYPES } from '../data/visitTypes.js';

// Schematic (not geographic) map of the district. Farm positions are stored on
// a 700 × 300 grid and stretched to 1000 × 600 so the map can fill a large panel.
const SX = 1000 / 700;
const SY = 2;
const at = (p) => ({ x: p.x * SX, y: p.y * SY });

export default function RouteMap({ visits, selectedId, onSelect, onOpen }) {
  const visitIds = new Set(visits.map((v) => v.farmId));
  const office = at(FIELD_OFFICE.pos);
  const route = [office, ...visits.map((v) => at(v.farm.pos)), office];

  return (
    <svg className="map" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route map of today's farm visits">
      <defs>
        <filter id="marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>
      <rect width="1000" height="600" fill="#F4F4F5" />

      {/* landscape, drawn on the 700 × 300 grid and stretched */}
      <g transform={`scale(${SX} ${SY})`}>
        <g fill="#E4E4E6">
          <path d="M0 0h150l-30 70H0z" />
          <path d="M200 0h120l20 40-90 30-50-20z" />
          <path d="M420 0h170l-30 30H440z" />
          <path d="M620 80l80-30v90l-60 10z" />
          <path d="M60 280l60-60 80 20-10 60H60z" />
          <path d="M250 150l80-20 40 50-60 40-60-20z" />
          <path d="M580 270l40-60 80 10v80H600z" />
          <path d="M380 240l60-10 30 70h-90z" />
          <path d="M150 140l50-30 40 40-40 30z" />
          <path d="M470 110l40-10 20 40-50 10z" />
        </g>
        <path
          d="M0 140c80-10 120 30 200 0s140-120 230-100 150 70 270 40"
          fill="none"
          stroke="#D3E2F2"
          strokeWidth="14"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <path d="M50 250C150 240 260 230 440 216s200-10 260 30" vectorEffect="non-scaling-stroke" />
          <path d="M120 192c30-40 40-70 58-80s60-50 84-48 60 40 76 64 50-60 72-70 70 30 90 38 70-40 90-44" vectorEffect="non-scaling-stroke" />
          <path d="M590 52c30 40 50 70 58 98s-60 60-82 80" vectorEffect="non-scaling-stroke" />
        </g>
      </g>

      {/* other assigned farms (not visited today) */}
      {FARMS.filter((f) => !visitIds.has(f.id)).map((f) => {
        const p = at(f.pos);
        return (
          <circle key={f.id} cx={p.x} cy={p.y} r="7" fill="#BDBDC0" stroke="#fff" strokeWidth="2">
            <title>{`${f.name} · not on today's route`}</title>
          </circle>
        );
      })}

      {/* route: out solid, back to the office dashed */}
      <polyline
        points={route.slice(0, -1).map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#2FAB16"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line
        x1={route[route.length - 2].x}
        y1={route[route.length - 2].y}
        x2={office.x}
        y2={office.y}
        stroke="#868689"
        strokeWidth="3"
        strokeDasharray="8 8"
        opacity="0.7"
      />

      {/* field office */}
      <g transform={`translate(${office.x} ${office.y})`}>
        <rect x="-16" y="-16" width="32" height="32" fill="#404048" />
        <path d="M-9 5v-8l9-7 9 7v8z" fill="#fff" />
        <text x="26" y="6" className="map__label">
          Field office · start / end
        </text>
      </g>

      {/* visit markers, each with its farm name */}
      {visits.map((v) => {
        const t = VISIT_TYPES[v.type];
        const p = at(v.farm.pos);
        const isSel = v.farmId === selectedId;
        const w = v.farm.name.length * 9 + 20;
        return (
          <g
            key={v.farmId}
            className={`map__marker${isSel ? ' is-selected' : ''}`}
            transform={`translate(${p.x} ${p.y})`}
            onMouseEnter={() => onSelect(v.farmId)}
            onClick={() => onOpen(v.farmId)}
          >
            <title>{`${v.order}. ${v.farm.name} · ${t.label} · open farm profile`}</title>
            {/* label sits to the right so neighbouring markers stay visible */}
            <rect className="map__tag-bg" x="28" y="-13" width={w} height="26" />
            <text className="map__tag" x={28 + w / 2} y="5" textAnchor="middle">
              {v.farm.name}
            </text>
            <circle r={isSel ? 23 : 19} fill={t.color} stroke="#fff" strokeWidth="4" filter="url(#marker-shadow)" />
            <text y="7" textAnchor="middle" className="map__num">
              {v.order}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
