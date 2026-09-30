// Share sheet: before → after video (with share / save), WAV and MIDI.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { exportMidi, exportWav, prepareVideo, recordVideo } from '../audio/export';
import { isPro } from '../pro/pro';
import { download, safeName, shareFile } from '../share';
import { getProject } from '../state';
import { h, sheet, toast } from './dom';
import { openPaywall } from './paywall';
import { createScene, sceneEvents } from './videoScene';

export function openExport(): void {
  const p = getProject();
  const name = safeName(p.name);
  let abort: AbortController | null = null;
  const canvas = h('canvas', { class: 'video-canvas' });
  const bar = h('div');
  const status = h('p', { class: 'small muted center' }, 'A vertical video for TikTok, Reels and Shorts: your raw voice first, then the full band.');
  const progress = h('div', { class: 'progress hidden' }, bar);
  const makeBtn = h('button', { class: 'primary big wide', onClick: () => void makeVideo() }, '🎬 Make my before → after video');
  const result = h('div', { class: 'stack hidden' });
  const lock = isPro() ? '' : ' 🔒';
  const wavBtn = h('button', { class: 'grow', onClick: () => void doWav() }, `🎵 WAV audio${lock}`);
  const midiBtn = h('button', { class: 'grow', onClick: () => void doMidi() }, `🎹 MIDI file${lock}`);
  const proNote = isPro()
    ? null
    : h('p', { class: 'tiny muted center' }, 'Free videos carry a small “Made with MouthBand” watermark. ',
      h('button', { class: 'link', onClick: () => openPaywall() }, 'Remove it — $0.99'));

  const content = h('div', { class: 'stack' },
    h('h2', null, 'Share your song'),
    h('div', { class: 'video-wrap' }, canvas),
    status, progress, makeBtn, result,
    h('div', { class: 'row' }, wavBtn, midiBtn),
    proNote,
  );
  const close = sheet(content, () => abort?.abort());
  void close;

  // Poster frame so the sheet never shows an empty box.
  const poster = createScene(canvas, { project: p, bars: Math.min(p.bars, 4), rawDur: 0, wave: new Float32Array(0), sampleRate: 48000, events: [], watermark: !isPro() });
  poster.draw(0.01);

  async function makeVideo(): Promise<void> {
    player.stop();
    abort = new AbortController();
    makeBtn.disabled = true;
    result.classList.add('hidden');
    progress.classList.remove('hidden');
    bar.style.width = '0';
    try {
      await unlockAudio();
      status.textContent = 'Rendering your band…';
      const plan = await prepareVideo(p);
      const scene = createScene(canvas, {
        project: p, bars: plan.bars, rawDur: plan.rawDur, wave: plan.wave, sampleRate: plan.audio.sampleRate,
        events: sceneEvents(p, plan.bars, plan.rawDur), watermark: !isPro(),
      });
      status.textContent = 'Recording the video — keep this screen open…';
      const { blob, ext } = await recordVideo({
        canvas, draw: scene.draw, audio: plan.audio, signal: abort.signal,
        onProgress: (f) => { bar.style.width = `${(f * 100).toFixed(1)}%`; },
      });
      const url = URL.createObjectURL(blob);
      const file = `${name} - MouthBand.${ext}`;
      result.replaceChildren(
        h('video', { class: 'video-preview', src: url, controls: true, playsinline: true }),
        h('div', { class: 'row' },
          h('button', { class: 'primary big grow', onClick: () => void shareFile(blob, file, p.name).then(report, fail) }, '📤 Share'),
          h('button', { class: 'big', onClick: () => void download(blob, file, p.name).then(report, fail) }, '⬇ Save')),
      );
      result.classList.remove('hidden');
      status.textContent = `Done — ${(blob.size / 1e6).toFixed(1)} MB ${ext.toUpperCase()}. Share it straight to TikTok, Reels or WhatsApp.`;
    } catch (err) {
      const e = err as Error;
      status.textContent = e.name === 'AbortError' ? 'Cancelled.' : `Could not make the video: ${e.message}`;
    } finally {
      makeBtn.disabled = false;
      progress.classList.add('hidden');
      abort = null;
    }
  }

  function report(outcome: string): void {
    if (outcome === 'downloaded') toast('Saved to your downloads');
  }

  function fail(err: unknown): void {
    toast(`Could not share: ${(err as Error)?.message ?? err}`);
  }

  async function doWav(): Promise<void> {
    if (!isPro()) return openPaywall('WAV export is part of Pro.');
    wavBtn.disabled = true;
    try {
      const blob = await exportWav(p);
      report(await shareFile(blob, `${name}.wav`, p.name));
    } catch (err) {
      toast(`WAV export failed: ${(err as Error).message}`);
    } finally {
      wavBtn.disabled = false;
    }
  }

  async function doMidi(): Promise<void> {
    if (!isPro()) return openPaywall('MIDI export is part of Pro.');
    await shareFile(exportMidi(p), `${name}.mid`, p.name).then(report, fail);
  }
}
