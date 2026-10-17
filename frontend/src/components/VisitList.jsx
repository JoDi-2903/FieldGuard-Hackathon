import { VISIT_TYPES } from '../data/visitTypes.js';
import WhiteflyBadge from './WhiteflyBadge.jsx';

// One line per farm in visit order: Farm – Owner | data-based finding | profile link.
export default function VisitList({ visits, whiteflyIds = new Set(), selectedId, onSelect, onOpenFarm }) {
  return (
    <ol className="visits">
      {visits.map((v) => {
        const danger = VISIT_TYPES[v.type].danger;
        const selected = v.farmId === selectedId;
        return (
          <li
            key={v.farmId}
            className={`visit${danger ? ' is-danger' : ''}${selected ? ' is-selected' : ''}`}
            onClick={() => onSelect(v.farmId)}
          >
            <span className="visit__num">{v.order}.</span>
            <span className="visit__who">
              <b className="visit__farm">{v.farm.name}</b> – {v.farm.owner}
            </span>
            <span className="visit__finding">
              {whiteflyIds.has(v.farmId) && <WhiteflyBadge />}
              {v.summary}
            </span>
            <button
              type="button"
              className="text-link visit__profile"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFarm(v.farmId);
              }}
            >
              Full farm profile <span className="arrow" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
