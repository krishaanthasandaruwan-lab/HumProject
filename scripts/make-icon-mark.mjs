// Turns the reference app icon (design/icon/hm-reference.jpg: the "Hm" brush mark, dark on orange) into
// a clean coverage mask — design/icon/hm-mark.pgm, 0 = background, 255 = mark — cropped to the mark.
// JPEG noise goes away: each pixel's coverage is read along the line from the background colour to
// the mark colour, softly blurred, then pulled back to crisp ~1 px anti-aliased edges.
// make-icons.mjs then draws every icon from this mask in the app's two colours.
// Usage: node scripts/make-icon-mark.mjs   (macOS: uses `sips` to read the JPEG)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SRC = 'design/icon/hm-reference.jpg';
const OUT = 'design/icon/hm-mark.pgm';

// JPEG -> BMP (uncompressed, easy to read) with the system's own tool.
const bmpPath = join(mkdtempSync(join(tmpdir(), 'humm-icon-')), 'ref.bmp');
execFileSync('sips', ['-s', 'format', 'bmp', SRC, '--out', bmpPath], { stdio: 'ignore' });
const b = readFileSync(bmpPath);
const off = b.readUInt32LE(10);
const w = b.readInt32LE(18);
const hRaw = b.readInt32LE(22);
const h = Math.abs(hRaw);
const bpp = b.readUInt16LE(28) / 8;
const row = Math.ceil((w * bpp) / 4) * 4;
const px = (x, y) => {
  const yy = hRaw > 0 ? h - 1 - y : y; // BMP rows run bottom-up unless the height is negative
  const i = off + yy * row + x * bpp;
  return [b[i + 2], b[i + 1], b[i]];
};

// Background = median of the border; mark = median of the darkest tenth of the image.
const median = (v) => v.sort((a, c) => a - c)[v.length >> 1];
const border = [];
for (let i = 0; i < w; i += 4) border.push(px(i, 2), px(i, h - 3));
for (let i = 0; i < h; i += 4) border.push(px(2, i), px(w - 3, i));
const bg = [0, 1, 2].map((c) => median(border.map((p) => p[c])));
const all = [];
for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) all.push(px(x, y));
all.sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
const dark = all.slice(0, Math.max(1, all.length / 10 | 0));
const ink = [0, 1, 2].map((c) => median(dark.map((p) => p[c])));

// Coverage along bg -> ink.
const d = ink.map((v, c) => v - bg[c]);
const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
const cov = new Float32Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const p = px(x, y);
  const t = ((p[0] - bg[0]) * d[0] + (p[1] - bg[1]) * d[1] + (p[2] - bg[2]) * d[2]) / dd;
  cov[y * w + x] = Math.min(1, Math.max(0, t));
}

// Soft blur (2 px box, twice) to drown the JPEG blocks, then a narrow smoothstep for crisp edges.
function blur(src, r) {
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } }
    tmp[y * w + x] = s / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
    dst[y * w + x] = s / n;
  }
  return dst;
}
const soft = blur(blur(cov, 2), 2);
const edge = (v) => { const t = Math.min(1, Math.max(0, (v - 0.32) / 0.36)); return t * t * (3 - 2 * t); };
const clean = Float32Array.from(soft, edge);

// Crop to the mark (with a small margin).
let x0 = w, y0 = h, x1 = 0, y1 = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (clean[y * w + x] > 0.02) {
  x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
}
const m = 4;
x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
const data = Buffer.alloc(cw * ch);
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) data[y * cw + x] = Math.round(clean[(y + y0) * w + x + x0] * 255);
writeFileSync(OUT, Buffer.concat([Buffer.from(`P5\n${cw} ${ch}\n255\n`, 'ascii'), data]));
console.log(`background rgb(${bg}) mark rgb(${ink}) -> ${OUT} (${cw} × ${ch}, from ${w} × ${h})`);
