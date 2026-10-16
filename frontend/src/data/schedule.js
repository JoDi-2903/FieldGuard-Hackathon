import { farmById } from './farms.js';

// Times are minutes after midnight.
export const DAY_START = 8 * 60;
export const DAY_END = 16 * 60;

// Driving takes about twice as long on wet dirt roads.
export const RAINY_SEASON = false;
const TRAVEL_FACTOR = RAINY_SEASON ? 2 : 1;

// Turns the plan into a timeline of drive + visit events, starting at the field office.
export function buildDay(plan) {
  let t = DAY_START;
  const events = [];
  const visits = [];

  plan.visits.forEach((v, i) => {
    const farm = farmById[v.farmId];
    const drive = v.travelMin * TRAVEL_FACTOR;
    events.push({ kind: 'travel', id: `drive-${i}`, start: t, end: t + drive, km: v.travelKm, to: farm.name });
    t += drive;

    const visit = { ...v, kind: 'visit', id: v.farmId, farm, order: i + 1, start: t, end: t + v.durationMin };
    events.push(visit);
    visits.push(visit);
    t = visit.end;
  });

  const back = plan.returnTravelMin * TRAVEL_FACTOR;
  events.push({ kind: 'travel', id: 'drive-back', start: t, end: t + back, km: plan.returnTravelKm, to: 'Field office' });
  t += back;

  const totalKm = plan.visits.reduce((sum, v) => sum + v.travelKm, plan.returnTravelKm);
  return { events, visits, backAt: t, totalKm };
}

export function formatTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
