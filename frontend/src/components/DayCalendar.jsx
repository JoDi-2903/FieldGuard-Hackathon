import { DAY_START, DAY_END, formatTime } from '../data/schedule.js';

// Outlook-style single-day view. Positions are percentages of the day, so the
// whole 08:00–16:00 range always fits the available height.
const SPAN = DAY_END - DAY_START;
const pct = (minutes) => `${((minutes - DAY_START) / SPAN) * 100}%`;
const len = (a, b) => `${((b - a) / SPAN) * 100}%`;

const HALF_HOURS = [];
for (let m = DAY_START; m <= DAY_END; m += 30) HALF_HOURS.push(m);

export default function DayCalendar({ events, selectedId, onSelect, now = new Date() }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin > DAY_START && nowMin < DAY_END;

  return (
    <div className="cal">
      {HALF_HOURS.map((m) => (
        <div key={m} className={`cal__line${m % 60 ? ' is-half' : ''}`} style={{ top: pct(m) }}>
          {m % 60 === 0 && <span className="cal__hour">{formatTime(m)}</span>}
        </div>
      ))}

      <div className="cal__events">
        {events.map((e) =>
          e.kind === 'travel' ? (
            <div key={e.id} className="cal__event is-travel" style={{ top: pct(e.start), height: len(e.start, e.end) }}>
              <span className="cal__event-title">
                Drive to {e.to} · {e.end - e.start} min · {e.km} km
              </span>
            </div>
          ) : (
            <button
              type="button"
              key={e.id}
              className={`cal__event is-visit${e.id === selectedId ? ' is-selected' : ''}`}
              style={{ top: pct(e.start), height: len(e.start, e.end) }}
              onClick={() => onSelect(e.id)}
              aria-pressed={e.id === selectedId}
            >
              <span className="cal__event-title">
                {e.order}. {e.farm.name}
              </span>
              <span className="cal__event-meta">
                {formatTime(e.start)}–{formatTime(e.end)} · {e.farm.owner}
              </span>
              {e.end - e.start >= 60 && <span className="cal__event-meta">{e.farm.crop}</span>}
            </button>
          )
        )}
      </div>

      {showNow && <div className="cal__now" style={{ top: pct(nowMin) }} aria-label={`Now ${formatTime(nowMin)}`} />}
    </div>
  );
}
