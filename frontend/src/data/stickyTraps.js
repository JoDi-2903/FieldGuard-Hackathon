import { FARMS, farmById } from './farms.js';

// Yellow sticky traps hang on the cassava farms; the officer photographs each
// card once a week and the app counts the whiteflies on it.
// Fake past counts for the demo, oldest first: `weeksAgo` keeps them recent
// whatever day the demo runs.
const SEED_COUNTS = {
  f03: [
    { weeksAgo: 3, count: 6 },
    { weeksAgo: 2, count: 9 },
    { weeksAgo: 1, count: 17 },
  ],
  f14: [
    { weeksAgo: 3, count: 4 },
    { weeksAgo: 2, count: 6 },
    { weeksAgo: 1, count: 5 },
  ],
};

// Whiteflies carry cassava mosaic only between cassava fields within flying range.
const NEIGHBOUR_RANGE = 110; // route-map grid units

export const isTrapFarm = (farmId) => farmById[farmId]?.crop === 'Cassava';

export function buildSeedTrapCounts(today = new Date()) {
  return Object.fromEntries(
    Object.entries(SEED_COUNTS).map(([farmId, weeks]) => [
      farmId,
      weeks.map(({ weeksAgo, count }) => ({ date: isoDate(daysBefore(today, weeksAgo * 7)), count, source: 'seed' })),
    ])
  );
}

export function neighbourCassavaFarmIds(farmId) {
  const farm = farmById[farmId];
  return FARMS.filter(
    (f) => f.id !== farmId && isTrapFarm(f.id) && (f.village === farm.village || distance(f.pos, farm.pos) <= NEIGHBOUR_RANGE)
  ).map((f) => f.id);
}

// Local calendar date, YYYY-MM-DD (toISOString would shift late-evening cards to UTC).
export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBefore = (d, days) => new Date(d.getTime() - days * 86400000);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
