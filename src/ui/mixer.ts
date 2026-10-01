// 10 · Mix: balance the parts (volume, mute, solo) and set the feel (swing, timing).
import { edit, getProject } from '../state';
import type { Track } from '../model/project';
import { h, sheet } from './dom';
import { icon } from './icons';
import { group, mainBtn, range } from './kit';
import { PARTS } from './parts';

function trackRow(t: Track, rerender: () => void): HTMLElement {
  const name = PARTS[t.kind].label;
  const toggleBtn = (label: string, on: boolean, aria: string, flip: () => void): HTMLButtonElement =>
    h('button', { type: 'button', class: 'ms', 'aria-pressed': String(on), 'aria-label': aria, onClick: () => { edit(flip); rerender(); } }, label);
  return h('div', { class: `mixrow${t.muted ? ' muted' : ''}` },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(PARTS[t.kind].icon, 20)),
    h('span', { class: 'mixname' }, name),
    range(0, 1, 0.01, t.volume, (v) => edit(() => { t.volume = v; }), `${name} volume`),
    toggleBtn('M', t.muted, `Mute ${name.toLowerCase()}`, () => { t.muted = !t.muted; }),
    toggleBtn('S', !!t.solo, `Solo ${name.toLowerCase()}`, () => { t.solo = !t.solo; }));
}

function feel(label: string, ends: [string, string], slider: HTMLInputElement): HTMLElement {
  return h('div', { class: 'lrow wide' }, h('b', null, label), slider, h('div', { class: 'range-ends small' }, h('span', null, ends[0]), h('span', null, ends[1])));
}

export function openMixer(onClose?: () => void): void {
  const body = h('div', { class: 'stack' });
  const render = (): void => {
    const p = getProject();
    body.replaceChildren(
      p.tracks.length
        ? group('Parts', p.tracks.map((t) => trackRow(t, render)))
        : h('p', { class: 'body muted' }, 'Record a part first.'),
      group('Feel',
        feel('Swing', ['Straight', 'Bouncy'], range(0, 0.3, 0.01, p.swing, (v) => edit((q) => { q.swing = v; }), 'Swing')),
        feel('Timing', ['Loose', 'Tight'], range(0, 1, 0.01, p.quantize, (v) => edit((q) => { q.quantize = v; }), 'Timing'))),
      mainBtn('Done', () => close(), { icon: 'done' }),
    );
  };
  render();
  const close = sheet(body, onClose, 'Mix');
}
