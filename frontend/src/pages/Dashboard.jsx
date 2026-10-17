import { useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader.jsx';
import DayCalendar from '../components/DayCalendar.jsx';
import RouteMap from '../components/RouteMap.jsx';
import { TODAY_PLAN } from '../data/todayPlan.js';
import { buildDay, formatTime, RAINY_SEASON } from '../data/schedule.js';
import { VISIT_TYPES, TYPE_ORDER } from '../data/visitTypes.js';
import { fieldIdForFarm } from '../data/farmFieldMap.js';
import { FORCED_RISK } from '../data/farms.js';
import { useLiveRisk } from '../hooks/useLiveRisk.js';
import { greeting } from '../utils/greeting.js';
import './Dashboard.css';

const SUMMARY_TEXT = {
  help: (n) => (n === 1 ? 'farmer asked for help' : 'farmers asked for help'),
  warning: (n) => (n === 1 ? 'disease warning' : 'disease warnings'),
  regular: (n) => (n === 1 ? 'regular check' : 'regular checks'),
};

// Overlay live risk (GET /api/risk) onto the static day plan for sensor-backed farms.
// A farmer's own call for help still outranks a sensor verdict; otherwise green =>
// regular check, yellow/red => disease warning, with the AI reasoning as the summary.
function overlayPlan(plan, liveRisk) {
  if (!liveRisk || Object.keys(liveRisk).length === 0) return plan;
  return {
    ...plan,
    visits: plan.visits.map((v) => {
      const fieldId = fieldIdForFarm(v.farmId);
      const r = fieldId ? liveRisk[fieldId] : null;
      if (!r) return v;
      // A forced-risk farm (e.g. f01) keeps its hand-set danger status; only its live
      // reasoning/action text flows in, never its colour. Otherwise green => regular check.
      const liveType = v.type === 'help' ? 'help' : r.color === 'green' ? 'regular' : 'warning';
      const type = FORCED_RISK[v.farmId] ? v.type : liveType;
      return {
        ...v,
        type,
        summary: r.reasoning || v.summary,
        finding: r.reasoning || v.finding,
        focus: r.recommended_action || v.focus,
      };
    }),
  };
}

export default function Dashboard({ officer, onSignOut, onOpenFarm }) {
  const liveRisk = useLiveRisk();
  const day = useMemo(() => buildDay(overlayPlan(TODAY_PLAN, liveRisk)), [liveRisk]);
  const [selectedId, setSelectedId] = useState(day.visits[0]?.farmId);
  const today = new Date();
  const counts = TYPE_ORDER.map((type) => ({ type, n: day.visits.filter((v) => v.type === type).length })).filter((c) => c.n > 0);

  return (
    <div className="dash">
      <AppHeader officer={officer} onSignOut={onSignOut} wide />

      {/* thin band, same as the farm profile */}
      <section className="dash__band">
        <div className="wrap wrap--wide dash__band-inner">
          <h1 className="dash__title">
            {greeting(today)}, {officer.name}. Here are your priorities for today.
          </h1>
          <span className="dash__date">
            {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </section>

      <main className="wrap wrap--wide dash__grid">
        <section className="panel dash__calendar" aria-labelledby="cal-title">
          <div className="panel__head">
            <h2 id="cal-title" className="panel__title">
              Schedule
            </h2>
            <div className="legend">
              <span className="legend__item">
                <i className="legend__swatch is-visit" />
                Visit
              </span>
              <span className="legend__item">
                <i className="legend__swatch is-travel" />
                Drive{RAINY_SEASON ? ' (rainy ×2)' : ''}
              </span>
            </div>
          </div>
          <DayCalendar events={day.events} selectedId={selectedId} onSelect={setSelectedId} onOpen={onOpenFarm} />
        </section>

        <div className="dash__right">
          <section className="panel glance" aria-label="Today at a glance">
            {counts.map(({ type, n }) => (
              <div className="figure" key={type}>
                <span className={`figure__value${VISIT_TYPES[type].danger ? ' is-danger' : ''}`}>{n}</span>
                <span className="figure__label">{SUMMARY_TEXT[type](n)}</span>
              </div>
            ))}
            <div className="figure">
              <span className="figure__value is-neutral">{day.visits.length}</span>
              <span className="figure__label">visits today</span>
            </div>
            <div className="figure">
              <span className="figure__value is-neutral">{day.totalKm} km</span>
              <span className="figure__label">driving</span>
            </div>
            <div className="figure">
              <span className="figure__value is-neutral">{formatTime(day.backAt)}</span>
              <span className="figure__label">back at the office</span>
            </div>
          </section>
          <section className="panel dash__map" aria-labelledby="map-title">
            <div className="panel__head">
              <h2 id="map-title" className="panel__title">
                Today's route
              </h2>
              <div className="legend">
                <span className="legend__item">
                  <i className="legend__dot" style={{ background: VISIT_TYPES.help.color }} />
                  Needs action
                </span>
                <span className="legend__item">
                  <i className="legend__dot" style={{ background: VISIT_TYPES.regular.color }} />
                  Regular check
                </span>
                <span className="legend__item">
                  <i className="legend__dot is-small" />
                  Other assigned farms
                </span>
                <span className="legend__item legend__note">ordered by distance · not to scale</span>
              </div>
            </div>
            <div className="map__frame">
              <RouteMap visits={day.visits} selectedId={selectedId} onSelect={setSelectedId} onOpen={onOpenFarm} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
