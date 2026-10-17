// Counts whiteflies on a photo of a yellow sticky trap card — no ML.
//
// Whiteflies show up as small pale specks on the saturated yellow card. We find
// the card (HSV threshold + largest connected region, holes filled), find pale
// low-saturation specks inside it, keep the ones whose size fits a whitefly
// relative to the card, and split touching specks by area.
//
// Input: an ImageData-like object { data: RGBA bytes, width, height }.
// Output: { count, specks: [{ x, y, r, n }], quality: 'ok' | 'unclear', yellowAreaPct, reasons, width, height }.
// `n` is how many whiteflies one speck stands for (touching flies merge into one speck).

// Yellow card: hue 35–75°, clearly saturated, not in deep shadow.
const YELLOW_HUE = [35, 75];
const YELLOW_MIN_SAT = 0.4;
const YELLOW_MIN_VAL = 0.25;

// Pale speck: far less saturated than the card around it, not dark.
const PALE_MAX_SAT = 0.35;
const PALE_MIN_VAL = 0.3;

// Whitefly diameter as a share of the card side (a 1–2 mm fly on a 10–25 cm card).
const FLY_MIN_DIAMETER = 0.003;
const CLUSTER_MAX_DIAMETER = 0.06;
const MAX_FLIES_PER_SPECK = 6; // bigger pale blobs are glare or debris, not flies

// Photo quality limits.
const MIN_YELLOW_AREA_PCT = 10;
const MIN_CARD_BRIGHTNESS = 0.35;
const MIN_SHARPNESS = 24; // 99.9th-percentile gradient, 0–510 scale
const MAX_PLAUSIBLE_COUNT = 600;
const MAX_SPECK_COVER_PCT = 12;

export function countWhiteflies(image) {
  const pixels = measurePixels(image);
  const card = findYellowCardArea(pixels);
  const blobs = findPaleSpecks(pixels, card);
  const { specks, count } = filterBySize(blobs, card);
  const reasons = classifyPhotoQuality(pixels, card, specks);
  return {
    count,
    specks,
    quality: reasons.length ? 'unclear' : 'ok',
    yellowAreaPct: round1(card.areaPct),
    reasons,
    width: image.width,
    height: image.height,
  };
}

// Per-pixel saturation, value, grey level and a yellow flag.
function measurePixels({ data, width, height }) {
  const n = width * height;
  const sat = new Float32Array(n);
  const val = new Float32Array(n);
  const gray = new Float32Array(n);
  const isYellow = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sat[i] = max ? (max - min) / max : 0;
    val[i] = max / 255;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    isYellow[i] = sat[i] >= YELLOW_MIN_SAT && val[i] >= YELLOW_MIN_VAL && isYellowHue(r, g, b, max, min) ? 1 : 0;
  }
  return { width, height, sat, val, gray, isYellow };
}

function isYellowHue(r, g, b, max, min) {
  if (max === min || max === b) return false;
  const d = max - min;
  const hue = max === r ? 60 * (((g - b) / d + 6) % 6) : 60 * ((b - r) / d + 2);
  return hue >= YELLOW_HUE[0] && hue <= YELLOW_HUE[1];
}

// The card is the largest yellow region; specks and blobs inside it are holes we fill back in.
function findYellowCardArea(pixels) {
  const { width, height, isYellow } = pixels;
  const { labels, components } = labelComponents(isYellow, width, height);
  const largest = components.reduce((best, c) => (c.area > (best?.area ?? 0) ? c : best), null);
  const cardYellow = new Uint8Array(width * height);
  if (largest) for (let i = 0; i < labels.length; i++) if (labels[i] === largest.label) cardYellow[i] = 1;

  const inside = fillHoles(cardYellow, width, height);
  const area = countSet(inside);
  return {
    yellow: cardYellow,
    inside,
    area,
    areaPct: (100 * (largest?.area ?? 0)) / (width * height),
    side: Math.sqrt(area),
    brightness: medianWhere(pixels.val, cardYellow),
  };
}

// Pixels inside the card that are pale (low saturation) and not dark, grouped into blobs.
function findPaleSpecks(pixels, card) {
  const { width, height, sat, val } = pixels;
  const pale = new Uint8Array(width * height);
  if (!card.area) return [];
  for (let i = 0; i < pale.length; i++) {
    if (card.inside[i] && !card.yellow[i] && sat[i] <= PALE_MAX_SAT && val[i] >= PALE_MIN_VAL) pale[i] = 1;
  }
  return labelComponents(pale, width, height).components.map((c) => ({
    x: c.sumX / c.area,
    y: c.sumY / c.area,
    area: c.area,
  }));
}

