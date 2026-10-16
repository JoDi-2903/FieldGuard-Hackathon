import { useMemo } from 'react';
import AppHeader from '../components/AppHeader.jsx';
import SensorTile from '../components/SensorTile.jsx';
import CallRecording from '../components/CallRecording.jsx';
import VisitNotes from '../components/VisitNotes.jsx';
import VisitPhotos from '../components/VisitPhotos.jsx';
import VisitVerdict from '../components/VisitVerdict.jsx';
import { TODAY_PLAN } from '../data/todayPlan.js';
import { buildDay, formatTime } from '../data/schedule.js';
import { farmById } from '../data/farms.js';
import { riskFromSensors } from '../data/farmDetails.js';
import { useFarmDetail } from '../hooks/useFarmDetail.js';
import { VISIT_TYPES } from '../data/visitTypes.js';
import { EMPTY_RECORD } from '../data/visitRecord.js';
import './Dashboard.css';
import './FarmProfile.css';

const initials = (name) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

export default function FarmProfile({ officer, farmId, record = EMPTY_RECORD, onRecordChange, onOpenFarm, onBack, onSignOut }) {
  const day = useMemo(() => buildDay(TODAY_PLAN), []);
  const idx = day.visits.findIndex((v) => v.farmId === farmId);
  const visit = day.visits[idx];
  const farm = farmById[farmId];
  const { details } = useFarmDetail(farmId);
  const risk = riskFromSensors(details?.sensors);
  const type = visit ? VISIT_TYPES[visit.type] : null;
  const prev = day.visits[idx - 1];
  const next = day.visits[idx + 1];
  const alerts = details?.alerts ?? [];
  const call = details?.call;
  const steps = details?.steps ?? [];
  const riskWord = risk.charAt(0) + risk.slice(1).toLowerCase();

  // Always patch the latest record — voice notes arrive asynchronously.
  const update = (patchFn) => onRecordChange(farmId, (r) => ({ ...r, ...patchFn(r) }));

  return (
    <div className="profile">
      <AppHeader officer={officer} onSignOut={onSignOut} onHome={onBack} wide />

      <section className="profile__band">
        <div className="wrap wrap--wide profile__band-inner">
          <button type="button" className="text-link profile__back" onClick={onBack}>
            ← Today's priorities
          </button>
          <div className="profile__title">
            {visit && <span className="profile__num">{visit.order}</span>}
            <h1>{farm.name}</h1>
            {visit && (
              <span className="profile__meta">
                {formatTime(visit.start)}–{formatTime(visit.end)} ·{' '}
                <span className={type.danger ? 'profile__danger' : ''}>{type.label}</span>
              </span>
            )}
          </div>
          <div className="profile__nav">
            <button type="button" className="btn ghost" disabled={!prev} onClick={() => onOpenFarm(prev.farmId)}>
              ← {prev ? prev.farm.name : 'Previous'}
            </button>
            <button type="button" className="btn ghost" disabled={!next} onClick={() => onOpenFarm(next.farmId)}>
              {next ? next.farm.name : 'Next'} →
            </button>
          </div>
        </div>
      </section>

      <main className="wrap wrap--wide profile__main">
        <h2 className="section-title">Everything you need to know</h2>
        <div className="profile__grid">
          {/* farm & owner */}
          <section className="panel farm-card">
            <div className="farm-card__top">
              {details?.ownerPhoto ? (
                <img className="farm-card__photo" src={details.ownerPhoto} alt={`${farm.owner} on ${farm.name}`} />
              ) : (
                <span className="farm-card__photo is-empty" aria-hidden="true">
                  {initials(farm.owner)}
                </span>
              )}
              <div className="farm-card__who">
                <div className="topline">Owner</div>
                <div className="farm-card__owner">{farm.owner}</div>
                <div className="farm-card__line">{details?.phone ?? '—'}</div>
                <div className="farm-card__line is-muted">{details?.address ?? farm.village}</div>
              </div>
            </div>
            <dl className="facts">
              <dt>Crop</dt>
              <dd>
                <b>
                  {farm.crop} · {farm.hectares} ha
                </b>
                {details?.stage && <> · {details.stage}</>}
              </dd>
              <dt>Last visit</dt>
              <dd>{details?.lastVisit ?? '—'}</dd>
            </dl>
          </section>

          {/* risk: headline, then the evidence — sensors and the farmer call */}
          <section className={`panel risk-card is-${risk.toLowerCase()}`}>
            <h3 className="risk-card__title">
              {riskWord} risk{details?.disease ? ` of ${details.disease}` : ''}
            </h3>

            <div className="evidence">
              <div className="evidence__head">
                <span className="evidence__label">From sensors</span>
                <span className="panel__hint">{details?.sensorsUpdated ?? '—'}</span>
              </div>
              {details?.sensors && (
                <div className="sensors">
                  {Object.entries(details.sensors).map(([id, reading]) => (
                    <SensorTile key={id} id={id} reading={reading} />
                  ))}
                </div>
              )}
              {details?.sensorNote && <p className="risk-card__note">{details.sensorNote}</p>}
              {alerts.length > 0 && (
                <details className="source">
                  <summary>Sensor alerts · {alerts.length}</summary>
                  <ul className="transcript">
                    {alerts.map((line, i) => (
                      <li key={i} className="transcript__line">
                        <span className="transcript__who">{line.at ?? line.who}</span>
                        <span className="transcript__text">{line.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <div className="evidence">
              <div className="evidence__head">
                <span className="evidence__label">From the farmer's call</span>
                {call && <span className="panel__hint">{call.meta}</span>}
              </div>
              {call ? (
                <>
                  <p className="evidence__summary">{call.summary}</p>
                  <CallRecording key={farmId} call={call} />
                </>
              ) : (
                <p className="source__none">No calls since the last visit.</p>
              )}
            </div>
          </section>

          {/* what to do */}
          <section className="panel steps-card">
            <div className="panel__head">
              <h3 className="panel__title">Steps to take</h3>
            </div>
            {steps.length > 0 ? (
              <ol className="steps">
                {steps.map((step, i) => (
                  <li key={i} className="step">
                    <span className="step__num" aria-hidden="true">{i + 1}</span>
                    <span className="step__text">
                      <b>{step.title}</b>
                      {step.sub && <span className="step__sub">{step.sub}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="source__none">No steps yet — check the field and record what you see.</p>
            )}
          </section>
        </div>

        <h2 className="section-title">Documentation</h2>
        <div className="profile__grid profile__grid--doc">
          <section className="panel doc-panel">
            <div className="panel__head">
              <h3 className="panel__title">Notes</h3>
              <span className="panel__hint">text or voice</span>
            </div>
            <VisitNotes notes={record.notes} onAdd={(n) => update((r) => ({ notes: [...r.notes, n] }))} />
          </section>

          <section className="panel doc-panel">
            <div className="panel__head">
              <h3 className="panel__title">Photos</h3>
              {record.photos.length > 0 && <span className="panel__hint">{record.photos.length}</span>}
            </div>
            <VisitPhotos
              photos={record.photos}
              onAdd={(p) => update((r) => ({ photos: [...r.photos, p] }))}
              onRemove={(id) => update((r) => ({ photos: r.photos.filter((p) => p.id !== id) }))}
            />
          </section>

          <section className="panel doc-panel">
            <div className="panel__head">
              <h3 className="panel__title">Verdict</h3>
            </div>
            <VisitVerdict
              verdict={record.verdict}
              onChange={(verdict) => update(() => ({ verdict }))}
              onSave={() => update((r) => ({ verdict: { ...r.verdict, savedAt: new Date() } }))}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
