// The song's play/stop square, shared by the Studio and the part editor.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { prepareQuickly } from '../audio/prepare';
import { getProject } from '../state';
import { h } from './dom';
import { icon } from './icons';
import { screenGeneration } from '../router';
let request = 0;
let pending = false;
let preparation: AbortController | null = null;
const cancel = (): void => { request++; pending = false; preparation?.abort(); preparation = null; };
window.addEventListener('humm:navigate', cancel);
window.addEventListener('humm:project-change', cancel);

export async function togglePlay(): Promise<void> {
  if (pending || player.playing) { cancel(); player.stop(); return; }
  const token = ++request;
  const generation = screenGeneration();
  const project = getProject();
  pending = true;
  const controller = new AbortController();
  preparation = controller;
  try {
    await unlockAudio();
    await prepareQuickly(project, 1500, controller.signal);
    if (token === request && generation === screenGeneration() && project.id === getProject().id && !document.hidden) player.start();
  } catch (error) {
    if ((error as Error).name !== 'AbortError') throw error;
  } finally { if (token === request) pending = false; }
}

/** Red 64 square; ink with a red stop icon while playing. Call sync() every frame. */
export function playSquare(): { el: HTMLButtonElement; sync: () => void } {
  const el = h('button', { type: 'button', class: 'playsq', 'aria-label': 'Play', 'aria-pressed': 'false', onClick: togglePlay }, icon('play', 28));
  let shown: boolean | null = null;
  const sync = (): void => {
    if (shown === player.playing) return;
    shown = player.playing;
    el.setAttribute('aria-pressed', String(shown));
    el.setAttribute('aria-label', shown ? 'Stop' : 'Play');
    el.replaceChildren(icon(shown ? 'stop' : 'play', 28));
  };
  return { el, sync };
}
