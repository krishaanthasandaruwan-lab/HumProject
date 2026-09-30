// Generates every app icon procedurally (no image assets, no deps):
// PWA icons in public/, and — if android/ exists — launcher icons, adaptive icon layers and splash screens.
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

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
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const mix = (a, b, t) => a + (b - a) * t;
const cover = (d, px) => Math.min(1, Math.max(0, 0.5 - d / px));
const BARS = [0.30, 0.52, 0.70, 0.52, 0.30];

/**
 * @param w,h        pixel size
 * @param o.bg       'gradient' | 'dark' | 'none'
 * @param o.tile     null | { shape: 'rounded' | 'circle' | 'full', size } — gradient tile behind the bars
 * @param o.glyph    bars size relative to min(w, h)
 */
function draw(w, h, o) {
  const out = Buffer.alloc(w * h * 4);
  const m = Math.min(w, h);
  const cx = w / 2, cy = h / 2;
  const barW = 0.085 * o.glyph * m, gap = 0.05 * o.glyph * m;
  const total = BARS.length * barW + (BARS.length - 1) * gap;
  const tileHalf = o.tile ? (o.tile.size * m) / 2 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5;
      let r = 0, g = 0, b = 0, a = 0;
      const grad = (u, v) => {
        const t = Math.min(1, Math.max(0, (u + v) / 2));
        return [mix(0x7c, 0xff, t), mix(0x5c, 0x4d, t), mix(0xff, 0x6d, t)];
      };
      if (o.bg === 'gradient') { [r, g, b] = grad(px / w, py / h); a = 1; }
      else if (o.bg === 'dark') { r = 0x0e; g = 0x0f; b = 0x13; a = 1; }
      if (o.tile) {
        let d;
        if (o.tile.shape === 'circle') d = Math.hypot(px - cx, py - cy) - tileHalf;
        else if (o.tile.shape === 'rounded') d = sdRoundBox(px, py, cx, cy, tileHalf, tileHalf, tileHalf * 0.44);
        else d = sdRoundBox(px, py, cx, cy, tileHalf, tileHalf, 0);
        const c = cover(d, 1);
        const [tr, tg, tb] = grad((px - cx + tileHalf) / (2 * tileHalf), (py - cy + tileHalf) / (2 * tileHalf));
        r = mix(r, tr, c); g = mix(g, tg, c); b = mix(b, tb, c); a = Math.max(a, c);
      }
      let fg = 0;
      for (let i = 0; i < BARS.length; i++) {
        const bx = cx - total / 2 + barW / 2 + i * (barW + gap);
        const hh = (BARS[i] * o.glyph * m) / 2;
        fg = Math.max(fg, cover(sdRoundBox(px, py, bx, cy, barW / 2, hh, barW / 2), 1));
      }
      r = mix(r, 255, fg); g = mix(g, 255, fg); b = mix(b, 255, fg); a = Math.max(a, fg);
      const k = (y * w + x) * 4;
      out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = Math.round(a * 255);
    }
  }
  return png(w, h, out);
}
function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log('wrote', file);
}

// PWA
write('public/icon-192.png', draw(192, 192, { bg: 'none', tile: { shape: 'rounded', size: 1 }, glyph: 1 }));
write('public/icon-512.png', draw(512, 512, { bg: 'none', tile: { shape: 'rounded', size: 1 }, glyph: 1 }));
write('public/icon-maskable-512.png', draw(512, 512, { bg: 'gradient', glyph: 0.75 }));
write('public/apple-touch-icon.png', draw(180, 180, { bg: 'gradient', glyph: 0.85 }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff4d6d"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<g fill="#fff">${BARS.map((hh, i) => `<rect x="${(20.75 + i * 13.5).toFixed(2)}" y="${(50 - hh * 50).toFixed(2)}" width="8.5" height="${(hh * 100).toFixed(2)}" rx="4.25"/>`).join('')}</g>
</svg>
`;
write('public/favicon.svg', svg);

// Android (after `npx cap add android`)
const RES = 'android/app/src/main/res';
if (existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, s] of Object.entries(dens)) {
    const legacy = Math.round(48 * s), adaptive = Math.round(108 * s);
    write(`${RES}/mipmap-${d}/ic_launcher.png`, draw(legacy, legacy, { bg: 'none', tile: { shape: 'rounded', size: 0.84 }, glyph: 0.84 }));
    write(`${RES}/mipmap-${d}/ic_launcher_round.png`, draw(legacy, legacy, { bg: 'none', tile: { shape: 'circle', size: 0.92 }, glyph: 0.8 }));
    write(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, draw(adaptive, adaptive, { bg: 'none', glyph: 0.52 }));
    write(`${RES}/mipmap-${d}/ic_launcher_background.png`, draw(adaptive, adaptive, { bg: 'gradient', glyph: 0 }));
    const [pw, ph] = [Math.round(320 * s), Math.round(480 * s)];
    write(`${RES}/drawable-port-${d}/splash.png`, draw(pw, ph, { bg: 'dark', tile: { shape: 'rounded', size: 0.34 }, glyph: 0.28 }));
    write(`${RES}/drawable-land-${d}/splash.png`, draw(ph, pw, { bg: 'dark', tile: { shape: 'rounded', size: 0.34 }, glyph: 0.28 }));
  }
  write(`${RES}/drawable/splash.png`, draw(480, 320, { bg: 'dark', tile: { shape: 'rounded', size: 0.34 }, glyph: 0.28 }));
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  write(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptiveXml);
  write(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptiveXml);
  write(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#7C5CFF</color>
</resources>
`);
}
