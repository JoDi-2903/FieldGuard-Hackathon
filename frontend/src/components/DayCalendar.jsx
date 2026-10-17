import { useEffect, useRef } from 'react';
import { DAY_START, DAY_END, formatTime } from '../data/schedule.js';
import { VISIT_TYPES } from '../data/visitTypes.js';
import { farmDetails } from '../data/farmDetails.js';

// Outlook-style single-day view that doubles as the visit list: each visit shows
// time, farmer, farm and status; clicking it opens the farm profile.
// Fixed scale so every card has room to read; the day scrolls inside its panel.
const PX_PER_MIN = 1.6;
const SPAN = DAY_END - DAY_START;
const pct = (minutes) => `${((minutes - DAY_START) / SPAN) * 100}%`;
const len = (a, b) => `${((b - a) / SPAN) * 100}%`;

const HALF_HOURS = [];
for (let m = DAY_START; m <= DAY_END; m += 30) HALF_HOURS.push(m);

const initials = (name) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

function CarIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 8V6l1.5-3.5h9L14 6v2z" strokeLinejoin="round" />
      <circle cx="4.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function DayCalendar({ events, selectedId, onSelect, onOpen, now = new Date() }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin > DAY_START && nowMin < DAY_END;
  const scrollRef = useRef(null);

  // Start at "now" during the working day, otherwise at the first visit.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstVisit = events.find((e) => e.kind === 'visit');
    const target = showNow ? nowMin - 30 : (firstVisit?.start ?? DAY_START) - 45;
    el.scrollTop = Math.max(0, (target - DAY_START) * PX_PER_MIN);
    // only on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="cal__scroll" ref={scrollRef}>
      <div className="cal" style={{ height: SPAN * PX_PER_MIN }}>
        {HALF_HOURS.map((m) => (
          <div key={m} className={`cal__line${m % 60 ? ' is-half' : ''}`} style={{ top: pct(m) }}>
            {m % 60 === 0 && <span className="cal__hour">{formatTime(m)}</span>}
          </div>
        ))}

        <div className="cal__events">
          {events.map((e) => {
            if (e.kind === 'travel') {
              return (
                <div
                  key={e.id}
                  className="cal__event is-travel"
                  style={{ top: pct(e.start), height: len(e.start, e.end) }}
                  title={`Drive to ${e.to}`}
                >
                  <CarIcon />
                  <span>
                    {e.end - e.start} min · {e.km} km
                  </span>
                </div>
              );
            }
            const t = VISIT_TYPES[e.type];
            const photo = farmDetails(e.farmId)?.ownerPhoto;
            return (
              <button
                type="button"
                key={e.id}
                className={`cal__event is-visit${e.id === selectedId ? ' is-selected' : ''}`}
                style={{ top: pct(e.start), height: len(e.start, e.end) }}
                onMouseEnter={() => onSelect(e.id)}
                onFocus={() => onSelect(e.id)}
                onClick={() => onOpen(e.id)}
                aria-label={`${e.order}. ${e.farm.name}, ${e.farm.owner}, ${t.label}, ${formatTime(e.start)} to ${formatTime(e.end)}. Open farm profile`}
              >
                <span className="cal__inner">
                  <span className="cal__time">
                    {formatTime(e.start)}
                    <span className="cal__time-end">{formatTime(e.end)}</span>
                  </span>
                  {photo ? (
                    <img className="cal__avatar" src={photo} alt="" />
                  ) : (
                    <span className="cal__avatar is-empty" aria-hidden="true">
                      {initials(e.farm.owner)}
                    </span>
                  )}
                  <span className="cal__body">
                    <span className="cal__event-title">
                      {e.order}. {e.farm.name}
                    </span>
                    <span className="cal__event-meta">{e.farm.owner}</span>
                  </span>
                  <span className={`cal__status${t.danger ? ' is-danger' : ''}`}>{t.short}</span>
                  <span className="cal__go" aria-hidden="true">
                    →
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {showNow && <div className="cal__now" style={{ top: pct(nowMin) }} aria-label={`Now ${formatTime(nowMin)}`} />}
      </div>
    </div>
  );
}
