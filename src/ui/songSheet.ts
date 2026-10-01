// 11 · Song: tempo, loop length and key in one place.
import { keyName } from '../dsp/key';
import { refreshKey } from '../model/music';
import { settings, updateSettings } from '../settings';
import { edit, getProject } from '../state';
import { h, segmented, sheet } from './dom';
import { group, listRow, mainBtn, stepper, toggle } from './kit';

const clampBpm = (v: number): number => Math.max(70, Math.min(140, Math.round(v)));

export function openSongSheet(onChange: () => void): void {
  const p = getProject;
  const tempo = stepper(() => p().bpm, (v) => {
    edit((pp) => { pp.bpm = clampBpm(v); });
    updateSettings({ lastBpm: p().bpm });
    onChange();
  }, 'BPM', 'Tempo');
  const loop = segmented<2 | 4 | 8>(
    [{ value: 2, label: '2 bars' }, { value: 4, label: '4 bars' }, { value: 8, label: '8 bars' }],
    p().bars,
    (v) => {
      edit((pp) => { pp.bars = v; });
      updateSettings({ lastBars: v });
      loop.set(v);
      onChange();
    },
    'Loop length',
  );
  const snap = toggle(settings().snapToScale, (on) => {
    updateSettings({ snapToScale: on });
    edit((pp) => refreshKey(pp, on));
    onChange();
  }, 'Snap notes to the key');
  const key = p().key;
  const close = sheet(h('div', { class: 'stack' },
    group('Tempo', h('div', { class: 'lrow wide center-row' }, tempo.el)),
    group('Loop', h('div', { class: 'lrow wide' }, loop.el)),
    group('Key', listRow(key ? keyName(key) : 'Not found yet', snap, { sub: 'Snap notes keeps every hummed note in the key.' })),
    mainBtn('Done', () => close(), { icon: 'done' })),
  undefined, 'Song');
}
