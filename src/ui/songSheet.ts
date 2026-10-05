// 11 · Song: tempo, loop length and key in one place.
import { keyName } from '../dsp/key';
import { refreshKey } from '../model/music';
import { clampBpm } from '../model/variety';
import { settings, updateSettings } from '../settings';
import { edit, getProject } from '../state';
import { h, segmented, sheet } from './dom';
import { group, listRow, mainBtn, stepper, toggle } from './kit';


export function openSongSheet(onChange: () => void): void {
  const p = getProject;
  const tempo = stepper(() => p().bpm, (v) => {
    edit((pp) => { pp.bpm = clampBpm(v); });
    updateSettings({ lastBpm: p().bpm });
    onChange();
  }, 'BPM', 'Tempo');
  // A long hummed song keeps its own length as a fourth choice.
  const lengths = [2, 4, 8, ...(p().bars > 8 ? [p().bars] : [])];
  const loop = segmented<number>(
    lengths.map((n) => ({ value: n, label: `${n} bars` })),
    p().bars,
    (v) => {
      edit((pp) => { pp.bars = v; if (v === 2 || v === 4 || v === 8) pp.barSet = v; });
      if (v === 2 || v === 4 || v === 8) updateSettings({ lastBars: v });
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
