import type { Project } from '../model/project';
import { refreshBilling } from './billing';
import { canExport } from './exports';
import { isPro } from './pro';

export async function authorizeExport(project: Project, midi = false): Promise<void> {
  await refreshBilling();
  if (midi && !isPro()) throw new Error('MIDI files are part of Pro.');
  const check = canExport(project);
  if (!check.ok) throw new Error(check.reason);
}
