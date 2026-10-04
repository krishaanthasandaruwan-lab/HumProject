// 15 · Share: the song as audio, the before → after video (share / save), or MIDI.
// A song without locked things (pro/exports.ts) exports for free — audio, and the video in high quality
// (1080 × 1920). One that uses a Pro feature exports with Pro only: Audio and Make video carry the lock,
// and "Pro features in this song" lists exactly what it uses. MIDI files are Pro. Free videos carry the
// "Made with HUMM" mark.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { exportMidi, exportWav, prepareVideo, recordVideo } from '../audio/export';
import { canExport, lockedItems } from '../pro/exports';
import { isPro } from '../pro/pro';
import { download, safeName, shareFile } from '../share';
import { getProject } from '../state';
import { h, sheet, toast } from './dom';
import { icon } from './icons';
import { btn2, chip, listRow, mainBtn, setLabel } from './kit';
import { partLabel } from './parts';
import { openPaywall } from './paywall';
import { createScene, loadSceneFonts, sceneEvents } from './videoScene';

/** Exported videos: 1080 × 1920 (the 720 × 1280 frame drawn 1.5×) at 8 Mbps. */
const quality = { scale: 1.5, bits: 8_000_000, label: '1080p' } as const;

export function openExport(): void {
  const p = getProject();
  const name = safeName(p.name);
  const check = canExport(p);
  const watermark = !isPro();
  const locked = (): void => openPaywall(check.ok ? undefined : check.reason);
  let abort: AbortController | null = null;
  const canvas = h('canvas', { class: 'video-canvas' });
  const bar = h('i');
  const status = h('p', { class: 'small muted center', 'aria-live': 'polite' }, 'Before → after, for TikTok, Reels and Shorts');
  const progress = h('div', { class: 'bar hidden' }, bar);
  const makeBtn = mainBtn('Make video', () => (check.ok ? void makeVideo() : openLocked()), { icon: check.ok ? 'video' : 'lock' });
  const result = h('div', { class: 'stack hidden' });
  const wavBtn = chip('Audio', () => void doWav(), { icon: 'audio', lock: !check.ok }) as HTMLButtonElement;
  const midiBtn = chip('MIDI', () => void doMidi(), { icon: 'midi', lock: !isPro() }) as HTMLButtonElement;
  const items = lockedItems(p);
  const note = check.ok
    ? null
    : btn2(`Pro features in this song (${items.length})`, () => openLocked(), 'pro');

  const content = h('div', { class: 'stack' },
    h('div', { class: 'video-wrap' }, canvas),
    status, progress, makeBtn, result,
    h('div', { class: 'chips' }, wavBtn, midiBtn),
    note,
  );
  sheet(content, () => abort?.abort(), 'Share');

  // Poster frame so the sheet never shows an empty box.
  const poster = createScene(canvas, { project: p, bars: Math.min(p.bars, 4), rawDur: 0, wave: new Float32Array(0), sampleRate: 48000, events: [], watermark }, quality.scale);
  poster.draw(0.01);
  void loadSceneFonts().then(() => poster.draw(0.01));

  /** What in this song is Pro, one by one, and how to export it anyway. */
  function openLocked(): void {
    const close = sheet(h('div', { class: 'stack' },
      h('p', { class: 'body muted' }, 'Exporting this song needs Pro, because it uses:'),
      h('div', { class: 'listbox' }, items.map((it) =>
        listRow(it.name, h('span', { class: 'lockb', 'aria-label': 'Pro' }, icon('lock', 12)),
          { sub: it.track ? `${it.why} · ${partLabel(p, it.track)}` : it.why }))),
      mainBtn('Unlock Pro', () => { close(); locked(); }, { icon: 'pro' }),
      h('p', { class: 'small muted' }, 'Or take them out of the song (Undo, another sound) to export it free.')),
    undefined, 'Pro in this song');
  }

  async function makeVideo(): Promise<void> {
    player.stop();
    abort = new AbortController();
    makeBtn.disabled = true;
    makeBtn.classList.add('busy');
    setLabel(makeBtn, 'Making video…');
    result.classList.add('hidden');
    progress.classList.remove('hidden');
    bar.style.width = '0';
    try {
      await unlockAudio();
      await loadSceneFonts();
      status.textContent = 'Making video…';
      const plan = await prepareVideo(p);
      const scene = createScene(canvas, {
        project: p, bars: plan.bars, rawDur: plan.rawDur, wave: plan.wave, sampleRate: plan.audio.sampleRate,
        events: sceneEvents(p, plan.bars, plan.rawDur), watermark,
      }, quality.scale);
      status.textContent = 'Keep this screen open';
      const { blob, ext } = await recordVideo({
        canvas, draw: scene.draw, audio: plan.audio, signal: abort.signal, videoBitsPerSecond: quality.bits,
        onProgress: (f) => { bar.style.width = `${(f * 100).toFixed(1)}%`; },
      });
      const url = URL.createObjectURL(blob);
      const file = `${name} - HUMM.${ext}`;
      result.replaceChildren(
        h('video', { class: 'video-preview', src: url, controls: true, playsinline: true }),
        mainBtn('Share', () => void shareFile(blob, file, p.name).then(report, fail), { icon: 'share' }),
        btn2('Save', () => void download(blob, file, p.name).then(report, fail), 'save'),
      );
      result.classList.remove('hidden');
      makeBtn.classList.add('hidden');
      canvas.parentElement?.classList.add('hidden');
      status.textContent = `${quality.label} · ${(blob.size / 1e6).toFixed(1)} MB ${ext.toUpperCase()}`;
    } catch (err) {
      const e = err as Error;
      status.textContent = e.name === 'AbortError' ? 'Stopped.' : `Couldn’t make the video: ${e.message}`;
    } finally {
      makeBtn.disabled = false;
      makeBtn.classList.remove('busy');
      setLabel(makeBtn, 'Make video');
      progress.classList.add('hidden');
      abort = null;
    }
  }

  function report(outcome: string): void {
    if (outcome === 'downloaded') toast('Saved');
  }

  function fail(err: unknown): void {
    toast(`Couldn’t share: ${(err as Error)?.message ?? err}`);
  }

  async function doWav(): Promise<void> {
    if (!check.ok) return openLocked();
    wavBtn.disabled = true;
    try {
      const blob = await exportWav(p);
      report(await shareFile(blob, `${name}.wav`, p.name));
    } catch (err) {
      toast(`Couldn’t make the audio file: ${(err as Error).message}`);
    } finally {
      wavBtn.disabled = false;
    }
  }

  async function doMidi(): Promise<void> {
    if (!isPro()) return openPaywall('MIDI files are part of Pro.');
    await shareFile(exportMidi(p), `${name}.mid`, p.name).then(report, fail);
  }
}
