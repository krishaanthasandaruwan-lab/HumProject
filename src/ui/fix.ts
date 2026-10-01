// "Fix" on a recorded part: fill a take that stopped early, then make its bars agree
// (model/autofix.ts). Never automatic — the Fix chip only shows when there is something to fix,
// and every fix can be undone.
import { fixDrums, fixNotes, type FixReport } from '../model/autofix';
import { stepDur, trackById, type DrumHit, type Note, type Track } from '../model/project';
import { edit, getProject } from '../state';
import { toast } from './dom';

interface Plan {
  report: FixReport;
  apply: (t: Track) => void;
}

function plan(id: string): Plan | null {
  const p = getProject();
  const t = trackById(p, id);
  if (!t || t.generated) return null;
  if (t.kind === 'drums') {
    if (!t.hits?.length) return null;
    const r = fixDrums(t.hits, p.bars, p.swing);
    return { report: r.report, apply: (tr) => { tr.hits = r.hits; } };
  }
  if (!t.notes?.length) return null;
  const r = fixNotes(t.notes, p.bars, p.swing);
  return { report: r.report, apply: (tr) => { tr.notes = r.notes; } };
}

/** True when Fix would change something in this part. */
export function canFix(id: string): boolean {
  return !!plan(id)?.report.changes;
}

/** Apply Fix, refresh the view, and offer Undo. */
export function runFix(id: string, refresh: () => void): void {
  const p = getProject();
  const t = trackById(p, id);
  const pl = plan(id);
  if (!t || !pl) return;
  if (!pl.report.changes) {
    toast('Every bar already agrees');
    return;
  }
  const hits: DrumHit[] | undefined = t.hits?.map((x) => ({ ...x }));
  const notes: Note[] | undefined = t.notes?.map((x) => ({ ...x }));
  edit(() => pl.apply(t));
  navigator.vibrate?.(10);
  refresh();
  const { filled, shiftSteps, changes } = pl.report;
  const ms = Math.round(Math.abs(shiftSteps) * stepDur(p.bpm) * 1000);
  const what = filled ? `Filled ${filled} empty ${filled === 1 ? 'bar' : 'bars'}` : `Fixed ${changes} ${t.kind === 'drums' ? 'hits' : 'notes'}`;
  const timing = ms ? ` · ${ms} ms ${shiftSteps > 0 ? 'late' : 'early'}` : '';
  toast(`${what}${timing}`, {
    label: 'Undo',
    run: () => {
      edit(() => {
        if (hits) t.hits = hits;
        if (notes) t.notes = notes;
      });
      refresh();
    },
  });
}
