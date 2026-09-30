// Canvas waveform drawing (live mic scope + static take overview).

/** Match the canvas backing store to its CSS size × devicePixelRatio. */
export function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}

export function drawScope(canvas: HTMLCanvasElement, data: Float32Array, color = '#ff4d6d'): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const { w, h, dpr } = fitCanvas(canvas);
  g.clearRect(0, 0, w, h);
  g.lineWidth = 2 * dpr;
  g.strokeStyle = color;
  g.beginPath();
  for (let x = 0; x < w; x++) {
    const v = data[Math.floor((x / w) * data.length)] || 0;
    const y = h / 2 - v * h * 0.9;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** Min/max envelope of a whole take, with an optional playhead (0..1). */
export function drawWave(canvas: HTMLCanvasElement, audio: Float32Array, color = '#9b7bff', playhead = -1): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const { w, h, dpr } = fitCanvas(canvas);
  g.clearRect(0, 0, w, h);
  let peak = 1e-4;
  for (let i = 0; i < audio.length; i += 16) peak = Math.max(peak, Math.abs(audio[i]));
  const scale = Math.min(8, 0.95 / peak); // auto-zoom quiet takes so they are visible
  const per = audio.length / w;
  g.fillStyle = color;
  for (let x = 0; x < w; x++) {
    let lo = 0;
    let hi = 0;
    const s = Math.floor(x * per);
    const e = Math.min(audio.length, Math.floor((x + 1) * per));
    for (let i = s; i < e; i++) {
      const v = audio[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const y0 = h / 2 - hi * scale * (h / 2);
    const y1 = h / 2 - lo * scale * (h / 2);
    g.fillRect(x, y0, 1, Math.max(dpr, y1 - y0));
  }
  if (playhead >= 0) {
    g.fillStyle = '#fff';
    g.fillRect(Math.round(playhead * w), 0, 2 * dpr, h);
  }
}
