// Recently deleted: deleted songs wait 30 days; restore one, delete one for good, or delete them all.
import { deleteForever, listTrash, restoreProject, TRASH_DAYS, type TrashMeta } from '../storage';
import { confirmSheet, h, sheet, toast } from './dom';
import { icon } from './icons';
import { iconBtn } from './kit';

const daysLeft = (m: TrashMeta): number => Math.max(1, Math.ceil(TRASH_DAYS - (Date.now() - m.deletedAt) / 86400e3));

/** The "Recently deleted" row at the bottom of My songs (nothing when the bin is empty). */
export async function trashRow(onChange: () => void): Promise<HTMLElement | null> {
  const items = await listTrash();
  if (!items.length) return null;
  return h('button', { type: 'button', class: 'card-list trash-row', onClick: () => void openTrash(onChange) },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('delete', 20)),
    h('span', null, h('b', null, 'Recently deleted'), h('small', null, `${items.length} ${items.length === 1 ? 'song' : 'songs'} · kept ${TRASH_DAYS} days`)),
    icon('open', 20));
}

async function openTrash(onChange: () => void): Promise<void> {
  const list = h('div', { class: 'listbox' });
  const deleteAll = h('button', { type: 'button', class: 'btn-del', onClick: () => void forgetAll() }, icon('delete', 20), 'Delete all');
  const render = async (): Promise<void> => {
    const items = await listTrash();
    if (!items.length) {
      close();
      onChange();
      return;
    }
    list.replaceChildren(...items.map((m) => h('div', { class: 'lrow' },
      h('b', null, m.name),
      h('span', { class: 'end' },
        iconBtn('undo', `Restore ${m.name}`, () => void restore(m), { ghost: true }),
        iconBtn('delete', `Delete ${m.name} for good`, () => void forget(m), { ghost: true })),
      h('small', null, `${daysLeft(m)} ${daysLeft(m) === 1 ? 'day' : 'days'} left`))));
  };
  async function restore(m: TrashMeta): Promise<void> {
    await restoreProject(m.id);
    toast('Restored');
    onChange();
    await render();
  }
  async function forget(m: TrashMeta): Promise<void> {
    if (!(await confirmSheet(`Delete “${m.name}” for good?`, 'Delete for good', true))) return;
    await deleteForever(m.id);
    await render();
  }
  async function forgetAll(): Promise<void> {
    const items = await listTrash();
    const what = items.length === 1 ? '1 song' : `all ${items.length} songs`;
    if (!(await confirmSheet(`Delete ${what} for good?`, 'Delete all for good', true))) return;
    for (const m of items) await deleteForever(m.id);
    toast(items.length === 1 ? 'Deleted' : `${items.length} songs deleted`);
    await render();
  }
  const close = sheet(h('div', { class: 'stack' }, list, deleteAll), onChange, 'Recently deleted');
  await render();
}
