// The printable demo cards in test-cards/ (written by `npm run test-cards`).
// A white paper border around the yellow card, like a printout photographed on a table.
const PRINT = { width: 1500, height: 1000, margin: 0.04, background: [255, 255, 255], noise: 0 };

export const TEST_CARDS = [
  { file: 'card-08-whiteflies.png', dots: 8, options: { ...PRINT, dots: 8, seed: 108 } },
  { file: 'card-35-whiteflies.png', dots: 35, options: { ...PRINT, dots: 35, seed: 135 } },
  { file: 'card-120-whiteflies.png', dots: 120, options: { ...PRINT, dots: 120, seed: 220 } },
];
