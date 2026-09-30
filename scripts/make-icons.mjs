// Generates the PWA / store icons procedurally (no image assets, no deps).
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
// Signed distance to a rounded box centred at (cx, cy).
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const mix = (a, b, t) => a + (b - a) * t;
function draw(size, { fullBleed, safeScale }) {
  const out = Buffer.alloc(size * size * 4);
  const bars = [0.30, 0.52, 0.70, 0.52, 0.30];
  const s = safeScale; // shrink the glyph for maskable safe zone
  const barW = 0.085 * s, gap = 0.05 * s;
  const total = bars.length * barW + (bars.length - 1) * gap;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size, py = (y + 0.5) / size;
      const px1 = 1 / size;
      const bgD = fullBleed ? -1 : sdRoundBox(px, py, 0.5, 0.5, 0.5, 0.5, 0.22);
      const bgA = Math.min(1, Math.max(0, 0.5 - bgD / px1));
      if (bgA <= 0) continue;
      const t = (px + py) / 2; // diagonal gradient purple -> pink
      let r = mix(0x7c, 0xff, t), g = mix(0x5c, 0x4d, t), b = mix(0xff, 0x6d, t);
      let fg = 0;
      for (let i = 0; i < bars.length; i++) {
        const cx = 0.5 - total / 2 + barW / 2 + i * (barW + gap);
        const hh = (bars[i] * s) / 2;
        const d = sdRoundBox(px, py, cx, 0.5, barW / 2, hh, barW / 2);
        fg = Math.max(fg, Math.min(1, Math.max(0, 0.5 - d / px1)));
      }
      r = mix(r, 255, fg); g = mix(g, 255, fg); b = mix(b, 255, fg);
      const o = (y * size + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(bgA * 255);
    }
  }
  return png(size, out);
}
const targets = [
  ['public/icon-192.png', 192, { fullBleed: false, safeScale: 1 }],
  ['public/icon-512.png', 512, { fullBleed: false, safeScale: 1 }],
  ['public/icon-maskable-512.png', 512, { fullBleed: true, safeScale: 0.75 }],
  ['public/apple-touch-icon.png', 180, { fullBleed: true, safeScale: 0.85 }],
];
for (const [file, size, opts] of targets) {
  writeFileSync(file, draw(size, opts));
  console.log('wrote', file);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff4d6d"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<g fill="#fff">${[0.3, 0.52, 0.7, 0.52, 0.3].map((h, i) => `<rect x="${(20.75 + i * 13.5).toFixed(2)}" y="${(50 - h * 50).toFixed(2)}" width="8.5" height="${(h * 100).toFixed(2)}" rx="4.25"/>`).join('')}</g>
</svg>
`;
writeFileSync('public/favicon.svg', svg);
console.log('wrote public/favicon.svg');
