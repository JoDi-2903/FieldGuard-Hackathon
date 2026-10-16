import { useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader.jsx';
import DayCalendar from '../components/DayCalendar.jsx';
import RouteMap from '../components/RouteMap.jsx';
import VisitList from '../components/VisitList.jsx';
import { TODAY_PLAN } from '../data/todayPlan.js';
import { buildDay, formatTime, RAINY_SEASON } from '../data/schedule.js';
import { VISIT_TYPES, TYPE_ORDER } from '../data/visitTypes.js';
import { fieldIdForFarm } from '../data/farmFieldMap.js';
import { useLiveRisk } from '../hooks/useLiveRisk.js';
import { greeting } from '../utils/greeting.js';
import './Dashboard.css';

const SUMMARY_TEXT = {
  help: (n) => (n === 1 ? 'farmer asked for help' : 'farmers asked for help'),
  warning: (n) => (n === 1 ? 'disease warning' : 'disease warnings'),
  regular: (n) => (n === 1 ? 'regular check' : 'regular checks'),
};

// Overlay live risk onto the static day plan for sensor-backed farms. A farmer's
// own call for help still outranks a sensor verdict; otherwise green => a regular
// check and yellow/red => a disease warning, with the AI reasoning as the summary.
function overlayPlan(plan, liveRisk) {
  if (!liveRisk || Object.keys(liveRisk).length === 0) return plan;
  return {
    ...plan,
    visits: plan.visits.map((v) => {
      const fieldId = fieldIdForFarm(v.farmId);
      const r = fieldId ? liveRisk[fieldId] : null;
      if (!r) return v;
      const type = v.type === 'help' ? 'help' : r.color === 'green' ? 'regular' : 'warning';
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
  const counts = TYPE_ORDER.map((type) => ({ type, n: day.visits.filter((v) => v.type === type).length }));

  return (
    <div className="dash">
      <AppHeader officer={officer} onSignOut={onSignOut} wide />

      <section className="dash__band">
        <div className="wrap wrap--wide dash__band-inner">
          <div>
            <div className="topline dash__topline">
              {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <h1 className="dash__title">
              {greeting(today)}, {officer.name}. Here are your priorities for today.
            </h1>
          </div>
          <div className="dash__summary">
            {counts.map(({ type, n }) => (
              <div className="dash__stat" key={type}>
                <span className={`dash__stat-num${VISIT_TYPES[type].danger ? ' is-danger' : ''}`}>{n}</span>
                <span className="dash__stat-text">{SUMMARY_TEXT[type](n)}</span>
              </div>
            ))}
            <div className="dash__stat dash__stat--route">
              <span className="dash__stat-num">{day.visits.length}</span>
              <span className="dash__stat-text">
                visits · {day.totalKm} km
                <br />
                back at {formatTime(day.backAt)}
              </span>
            </div>
          </div>
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
                Farm visit
              </span>
              <span className="legend__item">
                <i className="legend__swatch is-travel" />
                Driving{RAINY_SEASON ? ' (rainy season ×2)' : ''}
              </span>
            </div>
          </div>
          <DayCalendar events={day.events} selectedId={selectedId} onSelect={setSelectedId} now={today} />
        </section>

        <div className="dash__right">
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
                <span className="legend__item legend__note">Ordered by distance · schematic, not to scale</span>
              </div>
            </div>
            <div className="map__frame">
              <RouteMap visits={day.visits} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </section>

          <section className="panel dash__list" aria-labelledby="list-title">
            <div className="panel__head">
              <h2 id="list-title" className="panel__title">
                Farms to visit
              </h2>
              <span className="panel__hint">in visit order · 20 farms on a 2-week cycle</span>
            </div>
            <VisitList visits={day.visits} selectedId={selectedId} onSelect={setSelectedId} onOpenFarm={onOpenFarm} />
          </section>
        </div>
      </main>
    </div>
  );
}
