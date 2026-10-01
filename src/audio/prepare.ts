// Everything a project needs rendered before it plays: notes of the sample-by-sample instruments
// (piano, guitar, bells…) and the voice layers. Both are cached, so this is quick after the first time.
import type { Project } from '../model/project';
import { isRendered } from '../synth/rendered';
import { prepareSounds } from '../synth/renderCache';
import { getCtx } from './context';
import { prepareVoices } from './voiceLayer';

export function projectSounds(p: Project): { id: string; midi: number }[] {
  const out = new Map<string, { id: string; midi: number }>();
  for (const t of p.tracks) {
    if (!isRendered(t.preset)) continue;
    for (const n of t.notes ?? []) out.set(`${t.preset}:${n.midi}`, { id: t.preset, midi: n.midi });
  }
  return [...out.values()];
}

export async function prepareProject(p: Project): Promise<void> {
  await Promise.all([prepareSounds(projectSounds(p), getCtx().sampleRate), prepareVoices(p)]);
}

/** Wait for the sounds, but never longer than `ms` — stand-in voices cover anything still missing. */
export function prepareQuickly(p: Project, ms = 1500): Promise<void> {
  return Promise.race([prepareProject(p).catch(() => undefined), new Promise<void>((r) => setTimeout(r, ms))]);
}
