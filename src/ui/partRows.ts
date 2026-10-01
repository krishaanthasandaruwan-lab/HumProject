// The Studio's parts list: one row per part. Tap opens the part editor, hold solos it, the sound chip
// opens Sounds, Fix shows only when it can help, and the speaker mutes.
import { prepareProject } from '../audio/prepare';
import { TRACK_ORDER, type Track, type TrackKind } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { h } from './dom';
import { canFix, runFix } from './fix';
import { icon } from './icons';
import { chip } from './kit';
import { PARTS, type PartId } from './parts';
import { openSounds, soundName } from './soundsSheet';

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
const voiceTracks = (): Track[] => getProject().tracks.filter((t) => (t.kind === 'bass' || t.kind === 'lead') && t.rawVoice?.length && t.anchors?.length);

export function partList(onChange: () => void): { el: HTMLElement; refresh: () => void; empty: () => boolean } {
  const el = h('div', { class: 'parts', role: 'list', 'aria-label': 'Parts' });

  function row(id: PartId, o: { muted: boolean; solo: boolean; sub: HTMLElement; fix?: HTMLElement | null; mute: () => void }): HTMLElement {
    const name = PARTS[id].label;
    const open = (): void => navigate('part', { kind: id });
    let held = false;
    let timer = 0;
    const r = h('div', { class: `partrow${o.muted ? ' muted' : ''}${o.solo ? ' solo' : ''}`, role: 'listitem' },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(PARTS[id].icon, 22)),
      h('button', { type: 'button', class: 'pname', onClick: () => { if (!held) open(); } }, name, o.solo ? h('span', { class: 'sr-only' }, ' (solo)') : null),
      h('span', { class: 'psub' }, o.sub),
      h('span', { class: 'pfix' }, o.fix ?? null),
      h('button', { type: 'button', class: 'icon-btn ghost pmute', 'aria-pressed': String(o.muted), 'aria-label': `Mute ${name.toLowerCase()}`, onClick: () => o.mute() },
        icon(o.muted ? 'mute' : 'unmute', 22)));
    r.addEventListener('click', (e) => {
      if (held || (e.target as HTMLElement).closest('button')) return;
      open();
    });
    if (id !== 'voice') {
      r.addEventListener('pointerdown', (e) => {
        held = false;
        if ((e.target as HTMLElement).closest('.psub, .pfix, .pmute')) return;
        timer = window.setTimeout(() => {
          held = true;
          navigator.vibrate?.(12);
          edit((p) => {
            const t = p.tracks.find((x) => x.kind === id);
            if (t) t.solo = !t.solo;
          });
          refresh();
          onChange();
        }, 450);
      });
      const cancel = (): void => clearTimeout(timer);
      r.addEventListener('pointerup', cancel);
      r.addEventListener('pointerleave', cancel);
      r.addEventListener('pointercancel', cancel);
      r.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    return r;
  }

  function trackRow(t: Track): HTMLElement {
    const kind: TrackKind = t.kind;
    return row(kind, {
      muted: t.muted,
      solo: !!t.solo,
      sub: chip([soundName(kind), icon('down', 14)], () => openSounds(kind, refresh)),
      fix: canFix(kind) ? chip('Fix', () => runFix(kind, () => { refresh(); onChange(); }), { icon: 'fix', attn: true }) : null,
      mute: () => {
        edit(() => { t.muted = !t.muted; });
        refresh();
        onChange();
      },
    });
  }

  function voiceRow(list: Track[]): HTMLElement {
    const on = list.some((t) => t.voice?.on);
    const tuned = list.some((t) => t.voice?.tune ?? true);
    return row('voice', {
      muted: !on,
      solo: false,
      sub: chip(tuned ? 'Tuned' : 'Natural', () => navigate('part', { kind: 'voice' })),
      mute: () => {
        edit(() => {
          for (const t of list) t.voice = { ...(t.voice ?? { tune: true, level: 0.8 }), on: !on };
        });
        void prepareProject(getProject()).catch(() => undefined);
        refresh();
        onChange();
      },
    });
  }

  function refresh(): void {
    const p = getProject();
    const rows = TRACK_ORDER.map((k) => p.tracks.find((t) => t.kind === k)).filter((t): t is Track => !!t && hasContent(t)).map(trackRow);
    const voices = voiceTracks();
    if (voices.length) rows.push(voiceRow(voices));
    el.replaceChildren(...rows);
  }

  refresh();
  return { el, refresh, empty: () => !getProject().tracks.some(hasContent) };
}
