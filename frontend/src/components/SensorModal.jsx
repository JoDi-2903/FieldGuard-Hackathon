import { useEffect, useRef } from 'react';
import LiveChart from './LiveChart.jsx';
import ArchitectureFlow from './ArchitectureFlow.jsx';
import { METRICS } from '../data/sensorMetrics.js';
import { useLiveReadings } from '../hooks/useLiveReadings.js';
import './SensorModal.css';

const ago = (d) => {
  if (!d) return 'waiting for data';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
};

// Near full-screen live sensor view: real-time metrics on the left,
// the Azure architecture with data moving through it on the right.
export default function SensorModal({ farm, deviceId, seed, riskColor, onClose }) {
  const flow = useRef({});
  const closeRef = useRef(null);
  const { readings, live, lastPollAt } = useLiveReadings(deviceId, {
    enabled: true,
    seed,
    onNew: (r) => flow.current.reading?.(r),
    onPoll: () => flow.current.poll?.(),
  });
  const latestAt = readings.length ? new Date(readings[readings.length - 1].deviceTimestamp) : null;

  // Esc closes, the page behind does not scroll, focus starts on Close
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="smodal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="smodal__dialog" role="dialog" aria-modal="true" aria-labelledby="smodal-title">
        <header className="smodal__head">
          <div>
            <div className="topline">Live sensor view</div>
            <h2 id="smodal-title" className="smodal__title">
              {farm.name} · sensor box {deviceId ?? '(none)'}
            </h2>
          </div>
          <span className={`smodal__status${live ? ' is-live' : ''}`}>
            <i aria-hidden="true" />
            {live ? 'Live' : 'Demo data'} · last reading {ago(latestAt)}
          </span>
          <button ref={closeRef} type="button" className="smodal__close" onClick={onClose}>
            Close ✕
          </button>
        </header>

        <div className="smodal__body">
          <section className="smodal__metrics" aria-label="Live metrics">
            <div className="source-block__head">
              <span className="source-tag is-sensor">Sensor data</span>
              <span className="panel__hint">last 10 minutes · refreshes every 5 s{lastPollAt ? ` · polled ${ago(lastPollAt)}` : ''}</span>
            </div>
            <div className="smodal__charts">
              {METRICS.map((m) => (
                <LiveChart key={m.key} metric={m} readings={readings} />
              ))}
            </div>
          </section>

          <section className="smodal__arch" aria-label="Azure architecture">
            <div className="source-block__head">
              <span className="source-tag is-arch">How the data moves</span>
              <span className="panel__hint">dots are real readings and requests, as they happen</span>
            </div>
            <ArchitectureFlow controlRef={flow} riskColor={riskColor} deviceId={deviceId} live={live} />
            <ul className="smodal__legend">
              <li><i style={{ background: '#2FAB16' }} />new reading from the box</li>
              <li><i style={{ background: '#404048' }} />dashboard poll</li>
              <li><i style={{ background: '#CF0033' }} />LED colour back to the box</li>
              <li><i style={{ background: '#B02885' }} />AI scoring every 20 min</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
