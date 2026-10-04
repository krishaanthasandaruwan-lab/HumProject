// The note shown when a Pro feature is used ("Fix is Pro · export needs Pro"), with Undo and
// "Don't show again" — once chosen, it stays quiet (the Share sheet still lists what is Pro in a song).
import { settings, updateSettings } from '../settings';
import { toast } from './dom';

export function proNotice(msg: string, undo: () => void): void {
  if (settings().proNoticeOff) return;
  toast(msg, [
    { label: 'Undo', run: undo },
    { label: 'Don’t show again', run: () => updateSettings({ proNoticeOff: true }) },
  ]);
}