// Drop specks too small to be a fly (noise) or too big (glare, debris); split touching flies by area.
function filterBySize(blobs, card) {
  const discArea = (diameterShare) => (Math.PI / 4) * (diameterShare * card.side) ** 2;
  const minArea = Math.max(4, discArea(FLY_MIN_DIAMETER));
  const maxArea = discArea(CLUSTER_MAX_DIAMETER);
  const sized = blobs.filter((b) => b.area >= minArea && b.area <= maxArea);
  const typicalArea = median(sized.map((b) => b.area));

  const specks = sized
    .map((b) => ({ ...b, n: Math.max(1, Math.round(b.area / typicalArea)) }))
    .filter((b) => b.n <= MAX_FLIES_PER_SPECK)
    .map((b) => ({ x: round1(b.x), y: round1(b.y), r: round1(Math.sqrt(b.area / Math.PI) + 2), n: b.n, area: b.area }));
  return { specks, count: specks.reduce((sum, s) => sum + s.n, 0) };
}

// Reasons the count can't be trusted; empty means the photo is fine.
function classifyPhotoQuality(pixels, card, specks) {
  const reasons = [];
  if (card.areaPct < MIN_YELLOW_AREA_PCT) return ['no-card'];
  if (card.brightness < MIN_CARD_BRIGHTNESS) reasons.push('too-dark');
  if (measureSharpness(pixels) < MIN_SHARPNESS) reasons.push('blurry');
  if (isImplausibleCount(specks, card)) reasons.push('implausible-count');
  return reasons;
}

function isImplausibleCount(specks, card) {
  const count = specks.reduce((sum, s) => sum + s.n, 0);
  const speckArea = specks.reduce((sum, s) => sum + s.area, 0);
  return count > MAX_PLAUSIBLE_COUNT || (100 * speckArea) / card.area > MAX_SPECK_COVER_PCT;
}

// Strongest edges in the photo: sharp photos have crisp card borders and speck edges.
function measureSharpness({ gray, width, height }) {
  const histogram = new Uint32Array(511);
  let total = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      const grad = Math.abs(gray[i + 1] - gray[i]) + Math.abs(gray[i + width] - gray[i]);
      histogram[Math.min(510, Math.round(grad))]++;
      total++;
    }
  }
  return percentileOfHistogram(histogram, total, 0.999);
}

// ---- generic helpers ----

// 8-connected components of a 0/1 mask. Returns per-pixel labels and per-component stats.
function labelComponents(mask, width, height) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const components = [];
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const c = { label: next, area: 0, sumX: 0, sumY: 0 };
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = next;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width;
      const y = (i - x) / width;
      c.area++;
      c.sumX += x;
      c.sumY += y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const j = ny * width + nx;
          if (mask[j] && !labels[j]) {
            labels[j] = next;
            queue[tail++] = j;
          }
        }
      }
    }
    components.push(c);
    next++;
  }
  return { labels, components };
}

// Everything not reachable from the photo border without crossing the region counts as inside.
function fillHoles(region, width, height) {
  const outside = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let tail = 0;
  const push = (i) => {
    if (!region[i] && !outside[i]) {
      outside[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < width * (height - 1)) push(i + width);
  }
  const inside = new Uint8Array(width * height);
  for (let i = 0; i < inside.length; i++) inside[i] = outside[i] ? 0 : 1;
  return inside;
}

function countSet(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

// Median of 0–1 values where mask is set (256-bin histogram).
function medianWhere(values, mask) {
  const histogram = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    if (mask[i]) {
      histogram[Math.round(values[i] * 255)]++;
      total++;
    }
  }
  return total ? percentileOfHistogram(histogram, total, 0.5) / 255 : 0;
}

function percentileOfHistogram(histogram, total, p) {
  const target = total * p;
  let seen = 0;
  for (let bin = 0; bin < histogram.length; bin++) {
    seen += histogram[bin];
    if (seen >= target) return bin;
  }
  return histogram.length - 1;
}

function median(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const round1 = (v) => Math.round(v * 10) / 10;
