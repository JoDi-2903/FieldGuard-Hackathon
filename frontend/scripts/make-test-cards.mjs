// Writes the printable demo cards (src/trap/testCards.js) to test-cards/*.png.
// Plain Node: a tiny PNG encoder on top of zlib, no extra dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { makeSyntheticCard } from '../src/trap/syntheticCard.js';
import { TEST_CARDS } from '../src/trap/testCards.js';

const OUT_DIR = new URL('../test-cards/', import.meta.url);

mkdirSync(OUT_DIR, { recursive: true });
for (const card of TEST_CARDS) {
  const { image, trueCount } = makeSyntheticCard(card.options);
  writeFileSync(new URL(card.file, OUT_DIR), encodePng(image));
  console.log(`${card.file}: ${trueCount} whiteflies`);
}

function encodePng({ data, width, height }) {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) rows[y * (width * 3 + 1) + 1 + x * 3 + c] = data[(y * width + x) * 4 + c];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
