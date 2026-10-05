import { getMaster, unlockAudio } from '../../src/audio/context';
import { playNote } from '../../src/synth/instruments';
import { renderNow } from '../../src/synth/renderCache';

let bus: GainNode | undefined;
export function setPianoMuted(muted: boolean): void { if (bus) bus.gain.setTargetAtTime(muted ? 0 : 1, bus.context.currentTime, .015); }

export async function pianoNote(midi: number): Promise<void> {
  const ctx = await unlockAudio();
  if (!bus || bus.context !== ctx) { bus = ctx.createGain(); bus.connect(getMaster()); }
  renderNow('piano', midi, ctx.sampleRate);
  playNote(ctx, bus, 'piano', midi, ctx.currentTime + .005, .8, .65);
}
