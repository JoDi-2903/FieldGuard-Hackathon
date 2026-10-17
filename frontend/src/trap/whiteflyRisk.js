import { neighbourCassavaFarmIds } from '../data/stickyTraps.js';

// Whitefly counts only say how likely cassava mosaic is to spread — never that
// plants are infected. Thresholds are per card per week.
const FEW_WHITEFLIES = 10;
const RISING_FACTOR = 1.3;
const RISING_MIN_STEP = 5;
const MIN_DAYS_BETWEEN_CARDS = 5;

// Verdicts that mean the officer found sick plants.
const SICK_PLANT_OUTCOMES = ['treat', 'escalate'];

export const RISK_MESSAGES = {
  none: 'No trap counts yet — photograph the sticky card',
  low: 'Low risk from whiteflies',
  steady: 'Moderate risk — whiteflies present but not rising, keep checking the card weekly',
  rising: "Risk rising — check plants, watch next week's card",
  high: 'High risk of spread — remove sick plants now',
};

// Latest card vs. the last card from at least a week before it.
export function compareWithLastWeek(history = []) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = latest ? [...sorted].reverse().find((r) => daysBetween(r.date, latest.date) >= MIN_DAYS_BETWEEN_CARDS) ?? null : null;
  const change = latest && previous ? latest.count - previous.count : null;
  return { latest, previous, change, isRising: isRisingCount(latest, previous) };
}

export const isTrapRising = (history) => compareWithLastWeek(history).isRising;

export function assessWhiteflyRisk(history, hasSickPlantNearby) {
  const trend = compareWithLastWeek(history);
  const level = chooseRiskLevel(trend, hasSickPlantNearby);
  return { ...trend, level, message: RISK_MESSAGES[level] };
}

// A saved verdict of "Treatment" or "Escalate" on this farm or a neighbouring cassava farm.
export function hasSickPlantNearby(farmId, records) {
  return [farmId, ...neighbourCassavaFarmIds(farmId)].some((id) => hasSickPlantVerdict(records[id]));
}

function chooseRiskLevel({ latest, isRising }, sickNearby) {
  if (!latest) return 'none';
  if (latest.count <= FEW_WHITEFLIES) return 'low';
  if (!isRising) return 'steady';
  return sickNearby ? 'high' : 'rising';
}

function isRisingCount(latest, previous) {
  if (!latest || !previous || latest.count <= FEW_WHITEFLIES) return false;
  return latest.count >= previous.count * RISING_FACTOR && latest.count - previous.count >= RISING_MIN_STEP;
}

function hasSickPlantVerdict(record) {
  const verdict = record?.verdict;
  return Boolean(verdict?.savedAt && SICK_PLANT_OUTCOMES.includes(verdict.outcome));
}

const daysBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400000;
