import { useEffect, useState } from 'react';
import { buildSeedTrapCounts } from '../data/stickyTraps.js';

// Sticky-trap counts per farm: { f03: [{ date, count, source, photo? }, ...] }.
// Lives in React state; the officer's own counts are also kept in localStorage
// (never sent to the backend). The photo itself (a blob URL) stays in memory only.
const STORAGE_KEY = 'fieldguard.trapCounts.v1';

export function useTrapCounts() {
  const [trapCounts, setTrapCounts] = useState(loadTrapCounts);

  useEffect(() => saveOfficerCounts(trapCounts), [trapCounts]);

  // One card per farm per day: a new photo replaces today's earlier one.
  function addTrapReading(farmId, reading) {
    setTrapCounts((all) => ({
      ...all,
      [farmId]: [...(all[farmId] ?? []).filter((r) => r.date !== reading.date), reading].sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }

  return { trapCounts, addTrapReading };
}

function loadTrapCounts() {
  const merged = buildSeedTrapCounts();
  Object.entries(readStoredCounts()).forEach(([farmId, readings]) => {
    const dates = new Set(readings.map((r) => r.date));
    merged[farmId] = [...(merged[farmId] ?? []).filter((r) => !dates.has(r.date)), ...readings].sort((a, b) => a.date.localeCompare(b.date));
  });
  return merged;
}

function readStoredCounts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveOfficerCounts(trapCounts) {
  const officerCounts = Object.fromEntries(
    Object.entries(trapCounts)
      .map(([farmId, readings]) => [farmId, readings.filter((r) => r.source === 'photo').map(({ date, count, source }) => ({ date, count, source }))])
      .filter(([, readings]) => readings.length)
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(officerCounts));
  } catch {
    // Private mode or storage full: counts still live for this session.
  }
}
