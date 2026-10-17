import { useEffect, useRef, useState } from 'react';
import { getReadings } from '../api/client.js';

const POLL_MS = 5000; // the box posts every 5 s in demo mode
const WINDOW = 120; // readings kept in the charts (10 min at 5 s)

const jitter = (v, amp) => v + (Math.random() - 0.5) * amp;

// Synthetic stream for farms without a box (or an unreachable backend), seeded from
// the farm's demo values so it looks like that farm. Clearly labelled "Demo data" in the UI.
function demoReading(prev, seed, ts) {
  const base = prev ?? { humidity_pct: seed.humidity, temperature_c: seed.temperature, soil_pct: seed.soil, rain: seed.wet ? 1 : 0 };
  return {
    deviceTimestamp: ts.toISOString(),
    humidity_pct: Math.min(100, Math.max(30, jitter(base.humidity_pct * 0.9 + seed.humidity * 0.1, 1.6))),
    temperature_c: jitter(base.temperature_c * 0.9 + seed.temperature * 0.1, 0.3),
    soil_pct: Math.max(0, jitter(base.soil_pct * 0.95 + seed.soil * 0.05, 0.6)),
    rain: Math.random() < 0.04 ? 1 - base.rain : base.rain,
  };
}

function demoHistory(seed, now) {
  const out = [];
  let prev = null;
  for (let i = WINDOW - 1; i >= 0; i -= 1) {
    prev = demoReading(prev, seed, new Date(now - i * POLL_MS));
    out.push(prev);
  }
  return out;
}

// Polls GET /api/readings for one sensor box while `enabled`.
// Returns readings oldest-first plus live status. `onNew(reading)` fires for every reading
// that was not seen before, `onPoll()` after every successful poll — the architecture
// diagram animates those as data moving through Azure.
export function useLiveReadings(deviceId, { enabled, seed, onNew, onPoll }) {
  const [readings, setReadings] = useState([]);
  const [live, setLive] = useState(false);
  const [lastPollAt, setLastPollAt] = useState(null);
  const callbacks = useRef({ onNew, onPoll });
  callbacks.current = { onNew, onPoll };

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let latestTs = null;
    let demo = null;

    const startDemo = () => {
      if (demo) return;
      setLive(false);
      demo = demoHistory(seed, Date.now());
      latestTs = demo[demo.length - 1].deviceTimestamp;
      setReadings(demo);
    };

    const tickDemo = () => {
      const next = demoReading(demo[demo.length - 1], seed, new Date());
      demo = [...demo.slice(1 - WINDOW), next];
      setReadings(demo);
      setLastPollAt(new Date());
      callbacks.current.onNew?.(next);
      callbacks.current.onPoll?.();
    };

    const poll = async () => {
      if (!deviceId) return demo ? tickDemo() : startDemo();
      try {
        const list = await getReadings(deviceId, WINDOW);
        if (cancelled) return;
        const oldestFirst = [...list].reverse();
        const fresh = latestTs ? oldestFirst.filter((r) => r.deviceTimestamp > latestTs) : oldestFirst.slice(-1);
        if (oldestFirst.length) latestTs = oldestFirst[oldestFirst.length - 1].deviceTimestamp;
        demo = null;
        setLive(true);
        setReadings(oldestFirst);
        setLastPollAt(new Date());
        fresh.forEach((r) => callbacks.current.onNew?.(r));
        callbacks.current.onPoll?.();
      } catch (err) {
        if (cancelled) return;
        console.warn('readings fetch failed:', err.message);
        if (demo) tickDemo();
        else startDemo();
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // seed is only used for the demo fallback; restarting on every render would reset the stream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, enabled]);

  return { readings, live, lastPollAt };
}
