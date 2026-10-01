// Your own voice inside a hummed part: on/off, auto-tune (to the notes in the piano roll) and
// "voice only" (the instrument steps aside). Beat matching is always on — it keeps the voice tight.
import { prepareProject } from '../audio/prepare';
import { getTrack, type Track, type TrackKind } from '../model/project';
import { edit, getProject } from '../state';
import { h } from './dom';

type Voice = NonNullable<Track['voice']>;

export function voiceRow(kind: TrackKind): HTMLElement | null {
  const track = (): Track | undefined => getTrack(getProject(), kind);
  const t = track();
  if (!t?.rawVoice?.length || !t.anchors?.length) return null;
  const get = (): Voice => track()?.voice ?? { on: false, tune: true, level: 0.8 };
  const box = (checked: boolean): HTMLInputElement => h('input', { type: 'checkbox', checked });
  const on = box(get().on);
  const tune = box(get().tune);
  const only = box(!!get().only);
  const sync = (): void => {
    tune.disabled = only.disabled = !on.checked;
  };
  const set = (patch: Partial<Voice>): void => {
    edit(() => {
      const tr = track();
      if (tr) tr.voice = { ...get(), ...patch };
    });
    sync();
    void prepareProject(getProject()).catch(() => undefined);
  };
  on.addEventListener('change', () => set({ on: on.checked }));
  tune.addEventListener('change', () => set({ tune: tune.checked }));
  only.addEventListener('change', () => set({ only: only.checked }));
  sync();
  return h('div', { class: 'voice-row' },
    h('label', { class: 'check' }, on, '🎤 My voice in the song'),
    h('div', { class: 'row wrap voice-opts' },
      h('label', { class: 'check' }, tune, 'Auto-tune'),
      h('label', { class: 'check' }, only, 'Voice only')));
}
