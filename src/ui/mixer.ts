// Mixer sheet: per-track volume / mute / solo, swing, quantize strength and the key.
import { keyName } from '../dsp/key';
import { TRACK_META, type Track } from '../model/project';
import { edit, getProject } from '../state';
import { h, sheet } from './dom';

function slider(min: number, max: number, step: number, value: number, onInput: (v: number) => void): HTMLInputElement {
  const el = h('input', { type: 'range', min, max, step, value: String(value) });
  el.addEventListener('input', () => onInput(Number(el.value)));
  return el;
}

function trackRow(t: Track, rerender: () => void): HTMLElement {
  const meta = TRACK_META[t.kind];
  const mute = h('button', { class: `ms${t.muted ? ' on mute' : ''}`, 'aria-label': `Mute ${meta.label}`, onClick: () => { edit(() => { t.muted = !t.muted; }); rerender(); } }, 'M');
  const solo = h('button', { class: `ms${t.solo ? ' on solo' : ''}`, 'aria-label': `Solo ${meta.label}`, onClick: () => { edit(() => { t.solo = !t.solo; }); rerender(); } }, 'S');
  return h('div', { class: 'mix-row' },
    h('span', { class: 'swatch', style: `background:${meta.color}` }),
    h('span', { class: 'mix-name' }, meta.label),
    slider(0, 1, 0.01, t.volume, (v) => edit(() => { t.volume = v; })),
    mute, solo);
}

export function openMixer(onClose?: () => void): void {
  const body = h('div', { class: 'stack' });
  const render = (): void => {
    const p = getProject();
    const swingLbl = h('span', { class: 'small muted' }, `${Math.round((p.swing / 0.3) * 100)}%`);
    const quantLbl = h('span', { class: 'small muted' }, `${Math.round(p.quantize * 100)}%`);
    body.replaceChildren(
      h('h2', null, 'Mixer'),
      p.tracks.length
        ? h('div', { class: 'stack' }, p.tracks.map((t) => trackRow(t, render)))
        : h('p', { class: 'muted small' }, 'No tracks yet — record something first.'),
      h('div', null,
        h('div', { class: 'row between' }, h('b', null, 'Swing'), swingLbl),
        slider(0, 0.3, 0.01, p.swing, (v) => {
          edit((q) => { q.swing = v; });
          swingLbl.textContent = `${Math.round((v / 0.3) * 100)}%`;
        })),
      h('div', null,
        h('div', { class: 'row between' }, h('b', null, 'Quantize strength'), quantLbl),
        slider(0, 1, 0.01, p.quantize, (v) => {
          edit((q) => { q.quantize = v; });
          quantLbl.textContent = `${Math.round(v * 100)}%`;
        }),
        h('p', { class: 'tiny muted' }, '100% = tight on the grid. Lower keeps more of your own timing.')),
      h('div', { class: 'row between' },
        h('b', null, 'Key'),
        h('span', { class: 'chip' }, p.key ? keyName(p.key) : 'not detected yet')),
    );
  };
  render();
  sheet(body, onClose);
}
