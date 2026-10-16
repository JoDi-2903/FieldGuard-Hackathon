import { FARMS, FIELD_OFFICE } from '../data/farms.js';
import { VISIT_TYPES } from '../data/visitTypes.js';

// Schematic (not geographic) map of the district. Farm positions are stored on
// a 700 × 300 grid; the map is stretched horizontally to suit wide screens.
const SX = 1000 / 700;
const at = (p) => ({ x: p.x * SX, y: p.y });

export default function RouteMap({ visits, selectedId, onSelect }) {
  const visitIds = new Set(visits.map((v) => v.farmId));
  const office = at(FIELD_OFFICE.pos);
  const route = [office, ...visits.map((v) => at(v.farm.pos)), office];
  const selected = visits.find((v) => v.farmId === selectedId);

  return (
    <svg className="map" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route map of today's farm visits">
      <rect width="1000" height="300" fill="#F7EDD2" />

      {/* landscape, drawn on the 700-wide grid and stretched */}
      <g transform={`scale(${SX} 1)`}>
        <g fill="#D6E4C8">
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
        <path d="M0 140c80-10 120 30 200 0s140-120 230-100 150 70 270 40" fill="none" stroke="#B9D3EF" strokeWidth="9" strokeLinecap="round" />
        <g fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round">
          <path d="M50 250C150 240 260 230 440 216s200-10 260 30" />
          <path d="M120 192c30-40 40-70 58-80s60-50 84-48 60 40 76 64 50-60 72-70 70 30 90 38 70-40 90-44" />
          <path d="M590 52c30 40 50 70 58 98s-60 60-82 80" />
        </g>
      </g>

      {/* other assigned farms (not visited today) */}
      {FARMS.filter((f) => !visitIds.has(f.id)).map((f) => {
        const p = at(f.pos);
        return (
          <circle key={f.id} cx={p.x} cy={p.y} r="6" fill="#AAAAAC" stroke="#fff" strokeWidth="1.5">
            <title>{`${f.name} — not on today's route`}</title>
          </circle>
        );
      })}

      {/* route: out solid, back to the office dashed */}
      <polyline points={route.slice(0, -1).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#404048" strokeWidth="3.5" strokeLinejoin="round" />
      <line
        x1={route[route.length - 2].x}
        y1={route[route.length - 2].y}
        x2={office.x}
        y2={office.y}
        stroke="#404048"
        strokeWidth="2.5"
        strokeDasharray="7 7"
        opacity="0.55"
      />

      {/* field office */}
      <g transform={`translate(${office.x} ${office.y})`}>
        <rect x="-14" y="-14" width="28" height="28" fill="#404048" />
        <path d="M-8 4v-7l8-6 8 6v7z" fill="#fff" />
        <text x="22" y="5" className="map__label">
          Field office · start / end
        </text>
      </g>

      {/* visit markers */}
      {visits.map((v) => {
        const t = VISIT_TYPES[v.type];
        const p = at(v.farm.pos);
        const isSel = v.farmId === selectedId;
        return (
          <g key={v.farmId} className="map__marker" transform={`translate(${p.x} ${p.y})`} onClick={() => onSelect(v.farmId)}>
            <title>{`${v.order}. ${v.farm.name} — ${t.label}`}</title>
            <circle r={isSel ? 20 : 16} fill={t.color} stroke="#fff" strokeWidth="3" />
            <text y="6" textAnchor="middle" className="map__num">
              {v.order}
            </text>
          </g>
        );
      })}

      {selected && (
        <g transform={`translate(${at(selected.farm.pos).x} ${selected.farm.pos.y - 32})`} pointerEvents="none">
          <rect x={-selected.farm.name.length * 4.3 - 10} y="-17" width={selected.farm.name.length * 8.6 + 20} height="24" fill="#404048" />
          <text y="0" textAnchor="middle" className="map__tag">
            {selected.farm.name}
          </text>
        </g>
      )}
    </svg>
  );
}
