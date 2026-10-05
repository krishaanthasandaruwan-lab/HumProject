import { getCtx, setAudioSession, unlockAudio } from '../../src/audio/context';
import { MicRecorder } from '../../src/audio/recorder';
import { Player } from '../../src/audio/scheduler';
import { prepareProject } from '../../src/audio/prepare';
import { runDsp } from '../../src/dsp/client';
import { boostQuiet, LevelGate } from '../../src/dsp/level';
import { arrange } from '../../src/model/autoArrange';
import { STYLES } from '../../src/model/styles';
import { newProject, stepDur, type Project } from '../../src/model/project';

const MIN_SECONDS = 10;
const MAX_SECONDS = 20;
const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function initDemo(): void {
  const studio = document.querySelector<HTMLElement>('#demo-studio')!;
  const micButton = document.querySelector<HTMLButtonElement>('#demo-mic')!;
  const micLabel = document.querySelector<HTMLElement>('#mic-label')!;
  const status = document.querySelector<HTMLElement>('#demo-status')!;
  const cancel = document.querySelector<HTMLButtonElement>('#demo-cancel')!;
  const play = document.querySelector<HTMLButtonElement>('#demo-play')!;
  const reset = document.querySelector<HTMLButtonElement>('#demo-reset')!;
  const count = document.querySelector<HTMLElement>('#track-count')!;
  const time = document.querySelector<HTMLOutputElement>('#demo-time')!;
  const scope = document.querySelector<HTMLCanvasElement>('#demo-scope')!;
  const pen = scope.getContext('2d')!;
  const rows = [...document.querySelectorAll<HTMLElement>('.demo-track')];
  const samples = new Float32Array(2048);
  const colors = getComputedStyle(studio);
  const ink = colors.getPropertyValue('--ink').trim();
  const red = colors.getPropertyValue('--red').trim();
  const stone = colors.getPropertyValue('--stone').trim();
  let project: Project = newProject('Your hum');
  const player = new Player(() => project);
  let recorder: MicRecorder | null = null;
  let operation = new AbortController();
  let started = 0;
  let frame = 0;
  let quietSince = 0;
  let lastSecond = -1;
  let lastFrameTime = 0;
  let opening = false;
  let gate = new LevelGate();

  rows.forEach(row => {
    const pattern = row.querySelector<HTMLElement>('.track-pattern')!;
    for (let i = 0; i < 16; i++) pattern.append(document.createElement('i'));
    row.querySelector('select')!.addEventListener('change', event => {
      const track = project.tracks.find(t => t.kind === row.dataset.kind);
      if (!track) return;
      track.preset = (event.target as HTMLSelectElement).value;
      project.updatedAt = Date.now();
      void prepareProject(project).catch(() => { status.textContent = 'That sound could not load. Choose another sound to retry.'; });
      player.refreshMix();
    });
    row.querySelector<HTMLButtonElement>('.mute-button')!.addEventListener('click', event => {
      const track = project.tracks.find(t => t.kind === row.dataset.kind);
      if (!track) return;
      track.muted = !track.muted;
      const button = event.currentTarget as HTMLButtonElement;
      button.setAttribute('aria-pressed', String(track.muted));
      button.setAttribute('aria-label', `${track.muted ? 'Unmute' : 'Mute'} ${row.dataset.kind === 'lead' ? 'melody' : row.dataset.kind}`);
      button.querySelector('use')!.setAttribute('href', track.muted ? '#i-mute' : '#i-volume');
      row.classList.toggle('is-muted', track.muted);
      player.refreshMix();
    });
  });

  function setState(state: string, message: string): void {
    studio.dataset.state = state;
    status.textContent = message;
    const recording = state === 'recording';
    const busy = state === 'opening' || state === 'processing';
    micButton.disabled = busy;
    cancel.hidden = !recording && !busy;
    reset.disabled = !project.tracks.length && !recording && !busy;
    play.disabled = !project.tracks.length || recording || busy;
    rows.forEach(row => row.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button,select').forEach(control => { control.disabled = !project.tracks.length || recording || busy; }));
    const label = ({ ready: 'Start humming', opening: 'Opening your microphone…', recording: 'Finish humming', processing: 'Building your band…', result: 'Hum something new', error: 'Try humming again' } as Record<string, string>)[state];
    micLabel.textContent = label;
    micButton.setAttribute('aria-label', label);
    micButton.querySelector('use')!.setAttribute('href', recording ? '#i-stop' : '#i-mic');
  }

  function paintScope(): void {
    pen.clearRect(0, 0, scope.width, scope.height);
    pen.strokeStyle = recorder ? red : stone;
    pen.lineWidth = 2;
    pen.beginPath();
    for (let x = 0; x < scope.width; x++) {
      const y = scope.height / 2 + (recorder ? samples[Math.floor(x / scope.width * samples.length)] * scope.height * 2.5 : 0);
      if (x === 0) pen.moveTo(x, y); else pen.lineTo(x, y);
    }
    pen.stroke();
  }
  function drawPatterns(): void {
    const position = player.currentPosition();
    const bar = position < 0 ? 0 : Math.floor(position / 16);
    rows.forEach(row => {
      const track = project.tracks.find(t => t.kind === row.dataset.kind);
      const steps = new Set(track?.kind === 'drums' ? track.hits?.map(h => h.step) : track?.notes?.map(n => n.start));
      row.querySelectorAll('i').forEach((cell, i) => {
        cell.classList.toggle('note', steps.has(bar * 16 + i));
        cell.classList.toggle('current', position >= 0 && Math.floor(position % 16) === i);
      });
    });
    const seconds = Math.max(0, position) * stepDur(project.bpm);
    time.value = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
  function animate(): void {
    if (recorder) {
      recorder.analyser.getFloatTimeDomainData(samples);
      const elapsed = getCtx().currentTime - started;
      if (!recorder.receiving()) { clear('The microphone was interrupted. Tap to try again.'); return; }
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      const level = gate.update(rms, Math.min(.1, elapsed - lastFrameTime));
      lastFrameTime = elapsed;
      micButton.style.setProperty('--level', String(1 + level.meter * .15));
      if (!level.silent) quietSince = elapsed;
      const second = Math.floor(elapsed);
      if (second !== lastSecond) { lastSecond = second; status.textContent = elapsed < MIN_SECONDS ? `Keep humming · ${second} / ${MIN_SECONDS} seconds` : `Tap to finish · ${second} seconds`; }
      paintScope();
      if (elapsed >= MAX_SECONDS || (elapsed >= MIN_SECONDS && elapsed - quietSince >= 4)) { void finish(); return; }
    }
    if (player.playing) drawPatterns();
    frame = requestAnimationFrame(animate);
  }
  function stopPlayback(): void {
    player.stop();
    play.querySelector('span')!.textContent = 'Play your song';
    play.querySelector('use')!.setAttribute('href', '#i-play');
    cancelAnimationFrame(frame);
    drawPatterns();
  }
  function clear(message = 'Hum for 10 seconds. Then tap to finish.'): void {
    operation.abort();
    operation = new AbortController();
    recorder?.close(); recorder = null;
    opening = false;
    stopPlayback();
    project = newProject('Your hum');
    setAudioSession('playback');
    count.textContent = '0 / 3';
    micButton.style.removeProperty('--level');
    rows.forEach(row => {
      row.classList.remove('is-muted');
      const button = row.querySelector('.mute-button')!;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Mute ${row.dataset.kind === 'lead' ? 'melody' : row.dataset.kind}`);
      button.querySelector('use')!.setAttribute('href', '#i-volume');
    });
    drawPatterns(); paintScope(); setState('ready', message);
  }
  async function start(): Promise<void> {
    if (opening || studio.dataset.state === 'processing') return;
    if (recorder) {
      if (getCtx().currentTime - started < MIN_SECONDS) { status.textContent = `Keep humming for at least ${MIN_SECONDS} seconds.`; return; }
      await finish(); return;
    }
    clear();
    const signal = operation.signal;
    opening = true;
    setState('opening', 'Allow microphone access to try HUMM.');
    try {
      const input = await MicRecorder.open(signal);
      if (signal.aborted || document.hidden) { input.close(); return; }
      recorder = input;
      started = getCtx().currentTime;
      lastSecond = -1; quietSince = 0; lastFrameTime = 0; gate = new LevelGate();
      setState('recording', 'Keep humming · 0 / 10 seconds');
      frame = requestAnimationFrame(animate);
    } catch (error) {
      if (!signal.aborted) {
        setAudioSession('playback');
        const denied = (error as Error).name === 'NotAllowedError';
        setState('error', denied ? 'Microphone access is off. Allow it in your browser, then tap to try again.' : (error as Error).message);
      }
    } finally { if (!signal.aborted) opening = false; }
  }
  async function finish(): Promise<void> {
    const input = recorder;
    if (!input) return;
    recorder = null;
    const signal = operation.signal;
    const end = getCtx().currentTime;
    cancelAnimationFrame(frame);
    micButton.style.removeProperty('--level');
    setState('processing', 'Finding the beat and key…');
    try {
      await input.stop();
      const captured = input.extract(started, end);
      input.close(); setAudioSession('playback'); paintScope();
      const cleaned = await runDsp('cleanVoice', { audio: captured, sampleRate: input.ctx.sampleRate }, { signal });
      const audio = boostQuiet(cleaned, input.ctx.sampleRate);
      let take = await runDsp('free', { audio, sampleRate: input.ctx.sampleRate, kind: 'lead' }, { signal });
      if (take.notes.length < 4 || !take.key) {
        const retry = await runDsp('free', { audio, sampleRate: input.ctx.sampleRate, kind: 'lead', sensitive: true }, { signal });
        if (retry.notes.length > take.notes.length && retry.key) take = retry;
      }
      if (signal.aborted) return;
      if (take.notes.length < 2 || !take.key) { setState('error', 'Didn’t catch a tune. Hum a few steady notes close to the microphone and try again.'); return; }
      project = arrange({ notes: take.notes, bpm: take.bpm, bars: take.bars, key: take.key }, STYLES.find(s => s.id === 'pop')!, 'Your hum');
      project.tracks = project.tracks.filter(track => track.kind !== 'chords');
      project.tracks.forEach(track => { track.preset = rows.find(row => row.dataset.kind === track.kind)!.querySelector('select')!.value; });
      status.textContent = 'Getting your instruments ready…';
      await prepareProject(project, signal);
      if (signal.aborted) return;
      count.textContent = '3 / 3';
      drawPatterns();
      setState('result', `Your band is ready · ${Math.round(project.bpm)} BPM · ${noteNames[project.key!.tonic]} ${project.key!.mode}. Press Play.`);
    } catch (error) {
      input.close(); setAudioSession('playback');
      if (!signal.aborted) { project = newProject('Your hum'); setState('error', `Couldn’t build your song. ${(error as Error).message} Tap to retry.`); }
    }
  }
  micButton.dataset.loaded = 'true';
  micButton.addEventListener('click', () => void start());
  cancel.addEventListener('click', () => clear());
  reset.addEventListener('click', () => clear());
  play.addEventListener('click', async () => {
    if (player.playing) { stopPlayback(); return; }
    const signal = operation.signal;
    play.disabled = true;
    try {
      await unlockAudio();
      if (signal.aborted || document.hidden || !project.tracks.length) return;
      player.start();
      play.querySelector('span')!.textContent = 'Stop your song';
      play.querySelector('use')!.setAttribute('href', '#i-stop');
      cancelAnimationFrame(frame); frame = requestAnimationFrame(animate);
    } catch { status.textContent = 'Audio could not start. Tap Play to try again.'; }
    finally { if (!signal.aborted) play.disabled = !project.tracks.length; }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (opening || recorder || studio.dataset.state === 'processing') clear('Recording interrupted. Keep this page open and try again.');
    else stopPlayback();
  });
  window.addEventListener('pagehide', () => clear());
  pen.strokeStyle = ink;
  paintScope();
}
