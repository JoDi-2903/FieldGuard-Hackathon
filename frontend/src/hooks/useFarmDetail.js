import { useEffect, useRef, useState } from 'react';
import { farmDetails, SENSOR_META } from '../data/farmDetails.js';
import { fieldIdForFarm } from '../data/farmFieldMap.js';
import { getFarmDetail } from '../api/client.js';

// Poll cadence for the latest sensor dataset. box-01 posts every 2 s, so we match
// that cadence here so tile values update as fast as the Arduino sends.
const POLL_MS = 2000;

// The Finding on the farm profile: the AI reasoning as headline, plus one line per
// sensor that is out of range (same order and colours as the KPI tiles).
function liveFinding(live) {
  const reasons = Object.entries(live.sensors ?? {})
    .filter(([, s]) => s.status !== 'ok')
    .map(([id, s]) => ({
      status: s.status,
      label: SENSOR_META[id]?.label ?? id,
      text: `**${s.value} ${SENSOR_META[id]?.unit ?? ''}**. ${undash(s.note)}`,
    }));
  return { title: live.risk.reasoning, reasons };
}

const undash = (text) => String(text ?? '').replace(/\s+[—–-]\s+/g, ', ');

// Call header from the model looks like "Farmer hotline - 15 Oct, 07:40 - 0:52 - translated";
// the profile shows only the source and time.
function shortMeta(meta) {
  if (!meta) return meta;
  return meta.split(/\s+[-·–—]\s+/).slice(0, 2).join(' · ');
}

// Overlay live backend detail onto the static scaffold. Sensors/freshness come
// straight from readings; the AI-generated content (disease, alerts, call, steps)
// only takes over once the field has actually been scored (live.risk present),
// so an un-scored field still shows the hand-authored placeholder.
function merge(base, live) {
  const merged = { ...(base ?? {}) };
  // backend notes use dashes ("Above 90 % — leaf-wetness risk"); the UI style avoids them
  if (live.sensors) {
    merged.sensors = Object.fromEntries(
      Object.entries(live.sensors).map(([id, s]) => [id, { ...s, note: undash(s.note) }])
    );
  }
  if (live.sensorNote) merged.sensorNote = live.sensorNote;
  if (live.sensorsUpdated) merged.sensorsUpdated = live.sensorsUpdated;
  // backend stage ends with the crop ("Planted 12 Aug · 9 weeks · maize"); the card shows the crop already
  if (live.stage) merged.stage = live.crop ? live.stage.replace(new RegExp(` · ${live.crop}$`, 'i'), '') : live.stage;
  if (live.risk) {
    merged.risk = live.risk;
    merged.disease = live.disease ?? null;
    merged.alerts = live.alerts ?? [];
    if (live.risk.reasoning) merged.finding = liveFinding(live);
    if (live.call) {
      merged.call = { ...live.call, meta: shortMeta(live.call.meta) };
      merged.calls = [merged.call]; // the backend stores one call per scoring run
    }
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
