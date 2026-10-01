// The song's play/stop square, shared by the Studio and the part editor.
import { player } from '../app';
import { unlockAudio } from '../audio/context';
import { prepareQuickly } from '../audio/prepare';
import { getProject } from '../state';
import { h } from './dom';
import { icon } from './icons';

export async function togglePlay(): Promise<void> {
  await unlockAudio();
  if (player.playing) return player.stop();
  await prepareQuickly(getProject()); // piano / guitar notes and voice layers, if not ready yet
  if (!player.playing) player.start();
}

/** Red 64 square; ink with a red stop icon while playing. Call sync() every frame. */
export function playSquare(): { el: HTMLButtonElement; sync: () => void } {
  const el = h('button', { type: 'button', class: 'playsq', 'aria-label': 'Play', 'aria-pressed': 'false', onClick: () => void togglePlay() }, icon('play', 28));
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
