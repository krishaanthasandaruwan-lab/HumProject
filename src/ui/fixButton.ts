// "✨ Fix" on a recorded part: make its bars agree (model/autofix.ts). Never automatic — the button
// glows when there is something to fix, and every fix can be undone.
import { fixDrums, fixNotes, type FixReport } from '../model/autofix';
import { getTrack, stepDur, type DrumHit, type Note, type Track, type TrackKind } from '../model/project';
import { edit, getProject } from '../state';
import { h, toast } from './dom';

interface Plan {
  report: FixReport;
  apply: (t: Track) => void;
}

function plan(kind: TrackKind): Plan | null {
  const p = getProject();
  const t = getTrack(p, kind);
  if (!t || t.generated) return null;
  if (kind === 'drums') {
    if (!t.hits?.length) return null;
    const r = fixDrums(t.hits, p.bars, p.swing);
    return { report: r.report, apply: (tr) => { tr.hits = r.hits; } };
  }
  if (!t.notes?.length) return null;
  const r = fixNotes(t.notes, p.bars, p.swing);
  return { report: r.report, apply: (tr) => { tr.notes = r.notes; } };
}

export function fixButton(kind: TrackKind, refresh: () => void): HTMLElement | null {
  const first = plan(kind);
  if (!first) return null;
  const btn = h('button', { class: `mini${first.report.changes ? ' glow' : ''}`, title: 'Make the bars agree with each other' }, '✨ Fix');
  btn.addEventListener('click', () => {
    const p = getProject();
    const t = getTrack(p, kind);
    const pl = plan(kind);
    if (!t || !pl) return;
    if (!pl.report.changes) {
      toast('✨ Every bar already agrees — nothing to fix');
      return;
    }
    const hits: DrumHit[] | undefined = t.hits?.map((x) => ({ ...x }));
    const notes: Note[] | undefined = t.notes?.map((x) => ({ ...x }));
    edit(() => pl.apply(t));
    refresh();
    const ms = Math.round(Math.abs(pl.report.shiftSteps) * stepDur(p.bpm) * 1000);
    const timing = ms ? ` · timing was ${ms} ms ${pl.report.shiftSteps > 0 ? 'late' : 'early'}` : '';
    toast(`✨ Fixed ${pl.report.changes} ${kind === 'drums' ? 'hits' : 'notes'}${timing}`, {
      label: 'Undo',
      run: () => {
        edit(() => {
          if (hits) t.hits = hits;
          if (notes) t.notes = notes;
        });
        refresh();
      },
    });
  });
  return btn;
}
