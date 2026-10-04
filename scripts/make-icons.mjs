// Generates every icon (no deps): the app icon — the "Hm" brush mark in Ink on Stage Red, drawn from
// design/icon/hm-mark.pgm (see make-icon-mark.mjs) — for the PWA, Android launcher and adaptive layers
// and the App Store (opaque RGB); and Android's plain paper splash (no logo — the app opens on the mic).
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
/** A plain Paper (#F6F4EF) image: Android's launch splash, the same colour the app opens on. */
function paper(w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let k = 0; k < out.length; k += 4) { out[k] = 0xF6; out[k + 1] = 0xF4; out[k + 2] = 0xEF; out[k + 3] = 255; }
  return png(w, h, out, true);
}
function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log('wrote', file);
}

// ---- The app icon: the "Hm" brush mark (design/icon/hm-mark.pgm, made by make-icon-mark.mjs from the
// reference) in Ink on Stage Red — the app's two colours.
function loadMark(file) {
  const buf = readFileSync(file);
  const head = buf.toString('latin1', 0, 64).match(/^P5\s+(\d+)\s+(\d+)\s+255\s/);
  const [mw, mh] = [Number(head[1]), Number(head[2])];
  const data = buf.subarray(head[0].length);
  // Optical centre: halfway between the box centre and the ink's centre of mass.
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { const v = data[y * mw + x]; sx += v * x; sy += v * y; n += v; }
  return { w: mw, h: mh, data, cx: (mw / 2 + sx / n) / 2, cy: (mh / 2 + sy / n) / 2 };
}
const MARK = loadMark('design/icon/hm-mark.pgm');
function markAt(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= MARK.w || yy >= MARK.h ? 0 : MARK.data[yy * MARK.w + xx] / 255);
  return mix(mix(at(x0, y0), at(x0 + 1, y0), fx), mix(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx), fy);
}

/**
 * @param o.bg     'red' (full bleed) | 'none'
 * @param o.tile   null | { shape: 'rounded' | 'circle', size } — red tile behind the mark
 * @param o.mark   the mark's width as a share of min(w, h)
 */
function drawIcon(w, h, o) {
  const out = Buffer.alloc(w * h * 4);
  const m = Math.min(w, h);
  const scale = (o.mark * m) / MARK.w; // icon px per mask px
  const step = 1 / scale;
  const ss = Math.max(1, Math.min(4, Math.ceil(step))); // supersample when shrinking
  const tileHalf = o.tile ? (o.tile.size * m) / 2 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5;
      let a = o.bg === 'red' ? 1 : 0;
      if (o.tile) {
        const d = o.tile.shape === 'circle'
          ? Math.hypot(px - w / 2, py - h / 2) - tileHalf
          : sdRoundBox(px, py, w / 2, h / 2, tileHalf, tileHalf, tileHalf * 0.44);
        a = Math.max(a, cover(d, 1));
      }
      let fg = 0;
      for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
        const qx = x + (i + 0.5) / ss, qy = y + (j + 0.5) / ss;
        fg += markAt((qx - w / 2) / scale + MARK.cx - 0.5, (qy - h / 2) / scale + MARK.cy - 0.5);
      }
      fg /= ss * ss;
      const k = (y * w + x) * 4;
      out[k] = mix(0xF0, 0x11, fg); out[k + 1] = mix(0x44, 0x11, fg); out[k + 2] = mix(0x3A, 0x11, fg);
      out[k + 3] = Math.round(Math.max(a, fg) * 255);
    }
  }
  return png(w, h, out, o.opaque);
}

// Mark sizes per platform: full bleed (iOS, apple-touch) 0.68; inside a rounded tile 0.66; the maskable
// PWA icon keeps the mark inside its 80 % safe circle (0.58); Android's adaptive foreground inside the
// 66/108 safe circle (0.46).
// PWA
write('public/icon-192.png', drawIcon(192, 192, { bg: 'none', tile: { shape: 'rounded', size: 1 }, mark: 0.66 }));
write('public/icon-512.png', drawIcon(512, 512, { bg: 'none', tile: { shape: 'rounded', size: 1 }, mark: 0.66 }));
write('public/icon-maskable-512.png', drawIcon(512, 512, { bg: 'red', mark: 0.58 }));
write('public/apple-touch-icon.png', drawIcon(180, 180, { bg: 'red', mark: 0.68 }));
const fav = drawIcon(64, 64, { bg: 'none', tile: { shape: 'rounded', size: 1 }, mark: 0.7 });
write('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${fav.toString('base64')}"/></svg>\n`);

// Android (after `npx cap add android`)
const RES = 'android/app/src/main/res';
if (existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, s] of Object.entries(dens)) {
    const legacy = Math.round(48 * s), adaptive = Math.round(108 * s);
    write(`${RES}/mipmap-${d}/ic_launcher.png`, drawIcon(legacy, legacy, { bg: 'none', tile: { shape: 'rounded', size: 0.84 }, mark: 0.56 }));
    write(`${RES}/mipmap-${d}/ic_launcher_round.png`, drawIcon(legacy, legacy, { bg: 'none', tile: { shape: 'circle', size: 0.92 }, mark: 0.56 }));
    write(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, drawIcon(adaptive, adaptive, { bg: 'none', mark: 0.46 }));
    write(`${RES}/mipmap-${d}/ic_launcher_background.png`, drawIcon(adaptive, adaptive, { bg: 'red', mark: 0 }));
    const [pw, ph] = [Math.round(320 * s), Math.round(480 * s)];
    write(`${RES}/drawable-port-${d}/splash.png`, paper(pw, ph));
    write(`${RES}/drawable-land-${d}/splash.png`, paper(ph, pw));
  }
  write(`${RES}/drawable/splash.png`, paper(480, 320));
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
  write(`${XC}/AppIcon.appiconset/AppIcon-512@2x.png`, drawIcon(1024, 1024, { bg: 'red', mark: 0.68, opaque: true }));
  // The launch screen (LaunchScreen.storyboard) is plain paper; no image needed.
}
