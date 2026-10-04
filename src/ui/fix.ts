// "Fix" on a recorded part: fill a take that stopped early, then make its bars agree
// (model/autofix.ts). Never automatic — the Fix chip only shows when there is something to fix,
// and every fix can be undone.
import { fixDrums, fixNotes, type FixReport } from '../model/autofix';
import { stepDur, trackById, type DrumHit, type Note, type Track } from '../model/project';
import { markTool, unmarkTool } from '../pro/exports';
import { isPro } from '../pro/pro';
import { settings, updateSettings } from '../settings';
import { edit, getProject } from '../state';
import { chip } from './kit';
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

/** The red Fix chip for a part (with the Pro lock when it would make the song need Pro to export). */
export function fixChip(id: string, refresh: () => void): HTMLElement {
  return chip('Fix', () => runFix(id, refresh), { icon: 'fix', attn: true, lock: !isPro() });
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
  // Fix is a Pro tool: free to use, but the song then needs Pro to export (pro/exports.ts).
  let marked = false;
  edit((pp) => {
    pl.apply(t);
    marked = !isPro() && markTool(pp, 'fix');
  });
  navigator.vibrate?.(10);
  refresh();
  const { filled, shiftSteps, changes } = pl.report;
  const ms = Math.round(Math.abs(shiftSteps) * stepDur(p.bpm) * 1000);
  const what = filled ? `Filled ${filled} empty ${filled === 1 ? 'bar' : 'bars'}` : `Fixed ${changes} ${t.kind === 'drums' ? 'hits' : 'notes'}`;
  const timing = ms ? ` · ${ms} ms ${shiftSteps > 0 ? 'late' : 'early'}` : '';
  const undo = {
    label: 'Undo',
    run: () => {
      edit((pp) => {
        if (hits) t.hits = hits;
        if (notes) t.notes = notes;
        if (marked) unmarkTool(pp, 'fix');
      });
      refresh();
    },
  };
  // The Pro note (and its "Don't show again") rides on Fix's own message, until it is switched off.
  const note = marked && !settings().proNoticeOff;
  toast(`${what}${timing}${note ? ' · export needs Pro' : ''}`,
    note ? [undo, { label: 'Don’t show again', run: () => updateSettings({ proNoticeOff: true }) }] : undo);
}
