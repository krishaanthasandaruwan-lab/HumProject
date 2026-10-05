import { flushSave, getProject } from '../state';
import { h, toast } from './dom';
export function installSaveStatus(): void {
  const warning = h('div', { class: 'save-error hidden', role: 'alert' },
    h('span', null, 'Song not saved. Free some space, then retry.'),
    h('button', { type: 'button', class: 'link', onClick: () => flushSave() }, 'Retry'));
  document.body.append(warning);
  window.addEventListener('humm:save-status', (event) => {
    const status = (event as CustomEvent<{ ok: boolean; id: string }>).detail;
    if (status.id === getProject().id) warning.classList.toggle('hidden', status.ok);
  });
  window.addEventListener('humm:project-change', () => warning.classList.add('hidden'));
  window.addEventListener('humm:settings-error', () => toast('Settings could not be saved. Check device storage.'));
  window.addEventListener('humm:storage-error', () => toast('Couldn’t open saved songs. Please retry from My songs.'));
}
