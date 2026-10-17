// Draws fake yellow sticky cards with a known number of white "whiteflies".
// Used by the tests and by scripts/make-test-cards.mjs (printable demo cards).
// Returns { image: { data, width, height }, trueCount }.

const BACKGROUND = [58, 52, 46];
const CARD_YELLOW = [236, 206, 28];
const LEAF_GREEN = [70, 120, 40];
const FLY_WHITE = [242, 242, 232];
const SKIN = [205, 150, 120];
const DIRT = [35, 28, 22];

export function makeSyntheticCard({
  width = 800,
  height = 600,
  dots = 0,
  touchingPairs = 0,
  seed = 1,
  margin = 0.1,
  background = BACKGROUND,
  noCard = false,
  shadow = false,
  finger = false,
  darkBlob = false,
  dark = false,
  blur = 0,
  noise = 6,
}) {
  const random = mulberry32(seed);
  const image = { data: new Uint8ClampedArray(width * height * 4), width, height };
  const card = cardRect(width, height, margin);
  const occluders = buildOccluders(card, width, { finger, darkBlob });
  const flyRadius = Math.max(2.5, Math.sqrt(card.w * card.h) * 0.007);

  fillRect(image, { x: 0, y: 0, w: width, h: height }, background);
  fillRect(image, card, noCard ? LEAF_GREEN : CARD_YELLOW);
  const flies = placeFlies(random, card, occluders, flyRadius, dots, touchingPairs);
  flies.forEach((f) => drawDisc(image, f.x, f.y, f.r, FLY_WHITE));
  occluders.forEach((o) => drawEllipse(image, o, o.color));

  if (shadow) applyShadowGradient(image);
  if (dark) scaleBrightness(image, 0.33);
  if (noise) addNoise(image, random, noise);
  for (let i = 0; i < blur; i++) boxBlur(image, 2);
  return { image, trueCount: flies.length };
}

function cardRect(width, height, margin) {
  const x = Math.round(width * margin);
  const y = Math.round(height * margin);
  return { x, y, w: width - 2 * x, h: height - 2 * y };
}

// A finger reaching in from the right photo border, and a dark smudge on the card's left edge.
function buildOccluders(card, width, { finger, darkBlob }) {
  const list = [];
  if (finger) list.push({ cx: width, cy: card.y + card.h * 0.5, rx: width * 0.25, ry: card.h * 0.12, color: SKIN });
  if (darkBlob) list.push({ cx: card.x, cy: card.y + card.h * 0.3, rx: card.w * 0.07, ry: card.w * 0.07, color: DIRT });
  return list;
}

// Random, non-overlapping flies inside the card (away from its edges and from occluders).
// Each touching pair is two flies whose discs overlap slightly, so they merge into one speck.
function placeFlies(random, card, occluders, r, singles, pairs) {
  const flies = [];
  const pad = r * 3;
  const isFree = (x, y, reach) =>
    flies.every((f) => Math.hypot(f.x - x, f.y - y) > reach + f.r + 3) &&
    occluders.every((o) => ((x - o.cx) / (o.rx + pad)) ** 2 + ((y - o.cy) / (o.ry + pad)) ** 2 > 1);
  const randomSpot = () => ({ x: card.x + pad + random() * (card.w - 2 * pad), y: card.y + pad + random() * (card.h - 2 * pad) });

  for (let placed = 0, tries = 0; placed < pairs && tries < 20000; tries++) {
    const p = randomSpot();
    if (!isFree(p.x, p.y, r * 2)) continue;
    flies.push({ x: p.x - r * 0.8, y: p.y, r }, { x: p.x + r * 0.8, y: p.y, r });
    placed++;
  }
  for (let placed = 0, tries = 0; placed < singles && tries < 20000; tries++) {
    const p = randomSpot();
    const fr = r * (0.85 + random() * 0.3);
    if (!isFree(p.x, p.y, fr)) continue;
    flies.push({ x: p.x, y: p.y, r: fr });
    placed++;
  }
  return flies;
}

function fillRect(image, { x, y, w, h }, rgb) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(image, xx, yy, rgb);
}

// Disc with a half-blended rim, like a slightly soft photo of a fly.
function drawDisc(image, cx, cy, r, rgb) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) setPixel(image, x, y, rgb);
      else if (d <= r + 1) blendPixel(image, x, y, rgb, 0.5);
    }
  }
}

function drawEllipse(image, { cx, cy, rx, ry }, rgb) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) setPixel(image, x, y, rgb);
    }
  }
}

// Light from the left: the right side of the photo is about half as bright.
function applyShadowGradient(image) {
  const { data, width, height } = image;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const f = 1 - 0.55 * (x / width);
      for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] *= f;
    }
  }
}

function scaleBrightness({ data }, f) {
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] *= f;
}

function addNoise({ data }, random, amount) {
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] += (random() * 2 - 1) * amount;
}

// Separable box blur of radius r (one pass ≈ a light out-of-focus blur).
function boxBlur(image, r) {
  const { data, width, height } = image;
  const src = new Float32Array(data);
  const tmp = new Float32Array(data.length);
  const pass = (from, to, horizontal) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let n = 0;
          for (let k = -r; k <= r; k++) {
            const xx = horizontal ? x + k : x;
            const yy = horizontal ? y : y + k;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            sum += from[(yy * width + xx) * 4 + c];
            n++;
          }
          to[(y * width + x) * 4 + c] = sum / n;
        }
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, src, false);
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = src[i + c];
}

function setPixel({ data, width, height }, x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
}

function blendPixel({ data, width, height }, x, y, rgb, t) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - t) + rgb[c] * t;
}

// Small seeded PRNG so every generated card is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
