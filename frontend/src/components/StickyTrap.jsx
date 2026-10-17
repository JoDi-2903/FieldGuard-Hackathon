import { useRef, useState } from 'react';
import { countWhiteflies } from '../trap/countWhiteflies.js';
import { readPhotoPixels } from '../trap/readPhotoPixels.js';
import { assessWhiteflyRisk } from '../trap/whiteflyRisk.js';
import { isoDate } from '../data/stickyTraps.js';
import './StickyTrap.css';

const UNCLEAR_REASONS = {
  'no-card': 'No yellow card found — fill the photo with the card.',
  'too-dark': 'Too dark — move into daylight.',
  blurry: 'Blurry — hold the phone still and tap to focus.',
  'implausible-count': 'The count looks wrong — check for glare or dirt on the card.',
};

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Weekly yellow sticky-card check: photograph the card, count the whiteflies,
// compare with last week and say how big the risk of cassava mosaic spread is.
export default function StickyTrap({ history = [], sickPlantNearby, onAddReading }) {
  const inputRef = useRef(null);
  // idle | counting | unclear (photo not good enough, nothing saved) | error
  const [attempt, setAttempt] = useState({ state: 'idle' });
  const risk = assessWhiteflyRisk(history, sickPlantNearby);
  const latestPhoto = risk.latest?.photo;
  const shownPhoto = attempt.photo ?? latestPhoto;

  async function handleFile(e) {
    const file = Array.from(e.target.files ?? []).find((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAttempt({ state: 'counting', photo: { url } });
    try {
      const result = countWhiteflies(await readPhotoPixels(url));
      const photo = { url, width: result.width, height: result.height, specks: result.specks };
      if (result.quality === 'unclear') {
        // No circles: on an unclear photo they would suggest a count we don't trust.
        setAttempt({ state: 'unclear', photo: { url }, reasons: result.reasons });
        return;
      }
      onAddReading({ date: isoDate(new Date()), count: result.count, source: 'photo', photo });
      setAttempt({ state: 'idle' });
    } catch (err) {
      setAttempt({ state: 'error', message: err.message });
    }
  }

  return (
    <div className="trap">
      <div className="trap__photo-col">
        {shownPhoto ? (
          <TrapPhoto photo={shownPhoto} dimmed={attempt.state !== 'idle'} />
        ) : (
          <button type="button" className="photos__add trap__add" onClick={() => inputRef.current?.click()}>
            <CameraIcon />
            <span>Photograph this week's card</span>
          </button>
        )}
        {shownPhoto && (
          <button type="button" className="btn ghost trap__retake" onClick={() => inputRef.current?.click()} disabled={attempt.state === 'counting'}>
            <CameraIcon size={20} />
            {attempt.state === 'unclear' ? 'Retake photo' : 'New card photo'}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      </div>

      <div className="trap__result">
        <AttemptStatus attempt={attempt} />
        {risk.latest ? (
          <>
            <div className="trap__count">
              <span className="trap__count-num">{risk.latest.count}</span>
              <span className="trap__count-text">
                whiteflies on the card
                <br />
                <span className="panel__hint">
                  {shortDate(risk.latest.date)} · {risk.latest.source === 'photo' ? 'counted from your photo' : 'earlier count'}
                </span>
              </span>
            </div>
            <TrendLine risk={risk} />
          </>
        ) : null}
        <p className={`trap__risk is-${risk.level}`}>{risk.message}</p>
        <TrapHistory history={history} />
        <p className="photos__hint">
          Counts pale specks on the yellow card. This shows the risk of cassava mosaic spreading, not whether plants are infected —
          check the plants to confirm.
        </p>
      </div>
    </div>
  );
}

function TrapPhoto({ photo, dimmed }) {
  return (
    <figure className={`trap__photo${dimmed ? ' is-dimmed' : ''}`}>
      <img src={photo.url} alt="Yellow sticky card" />
      {photo.specks && (
        <svg viewBox={`0 0 ${photo.width} ${photo.height}`} preserveAspectRatio="none" aria-hidden="true">
          {photo.specks.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={Math.max(s.r * 1.6, photo.width / 160)} className={s.n > 1 ? 'is-cluster' : ''} />
          ))}
        </svg>
      )}
    </figure>
  );
}

function AttemptStatus({ attempt }) {
  if (attempt.state === 'counting') return <p className="trap__status">Counting whiteflies…</p>;
  if (attempt.state === 'error') return <p className="trap__status is-bad">Could not read the photo: {attempt.message}</p>;
  if (attempt.state !== 'unclear') return null;
  return (
    <div className="trap__status is-bad">
      <b>Photo unclear — not saved. Please retake.</b>
      <ul>
        {attempt.reasons.map((r) => (
          <li key={r}>{UNCLEAR_REASONS[r] ?? r}</li>
        ))}
      </ul>
    </div>
  );
}

function TrendLine({ risk }) {
  if (!risk.previous) return <p className="trap__trend">No card from last week to compare.</p>;
  const arrow = risk.change > 0 ? '↑' : risk.change < 0 ? '↓' : '→';
  const sign = risk.change > 0 ? '+' : '';
  return (
    <p className={`trap__trend${risk.isRising ? ' is-rising' : ''}`}>
      {arrow} {sign}
      {risk.change} vs. {risk.previous.count} on {shortDate(risk.previous.date)}
      {risk.isRising ? ' — rising' : ''}
    </p>
  );
}

function TrapHistory({ history }) {
  const recent = history.slice(-5);
  if (recent.length < 2) return null;
  const max = Math.max(...recent.map((r) => r.count), 1);
  return (
    <div className="trap__history" aria-label="Whitefly counts per week">
      {recent.map((r) => (
        <div key={r.date} className="trap__bar">
          <span className="trap__bar-num">{r.count}</span>
          <span className="trap__bar-fill" style={{ height: `${Math.max(4, (r.count / max) * 56)}px` }} />
          <span className="trap__bar-date">{shortDate(r.date)}</span>
        </div>
      ))}
    </div>
  );
}

function CameraIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 10h5l2-3h8l2 3h5v14H4z" />
      <circle cx="15" cy="16" r="4.5" />
    </svg>
  );
}
