// App-wide singletons: the transport and quick "audition" sounds for editing feedback.
import { getCtx, getMaster } from './audio/context';
import { Player } from './audio/scheduler';
import type { DrumType } from './model/project';
import { playNote } from './synth/instruments';
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
  playNote(ctx, getMaster(), preset, midi, ctx.currentTime + 0.01, 0.3, 0.8);
}
