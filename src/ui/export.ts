// 15 · Share: the before → after video (with share / save), and the song as audio or MIDI.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { exportMidi, exportWav, prepareVideo, recordVideo } from '../audio/export';
import { isPro } from '../pro/pro';
import { download, safeName, shareFile } from '../share';
import { getProject } from '../state';
import { h, sheet, toast } from './dom';
import { btn2, chip, link, mainBtn, setLabel } from './kit';
import { openPaywall } from './paywall';
import { createScene, loadSceneFonts, sceneEvents } from './videoScene';

export function openExport(): void {
  const p = getProject();
  const name = safeName(p.name);
  let abort: AbortController | null = null;
  const canvas = h('canvas', { class: 'video-canvas' });
  const bar = h('i');
  const status = h('p', { class: 'small muted center', 'aria-live': 'polite' }, 'Before → after, for TikTok, Reels and Shorts');
  const progress = h('div', { class: 'bar hidden' }, bar);
  const makeBtn = mainBtn('Make video', () => void makeVideo(), { icon: 'video' });
  const result = h('div', { class: 'stack hidden' });
  const locked = !isPro();
  const wavBtn = chip('Audio', () => void doWav(), { icon: 'audio', lock: locked }) as HTMLButtonElement;
  const midiBtn = chip('MIDI', () => void doMidi(), { icon: 'midi', lock: locked }) as HTMLButtonElement;
  const proNote = locked
    ? h('div', { class: 'row share-wm' }, h('span', { class: 'small muted grow' }, 'Made with HUMM'), link('Remove', () => openPaywall(), true))
    : null;

  const content = h('div', { class: 'stack' },
    h('div', { class: 'video-wrap' }, canvas),
    status, progress, makeBtn, result,
    h('div', { class: 'chips' }, wavBtn, midiBtn),
    proNote,
  );
  sheet(content, () => abort?.abort(), 'Share');

  // Poster frame so the sheet never shows an empty box.
  const poster = createScene(canvas, { project: p, bars: Math.min(p.bars, 4), rawDur: 0, wave: new Float32Array(0), sampleRate: 48000, events: [], watermark: !isPro() });
  poster.draw(0.01);
  void loadSceneFonts().then(() => poster.draw(0.01));

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
        events: sceneEvents(p, plan.bars, plan.rawDur), watermark: !isPro(),
      });
      status.textContent = 'Keep this screen open';
      const { blob, ext } = await recordVideo({
        canvas, draw: scene.draw, audio: plan.audio, signal: abort.signal,
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
      status.textContent = `${(blob.size / 1e6).toFixed(1)} MB ${ext.toUpperCase()}`;
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
    if (!isPro()) return openPaywall('Audio files are part of Pro.');
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
