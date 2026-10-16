import { useEffect, useRef, useState } from 'react';
import { getRisk } from '../api/client.js';

const POLL_MS = 20000;

// Polls GET /api/risk and returns the latest risk per backend field id, keyed by
// fieldId: { 'field-b': { color, score, reasoning, recommended_action, ... } }.
// Returns {} until the first successful fetch, and keeps the last good value if a
// later poll fails — so the dashboard degrades to its static plan when offline.
export function useLiveRisk() {
  const [risk, setRisk] = useState({});
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await getRisk();
        if (cancelled) return;
        setRisk(Object.fromEntries(list.map((r) => [r.fieldId, r])));
      } catch (err) {
        if (!cancelled) console.warn('risk fetch failed:', err.message);
      }
    };
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer.current);
    };
  }, []);

  return risk;
}
