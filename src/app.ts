// App-wide singletons: the transport and quick "audition" sounds for editing feedback.
import { getCtx, getMaster } from './audio/context';
import { Player } from './audio/scheduler';
import type { DrumType, Track } from './model/project';
import { playNote } from './synth/instruments';
import { renderNow } from './synth/renderCache';
import { getKit, playDrum } from './synth/kits';
import { getProject } from './state';

export const player = new Player(getProject);

export function auditionDrum(type: DrumType, kitId: string, velocity = 0.85): void {
  const ctx = getCtx();
  if (ctx.state !== 'running') return;
  playDrum(ctx, getMaster(), type, getKit(kitId), ctx.currentTime + 0.01, velocity);
}

export function auditionNote(preset: string, midi: number): void {
  const ctx = getCtx();
  if (ctx.state !== 'running') return;
  renderNow(preset, midi, ctx.sampleRate); // piano, guitar, bells…: render this one note right now
  playNote(ctx, getMaster(), preset, midi, ctx.currentTime + 0.01, 0.45, 0.8);
}

let voice: AudioBufferSourceNode | null = null;

/** Play (or stop) the raw recording behind a track — the "what I recorded" half. Returns true if now playing. */
export function toggleVoice(track: Track, onEnd?: () => void): boolean {
  if (voice) {
    try {
      voice.stop();
    } catch {
      /* already ended */
    }
    voice = null;
    return false;
  }
  if (!track.rawVoice?.length || !track.rawRate) return false;
  const ctx = getCtx();
  const buf = ctx.createBuffer(1, track.rawVoice.length, track.rawRate);
  buf.getChannelData(0).set(track.rawVoice);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(getMaster());
  src.onended = () => {
    if (voice === src) voice = null;
    onEnd?.();
  };
  src.start();
  voice = src;
  return true;
}
