import { describe, expect, it } from 'vitest';
import { countWhiteflies } from './countWhiteflies.js';
import { makeSyntheticCard } from './syntheticCard.js';
import { TEST_CARDS } from './testCards.js';

const isWithin10Pct = (count, truth) => Math.abs(count - truth) <= Math.round(truth * 0.1);

describe('countWhiteflies — clean cards', () => {
  it.each([0, 10, 50, 150])('counts %i white dots within ±10%', (dots) => {
    const { image, trueCount } = makeSyntheticCard({ dots, seed: dots + 7 });
    const result = countWhiteflies(image);
    expect(trueCount).toBe(dots);
    expect(isWithin10Pct(result.count, trueCount)).toBe(true);
    expect(result.quality).toBe('ok');
    expect(result.yellowAreaPct).toBeGreaterThan(50);
    expect(result.specks.length).toBeGreaterThanOrEqual(Math.floor(dots * 0.9));
  });
});

describe('countWhiteflies — hard photos', () => {
  it('handles a shadow gradient across the card', () => {
    const { image, trueCount } = makeSyntheticCard({ dots: 50, shadow: true, seed: 11 });
    const result = countWhiteflies(image);
    expect(isWithin10Pct(result.count, trueCount)).toBe(true);
    expect(result.quality).toBe('ok');
  });

  it('splits touching dots by area', () => {
    const { image, trueCount } = makeSyntheticCard({ dots: 30, touchingPairs: 10, seed: 12 });
    expect(trueCount).toBe(50);
    const result = countWhiteflies(image);
    expect(isWithin10Pct(result.count, trueCount)).toBe(true);
  });

  it('ignores a finger and a dark blob at the card edge', () => {
    const { image, trueCount } = makeSyntheticCard({ dots: 40, finger: true, darkBlob: true, seed: 13 });
    const result = countWhiteflies(image);
    expect(isWithin10Pct(result.count, trueCount)).toBe(true);
    expect(result.quality).toBe('ok');
  });

  it('marks a photo with no yellow card as unclear', () => {
    const { image } = makeSyntheticCard({ dots: 40, noCard: true, seed: 14 });
    const result = countWhiteflies(image);
    expect(result.quality).toBe('unclear');
    expect(result.reasons).toContain('no-card');
  });

  it('marks a card too small in the photo as unclear', () => {
    const { image } = makeSyntheticCard({ dots: 5, margin: 0.38, seed: 15 });
    expect(countWhiteflies(image).quality).toBe('unclear');
  });

  it('marks a too-dark photo as unclear', () => {
    const { image } = makeSyntheticCard({ dots: 30, dark: true, seed: 16 });
    const result = countWhiteflies(image);
    expect(result.quality).toBe('unclear');
    expect(result.reasons).toContain('too-dark');
  });

  it('marks a blurry photo as unclear', () => {
    const { image } = makeSyntheticCard({ dots: 30, blur: 3, seed: 17 });
    const result = countWhiteflies(image);
    expect(result.quality).toBe('unclear');
    expect(result.reasons).toContain('blurry');
  });

  it('marks an implausible count as unclear', () => {
    const { image } = makeSyntheticCard({ width: 1000, height: 800, dots: 900, seed: 18 });
    const result = countWhiteflies(image);
    expect(result.quality).toBe('unclear');
    expect(result.reasons).toContain('implausible-count');
  });
});

describe('printable demo cards (test-cards/*.png)', () => {
  it.each(TEST_CARDS)('$file counts $dots whiteflies', (card) => {
    const { image, trueCount } = makeSyntheticCard(card.options);
    const result = countWhiteflies(image);
    expect(trueCount).toBe(card.dots);
    expect(isWithin10Pct(result.count, trueCount)).toBe(true);
    expect(result.quality).toBe('ok');
  });
});
