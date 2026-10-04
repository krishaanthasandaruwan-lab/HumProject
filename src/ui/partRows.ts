// The Studio's parts list: one row per part ("Drums", "Drums 2", "Bass"…). Tap opens the part editor,
// hold solos it, the sound chip opens Sounds, Fix shows only when it can help, and the speaker mutes.
import { prepareProject } from '../audio/prepare';
import type { Track } from '../model/project';
import { navigate } from '../router';
import { edit, getProject } from '../state';
import { h, toast } from './dom';
import { swipeToDelete } from './swipe';
import { makeChords } from './chords';
import { canFix, fixChip } from './fix';
import { icon, type IconName } from './icons';
import { chip } from './kit';
import { PARTS, partLabel } from './parts';
import { openSounds, soundName } from './soundsSheet';

const hasContent = (t: Track): boolean => (t.hits?.length ?? 0) + (t.notes?.length ?? 0) > 0;
const voiceTracks = (): Track[] => getProject().tracks.filter((t) => (t.kind === 'bass' || t.kind === 'lead') && t.rawVoice?.length && t.anchors?.length);

export function partList(onChange: () => void): { el: HTMLElement; refresh: () => void; empty: () => boolean } {
  const el = h('div', { class: 'parts', role: 'list', 'aria-label': 'Parts' });

  function row(id: string, ic: IconName, name: string, o: { muted: boolean; solo: boolean; sub: HTMLElement; fix?: HTMLElement | null; mute: () => void; soloable: Track | null }): HTMLElement {
    const open = (): void => navigate('part', { id });
    let held = false;
    let timer = 0;
    const r = h('div', { class: `partrow${o.muted ? ' muted' : ''}${o.solo ? ' solo' : ''}`, role: 'listitem', 'data-id': id },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic, 22)),
      h('button', { type: 'button', class: 'pname', onClick: () => { if (!held) open(); } }, name, o.solo ? h('span', { class: 'sr-only' }, ' (solo)') : null),
      h('span', { class: 'psub' }, o.sub),
      h('span', { class: 'pfix' }, o.fix ?? null),
      h('button', { type: 'button', class: 'icon-btn ghost pmute', 'aria-pressed': String(o.muted), 'aria-label': `Mute ${name}`, onClick: () => o.mute() },
        icon(o.muted ? 'mute' : 'unmute', 22)));
    r.addEventListener('click', (e) => {
      if (held || (e.target as HTMLElement).closest('button')) return;
      open();
    });
    const t = o.soloable;
    if (t) {
      r.addEventListener('pointerdown', (e) => {
        held = false;
        if ((e.target as HTMLElement).closest('.psub, .pfix, .pmute')) return;
        timer = window.setTimeout(() => {
          held = true;
          navigator.vibrate?.(12);
          edit(() => { t.solo = !t.solo; });
          refresh();
          onChange();
        }, 450);
      });
      const cancel = (): void => clearTimeout(timer);
      let x0 = 0;
      let y0 = 0;
      r.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
      r.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); }); // a swipe or scroll is not a hold
      r.addEventListener('pointerup', cancel);
      r.addEventListener('pointerleave', cancel);
      r.addEventListener('pointercancel', cancel);
      r.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    return r;
  }

  /** Swipe a part away: it leaves the song, with Undo. */
  function removePart(t: Track): void {
    const p = getProject();
    const at = p.tracks.indexOf(t);
    const name = partLabel(p, t);
    edit((pp) => { pp.tracks = pp.tracks.filter((x) => x !== t); });
    refresh();
    onChange();
    toast(`${name} removed`, { label: 'Undo', run: () => {
      edit((pp) => { pp.tracks.splice(Math.min(at, pp.tracks.length), 0, t); });
      refresh();
      onChange();
    } });
  }

  function trackRow(t: Track): HTMLElement {
    const changed = (): void => { refresh(); onChange(); };
    return swipeToDelete(row(t.id, PARTS[t.kind].icon, partLabel(getProject(), t), {
      muted: t.muted,
      solo: !!t.solo,
      soloable: t,
      sub: chip([soundName(t), icon('down', 14)], () => openSounds(t.id, changed)),
      fix: canFix(t.id) ? fixChip(t.id, changed) : null,
      mute: () => {
        edit(() => { t.muted = !t.muted; });
        changed();
      },
    }), () => removePart(t), `Remove ${partLabel(getProject(), t)}`);
  }

  function voiceRow(list: Track[]): HTMLElement {
    const on = list.some((t) => t.voice?.on);
    const tuned = list.some((t) => t.voice?.tune ?? true);
    return row('voice', PARTS.voice.icon, PARTS.voice.label, {
      muted: !on,
      solo: false,
      soloable: null,
      sub: chip(tuned ? 'Tuned' : 'Natural', () => navigate('part', { id: 'voice' })),
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

  /** Chords made from the melody, offered where the song has a tune but no chords yet. */
  function suggestion(): HTMLElement | null {
    const p = getProject();
    const tune = p.tracks.some((t) => (t.kind === 'lead' || t.kind === 'bass') && t.notes?.length);
    if (!tune || p.tracks.some((t) => t.kind === 'chords' && t.notes?.length)) return null;
    return h('button', { type: 'button', class: 'partrow suggest', onClick: () => makeChords(() => { refresh(); onChange(); }) },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('add', 22)),
      h('span', { class: 'pname' }, 'Add chords'),
      h('span', { class: 'psub small muted' }, 'Made from your melody'));
  }

  function refresh(): void {
    const p = getProject();
    const rows = p.tracks.filter(hasContent).map(trackRow);
    const voices = voiceTracks();
    if (voices.length) rows.push(voiceRow(voices));
    const s = suggestion();
    if (s) rows.push(s);
    el.replaceChildren(...rows);
  }

  refresh();
  return { el, refresh, empty: () => !getProject().tracks.some(hasContent) };
}
