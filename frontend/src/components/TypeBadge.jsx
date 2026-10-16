import { VISIT_TYPES } from '../data/visitTypes.js';

// Square solid label, like the WHH "Im Fokus" topic boxes.
export default function TypeBadge({ type }) {
  const t = VISIT_TYPES[type];
  return (
    <span className="type-badge" style={{ background: t.color, color: t.text }}>
      {t.short}
    </span>
  );
}
