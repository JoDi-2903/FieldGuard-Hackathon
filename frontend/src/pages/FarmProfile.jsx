import { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../components/AppHeader.jsx';
import SensorTile from '../components/SensorTile.jsx';
import InfoIcon from '../components/InfoIcon.jsx';
import { emphasize } from '../utils/emphasis.jsx';
import CallRecording from '../components/CallRecording.jsx';
import { TODAY_PLAN } from '../data/todayPlan.js';
import { buildDay, formatTime } from '../data/schedule.js';
import { farmById, FORCED_RISK } from '../data/farms.js';
import { riskFromSensors } from '../data/farmDetails.js';
import { useFarmDetail } from '../hooks/useFarmDetail.js';
import { deviceIdForFarm } from '../data/farmFieldMap.js';
import SensorModal from '../components/SensorModal.jsx';
import { VISIT_TYPES } from '../data/visitTypes.js';
import './Dashboard.css';
import './FarmProfile.css';

const initials = (name) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

export default function FarmProfile({ officer, farmId, onOpenFarm, onBack, onSignOut }) {
  const day = useMemo(() => buildDay(TODAY_PLAN), []);
  const idx = day.visits.findIndex((v) => v.farmId === farmId);
  const visit = day.visits[idx];
  const farm = farmById[farmId];
  // static demo data, overlaid with live backend data for sensor-backed farms
  const { details, live } = useFarmDetail(farmId);
  // Risk colour + label follow the live sensor tiles, re-checked on a 10 s heartbeat so the
  // card can turn yellow or red as readings climb. The AI finding and steps keep their own
  // (backend) cadence, so the recommendation text does not flip every few seconds.
  // f01 is pinned HIGH for the demo: no live status check, though its 4 sensor tiles still stream.
  const sensorsRef = useRef(details?.sensors);
  sensorsRef.current = details?.sensors;
  const forcedRisk = FORCED_RISK[farmId];
  const [risk, setRisk] = useState(() => forcedRisk ?? riskFromSensors(details?.sensors));
  useEffect(() => {
    if (forcedRisk) {
      setRisk(forcedRisk);
      return undefined;
    }
    setRisk(riskFromSensors(sensorsRef.current));
    const id = setInterval(() => setRisk(riskFromSensors(sensorsRef.current)), 10000);
    return () => clearInterval(id);
  }, [farmId, forcedRisk]);
  const [liveViewOpen, setLiveViewOpen] = useState(false);
  const s = details?.sensors;
  // starting values for the demo stream when the farm has no live box
  const seed = {
    humidity: s?.humidity?.value ?? 70,
    temperature: s?.temperature?.value ?? 24,
    soil: s?.soilMoisture?.value ?? 30,
    wet: (s?.leafWetness?.value ?? 0) >= 10,
  };
  const type = visit ? VISIT_TYPES[visit.type] : null;
  const prev = day.visits[idx - 1];
  const next = day.visits[idx + 1];
  // newest first; the live backend provides the latest call, the demo data may hold older ones
  const calls = details?.calls ?? (details?.call ? [details.call] : []);
  const finding = details?.finding;
  const steps = details?.steps ?? [];
  const riskWord = risk.charAt(0) + risk.slice(1).toLowerCase();
  const [lastVisitDate, lastVisitNote] = (details?.lastVisit ?? '—').split(' · ');
  return (
    <div className="profile">
      <AppHeader officer={officer} onSignOut={onSignOut} onHome={onBack} wide />

      <section className="profile__band">
        <div className="wrap wrap--wide profile__band-inner">
          <button type="button" className="text-link profile__back" onClick={onBack}>
            ← Today's priorities
          </button>
          <nav className="profile__nav" aria-label="Other farms on today's route">
            {prev && (
              <button type="button" className="nav-pill" onClick={() => onOpenFarm(prev.farmId)}>
                ← Previous <span className="nav-pill__name">· {prev.farm.name}</span>
              </button>
            )}
            {next && (
              <button type="button" className="nav-pill" onClick={() => onOpenFarm(next.farmId)}>
                Next <span className="nav-pill__name">· {next.farm.name}</span> →
              </button>
            )}
          </nav>
        </div>
      </section>

      <main className="wrap wrap--wide profile__main">
        <div className="know">
          {/* farm & owner — photo-led card, WHH "Im Fokus" label */}
          <section className="panel farm-card">
            <header className="farm-card__head">
              {visit && <span className="farm-card__num">{visit.order}</span>}
              <div className="farm-card__heading">
                {visit && (
                  <div className="topline">
                    Visit {visit.order} of {day.visits.length} · {formatTime(visit.start)}–{formatTime(visit.end)}
                  </div>
                )}
                <div className="farm-card__title-row">
                  <h1 className="farm-card__name">{farm.name}</h1>
                  {type && <span className={`farm-card__type${type.danger ? ' is-danger' : ''}`}>{type.label}</span>}
                </div>
              </div>
            </header>
            <figure className="farm-card__media">
              {details?.ownerPhoto ? (
                <img src={details.ownerPhoto} alt={`${farm.owner} on ${farm.name}`} />
              ) : (
                <span className="farm-card__initials" aria-hidden="true">
                  {initials(farm.owner)}
                </span>
              )}
              <figcaption className="farm-card__label">{farm.owner}</figcaption>
            </figure>
            <ul className="info">
              <li className="info__row">
                <InfoIcon name="pin" />
                <span className="info__text">
                  <b>{details?.address ?? farm.village}</b>
                </span>
              </li>
              <li className="info__row">
                <InfoIcon name="phone" />
                <span className="info__text">
                  <b>{details?.phone ?? '—'}</b>
                </span>
              </li>
              <li className="info__row">
                <InfoIcon name="crop" />
                <span className="info__text">
                  <b>
                    {farm.crop} · {farm.hectares} ha
                  </b>
                  {details?.stage && <span>{details.stage}</span>}
                </span>
              </li>
              <li className="info__row">
                <InfoIcon name="calendar" />
                <span className="info__text">
                  <b>Last visit {lastVisitDate}</b>
                  {lastVisitNote && <span>{lastVisitNote}</span>}
                </span>
              </li>
            </ul>
          </section>

          <div className="know__right">
            {/* risk — verdict on top, then the two evidence sources side by side:
                machine (sensors, cool/neutral) vs. person (farmer, warm wheat + photo) */}
            <section className={`panel risk-card is-${risk.toLowerCase()}`}>

              <div className="evidence">
                <div className="evidence__left">
                  <header className="verdict-line">
                    <div className="topline">Risk score</div>
                    <div className="verdict-line__row">
                      <span className="risk-card__value">{riskWord}</span>
                      <span className="risk-card__caption">
                        {details?.disease
                          ? `risk of ${details.disease}`
                          : risk === 'LOW'
                            ? 'all readings in range'
                            : 'sensor readings elevated'}
                      </span>
                    </div>
                  </header>
                  <div className="source-block is-sensor">
                    <div className="source-block__head">
                      <span className="source-tag is-sensor">Sensor data</span>
                      <button type="button" className="live-link" onClick={() => setLiveViewOpen(true)}>
                        Open live view <span className="arrow" aria-hidden="true" />
                      </button>
                      <span className="panel__hint">
                        {live ? 'Live' : 'Demo data'} · 4 field sensors · updated {details?.sensorsUpdated ?? '—'}
                      </span>
                    </div>
                    {details?.sensors && (
                      <div
                        className="kpis is-clickable"
                        role="button"
                        tabIndex={0}
                        aria-label="Open the live sensor view"
                        onClick={() => setLiveViewOpen(true)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setLiveViewOpen(true))}
                      >
                        {Object.entries(details.sensors).map(([id, reading]) => (
                          <SensorTile key={id} id={id} reading={reading} />
                        ))}
                      </div>
                    )}
                    <div className="finding">
                      {finding ? (
                        <>
                          <h3 className="finding__title">{finding.title}</h3>
                          <ul className="reasons">
                            {finding.reasons.map((r) => (
                              <li key={r.label} className={`reason is-${r.status}`}>
                                <i className="reason__dot" aria-hidden="true" />
                                <span>
                                  <b className="reason__label">{r.label}.</b> {emphasize(r.text)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <h3 className="finding__title">
                          {details?.sensorNote ?? 'No disease signals. All readings are in range.'}
                        </h3>
                      )}
                    </div>
                  </div>
                </div>

                <div className="source-block is-person">
                  <div className="source-block__head">
                    <span className="source-tag is-person">Call history</span>
                  </div>
                  <div className="reporter">
                    {details?.ownerPhoto ? (
                      <img className="reporter__photo" src={details.ownerPhoto} alt="" />
                    ) : (
                      <span className="reporter__photo is-empty" aria-hidden="true">
                        {initials(farm.owner)}
                      </span>
                    )}
                    <span className="reporter__who">
                      <b>{farm.owner}</b>
                      <span>
                        {calls.length
                          ? `${calls.length} call${calls.length > 1 ? 's' : ''} since the last visit`
                          : 'No calls since the last visit'}
                      </span>
                    </span>
                  </div>
                  {calls.length > 0 && (
                    <ol className="calls">
                      {calls.map((c, i) => (
                        <li key={`${farmId}-${i}`} className="call-item">
                          <span className="call-item__meta">{c.meta}</span>
                          <p className="call-item__summary">{emphasize(c.summary)}</p>
                          <CallRecording call={c} />
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </section>

            {/* what to do — white panel, light-green tinted steps (same language as the schedule) */}
            <section className="panel steps-band">
              <div className="panel__head">
                <h2 className="panel__title">Steps to take</h2>
              </div>
              {steps.length > 0 ? (
                <ol className="steps">
                  {steps.map((step, i) => (
                    <li key={i} className="step">
                      <span className="step__num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="step__text">
                        <b>{step.title}</b>
                        {step.sub && <span className="step__sub">{step.sub}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="steps-band__none">
                  Regular check, no specific steps. Walk the field and check the crop.
                </p>
              )}
            </section>
          </div>
        </div>

      </main>

      {liveViewOpen && (
        <SensorModal
          farm={farm}
          deviceId={deviceIdForFarm(farmId)}
          seed={seed}
          riskColor={{ HIGH: 'red', MEDIUM: 'yellow', LOW: 'green' }[risk]}
          onClose={() => setLiveViewOpen(false)}
        />
      )}
    </div>
  );
}
