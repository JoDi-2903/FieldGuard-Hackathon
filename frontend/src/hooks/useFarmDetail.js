import { useEffect, useRef, useState } from 'react';
import { farmDetails } from '../data/farmDetails.js';
import { fieldIdForFarm } from '../data/farmFieldMap.js';
import { getFarmDetail } from '../api/client.js';

// Poll cadence for the latest sensor dataset. Ingest is ~5 min, scoring ~20 min,
// so a 20 s poll keeps the profile fresh without hammering the API.
const POLL_MS = 20000;

// Overlay live backend detail onto the static scaffold. Sensors/freshness come
// straight from readings; the AI-generated content (disease, alerts, call, steps)
// only takes over once the field has actually been scored (live.risk present),
// so an un-scored field still shows the hand-authored placeholder.
function merge(base, live) {
  const merged = { ...(base ?? {}) };
  if (live.sensors) merged.sensors = live.sensors;
  if (live.sensorNote) merged.sensorNote = live.sensorNote;
  if (live.sensorsUpdated) merged.sensorsUpdated = live.sensorsUpdated;
  if (live.stage) merged.stage = live.stage;
  if (live.risk) {
    if (live.disease) merged.disease = live.disease;
    merged.alerts = live.alerts ?? [];
    if (live.call) merged.call = live.call;
    if (live.steps && live.steps.length) merged.steps = live.steps;
  }
  return merged;
}

// Returns the farm detail for `farmId`. For a sensor-backed farm it fetches the
// backend's aggregated detail, polls it, and merges it over the static scaffold;
// for an unmapped farm it returns the static detail unchanged. `live` is true
// once backend data has been applied.
export function useFarmDetail(farmId) {
  const fieldId = fieldIdForFarm(farmId);
  const [details, setDetails] = useState(() => farmDetails(farmId));
  const [live, setLive] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setDetails(farmDetails(farmId));
    setLive(false);
    if (!fieldId) return undefined; // unmapped farm -> static scaffold only

    let cancelled = false;
    const load = async () => {
      try {
        const liveDetail = await getFarmDetail(fieldId);
        if (cancelled) return;
        setDetails(merge(farmDetails(farmId), liveDetail));
        setLive(true);
      } catch (err) {
        // Keep whatever we already show (static base or last good live) and retry.
        if (!cancelled) console.warn('farm detail fetch failed:', err.message);
      }
    };
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer.current);
    };
  }, [farmId, fieldId]);

  return { details, live };
}
