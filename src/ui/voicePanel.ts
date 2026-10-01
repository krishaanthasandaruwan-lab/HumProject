// "My voice" controls: your own voice inside a hummed part — on/off, Tuned or Natural (auto-tune to the
// notes in the piano roll), Voice only (the instrument steps aside) and its volume. Beat matching is
// always on; it keeps the voice tight.
import { prepareProject } from '../audio/prepare';
import { type Track } from '../model/project';
import { edit, getProject } from '../state';
import { h, segmented } from './dom';
import { group, listRow, range, toggle } from './kit';
import { partLabel } from './parts';

type Voice = NonNullable<Track['voice']>;

function controls(t: Track, titled: boolean): HTMLElement {
  const get = (): Voice => t.voice ?? { on: false, tune: true, level: 0.8 };
  const set = (patch: Partial<Voice>): void => {
    edit(() => { t.voice = { ...get(), ...patch }; });
    void prepareProject(getProject()).catch(() => undefined);
  };
  const tune = segmented<'tuned' | 'natural'>(
    [{ value: 'tuned', label: 'Tuned' }, { value: 'natural', label: 'Natural' }],
    get().tune ? 'tuned' : 'natural',
    (v) => { set({ tune: v === 'tuned' }); tune.set(v); },
    'Tuning',
  );
  return group(titled ? `In ${partLabel(getProject(), t)}` : 'My voice',
    listRow('In the song', toggle(get().on, (on) => set({ on }), 'My voice in the song')),
    h('div', { class: 'lrow wide' }, tune.el),
    listRow('Voice only', toggle(!!get().only, (only) => set({ only }), 'Voice only'), { sub: 'The instrument steps aside.' }),
    h('div', { class: 'lrow wide' }, h('b', null, 'Volume'), range(0, 1, 0.01, get().level, (level) => set({ level }), 'Voice volume')));
}

export function voicePanel(): HTMLElement {
  const list = getProject().tracks.filter((t) => (t.kind === 'bass' || t.kind === 'lead') && t.rawVoice?.length && t.anchors?.length);
  if (!list.length) return h('p', { class: 'body muted' }, 'Hum a melody to hear your own voice in the song.');
  return h('div', { class: 'stack' }, list.map((t) => controls(t, list.length > 1)));
}
