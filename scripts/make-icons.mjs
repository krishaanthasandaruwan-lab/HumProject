// Generates every app icon procedurally (no image assets, no deps):
// PWA icons in public/; if android/ exists, launcher icons, adaptive icon layers and splash screens;
// if ios/ exists, the App Store icon (opaque RGB) and the launch-screen logo.
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
/** RGBA PNG, or RGB (no alpha channel — the App Store rejects icons that have one) when `rgb`. */
function png(w, h, rgba, rgb = false) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = rgb ? 2 : 6;
  const bpp = rgb ? 3 : 4;
  const raw = Buffer.alloc(h * (w * bpp + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < bpp; c++) raw[y * (w * bpp + 1) + 1 + x * bpp + c] = rgba[(y * w + x) * 4 + c];
    }
  }
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
// The mark: five square-ended ink bars at 40 / 70 / 100 / 65 / 35 % of the tallest (design spec C11).
const BARS = [0.28, 0.49, 0.70, 0.455, 0.245];

/**
 * @param w,h        pixel size
 * @param o.bg       'red' | 'paper' | 'none'
 * @param o.tile     null | { shape: 'rounded' | 'circle' | 'square' | 'full', size, border } — red tile behind the bars;
 *                   border = ink outline width as a fraction of the tile (the launch mark)
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
      const grad = () => [0xF0, 0x44, 0x3A]; // Stage Red
      if (o.bg === 'red') { [r, g, b] = grad(); a = 1; }
      else if (o.bg === 'paper') { r = 0xF6; g = 0xF4; b = 0xEF; a = 1; }
      if (o.tile) {
        let d;
        if (o.tile.shape === 'circle') d = Math.hypot(px - cx, py - cy) - tileHalf;
        else if (o.tile.shape === 'rounded') d = sdRoundBox(px, py, cx, cy, tileHalf, tileHalf, tileHalf * 0.44);
        else d = sdRoundBox(px, py, cx, cy, tileHalf, tileHalf, 0);
        const c = cover(d, 1);
        const [tr, tg, tb] = grad();
        r = mix(r, tr, c); g = mix(g, tg, c); b = mix(b, tb, c); a = Math.max(a, c);
        if (o.tile.border) {
          const ink = c * (1 - cover(d + o.tile.border * 2 * tileHalf, 1));
          r = mix(r, 0x11, ink); g = mix(g, 0x11, ink); b = mix(b, 0x11, ink);
        }
      }
      let fg = 0;
      for (let i = 0; i < BARS.length; i++) {
        const bx = cx - total / 2 + barW / 2 + i * (barW + gap);
        const hh = (BARS[i] * o.glyph * m) / 2;
        fg = Math.max(fg, cover(sdRoundBox(px, py, bx, cy, barW / 2, hh, 0), 1));
      }
      r = mix(r, 0x11, fg); g = mix(g, 0x11, fg); b = mix(b, 0x11, fg); a = Math.max(a, fg);
      const k = (y * w + x) * 4;
      out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = Math.round(a * 255);
    }
  }
  return png(w, h, out, o.opaque);
}
function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log('wrote', file);
}

// PWA
write('public/icon-192.png', draw(192, 192, { bg: 'none', tile: { shape: 'rounded', size: 1 }, glyph: 1 }));
write('public/icon-512.png', draw(512, 512, { bg: 'none', tile: { shape: 'rounded', size: 1 }, glyph: 1 }));
write('public/icon-maskable-512.png', draw(512, 512, { bg: 'red', glyph: 0.75 }));
write('public/apple-touch-icon.png', draw(180, 180, { bg: 'red', glyph: 0.85 }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#F0443A"/>
<g fill="#111111">${BARS.map((hh, i) => `<rect x="${(18.75 + i * 13.5).toFixed(2)}" y="${(50 - hh * 50).toFixed(2)}" width="8.5" height="${(hh * 100).toFixed(2)}"/>`).join('')}</g>
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
    write(`${RES}/mipmap-${d}/ic_launcher_background.png`, draw(adaptive, adaptive, { bg: 'red', glyph: 0 }));
    const [pw, ph] = [Math.round(320 * s), Math.round(480 * s)];
    write(`${RES}/drawable-port-${d}/splash.png`, draw(pw, ph, { bg: 'paper', tile: { shape: 'square', size: 0.34, border: 2 / 112 }, glyph: 0.34 }));
    write(`${RES}/drawable-land-${d}/splash.png`, draw(ph, pw, { bg: 'paper', tile: { shape: 'square', size: 0.34, border: 2 / 112 }, glyph: 0.34 }));
  }
  write(`${RES}/drawable/splash.png`, draw(480, 320, { bg: 'paper', tile: { shape: 'square', size: 0.34, border: 2 / 112 }, glyph: 0.34 }));
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
    <color name="ic_launcher_background">#F0443A</color>
</resources>
`);
}

// iOS (after `npx cap add ios`)
const XC = 'ios/App/App/Assets.xcassets';
if (existsSync(XC)) {
  // iOS rounds the corners itself: a full-bleed, opaque 1024 icon.
  write(`${XC}/AppIcon.appiconset/AppIcon-512@2x.png`, draw(1024, 1024, { bg: 'red', glyph: 0.85, opaque: true }));
  // Launch screen: the mark at exactly the size of the web splash (112 pt), centred on paper
  // (LaunchScreen.storyboard), so the hand-over to the web splash does not move it.
  const images = [1, 2, 3].map((s) => {
    const name = `splash@${s}x.png`;
    write(`${XC}/Splash.imageset/${name}`, draw(112 * s, 112 * s, { bg: 'none', tile: { shape: 'square', size: 1, border: 2 / 112 }, glyph: 1 }));
    return { idiom: 'universal', filename: name, scale: `${s}x` };
  });
  write(`${XC}/Splash.imageset/Contents.json`, JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
}
