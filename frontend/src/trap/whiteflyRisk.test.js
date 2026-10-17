import { describe, expect, it } from 'vitest';
import { assessWhiteflyRisk, hasSickPlantNearby, isTrapRising, RISK_MESSAGES } from './whiteflyRisk.js';

const weeks = (...counts) => counts.map((count, i) => ({ date: `2026-10-${String(1 + i * 7).padStart(2, '0')}`, count }));
const sickVerdict = { verdict: { outcome: 'treat', savedAt: new Date() } };

describe('whitefly risk', () => {
  it('few whiteflies → low risk', () => {
    expect(assessWhiteflyRisk(weeks(4, 6, 8), false).message).toBe(RISK_MESSAGES.low);
  });

  it('rising, no sick plants → risk rising', () => {
    const risk = assessWhiteflyRisk(weeks(9, 17, 35), false);
    expect(risk.message).toBe("Risk rising — check plants, watch next week's card");
    expect(risk.change).toBe(18);
  });

  it('rising + sick plants nearby → high risk of spread', () => {
    expect(assessWhiteflyRisk(weeks(17, 35), true).message).toBe('High risk of spread — remove sick plants now');
  });

  it('many but steady → moderate, not rising', () => {
    const risk = assessWhiteflyRisk(weeks(30, 32), true);
    expect(risk.level).toBe('steady');
    expect(isTrapRising(weeks(30, 32))).toBe(false);
  });

  it('never says infected', () => {
    Object.values(RISK_MESSAGES).forEach((m) => expect(m.toLowerCase()).not.toContain('infected'));
  });

  it('counts a saved Treatment verdict on a neighbouring cassava farm', () => {
    expect(hasSickPlantNearby('f03', {})).toBe(false);
    expect(hasSickPlantNearby('f03', { f14: sickVerdict })).toBe(true);
    expect(hasSickPlantNearby('f03', { f02: sickVerdict })).toBe(false); // potatoes, not cassava
    expect(hasSickPlantNearby('f03', { f03: { verdict: { outcome: 'treat' } } })).toBe(false); // not saved yet
  });
});
