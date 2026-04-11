/**
 * Generates placeholder PWA icons (solid slate-900 background).
 * Replace icons in public/icons/ with branded versions before launch.
 *
 * Run: pnpm tsx scripts/generate-icons.ts
 */

import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Creates a minimal solid-color RGB PNG with an "C" label region. */
function makeSolidPng(size: number, bg: [number, number, number]): Buffer {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth=8, color type=2 (RGB), compress=0, filter=0, interlace=0
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Build scanlines: [filter_byte=0, R, G, B, R, G, B, ...] × height
  const [r, g, b] = bg;
  // Accent color for the "C" letter area (lighter slate)
  const [lr, lg, lb] = [148, 163, 184]; // slate-400

  // Simple bitmap "C" centered — 5×7 pixel grid scaled up
  const C_PATTERN = [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ];
  const LETTER_W = 5;
  const LETTER_H = 7;
  const SCALE = Math.floor(size / 16);
  const scaledW = LETTER_W * SCALE;
  const scaledH = LETTER_H * SCALE;
  const offsetX = Math.floor((size - scaledW) / 2);
  const offsetY = Math.floor((size - scaledH) / 2);

  function isLetterPixel(px: number, py: number): boolean {
    if (px < offsetX || py < offsetY) return false;
    const lx = Math.floor((px - offsetX) / SCALE);
    const ly = Math.floor((py - offsetY) / SCALE);
    if (lx >= LETTER_W || ly >= LETTER_H) return false;
    return C_PATTERN[ly][lx] === 1;
  }

  const rowSize = 1 + size * 3;
  const raw = Buffer.allocUnsafe(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const off = y * rowSize + 1 + x * 3;
      if (isLetterPixel(x, y)) {
        raw[off] = lr;
        raw[off + 1] = lg;
        raw[off + 2] = lb;
      } else {
        raw[off] = r;
        raw[off + 1] = g;
        raw[off + 2] = b;
      }
    }
  }

  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdrData),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Slate-900: #0f172a = rgb(15, 23, 42)
const bg: [number, number, number] = [15, 23, 42];

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", makeSolidPng(192, bg));
writeFileSync("public/icons/icon-512.png", makeSolidPng(512, bg));
writeFileSync("public/icons/maskable-512.png", makeSolidPng(512, bg));

console.log("✓ Generated public/icons/icon-192.png");
console.log("✓ Generated public/icons/icon-512.png");
console.log("✓ Generated public/icons/maskable-512.png");
console.log("");
console.log("Replace these with branded icons before launch.");
